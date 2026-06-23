import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { ApiService } from '../../libs/services/api.service';
import { ServiceItem } from '../../libs/models/types';
import { ConfirmationService } from 'primeng/api';
import { SharedModules } from '../../libs/modules/shared-modules';

@Component({
  selector: 'app-services',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SharedModules
  ],
  providers: [ConfirmationService],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent {
  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService,
    private readonly confirmation: ConfirmationService,
  ) { }

  searchQuery = '';

  showModal = signal(false);
  editing = signal<ServiceItem | null>(null);
  saving = signal(false);
  serviceForm = { name: '', description: '', reminderTemplate: '' };

  showTemplateModal = signal(false);
  templateEditing = signal<ServiceItem | null>(null);
  savingTemplate = signal(false);
  templateText = '';

  readonly templateTokens: ReadonlyArray<{ token: string; label: string }> = [
    { token: '{name}', label: 'Resident name' },
    { token: '{service}', label: 'Service name' },
    { token: '{amount}', label: 'Amount due' },
    { token: '{dueDate}', label: 'Due date' },
    { token: '{unit}', label: 'Unit / room' },
  ];

  insertToken(token: string, el: HTMLTextAreaElement): void {
    const start = el.selectionStart ?? this.templateText.length;
    const end = el.selectionEnd ?? this.templateText.length;
    this.templateText = this.templateText.slice(0, start) + token + this.templateText.slice(end);
    const pos = start + token.length;
    setTimeout(() => { el.focus(); el.setSelectionRange(pos, pos); });
  }

  get filteredServices(): ServiceItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    const all = this.state.services();
    if (!q) return all;
    return all.filter(s =>
      s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q));
  }

  openAddModal(): void {
    this.editing.set(null);
    this.serviceForm = { name: '', description: '', reminderTemplate: '' };
    this.showModal.set(true);
  }

  openEditModal(service: ServiceItem): void {
    this.editing.set(service);
    this.serviceForm = {
      name: service.name,
      description: service.description ?? '',
      reminderTemplate: service.reminderTemplate ?? '',
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editing.set(null);
  }

  saveService(): void {
    const name = this.serviceForm.name.trim();
    if (!name) return;
    const data = { name, description: this.serviceForm.description, reminderTemplate: this.serviceForm.reminderTemplate };
    const editing = this.editing();
    this.saving.set(true);
    if (editing) {
      this.api.updateService(editing.id, data).then(() => {
        this.state.services.update(prev => prev.map(s => s.id === editing.id ? { ...s, ...data } : s));
        this.state.addActivity('Update Service', `Service "${name}" updated`, 'info');
        this.closeModal();
      }).catch((err: unknown) => console.error('Failed to update service', err))
        .finally(() => this.saving.set(false));
    } else {
      this.api.createService(data).then(created => {
        this.state.services.update(prev => [...prev, {
          id: created.id, name: created.name, description: created.description,
          activeResidents: created.activeResidents ?? 0, outstandingAmount: created.outstandingAmount ?? 0,
          reminderTemplate: created.reminderTemplate,
        }]);
        this.state.addActivity('Create Service', `Service "${created.name}" created`, 'success');
        this.closeModal();
      }).catch((err: unknown) => console.error('Failed to create service', err))
        .finally(() => this.saving.set(false));
    }
  }

  openTemplateModal(service: ServiceItem): void {
    this.templateEditing.set(service);
    this.templateText = service.reminderTemplate ?? '';
    this.showTemplateModal.set(true);
  }

  closeTemplateModal(): void {
    this.showTemplateModal.set(false);
    this.templateEditing.set(null);
  }

  saveTemplate(): void {
    const service = this.templateEditing();
    if (!service) return;
    const reminderTemplate = this.templateText;
    this.savingTemplate.set(true);
    this.api.updateService(service.id, { name: service.name, description: service.description, reminderTemplate })
      .then(() => {
        this.state.services.update(prev => prev.map(s => s.id === service.id ? { ...s, reminderTemplate } : s));
        this.state.addActivity('Update Template', `Reminder template for "${service.name}" updated`, 'info');
        this.closeTemplateModal();
      })
      .catch((err: unknown) => console.error('Failed to update template', err))
      .finally(() => this.savingTemplate.set(false));
  }

  deleteService(service: ServiceItem): void {
    this.confirmation.confirm({
      header: 'Delete Service?',
      message: `This will permanently remove "${service.name}". This may affect existing bills and cannot be undone.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete Service',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => this.performDelete(service),
    });
  }

  private performDelete(service: ServiceItem): void {
    this.api.removeService(service.id).then(() => {
      this.state.services.update(prev => prev.filter(s => s.id !== service.id));
      this.state.addActivity('Delete Service', `Service "${service.name}" deleted`, 'info');
    }).catch((err: unknown) => console.error('Failed to delete service', err));
  }
}
