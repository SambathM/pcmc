import { Component, signal, computed } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { ApiService } from '../../libs/services/api.service';
import { Bill, Resident } from '../../libs/models/types';
import { SharedModules } from '../../libs/modules/shared-modules';
import { ArImportComponent } from './sub-views/ar-import/ar-import.component';
import { ArStatusLogsComponent } from './sub-views/ar-status-logs/ar-status-logs.component';

@Component({
  selector: 'app-ar',
  imports: [
    SharedModules,
    ArImportComponent,
    ArStatusLogsComponent,
  ],
  templateUrl: './ar.component.html',
  styleUrl: './ar.component.scss',
})
export class ArComponent {
  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService
  ) { }


  searchTerm = signal('');
  serviceFilter = signal('All');
  statusFilter = signal('All');
  locationFilter = signal('All');
  selectedBillIds = signal<string[]>([]);
  batchError = signal<string | null>(null);
  // Add bill form — a bill is tied to a Unit; the location comes via the unit.
  formUnitId = signal<number | null>(null);
  formResidentName = signal('');
  formResidentCode = signal('');
  formService = signal('');
  formAmount = signal<number | null>(null);
  formDueDate = signal<Date | null>(null);
  formAutoSend = signal(false);
  addBillSaving = signal(false);
  addBillError = signal<string | null>(null);

  // Inline edit — operates on an existing bill row (not the add row).
  editingBillId = signal<string | null>(null);
  editUnitId = signal<number | null>(null);
  editResidentName = signal('');
  editResidentCode = signal('');
  editService = signal('');
  editAmount = signal<number | null>(null);
  editDueDate = signal<Date | null>(null);
  editAutoSend = signal(false);
  editSaving = signal(false);
  editError = signal<string | null>(null);

  logBill = signal<Bill | null>(null);

  locationOptions = computed(() => [
    { label: 'All Locations', value: 'All' },
    ...this.state.locations().map(l => ({ label: l.name, value: l.name })),
  ]);

  serviceOptions = computed(() => [
    { label: 'All Services', value: 'All' },
    ...this.state.services().map(s => ({ label: s.name, value: s.name })),
  ]);

  statusOptions = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Preparing', value: 'Preparing' },
    { label: 'Due', value: 'Due' },
    { label: 'Overdue', value: 'Overdue' },
    { label: 'Paid', value: 'Paid' },
  ];


  getStatusSeverity(arg0: any): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | null | undefined {
    return arg0 === 'Paid' ? 'success' : arg0 === 'Due' ? 'warn' : arg0 === 'Overdue' ? 'danger' : arg0 === 'Preparing' ? 'secondary' : null;
  }

  billServiceOptions = computed(() => [
    { label: 'None', value: '' },
    ...this.state.services().map(s => ({ label: s.name, value: s.name })),
  ]);

  // All units, labelled "Location · Code" — the unit carries the location.
  billUnitOptions = computed(() =>
    this.state.units().map(u => ({
      label: `${u.locationName ?? ''} · ${u.code}`,
      value: u.id,
      locationName: u.locationName ?? '',
    }))
  );

  // The unit selected in the add-bill row (drives resident scope + location).
  selectedUnit = computed(() => this.state.units().find(u => u.id === this.formUnitId()) ?? null);

  // Residents of the selected unit's location (a customer may belong to many).
  billResidentOptions = computed(() => {
    const locId = this.selectedUnit()?.locationId;
    if (locId == null) return [];
    return this.state.residents()
      .filter(r => r.locationIds?.includes(locId))
      .map(r => ({ label: `${r.name} (${r.code})`, value: r.code }));
  });

  // Edit row: the unit currently picked in the inline editor + its residents.
  editSelectedUnit = computed(() => this.state.units().find(u => u.id === this.editUnitId()) ?? null);

  editResidentOptions = computed(() => {
    const locId = this.editSelectedUnit()?.locationId;
    if (locId == null) return [];
    return this.state.residents()
      .filter(r => r.locationIds?.includes(locId))
      .map(r => ({ label: `${r.name} (${r.code})`, value: r.code }));
  });

  processedBills = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const svc = this.serviceFilter();
    const status = this.statusFilter();
    const loc = this.locationFilter();
    return this.state.bills().filter(b => {
      const matchLoc = loc === 'All' || b.locationName === loc;
      const matchSearch = !search || b.residentName.toLowerCase().includes(search) || b.unit.toLowerCase().includes(search) || b.id.toLowerCase().includes(search);
      const matchSvc = svc === 'All' || b.service === svc;
      const matchStatus = status === 'All' || b.status === status;
      return matchLoc && matchSearch && matchSvc && matchStatus;
    });
  });

  allSelected = computed(() => this.processedBills().length > 0 && this.selectedBillIds().length === this.processedBills().length);
  someSelected = computed(() => !this.allSelected() && this.selectedBillIds().length > 0);

  onResidentPick(code: string | null): void {
    this.formResidentCode.set(code ?? '');
    const r = this.state.residents().find(x => x.code === code);
    this.formResidentName.set(r?.name ?? '');
  }

  resetForm(): void {
    this.formUnitId.set(null); this.formResidentName.set('');
    this.formResidentCode.set(''); this.formService.set(''); this.formAmount.set(null);
    this.formDueDate.set(null); this.formAutoSend.set(false);
    this.addBillError.set(null);
  }

  onEditResidentPick(code: string | null): void {
    this.editResidentCode.set(code ?? '');
    const r = this.state.residents().find(x => x.code === code);
    this.editResidentName.set(r?.name ?? '');
  }

  startEdit(b: Bill): void {
    // Resolve the unit by code within the bill's location (codes repeat across locations).
    const unit = this.state.units().find(u => u.code === b.unit && (u.locationName ?? '') === b.locationName)
      ?? this.state.units().find(u => u.code === b.unit);
    this.editingBillId.set(b.id);
    this.editUnitId.set(unit?.id ?? null);
    this.editResidentCode.set(b.residentCode);
    this.editResidentName.set(b.residentName);
    this.editService.set(b.service);
    this.editAmount.set(b.amount);
    this.editDueDate.set(b.dueDate ? new Date(b.dueDate) : null);
    this.editAutoSend.set(b.autoSend);
    this.editError.set(null);
  }

  cancelEdit(): void {
    this.editingBillId.set(null);
    this.editError.set(null);
  }

  async saveEdit(): Promise<void> {
    const id = this.editingBillId();
    if (id == null) return;
    const name = this.editResidentName().trim();
    const code = this.editResidentCode().trim();
    if (!name || !code) { this.editError.set('Resident is required.'); return; }
    const amount = this.editAmount();
    if (!amount || amount <= 0) { this.editError.set('Enter a valid amount.'); return; }
    const dueDate = this.editDueDate();
    if (!dueDate) { this.editError.set('Due date is required.'); return; }
    const unit = this.editSelectedUnit();
    if (!unit) { this.editError.set('Select a unit.'); return; }

    const dueDateStr = dueDate.toISOString().slice(0, 10);
    const service = this.editService();
    const autoSend = this.editAutoSend();
    this.editSaving.set(true);
    this.editError.set(null);
    try {
      await this.api.updateBill(Number(id), {
        unitId: unit.id, residentCode: code, residentName: name,
        service, amount, dueDate: dueDateStr, autoSend,
      });
      this.state.bills.update(prev => prev.map(b => b.id === id ? {
        ...b, unit: unit.code, locationName: unit.locationName ?? '',
        residentCode: code, residentName: name, service, amount,
        dueDate: dueDateStr, autoSend,
      } : b));
      this.state.addActivity('Bill Updated', `Edited bill #${id} for ${name}`, 'info');
      this.editingBillId.set(null);
    } catch (err) {
      this.editError.set(err instanceof Error ? err.message : 'Failed to update bill.');
    } finally {
      this.editSaving.set(false);
    }
  }

  async handleAddBill(): Promise<void> {
    const name = this.formResidentName().trim();
    const code = this.formResidentCode().trim();
    if (!name || !code) { this.addBillError.set('Resident name and code are required.'); return; }
    const amount = this.formAmount();
    if (!amount || amount <= 0) { this.addBillError.set('Enter a valid amount.'); return; }
    const dueDate = this.formDueDate();
    if (!dueDate) { this.addBillError.set('Due date is required.'); return; }
    const unit = this.selectedUnit();
    if (!unit) { this.addBillError.set('Select a unit.'); return; }

    const dueDateStr = dueDate.toISOString().slice(0, 10);
    this.addBillSaving.set(true);
    this.addBillError.set(null);
    try {
      const newId = await this.api.createBill({
        residentCode: code, residentName: name,
        service: this.formService(), amount, dueDate: dueDateStr,
        autoSend: this.formAutoSend(),
        unitId: unit.id,
      });
      const newBill: Bill = {
        id: String(newId), residentCode: code, residentName: name,
        unit: unit.code, service: this.formService(), amount,
        dueDate: dueDateStr, status: 'Preparing', autoSend: this.formAutoSend(),
        locationName: unit.locationName ?? '',
      };
      this.state.bills.update(prev => [newBill, ...prev]);
      this.state.addActivity('Bill Created', `Added bill for ${name} — ${this.formService()} $${amount.toFixed(2)}`, 'success');
      this.resetForm();
    } catch (err) {
      this.addBillError.set(err instanceof Error ? err.message : 'Failed to create bill.');
    } finally {
      this.addBillSaving.set(false);
    }
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedBillIds.set([]);
    } else {
      this.selectedBillIds.set(this.processedBills().map(b => b.id));
    }
  }

  toggleRow(id: string): void {
    this.selectedBillIds.update(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  handleBulkReminders(): void {
    const targets = this.state.bills().filter(b => this.selectedBillIds().includes(b.id) && b.status !== 'Paid');
    if (targets.length === 0) {
      this.batchError.set('Select at least one due or overdue bill.');
      setTimeout(() => this.batchError.set(null), 3500);
      return;
    }
    this.state.triggerBatchReminders(targets);
    this.selectedBillIds.set([]);
  }

  getResident(code: string): Resident | undefined {
    return this.state.residents().find(r => r.code === code);
  }
}
