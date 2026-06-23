import { Component } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { ApiService } from '../../libs/services/api.service';
import { Location, Resident } from '../../libs/models/types';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SharedModules } from '../../libs/modules/shared-modules';
import { ImportChatsDialogComponent } from './sub-views/import-chats-dialog/import-chats-dialog.component';
import { PropertyDialogComponent } from './sub-views/property-dialog/property-dialog.component';

type SendStatus = 'auto' | 'sent' | 'unconfigured' | 'sending';

const LOC_COLORS = ['loc-color-blue', 'loc-color-green', 'loc-color-purple', 'loc-color-amber'];

@Component({
  selector: 'app-locations',
  imports: [SharedModules, ConfirmDialogModule, ImportChatsDialogComponent, PropertyDialogComponent],
  providers: [ConfirmationService],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss',
})
export class LocationsComponent {
  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService,
    private readonly confirmation: ConfirmationService,
  ) {}

  condoSearchQuery = '';
  chatSearchQuery = '';

  showImportModal = false;
  showLocationModal = false;
  editingLocation: Location | null = null;
  openCardMenuId: string | null = null;

  sendConfigs: Record<string, SendStatus> = {};
  openDropdownCode: string | null = null;

  // ---- Derived getters ----

  get filteredCondos(): Location[] {
    const q = this.condoSearchQuery.toLowerCase();
    if (!q) return this.state.locations();
    return this.state.locations().filter(l => l.name.toLowerCase().includes(q));
  }

  get activeLoc(): Location | undefined {
    return this.state.locations().find(l => l.name === this.state.selectedLocation()) ?? this.state.locations()[0];
  }

  get activeResidents(): Resident[] {
    return this.state.residents().filter(r => r.locationName === (this.activeLoc?.name ?? ''));
  }

  get filteredChats(): Resident[] {
    const q = this.chatSearchQuery.toLowerCase();
    if (!q) return this.activeResidents;
    return this.activeResidents.filter(r =>
      r.name.toLowerCase().includes(q) || r.telegram.toLowerCase().includes(q) ||
      r.unit.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q)
    );
  }

  get importedCount(): number {
    return this.state.residents().filter(r => r.locationName === (this.activeLoc?.name ?? '') && r.chatImported).length;
  }

  get activeTgName(): string {
    const tg = this.activeLoc?.assignedTelegramSession;
    if (!tg) return '';
    return [tg.firstName, tg.lastName].filter(Boolean).join(' ') || tg.phoneNumber || 'Unknown';
  }

  // ---- Helpers ----

  getLocInitials(name: string): string {
    return name.replace('Condo ', '').replace('Borey ', '').replace('Estate ', '')
      .split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase();
  }

  getLocColor(name: string): string {
    return LOC_COLORS[name.length % LOC_COLORS.length];
  }

  getResidentInitials(name: string): string {
    return name.split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase();
  }

  getUnpaidBalance(code: string): number {
    return this.state.bills().filter(b => b.residentCode === code && b.status !== 'Paid').reduce((s, b) => s + b.amount, 0);
  }

  getSendConfig(code: string): SendStatus {
    return this.sendConfigs[code] ?? 'unconfigured';
  }

  // ---- Actions ----

  updateSendConfig(code: string, status: SendStatus): void {
    this.sendConfigs = { ...this.sendConfigs, [code]: status };
    this.openDropdownCode = null;
    this.state.addActivity('Updated dispatch strategy', `Modified resident ${code} delivery status to ${status}`, 'info');
  }

  handleSelectCondo(name: string): void {
    this.state.selectedLocation.set(name);
    this.chatSearchQuery = '';
    this.state.addActivity('Property Context Switched', `Active workspace changed to ${name}`, 'info');
  }

  startImportChats(): void {
    this.showImportModal = true;
  }

  openAddModal(): void {
    this.editingLocation = null;
    this.showLocationModal = true;
  }

  openEditModal(loc: Location): void {
    this.editingLocation = loc;
    this.openCardMenuId = null;
    this.showLocationModal = true;
  }

  confirmDelete(loc: Location): void {
    this.confirmation.confirm({
      header: 'Delete Property?',
      message: `This will permanently remove "${loc.name}" and cannot be undone. All linked residents will lose their location reference.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete Property',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => this.performDelete(loc),
    });
  }

  private async performDelete(loc: Location): Promise<void> {
    try {
      await this.api.removeProperty(parseInt(loc.id));
      this.state.locations.update(prev => prev.filter(l => l.id !== loc.id));
      this.state.addActivity('Property Deleted', `Removed property "${loc.name}"`, 'warning');
    } catch (err: unknown) {
      console.error('Failed to delete property', err);
    }
  }
}
