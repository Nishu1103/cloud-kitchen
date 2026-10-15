'use client';

import { formatMoney } from '@ck/types';
import { EmptyState, Pagination, SkeletonText } from '@ck/ui';
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from 'lucide-react';
import { useState } from 'react';
import { AccountPanel, AccountSubhead } from '@/components/account-subhead';
import { RequireAuth } from '@/components/require-auth';
import { useWallet, useWalletTransactions } from '@/hooks/use-account';

function WalletContents() {
  const [page, setPage] = useState(1);
  const wallet = useWallet();
  const transactions = useWalletTransactions(page);
  const items = transactions.data?.items ?? [];

  return (
    <div>
      <AccountSubhead title="Wallet & Points" subtitle="Refunds land here instantly" />
      <div className="space-y-4 px-4">
        <AccountPanel className="relative overflow-hidden p-5">
          <p className="text-caption uppercase tracking-wide text-ink-subtle">Balance</p>
          <p className="mt-1 font-serif text-display text-gold">
            {wallet.isLoading ? '—' : formatMoney(wallet.data?.balance ?? 0)}
          </p>
          <p className="mt-1 text-caption text-ink-muted">Usable on any campus kitchen</p>
          {wallet.data?.locked ? (
            <p className="mt-3 text-caption text-ink-muted">
              Held for open orders: {formatMoney(wallet.data.locked)}
            </p>
          ) : null}
          <WalletIcon aria-hidden className="absolute right-5 top-5 h-14 w-14 text-gold/20" />
        </AccountPanel>

        <h2 className="font-serif text-title text-ink">Activity</h2>
        <AccountPanel>
          {transactions.isLoading ? (
            <div className="p-4">
              <SkeletonText lines={5} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState title="No wallet activity yet" description="Refunds and credits show here." />
          ) : (
            <ul>
              {items.map((txn) => {
                const credit = txn.amount > 0;
                return (
                  <li key={txn.id} className="flex items-center gap-3 border-b border-white/8 p-4 last:border-b-0">
                    <span
                      className={
                        credit
                          ? 'flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success'
                          : 'flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-ink-muted'
                      }
                    >
                      {credit ? (
                        <ArrowDownLeft aria-hidden className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight aria-hidden className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body text-ink">{txn.description}</p>
                      <p className="tabular text-caption text-ink-subtle">
                        {new Date(txn.createdAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <p className={credit ? 'tabular font-serif text-title text-success' : 'tabular font-serif text-title text-ink'}>
                      {credit ? '+' : '−'}
                      {formatMoney(Math.abs(txn.amount))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </AccountPanel>

        {transactions.data ? (
          <Pagination
            page={transactions.data.page}
            limit={transactions.data.limit}
            total={transactions.data.total}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <RequireAuth message="Sign in to see your wallet.">
      <WalletContents />
    </RequireAuth>
  );
}
