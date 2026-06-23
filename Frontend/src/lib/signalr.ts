import * as signalR from '@microsoft/signalr';
import { getStoredToken } from './api';

const HUB_URL = '/messagehub';

// Payload shapes matching TSignalRMethod event names from the backend
export interface QrChangePayload {
  qrCode: string;
  instanceId: string;
}

export interface QrTimeoutPayload {
  instanceId: string;
}

export interface PasswordStatePayload {
  state: string;
  instanceId: string;
}

// Event name constants matching TSignalRMethod.cs
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

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private currentGroup: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers: Map<string, Set<(...args: any[]) => void>> = new Map();

  async connect(groupName: string): Promise<void> {
    if (
      this.connection?.state === signalR.HubConnectionState.Connected &&
      this.currentGroup === groupName
    ) {
      return;
    }

    await this.disconnect();

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => getStoredToken() ?? '',
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) =>
          ctx.previousRetryCount < 1000 ? 5000 : null,
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Re-apply any handlers registered before (or between) connections
    for (const [event, callbacks] of this.handlers) {
      for (const cb of callbacks) {
        this.connection.on(event, cb);
      }
    }

    await this.connection.start();
    await this.connection.invoke('AddConnectionGroup', groupName);
    this.currentGroup = groupName;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on<T = any>(eventName: string, callback: (payload: T) => void): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(callback);
    this.connection?.on(eventName, callback);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(eventName: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.handlers.get(eventName)?.delete(callback);
      this.connection?.off(eventName, callback);
    } else {
      this.handlers.delete(eventName);
      this.connection?.off(eventName);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
    this.currentGroup = null;
  }

  get isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

export const signalRService = new SignalRService();
