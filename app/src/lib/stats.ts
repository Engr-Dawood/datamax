import type { DataRow, ColumnStats, CorrelationResult, OutlierResult, DuplicateResult, Column } from '@/types';
import { parseValue, getNumericValues } from './dataEngine';

// ── Summary Statistics ──────────────────────────────────────
export function computeColumnStats(data: DataRow[], col: { key: string; type: import('@/types').DataType }): ColumnStats {
  const allVals = data.map((r) => r[col.key]);
  const parsed = allVals.map((v) => parseValue(v, col.type)).filter((v) => v != null);
  const missing = allVals.filter((v) => v == null || String(v).trim() === '').length;
  const unique = new Set(allVals.map(String)).size;

  const stats: ColumnStats = {
    column: col.key,
    type: col.type,
    count: parsed.length,
    missing,
    unique,
  };

  if (col.type === 'number' && parsed.length > 0) {
    const nums = (parsed as number[]).map(Number);
    const sorted = [...nums].sort((a, b) => a - b);
    const n = nums.length;
    const mean = nums.reduce((a, b) => a + b, 0) / n;
    const mid = Math.floor(n / 2);
    const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const variance = nums.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const std = Math.sqrt(variance);
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];

    // Skewness
    const skewness = n > 2
      ? (nums.reduce((sum, v) => sum + Math.pow((v - mean) / std, 3), 0) * n) / ((n - 1) * (n - 2))
      : 0;

    // Kurtosis
    const kurtosis = n > 3
      ? ((nums.reduce((sum, v) => sum + Math.pow((v - mean) / std, 4), 0) * n * (n + 1)) /
        ((n - 1) * (n - 2) * (n - 3))) -
        (3 * Math.pow(n - 1, 2) / ((n - 2) * (n - 3)))
      : 0;

    stats.min = sorted[0];
    stats.max = sorted[n - 1];
    stats.mean = mean;
    stats.median = median;
    stats.std = std;
    stats.q1 = q1;
    stats.q3 = q3;
    stats.skewness = skewness;
    stats.kurtosis = kurtosis;

    // Distribution histogram (20 bins)
    const binCount = Math.min(20, Math.ceil(Math.sqrt(n)));
    const min = stats.min;
    const max = stats.max;
    const binWidth = (max - min) / binCount || 1;
    const counts = new Array(binCount).fill(0);
    const edges = new Array(binCount + 1).fill(0).map((_, i) => min + i * binWidth);
    nums.forEach((v) => {
      const idx = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
      counts[idx]++;
    });
    stats.distribution = counts;
    stats.binEdges = edges;
  } else if (col.type === 'date' && parsed.length > 0) {
    const dates = (parsed as Date[]).sort((a, b) => a.getTime() - b.getTime());
    stats.range = [dates[0], dates[dates.length - 1]];
  } else {
    // Top values for text
    const freq: Record<string, number> = {};
    allVals.forEach((v) => { freq[String(v)] = (freq[String(v)] || 0) + 1; });
    stats.topValues = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));
  }

  return stats;
}

// ── Correlation ─────────────────────────────────────────────
export function computeCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n !== y.length || n < 2) return NaN;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

export function computeAllCorrelations(data: DataRow[], numericCols: string[]): CorrelationResult[] {
  const results: CorrelationResult[] = [];
  const values: Record<string, number[]> = {};

  numericCols.forEach((col) => {
    values[col] = getNumericValues(data, col);
  });

  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const col1 = numericCols[i];
      const col2 = numericCols[j];
      // Find rows where both columns have values
      const paired: [number, number][] = [];
      const v1 = values[col1];
      const v2 = values[col2];
      const minLen = Math.min(v1.length, v2.length);
      // We need to pair by row index
      for (let k = 0; k < minLen; k++) {
        if (v1[k] != null && v2[k] != null) {
          paired.push([v1[k], v2[k]]);
        }
      }
      if (paired.length >= 2) {
        const x = paired.map((p) => p[0]);
        const y = paired.map((p) => p[1]);
        const corr = computeCorrelation(x, y);
        results.push({ col1, col2, correlation: corr, n: paired.length });
      }
    }
  }

  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

export function getCorrelationMatrix(data: DataRow[], numericCols: string[]): number[][] {
  const n = numericCols.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const values: Record<string, number[]> = {};

  numericCols.forEach((col) => {
    values[col] = getNumericValues(data, col);
  });

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const paired: [number, number][] = [];
      const v1 = values[numericCols[i]];
      const v2 = values[numericCols[j]];
      const minLen = Math.min(v1.length, v2.length);
      for (let k = 0; k < minLen; k++) {
        if (v1[k] != null && v2[k] != null) {
          paired.push([v1[k], v2[k]]);
        }
      }
      if (paired.length >= 2) {
        const corr = computeCorrelation(
          paired.map((p) => p[0]),
          paired.map((p) => p[1])
        );
        matrix[i][j] = corr;
        matrix[j][i] = corr;
      }
    }
  }

  return matrix;
}

// ── Outlier Detection (IQR method) ────────────────────────
export function detectOutliers(data: DataRow[], colKey: string): OutlierResult[] {
  const nums = getNumericValues(data, colKey);
  if (nums.length < 4) return [];
  const sorted = [...nums].sort((a, b) => a - b);
  const q1Pos = (sorted.length - 1) * 0.25;
  const q3Pos = (sorted.length - 1) * 0.75;
  const q1 = sorted[Math.floor(q1Pos)] + (sorted[Math.ceil(q1Pos)] - sorted[Math.floor(q1Pos)]) * (q1Pos % 1);
  const q3 = sorted[Math.floor(q3Pos)] + (sorted[Math.ceil(q3Pos)] - sorted[Math.floor(q3Pos)]) * (q3Pos % 1);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const outliers: OutlierResult[] = [];
  data.forEach((row, idx) => {
    const v = row[colKey];
    if (v == null || v === '') return;
    const n = Number(String(v).replace(/,/g, ''));
    if (isNaN(n)) return;
    if (n < lower || n > upper) {
      outliers.push({ rowIndex: idx, column: colKey, value: n, lowerBound: lower, upperBound: upper, iqr });
    }
  });

  return outliers;
}

// ── Duplicate Detection ─────────────────────────────────────
export function detectDuplicates(data: DataRow[], columns: Column[]): DuplicateResult[] {
  const colKeys = columns.map((c) => c.key);
  const hashMap: Record<string, number[]> = {};

  data.forEach((row, idx) => {
    const hash = colKeys.map((k) => String(row[k] ?? '')).join('|');
    if (!hashMap[hash]) hashMap[hash] = [];
    hashMap[hash].push(idx);
  });

  return Object.entries(hashMap)
    .filter(([, indices]) => indices.length > 1)
    .map(([hash, indices]) => ({ hash, indices, count: indices.length }))
    .sort((a, b) => b.count - a.count);
}

// ── Frequency Distribution ──────────────────────────────────
export function getFrequencyDistribution(data: DataRow[], colKey: string, binCount = 10): { label: string; count: number; pct: number }[] {
  const nums = getNumericValues(data, colKey);
  if (nums.length === 0) return [];

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const binWidth = (max - min) / binCount || 1;
  const bins = new Array(binCount).fill(0).map((_, i) => ({
    label: `${(min + i * binWidth).toFixed(2)} - ${(min + (i + 1) * binWidth).toFixed(2)}`,
    count: 0,
    pct: 0,
  }));

  nums.forEach((n) => {
    const idx = Math.min(binCount - 1, Math.floor((n - min) / binWidth));
    bins[idx].count++;
  });

  const total = nums.length;
  bins.forEach((b) => { b.pct = (b.count / total) * 100; });

  return bins;
}

// ── Linear Regression ───────────────────────────────────────
export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }
  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const r2 = Math.pow(ssXY, 2) / (ssXX * ssYY);
  return { slope, intercept, r2: isNaN(r2) ? 0 : r2 };
}

// ── Descriptive Stats for All Numeric Columns ───────────────
export interface DescriptiveStats {
  column: string;
  count: number;
  missing: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  cv: number; // coefficient of variation
}

export function getAllDescriptiveStats(data: DataRow[], numericCols: string[]): DescriptiveStats[] {
  return numericCols.map((col) => {
    const allVals = data.map((r) => r[col]);
    const nums = getNumericValues(data, col);
    const missing = allVals.length - nums.length;
    const sorted = [...nums].sort((a, b) => a - b);
    const n = nums.length;
    const mean = n > 0 ? nums.reduce((a, b) => a + b, 0) / n : 0;
    const mid = Math.floor(n / 2);
    const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const variance = n > 0 ? nums.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n : 0;
    const std = Math.sqrt(variance);
    const q1 = sorted[Math.floor(n * 0.25)] || 0;
    const q3 = sorted[Math.floor(n * 0.75)] || 0;

    return {
      column: col,
      count: n,
      missing,
      mean,
      median,
      std,
      min: sorted[0] || 0,
      max: sorted[n - 1] || 0,
      range: (sorted[n - 1] || 0) - (sorted[0] || 0),
      q1,
      q3,
      iqr: q3 - q1,
      cv: mean !== 0 ? (std / Math.abs(mean)) * 100 : 0,
    };
  });
}

// ── Pivot Table ─────────────────────────────────────────────
export interface PivotResult {
  rows: string[];
  cols: string[];
  data: (number | null)[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
}

export function buildPivot(
  data: DataRow[],
  rowField: string,
  colField: string,
  valueField: string,
  aggFunc: 'sum' | 'mean' | 'count' | 'min' | 'max' | 'median'
): PivotResult {
  const rowValues = [...new Set(data.map((r) => String(r[rowField] ?? '(blank)')))].sort();
  const colValues = [...new Set(data.map((r) => String(r[colField] ?? '(blank)')))].sort();

  const cellData: Record<string, number[]> = {};

  data.forEach((row) => {
    const rv = String(row[rowField] ?? '(blank)');
    const cv = String(row[colField] ?? '(blank)');
    const v = row[valueField];
    const key = `${rv}|${cv}`;
    if (!cellData[key]) cellData[key] = [];
    if (v != null && v !== '') {
      const n = Number(String(v).replace(/,/g, ''));
      if (!isNaN(n)) cellData[key].push(n);
    }
  });

  const result: PivotResult = {
    rows: rowValues,
    cols: colValues,
    data: [],
    rowTotals: [],
    colTotals: new Array(colValues.length).fill(0),
    grandTotal: 0,
  };

  rowValues.forEach((rv) => {
    const row: (number | null)[] = [];
    let rowTotal = 0;
    colValues.forEach((cv, ci) => {
      const vals = cellData[`${rv}|${cv}`] || [];
      let val: number | null = null;
      if (vals.length > 0) {
        switch (aggFunc) {
          case 'sum': val = vals.reduce((a, b) => a + b, 0); break;
          case 'mean': val = vals.reduce((a, b) => a + b, 0) / vals.length; break;
          case 'count': val = vals.length; break;
          case 'min': val = Math.min(...vals); break;
          case 'max': val = Math.max(...vals); break;
          case 'median': {
            const s = [...vals].sort((a, b) => a - b);
            const m = Math.floor(s.length / 2);
            val = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
            break;
          }
        }
        if (val != null) {
          rowTotal += val;
          result.colTotals[ci] += val;
          result.grandTotal += val;
        }
      }
      row.push(val);
    });
    result.data.push(row);
    result.rowTotals.push(rowTotal);
  });

  return result;
}
