import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { SharedModules } from '../../../../libs/modules/shared-modules';
import { ApiService } from '../../../../libs/services/api.service';

@Component({
  selector: 'app-admin-bill-rules',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModules],
  templateUrl: './admin-bill-rules.component.html',
  styleUrl: './admin-bill-rules.component.scss',
})
export class AdminBillRulesComponent {
  private readonly api = inject(ApiService);

  ruleLoading = signal(true);
  ruleSaving = signal(false);
  ruleError = signal<string | null>(null);
  ruleSuccess = signal(false);
  ruleUpdatedOn = signal<string | null>(null);
  preparingDays = signal(5);
  overdueDays = signal(7);

  constructor() {
    this.api.getBillRule()
      .then(rule => {
        this.preparingDays.set(rule.preparingDays);
        this.overdueDays.set(rule.overdueDays);
        this.ruleUpdatedOn.set(rule.updatedOn);
      })
      .catch(() => { /* fall back to defaults silently */ })
      .finally(() => this.ruleLoading.set(false));
  }

  saveRule(): void {
    this.ruleSaving.set(true);
    this.ruleError.set(null);
    this.ruleSuccess.set(false);
    this.api.updateBillRule({ preparingDays: this.preparingDays(), overdueDays: this.overdueDays() })
      .then(updated => {
        this.ruleUpdatedOn.set(updated.updatedOn);
        this.ruleSuccess.set(true);
        setTimeout(() => this.ruleSuccess.set(false), 3000);
      })
      .catch(err => {
        this.ruleError.set(err instanceof Error ? err.message : 'Failed to save rule.');
      })
      .finally(() => this.ruleSaving.set(false));
  }
}
