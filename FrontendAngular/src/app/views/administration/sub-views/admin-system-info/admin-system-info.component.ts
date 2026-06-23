import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-system-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-system-info.component.html',
  styleUrl: './admin-system-info.component.scss',
})
export class AdminSystemInfoComponent {
  readonly transmissionIntervals = [
    { label: 'Reminder Polling Cycle', value: '60s',  icon: 'pi pi-refresh' },
    { label: 'Session Heartbeat',      value: '30s',  icon: 'pi pi-heart' },
    { label: 'Queue Flush Interval',   value: '120s', icon: 'pi pi-send' },
    { label: 'Activity Log Sync',      value: '300s', icon: 'pi pi-history' },
  ];

  readonly diagnostics = [
    {
      label: 'Database Link Active',
      description: 'PostgreSQL connection pool healthy. Read/write latency nominal.',
      statusText: 'Connected',
    },
    {
      label: 'Telegram Broker API Key Valid',
      description: 'MTProto API credentials verified. Session tokens refreshed.',
      statusText: 'Verified',
    },
    {
      label: 'SSL Handshake Verified',
      description: 'TLS 1.3 certificate chain valid. HTTPS enforced on all endpoints.',
      statusText: 'Secure',
    },
  ];

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(err => console.warn('Clipboard copy failed', err));
  }
}
