import { useState, useMemo } from 'react';
import {
  Copy, AlertTriangle,
  BarChart3, ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataRow, Column } from '@/types';
import { detectDuplicates } from '@/lib/stats';
import { getNumericValues } from '@/lib/dataEngine';
import { fmtNum } from '@/lib/dataEngine';

interface Props {
  data: DataRow[];
  columns: Column[];
}

type CleanTab = 'overview' | 'duplicates' | 'missing' | 'profile';

export default function CleaningView({ data, columns }: Props) {
  const [tab, setTab] = useState<CleanTab>('overview');

  const tabs: { id: CleanTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: ShieldCheck },
    { id: 'duplicates', label: 'Duplicates', icon: Copy },
    { id: 'missing', label: 'Missing Values', icon: AlertTriangle },
    { id: 'profile', label: 'Column Profile', icon: BarChart3 },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sub-nav */}
      <div className="flex-shrink-0 border-b ds-border-color px-4 py-2 flex items-center gap-1">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? 'secondary' : 'ghost'}
            size="sm"
            className={`text-xs gap-1.5 h-8 ${tab === t.id ? '' : 'ds-text-secondary'}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </Button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {tab === 'overview' && <OverviewTab data={data} columns={columns} />}
          {tab === 'duplicates' && <DuplicatesTab data={data} columns={columns} />}
          {tab === 'missing' && <MissingTab data={data} columns={columns} />}
          {tab === 'profile' && <ProfileTab data={data} columns={columns} />}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────
function OverviewTab({ data, columns }: { data: DataRow[]; columns: Column[] }) {
  const stats = useMemo(() => {
    const totalCells = data.length * columns.length;
    let missingCells = 0;
    const colMissing: Record<string, number> = {};

    columns.forEach((col) => {
      colMissing[col.key] = 0;
    });

    data.forEach((row) => {
      columns.forEach((col) => {
        if (row[col.key] == null || String(row[col.key]).trim() === '') {
          missingCells++;
          colMissing[col.key]++;
        }
      });
    });

    const duplicates = detectDuplicates(data, columns);
    const duplicateRows = duplicates.reduce((sum, d) => sum + d.count, 0);

    return {
      totalRows: data.length,
      totalCols: columns.length,
      totalCells,
      missingCells,
      missingPct: (missingCells / totalCells) * 100,
      duplicateGroups: duplicates.length,
      duplicateRows,
      colMissing,
    };
  }, [data, columns]);

  return (
    <div className="space-y-4 max-w-3xl animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="stat-label">Total Rows</div>
            <div className="stat-value">{stats.totalRows.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="stat-label">Columns</div>
            <div className="stat-value">{stats.totalCols}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="stat-label">Missing Cells</div>
            <div className="stat-value small">
              {stats.missingCells.toLocaleString()}
              <span className="ds-text-tertiary ml-1">({stats.missingPct.toFixed(1)}%)</span>
            </div>
            <Progress value={100 - stats.missingPct} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="stat-label">Duplicate Groups</div>
            <div className="stat-value small">
              {stats.duplicateGroups}
              <span className="ds-text-tertiary ml-1">({stats.duplicateRows} rows)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Column type breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Column Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(['number', 'text', 'date'] as const).map((type) => {
              const count = columns.filter((c) => c.type === type).length;
              const colors = {
                number: 'bg-[hsl(var(--primary))]',
                text: 'bg-[hsl(var(--warning))]',
                date: 'bg-[hsl(var(--success))]',
              };
              return count > 0 ? (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <div className={`w-3 h-3 rounded-full ${colors[type]}`} />
                  <span className="capitalize ds-text-secondary">{type}:</span>
                  <span className="font-mono font-medium">{count}</span>
                </div>
              ) : null;
            })}
          </div>
        </CardContent>
      </Card>

      {/* Health score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[hsl(var(--success))]" />
            Data Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const completeness = ((stats.totalCells - stats.missingCells) / stats.totalCells) * 100;
            const uniqueness = stats.duplicateRows > 0
              ? ((stats.totalRows - stats.duplicateRows + stats.duplicateGroups) / stats.totalRows) * 100
              : 100;
            const score = (completeness * 0.5 + uniqueness * 0.5);
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold font-mono" style={{ color: score >= 90 ? 'hsl(160,84%,39%)' : score >= 70 ? 'hsl(38,92%,50%)' : 'hsl(0,84%,60%)' }}>
                    {score.toFixed(0)}%
                  </span>
                  <Badge variant={score >= 90 ? 'default' : score >= 70 ? 'secondary' : 'destructive'}>
                    {score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="ds-text-secondary">Completeness</span>
                    <span className="font-mono">{completeness.toFixed(1)}%</span>
                  </div>
                  <Progress value={completeness} className="h-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="ds-text-secondary">Uniqueness</span>
                    <span className="font-mono">{uniqueness.toFixed(1)}%</span>
                  </div>
                  <Progress value={uniqueness} className="h-2" />
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Duplicates ──────────────────────────────────────────────
function DuplicatesTab({ data, columns }: { data: DataRow[]; columns: Column[] }) {
  const duplicates = useMemo(() => detectDuplicates(data, columns), [data, columns]);

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Duplicate Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {duplicates.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-[hsl(var(--success))]" />
              <p className="text-sm ds-text-secondary">No duplicate rows found. Your data is clean!</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs ds-text-secondary mb-3">
                Found <strong>{duplicates.length}</strong> duplicate groups affecting <strong>{duplicates.reduce((s, d) => s + d.count, 0)}</strong> rows.
              </div>
              {duplicates.map((dup, i) => (
                <div key={i} className="p-3 border ds-border-color rounded-lg bg-[hsl(var(--ds-surface-2))]">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[10px]">{dup.count} identical rows</Badge>
                    <span className="text-[10px] font-mono ds-text-tertiary">Rows: {dup.indices.slice(0, 10).map((idx) => idx + 1).join(', ')}{dup.indices.length > 10 ? ` +${dup.indices.length - 10} more` : ''}</span>
                  </div>
                  <div className="text-xs ds-text-secondary truncate font-mono">{dup.hash.slice(0, 200)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Missing Values ──────────────────────────────────────────
function MissingTab({ data, columns }: { data: DataRow[]; columns: Column[] }) {
  const missingStats = useMemo(() => {
    return columns.map((col) => {
      const missing = data.filter((row) => row[col.key] == null || String(row[col.key]).trim() === '').length;
      return {
        column: col.key,
        type: col.type,
        missing,
        total: data.length,
        pct: data.length > 0 ? (missing / data.length) * 100 : 0,
      };
    }).sort((a, b) => b.pct - a.pct);
  }, [data, columns]);

  const totalMissing = missingStats.reduce((s, c) => s + c.missing, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />
            Missing Value Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalMissing === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-[hsl(var(--success))]" />
              <p className="text-sm ds-text-secondary">No missing values found. Perfect data!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {missingStats.filter((s) => s.missing > 0).map((s) => (
                <div key={s.column}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium ds-text-secondary">{s.column}</span>
                      <Badge variant="outline" className="text-[9px] h-4">{s.type}</Badge>
                    </div>
                    <span className="font-mono ds-text-tertiary">{s.missing.toLocaleString()} / {s.total.toLocaleString()} ({s.pct.toFixed(1)}%)</span>
                  </div>
                  <Progress value={100 - s.pct} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Column Profile ──────────────────────────────────────────
function ProfileTab({ data, columns }: { data: DataRow[]; columns: Column[] }) {
  const [selectedCol, setSelectedCol] = useState(columns[0]?.key || '');

  const profile = useMemo(() => {
    const col = columns.find((c) => c.key === selectedCol);
    if (!col) return null;

    const allValues = data.map((r) => r[col.key]);
    const nonNull = allValues.filter((v) => v != null && String(v).trim() !== '');
    const unique = new Set(allValues.map(String)).size;

    // Top values
    const freq: Record<string, number> = {};
    allValues.forEach((v) => { freq[String(v)] = (freq[String(v)] || 0) + 1; });
    const topValues = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);

    // Numeric stats
    let numericInfo: { min: number; max: number; mean: number; sum: number } | null = null;
    if (col.type === 'number') {
      const nums = getNumericValues(data, col.key);
      if (nums.length > 0) {
        numericInfo = {
          min: Math.min(...nums),
          max: Math.max(...nums),
          mean: nums.reduce((a, b) => a + b, 0) / nums.length,
          sum: nums.reduce((a, b) => a + b, 0),
        };
      }
    }

    return { col, total: allValues.length, nonNull: nonNull.length, missing: allValues.length - nonNull.length, unique, topValues, numericInfo };
  }, [data, columns, selectedCol]);

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-2">
        <span className="text-xs ds-text-tertiary">Column:</span>
        <Select value={selectedCol} onValueChange={setSelectedCol}>
          <SelectTrigger className="h-8 text-xs w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map((c) => <SelectItem key={c.key} value={c.key} className="text-xs">{c.label} ({c.type})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {profile && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><div className="stat-label">Total</div><div className="stat-value">{profile.total.toLocaleString()}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="stat-label">Non-Null</div><div className="stat-value">{profile.nonNull.toLocaleString()}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="stat-label">Missing</div><div className="stat-value">{profile.missing.toLocaleString()}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="stat-label">Unique</div><div className="stat-value">{profile.unique.toLocaleString()}</div></CardContent></Card>
          </div>

          {profile.numericInfo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="p-3"><div className="stat-label">Min</div><div className="stat-value small">{fmtNum(profile.numericInfo.min)}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="stat-label">Max</div><div className="stat-value small">{fmtNum(profile.numericInfo.max)}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="stat-label">Mean</div><div className="stat-value small">{fmtNum(profile.numericInfo.mean)}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="stat-label">Sum</div><div className="stat-value small">{fmtNum(profile.numericInfo.sum)}</div></CardContent></Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">Top Values</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {profile.topValues.map(([val, count], i) => {
                  const maxCount = profile.topValues[0][1];
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-6 text-right ds-text-tertiary">{i + 1}.</span>
                      <span className="flex-1 truncate ds-text-secondary font-mono">{String(val).slice(0, 50) || '(blank)'}</span>
                      <div className="w-24 h-3 bg-[hsl(var(--ds-surface-2))] rounded overflow-hidden">
                        <div className="h-full bg-[hsl(var(--primary))] rounded" style={{ width: `${(count / maxCount) * 100}%`, opacity: 0.5 }} />
                      </div>
                      <span className="w-10 text-right font-mono ds-text-tertiary">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
