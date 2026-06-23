import { Component, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { Resident } from '../../libs/models/types';
import { SharedModules } from '../../libs/modules/shared-modules';

@Component({
  selector: 'app-residents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModules],
  templateUrl: './residents.component.html',
  styleUrl: './residents.component.scss',
})
export class ResidentsComponent {
  constructor(readonly state: AppStateService) { }

  searchQuery = signal('');
  selectedLocationFilter = signal<string | null>(null);
  selectedStatusFilter = signal<string | null>(null);

  statusOptions = [
    { label: 'Paid', value: 'Paid' },
    { label: 'Due', value: 'Due' },
    { label: 'Overdue', value: 'Overdue' },
  ];

  locationOptions = computed(() => {
    const locs = this.state.locations();
    return [
      ...locs.map(l => ({ label: l.name, value: l.name })),
    ];
  });

  filteredResidents = computed(() => {
    let list = this.state.residents();
    const q = this.searchQuery().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.unit.toLowerCase().includes(q) ||
        (r.telegram && r.telegram.toLowerCase().includes(q))
      );
    }
    const loc = this.selectedLocationFilter();
    if (loc) list = list.filter(r => r.locationName === loc);
    const status = this.selectedStatusFilter();
    if (status) list = list.filter(r => r.status === status);
    return list;
  });

  totalOutstanding = computed(() =>
    this.filteredResidents()
      .filter(r => r.status !== 'Paid')
      .reduce((sum, r) => sum + r.balance, 0)
  );

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getBalanceClass(balance: number): string {
    if (balance <= 0) return 'res-balance-neutral';
    if (balance > 500) return 'res-balance-over';
    return 'res-balance-warn';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Paid': return 'status-paid';
      case 'Due': return 'status-due';
      case 'Overdue': return 'status-overdue';
      default: return '';
    }
  }

  getStatusDotClass(status: string): string {
    switch (status) {
      case 'Paid': return 'dot-paid';
      case 'Due': return 'dot-due';
      case 'Overdue': return 'dot-overdue';
      default: return '';
    }
  }

  sendReminder(resident: Resident): void {
    this.state.triggerSingleReminder(resident);
    this.state.addActivity('Send Reminder', `Manual reminder sent to ${resident.name} (${resident.unit})`, 'success');
  }

  deleteResident(resident: Resident): void {
    if (confirm(`Remove resident ${resident.name}?`)) {
      this.state.residents.update(prev => prev.filter(r => r.code !== resident.code));
      this.state.addActivity('Remove Resident', `Resident ${resident.name} removed`, 'info');
    }
  }
}
