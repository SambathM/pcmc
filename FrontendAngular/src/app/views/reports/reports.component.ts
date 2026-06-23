import { Component, computed, ChangeDetectionStrategy } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { SharedModules } from '../../libs/modules/shared-modules';

@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModules],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  constructor(
    readonly state: AppStateService,
  ) { }

  totalPaid = computed(() =>
    this.state.bills().filter(b => b.status === 'Paid').reduce((s, b) => s + b.amount, 0)
  );
  totalOutstanding = computed(() =>
    this.state.bills().filter(b => b.status !== 'Paid').reduce((s, b) => s + b.amount, 0)
  );
  totalOverdue = computed(() =>
    this.state.bills().filter(b => b.status === 'Overdue').reduce((s, b) => s + b.amount, 0)
  );
  totalOverdueBills = computed(() =>
    this.state.bills().filter(b => b.status === 'Overdue').length
  );

  locationSummary = computed(() => {
    const bills = this.state.bills();
    const locations = this.state.locations();
    const residents = this.state.residents();

    return locations.map(loc => {
      const locBills = bills.filter(b => b.locationName === loc.name);
      const locResidents = residents.filter(r => r.locationName === loc.name);
      return {
        name: loc.name,
        residentCount: locResidents.length,
        overdueBills: locBills.filter(b => b.status === 'Overdue').length,
        totalOutstanding: locBills.filter(b => b.status !== 'Paid').reduce((s, b) => s + b.amount, 0),
      };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  });

  billStatusSummary = computed(() => {
    const bills = this.state.bills();
    const statuses = ['Paid', 'Due', 'Overdue'] as const;
    return statuses.map(status => ({
      status,
      count: bills.filter(b => b.status === status).length,
      total: bills.filter(b => b.status === status).reduce((s, b) => s + b.amount, 0),
    }));
  });

  serviceSummary = computed(() => {
    const bills = this.state.bills();
    const serviceMap = new Map<string, { billCount: number; totalAmount: number }>();
    for (const bill of bills) {
      const existing = serviceMap.get(bill.service) || { billCount: 0, totalAmount: 0 };
      serviceMap.set(bill.service, {
        billCount: existing.billCount + 1,
        totalAmount: existing.totalAmount + bill.amount,
      });
    }
    return Array.from(serviceMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  });

  getStatusPercent(count: number): number {
    const total = this.state.bills().length;
    return total === 0 ? 0 : (count / total) * 100;
  }

  getStatusDotClass(status: string): string {
    switch (status) {
      case 'Paid': return 'bg-emerald-400';
      case 'Due': return 'bg-amber-400';
      case 'Overdue': return 'bg-rose-400';
      default: return 'bg-slate-400';
    }
  }

  getStatusAmountClass(status: string): string {
    switch (status) {
      case 'Paid': return 'text-emerald-400';
      case 'Due': return 'text-amber-400';
      case 'Overdue': return 'text-rose-400';
      default: return 'text-slate-400';
    }
  }

  getStatusBarClass(status: string): string {
    switch (status) {
      case 'Paid': return 'bg-emerald-500';
      case 'Due': return 'bg-amber-500';
      case 'Overdue': return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  }
}
