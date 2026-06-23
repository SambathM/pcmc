import { Component } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { ApiService } from '../../libs/services/api.service';
import { Location, Resident, TelegramSession, TelegramContactItem, ChatImportItem } from '../../libs/models/types';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SharedModules } from '../../libs/modules/shared-modules';

interface LocationForm {
  name: string;
  code: string;
  logo: string;
  assignedTelegramSessionId: number | null;
}

type SendStatus = 'auto' | 'sent' | 'unconfigured' | 'sending';

const LOC_COLORS = ['loc-color-blue', 'loc-color-green', 'loc-color-purple', 'loc-color-amber'];

@Component({
  selector: 'app-locations',
  imports: [SharedModules, ConfirmDialogModule],
  providers: [ConfirmationService],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss',
})
export class LocationsComponent {
  defaultSelected: any = true;
  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService,
    private readonly confirmation: ConfirmationService,
  ) { }


  condoSearchQuery = '';
  chatSearchQuery = '';
  importSearchQuery = '';

  showImportModal = false;
  chatsLoading = false;
  telegramChats: TelegramContactItem[] = [];
  selectedChatIds: string[] = [];

  showLocationModal = false;
  editingLocation: Location | null = null;
  locationForm: LocationForm = { name: '', code: '', logo: '', assignedTelegramSessionId: null };
  showTgDropdown = false;
  openCardMenuId: string | null = null;
  saving = false;
  logoFile: File | null = null;
  logoPreview = '';

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

  get filteredImportChats(): TelegramContactItem[] {
    if (!this.importSearchQuery) return this.telegramChats;
    const q = this.importSearchQuery.toLowerCase();
    return this.telegramChats.filter(c => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || c.phone || '';
      return name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.username ?? '').toLowerCase().includes(q);
    });
  }

  get importNonImported(): TelegramContactItem[] {
    return this.filteredImportChats.filter(c => !this.isAlreadyImported(c));
  }

  get importAllSelected(): boolean {
    return this.importNonImported.length > 0 &&
      this.importNonImported.every(c => this.selectedChatIds.includes(c.id.toString()));
  }

  get importSomeSelected(): boolean {
    return !this.importAllSelected && this.importNonImported.some(c => this.selectedChatIds.includes(c.id.toString()));
  }

  get selectedSession(): TelegramSession | undefined {
    return this.state.telegramSessions().find(s => s.id === this.locationForm.assignedTelegramSessionId);
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

  tgLabel(s: TelegramSession): string {
    return [s.firstName, s.lastName].filter(Boolean).join(' ') || s.userName || s.phoneNumber || 'Unknown';
  }

  tgInitials(s: TelegramSession): string {
    return this.tgLabel(s).substring(0, 2).toUpperCase();
  }

  getChatName(c: TelegramContactItem): string {
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || c.phone || 'Unknown';
  }

  isAlreadyImported(c: TelegramContactItem): boolean {
    const result = this.state.residents().find(
      r => (c.phone && r.phone === c.phone) || (c.username && r.telegram === `@${(c.username ?? '').replace(/^@/, '')}`)
    );
    if (result) {
      c.isSelected = true; // Auto-select already imported contacts
    }
    return !!result;
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

  async startImportChats(): Promise<void> {
    const sessionId = this.activeLoc?.assignedTelegramSessionId;
    this.telegramChats = [];
    this.selectedChatIds = [];
    this.importSearchQuery = '';
    this.showImportModal = true;
    if (!sessionId) return;
    this.chatsLoading = true;
    try {
      this.telegramChats = await this.api.sessionContacts(sessionId);
    } catch { this.telegramChats = []; }
    finally { this.chatsLoading = false; }
  }

  toggleChatSelect(id: string): void {
    this.selectedChatIds = this.selectedChatIds.includes(id)
      ? this.selectedChatIds.filter(c => c !== id)
      : [...this.selectedChatIds, id];
  }

  toggleSelectAll(): void {
    if (this.importAllSelected) {
      this.selectedChatIds = this.selectedChatIds.filter(id => !this.importNonImported.some(c => c.id.toString() === id));
    } else {
      this.selectedChatIds = [...new Set([...this.selectedChatIds, ...this.importNonImported.map(c => c.id.toString())])];
    }
  }

  async executeImport(): Promise<void> {
    const selected = this.telegramChats.filter(c => this.selectedChatIds.includes(c.id.toString()));
    if (!selected.length) return;
    const items: ChatImportItem[] = selected.map(c => ({
      code: `TG-${c.id}`,
      name: this.getChatName(c),
      unit: '', email: '',
      telegram: c.username ? `@${c.username.replace(/^@/, '')}` : '',
      phone: c.phone ?? '',
      telegramSessionContactId: c.id,
      profilePhoto: c.profilePhoto,
    }));
    await this.state.importChats(this.activeLoc?.name ?? '', items);
    this.showImportModal = false;
  }

  openAddModal(): void {
    this.editingLocation = null;
    this.locationForm = { name: '', code: '', logo: '', assignedTelegramSessionId: null };
    this.logoFile = null;
    this.logoPreview = '';
    this.showLocationModal = true;
  }

  openEditModal(loc: Location): void {
    this.editingLocation = loc;
    this.locationForm = { name: loc.name, code: '', logo: loc.logo ?? '', assignedTelegramSessionId: loc.assignedTelegramSessionId ?? null };
    this.logoFile = null;
    this.logoPreview = '';
    this.openCardMenuId = null;
    this.showLocationModal = true;
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
      this.showLocationModal = false;
    } finally { this.saving = false; }
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
