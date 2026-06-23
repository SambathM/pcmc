import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { ApiService } from '../../libs/services/api.service';
import { ReminderConfig } from '../../libs/models/types';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { CheckboxModule } from 'primeng/checkbox';
import { SharedModules } from '../../libs/modules/shared-modules';

@Component({
  selector: 'app-reminder-scheduler',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SharedModules,
    ToggleSwitchModule,
    CheckboxModule,
  ],
  templateUrl: './reminder-scheduler.component.html',
  styleUrl: './reminder-scheduler.component.scss',
})
export class ReminderSchedulerComponent {
  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService,
  ) { }

  editingConfigId = signal<number | null>(null);
  editTemplateBuffer = '';

  enabledCount = computed(() => this.state.configs().filter(c => c.enabled).length);

  startEditTemplate(config: ReminderConfig): void {
    this.editingConfigId.set(config.id);
    this.editTemplateBuffer = config.template;
  }

  cancelEditTemplate(): void {
    this.editingConfigId.set(null);
    this.editTemplateBuffer = '';
  }

  saveTemplate(config: ReminderConfig): void {
    const template = this.editTemplateBuffer;
    this.state.configs.update(configs =>
      configs.map(c => c.id === config.id ? { ...c, template } : c)
    );
    this.api.updateReminderConfig(config.id, { template }).catch(() => {
      // revert on failure
      this.state.configs.update(configs =>
        configs.map(c => c.id === config.id ? { ...c, template: config.template } : c)
      );
    });
    this.state.addActivity('Update Template', `Reminder template updated for "${config.name}"`, 'info');
    this.editingConfigId.set(null);
    this.editTemplateBuffer = '';
  }

  onToggleEnabled(config: ReminderConfig, event: { checked: boolean }): void {
    const enabled = event.checked;
    this.state.configs.update(configs =>
      configs.map(c => c.id === config.id ? { ...c, enabled } : c)
    );
    this.api.updateReminderConfig(config.id, { enabled }).catch(() => {
      // revert on failure
      this.state.configs.update(configs =>
        configs.map(c => c.id === config.id ? { ...c, enabled: !enabled } : c)
      );
    });
    this.state.addActivity(
      enabled ? 'Enable Reminder' : 'Disable Reminder',
      `Reminder "${config.name}" ${enabled ? 'enabled' : 'disabled'}`,
      'info'
    );
  }
}
