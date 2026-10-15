import { WS_EVENTS, type WsEvent } from '@ck/types';
import { io, type Socket } from 'socket.io-client';

export interface RealtimeConfig {
  /** Origin only, e.g. `https://api.campuskitchen.in`; the namespace is appended. */
  url: string;
  /**
   * Optional bearer token for clients that cannot send cookies (native wrappers).
   * Browsers should omit it: the httpOnly cookie travels with the handshake.
   */
  token?: string;
  onStatusChange?: (status: RealtimeStatus) => void;
}

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

export type RealtimeHandler<T = unknown> = (payload: T) => void;

export interface RealtimeClient {
  on<T = unknown>(event: WsEvent, handler: RealtimeHandler<T>): () => void;
  /** Joins an order's room so tracking updates arrive without polling. */
  subscribeToOrder(orderId: string): Promise<boolean>;
  status(): RealtimeStatus;
  disconnect(): void;
}

/**
 * Live updates for whatever screen is open.
 *
 * Rooms are derived from the verified JWT on the server, so there is nothing to
 * authorise here and no room name a client can forge. Push notifications cover the
 * case where no tab is open; this covers the case where one is, and is why a vendor's
 * order board updates without a refresh.
 */
export function createRealtimeClient(config: RealtimeConfig): RealtimeClient {
  let status: RealtimeStatus = 'connecting';

  const setStatus = (next: RealtimeStatus) => {
    if (status === next) return;
    status = next;
    config.onStatusChange?.(next);
  };

  const socket: Socket = io(`${config.url.replace(/\/$/, '')}/realtime`, {
    // WebSocket only: the gateway rejects long-polling, and a failed upgrade would
    // otherwise leave the client silently on a transport the server does not accept.
    transports: ['websocket'],
    withCredentials: true,
    auth: config.token ? { token: config.token } : undefined,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    // Capped with jitter so a campus-wide Wi-Fi blip does not reconnect in lockstep.
    reconnectionDelayMax: 15_000,
    randomizationFactor: 0.5,
    timeout: 10_000,
  });

  socket.on('connect', () => setStatus('connected'));
  socket.on('disconnect', () => setStatus('disconnected'));
  socket.on('connect_error', () => setStatus('disconnected'));

  return {
    on<T>(event: WsEvent, handler: RealtimeHandler<T>) {
      const wrapped = (payload: unknown) => handler(payload as T);
      socket.on(event, wrapped);
      return () => socket.off(event, wrapped);
    },

    subscribeToOrder(orderId: string) {
      return new Promise<boolean>((resolve) => {
        // Acknowledgement-based, with a timeout, so a caller is never left awaiting a
        // reply that a dropped connection will never send.
        const timer = setTimeout(() => resolve(false), 5_000);
        socket.emit('order:subscribe', { orderId }, (ack: { subscribed: boolean } | undefined) => {
          clearTimeout(timer);
          resolve(Boolean(ack?.subscribed));
        });
      });
    },

    status: () => status,

    disconnect() {
      socket.removeAllListeners();
      socket.disconnect();
      setStatus('disconnected');
    },
  };
}

export { WS_EVENTS };
export type { WsEvent };
