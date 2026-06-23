import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { ApiService } from '../../libs/services/api.service';
import { MessageQueueItem } from '../../libs/models/types';
import { SharedModules } from '../../libs/modules/shared-modules';

@Component({
  selector: 'app-message-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SharedModules
  ],
  templateUrl: './message-center.component.html',
  styleUrl: './message-center.component.scss',
})
export class MessageCenterComponent {
  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService
  ) { }


  searchQuery = '';
  selectedLocationFilter: string | null = null;
  selectedStatusFilter: string | null = null;
  selectedItem = signal<MessageQueueItem | null>(null);

  statusFilterOptions = [
    { label: 'Pending', value: 'Pending' },
    { label: 'Sent', value: 'Sent' },
    { label: 'Delivered', value: 'Delivered' },
    { label: 'Failed', value: 'Failed' },
  ];

  locationOptions = computed(() =>
    this.state.locations().map(l => ({ label: l.name, value: l.name }))
  );

  filteredMessages = computed(() => {
    let list = this.state.messages();
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(m =>
        m.residentName.toLowerCase().includes(q) ||
        m.unit.toLowerCase().includes(q) ||
        m.service.toLowerCase().includes(q) ||
        m.telegram.toLowerCase().includes(q)
      );
    }
    if (this.selectedLocationFilter) {
      list = list.filter(m => m.locationName === this.selectedLocationFilter);
    }
    if (this.selectedStatusFilter) {
      list = list.filter(m => m.status === this.selectedStatusFilter);
    }
    return list;
  });

  pendingCount = computed(() => this.state.messages().filter(m => m.status === 'Pending').length);
  failedCount = computed(() => this.state.messages().filter(m => m.status === 'Failed').length);

  selectItem(msg: MessageQueueItem): void {
    this.selectedItem.set(msg);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Pending': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'Sent': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Delivered': return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
      case 'Failed': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  }

  getStatusDotClass(status: string): string {
    switch (status) {
      case 'Pending': return 'bg-amber-400';
      case 'Sent': return 'bg-emerald-400';
      case 'Delivered': return 'bg-teal-400';
      case 'Failed': return 'bg-rose-400';
      default: return 'bg-slate-400';
    }
  }

  formatTimestamp(ts: string): string {
    try {
      return new Date(ts).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return ts;
    }
  }

  markSent(msg: MessageQueueItem): void {
    this.state.messages.update(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'Sent' as const } : m));
    this.state.addActivity('Mark Sent', `Message to ${msg.residentName} marked as sent`, 'success');
  }

  deleteMessage(msg: MessageQueueItem): void {
    if (confirm(`Delete message for ${msg.residentName}?`)) {
      if (this.selectedItem()?.id === msg.id) {
        this.selectedItem.set(null);
      }
      this.state.messages.update(prev => prev.filter(m => m.id !== msg.id));
      this.state.addActivity('Delete Message', `Message for ${msg.residentName} deleted`, 'info');
    }
  }
}
