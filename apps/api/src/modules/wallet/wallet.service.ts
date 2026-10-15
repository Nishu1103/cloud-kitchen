import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ERROR_CODES,
  NOTIFICATION_TYPE,
  WALLET_TXN_TYPE,
  formatMoney,
  type Paise,
  type WalletTxnType,
} from '@ck/types';
import { Model, Types, type ClientSession } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { paginated } from '@/common/utils/pagination.util';
import {
  User,
  WalletTransaction,
  type UserDocument,
  type WalletTransactionDocument,
} from '@/database/schemas';
import { NotificationsService } from '@/modules/notifications/notifications.service';

interface LedgerEntry {
  userId: string;
  campusId: string;
  type: WalletTxnType;
  /** Signed: positive credits, negative debits. */
  amount: Paise;
  description: string;
  orderId?: string;
  paymentId?: string;
  performedBy?: string;
  idempotencyKey?: string;
}

/**
 * Wallet balances are derived from an append-only ledger.
 *
 * Every mutation is a conditional atomic update plus a ledger row in the same
 * transaction. Debits require the balance to still be sufficient at write time, so
 * two concurrent orders cannot both spend the same rupee, and `balanceAfter` on each
 * row makes the history auditable rather than merely plausible.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(WalletTransaction.name)
    private readonly ledgerModel: Model<WalletTransactionDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async balance(userId: string): Promise<{ balance: Paise }> {
    const user = await this.userModel.findById(userId).select('walletBalance').lean();
    return { balance: user?.walletBalance ?? 0 };
  }

  async history(userId: string, page: number, limit: number) {
    const filter = { userId: new Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      this.ledgerModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ledgerModel.countDocuments(filter),
    ]);
    return paginated(items, total, page, limit);
  }

  async credit(entry: Omit<LedgerEntry, 'amount'> & { amount: Paise }, session?: ClientSession) {
    if (entry.amount <= 0) throw AppException.internal('Credit amount must be positive.');
    return this.apply({ ...entry, amount: Math.abs(entry.amount) }, session);
  }

  /** Debits only if funds are still available at write time. */
  async debit(entry: Omit<LedgerEntry, 'amount'> & { amount: Paise }, session?: ClientSession) {
    if (entry.amount <= 0) throw AppException.internal('Debit amount must be positive.');
    return this.apply({ ...entry, amount: -Math.abs(entry.amount) }, session);
  }

  private async apply(
    entry: LedgerEntry,
    session?: ClientSession,
  ): Promise<{ balance: Paise; transactionId: string }> {
    const options = session ? { session } : {};

    // Guard against replayed queue jobs before touching the balance.
    if (entry.idempotencyKey) {
      const existing = await this.ledgerModel
        .findOne({ idempotencyKey: entry.idempotencyKey })
        .lean();
      if (existing) {
        return { balance: existing.balanceAfter, transactionId: String(existing._id) };
      }
    }

    const filter: Record<string, unknown> = { _id: new Types.ObjectId(entry.userId) };
    if (entry.amount < 0) {
      filter.walletBalance = { $gte: Math.abs(entry.amount) };
    }

    const user = await this.userModel.findOneAndUpdate(
      filter,
      { $inc: { walletBalance: entry.amount } },
      { new: true, ...options },
    );

    if (!user) {
      throw AppException.unprocessable(
        ERROR_CODES.INSUFFICIENT_FUNDS,
        'Your wallet balance is not enough for this transaction.',
      );
    }

    const [transaction] = await this.ledgerModel.create(
      [
        {
          userId: new Types.ObjectId(entry.userId),
          campusId: new Types.ObjectId(entry.campusId),
          type: entry.type,
          amount: entry.amount,
          balanceAfter: user.walletBalance,
          description: entry.description,
          orderId: entry.orderId ? new Types.ObjectId(entry.orderId) : undefined,
          paymentId: entry.paymentId ? new Types.ObjectId(entry.paymentId) : undefined,
          performedBy: entry.performedBy ? new Types.ObjectId(entry.performedBy) : undefined,
          idempotencyKey: entry.idempotencyKey,
        },
      ],
      options,
    );

    if (entry.amount > 0 && entry.type !== WALLET_TXN_TYPE.ORDER_PAYMENT) {
      void this.notificationsService
        .notify({
          userId: entry.userId,
          campusId: entry.campusId,
          type: NOTIFICATION_TYPE.WALLET_CREDITED,
          title: `${formatMoney(entry.amount)} added to your wallet`,
          body: entry.description,
          deepLink: '/wallet',
        })
        .catch((error) => this.logger.warn(`Wallet notification failed: ${String(error)}`));
    }

    return { balance: user.walletBalance, transactionId: String(transaction!._id) };
  }

  /** Operator-initiated correction. Always audited by the calling controller. */
  async adjust(params: {
    userId: string;
    campusId: string;
    amount: Paise;
    reason: string;
    performedBy: string;
  }) {
    const entry = {
      userId: params.userId,
      campusId: params.campusId,
      type: WALLET_TXN_TYPE.ADMIN_ADJUSTMENT,
      description: params.reason,
      performedBy: params.performedBy,
      amount: Math.abs(params.amount),
    };
    return params.amount >= 0 ? this.credit(entry) : this.debit(entry);
  }
}
