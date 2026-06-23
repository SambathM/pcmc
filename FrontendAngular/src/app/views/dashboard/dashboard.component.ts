import { Component, computed } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { Location } from '../../libs/models/types';
import { SharedModules } from '../../libs/modules/shared-modules';

@Component({
  selector: 'app-dashboard',
  imports: [SharedModules],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  constructor(
    readonly state: AppStateService,
  ) { }

  locationOptions = computed(() => [
    { label: '🌍 All Locations (Global View)', value: 'All Locations' },
    ...this.state.locations().map(l => ({ label: '🏢 ' + l.name, value: l.name })),
  ]);

  filteredResidents = computed(() => {
    const loc = this.state.selectedLocation();
    return loc === 'All Locations' ? this.state.residents() : this.state.residents().filter(r => r.locationName === loc);
  });

  filteredBills = computed(() => {
    const loc = this.state.selectedLocation();
    return loc === 'All Locations' ? this.state.bills() : this.state.bills().filter(b => b.locationName === loc);
  });

  filteredMessages = computed(() => {
    const loc = this.state.selectedLocation();
    return loc === 'All Locations' ? this.state.messages() : this.state.messages().filter(m => m.locationName === loc);
  });

  totalOutstanding = computed(() => this.filteredBills().filter(b => b.status !== 'Paid').reduce((s, b) => s + b.amount, 0));
  residentsDueCount = computed(() => this.filteredResidents().filter(r => r.status !== 'Paid').length);
  pendingCount = computed(() => this.filteredMessages().filter(m => m.status === 'Pending').length);
  overdueCount = computed(() => this.filteredBills().filter(b => b.status === 'Overdue').length);
  duePercent = computed(() => {
    const total = this.filteredResidents().length;
    return total > 0 ? ((this.residentsDueCount() / total) * 100).toFixed(0) : 0;
  });

  benefits = [
    { num: '01', title: 'Centralized Control', desc: 'Connect and manage multiple Telegram accounts under a unified console.' },
    { num: '02', title: 'Automated Schedules', desc: 'Define strict pre-due/post-grace offsets. System generates reminder queues.' },
    { num: '03', title: 'Real-Time Tracking', desc: 'Parse resident Excel ledgers, validate customer accounts, and audit conversations.' },
  ];

  onLocationChange(value: string): void {
    this.state.selectedLocation.set(value);
    this.state.addActivity('Location Context Adjusted', `Active operational scope switched to ${value}`, 'info');
  }

  selectLocation(loc: Location): void {
    this.state.selectedLocation.set(loc.name);
    this.state.addActivity('Location Context Adjusted', `Active operational scope switched to ${loc.name}`, 'info');
  }

  locResidentCount(loc: Location): number {
    return this.state.residents().filter(r => r.locationName === loc.name).length;
  }

  locOutstanding(loc: Location): number {
    return this.state.bills().filter(b => b.locationName === loc.name && b.status !== 'Paid').reduce((s, b) => s + b.amount, 0);
  }

  handleRefresh(): void {
    this.state.addActivity('Metrics Refreshed', 'Staff manual refresh successfully pulled latest ledger records.', 'info');
  }
}
