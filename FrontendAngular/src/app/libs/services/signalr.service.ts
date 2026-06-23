import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { TokenHelper } from '../helpers/token-helper';
import { environment } from '../../../environments/environment';

const HUB_URL = `${environment.apiBaseUrl}/messagehub`;

export const TgEvent = {
  LoggedIn: 'onTlgLoggedIn',
  QrTimeout: 'onTlgQrTimeout',
  PasswordState: 'onPasswordState',
  QrChange: 'onTlgQrChange',
  LoginPhone: 'onTlgLoginPhone',
  AuthRestart: 'onAuthRestart',
  Authorized: 'onAuthorized',
  Disconnected: 'onDisconnected',
  Session: 'onTlgSession',
} as const;

export interface QrChangePayload { qrCode: string; instanceId: string; }
export interface QrTimeoutPayload { instanceId: string; }
export interface PasswordStatePayload { state: string; instanceId: string; }

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private connection: signalR.HubConnection | null = null;
  private currentGroup: string | null = null;
  private handlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  // Realtime link state for the connection-state center. 'idle' = not started /
  // intentionally stopped (no banner); 'reconnecting' = link dropped, retrying.
  readonly connectionState = signal<'idle' | 'connected' | 'reconnecting'>('idle');

  async connect(groupName: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected && this.currentGroup === groupName) return;
    await this.disconnect();

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => TokenHelper.getToken()?.accessToken ?? '',
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => ctx.previousRetryCount < 1000 ? 5000 : null })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    for (const [event, callbacks] of this.handlers) {
      for (const cb of callbacks) this.connection.on(event, cb);
    }

    // Track link lifecycle so the connection-state center can show a reconnect banner.
    this.connection.onreconnecting(() => this.connectionState.set('reconnecting'));
    this.connection.onreconnected(() => this.connectionState.set('connected'));
    this.connection.onclose(() => this.connectionState.set('idle'));

    await this.connection.start();
    this.connectionState.set('connected');
    await this.connection.invoke('AddConnectionGroup', groupName);
    this.currentGroup = groupName;
  }

  on<T = unknown>(eventName: string, callback: (payload: T) => void): void {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, new Set());
    this.handlers.get(eventName)!.add(callback as (...args: unknown[]) => void);
    this.connection?.on(eventName, callback);
  }

  off(eventName: string, callback?: (...args: unknown[]) => void): void {
    if (callback) {
      this.handlers.get(eventName)?.delete(callback);
      this.connection?.off(eventName, callback);
    } else {
      this.handlers.delete(eventName);
      this.connection?.off(eventName);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) { await this.connection.stop(); this.connection = null; }
    this.currentGroup = null;
    this.connectionState.set('idle');
  }

  get isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}
