import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AppStateService } from '../../../../libs/services/app-state.service';
import { ApiService } from '../../../../libs/services/api.service';
import { SharedModules } from '../../../../libs/modules/shared-modules';
import { PopoverModule } from 'primeng/popover';
import { StatChipComponent } from '../../../../shared/stat-chip/stat-chip.component';
import { XlsxHelper } from '../../../../libs/helpers/xlsx-helper';

interface ArImportRow {
  rowIndex: number;
  locationCode: string;
  residentCode: string;
  residentPhone: string;
  residentName: string;
  residentResolvedName: string | null;
  residentTelegram: string | null;
  residentStatus: 'matched' | 'not-found';
  residentMatchedBy: 'code' | 'phone' | null;
  unitCode: string;
  service: string;
  amount: number;
  dueDate: string;
  autoSend: boolean;
  locationName: string | null;
  unitStatus: 'matched' | 'new' | 'unset';
  locationError: boolean;
}

@Component({
  selector: 'app-ar-import',
  standalone: true,
  imports: [SharedModules, PopoverModule, StatChipComponent],
  templateUrl: './ar-import.component.html',
  styleUrl: './ar-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArImportComponent {
  constructor(
    private readonly state: AppStateService,
    private readonly api: ApiService,
  ) {}

  showDialog     = signal(false);
  importStep     = signal<'validated' | 'finished'>('validated');
  importFileName = signal('');
  importedRows   = signal<ArImportRow[]>([]);
  confirmLoading = signal(false);
  confirmError   = signal<string | null>(null);

  validCount         = computed(() => this.importedRows().filter(r => !r.locationError && r.residentStatus === 'matched').length);
  errorCount         = computed(() => this.importedRows().filter(r => r.locationError).length);
  residentErrorCount = computed(() => this.importedRows().filter(r => !r.locationError && r.residentStatus === 'not-found').length);
  unitMatchedCount   = computed(() => this.importedRows().filter(r => r.unitStatus === 'matched').length);
  unitNewCount       = computed(() => this.importedRows().filter(r => r.unitStatus === 'new').length);
  unitUnsetCount     = computed(() => this.importedRows().filter(r => r.unitStatus === 'unset').length);

  downloadTemplate(): void {
    XlsxHelper.downloadSheet(
      [
        ['Location Code', 'Resident Code', 'Resident Phone', 'Resident Name', 'Unit Code', 'Service', 'Amount (GBP)', 'Due Date (YYYY-MM-DD)', 'Auto Send'],
        ['UK313', 'RES-D101', '', 'Mr Samnang', 'A101', 'Electricity', 35.50, '2026-07-10', true],
        ['UK313', '', '+855 12 345 678', 'Ms Vattey', 'A102', 'Water', 15.00, '2026-07-10', true],
      ],
      'ar-import-template.xlsx',
      {
        sheetName: 'Bills',
        colWidths: [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 12 }],
      },
    );
  }

  async onFileSelected(event: Event, input: HTMLInputElement): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const json = await XlsxHelper.readFile(file);

      const residents = this.state.residents();
      const rows: ArImportRow[] = json.map((row: Record<string, unknown>, i: number) => {
        const locationCode = String(row['Location Code'] ?? '').trim();
        const residentCode = String(row['Resident Code'] ?? '').trim();
        const residentPhone = String(row['Resident Phone'] ?? '').trim();
        const residentName  = String(row['Resident Name'] ?? '').trim();
        const unitCode      = String(row['Unit Code'] ?? '').trim();
        const service       = String(row['Service'] ?? '').trim();
        const amount        = Number(row['Amount (GBP)'] ?? 0);
        const dueDate       = String(row['Due Date (YYYY-MM-DD)'] ?? '').trim();
        const autoSend      = String(row['Auto Send'] ?? '').toLowerCase() === 'true';

        const location = this.state.locations().find(
          l => (l.code && l.code === locationCode) || l.name === locationCode
        );
        const locationName = location?.name ?? null;

        let residentStatus: 'matched' | 'not-found' = 'not-found';
        let residentMatchedBy: 'code' | 'phone' | null = null;
        let residentTelegram: string | null = null;
        let residentResolvedName: string | null = null;

        if (residentCode) {
          const found = residents.find(r => r.code.toLowerCase() === residentCode.toLowerCase());
          if (found) {
            residentStatus = 'matched';
            residentMatchedBy = 'code';
            residentTelegram = found.telegram || null;
            residentResolvedName = found.name;
          }
        }
        if (residentStatus === 'not-found' && residentPhone) {
          const found = residents.find(r => r.phone && r.phone === residentPhone);
          if (found) {
            residentStatus = 'matched';
            residentMatchedBy = 'phone';
            residentTelegram = found.telegram || null;
            residentResolvedName = found.name;
          }
        }

        let unitStatus: 'matched' | 'new' | 'unset';
        if (!unitCode) {
          unitStatus = 'unset';
        } else {
          const exists = locationName
            ? this.state.units().find(u => u.code === unitCode && u.locationName === locationName)
            : this.state.units().find(u => u.code === unitCode);
          unitStatus = exists ? 'matched' : 'new';
        }

        return {
          rowIndex: i + 1, locationCode, residentCode, residentPhone, residentName,
          residentResolvedName, residentTelegram, residentStatus, residentMatchedBy,
          unitCode, service, amount, dueDate, autoSend, locationName, unitStatus,
          locationError: !location,
        };
      });

      this.importedRows.set(rows);
      this.importFileName.set(file.name);
      this.importStep.set('validated');
      this.showDialog.set(true);
    } catch {
      // TODO: show error toast
    }
  }

  async confirm(): Promise<void> {
    const validRows = this.importedRows().filter(r => !r.locationError && r.residentStatus === 'matched');
    if (!validRows.length) return;
    this.confirmLoading.set(true);
    this.confirmError.set(null);
    try {
      const result = await this.api.importBills(validRows.map(r => ({
        locationCode: r.locationCode,
        residentCode: r.residentCode,
        residentPhone: r.residentPhone,
        unitCode: r.unitCode,
        unitStatus: r.unitStatus,
        service: r.service,
        amount: r.amount,
        dueDate: r.dueDate,
        autoSend: r.autoSend,
      })));

      if (result.newUnits.length > 0) {
        this.state.units.update(prev => [...prev, ...result.newUnits]);
      }

      await this.state.reloadBills();

      this.importStep.set('finished');
      this.state.addActivity(
        'AR Records Imported',
        `Imported ${result.imported} billing entries from ${this.importFileName()}.`,
        'success'
      );
    } catch (err) {
      this.confirmError.set(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      this.confirmLoading.set(false);
    }
  }
}
