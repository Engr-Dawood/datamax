import { useCallback, useRef, useState, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, Sun, Moon, Table2, BarChart3,
  Activity, LayoutGrid, Sparkles, CheckCircle, AlertCircle, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/lib/context';
import { parseFile, getFilteredData } from '@/lib/dataEngine';
import type { TabId } from '@/types';
import DataTableView from '@/components/table/DataTableView';
import ChartsView from '@/components/charts/ChartsView';
import AnalyticsView from '@/components/analytics/AnalyticsView';
import PivotView from '@/components/pivot/PivotView';
import CleaningView from '@/components/cleaning/CleaningView';

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'table', label: 'Data Table', icon: Table2 },
  { id: 'charts', label: 'Charts', icon: BarChart3 },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'pivot', label: 'Pivot Table', icon: LayoutGrid },
  { id: 'cleaning', label: 'Data Cleaning', icon: Sparkles },
];

function Toast() {
  const { state } = useApp();
  if (!state.toast) return null;

  const iconMap = {
    success: <CheckCircle className="w-4 h-4 text-green-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
    info: <Info className="w-4 h-4 text-blue-500" />,
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200] animate-slide-up">
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg shadow-lg">
        {iconMap[state.toast.type]}
        <span className="text-sm font-medium">{state.toast.message}</span>
      </div>
    </div>
  );
}

export default function App() {
  const { state, dispatch, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dragDepth = useRef(0);

  const hasData = state.rawData.length > 0;
  const filteredData = hasData
    ? getFilteredData(state.rawData, state.columns, state.filters, state.sort, state.search)
    : [];

  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const result = await parseFile(file);
      dispatch({
        type: 'LOAD_DATA',
        payload: {
          rows: result.rows,
          columns: result.columns,
          fileName: result.fileName,
          fileSize: result.fileSize,
        },
      });
      showToast(`Loaded "${result.fileName}" — ${result.rows.length.toLocaleString()} rows, ${result.columns.length} columns`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load file', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, showToast]);

  // Drag & drop handlers
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current++;
      setIsDragging(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current--;
      if (dragDepth.current <= 0) {
        dragDepth.current = 0;
        setIsDragging(false);
      }
    };
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleFile]);

  const activeTab = state.activeTab;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="h-14 flex items-center gap-4 px-5 border-b ds-border-color flex-shrink-0 z-50 bg-card">
        {/* Brand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-[hsl(var(--primary))]" />
          <span className="font-bold text-[15px] tracking-tight ds-text-primary">
            Data<span className="text-[hsl(var(--primary))] font-semibold">Studio</span>
          </span>
        </div>

        {/* File Meta */}
        {hasData && (
          <div className="flex items-center gap-2 flex-1 ml-3">
            <Badge variant="secondary" className="font-mono text-[11px] font-medium">
              {state.rawData.length.toLocaleString()} rows
            </Badge>
            <Badge variant="secondary" className="font-mono text-[11px] font-medium">
              {state.columns.length} columns
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px] font-medium">
              {state.fileSize} KB
            </Badge>
            <span className="text-xs ds-text-tertiary truncate max-w-[200px] ml-1">
              {state.fileName}
            </span>
          </div>
        )}

        {!hasData && <div className="flex-1" />}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasData && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Load File</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
            title={state.theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {state.theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Tab Navigation */}
      {hasData && (
        <div className="flex-shrink-0 border-b ds-border-color bg-card">
          <Tabs value={activeTab} onValueChange={(v) => dispatch({ type: 'SET_TAB', payload: v as TabId })}>
            <TabsList className="h-10 px-4 bg-transparent gap-0">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:rounded-none data-[state=active]:text-[hsl(var(--primary))] gap-1.5 text-xs font-medium px-4 h-full"
                >
                  <t.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-3 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm ds-text-secondary animate-pulse">Parsing your data...</p>
          </div>
        ) : !hasData ? (
          /* Upload Zone */
          <div
            className={`upload-zone absolute inset-0 ${isDragging ? 'drag-active' : ''}`}
            onClick={() => !isDragging && fileInputRef.current?.click()}
          >
            <div className="bg-card border border-border rounded-xl shadow-lg p-10 max-w-md w-full mx-4 text-center animate-scale-in cursor-pointer hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                <Upload className="w-7 h-7 text-[hsl(var(--primary))]" />
              </div>
              <h1 className="text-xl font-bold mb-2 ds-text-primary">Drop your spreadsheet</h1>
              <p className="text-sm ds-text-secondary mb-4">
                CSV, Excel (.xlsx, .xls) — all processing happens in your browser
              </p>
              <div className="flex items-center justify-center gap-2 mb-5">
                <Badge variant="secondary" className="font-mono text-[10px]">.csv</Badge>
                <Badge variant="secondary" className="font-mono text-[10px]">.xlsx</Badge>
                <Badge variant="secondary" className="font-mono text-[10px]">.xls</Badge>
              </div>
              <Button className="gap-2" size="lg">
                <Upload className="w-4 h-4" />
                Choose File
              </Button>
            </div>
          </div>
        ) : (
          /* Tab Views */
          <div className="h-full animate-fade-in">
            {activeTab === 'table' && (
              <DataTableView data={filteredData} allData={state.rawData} columns={state.columns} />
            )}
            {activeTab === 'charts' && (
              <ChartsView data={filteredData} columns={state.columns} />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsView allData={state.rawData} columns={state.columns} />
            )}
            {activeTab === 'pivot' && (
              <PivotView data={filteredData} columns={state.columns} />
            )}
            {activeTab === 'cleaning' && (
              <CleaningView data={state.rawData} columns={state.columns} />
            )}
          </div>
        )}
      </main>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {/* Toast */}
      <Toast />

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[150] bg-[hsl(var(--primary)/0.05)] border-4 border-dashed border-[hsl(var(--primary))] pointer-events-none flex items-center justify-center">
          <div className="text-center">
            <Upload className="w-16 h-16 text-[hsl(var(--primary))] mx-auto mb-4" />
            <p className="text-xl font-semibold text-[hsl(var(--primary))]">Drop your file here</p>
          </div>
        </div>
      )}
    </div>
  );
}
