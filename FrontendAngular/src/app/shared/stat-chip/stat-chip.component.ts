import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-stat-chip',
  standalone: true,
  templateUrl: './stat-chip.component.html',
  styleUrl: './stat-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostCls()' },
})
export class StatChipComponent {
  value   = input.required<number | string>();
  label   = input.required<string>();
  variant = input<'default' | 'ok' | 'error' | 'new' | 'warn'>('default');

  protected hostCls = computed(() => `stat-chip--${this.variant()}`);
}
