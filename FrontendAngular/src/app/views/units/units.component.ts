import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { AppStateService } from '../../libs/services/app-state.service';
import { ApiService } from '../../libs/services/api.service';
import { UnitItem } from '../../libs/models/types';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import * as XLSX from 'xlsx';
import { SharedModules } from '../../libs/modules/shared-modules';

interface ImportRow { locationCode: string; unitCode: string; }

@Component({
  selector: 'app-units',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SharedModules,
    PopoverModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './units.component.html',
  styleUrl: './units.component.scss',
})
export class UnitsComponent {
  constructor(
    readonly state: AppStateService,
    private readonly api: ApiService,
    private readonly confirmation: ConfirmationService,
    private readonly toast: MessageService,
  ) { }
  searchQuery = '';
  locationFilter: number | null = null;

  // Add / edit
  showModal = signal(false);
  editing = signal<UnitItem | null>(null);
  saving = signal(false);
  form: { code: string; floor: string; building: string; note: string; locationId: number | null } =
    { code: '', floor: '', building: '', note: '', locationId: null };

  // Import (xlsx)
  importing = signal(false);
  showPreview = signal(false);
  importFileName = signal('');
  importRows = signal<ImportRow[]>([]);

  locationOptions = computed(() =>
    this.state.locations().map(l => ({ name: l.name, code: l.code ?? null, value: Number(l.id) }))
  );
  filterOptions = computed(() => [
    { name: 'All Locations', code: null, value: null },
    ...this.locationOptions(),
  ]);

  get filteredUnits(): UnitItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    const loc = this.locationFilter;
    return this.state.units().filter(u => {
      const matchLoc = loc == null || u.locationId === loc;
      const matchSearch = !q
        || u.code.toLowerCase().includes(q)
        || (u.floor ?? '').toLowerCase().includes(q)
        || (u.building ?? '').toLowerCase().includes(q)
        || (u.locationName ?? '').toLowerCase().includes(q);
      return matchLoc && matchSearch;
    });
  }

  openAddModal(): void {
    this.editing.set(null);
    this.form = { code: '', floor: '', building: '', note: '', locationId: this.locationFilter };
    this.showModal.set(true);
  }

  openEditModal(unit: UnitItem): void {
    this.editing.set(unit);
    this.form = {
      code: unit.code,
      floor: unit.floor ?? '',
      building: unit.building ?? '',
      note: unit.note ?? '',
      locationId: unit.locationId,
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editing.set(null);
  }

  saveUnit(): void {
    const code = this.form.code.trim();
    const locationId = this.form.locationId;
    if (!code || locationId == null) return;
    const data = { code, floor: this.form.floor, building: this.form.building, note: this.form.note, locationId };
    const editing = this.editing();
    const locationName = this.state.locations().find(l => Number(l.id) === locationId)?.name;
    this.saving.set(true);
    if (editing) {
      this.api.updateUnit(editing.id, data).then(() => {
        this.state.units.update(prev => prev.map(u => u.id === editing.id ? { ...u, ...data, locationName } : u));
        this.state.addActivity('Update Unit', `Unit "${code}" updated`, 'info');
        this.closeModal();
      }).catch((err: unknown) => console.error('Failed to update unit', err))
        .finally(() => this.saving.set(false));
    } else {
      this.api.createUnit(data).then(created => {
        this.state.units.update(prev => [...prev, created]);
        this.state.addActivity('Create Unit', `Unit "${created.code}" created`, 'success');
        this.closeModal();
      }).catch((err: unknown) => console.error('Failed to create unit', err))
        .finally(() => this.saving.set(false));
    }
  }

  deleteUnit(unit: UnitItem): void {
    this.confirmation.confirm({
      header: 'Delete Unit?',
      message: `This will permanently remove unit "${unit.code}". This cannot be undone.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete Unit',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => this.performDelete(unit),
    });
  }

  private performDelete(unit: UnitItem): void {
    this.api.removeUnit(unit.id).then(() => {
      this.state.units.update(prev => prev.filter(u => u.id !== unit.id));
      this.state.addActivity('Delete Unit', `Unit "${unit.code}" removed`, 'info');
    }).catch((err: unknown) => console.error('Failed to delete unit', err));
  }

  // ---- Import (xlsx) ----

  /// Generate and download the .xlsx import template (Location Code, Unit Code).
  downloadTemplate(): void {
    const sample: (string)[][] = [
      ['Location Code', 'Unit Code'],
      ['UK313', 'D-201'],
      ['UK313', 'D-202'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Units');
    XLSX.writeFile(wb, 'unit-import-template.xlsx');
  }

  /// Read the selected .xlsx, map rows to {locationCode, unitCode}, open preview.
  async onFileSelected(event: Event, input: HTMLInputElement): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      const rows: ImportRow[] = json.map(r => {
        let locationCode = '', unitCode = '';
        for (const [k, v] of Object.entries(r)) {
          const key = String(k).toLowerCase();
          const val = v == null ? '' : String(v).trim();
          if (key.includes('location')) locationCode = val;
          else if (key.includes('unit')) unitCode = val;
        }
        return { locationCode, unitCode };
      }).filter(r => r.locationCode || r.unitCode);

      input.value = ''; // allow re-selecting the same file

      if (rows.length === 0) {
        this.toast.add({ severity: 'warn', summary: 'Empty file', detail: 'No rows found. Use the template and try again.' });
        return;
      }

      this.importFileName.set(file.name);
      this.importRows.set(rows);
      this.showPreview.set(true);
    } catch (err) {
      console.error('Failed to read spreadsheet', err);
      input.value = '';
      this.toast.add({ severity: 'error', summary: 'Read failed', detail: 'Could not read the spreadsheet. Make sure it is a valid .xlsx file.' });
    }
  }

  closePreview(): void {
    this.showPreview.set(false);
  }

  confirmImport(): void {
    const rows = this.importRows();
    if (rows.length === 0) return;
    this.importing.set(true);
    this.api.importUnits(rows).then(res => {
      this.state.addActivity('Import Units', `Imported ${res.imported} unit(s), skipped ${res.skipped}`, 'success');
      this.toast.add({
        severity: res.imported > 0 ? 'success' : 'warn',
        summary: 'Import complete',
        detail: `Imported ${res.imported} unit(s)` + (res.skipped > 0 ? `, skipped ${res.skipped}` : '') + '.',
      });
      if (res.errors?.length) {
        this.toast.add({ severity: 'warn', summary: `${res.errors.length} row(s) skipped`, detail: res.errors.slice(0, 5).join(' '), life: 8000 });
      }
      return this.api.listUnits().then(u => this.state.units.set(u));
    }).then(() => this.closePreview())
      .catch((err: unknown) => {
        console.error('Failed to import units', err);
        this.toast.add({ severity: 'error', summary: 'Import failed', detail: 'Something went wrong. Please try again.' });
      })
      .finally(() => this.importing.set(false));
  }
}
