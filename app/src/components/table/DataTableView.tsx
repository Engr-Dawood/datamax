import { useState, useRef, useEffect } from 'react';
import {
  Search, Download, RotateCcw, ChevronLeft, ChevronRight,
  Columns3, Eye, EyeOff, Filter, ArrowUpDown, CheckSquare, Square,
  FileSpreadsheet, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/lib/context';
import { exportCSV, exportExcel, getUniqueValues } from '@/lib/dataEngine';
import { computeColumnStats } from '@/lib/stats';
import type { DataRow, Column } from '@/types';
import { fmtNum } from '@/lib/dataEngine';

interface Props {
  data: DataRow[];
  allData: DataRow[];
  columns: Column[];
}

export default function DataTableView({ data, allData, columns }: Props) {
  const { state, dispatch } = useApp();
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(state.pageSize);

  const visibleCols = columns.filter((c) => c.visible);
  const total = data.length;
  const isAllSelected = pageSize > 0 && total > 0 && data.slice(
    (state.page - 1) * pageSize,
    Math.min(state.page * pageSize, total)
  ).every((_, i) => state.selectedRows.has((state.page - 1) * pageSize + i));

  const start = pageSize === 0 ? 0 : (state.page - 1) * pageSize;
  const end = pageSize === 0 ? total : Math.min(start + pageSize, total);
  const pageData = pageSize === 0 ? data : data.slice(start, end);
  const totalPages = pageSize === 0 ? 1 : Math.ceil(total / pageSize);

  // Close filter on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSort = (colKey: string) => {
    if (state.sort.col === colKey) {
      dispatch({ type: 'SET_SORT', payload: { col: colKey, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } });
    } else {
      dispatch({ type: 'SET_SORT', payload: { col: colKey, dir: 'asc' } });
    }
  };

  const handleFilterToggle = (colKey: string, val: string, allValues: string[]) => {
    const current = state.filters[colKey];
    let set: Set<string>;
    if (current instanceof Set) {
      set = new Set(current);
    } else {
      set = new Set(allValues);
    }
    if (set.has(val)) set.delete(val);
    else set.add(val);

    if (set.size === 0 || set.size === allValues.length) {
      dispatch({ type: 'REMOVE_FILTER', payload: colKey });
    } else {
      dispatch({ type: 'ADD_FILTER', payload: { col: colKey, value: set } });
    }
  };

  const toggleAllRows = () => {
    if (isAllSelected) {
      dispatch({ type: 'CLEAR_ROW_SELECTION' });
    } else {
      const newSet = new Set(state.selectedRows);
      for (let i = start; i < end; i++) {
        newSet.add(i);
      }
      dispatch({ type: 'SELECT_ALL_ROWS', payload: newSet });
    }
  };

  // Selected column stats
  const selectedColStats = state.selectedCol
    ? computeColumnStats(allData, columns.find((c) => c.key === state.selectedCol)!)
    : null;

  // Pagination range
  const getPageRange = () => {
    const range: (number | string)[] = [];
    const showMax = 7;
    let s = Math.max(1, state.page - 3);
    let e = Math.min(totalPages, s + showMax - 1);
    if (e - s < showMax - 1) {
      s = Math.max(1, e - showMax + 1);
    }
    if (s > 1) { range.push(1); if (s > 2) range.push('...'); }
    for (let i = s; i <= e; i++) range.push(i);
    if (e < totalPages) { if (e < totalPages - 1) range.push('...'); range.push(totalPages); }
    return range;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b ds-border-color flex-shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ds-text-tertiary" />
          <Input
            placeholder="Search across all columns..."
            value={state.search}
            onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
            className="pl-9 h-8 text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <Columns3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">Show / Hide Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((col) => (
                <DropdownMenuItem
                  key={col.key}
                  className="text-xs cursor-pointer"
                  onClick={() => {
                    dispatch({
                      type: 'SET_COLUMNS',
                      payload: columns.map((c) => c.key === col.key ? { ...c, visible: !c.visible } : c),
                    });
                  }}
                >
                  {col.visible ? <Eye className="w-3 h-3 mr-2" /> : <EyeOff className="w-3 h-3 mr-2 opacity-40" />}
                  <span className="truncate">{col.label}</span>
                  <Badge variant="outline" className="ml-auto text-[9px] px-1 h-4">{col.type}</Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              dispatch({ type: 'SET_FILTER', payload: {} });
              dispatch({ type: 'SET_SEARCH', payload: '' });
              dispatch({ type: 'SET_SORT', payload: { col: null, dir: 'asc' } });
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => exportCSV(data, columns, state.fileName)}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => exportExcel(data, columns, state.fileName)}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
                Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active Filters */}
      {Object.keys(state.filters).length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b ds-border-color flex-shrink-0 flex-wrap">
          <span className="text-[10px] font-semibold ds-text-tertiary uppercase tracking-wider">Filters:</span>
          {Object.entries(state.filters).map(([col, val]) => (
            <Badge
              key={col}
              variant="secondary"
              className="text-[10px] cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
              onClick={() => dispatch({ type: 'REMOVE_FILTER', payload: col })}
            >
              {col}: {val instanceof Set ? `${val.size} selected` : val}
              <span className="ml-1">&times;</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Data Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8 px-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={toggleAllRows} className="flex items-center justify-center">
                    {isAllSelected ? <CheckSquare className="w-4 h-4 text-[hsl(var(--primary))]" /> : <Square className="w-4 h-4 ds-text-tertiary" />}
                  </button>
                </th>
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    className={state.selectedCol === col.key ? 'active-col' : ''}
                    onClick={() => {
                      dispatch({ type: 'SET_SELECTED_COL', payload: col.key });
                      handleSort(col.key);
                    }}
                  >
                    <div className="flex items-center gap-1 relative" ref={filterOpen === col.key ? filterRef : undefined}>
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                      <span>{col.label}</span>
                      <Badge variant="outline" className="ml-1 text-[9px] px-1 h-4 opacity-60">{col.type}</Badge>
                      {/* Filter button */}
                      <button
                        className="ml-1 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterOpen(filterOpen === col.key ? null : col.key);
                          setFilterSearch('');
                        }}
                      >
                        <Filter className="w-3 h-3" />
                      </button>
                      {/* Filter Popover */}
                      {filterOpen === col.key && (
                        <div className="col-filter show" onClick={(e) => e.stopPropagation()}>
                          <Input
                            placeholder="Filter values..."
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            className="h-7 text-xs mb-2"
                            autoFocus
                          />
                          <ScrollArea className="h-48">
                            <div className="space-y-0.5">
                              {getUniqueValues(allData, col.key)
                                .filter((v) => v.toLowerCase().includes(filterSearch.toLowerCase()))
                                .map((val) => {
                                  const current = state.filters[col.key];
                                  const isChecked = !(current instanceof Set) || current.has(val);
                                  return (
                                    <label
                                      key={val}
                                      className="flex items-center gap-2 px-2 py-1 text-xs rounded cursor-pointer hover:bg-[hsl(var(--ds-surface-2))]"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleFilterToggle(col.key, val, getUniqueValues(allData, col.key))}
                                        className="rounded"
                                      />
                                      <span className="truncate">{val || '(blank)'}</span>
                                    </label>
                                  );
                                })}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length + 1} className="text-center py-16 ds-text-tertiary">
                    No matching rows
                  </td>
                </tr>
              ) : (
                pageData.map((row, idx) => {
                  const globalIdx = start + idx;
                  const isSelected = state.selectedRows.has(globalIdx);
                  return (
                    <tr key={globalIdx} className={isSelected ? 'selected' : ''}>
                      <td className="px-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => dispatch({ type: 'TOGGLE_ROW', payload: globalIdx })}>
                          {isSelected ? <CheckSquare className="w-4 h-4 text-[hsl(var(--primary))]" /> : <Square className="w-4 h-4 ds-text-tertiary" />}
                        </button>
                      </td>
                      {visibleCols.map((col) => {
                        const val = row[col.key];
                        return (
                          <td key={col.key} className={`type-${col.type}`}>
                            {val == null ? '' : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Stats Panel */}
        <div className="w-72 border-l ds-border-color ds-surface overflow-y-auto hidden lg:block flex-shrink-0">
          {selectedColStats ? (
            <div className="p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider ds-text-tertiary">Column Stats</h3>
                <Badge variant="outline" className="text-[9px] h-4">{selectedColStats.type}</Badge>
              </div>

              <div className="stat-card">
                <div className="stat-label">Column</div>
                <div className="stat-value small truncate">{selectedColStats.column}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="stat-card">
                  <div className="stat-label">Count</div>
                  <div className="stat-value">{selectedColStats.count.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Missing</div>
                  <div className="stat-value">{selectedColStats.missing.toLocaleString()}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Unique Values</div>
                <div className="stat-value">{selectedColStats.unique.toLocaleString()}</div>
              </div>

              {selectedColStats.type === 'number' && selectedColStats.mean !== undefined && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="stat-card">
                      <div className="stat-label">Min</div>
                      <div className="stat-value small">{fmtNum(selectedColStats.min!)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Max</div>
                      <div className="stat-value small">{fmtNum(selectedColStats.max!)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="stat-card">
                      <div className="stat-label">Mean</div>
                      <div className="stat-value small">{fmtNum(selectedColStats.mean)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Median</div>
                      <div className="stat-value small">{fmtNum(selectedColStats.median!)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="stat-card">
                      <div className="stat-label">Std Dev</div>
                      <div className="stat-value small">{fmtNum(selectedColStats.std!)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">IQR</div>
                      <div className="stat-value small">{fmtNum((selectedColStats.q3! - selectedColStats.q1!))}</div>
                    </div>
                  </div>

                  {/* Distribution Histogram */}
                  {selectedColStats.distribution && (
                    <div className="stat-card">
                      <div className="stat-label">Distribution</div>
                      <div className="mini-hist">
                        {selectedColStats.distribution.map((c, i) => {
                          const maxC = Math.max(...selectedColStats.distribution!);
                          const pct = maxC > 0 ? (c / maxC) * 100 : 0;
                          return (
                            <div
                              key={i}
                              className="hist-bar"
                              style={{ height: `${Math.max(2, pct)}%` }}
                              title={`${c} values`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Skewness & Kurtosis */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="stat-card">
                      <div className="stat-label">Skewness</div>
                      <div className="stat-value small">{(selectedColStats.skewness || 0).toFixed(3)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Kurtosis</div>
                      <div className="stat-value small">{(selectedColStats.kurtosis || 0).toFixed(3)}</div>
                    </div>
                  </div>
                </>
              )}

              {selectedColStats.type === 'date' && selectedColStats.range && (
                <div className="stat-card">
                  <div className="stat-label">Date Range</div>
                  <div className="stat-value small">
                    {selectedColStats.range[0].toLocaleDateString()} → {selectedColStats.range[1].toLocaleDateString()}
                  </div>
                </div>
              )}

              {selectedColStats.topValues && (
                <div className="stat-card">
                  <div className="stat-label">Top Values</div>
                  {selectedColStats.topValues.map(({ value, count }) => (
                    <div key={value} className="flex justify-between items-center text-xs mt-1">
                      <span className="truncate max-w-[140px] ds-text-secondary">{String(value).slice(0, 30)}</span>
                      <span className="ds-text-tertiary font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 ds-text-tertiary">
              <BarChart3 className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-xs">Click any column header to see statistics</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 px-4 py-2 border-t ds-border-color flex-shrink-0 bg-card text-xs">
        <div className="flex items-center gap-2">
          <span className="ds-text-secondary">Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              setPageSize(v);
              dispatch({ type: 'SET_PAGE_SIZE', payload: v });
            }}
            className="h-7 text-xs border rounded px-2 bg-background"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1,000</option>
            <option value={0}>All</option>
          </select>
        </div>

        <div className="flex items-center gap-1 mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            disabled={state.page === 1}
            onClick={() => dispatch({ type: 'SET_PAGE', payload: state.page - 1 })}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {getPageRange().map((p, i) => (
            <Button
              key={i}
              variant={p === state.page ? 'default' : 'ghost'}
              size="sm"
              className={`w-7 h-7 text-xs ${p === '...' ? 'cursor-default' : ''}`}
              disabled={p === '...'}
              onClick={() => typeof p === 'number' && dispatch({ type: 'SET_PAGE', payload: p })}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            disabled={state.page === totalPages}
            onClick={() => dispatch({ type: 'SET_PAGE', payload: state.page + 1 })}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <span className="font-mono text-[11px] ds-text-tertiary">
          {pageSize === 0
            ? `Showing all ${total.toLocaleString()} rows`
            : `${(start + 1).toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`}
          {state.selectedRows.size > 0 && ` · ${state.selectedRows.size} selected`}
        </span>
      </div>
    </div>
  );
}
