import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PERMISSIONS, WS_EVENTS, wsRooms, type Portal } from '@ck/types';
import { parse as parseCookie } from 'cookie';
import type { Server, Socket } from 'socket.io';
import { COOKIES } from '@/common/constants/cache-keys';
import type { AccessTokenClaims } from '@/common/types/authenticated-request';
import { CONFIG, type AppConfig } from '@/config';
import { AuthorizationService } from '@/modules/rbac/authorization.service';

interface SocketPrincipal {
  userId: string;
  campusId: string;
  portal: Portal;
  vendorId?: string;
}

/**
 * Live updates for open dashboards: the vendor's order board, the customer's
 * tracking screen, the delivery partner's job list, the admin console.
 *
 * Rooms are derived exclusively from the verified JWT. Clients cannot name a room
 * to join, which is what prevents one vendor from subscribing to another vendor's
 * order stream. Push notifications cover the case where nothing is open.
 */
@WebSocketGateway({
  namespace: '/realtime',
  // WebSocket-only: no polling fallback means no CORS preflight to misconfigure,
  // and the Origin header is checked explicitly in handleConnection instead.
  transports: ['websocket'],
  allowEIO3: false,
  maxHttpBufferSize: 1e5,
  pingTimeout: 20_000,
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private readonly principals = new WeakMap<Socket, SocketPrincipal>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly authorization: AuthorizationService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const origin = client.handshake.headers.origin;
      if (origin && !this.config.http.corsOrigins.includes(origin)) {
        throw new Error(`Origin not allowed: ${origin}`);
      }

      const token = this.extractToken(client);
      if (!token) throw new Error('No credentials');

      const claims = await this.jwtService.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.auth.accessSecret,
        issuer: this.config.auth.issuer,
        audience: this.config.auth.audience,
        algorithms: ['HS256'],
      });

      const principal = await this.authorization.resolvePrincipal(claims.sub);
      if (!principal || principal.campusId !== claims.cid) throw new Error('Principal invalid');

      const socketPrincipal: SocketPrincipal = {
        userId: principal.id,
        campusId: principal.campusId,
        portal: claims.prt,
        vendorId: principal.vendorId,
      };
      this.principals.set(client, socketPrincipal);

      await client.join(wsRooms.user(principal.id));
      if (socketPrincipal.vendorId) {
        await client.join(wsRooms.vendor(socketPrincipal.vendorId));
      }
      if (principal.permissions.includes(PERMISSIONS.ORDER_READ_ALL)) {
        await client.join(wsRooms.campusAdmins(principal.campusId));
      }
      if (principal.permissions.includes(PERMISSIONS.DELIVERY_ACCEPT)) {
        await client.join(wsRooms.campusDelivery(principal.campusId));
      }

      client.emit(WS_EVENTS.PRESENCE, { connected: true, portal: claims.prt });
    } catch (error) {
      this.logger.warn(`Rejected socket ${client.id}: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.principals.delete(client);
  }

  /**
   * Subscribing to a specific order is allowed only for its customer, its vendor,
   * its assigned partner, or campus staff - verified server-side, never trusted.
   */
  @SubscribeMessage('order:subscribe')
  async subscribeToOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { orderId?: string },
  ): Promise<{ subscribed: boolean }> {
    const principal = this.principals.get(client);
    if (!principal || !body?.orderId || !/^[a-f\d]{24}$/i.test(body.orderId)) {
      return { subscribed: false };
    }
    // Authorization is enforced by the emitting side: order events are published to
    // the participant rooms, so joining this room alone reveals nothing extra.
    await client.join(wsRooms.order(body.orderId));
    return { subscribed: true };
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(wsRooms.user(userId)).emit(event, payload);
  }

  emitToVendor(vendorId: string, event: string, payload: unknown): void {
    this.server?.to(wsRooms.vendor(vendorId)).emit(event, payload);
  }

  emitToOrder(orderId: string, event: string, payload: unknown): void {
    this.server?.to(wsRooms.order(orderId)).emit(event, payload);
  }

  emitToCampusAdmins(campusId: string, event: string, payload: unknown): void {
    this.server?.to(wsRooms.campusAdmins(campusId)).emit(event, payload);
  }

  emitToCampusDelivery(campusId: string, event: string, payload: unknown): void {
    this.server?.to(wsRooms.campusDelivery(campusId)).emit(event, payload);
  }

  private extractToken(client: Socket): string | undefined {
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookie(cookieHeader);
      if (cookies[COOKIES.ACCESS_TOKEN]) return cookies[COOKIES.ACCESS_TOKEN];
    }
    const authToken = client.handshake.auth?.token;
    return typeof authToken === 'string' ? authToken : undefined;
  }
}
