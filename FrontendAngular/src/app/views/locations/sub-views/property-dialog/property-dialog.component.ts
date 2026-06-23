import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { AppStateService } from '../../../../libs/services/app-state.service';
import { ApiService } from '../../../../libs/services/api.service';
import { Location, TelegramSession } from '../../../../libs/models/types';
import { SharedModules } from '../../../../libs/modules/shared-modules';

interface LocationForm {
  name: string;
  code: string;
  logo: string;
  assignedTelegramSessionId: number | null;
}

@Component({
  selector: 'app-property-dialog',
  imports: [SharedModules],
  templateUrl: './property-dialog.component.html',
  styleUrl: './property-dialog.component.scss',
})
export class PropertyDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() editingLocation: Location | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();

  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService,
  ) {}

  locationForm: LocationForm = { name: '', code: '', logo: '', assignedTelegramSessionId: null };
  showTgDropdown = false;
  saving = false;
  logoFile: File | null = null;
  logoPreview = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && !changes['visible']?.previousValue) {
      this.initForm();
    }
    if (changes['visible']?.currentValue === false) {
      this.showTgDropdown = false;
    }
  }

  get selectedSession(): TelegramSession | undefined {
    return this.state.telegramSessions().find(s => s.id === this.locationForm.assignedTelegramSessionId);
  }

  tgLabel(s: TelegramSession): string {
    return [s.firstName, s.lastName].filter(Boolean).join(' ') || s.userName || s.phoneNumber || 'Unknown';
  }

  tgInitials(s: TelegramSession): string {
    return this.tgLabel(s).substring(0, 2).toUpperCase();
  }

  handleLogoFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { this.logoPreview = e.target?.result as string; };
    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = '';
  }

  async handleSaveLocation(): Promise<void> {
    if (!this.locationForm.name.trim()) return;
    this.saving = true;
    try {
      if (this.editingLocation) {
        const updated = await this.api.updateProperty(
          parseInt(this.editingLocation.id),
          { name: this.locationForm.name.trim(), logo: this.locationForm.logo, assignedTelegramSessionId: this.locationForm.assignedTelegramSessionId },
          this.logoFile ?? undefined,
        );
        this.state.locations.update(prev => prev.map(l => l.id === this.editingLocation!.id
          ? { ...l, name: updated.name, logo: updated.logo, assignedTelegramSessionId: updated.assignedTelegramSessionId, assignedTelegramSession: updated.assignedTelegramSession }
          : l
        ));
        this.state.addActivity('Property Updated', `Updated property "${updated.name}"`, 'success');
      } else {
        const created = await this.api.createProperty(
          { name: this.locationForm.name.trim(), code: this.locationForm.code.trim() || undefined, assignedTelegramSessionId: this.locationForm.assignedTelegramSessionId ?? undefined },
          this.logoFile ?? undefined,
        );
        this.state.locations.update(prev => [...prev, {
          id: String(created.id), name: created.name, residentsCount: 0, outstandingBalance: 0,
          assignedTelegramSessionId: created.assignedTelegramSessionId, assignedTelegramSession: created.assignedTelegramSession,
          lastReminderActivity: '', logo: created.logo,
        }]);
        this.state.addActivity('Property Created', `Added new property "${created.name}"`, 'success');
      }
      this.visibleChange.emit(false);
    } finally { this.saving = false; }
  }

  private initForm(): void {
    if (this.editingLocation) {
      this.locationForm = {
        name: this.editingLocation.name,
        code: '',
        logo: this.editingLocation.logo ?? '',
        assignedTelegramSessionId: this.editingLocation.assignedTelegramSessionId ?? null,
      };
    } else {
      this.locationForm = { name: '', code: '', logo: '', assignedTelegramSessionId: null };
    }
    this.logoFile = null;
    this.logoPreview = '';
    this.showTgDropdown = false;
  }
}
