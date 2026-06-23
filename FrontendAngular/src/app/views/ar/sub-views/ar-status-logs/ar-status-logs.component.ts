import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Bill, BillOperationOutcome, BillStatus } from '../../../../libs/models/types';
import { SharedModules } from '../../../../libs/modules/shared-modules';

@Component({
  selector: 'app-ar-status-logs',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './ar-status-logs.component.html',
  styleUrl: './ar-status-logs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArStatusLogsComponent {
  bill   = input<Bill | null>(null);
  closed = output<void>();

  protected visible = computed(() => this.bill() !== null);
  protected logs    = computed(() => this.bill()?.statusLogs ?? []);

  protected statusClass(s: BillStatus): string {
    const map: Record<BillStatus, string> = {
      Preparing: 'log-status--preparing',
      Due:       'log-status--due',
      Overdue:   'log-status--overdue',
      Paid:      'log-status--paid',
    };
    return map[s];
  }

  protected outcomeClass(o: BillOperationOutcome): string {
    const map: Record<BillOperationOutcome, string> = {
      Success: 'log-outcome--success',
      Failed:  'log-outcome--failed',
      Pending: 'log-outcome--pending',
    };
    return map[o];
  }

  protected outcomeIcon(o: BillOperationOutcome): string {
    const map: Record<BillOperationOutcome, string> = {
      Success: 'pi-check-circle',
      Failed:  'pi-times-circle',
      Pending: 'pi-clock',
    };
    return map[o];
  }
}
