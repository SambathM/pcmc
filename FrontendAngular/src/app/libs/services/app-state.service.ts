import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  Location, Resident, Bill, ServiceItem, ReminderConfig,
  MessageQueueItem, ActivityLog, TelegramAccount, TelegramSession, ChatImportItem,
  PcmcProperty, PcmcCustomer, PcmcService, PcmcBillItem, UnitItem,
} from '../models/types';
import { ApiService } from './api.service';
import { initialTelegramAccounts, initialMessageQueue, initialActivityLogs, formatTemplate } from '../../data/initial-data';
import { TokenHelper } from '../helpers/token-helper';

function propertyToLocation(p: PcmcProperty): Location {
  return {
    id: String(p.id), name: p.name, code: p.code, residentsCount: p.residentsCount,
    outstandingBalance: p.outstandingBalance, assignedTelegramSessionId: p.assignedTelegramSessionId,
    assignedTelegramSession: p.assignedTelegramSession,
    lastReminderActivity: p.lastReminderActivity ?? '', logo: p.logo,
  };
}

function customerToResident(c: PcmcCustomer): Resident {
  return {
    code: c.code, name: c.name, unit: c.unit ?? '', telegram: c.telegram ?? '',
    balance: 0, status: 'Due', locationName: c.locationName ?? '', locationIds: c.locationIds ?? [], phone: c.phone ?? '',
    chatImported: c.chatImported, joinDate: c.joinDate, email: c.email ?? '',
    avatar: c.avatar, telegramSessionContactId: c.telegramSessionContactId, profilePhoto: c.profilePhoto,
  };
}

function serviceToItem(s: PcmcService): ServiceItem {
  return { id: s.id, name: s.name, description: s.description, activeResidents: s.activeResidents, outstandingAmount: s.outstandingAmount, reminderTemplate: s.reminderTemplate };
}

function billToItem(b: PcmcBillItem): Bill {
  return {
    id: String(b.id), residentCode: b.residentCode, residentName: b.residentName,
    unit: b.unit, service: b.service, amount: b.amount, dueDate: b.dueDate,
    status: b.status as Bill['status'], autoSend: b.autoSend, locationName: b.locationName,
  };
}

/** A persistent error notice shown in the global error dialog. */
export interface AppNotice {
  title: string;
  message: string;
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class AppStateService {
  constructor(
    private readonly api: ApiService,
    private readonly router: Router) { }

  // Auth
  isAuthenticated = signal(!!TokenHelper.getToken());
  isCheckingAuth = signal(!!TokenHelper.getToken());
  // When true the global login dialog is shown (the root component watches this).
  // We use a dialog instead of routing to /login because auth is API-based — there
  // is no identity-server cookie round-trip that needs a dedicated page.
  loginRequired = signal(false);
  // Holds a connection/server error notice; the root component shows a persistent
  // dialog while this is set. Null = no error.
  serverError = signal<AppNotice | null>(null);

  // Data
  locations = signal<Location[]>([]);
  telegramSessions = signal<TelegramSession[]>([]);
  telegramAccounts = signal<TelegramAccount[]>(initialTelegramAccounts);
  residents = signal<Resident[]>([]);
  bills = signal<Bill[]>([]);
  billsLoading = signal(false);
  services = signal<ServiceItem[]>([]);
  servicesLoading = signal(false);
  units = signal<UnitItem[]>([]);
  unitsLoading = signal(false);
  configs = signal<ReminderConfig[]>([]);
  messages = signal<MessageQueueItem[]>(initialMessageQueue);
  activities = signal<ActivityLog[]>(initialActivityLogs);
  selectedLocation = signal('');
  showARImportDialog = signal(false);
  selectedSinglePreviewItem = signal<MessageQueueItem | null>(null);

  // Derived
  overdueCount = computed(() => this.bills().filter(b => b.status === 'Overdue').length);
  pendingCount = computed(() => this.messages().filter(m => m.status === 'Pending').length);
  connectedCount = computed(() => this.telegramAccounts().filter(t => t.status === 'Connected').length);

  async init(): Promise<void> {
    // No proactive renew on startup. With a stored token we assume authenticated and
    // let requests run normally — if one returns 401 the interceptor renews and
    // retries, and only a failed renew (refresh token expired) raises the login
    // dialog. Without any token there's nothing to try, so prompt login straight away.
    if (TokenHelper.getToken()) {
      this.isAuthenticated.set(true);
      this.loadAll();
    } else {
      this.requireLogin();
    }
    this.isCheckingAuth.set(false);
  }

  /** Surface a persistent error dialog (set idempotently to avoid re-render churn). */
  notifyServerError(notice: AppNotice): void {
    const cur = this.serverError();
    if (cur?.title !== notice.title || cur?.message !== notice.message) {
      this.serverError.set(notice);
    }
  }

  dismissServerError(): void {
    this.serverError.set(null);
  }

  /** Show the global login dialog (e.g. on startup with no/expired session, or a 401). */
  requireLogin(): void {
    this.isAuthenticated.set(false);
    this.loginRequired.set(true);
  }

  /** Called by the login dialog on success: mark authenticated, hide the dialog, load data. */
  onLoggedIn(): void {
    this.isAuthenticated.set(true);
    this.loginRequired.set(false);
    this.loadAll();
  }

  async reloadBills(): Promise<void> {
    this.billsLoading.set(true);
    try {
      const b = await this.api.listBills();
      this.bills.set(b.map(billToItem));
    } finally {
      this.billsLoading.set(false);
    }
  }

  async loadAll(): Promise<void> {
    this.api.listProperties().then(props => {
      const locs = props.map(propertyToLocation);
      this.locations.set(locs);
      if (locs.length > 0 && !this.selectedLocation()) this.selectedLocation.set(locs[0].name);
    }).catch(() => { });
    this.api.listCustomers().then(c => this.residents.set(c.map(customerToResident))).catch(() => { });
    this.api.sessions().then(s => this.telegramSessions.set(s)).catch(() => { });
    this.servicesLoading.set(true);
    this.api.listServices().then(s => this.services.set(s.map(serviceToItem))).catch(() => { }).finally(() => this.servicesLoading.set(false));
    this.unitsLoading.set(true);
    this.api.listUnits().then(u => this.units.set(u)).catch(() => { }).finally(() => this.unitsLoading.set(false));
    this.billsLoading.set(true);
    this.api.listBills().then(b => this.bills.set(b.map(billToItem))).catch(() => { }).finally(() => this.billsLoading.set(false));
    this.api.listReminderConfigs().then(c => this.configs.set(c)).catch(() => { });
  }

  addActivity(action: string, details: string, type: 'info' | 'success' | 'warning' | 'error'): void {
    const newLog: ActivityLog = {
      id: 'act-' + Date.now().toString(36),
      action, details, type,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    this.activities.update(prev => [newLog, ...prev]);
  }

  logout(): void {
    // Drop the session server-side (best-effort); don't block the UI on the call.
    this.api.logout().catch(() => { });
    TokenHelper.clearToken();
    // Go to a neutral page and surface the login dialog (no /login route anymore).
    this.router.navigate(['/dashboard']);
    this.requireLogin();
  }

  async importChats(locName: string, selectedChats: ChatImportItem[]): Promise<void> {
    const loc = this.locations().find(l => l.name === locName);
    const locationId = loc ? parseInt(loc.id) : 0;
    selectedChats.forEach(c => {
      this.api.createCustomer({ code: c.code, name: c.name, unit: c.unit, phone: c.phone, telegramHandle: c.telegram, email: c.email, telegramSessionContactId: c.telegramSessionContactId, locationId }).catch(() => { });
    });
    const newResidents: Resident[] = selectedChats.map(c => ({
      code: c.code, name: c.name, unit: c.unit, telegram: c.telegram, balance: 0, status: 'Due' as const,
      locationName: locName, phone: c.phone, chatImported: true,
      joinDate: new Date().toISOString().substring(0, 10), email: c.email,
      telegramSessionContactId: c.telegramSessionContactId, profilePhoto: c.profilePhoto,
    }));
    this.residents.update(prev => [...newResidents, ...prev.filter(r => !selectedChats.some(c => c.code === r.code))]);
    this.locations.update(prev => prev.map(l => l.name === locName ? { ...l, residentsCount: l.residentsCount + selectedChats.length } : l));
    this.addActivity('Telegram Import handshakes', `Successfully matched (${selectedChats.length}) new community chats under ${locName}`, 'success');
  }

  triggerSingleReminder(res: Resident): void {
    const overdueBills = this.bills().filter(b => b.residentCode === res.code && b.status !== 'Paid');
    const firstBill = overdueBills[0];
    if (!firstBill) return;
    const matchingConfig = this.configs().find(c => c.name === 'Reminder 1') || this.configs()[0];
    const computedText = formatTemplate(matchingConfig.template, {
      residentName: res.name, unitNumber: res.unit, billAmount: firstBill.amount,
      dueDate: firstBill.dueDate, serviceName: firstBill.service, locationName: res.locationName,
    });
    const mockMsg: MessageQueueItem = {
      id: `msg-single-${res.code}-${Math.random().toString(36).substring(2, 5)}`,
      residentCode: res.code, residentName: res.name, unit: res.unit, telegram: res.telegram,
      service: firstBill.service, amount: firstBill.amount, dueDate: firstBill.dueDate,
      offsetType: 'Manual Trigger', text: computedText, status: 'Pending',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      locationName: res.locationName,
    };
    this.messages.update(prev => [mockMsg, ...prev]);
    this.selectedSinglePreviewItem.set(mockMsg);
    this.router.navigate(['/message-center']);
    this.addActivity('Manual Reminder Queued', `Created direct message draft for ${res.name} (${res.telegram})`, 'info');
  }

  triggerBatchReminders(targetBills: Bill[]): void {
    const newMsgs: MessageQueueItem[] = targetBills.map((b, idx) => {
      const cfg = this.configs().find(c => c.enabled) || this.configs()[0];
      const text = formatTemplate(cfg.template, {
        residentName: b.residentName, unitNumber: b.unit, billAmount: b.amount,
        dueDate: b.dueDate, serviceName: b.service, locationName: b.locationName,
      });
      return {
        id: `msg-batch-${b.id}-${idx}`,
        residentCode: b.residentCode, residentName: b.residentName, unit: b.unit,
        telegram: this.residents().find(r => r.code === b.residentCode)?.telegram || '@missing',
        service: b.service, amount: b.amount, dueDate: b.dueDate,
        offsetType: cfg.name + ' (' + cfg.offset + ')',
        text, status: 'Pending' as const,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        locationName: b.locationName,
      };
    });
    this.messages.update(prev => [...newMsgs, ...prev]);
    this.router.navigate(['/message-center']);
    this.addActivity('Reminders Batch Compiled', `Generated ${newMsgs.length} template handshakes.`, 'success');
  }
}
