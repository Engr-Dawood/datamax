import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DataRow, Column, DataType, FilterState, SortState } from '@/types';

// ── Type inference ──────────────────────────────────────────
export function inferType(values: unknown[]): DataType {
  let num = 0, date = 0, total = 0;
  for (const v of values) {
    if (v == null || v === '') continue;
    total++;
    const s = String(v).trim();
    if (!isNaN(Number(s.replace(/,/g, ''))) && s !== '') num++;
    else if (!isNaN(Date.parse(s)) && /\d{4}/.test(s)) date++;
  }
  if (total === 0) return 'text';
  if (num / total > 0.8) return 'number';
  if (date / total > 0.6) return 'date';
  return 'text';
}

export function parseValue(val: unknown, type: DataType): string | number | Date | null {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (type === 'number') {
    const n = Number(s.replace(/,/g, ''));
    return isNaN(n) ? null : n;
  }
  if (type === 'date') {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return s;
}

// ── File parsing ────────────────────────────────────────────
export interface ParseResult {
  rows: DataRow[];
  columns: Column[];
  fileName: string;
  fileSize: string;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const sizeKb = (file.size / 1024).toFixed(1);

  if (name.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, unknown>[];
          const headers = results.meta.fields || Object.keys(rows[0] || {});
          resolve(buildResult(rows as DataRow[], headers, file.name, sizeKb));
        },
        error: (err) => reject(new Error('CSV parse error: ' + err.message)),
      });
    });
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];
    if (json.length < 2) throw new Error('Sheet appears empty');
    const headers = json[0].map(String);
    const rows: DataRow[] = json.slice(1).map((row) => {
      const obj: DataRow = {};
      headers.forEach((h, i) => { obj[h] = row[i] != null ? String(row[i]) : null; });
      return obj;
    });
    return buildResult(rows, headers, file.name, sizeKb);
  }
  throw new Error('Only .csv, .xlsx, and .xls files are supported.');
}

function buildResult(rows: DataRow[], headers: string[], fileName: string, fileSize: string): ParseResult {
  const columns: Column[] = headers.map((h) => {
    const values = rows.map((r) => r[h]);
    const type = inferType(values);
    return { key: h, label: h, type, visible: true };
  });
  return { rows, columns, fileName, fileSize };
}

// ── Filtering ───────────────────────────────────────────────
export function getFilteredData(
  rawData: DataRow[],
  columns: Column[],
  filters: FilterState,
  sort: SortState,
  search: string
): DataRow[] {
  let data = rawData;

  // Global search
  if (search) {
    const q = search.toLowerCase();
    data = data.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }

  // Per-column filters
  for (const [colKey, filterVal] of Object.entries(filters)) {
    if (!filterVal || (filterVal instanceof Set && filterVal.size === 0)) continue;
    if (filterVal instanceof Set) {
      data = data.filter((row) => filterVal.has(String(row[colKey] ?? '')));
    } else if (typeof filterVal === 'string') {
      const q = filterVal.toLowerCase();
      data = data.filter((row) => String(row[colKey] ?? '').toLowerCase().includes(q));
    }
  }

  // Sort
  if (sort.col) {
    const col = sort.col;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const type = columns.find((c) => c.key === col)?.type || 'text';
    data = [...data].sort((a, b) => {
      const av = parseValue(a[col], type);
      const bv = parseValue(b[col], type);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  return data;
}

// ── Export ──────────────────────────────────────────────────
export function exportCSV(data: DataRow[], columns: Column[], fileName: string): void {
  if (!data.length) return;
  const headers = columns.filter(c => c.visible).map((c) => c.key);
  const rows = [headers];
  data.forEach((row) => {
    rows.push(headers.map((h) => {
      const v = row[h];
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }));
  });
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName.replace(/\.[^.]+$/, '') + '_filtered.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportExcel(data: DataRow[], columns: Column[], fileName: string): void {
  if (!data.length) return;
  const headers = columns.filter(c => c.visible).map((c) => c.key);
  const wsData = [headers, ...data.map(row => headers.map(h => row[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, fileName.replace(/\.[^.]+$/, '') + '_filtered.xlsx');
}

// ── Utilities ───────────────────────────────────────────────
export function fmtNum(n: number): string {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'k';
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toFixed(4);
}

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function getUniqueValues(data: DataRow[], colKey: string): string[] {
  return [...new Set(data.map((r) => String(r[colKey] ?? '')))].sort().slice(0, 200);
}

export function getNumericValues(data: DataRow[], colKey: string): number[] {
  return data
    .map((r) => {
      const v = r[colKey];
      if (v == null || v === '') return null;
      const n = Number(String(v).replace(/,/g, ''));
      return isNaN(n) ? null : n;
    })
    .filter((v): v is number => v != null);
}

export function getDateValues(data: DataRow[], colKey: string): Date[] {
  return data
    .map((r) => {
      const v = r[colKey];
      if (v == null || v === '') return null;
      const d = new Date(String(v));
      return isNaN(d.getTime()) ? null : d;
    })
    .filter((v): v is Date => v != null);
}
