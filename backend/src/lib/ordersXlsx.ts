import ExcelJS from 'exceljs';
import { EXPORT_COLUMN_KEYS, EXPORT_HEADERS, fetchOrderExportRows, resolveExportLang } from './ordersExport';
import type { ExportFilters } from './ordersExport';

export async function buildOrdersXlsx(filters: ExportFilters = {}): Promise<Buffer> {
  const rows = await fetchOrderExportRows(filters);
  const lang = resolveExportLang(filters.lang);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Orders');

  sheet.columns = EXPORT_COLUMN_KEYS.map((key, i) => ({
    header: EXPORT_HEADERS[lang][i],
    key,
    width: key === 'itemsSummary' ? 50 : key === 'customerEmail' ? 28 : 18,
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) sheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
