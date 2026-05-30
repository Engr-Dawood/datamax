import { useState, useMemo } from 'react';
import {
  Activity, TrendingUp, AlertTriangle, BarChart3, Sigma,
  ScatterChart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DataRow, Column } from '@/types';
import { computeAllCorrelations, getCorrelationMatrix, detectOutliers, getFrequencyDistribution, getAllDescriptiveStats } from '@/lib/stats';
import { fmtNum } from '@/lib/dataEngine';
import { getNumericValues } from '@/lib/dataEngine';

interface Props {
  allData: DataRow[];
  columns: Column[];
}

type SubTab = 'summary' | 'correlations' | 'distributions' | 'outliers';

export default function AnalyticsView({ allData, columns }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('summary');
  const [outlierCol, setOutlierCol] = useState('');
  const [distCol, setDistCol] = useState('');

  const numericCols = columns.filter((c) => c.type === 'number');
  const numericColNames = numericCols.map((c) => c.key);

  // Summary stats
  const descStats = useMemo(() => {
    if (numericColNames.length === 0) return [];
    return getAllDescriptiveStats(allData, numericColNames);
  }, [allData, numericColNames.join(',')]);

  // Correlations
  const correlations = useMemo(() => {
    if (numericColNames.length < 2) return [];
    return computeAllCorrelations(allData, numericColNames);
  }, [allData, numericColNames.join(',')]);

  // Correlation matrix
  const corrMatrix = useMemo(() => {
    if (numericColNames.length < 2) return null;
    return getCorrelationMatrix(allData, numericColNames);
  }, [allData, numericColNames.join(',')]);

  const subTabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'summary', label: 'Summary Statistics', icon: Sigma },
    { id: 'correlations', label: 'Correlations', icon: ScatterChart },
    { id: 'distributions', label: 'Distributions', icon: BarChart3 },
    { id: 'outliers', label: 'Outliers', icon: AlertTriangle },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sub-tab navigation */}
      <div className="flex-shrink-0 border-b ds-border-color px-4 py-2 flex items-center gap-1">
        {subTabs.map((t) => (
          <Button
            key={t.id}
            variant={subTab === t.id ? 'secondary' : 'ghost'}
            size="sm"
            className={`text-xs gap-1.5 h-8 ${subTab === t.id ? '' : 'ds-text-secondary'}`}
            onClick={() => setSubTab(t.id)}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </Button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {numericColNames.length === 0 ? (
            <div className="text-center py-20 ds-text-tertiary">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No numeric columns found in your dataset.</p>
              <p className="text-xs mt-1">Analytics requires numeric data to compute statistics.</p>
            </div>
          ) : (
            <>
              {/* Summary Statistics */}
              {subTab === 'summary' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {descStats.map((stat) => (
                      <Card key={stat.column} className="overflow-hidden">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-xs font-semibold flex items-center justify-between">
                            <span className="truncate">{stat.column}</span>
                            <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0">{stat.count} vals</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-1.5">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="ds-text-tertiary">Mean:</span>
                              <span className="ml-1 font-mono font-medium">{fmtNum(stat.mean)}</span>
                            </div>
                            <div>
                              <span className="ds-text-tertiary">Median:</span>
                              <span className="ml-1 font-mono font-medium">{fmtNum(stat.median)}</span>
                            </div>
                            <div>
                              <span className="ds-text-tertiary">Std:</span>
                              <span className="ml-1 font-mono font-medium">{fmtNum(stat.std)}</span>
                            </div>
                            <div>
                              <span className="ds-text-tertiary">CV:</span>
                              <span className="ml-1 font-mono font-medium">{stat.cv.toFixed(1)}%</span>
                            </div>
                            <div>
                              <span className="ds-text-tertiary">Min:</span>
                              <span className="ml-1 font-mono font-medium">{fmtNum(stat.min)}</span>
                            </div>
                            <div>
                              <span className="ds-text-tertiary">Max:</span>
                              <span className="ml-1 font-mono font-medium">{fmtNum(stat.max)}</span>
                            </div>
                            <div>
                              <span className="ds-text-tertiary">Q1:</span>
                              <span className="ml-1 font-mono font-medium">{fmtNum(stat.q1)}</span>
                            </div>
                            <div>
                              <span className="ds-text-tertiary">Q3:</span>
                              <span className="ml-1 font-mono font-medium">{fmtNum(stat.q3)}</span>
                            </div>
                          </div>
                          <div className="text-[10px] ds-text-tertiary pt-1 border-t ds-border-color">
                            Range: {fmtNum(stat.range)} · Missing: {stat.missing}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Correlations */}
              {subTab === 'correlations' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Top correlations */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[hsl(var(--primary))]" />
                        Top Correlations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {correlations.length === 0 ? (
                        <p className="text-xs ds-text-tertiary py-4">Not enough numeric columns for correlation analysis.</p>
                      ) : (
                        <div className="space-y-2">
                          {correlations.slice(0, 20).map((c, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs">
                              <span className="w-6 text-right ds-text-tertiary">{i + 1}.</span>
                              <span className="font-medium w-32 truncate">{c.col1}</span>
                              <span className="ds-text-tertiary">vs</span>
                              <span className="font-medium w-32 truncate">{c.col2}</span>
                              <div className="flex-1 h-4 bg-[hsl(var(--ds-surface-2))] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.abs(c.correlation) * 100}%`,
                                    backgroundColor: c.correlation > 0 ? 'hsl(160,84%,39%)' : 'hsl(0,84%,60%)',
                                    marginLeft: c.correlation > 0 ? '50%' : `${50 - Math.abs(c.correlation) * 50}%`,
                                  }}
                                />
                              </div>
                              <span className={`font-mono font-medium w-12 text-right ${Math.abs(c.correlation) > 0.7 ? 'text-[hsl(var(--success))]' : Math.abs(c.correlation) > 0.3 ? 'ds-text-secondary' : 'ds-text-tertiary'}`}>
                                {c.correlation.toFixed(3)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Correlation Matrix */}
                  {corrMatrix && numericColNames.length > 1 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Correlation Matrix</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className="p-1" />
                                {numericColNames.map((c) => (
                                  <th key={c} className="p-1 text-left font-medium ds-text-tertiary truncate max-w-[80px]">{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {numericColNames.map((row, i) => (
                                <tr key={row}>
                                  <td className="p-1 font-medium ds-text-secondary truncate max-w-[80px]">{row}</td>
                                  {numericColNames.map((_, j) => {
                                    const v = corrMatrix[i][j];
                                    const intensity = Math.abs(v);
                                    const isPos = v >= 0;
                                    return (
                                      <td
                                        key={j}
                                        className="p-1 text-center font-mono"
                                        style={{
                                          backgroundColor: i === j
                                            ? 'hsl(var(--ds-surface-2))'
                                            : `rgba(${isPos ? '16,185,129' : '239,68,68'},${0.1 + intensity * 0.35})`,
                                          color: intensity > 0.5 ? (isPos ? 'hsl(160,84%,30%)' : 'hsl(0,84%,40%)') : undefined,
                                          fontWeight: intensity > 0.7 ? 600 : 400,
                                        }}
                                        title={`${row} vs ${numericColNames[j]}: ${v.toFixed(4)}`}
                                      >
                                        {v.toFixed(2)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Distributions */}
              {subTab === 'distributions' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-xs ds-text-tertiary">Column:</span>
                    <Select value={distCol} onValueChange={setDistCol}>
                      <SelectTrigger className="h-8 text-xs w-64">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {numericColNames.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {distCol && (
                    <DistributionView data={allData} col={distCol} />
                  )}
                </div>
              )}

              {/* Outliers */}
              {subTab === 'outliers' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-xs ds-text-tertiary">Column:</span>
                    <Select value={outlierCol} onValueChange={setOutlierCol}>
                      <SelectTrigger className="h-8 text-xs w-64">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {numericColNames.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {outlierCol && (
                    <OutlierView data={allData} col={outlierCol} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function DistributionView({ data, col }: { data: DataRow[]; col: string }) {
  const values = getNumericValues(data, col);
  const dist = getFrequencyDistribution(data, col, 20);
  const maxCount = Math.max(...dist.map((d) => d.count));

  if (values.length === 0) return <p className="text-xs ds-text-tertiary">No numeric values found.</p>;

  const stats = useMemo(() => {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const mid = Math.floor(n / 2);
    const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const std = Math.sqrt(variance);
    return { mean, median, std, min: sorted[0], max: sorted[n - 1] };
  }, [values]);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 text-xs">
        <span><span className="ds-text-tertiary">Mean:</span> <strong className="font-mono">{fmtNum(stats.mean)}</strong></span>
        <span><span className="ds-text-tertiary">Median:</span> <strong className="font-mono">{fmtNum(stats.median)}</strong></span>
        <span><span className="ds-text-tertiary">Std:</span> <strong className="font-mono">{fmtNum(stats.std)}</strong></span>
        <span><span className="ds-text-tertiary">Min:</span> <strong className="font-mono">{fmtNum(stats.min)}</strong></span>
        <span><span className="ds-text-tertiary">Max:</span> <strong className="font-mono">{fmtNum(stats.max)}</strong></span>
      </div>

      {/* Histogram */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-1">
            {dist.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-32 text-right ds-text-tertiary truncate">{d.label}</span>
                <div className="flex-1 h-5 bg-[hsl(var(--ds-surface-2))] rounded overflow-hidden">
                  <div
                    className="h-full bg-[hsl(var(--primary))] rounded transition-all duration-500 flex items-center justify-end pr-1.5"
                    style={{ width: `${maxCount > 0 ? (d.count / maxCount) * 100 : 0}%`, opacity: 0.5 + (d.count / maxCount) * 0.5 }}
                  >
                    {d.count > maxCount * 0.15 && (
                      <span className="text-[9px] text-white font-medium">{d.count}</span>
                    )}
                  </div>
                </div>
                <span className="w-12 text-right ds-text-tertiary">{d.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Value table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">Frequency Table</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b ds-border-color">
                <th className="text-left py-1.5 font-medium ds-text-tertiary">Range</th>
                <th className="text-right py-1.5 font-medium ds-text-tertiary">Count</th>
                <th className="text-right py-1.5 font-medium ds-text-tertiary">%</th>
                <th className="text-right py-1.5 font-medium ds-text-tertiary">Cumulative %</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let cumPct = 0;
                return dist.map((d, i) => {
                  cumPct += d.pct;
                  return (
                    <tr key={i} className="border-b ds-border-color">
                      <td className="py-1.5 font-mono ds-text-secondary">{d.label}</td>
                      <td className="py-1.5 text-right font-mono">{d.count.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono">{d.pct.toFixed(1)}%</td>
                      <td className="py-1.5 text-right font-mono">{cumPct.toFixed(1)}%</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function OutlierView({ data, col }: { data: DataRow[]; col: string }) {
  const outliers = useMemo(() => detectOutliers(data, col), [data, col]);
  const values = getNumericValues(data, col);

  const stats = useMemo(() => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const q1Pos = (n - 1) * 0.25;
    const q3Pos = (n - 1) * 0.75;
    const q1 = sorted[Math.floor(q1Pos)] + (sorted[Math.ceil(q1Pos)] - sorted[Math.floor(q1Pos)]) * (q1Pos % 1);
    const q3 = sorted[Math.floor(q3Pos)] + (sorted[Math.ceil(q3Pos)] - sorted[Math.floor(q3Pos)]) * (q3Pos % 1);
    const iqr = q3 - q1;
    return { q1, q3, iqr, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
  }, [values]);

  if (!stats) return <p className="text-xs ds-text-tertiary">Not enough data.</p>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="stat-card">
              <div className="stat-label">Q1</div>
              <div className="stat-value small">{fmtNum(stats.q1)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Q3</div>
              <div className="stat-value small">{fmtNum(stats.q3)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">IQR</div>
              <div className="stat-value small">{fmtNum(stats.iqr)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Outliers Found</div>
              <div className="stat-value small">{outliers.length}</div>
            </div>
          </div>
          <div className="mt-3 text-xs ds-text-secondary">
            Bounds: <span className="font-mono">{fmtNum(stats.lower)}</span> → <span className="font-mono">{fmtNum(stats.upper)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Outlier list */}
      {outliers.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Outlier Values ({outliers.length} found)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b ds-border-color">
                    <th className="text-left py-1.5 font-medium ds-text-tertiary">Row</th>
                    <th className="text-right py-1.5 font-medium ds-text-tertiary">Value</th>
                    <th className="text-right py-1.5 font-medium ds-text-tertiary">Deviation</th>
                  </tr>
                </thead>
                <tbody>
                  {outliers.slice(0, 100).map((o, i) => (
                    <tr key={i} className="border-b ds-border-color">
                      <td className="py-1.5 font-mono">{o.rowIndex + 1}</td>
                      <td className="py-1.5 text-right font-mono font-medium text-[hsl(var(--destructive))]">{fmtNum(o.value)}</td>
                      <td className="py-1.5 text-right font-mono ds-text-tertiary">
                        {o.value < stats.lower
                          ? `${fmtNum(o.value - stats.lower)} below`
                          : `+${fmtNum(o.value - stats.upper)} above`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 ds-text-tertiary text-sm">No outliers detected using IQR method.</div>
      )}
    </div>
  );
}
