import { useState, useMemo } from 'react';
import { LayoutGrid, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DataRow, Column } from '@/types';
import { buildPivot } from '@/lib/stats';
import { fmtNum } from '@/lib/dataEngine';

interface Props {
  data: DataRow[];
  columns: Column[];
}

const aggOptions: { value: string; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'mean', label: 'Mean' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'median', label: 'Median' },
];

export default function PivotView({ data, columns }: Props) {
  const [rowField, setRowField] = useState('');
  const [colField, setColField] = useState('');
  const [valueField, setValueField] = useState('');
  const [aggFunc, setAggFunc] = useState<string>('sum');

  const colNames = columns.map((c) => c.key);
  const numericCols = columns.filter((c) => c.type === 'number');

  // Auto-select defaults
  useMemo(() => {
    if (!rowField && colNames.length > 0) setRowField(colNames[0]);
    if (!colField && colNames.length > 1) setColField(colNames[1]);
    if (!valueField && numericCols.length > 0) setValueField(numericCols[0].key);
    else if (!valueField && colNames.length > 0) setValueField(colNames[0]);
  }, [colNames.length, numericCols.length]);

  const pivot = useMemo(() => {
    if (!rowField || !colField || !valueField) return null;
    return buildPivot(data, rowField, colField, valueField, aggFunc as any);
  }, [data, rowField, colField, valueField, aggFunc]);

  const exportPivot = () => {
    if (!pivot) return;
    const rows: string[][] = [];
    // Header
    rows.push(['', ...pivot.cols, 'Total']);
    // Data rows
    pivot.rows.forEach((r, i) => {
      rows.push([r, ...pivot.data[i].map((v) => v != null ? String(v) : ''), String(pivot.rowTotals[i])]);
    });
    // Totals row
    rows.push(['Total', ...pivot.colTotals.map((v) => String(v)), String(pivot.grandTotal)]);

    const csv = rows.map((r) => r.map((c) => {
      if (c.includes(',') || c.includes('"') || c.includes('\n')) return `"${c.replace(/"/g, '""')}"`;
      return c;
    }).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pivot_table.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Controls */}
      <div className="flex-shrink-0 border-b ds-border-color p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider ds-text-tertiary w-10">Rows:</span>
            <Select value={rowField} onValueChange={setRowField}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colNames.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider ds-text-tertiary w-10">Cols:</span>
            <Select value={colField} onValueChange={setColField}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colNames.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider ds-text-tertiary w-10">Vals:</span>
            <Select value={valueField} onValueChange={setValueField}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {numericCols.map((c) => <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider ds-text-tertiary">Agg:</span>
            <Select value={aggFunc} onValueChange={setAggFunc}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aggOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8 ml-auto" onClick={exportPivot}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Pivot Table */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {!pivot ? (
            <div className="text-center py-20 ds-text-tertiary">
              <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select fields to generate a pivot table</p>
            </div>
          ) : pivot.rows.length === 0 ? (
            <div className="text-center py-20 ds-text-tertiary text-sm">No data available for the selected combination.</div>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 ds-border-color bg-[hsl(var(--ds-surface-2))]">
                      <th className="text-left p-2.5 font-semibold ds-text-secondary min-w-[120px]">
                        {rowField} \ {colField}
                      </th>
                      {pivot.cols.map((c) => (
                        <th key={c} className="text-right p-2.5 font-semibold ds-text-secondary min-w-[80px]">{c}</th>
                      ))}
                      <th className="text-right p-2.5 font-semibold text-[hsl(var(--primary))] min-w-[80px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivot.rows.map((row, i) => (
                      <tr key={row} className="border-b ds-border-color hover:bg-[hsl(var(--ds-surface-2))] transition-colors">
                        <td className="p-2.5 font-medium ds-text-secondary sticky left-0 bg-card">{row}</td>
                        {pivot.data[i].map((v, j) => (
                          <td key={j} className="text-right p-2.5 font-mono ds-text-secondary">
                            {v != null ? fmtNum(v) : '—'}
                          </td>
                        ))}
                        <td className="text-right p-2.5 font-mono font-medium text-[hsl(var(--primary))]">
                          {fmtNum(pivot.rowTotals[i])}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="border-t-2 ds-border-color bg-[hsl(var(--ds-surface-2))] font-semibold">
                      <td className="p-2.5 text-[hsl(var(--primary))]">Total</td>
                      {pivot.colTotals.map((v, i) => (
                        <td key={i} className="text-right p-2.5 font-mono text-[hsl(var(--primary))]">{fmtNum(v)}</td>
                      ))}
                      <td className="text-right p-2.5 font-mono text-[hsl(var(--primary))]">{fmtNum(pivot.grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
