import { EXPORT_COLUMN_KEYS, EXPORT_HEADERS, fetchOrderExportRows, resolveExportLang } from './ordersExport';
import type { ExportFilters } from './ordersExport';

const UTF8_BOM = '﻿';

// Excel en configuraciones regionales en espanol usa "," como separador decimal,
// por lo que espera ";" como separador de columnas en CSV (si no, abre el archivo
// con todo el contenido pegado en una sola celda). En ingles el separador estandar
// sigue siendo ",".
const CSV_DELIMITER: Record<'es' | 'en', string> = { es: ';', en: ',' };

function escapeCsv(value: unknown, delimiter: string): string {
  const str = value == null ? '' : String(value);
  if (str.includes('"') || str.includes(delimiter) || /[\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function buildOrdersCsv(filters: ExportFilters = {}): Promise<string> {
  const rows = await fetchOrderExportRows(filters);

  const lang = resolveExportLang(filters.lang);
  const delimiter = CSV_DELIMITER[lang];
  const header = EXPORT_HEADERS[lang].join(delimiter);

  const lines = rows.map((row) =>
    EXPORT_COLUMN_KEYS.map((key) => escapeCsv(row[key], delimiter)).join(delimiter),
  );

  return UTF8_BOM + [header, ...lines].join('\n');
}
