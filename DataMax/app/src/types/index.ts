export type DataType = 'number' | 'date' | 'text';

export interface Column {
  key: string;
  label: string;
  type: DataType;
  visible: boolean;
}

export interface DataRow {
  [key: string]: string | number | Date | null;
}

export interface SortState {
  col: string | null;
  dir: 'asc' | 'desc';
}

export interface FilterState {
  [colKey: string]: Set<string> | string;
}

export interface ColumnStats {
  column: string;
  type: DataType;
  count: number;
  missing: number;
  unique: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  q1?: number;
  q3?: number;
  skewness?: number;
  kurtosis?: number;
  range?: [Date, Date];
  topValues?: { value: string; count: number }[];
  distribution?: number[];
  binEdges?: number[];
}

export interface CorrelationResult {
  col1: string;
  col2: string;
  correlation: number;
  n: number;
}

export interface OutlierResult {
  rowIndex: number;
  column: string;
  value: number;
  lowerBound: number;
  upperBound: number;
  iqr: number;
}

export interface DuplicateResult {
  indices: number[];
  hash: string;
  count: number;
}

export interface AppState {
  rawData: DataRow[];
  columns: Column[];
  filters: FilterState;
  sort: SortState;
  search: string;
  page: number;
  pageSize: number;
  selectedCol: string | null;
  fileName: string;
  fileSize: string;
  activeTab: TabId;
  theme: 'light' | 'dark';
  toast: ToastMessage | null;
  selectedRows: Set<number>;
}

export type TabId = 'table' | 'charts' | 'analytics' | 'pivot' | 'cleaning';

export interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info';
}

export type ChartType = 'bar' | 'line' | 'area' | 'scatter' | 'pie' | 'histogram' | 'radar' | 'boxplot' | 'heatmap' | 'bubble';

export interface ChartConfig {
  type: ChartType;
  xColumn: string;
  yColumn: string;
  groupColumn?: string;
  colorColumn?: string;
  title?: string;
}

export interface PivotConfig {
  rowField: string;
  colField: string;
  valueField: string;
  aggFunc: 'sum' | 'mean' | 'count' | 'min' | 'max' | 'median';
}
