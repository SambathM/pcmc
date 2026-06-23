import { Injectable, computed, signal } from '@angular/core';
import { SignalrService } from './signalr.service';

export type ConnectionStatus = 'online' | 'offline' | 'unstable';

export interface ConnectionNotice {
  text: string;
  icon: string;
  severity: 'warn' | 'error';
}

/**
 * Central connection-state signal. Hybrid detection:
 *  - the browser's online/offline state (the user's own internet), and
 *  - the SignalR realtime link (a proxy for backend reachability while online).
 * Exposes a `notice` the UI shows as a pre-emptive sticky banner — i.e. before a
 * request even fails — so the user knows it's their network vs. the server.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private readonly browserOnline = signal(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  constructor(private readonly signalr: SignalrService) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.browserOnline.set(true));
      window.addEventListener('offline', () => this.browserOnline.set(false));
    }
  }

  /** Overall connection status. Browser-offline takes priority over a flaky link. */
  readonly status = computed<ConnectionStatus>(() => {
    if (!this.browserOnline()) return 'offline';
    return this.signalr.connectionState() === 'reconnecting' ? 'unstable' : 'online';
  });

  /** Banner notice while there's a problem; null when the connection is healthy. */
  readonly notice = computed<ConnectionNotice | null>(() => {
    switch (this.status()) {
      case 'offline':
        return {
          text: 'No internet connection — check your network. Changes won’t be saved until you’re back online.',
          icon: 'pi-wifi',
          severity: 'error',
        };
      case 'unstable':
        return {
          text: 'Reconnecting to the server…',
          icon: 'pi-sync',
          severity: 'warn',
        };
      default:
        return null;
    }
  });
}
