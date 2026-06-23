import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { AppStateService } from '../../../../libs/services/app-state.service';
import { ApiService } from '../../../../libs/services/api.service';
import { Location, TelegramContactItem, ChatImportItem } from '../../../../libs/models/types';
import { SharedModules } from '../../../../libs/modules/shared-modules';

@Component({
  selector: 'app-import-chats-dialog',
  imports: [SharedModules],
  templateUrl: './import-chats-dialog.component.html',
  styleUrl: './import-chats-dialog.component.scss',
})
export class ImportChatsDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() activeLoc: Location | undefined;
  @Output() visibleChange = new EventEmitter<boolean>();

  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService,
  ) {}

  importSearchQuery = '';
  chatsLoading = false;
  telegramChats: TelegramContactItem[] = [];
  selectedChatIds: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && !changes['visible']?.previousValue) {
      this.loadChats();
    }
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

  getChatName(c: TelegramContactItem): string {
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || c.phone || 'Unknown';
  }

  isAlreadyImported(c: TelegramContactItem): boolean {
    const result = this.state.residents().find(
      r => (c.phone && r.phone === c.phone) || (c.username && r.telegram === `@${(c.username ?? '').replace(/^@/, '')}`)
    );
    if (result) c.isSelected = true;
    return !!result;
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
    this.visibleChange.emit(false);
  }

  private async loadChats(): Promise<void> {
    const sessionId = this.activeLoc?.assignedTelegramSessionId;
    this.telegramChats = [];
    this.selectedChatIds = [];
    this.importSearchQuery = '';
    if (!sessionId) return;
    this.chatsLoading = true;
    try {
      this.telegramChats = await this.api.sessionContacts(sessionId);
    } catch { this.telegramChats = []; }
    finally { this.chatsLoading = false; }
  }
}
