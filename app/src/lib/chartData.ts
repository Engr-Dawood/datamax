import type { DataRow } from '@/types';
import { getNumericValues } from './dataEngine';

// ── Chart Color Palette ─────────────────────────────────────
export const CHART_COLORS = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  '#6366f1', '#14b8a6', '#eab308', '#f43f5e', '#a855f7',
];

export function getColor(index: number, alpha = 1): string {
  const hex = CHART_COLORS[index % CHART_COLORS.length];
  if (alpha === 1) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Data Preparation for Charts ────────────────────────────
export interface BarChartData {
  labels: string[];
  datasets: { label: string; data: number[]; backgroundColor: string }[];
}

export function prepareBarChart(
  data: DataRow[],
  xCol: string,
  yCol: string,
  limit = 50
): BarChartData {
  // Aggregate by xCol, sum yCol
  const agg: Record<string, number> = {};
  data.forEach((row) => {
    const x = String(row[xCol] ?? '(blank)');
    const y = Number(String(row[yCol] ?? '0').replace(/,/g, ''));
    if (!isNaN(y)) {
      agg[x] = (agg[x] || 0) + y;
    }
  });

  const sorted = Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return {
    labels: sorted.map(([k]) => k),
    datasets: [{
      label: yCol,
      data: sorted.map(([, v]) => v),
      backgroundColor: CHART_COLORS[0],
    }],
  };
}

export function prepareLineChart(
  data: DataRow[],
  xCol: string,
  yCol: string
): BarChartData {
  const sorted = [...data].sort((a, b) => {
    const av = a[xCol], bv = b[xCol];
    if (av == null || bv == null) return 0;
    return String(av).localeCompare(String(bv));
  });

  return {
    labels: sorted.map((row) => String(row[xCol] ?? '')),
    datasets: [{
      label: yCol,
      data: sorted.map((row) => Number(String(row[yCol] ?? '0').replace(/,/g, '')) || 0),
      backgroundColor: CHART_COLORS[0],
    }],
  };
}

export function prepareScatterData(
  data: DataRow[],
  xCol: string,
  yCol: string,
  colorCol?: string
): { datasets: { label: string; data: { x: number; y: number }[]; backgroundColor: string }[] } {
  if (colorCol) {
    const groups: Record<string, { x: number; y: number }[]> = {};
    data.forEach((row) => {
      const x = Number(String(row[xCol]).replace(/,/g, ''));
      const y = Number(String(row[yCol]).replace(/,/g, ''));
      if (isNaN(x) || isNaN(y)) return;
      const g = String(row[colorCol] ?? 'Default');
      if (!groups[g]) groups[g] = [];
      groups[g].push({ x, y });
    });

    return {
      datasets: Object.entries(groups).map(([label, points], i) => ({
        label,
        data: points,
        backgroundColor: getColor(i, 0.7),
      })),
    };
  }

  return {
    datasets: [{
      label: `${xCol} vs ${yCol}`,
      data: data.map((row) => ({
        x: Number(String(row[xCol]).replace(/,/g, '')) || 0,
        y: Number(String(row[yCol]).replace(/,/g, '')) || 0,
      })).filter((p) => !isNaN(p.x) && !isNaN(p.y)),
      backgroundColor: getColor(0, 0.6),
    }],
  };
}

export function preparePieChart(data: DataRow[], col: string, limit = 15): {
  labels: string[];
  data: number[];
  colors: string[];
} {
  const freq: Record<string, number> = {};
  data.forEach((row) => {
    const v = String(row[col] ?? '(blank)');
    freq[v] = (freq[v] || 0) + 1;
  });

  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return {
    labels: sorted.map(([k]) => k),
    data: sorted.map(([, v]) => v),
    colors: sorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
  };
}

export function prepareHistogram(data: DataRow[], col: string, bins = 20): {
  labels: string[];
  data: number[];
  binEdges: number[];
} {
  const nums = getNumericValues(data, col);
  if (nums.length === 0) return { labels: [], data: [], binEdges: [] };

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const binWidth = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  const edges = new Array(bins + 1).fill(0).map((_, i) => min + i * binWidth);

  nums.forEach((n) => {
    const idx = Math.min(bins - 1, Math.floor((n - min) / binWidth));
    counts[idx]++;
  });

  const labels = edges.slice(0, -1).map((e, i) => `${e.toFixed(1)}-${edges[i + 1].toFixed(1)}`);

  return { labels, data: counts, binEdges: edges };
}

export function prepareRadarChart(data: DataRow[], cols: string[]): {
  labels: string[];
  datasets: { label: string; data: number[]; backgroundColor: string; borderColor: string }[];
} {
  // Normalize each column to 0-100 scale
  const normalized: Record<string, number[]> = {};
  cols.forEach((col) => {
    const nums = getNumericValues(data, col);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    normalized[col] = nums.map((v) => ((v - min) / range) * 100);
  });

  // Compute averages for each column
  const avgs = cols.map((col) => {
    const vals = normalized[col];
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  return {
    labels: cols,
    datasets: [{
      label: 'Average (normalized)',
      data: avgs,
      backgroundColor: 'rgba(79, 70, 229, 0.2)',
      borderColor: CHART_COLORS[0],
    }],
  };
}

export function prepareBoxPlotData(data: DataRow[], cols: string[]): {
  labels: string[];
  datasets: { label: string; data: { min: number; q1: number; median: number; q3: number; max: number }[]; backgroundColor: string; borderColor: string }[];
} {
  const stats = cols.map((col) => {
    const nums = getNumericValues(data, col);
    const sorted = [...nums].sort((a, b) => a - b);
    const n = sorted.length;
    const q1Pos = (n - 1) * 0.25;
    const q3Pos = (n - 1) * 0.75;
    return {
      min: sorted[0],
      q1: sorted[Math.floor(q1Pos)] + (sorted[Math.ceil(q1Pos)] - sorted[Math.floor(q1Pos)]) * (q1Pos % 1),
      median: n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
      q3: sorted[Math.floor(q3Pos)] + (sorted[Math.ceil(q3Pos)] - sorted[Math.floor(q3Pos)]) * (q3Pos % 1),
      max: sorted[n - 1],
    };
  });

  return {
    labels: cols,
    datasets: [{
      label: 'Distribution',
      data: stats,
      backgroundColor: 'rgba(79, 70, 229, 0.3)',
      borderColor: CHART_COLORS[0],
    }],
  };
}

export function prepareBubbleData(data: DataRow[], xCol: string, yCol: string, rCol: string): {
  datasets: { label: string; data: { x: number; y: number; r: number }[]; backgroundColor: string }[];
} {
  const maxR = Math.max(...data.map((row) => Number(String(row[rCol]).replace(/,/g, '')) || 0));

  return {
    datasets: [{
      label: `${xCol} vs ${yCol} (size: ${rCol})`,
      data: data.map((row) => ({
        x: Number(String(row[xCol]).replace(/,/g, '')) || 0,
        y: Number(String(row[yCol]).replace(/,/g, '')) || 0,
        r: Math.max(3, ((Number(String(row[rCol]).replace(/,/g, '')) || 0) / maxR) * 30),
      })).filter((p) => !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.r)),
      backgroundColor: getColor(0, 0.5),
    }],
  };
}
