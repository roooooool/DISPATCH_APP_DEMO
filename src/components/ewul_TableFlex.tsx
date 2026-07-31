
// Allowed page size options
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500] as const;
export type TablePageSize = typeof TABLE_PAGE_SIZE_OPTIONS[number];
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ArrowUp, ArrowDown, ArrowUpDown, GripVertical,
  Search, X, Check, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Save, RotateCcw, Filter,
  Settings, Move, ListIcon, ListCollapseIcon
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
  verticalListSortingStrategy,
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

export interface DragDropSignalData {
  record: any;
  newIndex: number; // relative to list or group
  group: string | null;
  newOrder: any[];
}


export interface TableViewRef {
  expandAll: () => void;
  collapseAll: () => void;
  isAnyCollapsed: () => boolean;
  setArrangementMode: (enabled: boolean) => void;
  toggleArrangementMode: () => void;
}

export interface EmptyHintConfig {
  emptyMsg: string;
  suggestActionMsg?: string;
  onHintClick?: () => void;
}

export interface TableModuleConfig {
  table_config: ColumnConfig[];
  searchable_cols: string[];
  rowStyle?: (row: any) => React.CSSProperties;
  accordion?: accordionConfig | null
};

export interface accordionCountsConfig {
  label: string;
  countCondition: (row: any) => boolean;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'muted';
}

export interface accordionConfig {
  enabled: boolean;
  groupByCol: string;
  counts?: accordionCountsConfig[]; // <--- count config for dynamic counting
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
  orderSort?: number;
  preventNoSort?: boolean;
  filter?: FilterConfig | null;
  portion?: number;
  sticky?: boolean;
  calculate?: (row: any) => any;
  useCalculatedSort?: boolean;
  cellStyle?: (row: any) => React.CSSProperties;
  render?: (val: any, row: any, searchTerm: string, addTask?: (task: Omit<Task, 'id'>) => void, fontSize?: number) => React.ReactNode;
  defaultShow?: boolean;
  hidden?: boolean;
  noRender?: boolean;
}

export interface scrollToConfig {
  search_col: string;
  key: string | number;
  highlight: 'success' | 'warning' | 'info' | 'danger';
  target_col?: string;
};



interface TableViewProps {
  data: any[];
  rowKey?: string;
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
  highlightSelected?: boolean;
  storageKey?: string;
  baseUnit?: number;
  numberingWidth?: number;
  addTask?: (task: Omit<Task, 'id'>) => void;
  accordion?: accordionConfig | null;
  onAccordionChange?: (isAnyCollapsed: boolean) => void;
  // Drag n Drop additions
  onDragDrop?: (signal: DragDropSignalData) => void;
  isArrangementMode?: boolean;
  onArrangementModeChange?: (enabled: boolean) => void;
  showArrangeToggle?: boolean;
  onConfirmArrangement?: (confirmed: boolean, currentOrder: any[]) => void;
  emptyHint?: EmptyHintConfig;
  rowActionMode?: 'selection' | 'dragndrop';
  density?: 'tight' | 'normal' | 'relaxed';
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
  onTogglePreventNoSort: (key: string) => void,
  activeSorts: SortRule[],
  width: number,
  onResize: (id: string, newWidth: number) => void,
  styleOverride: React.CSSProperties,
  minWidth: number,
}>(({
  column, onSort, onTogglePreventNoSort, activeSorts, onResize, styleOverride, minWidth
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

  const isPreventNoSort = column.preventNoSort === true;
  const indicatorStyle = isPreventNoSort ? { color: 'var(--color-yellow)' } : {};

  return (
    <th
      ref={setCombinedRef}
      style={style}
      className={`sortable-header ${currentSort ? 'active-sort' : ''}`}
    >
      <div
        className="header-content"
        style={{
          minWidth: 0,
          overflow: 'hidden',
          paddingRight: '14px', // <-- Leaves a safe buffer so content doesn't slide under the resizer
          position: 'relative'
        }}
      >
        {/* DRAG HANDLE */}
        <div className="drag-handle" style={{ flexShrink: 0 }} {...attributes} {...listeners}>
          <GripVertical size={'var(--font-size-base)'} />
        </div>

        {/* CLICKABLE AREA WITH ELLIPSIS */}
        <div
          className="clickable-header-area"
          style={{ minWidth: 0, overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center' }}
          onClick={() => onSort(column.col)}
          onContextMenu={(e) => {
            e.preventDefault();
            onTogglePreventNoSort(column.col);
          }}
        >
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            flex: 1,
            minWidth: 0
          }}>
            {column.alias || column.col}
          </span>
          <span className="sort-icon-container" style={{ ...indicatorStyle, flexShrink: 0 }}>
            {currentSort ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {currentSort.dir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                {activeSorts.length > 1 && (
                  <span style={{ fontSize: '10px', color: 'var(--color-accent)', fontWeight: 'bold' }}>
                    {sortIndex + 1}
                  </span>
                )}
              </div>
            ) : (
              <ArrowUpDown size={14} className="dim-icon" />
            )}
          </span>
        </div>

        {/* RESIZER */}
        <div
          className="table-flex-col-resizer"
          style={{ flexShrink: 0, touchAction: 'none' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            handleResizeStart(e);
          }}
        />
      </div>
    </th>
  );
});

// --- SUB-COMPONENT: SORTABLE ROW COMPONENT ---
const SortableRow = ({
  id,
  row,
  renderRowContent,
  isArrangementMode,
  rowActionMode,
  className, // 1. Accept className here
  styleOverride,
  onMouseDown,
  onMouseUp,
  rowRef,
}: {
  id: string;
  row: any;
  renderRowContent: (row: any) => React.ReactNode;
  isArrangementMode: boolean;
  rowActionMode?: 'selection' | 'dragndrop';
  className?: string; // 2. Add type definition
  styleOverride?: React.CSSProperties; // <-- Add this
  onMouseDown?: (e: React.MouseEvent) => void; // <-- Add this
  onMouseUp?: (e: React.MouseEvent) => void;   // <-- Add this
  rowRef?: (node: HTMLTableRowElement | null) => void;
}) => {
  const isSortDisabled = isArrangementMode || rowActionMode === 'dragndrop';
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging
  } = useSortable({ id, disabled: !isArrangementMode });

  const style: React.CSSProperties = {
    // Only apply the transition if the item is NOT being dragged
    transition: isDragging ? 'none' : transition,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 120 : 'auto',
    position: isDragging ? 'relative' : 'initial',
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
    ...styleOverride
  };

  const setCombinedRef = (node: HTMLTableRowElement | null) => {
    setNodeRef(node);
    if (rowRef) rowRef(node);
  };

  // HTML5 Native Drag Handlers
  const handleNativeDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify(row));
    e.dataTransfer.effectAllowed = "move";
    // Optional: add a class indicator to the body or row for styling
    e.currentTarget.classList.add('is-native-dragging');
  };

  const handleNativeDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('is-native-dragging');
  };

  // Determine which attributes apply
  const nativeDragProps = rowActionMode === 'dragndrop' ? {
    draggable: true,
    onDragStart: handleNativeDragStart,
    onDragEnd: handleNativeDragEnd
  } : {};

  const dndKitProps = isArrangementMode ? { ...attributes, ...listeners } : {};

  return (
    <tr
      id={id}
      ref={setCombinedRef}
      style={style}
      className={`${className || ''} ${rowActionMode === 'dragndrop' ? 'native-draggable-row' : ''}`}
      onMouseDown={onMouseDown} // <-- Attach it here
      onMouseUp={onMouseUp}     // <-- Attach it here
      {...dndKitProps}
      {...nativeDragProps}
    >
      {renderRowContent(row)}
    </tr>
  );
};

// Set display name for easier debugging in dev tools
SortableHeader.displayName = 'SortableHeader';
SortableRow.displayName = 'SortableRow';

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

const TableView = React.forwardRef<TableViewRef, TableViewProps>(({
  data: rawData,
  rowKey,
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
  theme = 'var(--color-primary)',
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
  accordion,
  onAccordionChange,
  // DND additions
  onDragDrop,
  isArrangementMode: controlledArrangementMode,
  onArrangementModeChange,
  showArrangeToggle,
  onConfirmArrangement,
  emptyHint,
  rowActionMode,
  density,
}, ref) => {

  // Arrangement state fallbacks if parent does not pass controller values
  const [internalArrangementMode, setInternalArrangementMode] = useState(false);
  const isArrangement = controlledArrangementMode !== undefined ? controlledArrangementMode : internalArrangementMode;
  useEffect(() => {
    // If the parent toggles the arrangement mode off, clear the highlights
    if (!controlledArrangementMode) {
      setRepositionedRows([]);
    }
    setSelectedRows([]);
    setHighlightedRowId(null);
    setHighlightType(null);
  }, [controlledArrangementMode]);

  const toggleArrangement = () => {
    const nextMode = !isArrangement;
    if (onArrangementModeChange) {
      onArrangementModeChange(nextMode);
    } else {
      setInternalArrangementMode(nextMode);
    }
  };

  // Inside your TableView component body:
  const [showArrangementHint, setShowArrangementHint] = useState(false);
  const [isHintFading, setIsHintFading] = useState(false);
  const [isTableHovered, setIsTableHovered] = useState(false);

  // Main timer and arrangement trigger controller
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let fadeTimer: ReturnType<typeof setTimeout>;

    if (isArrangement && !isTableHovered) {
      setShowArrangementHint(true);
      setIsHintFading(false);

      // Keep it fully visible for 5 seconds, then trigger 1s fade out
      timer = setTimeout(() => {
        setIsHintFading(true);
        fadeTimer = setTimeout(() => {
          setShowArrangementHint(false);
          setIsHintFading(false);
        }, 1000); // Matches the 1s CSS fade-out duration
      }, 5000);
    } else {
      // Hide immediately if table is hovered or arrangement mode is disabled
      setShowArrangementHint(false);
      setIsHintFading(false);
    }

    return () => {
      clearTimeout(timer);
      clearTimeout(fadeTimer);
    };
  }, [isArrangement, isTableHovered]);

  React.useImperativeHandle(ref, () => ({
    expandAll: () => {
      setCollapsedGroups({});
      onAccordionChange?.(false);
    },
    collapseAll: () => {
      if (!accordion?.groupByCol || !paginatedData.length) return;
      const groupKey = encodeColumnName(accordion.groupByCol);
      const allGroups: Record<string, boolean> = {};
      paginatedData.forEach((row) => {
        const colConfig = columns.find(c => c.col === groupKey);
        const value = colConfig?.calculate ? colConfig.calculate(row) : (row[groupKey] ?? row[accordion.groupByCol]);
        const groupName = value !== null && value !== undefined && value !== '' ? String(value) : 'Unassigned';
        allGroups[groupName] = true;
      });
      setCollapsedGroups(allGroups);
      onAccordionChange?.(true);
    },
    isAnyCollapsed: () => Object.keys(collapsedGroups).length > 0,
    setArrangementMode: (enabled: boolean) => {
      if (onArrangementModeChange) onArrangementModeChange(enabled);
      else setInternalArrangementMode(enabled);
    },
    toggleArrangementMode: () => {
      toggleArrangement();
    }
  }));

  // Sensors Setup for distinct Column Headers Dnd vs Row Reordering Dnd
  const headerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const rowSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );


  const [isScrolledX, setIsScrolledX] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const accordionRefs = useRef<Record<string, HTMLDivElement | null>>({});
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

      const scrollLeft = tableScroll.scrollLeft;
      Object.values(accordionRefs.current).forEach(el => {
        if (el) {
          el.style.transform = `translateX(${scrollLeft}px)`;
        }
      });
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

  // Add this above your `data` useMemo
  const rowIdCache = useRef(new WeakMap<object, string>());

  // Replace your existing `data` useMemo with this updated version
  const data = useMemo(() => {
    return rawData.map((row, index) => {

      // 1. Check for explicit rowKey, uppercase ID, or lowercase id
      let stableId = (rowKey && row[rowKey])
        ? String(row[rowKey])
        : (row.ID ? String(row.ID) : (row.id ? String(row.id) : null));

      // 2. If no explicit ID is found, bind a persistent ID to the object reference
      if (!stableId) {
        if (!rowIdCache.current.has(row)) {
          // Generates a random stable string once per object
          rowIdCache.current.set(row, `gsdc-row-${Math.random().toString(36).substring(2, 11)}`);
        }
        stableId = rowIdCache.current.get(row)!;
      }

      return {
        ...row,
        _rowId: stableId,
        _rowIdx: index
      };
    });
  }, [rawData, rowKey]);

  const paddingMap = {
    tight: '6px 8px',
    normal: '14px 16px',
    relaxed: '20px 24px'
  };

  const [currentDensity, setCurrentDensity] = useState<keyof typeof paddingMap>(() => {
    if (storageKey) {
      const saved = getSavedLayout(storageKey);
      if (saved && typeof saved.density === 'string') {
        return saved.density as keyof typeof paddingMap;
      }
    }
    return density || 'tight';
  });

  const dynamicThemeVars = {
    '--table-theme': theme,
    '--table-gradient': themeGradient,
    '--table-hover': `${theme}0a`,
    '--table-theme-neon': increaseContrast(getHexFromCssVar(theme), 10),
    '--table-min-height': typeof tableMinHeight === 'number'
      ? `${tableMinHeight}px`
      : tableMinHeight,
    '--table-cell-padding': paddingMap[currentDensity]
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
      return saved.columns.map((c: any) => {
        const orig = initialConfig.find(origCol => origCol.col === (c.rawCol || c.col));
        return {
          ...orig,
          ...c,
          col: encodeColumnName(c.rawCol || c.col),
          hidden: c.hidden ?? (orig?.defaultShow === false)
        };
      });
    }
    return initialConfig.map(c => ({
      ...c,
      col: encodeColumnName(c.col),
      rawCol: c.col,
      hidden: c.defaultShow === false
    }));
  });
  const visibleColumns = useMemo(() => columns.filter(c => !c.hidden && !c.noRender), [columns]);
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

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const isAllGroupsCollapsed = Object.keys(collapsedGroups).length > 0;

  useEffect(() => {
    setCollapsedGroups({});
  }, [searchTerm, activeFilters]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => {
      const next = {
        ...prev,
        [groupName]: !prev[groupName]
      };

      // Calculate if anything is collapsed in the next state frame
      const isAnyCollapsedNow = Object.values(next).some(val => val === true);
      onAccordionChange?.(isAnyCollapsedNow);

      return next;
    });
  };


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

    return visibleColumns.reduce((acc, col) => {
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
  }, [visibleColumns, columnWidths, colMinWidth]);


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

  // const sensors = useSensors(
  //   useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  //   useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  // );


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
      initialSorts = initialConfig
        .filter(col => col.defaultSort)
        .sort((a, b) => {
          const orderA = a.orderSort ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.orderSort ?? Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        })
        .map(col => ({
          col: encodeColumnName(col.col),
          dir: col.defaultSort!
        }));
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

      // Find the original column configuration to check for preventNoSort
      const targetColConfig = columns.find(c => c.col === columnKey);
      const preventNoSort = targetColConfig?.preventNoSort ?? false;

      if (existingIndex > -1) {
        if (newSort[existingIndex].dir === 'asc') {
          // Toggle direction: asc -> desc
          newSort[existingIndex] = { ...newSort[existingIndex], dir: 'desc' };
        } else {
          // Current status is 'desc'
          if (preventNoSort) {
            // Cycle back to 'asc' instead of dropping the rule
            newSort[existingIndex] = { ...newSort[existingIndex], dir: 'asc' };
          } else {
            // Default behavior: drop sort rule from multiSort array
            newSort.splice(existingIndex, 1);
          }
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
  // SORT ENGINE WITH CALCULATED VALUE ROUTING
  const sortedData = useMemo(() => {
    if (multiSort.length === 0) return processedData;

    // PERFORMANCE OPTIMIZATION: Map columns once before launching array sort matrix
    const configMap = columns.reduce((acc, c) => {
      acc[c.col] = c;
      return acc;
    }, {} as Record<string, ColumnConfig>);

    return [...processedData].sort((a, b) => {
      for (const [i, { col, dir }] of multiSort.entries()) {
        const colConfig = configMap[col];
        const useCalcSort = colConfig?.useCalculatedSort ?? false;

        // Extract value via calculation rule if enabled, otherwise fall back to raw key registers
        let aVal = (useCalcSort && colConfig?.calculate)
          ? colConfig.calculate(a) // Passes true to let your function know it's sorting
          : (a[col] ?? a[(colConfig as any)?.rawCol]);

        let bVal = (useCalcSort && colConfig?.calculate)
          ? colConfig.calculate(b)
          : (b[col] ?? b[(colConfig as any)?.rawCol]);

        const aIsEmpty = aVal === null || aVal === undefined || aVal === '';
        const bIsEmpty = bVal === null || bVal === undefined || bVal === '';

        if (aIsEmpty && bIsEmpty) continue;

        if (aIsEmpty || bIsEmpty) {
          const shouldApplySortBlanks = multiSort.length === 1 || i > 0;
          if (shouldApplySortBlanks && sortBlanks) {
            const isAsc = dir === 'asc';
            return aIsEmpty ? (isAsc ? -1 : 1) : (isAsc ? 1 : -1);
          } else {
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
  }, [processedData, multiSort, sortBlanks, columns]); // Included columns dependency

  const groupedData = useMemo(() => {

    if (!accordion?.enabled || !accordion.groupByCol) {
      return [{
        group: null,
        rows: sortedData
      }];
    }

    const groupKey = encodeColumnName(accordion.groupByCol);

    const groups: {
      group: string;
      rows: any[];
    }[] = [];

    const lookup = new Map<string, any>();

    sortedData.forEach(row => {

      const colConfig = columns.find(c => c.col === groupKey);

      const value =
        colConfig?.calculate
          ? colConfig.calculate(row)
          : (row[groupKey] ?? row[accordion.groupByCol]);

      const groupName =
        value !== null &&
          value !== undefined &&
          value !== ''
          ? String(value)
          : 'Unassigned';

      if (!lookup.has(groupName)) {

        const obj = {
          group: groupName,
          rows: []
        };

        lookup.set(groupName, obj);

        groups.push(obj);
      }

      lookup.get(groupName).rows.push(row);

    });

    return groups;

  }, [sortedData, accordion, columns]);

  const paginatedGroups = useMemo(() => {

    const pages = [];

    let currentRows = 0;

    let currentPageGroups: any[] = [];

    groupedData.forEach(group => {

      if (
        currentRows > 0 &&
        currentRows + group.rows.length > pageSize
      ) {

        pages.push(currentPageGroups);

        currentPageGroups = [];
        currentRows = 0;
      }

      currentPageGroups.push(group);

      currentRows += group.rows.length;

    });

    if (currentPageGroups.length)
      pages.push(currentPageGroups);

    return pages;

  }, [groupedData, pageSize]);



  const totalPages = Math.max(1, paginatedGroups.length);

  // 🏛️ FIX 1: Provide a fallback to a globally stable empty array, not a fresh literal [] every time
  const EMPTY_ARRAY: any[] = [];
  const currentGroups = paginatedGroups[currentPage - 1] ?? EMPTY_ARRAY;

  // If paginatedGroups is computed inline upstream, you might also want to serialize or safely map g.rows
  const paginatedData = useMemo(() => {
    return currentGroups.flatMap(g => g.rows);
  }, [currentGroups]);

  const [disappearingIds, setDisappearingIds] = useState<string[]>([]);
  const [displayRows, setDisplayRows] = useState(paginatedData);

  useEffect(() => {
    // Find rows that exist locally but were removed from incoming data
    const removedRows = displayRows.filter(
      oldRow => !paginatedData.some(newRow => newRow._rowId === oldRow._rowId) && !disappearingIds.includes(oldRow._rowId)
    );

    if (removedRows.length > 0) {
      const newIds = removedRows.map(r => r._rowId);
      setDisappearingIds(prev => [...prev, ...newIds]);

      setTimeout(() => {
        setDisplayRows(paginatedData);
        setDisappearingIds(prev => prev.filter(id => !newIds.includes(id)));
      }, 350);
    } else {
      // 🏛️ FIX 2: Guard the state update! Only call it if the data values are actually different.
      const hasDataChanged =
        displayRows.length !== paginatedData.length ||
        displayRows.some((row, index) => row._rowId !== paginatedData[index]?._rowId);

      if (hasDataChanged) {
        setDisplayRows(paginatedData);
      }
    }
  }, [paginatedData, disappearingIds]); // Included disappearingIds to safely manage internal changes


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
    const encoded = initialConfig.map(c => ({ ...c, col: encodeColumnName(c.col), rawCol: c.col, hidden: c.defaultShow === false }));
    setColumns(encoded);
    setSortBlanks(false);

    // Set multiSort to defaults from initialConfig
    const initialSorts = initialConfig
      .filter(col => col.defaultSort)
      .sort((a, b) => {
        const orderA = a.orderSort ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.orderSort ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      })
      .map(col => ({
        col: encodeColumnName(col.col),
        dir: col.defaultSort!
      }));

    setMultiSort(initialSorts);

    setColumnWidths({});
    setActiveFilters({});
    setFontSizePercent(100);
    setCurrentDensity(density || 'normal');
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
        alias: c.alias,
        preventNoSort: c.preventNoSort,
        hidden: c.hidden
      })),
      widths: columnWidths,
      fontSizePercent,
      multiSort,
      sortBlanks,
      density: currentDensity,
      showNumbering: internalShowNumbering,
      showNativeDragGrip: showNativeDragGrip,
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

  const [internalShowNumbering, setInternalShowNumbering] = useState(() => {
    const saved = storageKey ? getSavedLayout(storageKey) : null;
    if (saved && typeof saved.showNumbering === 'boolean') {
      return saved.showNumbering;
    }
    return showNumbering; // Fallback to the prop[cite: 1]
  });

  const [showNativeDragGrip, setShowNativeDragGrip] = useState(() => {
    const saved = storageKey ? getSavedLayout(storageKey) : null;
    if (saved && typeof saved.showNativeDragGrip === 'boolean') {
      return saved.showNativeDragGrip;
    }
    return rowActionMode === 'dragndrop'; // Default to true if prop is active
  });


  // --- Calculate table width for top scrollbar ---
  const [tableWidth, setTableWidth] = useState<number>(0);
  useEffect(() => {
    const table = tableContainerRef.current?.querySelector('table');
    if (table) {
      setTableWidth(table.scrollWidth);
    }
  }, [columns, columnWidths, paginatedData, isLoading, isArrangement, isSelectionMode, internalShowNumbering]);


  const [repositionedRows, setRepositionedRows] = useState<string[]>([]);
  const handleRowDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Dynamic extraction logic matching your Accordion structures
    let targetGroup: string | null = null;
    let oldIndexWithinGroup = -1;
    let newIndexWithinGroup = -1;

    if (accordion?.enabled && accordion?.groupByCol) {
      const groupKey = encodeColumnName(accordion.groupByCol);

      // 1. Calculate active record's group context
      const activeRecord = paginatedData.find(r => r._rowId === activeId);
      if (activeRecord) {
        const colConfig = columns.find(c => c.col === groupKey);
        const val = colConfig?.calculate ? colConfig.calculate(activeRecord) : (activeRecord[groupKey] ?? activeRecord[accordion.groupByCol]);
        targetGroup = val !== null && val !== undefined && val !== '' ? String(val) : 'Unassigned';
      }

      // 2. Calculate over record's group context to verify boundary restrictions
      const overRecord = paginatedData.find(r => r._rowId === overId);
      if (overRecord) {
        const colConfig = columns.find(c => c.col === groupKey);
        const val = colConfig?.calculate ? colConfig.calculate(overRecord) : (overRecord[groupKey] ?? overRecord[accordion.groupByCol]);
        const overGroup = val !== null && val !== undefined && val !== '' ? String(val) : 'Unassigned';

        // If the drop destination belongs to a different group, block it and warn user
        if (overGroup !== targetGroup) {
          setBannerMsg("You cannot place this on other groups");
          return;
        }
      }

      // Filter contextual elements belonging strictly within this targeted boundary
      const boundaryRows = paginatedData.filter(row => {
        const colConfig = columns.find(c => c.col === groupKey);
        const val = colConfig?.calculate ? colConfig.calculate(row) : (row[groupKey] ?? row[accordion.groupByCol]);
        const currentGroup = val !== null && val !== undefined && val !== '' ? String(val) : 'Unassigned';
        return currentGroup === targetGroup;
      });

      oldIndexWithinGroup = boundaryRows.findIndex(r => r._rowId === activeId);
      newIndexWithinGroup = boundaryRows.findIndex(r => r._rowId === overId);

      if (onDragDrop && oldIndexWithinGroup !== -1 && newIndexWithinGroup !== -1) {
        const sortedBoundary = arrayMove(boundaryRows, oldIndexWithinGroup, newIndexWithinGroup);
        if (!repositionedRows.includes(activeId)) {
          setRepositionedRows(prev => [...prev, activeId]);
        }
        onDragDrop({
          record: activeRecord,
          newIndex: newIndexWithinGroup + 1, // Output human-readable order index 1-based
          group: targetGroup,
          newOrder: sortedBoundary
        });
      }
    } else {
      // Standard structural mapping flat arrays
      const oldIndex = paginatedData.findIndex(r => r._rowId === activeId);
      const newIndex = paginatedData.findIndex(r => r._rowId === overId);

      if (onDragDrop && oldIndex !== -1 && newIndex !== -1) {
        const reorderedSlice = arrayMove(paginatedData, oldIndex, newIndex);
        if (!repositionedRows.includes(activeId)) {
          setRepositionedRows(prev => [...prev, activeId]);
        }
        onDragDrop({
          record: paginatedData[oldIndex],
          newIndex: newIndex + 1,
          group: null,
          newOrder: reorderedSlice
        });
      }
    }
  };



  // Altered contents wrapper matching renderRow structure
  const renderRowContentElements = (row: any, rowIndex: number, groupIndex?: number, isSelected?: boolean) => {

    // 1. If inside an accordion group, use the isolated 1-based group index.
    // Otherwise, default to the page-absolute baseline index.
    const displayIndex = (groupIndex !== undefined)
      ? groupIndex + 1
      : (currentPage - 1) * pageSize + (rowIndex + 1);

    return (
      <>
        {isArrangement && (
          <td className="arrangement-grip-cell stop-propagation" style={{ width: '40px', minWidth: '40px' }}>
            <GripVertical size={16} className="grip-move-icon" />
          </td>
        )}

        {(rowActionMode === 'dragndrop' && showNativeDragGrip) && (
          <td className="native-grip-cell stop-propagation" style={{ width: '15px', minWidth: '15px', textAlign: 'center', cursor: 'grab', justifySelf: 'center' }}>
            <Move size={14} className="dim-icon" style={{ color: 'var(--table-theme)' }} />
          </td>
        )}

        {isSelectionMode && !isArrangement && (
          <td className="selection-cell" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="gsdc-checkbox"
              checked={isSelected}
              onChange={() => toggleRowSelection(row)}
            />
          </td>
        )}

        {internalShowNumbering && (
          <td className={`numbering-cell${isScrolledX ? ' numbering-blur' : ''}`} title={`${displayIndex}`}>
            {displayIndex}
          </td>
        )}

        {visibleColumns.map((column, colIndex) => {
          const cellValue = column.calculate ? column.calculate(row) : (row[column.col] ?? row[(column as any).rawCol]);
          const isSearchable = searchCol.length > 0 ? searchCol.includes((column as any).rawCol || column.col) : true;
          const conditionalStyle = column.cellStyle ? column.cellStyle(row) : {};
          const isSticky = columnStyles[column.col]?.position === 'sticky';

          return (
            <td key={colIndex} style={{ ...columnStyles[column.col], ...conditionalStyle }} className={`cell ${(isSticky && isScrolledX) ? 'cell-blur' : ''}`}>
              {column.render
                ? column.render(cellValue, row, searchTerm, addTask, (fontSizePercent / 100))
                : neonCell?.rowId === row._rowId && neonCell?.colKey === column.col ? (
                  <span className="text-glow-wrapper">
                    <HighlightText text={cellValue} highlight={searchTerm} isSearchable={isSearchable} />
                  </span>
                ) : (
                  <HighlightText text={cellValue} highlight={searchTerm} isSearchable={isSearchable} />
                )}
            </td>
          );
        })}
      </>
    );
  };

  // Replaces previous standalone dynamic tr tags setup inside mapping trees
  const renderRow = (row: any, rowIndex: number, groupIndex?: number) => {
    const isSelected = selectedRows.some(r => r._rowId === row._rowId);
    const isHighlighted = highlightedRowId === row._rowId;
    const isRepositioned = repositionedRows.includes(row._rowId);
    const isLeaving = disappearingIds.includes(row._rowId);

    const dynamicRowStyle = typeof rowStyle === 'function' ? rowStyle({ ...row, _idx: rowIndex }) : {};

    const highlightClass = [
      isHighlighted ? `highlight-row highlight-${highlightType || 'success'}` : '',
      isRepositioned ? 'row-repositioned' : '',
      isLeaving ? 'row-leaving' : ''
    ].filter(Boolean).join(' ');

    const handleMouseDown = (e: React.MouseEvent) => {
      if (isArrangement) return; // Allow dnd-kit sensors to drive actions completely
      mouseStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e: React.MouseEvent) => {
      if (isArrangement || (e.target as HTMLElement).closest('.stop-propagation')) return;
      const deltaX = Math.abs(e.clientX - mouseStartPos.current.x);
      const deltaY = Math.abs(e.clientY - mouseStartPos.current.y);
      if (deltaX > 5 || deltaY > 5) return;

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
      }
      if (onRowClick) onRowClick(row);
    };

    return (
      <SortableRow
        key={row._rowId}
        id={row._rowId}
        row={row}
        isArrangementMode={isArrangement}
        rowActionMode={rowActionMode}
        className={highlightClass}
        styleOverride={dynamicRowStyle}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        rowRef={(el) => { rowRefs.current[row._rowId] = el; }}
        renderRowContent={(r) => renderRowContentElements(r, rowIndex, groupIndex, isSelected)}
      />
    );
  };


  const toggleExpanCollapseAllGroup = () => {
    const isAnyCollapsedBefore = Object.keys(collapsedGroups).length > 0;

    const willBeAllCollapsed = !isAnyCollapsedBefore;

    if (isAnyCollapsedBefore) {
      setCollapsedGroups({});
    } else {
      if (!accordion?.groupByCol || !paginatedData.length) return;
      const groupKey = encodeColumnName(accordion.groupByCol);
      const allGroups: Record<string, boolean> = {};

      paginatedData.forEach((row) => {
        const colConfig = columns.find(c => c.col === groupKey);
        const value = colConfig?.calculate ? colConfig.calculate(row) : (row[groupKey] ?? row[accordion.groupByCol]);
        const groupName = value !== null && value !== undefined && value !== '' ? String(value) : 'Unassigned';
        allGroups[groupName] = true;
      });

      setCollapsedGroups(allGroups);
    }

    // Send the signal out to the parent component with the new status
    onAccordionChange?.(willBeAllCollapsed);
  };


  const handleTogglePreventNoSort = (columnKey: string) => {
    // 1. Find the target column to check its current state before updating
    const targetColumn = columns.find(col => col.col === columnKey);
    if (!targetColumn) return;

    const willBePreventNoSort = !targetColumn.preventNoSort;
    const currentSort = multiSort.find(s => s.col === columnKey);

    // 2. Update the columns configuration state
    setColumns(prevColumns =>
      prevColumns.map(col =>
        col.col === columnKey
          ? { ...col, preventNoSort: willBePreventNoSort }
          : col
      )
    );

    // 3. Handle sort side-effects based on the state transition
    if (willBePreventNoSort) {
      // Transition: false -> true
      // If it is NOT currently sorted as 'asc' or 'desc', trigger standard sort behavior (default to 'asc')
      if (!currentSort || (currentSort.dir !== 'asc' && currentSort.dir !== 'desc')) {
        handleSort(columnKey);
      }
    } else {
      // Transition: true -> false
      // Forcefully remove this column's sorting rule completely (set to "no sort")
      setMultiSort(prevRules => prevRules.filter(s => s.col !== columnKey));
    }
  };





  return (
    <div
      className={`table-view-master-container ${showBlockingLoading ? 'data-refreshing' : ''} ${isArrangement ? 'arrangement-active' : ''}`}
      ref={tableRef}
      style={dynamicThemeVars}
      onMouseEnter={() => setIsTableHovered(true)}
      onMouseLeave={() => setIsTableHovered(false)}
    >
      <div className="table-control-ribbon">
        <div className="ribbon-left-content">

          <div className="search-wrapper-gradient">
            <div className="search-inner-box">
              <Search size={16} className="text-slate-400" style={{ color: theme }} />
              <input type="text" placeholder="Search table..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="table-search-input" />
              {searchTerm && <X size={14} className="clear-search-btn" onClick={() => setSearchTerm('')} />}
            </div>
          </div>

          {accordion?.enabled && (
            <button
              onClick={toggleExpanCollapseAllGroup}
              className={`ribbon-accordion-btn ${!isAllGroupsCollapsed ? 'expanded' : ''}`}
              title={!isAllGroupsCollapsed ? "Collapse All Groups" : "Expand All Groups"}
            >
              <span className="ribbon-accordion-icon">
                {!isAllGroupsCollapsed ? (
                  <ListCollapseIcon size={16} className="stop-propagation" />
                ) : (
                  <ListIcon size={16} className="stop-propagation" />
                )}
              </span>
            </button>
          )}

          {/* ARRANGEMENT MODE TOGGLE BUTTON */}
          {(isArrangement && showArrangeToggle) && (
            <div className="arrangement-controls-group">
              {!isArrangement ? (
                <button
                  onClick={toggleArrangement}
                  className="action-btn mode-toggle-btn"
                  title="Switch to Arrangement Mode"
                  disabled={!showArrangeToggle}
                >
                  <Move size={16} className="btn-icon-primary" />
                  <span>Arrange Rows</span>
                </button>
              ) : (
                <>
                  {/* CONFIRM BUTTON */}
                  <button
                    onClick={() => {
                      // 1. Trigger fade-out animation class across rows
                      const rows = document.querySelectorAll('.row-repositioned');
                      rows.forEach(r => r.classList.add('is-confirming'));

                      setTimeout(() => {
                        if (onConfirmArrangement) {
                          onConfirmArrangement(true, paginatedData);
                        }
                        setRepositionedRows([]);
                        if (onArrangementModeChange) onArrangementModeChange(false);
                        else setInternalArrangementMode(false);
                      }, 2000); // Match this timeout to your CSS transition duration
                    }}
                    className="action-btn confirm-arrange-btn"
                    title="Confirm & Save Arrangement"
                  >
                    <Check size={16} />
                    <span>Confirm</span>
                  </button>

                  {/* CANCEL BUTTON */}
                  <button
                    onClick={() => {
                      // 1. Trigger reversion/fade-out animation class
                      const rows = document.querySelectorAll('.row-repositioned');
                      rows.forEach(r => r.classList.add('is-reverting'));

                      setTimeout(() => {
                        if (onConfirmArrangement) {
                          onConfirmArrangement(false, []);
                        }
                        setRepositionedRows([]);
                        if (onArrangementModeChange) onArrangementModeChange(false);
                        else setInternalArrangementMode(false);
                      }, 2000);
                    }}
                    className="action-btn cancel-arrange-btn"
                    title="Cancel Arrangement"
                  >
                    <X size={16} />
                    <span>Cancel</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* MULTI-SELECT CONTROL */}
          {!isArrangement && allowMultipleSelection && (
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
                  <X size={14} onClick={() => { clearAllSelections(); setIsSelectionMode(false); }} className="clear-selection-icon" />
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
                {visibleColumns.map(column => {
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
            className={`table-refresh-btn ${isRefreshing || isLoading ? 'spinning' : ''}`}
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

                {/* Show/Hide Columns section */}
                <div style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-bg)',
                  borderTop: '1px solid var(--color-bg)',
                  marginTop: 8,
                  marginBottom: 8,
                  maxHeight: '160px',
                  overflowY: 'auto'
                }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginBottom: '8px' }}>
                    Show/Hide Columns
                  </div>

                  {/* --- SYSTEM COLUMNS START --- */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}
                    onClick={() => setInternalShowNumbering(!internalShowNumbering)}
                  >
                    <input type="checkbox" checked={internalShowNumbering} readOnly style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', userSelect: 'none', fontStyle: 'italic' }}>Row Numbers (#)</span>
                  </div>

                  {/* 2. Arrangement Grip (Syncs with Ribbon Button) */}
                  {showArrangeToggle && (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}
                      onClick={() => toggleArrangement()}
                    >
                      <input type="checkbox" checked={isArrangement} readOnly style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                      <span style={{ fontSize: 'var(--font-size-sm)', userSelect: 'none', fontStyle: 'italic' }}>Arrangement Grip</span>
                    </div>
                  )}

                  {/* 3. Native Drag Grip */}
                  {rowActionMode === 'dragndrop' && (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}
                      onClick={() => setShowNativeDragGrip(!showNativeDragGrip)}
                    >
                      <input type="checkbox" checked={showNativeDragGrip} readOnly style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                      <span style={{ fontSize: 'var(--font-size-sm)', userSelect: 'none', fontStyle: 'italic' }}>Native Drag Grip</span>
                    </div>
                  )}

                  {/* 4. Selection Checkboxes (Syncs with Ribbon Button) */}
                  {allowMultipleSelection && (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}
                      onClick={() => {
                        setIsSelectionMode(!isSelectionMode);
                        if (isSelectionMode) clearAllSelections(); // Clear if turning off
                      }}
                    >
                      <input type="checkbox" checked={isSelectionMode} readOnly style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                      <span style={{ fontSize: 'var(--font-size-sm)', userSelect: 'none', fontStyle: 'italic' }}>Row Selection</span>
                    </div>
                  )}
                  {/* --- SYSTEM COLUMNS END --- */}

                  {columns.map((col) => {
                    if (col.noRender) return null; // <-- Skip noRender columns entirely

                    const colLabel = col.alias || col.col;
                    const isChecked = !col.hidden;
                    return (
                      <div
                        key={`show-hide-${col.col}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 0',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setColumns(prev => prev.map(c => c.col === col.col ? { ...c, hidden: !c.hidden } : c));
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => { }}
                          onClick={(e) => { e.stopPropagation(); setColumns(prev => prev.map(c => c.col === col.col ? { ...c, hidden: !c.hidden } : c)); }}
                          style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                        />
                        <span style={{ fontSize: 'var(--font-size-sm)', userSelect: 'none' }}>
                          {colLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>

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

                {/* NEW: Density Control Section */}
                <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-bg)', marginBottom: 8 }}>
                  <label style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', display: 'block', marginBottom: '8px' }}>
                    Row Spacing
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['tight', 'normal', 'relaxed'] as const).map(d => (
                      <button
                        key={d}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentDensity(d);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: currentDensity === d ? 600 : 400,
                          backgroundColor: currentDensity === d ? 'var(--color-primary)' : 'transparent',
                          color: currentDensity === d ? 'var(--color-bg)' : 'var(--color-primary)',
                          border: '1px solid var(--color-primary)',
                          borderRadius: '8px',
                          textTransform: 'capitalize',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

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
          <div style={{ width: tableWidth, height: '100%' }} />
        </div>
      )}

      {showArrangementHint && (
        <div className={`arrangement-mode-overlay ${isHintFading ? 'fade-out' : 'animate-fade-in'}`}>
          <div className="arrangement-hint-box">
            <div className="animated-hand-container">
              <GripVertical size={28} className="moving-hand-icon" />
              <span className="moving-arrow">→</span>
            </div>
            <p>Drag and Drop rows to arrange them.</p>
          </div>
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


        <DndContext sensors={rowSensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
          <table
            className="gsdc-reusable-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              display: 'table', // Ensure it stays as a table
              minWidth: 'fixed' // This tells the table to expand to fit its children's minWidths
            }}
          >
            <thead>
              <DndContext sensors={headerSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <tr>

                  {isArrangement && (
                    <th
                      style={{
                        width: '15px',
                        minWidth: '15px',
                      }}
                      className="stop-propagation arrangement-header-blank"
                    />
                  )}

                  {(rowActionMode === 'dragndrop' && showNativeDragGrip) && (
                    <th
                      style={{
                        width: '15px',
                        minWidth: '15px',
                      }}
                      className="stop-propagation arrangement-header-blank"
                    />
                  )}


                  {/* SELECTION HEADER */}
                  {isSelectionMode && (
                    <th className="selection-col-header" style={{ width: '15px', minWidth: '15px' }}>
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
                  {internalShowNumbering && (
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
                  <SortableContext key={visibleColumns.map(c => c.col).join(',')} items={visibleColumns.map(c => c.col)} strategy={horizontalListSortingStrategy}>

                    {visibleColumns.map((column) => (
                      <SortableHeader
                        key={column.col}
                        column={column}
                        onSort={handleSort}
                        onTogglePreventNoSort={handleTogglePreventNoSort}
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


              <SortableContext items={paginatedData.map(r => r._rowId)} strategy={verticalListSortingStrategy}>


                {(() => {
                  // 💡 FIX A: Check displayRows so the table doesn't turn invisible mid-fade
                  if (displayRows.length === 0) return null;

                  // 1. FLAT MODE: Render rows standard style if accordion is off
                  if (!accordion?.enabled || !accordion?.groupByCol) {
                    return displayRows.map((row, rowIndex) => renderRow(row, rowIndex));
                  }

                  // Calculate absolute column width for the span
                  const totalCols = visibleColumns.length + (isSelectionMode ? 1 : 0) + (internalShowNumbering ? 1 : 0) + (isArrangement ? 1 : 0);

                  // 2. ACCORDION MODE: Mapped from displayGroups instead of currentGroups
                  // This guarantees fading rows are still sorted into their proper headers!
                  return currentGroups.map((groupBlock: any) => {
                    const groupName = groupBlock.group ?? 'Unassigned';
                    const isCollapsed = !!collapsedGroups[groupName];

                    // 💡 FIX B: Hide the group header completely if all rows inside it have finished unmounting
                    if (!groupBlock.rows || groupBlock.rows.length === 0) return null;

                    return (
                      <React.Fragment key={`group-${groupName}`}>
                        {/* Accordion Separator Row */}
                        <tr className="table-group-header-row stop-propagation">
                          <td
                            colSpan={totalCols}
                            onClick={() => toggleGroup(groupName)}
                            className='accordion-cell'
                          >
                            <div
                              ref={el => {
                                accordionRefs.current[groupName] = el;
                              }}
                              className="table-group-header-content"
                            >
                              <span className={`group-chevron-icon ${isCollapsed ? 'collapsed' : ''}`}>
                                <ChevronRight size={16} />
                              </span>
                              <span className="table-group-header-title">{groupName}</span>

                              {/* NEW DYNAMIC COUNT LOGIC */}
                              <span className="table-group-header-count">
                                {accordion?.counts && accordion.counts.length > 0 ? (
                                  <>
                                    {/* Map through your custom tally conditions */}
                                    {accordion.counts.map((countConfig, idx) => {
                                      const matchedCount = groupBlock.rows.filter(countConfig.countCondition).length;

                                      // Hide the pill entirely if the count is 0
                                      // if (matchedCount === 0) return null;

                                      // Generate the dynamic color class or use default
                                      const colorClass = countConfig.color ? `tally-pill-${countConfig.color}` : 'tally-pill-default';

                                      return (
                                        <span key={idx} className={`tally-pill ${colorClass}`}>
                                          <span className="tally-label">{countConfig.label}:</span>
                                          <span className="tally-value">{matchedCount}</span>
                                        </span>
                                      );
                                    })}
                                  </>
                                ) : (
                                  // Fallback to default behavior if no counts config is provided
                                  <span className="tally-plain">({groupBlock.rows.length})</span>
                                )}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Render child records directly from the mapped group block */}
                        {groupBlock.rows.map((row: any, idx: number) => {
                          // renderRow dynamically appends '.row-leaving' via disappearingIds
                          const renderedRow = renderRow(row, row._rowIdx || idx, idx);

                          return React.cloneElement(renderedRow, {
                            className: `${renderedRow.props.className || ''} transitioning-group-row ${isCollapsed ? 'group-row-collapsed' : 'group-row-expanded'}`
                          });
                        })}
                      </React.Fragment>
                    );
                  });
                })()}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
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
});

export default TableView;