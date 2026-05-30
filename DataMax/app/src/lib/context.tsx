import { createContext, useContext, useReducer, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AppState, DataRow, Column, TabId, ToastMessage, FilterState } from '@/types';
import { getInitialTheme, setTheme } from './theme';

type Action =
  | { type: 'LOAD_DATA'; payload: { rows: DataRow[]; columns: Column[]; fileName: string; fileSize: string } }
  | { type: 'SET_COLUMNS'; payload: Column[] }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_SORT'; payload: { col: string | null; dir: 'asc' | 'desc' } }
  | { type: 'SET_FILTER'; payload: FilterState }
  | { type: 'ADD_FILTER'; payload: { col: string; value: Set<string> | string } }
  | { type: 'REMOVE_FILTER'; payload: string }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'SET_SELECTED_COL'; payload: string | null }
  | { type: 'SET_TAB'; payload: TabId }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_TOAST'; payload: ToastMessage | null }
  | { type: 'TOGGLE_ROW'; payload: number }
  | { type: 'SELECT_ALL_ROWS'; payload: Set<number> }
  | { type: 'CLEAR_ROW_SELECTION' }
  | { type: 'RESET' };

const initialState: AppState = {
  rawData: [],
  columns: [],
  filters: {},
  sort: { col: null, dir: 'asc' },
  search: '',
  page: 1,
  pageSize: 100,
  selectedCol: null,
  fileName: '',
  fileSize: '',
  activeTab: 'table',
  theme: getInitialTheme(),
  toast: null,
  selectedRows: new Set(),
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_DATA':
      return {
        ...state,
        rawData: action.payload.rows,
        columns: action.payload.columns,
        fileName: action.payload.fileName,
        fileSize: action.payload.fileSize,
        filters: {},
        sort: { col: null, dir: 'asc' },
        search: '',
        page: 1,
        selectedCol: null,
        selectedRows: new Set(),
      };
    case 'SET_COLUMNS':
      return { ...state, columns: action.payload };
    case 'SET_SEARCH':
      return { ...state, search: action.payload, page: 1 };
    case 'SET_SORT':
      return { ...state, sort: action.payload, page: 1 };
    case 'SET_FILTER':
      return { ...state, filters: action.payload, page: 1 };
    case 'ADD_FILTER':
      return {
        ...state,
        filters: { ...state.filters, [action.payload.col]: action.payload.value },
        page: 1,
      };
    case 'REMOVE_FILTER':
      const newFilters = { ...state.filters };
      delete newFilters[action.payload];
      return { ...state, filters: newFilters, page: 1 };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload, page: 1 };
    case 'SET_SELECTED_COL':
      return { ...state, selectedCol: action.payload };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'TOGGLE_THEME': {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      return { ...state, theme: newTheme };
    }
    case 'SET_TOAST':
      return { ...state, toast: action.payload };
    case 'TOGGLE_ROW': {
      const newSet = new Set(state.selectedRows);
      if (newSet.has(action.payload)) newSet.delete(action.payload);
      else newSet.add(action.payload);
      return { ...state, selectedRows: newSet };
    }
    case 'SELECT_ALL_ROWS':
      return { ...state, selectedRows: action.payload };
    case 'CLEAR_ROW_SELECTION':
      return { ...state, selectedRows: new Set() };
    case 'RESET':
      return { ...initialState, theme: state.theme };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Set initial theme on mount
  if (typeof window !== 'undefined') {
    setTheme(state.theme);
  }

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    dispatch({ type: 'SET_TOAST', payload: { message, type } });
    setTimeout(() => {
      dispatch({ type: 'SET_TOAST', payload: null });
    }, 3000);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, showToast }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
