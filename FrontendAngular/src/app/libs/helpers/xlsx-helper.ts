import * as XLSX from 'xlsx';

class InternalXlsxHelper {
  /** Parse the first sheet of an xlsx/xls file into raw JSON rows. */
  async readFile(file: File): Promise<Record<string, unknown>[]> {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }

  /** Write a 2-D array of rows to an xlsx file and trigger a browser download. */
  downloadSheet(
    rows: (string | number | boolean)[][],
    filename: string,
    options?: { sheetName?: string; colWidths?: { wch: number }[] },
  ): void {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (options?.colWidths) ws['!cols'] = options.colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, options?.sheetName ?? 'Sheet1');
    XLSX.writeFile(wb, filename);
  }
}

export const XlsxHelper = new InternalXlsxHelper();
