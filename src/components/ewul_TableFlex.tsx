
// Allowed page size options
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500] as const;
export type TablePageSize = typeof TABLE_PAGE_SIZE_OPTIONS[number];
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  ArrowUp, ArrowDown, ArrowUpDown, GripVertical, 
  Search, X, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight , Save, RotateCcw, Filter,
  Settings
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './comp_css/ewul_TableFlex.css';
import { config } from 'maplibre-gl';
import AutoDismissBanner from './ewul_Banner';

//theme
import '../theme.css';

//UTILS
import { increaseContrast, getHexFromCssVar } from '../utils/colorUtils';
import type { Task } from '../utils/TaskWorkerContext';

export interface TableModuleConfig {
  table_config: ColumnConfig[];
  searchable_cols: string[];
  rowStyle?: (row: any) => React.CSSProperties;
};

export interface FilterOption {
  value: any;
  label?: string | null;
}

export interface FilterConfig {
  type: "dropdown" | "dropdown-multiple" | "radio" | "checkbox";
  options?: FilterOption[] | null;
  default?: any[] | null;
  useCalculatedValue?: boolean;
}

export interface ColumnConfig {
  col: string;
  alias?: string | null;
  sort?: 'asc' | 'desc' | null;
  defaultSort?: 'asc' | 'desc';
  filter?: FilterConfig | null;
  portion?: number;
  sticky?: boolean;
  calculate?: (row: any) => any;
  cellStyle?: (row: any) => React.CSSProperties;
  render?: (val: any, row: any, searchTerm: string, addTask?: (task: Omit<Task, 'id'>) => void, fontSize?: number) => React.ReactNode; 
}

export interface scrollToConfig {
  search_col: string;
  key: string | number;
  highlight: 'success' | 'warning' | 'info' | 'danger';
  target_col?: string;
};

interface TableViewProps {
  data: any[];
  config: ColumnConfig[];
  isLoading?: boolean;
  triggerScroll?: number;
  renderControlRibbon?: React.ReactNode;
  searchCol?: string[];
  showRowCount?: TablePageSize;
  pageSizeOptions?: readonly TablePageSize[];
  onSaveConfig?: (newConfig: ColumnConfig[]) => void;
  overflowX?: boolean; 
  overflowY?: boolean;
  maxHeight?: string | number;
  loadingNoPreventAction?: boolean;
  onRefresh?: (signal: boolean) => void;
  colMinWidth?: number;
  onCellClick?: (event: { clickedColumn: string; record: any }) => void;
  onRowClick?: (record: any) => void;
  allowMultipleSelection?: boolean;
  onSelectionChange?: (selectedRecords: any[]) => void;
  theme?: string; 
  themeGradient?: string;
  tableMinHeight?: string | number;
  rowStyle?: (row: any) => React.CSSProperties;
  showNumbering?: boolean;
  scrollTo?: scrollToConfig | null;
  highlightSelected?: boolean; // NEW PROP: highlight clicked row as success
  storageKey?: string;
  baseUnit?: number; // NEW PROP: base pixel unit for portion calculations
  numberingWidth?: number; // NEW PROP: width of the numbering column when showNumbering is true
  addTask?: (task: Omit<Task, 'id'>) => void;
}

export const encodeColumnName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_]|_(?=[xX])/g, (char) => {
    const hex = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `_x${hex}_`;
  });
};

// FILTER COMPONENT
const ColumnFilter = ({ 
    config, 
    data, 
    activeFilters, 
    onFilterChange 
  }: { 
    config: ColumnConfig, 
    data: any[], 
    activeFilters: any, 
    onFilterChange: (val: any) => void 
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [filterSearch, setFilterSearch] = useState("");

    

    // Generate options: Use provided or find distinct values in data
    const options = useMemo(() => {
      let baseOptions = config.filter?.options;
      if (!baseOptions) {
        const distinct = Array.from(new Set(data.map(item => item[config.col]))).filter(v => v !== null && v !== '');
        baseOptions = distinct.map(v => ({ value: v, label: String(v) }));
      }
      
      if (!filterSearch) return baseOptions;
      
      return baseOptions.filter(opt => 
        String(opt.label || opt.value).toLowerCase().includes(filterSearch.toLowerCase())
      );
    }, [config, data, filterSearch]);

    // Reset search when closing
    useEffect(() => {
      if (!isOpen) setFilterSearch("");
    }, [isOpen]);

    const currentVal = activeFilters[config.col] || (config.filter?.type.includes('multiple') || config.filter?.type === 'checkbox' ? [] : '');

    const toggleVal = (val: any) => {
      if (config.filter?.type === 'dropdown-multiple' || config.filter?.type === 'checkbox') {
        const next = currentVal.includes(val) ? currentVal.filter((v: any) => v !== val) : [...currentVal, val];
        onFilterChange(next);
      } else {
        onFilterChange(val === currentVal ? '' : val);
        setIsOpen(false);
      }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // If the menu is open and the click is NOT inside the dropdownRef
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        // Attach listener
        document.addEventListener('mousedown', handleClickOutside);
        
        // Clean up listener on unmount
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
      <div className="filter-wrapper" ref={dropdownRef}>
        <button 
          className={`filter-trigger ${currentVal.length > 0 || currentVal !== '' ? 'active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Filter size={12} />
        </button>

        {isOpen && (
          <div className="filter-dropdown-content animate-slide-down">
            {/* PINNED HEADER SECTION */}
            <div className="filter-sticky-header">
              <div className="filter-header">Filter {config.alias || config.col}</div>
              
              {/* Moved Clear Button here for visibility */}
              {(Array.isArray(currentVal) ? currentVal.length > 0 : currentVal !== '') && (
                <button 
                  className="clear-filter-link" 
                  onClick={() => { 
                    const resetVal = (config.filter?.type.includes('multiple') || config.filter?.type === 'checkbox') ? [] : '';
                    onFilterChange(resetVal); 
                    setIsOpen(false); 
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="filter-search-container">
              <Search size={14} className="search-icon-dim" />
              <input 
                type="text" 
                className="filter-search-input" 
                placeholder="Search options..." 
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                autoFocus
              />
              {filterSearch && <X size={12} className="clear-mini-search" onClick={() => setFilterSearch("")} />}
            </div>

            {/* SCROLLABLE LIST SECTION */}
            <div className="filter-options-list">
              {options.map((opt, i) => (
                <label key={i} className="table-filter-item">
                  <input 
                    type={config.filter?.type.includes('multiple') || config.filter?.type === 'checkbox' ? "checkbox" : "radio"}
                    checked={Array.isArray(currentVal) ? currentVal.includes(opt.value) : currentVal === opt.value}
                    onChange={() => toggleVal(opt.value)}
                  />
                  <span>{opt.label || opt.value}</span>
                </label>
              ))}
            </div>
          </div>
        )}

      </div>
    );
  };

// --- SUB-COMPONENT: SORTABLE & RESIZABLE HEADER ---
const SortableHeader = React.forwardRef<HTMLTableCellElement, { 
  column: ColumnConfig, 
  onSort: (key: string) => void, 
  activeSorts: SortRule[],
  width: number,
  onResize: (id: string, newWidth: number) => void,
  styleOverride: React.CSSProperties,
  minWidth: number,
}>(({ 
  column, onSort, activeSorts, onResize, styleOverride, minWidth 
}, ref) => {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging
  } = useSortable({ id: column.col });

  // Merge the dnd-kit ref and the external scroll ref
  const setCombinedRef = (element: HTMLTableCellElement | null) => {
    setNodeRef(element); 
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLTableCellElement | null>).current = element;
    }
  };

  const isSticky = styleOverride?.position === 'sticky';
  const style: React.CSSProperties = {
    ...styleOverride,
    transition, 
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isSticky ? 10 : (isDragging ? 10 : 5),
    cursor: isDragging ? 'grabbing' : 'auto',
    position: 'sticky',
    top: 0,
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const thElement = (e.currentTarget as HTMLElement).closest('th');
    const currentActualWidth = thElement?.offsetWidth || minWidth;
    const startX = e.pageX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const floor = Math.min(10, minWidth); 
      const newWidth = Math.max(floor, currentActualWidth + (moveEvent.pageX - startX));
      onResize(column.col, newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const currentSort = activeSorts.find(s => s.col === column.col);
  const sortIndex = activeSorts.findIndex(s => s.col === column.col);

  return (
    <th 
      ref={setCombinedRef} 
      style={style} 
      className={`sortable-header ${currentSort ? 'active-sort' : ''}`}
    >
      <div className="header-content">
        {/* DRAG HANDLE: Restored */}
        <div className="drag-handle" {...attributes} {...listeners}>
          <GripVertical size={'var(--font-size-base)'} />
        </div>

        {/* CLICKABLE AREA: Updated with Multi-Sort UI */}
        <div className="clickable-header-area" onClick={() => onSort(column.col)}>
          <span>{column.alias || column.col}</span>
          <span className="sort-icon-container">
            {currentSort ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {currentSort.dir === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}
                {activeSorts.length > 1 && (
                  <span style={{ 
                    fontSize: '10px', 
                    color: 'var(--color-accent)', // Your red accent
                    fontWeight: 'bold' 
                  }}>
                    {sortIndex + 1}
                  </span>
                )}
              </div>
            ) : (
              <ArrowUpDown size={14} className="dim-icon" />
            )}
          </span>
        </div>

        {/* RESIZER: Restored */}
        <div 
          className="col-resizer" 
          onMouseDown={(e) => {
            e.stopPropagation(); // Stop dnd-kit from seeing this as a potential drag
            handleResizeStart(e);
          }} 
          // Disable touch/drag defaults
          style={{ touchAction: 'none' }}
        />
      </div>
    </th>
  );
});

// Set display name for easier debugging in dev tools
SortableHeader.displayName = 'SortableHeader';

// --- HELPER UTILITIES (Move these here) ---
const getSavedLayout = (key: string) => {
  const saved = localStorage.getItem(`gsdc_table_${key}`);
  try {
    console.log("Loaded saved layout for key:", key, saved);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error("Failed to parse table config", e);
    return null;
  }
};

const saveLayout = (key: string, config: any) => {
  console.log("Saving layout for key:", key, config);
  localStorage.setItem(`gsdc_table_${key}`, JSON.stringify(config));
};

export const HighlightText = ({ text, highlight, isSearchable }: { text: any, highlight: string, isSearchable: boolean }) => {
    // 1. Force convert to string and handle nulls/undefined
    const stringText = text !== null && text !== undefined ? String(text) : '---';

    // Ignore non searchable columns
    if (!highlight.trim() || !isSearchable) {
      return <span>{stringText}</span>;
    }

    const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const parts = stringText.split(new RegExp(`(${escapedHighlight})`, 'gi'));

    return (
      <span>
        {parts.map((part, i) => (
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="search-highlight">{part}</mark>
          ) : (
            part
          )
        ))}
      </span>
    );
  };



interface SortRule {
  col: string;
  dir: 'asc' | 'desc';
}

// --- MAIN COMPONENT ---

const TableView: React.FC<TableViewProps> = ({ 
  data: rawData, 
  config: initialConfig, 
  isLoading, 
  triggerScroll, 
  renderControlRibbon, 
  searchCol = [], 
  showRowCount = TABLE_PAGE_SIZE_OPTIONS[0], 
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
  onSaveConfig,
  storageKey = null,
  overflowX = false,
  overflowY = false,
  maxHeight,
  loadingNoPreventAction = false,
  onRefresh,
  colMinWidth = 150,
  onRowClick,
  theme = 'var(--color-primary)', // Default Navy
  themeGradient = 'var(--loadbar-gradient)',
  allowMultipleSelection = false,
  onSelectionChange,
  tableMinHeight = 500,
  rowStyle = {},
  showNumbering = false,
  scrollTo = null,
  highlightSelected = false,
  baseUnit: BUn = 100,
  numberingWidth = 45,
  addTask,
}) => {
  const [isScrolledX, setIsScrolledX] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  // Track if user is actively dragging the fake scrollbar
  const mouseStartPos = useRef({ x: 0, y: 0 });
  const [isFakeScrollActive, setIsFakeScrollActive] = useState(false);
  const isDraggingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrollingRef = useRef(false);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [fontSizePercent, setFontSizePercent] = useState(() => {
    // Try to load from saved config if available
    if (storageKey) {
      const saved = getSavedLayout(storageKey);
      if (saved && typeof saved.fontSizePercent === 'number') {
        // Set CSS var immediately
        document.documentElement.style.setProperty('--table-font-size', `${saved.fontSizePercent / 100}rem`);
        return saved.fontSizePercent;
      }
    }
    return 100;
  });

  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableContainerRef.current;
    if (!topScroll || !tableScroll) return;
    topScroll.style.scrollBehavior = 'auto';

    const handleTopScroll = () => {
      // Sync Fake -> Table
      if (isDraggingRef.current) {
        tableScroll.scrollLeft = topScroll.scrollLeft;
      }
    };

    const handleTableScroll = () => {
      // 1. Mark that the table is actively moving
      if (!isScrollingRef.current) isScrollingRef.current = true;

      // 2. Clear the previous "stop" detection timer
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      
        if (!isDraggingRef.current && topScrollRef.current) {
          topScrollRef.current.scrollLeft = tableScroll.scrollLeft;
        }
    };

    const handleFakeMouseDown = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isDraggingRef.current = true;
      setIsFakeScrollActive(true);
      // Force auto scroll behavior during drag for 1:1 precision
      tableScroll.style.scrollBehavior = 'auto'; 
      
    };

    const handleFakeMouseUp = () => {
      // Return to smooth behavior for the slide
      tableScroll.style.scrollBehavior = 'smooth';

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      timeoutRef.current = setTimeout(() => {
        isDraggingRef.current = false;
        setIsFakeScrollActive(false);
        // Final snap sync
        //topScroll.scrollLeft = tableScroll.scrollLeft;
        //topScroll.style.scrollBehavior = 'smooth';
        timeoutRef.current = null;
      }, 500); // Reduced from 1500ms to be more responsive
    };

    topScroll.addEventListener('scroll', handleTopScroll);
    tableScroll.addEventListener('scroll', handleTableScroll, { passive: true });
    topScroll.addEventListener('mousedown', handleFakeMouseDown);
    window.addEventListener('mouseup', handleFakeMouseUp);

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableScroll.removeEventListener('scroll', handleTableScroll); // Fixed: was addEventListener
      topScroll.removeEventListener('mousedown', handleFakeMouseDown);
      window.removeEventListener('mouseup', handleFakeMouseUp);
      
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);


  // --- SCROLL TO & HIGHLIGHT LOGIC ---
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [highlightType, setHighlightType] = useState<'success' | 'warning' | 'info' | 'danger' | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [neonCell, setNeonCell] = useState<{ rowId: string, colKey: string } | null>(null);


  // Scroll to and highlight row/column when scrollTo changes
  useEffect(() => {
    if (scrollTo && scrollTo.search_col && scrollTo.key !== undefined && scrollTo.key !== null) {
      const encodedCol = encodeColumnName(scrollTo.search_col);
      
      // 1. Find index in sortedData
      const idx = sortedData.findIndex(row => row[encodedCol] === scrollTo.key);
      
      if (idx !== -1) {
        const page = Math.floor(idx / pageSize) + 1;
        setCurrentPage(page);
        setHighlightedRowId(sortedData[idx]._rowId);
        setHighlightType(scrollTo.highlight);
        setNeonCell({ rowId: sortedData[idx]._rowId, colKey: scrollTo.target_col ? scrollTo.target_col : '' });

        // 2. Wait for pagination to update and DOM to render
        setTimeout(() => {
          const rowRef = rowRefs.current[sortedData[idx]._rowId];
          const container = tableContainerRef.current;
          
          if (rowRef && container) {
            // Vertical Position
            const rowTop = rowRef.offsetTop;
            
            // Horizontal Position (Logic for target_col)
            let targetLeft = container.scrollLeft; // Stay where we are by default
            
            if (scrollTo.target_col) {
              // 1. Find the index of the current edited column
              const currentColIndex = columns.findIndex(c => c.col === scrollTo.target_col);
              
              // 2. Identify the "Previous" column (Index - 1)
              // We use Math.max(0, ...) to ensure we don't go below index 0
              const prevColIndex = Math.max(0, currentColIndex - 1);  
              const prevColKey = columns[prevColIndex].col;

              const targetHeader = headerRefs.current[prevColKey];
              
              if (targetHeader) {
                // 3. Get the left position of the previous column
                const offsetLeft = targetHeader.offsetLeft;

                // 4. Set the scroll position. 
                // We align to the start of the PREVIOUS column.
                // This pushes your actual edited column further toward the center/right.
                targetLeft = offsetLeft;
              }
            }

            // Execute combined scroll (no smooth behavior if fake scrollbar is active)
            container.scrollTo({
              top: rowTop - 150, // 150px offset so the row isn't hidden by the sticky header
              left: targetLeft,
              ...(isFakeScrollActive ? {} : { behavior: 'smooth' })
            });

            setTimeout(() => {
              setNeonCell(null);
            }, 800);
          }
        }, 200); // Slightly longer timeout to ensure the new page rows are in the DOM
      } else {
        setHighlightedRowId(null);
        setHighlightType(null);
      }
    } else {
      setHighlightedRowId(null);
      setHighlightType(null);
    }
    // eslint-disable-next-line
  }, [scrollTo]);

  const data = useMemo(() => {
    return rawData.map((row, index) => ({
      ...row,
      _rowId: row.ID ? String(row.ID) : `row-id-${index}`,
      _rowIdx: index
    }));
  }, [rawData]);

  const dynamicThemeVars = {
    '--table-theme': theme,
    '--table-gradient': themeGradient,
    '--table-hover': `${theme}0a`,
    '--table-theme-neon': increaseContrast(getHexFromCssVar(theme), 10),
    '--table-min-height': typeof tableMinHeight === 'number' 
      ? `${tableMinHeight}px` 
      : tableMinHeight
  } as React.CSSProperties;

  const showBlockingLoading = isLoading && !loadingNoPreventAction;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefreshClick = () => {
  if (onRefresh) {
        setIsRefreshing(true);
        onRefresh(true); // Send "true" signal to parent
        setTimeout(() => {
          setIsRefreshing(false);
          onRefresh(false); // Send "false" signal back
        }, 1000);
      }
  };
  const tableRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = storageKey ? getSavedLayout(storageKey) : null;
    if (saved?.columns) {
      // Re-encode and merge with initialConfig to ensure functions (like calculate) aren't lost
      return saved.columns.map((c: any) => ({
        ...initialConfig.find(orig => orig.col === (c.rawCol || c.col)),
        ...c,
        col: encodeColumnName(c.rawCol || c.col)
      }));
    }
    return initialConfig.map(c => ({ ...c, col: encodeColumnName(c.col), rawCol: c.col }));
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = storageKey ? getSavedLayout(storageKey) : null;
    return saved?.widths || {};
  });


  const headerRefs = useRef<{ [key: string]: HTMLTableCellElement | null }>({});
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  //const [sortCol, setSortCol] = useState<string | null>(null);
  //const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [sortBlanks, setSortBlanks] = useState<boolean>(false);
  const [multiSort, setMultiSort] = useState<SortRule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(showRowCount);

  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const containerStyle: React.CSSProperties = {
    overflowX: overflowX ? 'auto' : 'hidden',
    overflowY: overflowY ? 'auto' : 'hidden',
    maxHeight: overflowY
      ? (typeof maxHeight !== 'undefined' ? (typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight) : '100%')
      : 'none',
    position: 'relative'
  };

  const columnStyles = useMemo(() => {
    //const totalPortions = columns.reduce((sum, col) => sum + (col.portion || 0), 0);
    
    // We define a 'Base Unit' (e.g., 1 portion = 300px)
    // You can adjust this 'baseUnit' to make the table wider or narrower
    const baseUnit = BUn; 

    let stickyLeftOffset = 30;

    return columns.reduce((acc, col) => {
      const manualWidth = columnWidths[col.col];
      
      // Calculate the pixel floor based on your portion
      const portionMinWidth = col.portion ? col.portion * baseUnit : colMinWidth;
      let widthStyle: React.CSSProperties = {};

      if (manualWidth) {
        acc[col.col] = { 
          width: `${manualWidth}px`, 
          minWidth: `${manualWidth}px`,
          flex: '0 0 auto' 
        };
      } else {
        acc[col.col] = { 
          // We use flex-grow based on portion, but set a hard minWidth floor
          flex: `${col.portion || 1} 0 0%`,
          minWidth: `${portionMinWidth}px`,
          width: `${portionMinWidth}px`
        };
      }

      if (col.sticky) {
        widthStyle = {
          ...widthStyle,
          position: 'sticky',
          left: `${stickyLeftOffset}px`,
          top: 0,
        };

        // Increment the offset for the next sticky column
        stickyLeftOffset += manualWidth || portionMinWidth;
      }

      acc[col.col] = {
        ...acc[col.col],
        ...widthStyle
      };
      return acc;
    }, {} as Record<string, React.CSSProperties>);
  }, [columns, columnWidths, colMinWidth]);


  //TOGGLE FOR MULTI-SELECT
  const toggleRowSelection = (record: any) => {
    // Use the internal stable ID instead of the potentially missing .ID
    const recordKey = record._rowId || record.ID; 

    const isSelected = selectedRows.some(r => (r._rowId || r.ID) === recordKey);
    
    const nextSelection = isSelected 
      ? selectedRows.filter(r => (r._rowId || r.ID) !== recordKey) 
      : [...selectedRows, record];
    
    setSelectedRows(nextSelection);
    onSelectionChange?.(nextSelection);
  };

  const handleSelectAll = () => {
    const allInPageSelected = paginatedData.length > 0 && 
      paginatedData.every(row => selectedRows.some(r => r._rowId === row._rowId));
    
    let nextSelection;
    
    if (allInPageSelected) {
      nextSelection = selectedRows.filter(sRow => 
        !paginatedData.some(pRow => pRow._rowId === sRow._rowId)
      );
    } else {
      const newRows = paginatedData.filter(pRow => 
        !selectedRows.some(sRow => sRow._rowId === pRow._rowId)
      );
      nextSelection = [...selectedRows, ...newRows];
    }
    
    setSelectedRows(nextSelection);
    onSelectionChange?.(nextSelection);
  };

  const clearAllSelections = () => {
    setSelectedRows([]);
    onSelectionChange?.([]);
  };

  // CHECK FOR USER PREFERENCE SORT
  useEffect(() => {
    const newDefaults: Record<string, any> = {};
    
    initialConfig.forEach(col => {
      if (col.filter?.default && col.filter.default.length > 0) {
        const isMulti = col.filter.type.includes('multiple') || col.filter.type === 'checkbox';
        const encodedKey = encodeColumnName(col.col);
        newDefaults[encodedKey] = isMulti ? col.filter.default : col.filter.default[0];
      }
    });

    // DO NOT use (...prev) here if you want the parent to control the state.
    /*if (Object.keys(newDefaults).length > 0) {
      setActiveFilters(prev => ({ ...prev, ...newDefaults }));
    }*/
    // This overwrites the filters with exactly what the new config specifies.
    setActiveFilters(newDefaults); 
    
  }, [initialConfig]);

  // --- AUTO SCROLL LOGIC ---
  useEffect(() => {
    // If triggerScroll is a timestamp (e.g., Date.now()), 
    // it will be unique every time the user clicks 'Scroll'.
    if (triggerScroll && tableRef.current) {
      tableRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [triggerScroll]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  //COLUMN SYNC
  useEffect(() => {
    // 1. Set up columns (prefer saved layout if available)
    let saved = storageKey ? getSavedLayout(storageKey) : null;
    if (saved?.columns) {
      setColumns(saved.columns.map((c: any) => ({
        ...initialConfig.find(orig => orig.col === (c.rawCol || c.col)),
        ...c,
        col: encodeColumnName(c.rawCol || c.col)
      })));
    } else {
      const encoded = initialConfig.map(c => ({ ...c, col: encodeColumnName(c.col), rawCol: c.col }));
      setColumns(encoded);
    }

    // 2. Set up default filters
    const newDefaults: Record<string, any> = {};
    initialConfig.forEach(col => {
      if (col.filter?.default && col.filter.default.length > 0) {
        const isMulti = col.filter.type.includes('multiple') || col.filter.type === 'checkbox';
        const encodedKey = encodeColumnName(col.col);
        newDefaults[encodedKey] = isMulti ? col.filter.default : col.filter.default[0];
      }
    });
    setActiveFilters(newDefaults);

    // 3. Set up multi-column sort
    let initialSorts: SortRule[] = [];

    // Priority A: Load from saved layout
    if (saved?.multiSort && Array.isArray(saved.multiSort)) {
      initialSorts = saved.multiSort;
    } 
    // Priority B: Fallback to initialConfig defaults
    else {
      // Find all columns with defaultSort or sort specified
      initialConfig.forEach(col => {
        const dir = col.defaultSort || col.sort;
        if (dir) {
          initialSorts.push({
            col: encodeColumnName(col.col),
            dir: dir as 'asc' | 'desc'
          });
        }
      });
    }

    setMultiSort(initialSorts);

    if (saved && typeof saved.sortBlanks === 'boolean') {
      setSortBlanks(saved.sortBlanks);
    } else {
      setSortBlanks(false); // Default if no save exists
    }

  }, [initialConfig, config, storageKey]);

  // Update the pagination reset effect to watch multiSort instead of sortCol/sortDir
  useEffect(() => { 
    setCurrentPage(1); 
  }, [searchTerm, multiSort, initialConfig]);

  const handleColumnResize = (colId: string, newWidth: number) => {
    setColumnWidths(prev => ({ ...prev, [colId]: newWidth }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex((i) => i.col === active.id);
        const newIndex = items.findIndex((i) => i.col === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSort = (columnKey: string) => {
    setMultiSort(prev => {
      const existingIndex = prev.findIndex(s => s.col === columnKey);
      const newSort = [...prev];

      if (existingIndex > -1) {
        // Toggle direction: asc -> desc -> remove
        if (newSort[existingIndex].dir === 'asc') {
          newSort[existingIndex] = { ...newSort[existingIndex], dir: 'desc' };
        } else {
          newSort.splice(existingIndex, 1);
        }
        return newSort;
      } else {
        // Add new sort rule to the end of the priority list
        return [...newSort, { col: columnKey, dir: 'asc' }];
      }
    });
  };

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<number | null>(null);

  const handleScroll = () => {
    setIsScrolling(true);

    if (scrollTimeout.current) {
      window.clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = window.setTimeout(() => {
      setIsScrolling(false);
    }, 250);
  };


  // FILTER AND SEARCH
  const processedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    
    let filtered = data;

    // 1. Apply Column-Specific Filters
    Object.keys(activeFilters).forEach(colKey => {
      const filterVal = activeFilters[colKey];
      if (!filterVal || (Array.isArray(filterVal) && filterVal.length === 0)) return;

      // Find the config for this column to check filter settings
      const colConfig = columns.find(c => c.col === colKey);
      const useCalculated = colConfig?.filter?.useCalculatedValue ?? false;

      filtered = filtered.filter(row => {
        // Determine value to compare: Raw or Calculated
        const cellVal = (useCalculated && colConfig?.calculate) 
          ? colConfig.calculate(row) 
          : row[colKey];

        if (Array.isArray(filterVal)) {
          return filterVal.includes(cellVal);
        }
        return cellVal === filterVal;
      });
    });

    // 2. Apply Global Search (Stays the same or update similarly if needed)
    if (!searchTerm) return filtered;
    const lowerSearch = searchTerm.toLowerCase();
    const targetKeys = searchCol.length > 0 ? searchCol.map(c => encodeColumnName(c)) : columns.map(c => c.col);
    
    return filtered.filter(row => 
      targetKeys.some(key => {
          // Optional: Apply calculation logic to global search as well
          const colConfig = columns.find(c => c.col === key);
          const val = colConfig?.calculate ? colConfig.calculate(row) : row[key];
          return val && String(val).toLowerCase().includes(lowerSearch);
      })
    );
  }, [data, searchTerm, searchCol, columns, activeFilters]);


  //SORT
  const sortedData = useMemo(() => {
    if (multiSort.length === 0) return processedData;

    return [...processedData].sort((a, b) => {
      // Use .entries() to get the index (i) of the current sort rule
      for (const [i, { col, dir }] of multiSort.entries()) {
        let aVal = a[col];
        let bVal = b[col];

        const aIsEmpty = aVal === null || aVal === undefined || aVal === '';
        const bIsEmpty = bVal === null || bVal === undefined || bVal === '';

        if (aIsEmpty && bIsEmpty) continue; 

        if (aIsEmpty || bIsEmpty) {
          // Apply sortBlanks if it's the ONLY sort OR if it's not the primary sort
          const shouldApplySortBlanks = multiSort.length === 1 || i > 0;

          if (shouldApplySortBlanks && sortBlanks) {
            const isAsc = dir === 'asc';
            return aIsEmpty ? (isAsc ? -1 : 1) : (isAsc ? 1 : -1);
          } else {
            // Default: Always push blanks to the bottom
            return aIsEmpty ? 1 : -1;
          }
        }

        if (aVal !== bVal) {
          const isAsc = dir === 'asc';
          return isAsc ? (aVal > bVal ? 1 : -1) : (aVal > bVal ? -1 : 1);
        }
      }
      return 0;
    });
  }, [processedData, multiSort, sortBlanks]); // Ensure sortBlanks is in the dependency array

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // --- PAGE SAFETY SYNC ---
  useEffect(() => {
    // if current page is greater than the current data total pages
    console.log(`curr: ${currentPage}, tot: ${totalPages}`);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
      console.log(`curr set to: ${totalPages}`);
    } 
    // If the table becomes empty, reset to page 1
    else if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
      console.log(`curr set to: 1`);
    }
  }, [totalPages, currentPage]);

  // Banner state for feedback messages
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // RESET ARRANGEMENT
  const handleReset = (e: React.MouseEvent<HTMLButtonElement>) => {
    const encoded = initialConfig.map(c => ({ ...c, col: encodeColumnName(c.col), rawCol: c.col }));
    setColumns(encoded);
    setSortBlanks(false);
    
    // Set multiSort to defaults from initialConfig
    let initialSorts: SortRule[] = [];
    initialConfig.forEach(col => {
      const dir = col.defaultSort || col.sort;
      if (dir) {
        initialSorts.push({
          col: encodeColumnName(col.col),
          dir: dir as 'asc' | 'desc'
        });
      }
    });
    setMultiSort(initialSorts);
    
    setColumnWidths({});
    setActiveFilters({});
    setFontSizePercent(100);
    document.documentElement.style.setProperty('--table-font-size', `1rem`);
    // Remove saved config from localStorage if storageKey is set
    if (storageKey) {
      localStorage.removeItem(`gsdc_table_${storageKey}`);
    }
    setBannerMsg('Table layout restored to default.');
    e.currentTarget.blur();
  };

  // SAVE ARRANGEMENT
  const handleSave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    
    const layoutToSave = {
      columns: columns.map(c => ({
        col: c.col,
        rawCol: (c as any).rawCol,
        alias: c.alias
      })),
      widths: columnWidths,
      fontSizePercent,
      multiSort,
      sortBlanks
    };

    // 1. Save to LocalStorage if key exists
    if (storageKey) {
      saveLayout(storageKey, layoutToSave);
    }

    // 2. Call external save if provided
    if (onSaveConfig) {
      onSaveConfig(columns);
    }
    setBannerMsg('Table layout saved.');
    setShowConfig(false);
  };


  // --- Calculate table width for top scrollbar ---
  const [tableWidth, setTableWidth] = useState<number>(0);
  useEffect(() => {
    const table = tableContainerRef.current?.querySelector('table');
    if (table) {
      setTableWidth(table.scrollWidth);
    }
  }, [columns, columnWidths, paginatedData, isLoading]);




  return (
    <div className={`table-view-master-container ${showBlockingLoading ? 'data-refreshing' : ''}`} ref={tableRef} style={dynamicThemeVars}>
      <div className="table-control-ribbon">
        <div className="ribbon-left-content">

          <div className="search-wrapper-gradient">
            <div className="search-inner-box">
              <Search size={16} className="text-slate-400" style={{ color: theme }} />
              <input type="text" placeholder="Search table..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="table-search-input" />
              {searchTerm && <X size={14} className="clear-search-btn" onClick={() => setSearchTerm('')} />}
            </div>
          </div>

          {/* MULTI-SELECT CONTROL */}
          {allowMultipleSelection && (
            <div className="selection-controls">

              {!isSelectionMode && (
                <button 
                  className={`selection-toggle ${isSelectionMode ? 'active' : ''}`}
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    if (isSelectionMode) clearAllSelections();
                  }}
                  title="Enable Multi-Select"
                >
                  <div className={`toggle-pill ${isSelectionMode ? 'on' : ''}`} />
                  <span>Selection</span>
                </button>
              )}

              {isSelectionMode && (
                <div className="selection-count-chip animate-pop-in">
                  <span>{selectedRows.length} Selected</span>
                  <X size={14} onClick={() => { clearAllSelections(); setIsSelectionMode(false);} } className="clear-selection-icon" />
                </div>
              )}
            </div>
          )}

          {/* FILTER CONTROLS - Collapsible on small screens */}
          <div className='filter-controls'>
            <div
              className="filters-collapse-toggle"
              onClick={() => setFiltersOpen(v => !v)}
              style={{ display: 'none' }}
            >
              {filtersOpen ? 'Hide Filters' : 'Show Filters'}
            </div>
            {filtersOpen && (
              <div className="ribbon-filters-area">
                {columns.map(column => {
                  // Only show filter trigger if config exists for this column
                  if (!column.filter) return null;
                  return (
                    <div key={`ribbon-filter-${column.col}`} className="ribbon-table-filter-item">
                      <span className="ribbon-filter-label">{column.alias || column.col}</span>
                      <ColumnFilter 
                        config={column} 
                        data={data} 
                        activeFilters={activeFilters}
                        onFilterChange={(val) => setActiveFilters(prev => ({ ...prev, [column.col]: val }))}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FILTERED KEY LIST */}
          <div className="active-filters-ribbon">
            {Object.entries(activeFilters).map(([colKey, value]) => {
              //console.log(`Rendering filter chip for ${colKey} with value:`, value);
              if (!value || (Array.isArray(value) && value.length === 0)) return null;
              
              const colConfig = columns.find(c => c.col === colKey);
              const displayValue = Array.isArray(value) ? `${value.length}` : value;
              const hoverText = Array.isArray(value)
                    ? (value.length > 10 ? value.slice(0, 10).join(', ') + '...' : value.join(', '))
                    : value;

              return (
                
                <div key={colKey} className="filter-chip" onClick={() => setActiveFilters(prev => ({ ...prev, [colKey]: [] }))}>
                  <div className="chip-tooltip-wew">{hoverText}</div>
                  <span className="chip-label">{colConfig?.alias || colKey}:</span>
                  <span className="chip-value">{displayValue}</span>
                  <button 
                    className="chip-remove" 
                    onClick={() => setActiveFilters(prev => ({ ...prev, [colKey]: [] }))}
                  >
                    <X size={16} />
                  </button>

                </div>
              );
            })}
            
            {/* CLEAR ALL BUTTON */}
            {/*Object.values(activeFilters).some(v => 
              (Array.isArray(v) && v.length > 0) || 
              (!Array.isArray(v) && v !== undefined && v !== null && v !== '')
            ) && (
              <button className="clear-all-filters" onClick={() => setActiveFilters({})}>
                Reset Filters
              </button>
            )*/}
          </div>


          {renderControlRibbon}
        </div>

        <div className="ribbon-right-controls">

          {/* REFRESH BUTTON */}
          <button 
            className={`refresh-btn ${isRefreshing || isLoading ? 'spinning' : ''}`}
            onClick={handleRefreshClick}
            disabled={isLoading}
            title="Refresh Data"
            style={{ color: theme }}
          >
            <RotateCcw size={16} />
          </button>

          <div className="vertical-divider"></div>

          {/* ACTION BUTTONS */}
          <div className="table-config-wrapper">
            {/* GEAR BUTTON */}
            <button 
              className={`config-toggle-btn ${showConfig ? 'active' : ''}`}
              onClick={() => setShowConfig(!showConfig)}
              title="Table Settings"
              style={{ color: theme }}
            >
              <Settings size={16} className={showConfig ? 'spin-icon' : ''} />
            </button>

            {/* COLLAPSIBLE MENU */}
            {showConfig && (
              <div className="config-dropdown-menu animate-pop-in">
                <button className="action-item" onClick={(e) => { handleSave(e); setShowConfig(false); }}>
                  <Save size={16} />
                  <span>Save Config</span>
                </button>
                <button className="action-item" onClick={(e) => { handleReset(e); setShowConfig(false); }}>
                  <RotateCcw size={16} />
                  <span>Restore Default</span>
                </button>

                {/* NEW: Sort Blanks Checkbox Section */}
                <div style={{ 
                  padding: '4px 0', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  cursor: 'pointer'
                }}
                  onClick={() => setSortBlanks(!sortBlanks)} // Toggle when clicking the area
                >
                  <input
                    type="checkbox"
                    id="sortBlanksToggle"
                    checked={sortBlanks}
                    onChange={(e) => setSortBlanks(e.target.checked)}
                    onClick={(e) => e.stopPropagation()} // Prevent double-toggle from parent div
                    style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} // Using your navy blue
                  />
                  <label 
                    htmlFor="sortBlanksToggle" 
                    style={{ 
                      fontWeight: 600, 
                      fontSize: 'var(--font-size-base)', 
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Sort Blanks
                  </label>
                </div>

                <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-bg)', marginBottom: 8 }}>
                  <label style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>
                    Font Size: {fontSizePercent}%
                  </label>
                  <input
                    type="range"
                    className='gradient-font-size-slider'
                    min={60}
                    max={140}
                    step={5}
                    value={fontSizePercent}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setFontSizePercent(val);
                      // Set the CSS variable on the table container
                      document.documentElement.style.setProperty('--table-font-size', `${val / 100}rem`);
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                {(() => {
                  const saved = storageKey ? getSavedLayout(storageKey) : null;
                  return saved && (
                    <div style={{ cursor: 'default', marginTop: '8px', fontSize: 'var(--font-size-vsm)', color: theme, borderTop: `1px solid ${theme}33`, paddingTop: '8px' }}>
                      Using: {storageKey}
                    </div>
                  );
                })()}
                
              </div>
            )}
          </div>


          {/* PAGINATION */}
          <div className="pagination-compact">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronsLeft size={14} /></button>
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
            <div className="page-status">
              <input type="number" value={currentPage} onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 0 && val <= totalPages) {
                  setCurrentPage(val)
                } else if (val > totalPages) {
                  setCurrentPage(totalPages)
                };
              }} />
              <span>/ {totalPages}</span>
            </div>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}><ChevronRight size={14} /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={14} /></button>
          </div>

          <div className="vertical-divider"></div>

          {/* SHOW ROWS */}
          <div className="page-size-selector">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) as TablePageSize); setCurrentPage(1); }}>
              {pageSizeOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <span className="rows-label">Rows</span>
          </div>

        </div>

      </div>

      {/* TOP SYNCHRONIZED SCROLLBAR */}
      {overflowX && (
        <div
          ref={topScrollRef}
          className="table-top-scrollbar"
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            height: 'auto',
            width: '100%',
            marginBottom: 0,
            marginTop: 0,
            background: 'transparent',
            position: 'sticky',
            top: 0,
            zIndex: 5,
            minHeight: 12,
            cursor: 'grabbing'
          }}
        >
          <div style={{ width: tableWidth, height: '100%'}} />
        </div>
      )}
      <div
        className={`table-container-responsive ${overflowX ? 'is-scrollable-x' : 'is-fit-x'} ${isScrolling ? 'is-scrolling' : ''}`}
        style={{ ...containerStyle, overflowX: overflowX ? 'scroll' : 'hidden', paddingBottom: overflowX ? 0 : undefined }}
        onScroll={() => {
          handleScroll();
          if (tableContainerRef.current) {
            setIsScrolledX(tableContainerRef.current.scrollLeft > 0);
          }
        }}
        ref={tableContainerRef}
      >
        {isLoading && (
          <div className="table-top-loader">
            <div className="loader-progress-bar"></div>
          </div>
        )}
        
        <table 
          className="gsdc-reusable-table"
          style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            display: 'table', // Ensure it stays as a table
            minWidth: 'max-content' // This tells the table to expand to fit its children's minWidths
          }}
        >
          <thead>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <tr>

                {/* SELECTION HEADER */}
                {isSelectionMode && (
                  <th className="selection-col-header" style={{ width: '40px', minWidth: '40px' }}>
                    <div className="header-content justify-center">
                      <input 
                        type="checkbox" 
                        className="gsdc-checkbox"
                        checked={paginatedData.length > 0 && paginatedData.every(row => selectedRows.some(r => r._rowId === row._rowId))}
                        onChange={handleSelectAll}
                      />
                    </div>
                  </th>
                )}

                {/* # HEADER */}
                {showNumbering && (
                  <th className="numbering-header" 
                    style={{ 
                      width: `${numberingWidth}px`, 
                      minWidth: `${numberingWidth}px`, 
                      flex: `0 0 ${numberingWidth}px` // 0 0 means "don't grow, don't shrink"
                    }}
                  >
                    <div className="header-content justify-center">
                      <span>#</span>
                    </div>
                  </th>
                )}

                {/* DATA HEADER */}
                <SortableContext key={columns.map(c => c.col).join(',')} items={columns.map(c => c.col)} strategy={horizontalListSortingStrategy}>
                  
                    {columns.map((column) => (
                    <SortableHeader 
                        key={column.col} 
                        column={column} 
                        onSort={handleSort} 
                        activeSorts={multiSort}
                        width={columnWidths[column.col] || 60} 
                        onResize={handleColumnResize} 
                        styleOverride={columnStyles[column.col]}
                        minWidth={colMinWidth}
                        ref={(el: HTMLTableCellElement | null) => { 
                            headerRefs.current[column.col] = el; 
                        }}
                      />
                    ))}

                </SortableContext>
              </tr>
            </DndContext>
          </thead>
          <tbody>
            {isLoading && data.length === 0 ? (
              /* 1. SKELETON LOADING STATE */
              [...Array(5)].map((_, i) => (
                <tr key={i} className="skeleton-row">
                  {/* Add extra skeleton cell if selection is enabled */}
                  {isSelectionMode && (
                    <td className="selection-cell">
                      <div className="skeleton-cell mini"></div>
                    </td>
                  )}
                  {columns.map((_, j) => (
                    <td key={j}><div className="skeleton-cell"></div></td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              /* 2. EMPTY STATE */
              <tr>
                <td 
                  colSpan={isSelectionMode ? columns.length + 1 : columns.length} 
                  className="no-results"
                >
                  No records found.
                </td>
              </tr>
            ) : (

              /* 3. DATA RENDER */
              paginatedData.map((row, rowIndex) => {
                const isSelected = selectedRows.some(r => r._rowId === row._rowId);
                const absoluteIndex = (currentPage - 1) * pageSize + (rowIndex + 1);
                const dynamicRowStyle = typeof rowStyle === 'function' 
                  ? rowStyle({ ...row, _idx: rowIndex }) 
                  : {};
                

                // CUSTOME CLICK HANDLER TO PREVENT CLICK ON DRAG/SELECTION
                const handleMouseDown = (e: React.MouseEvent) => {
                  mouseStartPos.current = { x: e.clientX, y: e.clientY };
                };

                const handleMouseUp = (e: React.MouseEvent) => {
                  if ((e.target as HTMLElement).closest('.stop-propagation')) {
                    return;
                  }

                  const deltaX = Math.abs(e.clientX - mouseStartPos.current.x);
                  const deltaY = Math.abs(e.clientY - mouseStartPos.current.y);

                  // If moved more than 5px, it's a drag/selection; do nothing.
                  if (deltaX > 5 || deltaY > 5) return;

                  // ONCLICK LOGIC
                  if (isSelectionMode) {
                    toggleRowSelection(row);
                  } else if (highlightSelected) {
                    if (highlightedRowId === row._rowId) {
                      setHighlightedRowId(null);
                      setHighlightType(null);
                    } else {
                      setHighlightedRowId(row._rowId);
                      setHighlightType('success');
                    }
                  } else {
                    setHighlightedRowId(null);
                    setHighlightType(null);
                  }
                  
                  if (onRowClick) {
                    onRowClick(row);
                  }
                };

                // Attach ref for scroll/highlight
                return (
                  <tr
                    key={row.ID || rowIndex}
                    ref={el => { rowRefs.current[row._rowId] = el; }}
                    className={`table-row-interactive${isSelected ? ' row-selected' : ''}${highlightedRowId === row._rowId ? ` highlight-row highlight-${highlightType}` : ''}`}
                    style={dynamicRowStyle}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                  >
                    {/* SELECTION COLUMN CELL */}
                    {isSelectionMode && (
                      <td className="selection-cell" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="gsdc-checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(row)}
                        />
                      </td>
                    )}

                    {/* NUMBERING COLUMN */}
                    {showNumbering && (
                      <td 
                        className={`numbering-cell${isScrolledX ? ' numbering-blur' : ''}`}
                        title={`${absoluteIndex}`}
                      >
                        {absoluteIndex}
                      </td>
                    )}

                    {/* DATA COLUMN CELLS */}
                    {columns.map((column, colIndex) => {
                      const cellValue = column.calculate 
                        ? column.calculate(row) 
                        : (row[column.col] ?? row[(column as any).rawCol]);

                      const isSearchable = searchCol.length > 0 
                        ? searchCol.includes(column.col) 
                        : true;
                      
                      const conditionalStyle = column.cellStyle ? column.cellStyle(row) : {}; //CALCULATE CONDITIONAL FORMATTING
                      const isSticky = columnStyles[column.col]?.position === 'sticky';

                      return (
                        <td key={colIndex} style={{...columnStyles[column.col], ...conditionalStyle }} className={`cell ${(isSticky && isScrolledX) ? 'cell-blur' : ''}`}>
                          {column.render
                            ? column.render(cellValue, row, searchTerm, addTask, (fontSizePercent/100))
                            : (
                              neonCell?.rowId === row._rowId && neonCell?.colKey === column.col ? (
                                <span className={`text-glow-wrapper`}>
                                  <HighlightText 
                                    text={cellValue} 
                                    highlight={searchTerm} 
                                    isSearchable={isSearchable} 
                                  />
                                </span>
                              ) : (
                                <HighlightText 
                                  text={cellValue} 
                                  highlight={searchTerm} 
                                  isSearchable={isSearchable} 
                                />
                              )
                            )}
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


            {/** BANNER MESSAGE */}
            {bannerMsg && (
              <AutoDismissBanner 
                message={bannerMsg} 
                onClose={() => setBannerMsg(null)} 
                duration={2000}
              />
            )}
      
    </div>
  );
};

export default TableView;