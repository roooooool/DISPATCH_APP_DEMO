import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ClipboardList, ChevronDown, ChevronRight, CheckCircle2, Circle, RotateCw, Search, X, XCircle, FilterX} from 'lucide-react';
import './comp_css/ewul_TripTaskTracker.css';
import { ewulFetchAll, ewul_canFetch as canFetch, formatDate } from '../utils/Ewul_GSDC_Utils';
import Modal from './ewul_Modal';
import { TripTaskTrackerService } from '../generated/services/TripTaskTrackerService';
import {TripTaskEditorListService} from '../generated/services/TripTaskEditorListService';
import { FETCH_LOADING_KEYS, GSDC_NAVIGATE_TO_TRIP_key } from '../truth.config';


export interface TaskTrackerHandle {
  onRefresh: () => Promise<void>;
}

// Sub-component for each Trip Row
const TripTaskRow = ({ 
  data, 
  isExpandedAlready, 
  onToggle,
  onCloseModal,
  getEditorInfo,
}: { 
  data: any; 
  isExpandedAlready: boolean; 
  onToggle: () => void 
  onCloseModal: (open: boolean) => void,
  getEditorInfo: (oe: string, taskName: string) => any
}) => {

  // Safe JSON Parsing for TripJSON data context
  const parsedTripJSON = (() => {
    if (!data.TripJSON) return null;
    if (typeof data.TripJSON === 'object') return data.TripJSON;
    try {
      return JSON.parse(data.TripJSON);
    } catch (e) {
      console.error("Failed to parse TripJSON for OE:", data.OE, e);
      return null;
    }
  })();

  const sourceName = parsedTripJSON?.SourceName || '';
  const cementType = parsedTripJSON?.CementType || '';

  // Evaluate exemption rule matching SQL: LIKE conditions & exact match logic
  const isExemptedFromATW_SO = (() => {
    const keywords = ['GNPOWER', 'GMEC', 'SEM-CALACA', 'SEM CAL', 'APEC', 'UPPC'];
    const upperSourceName = sourceName.toUpperCase();
    
    const matchesSource = keywords.some(keyword => upperSourceName.includes(keyword));
    const matchesCement = cementType.toLowerCase() === 'limestone';

    return matchesSource || matchesCement;
  })();

  // Define the bits to track based on your schema
  const allTasks = [
    { label: 'Assigned Unit', status: data.AssignedUnit, progress: 'Assigned', key: 'AssignedUnit' },
    { label: 'Assigned Driver', status: data.AssignedDriver, progress: 'Assigned', key: 'AssignedDriver' },
    { label: 'ATW Document', status: data.HasATW, progress: 'Assigned', key: 'HasATW', isExemptible: true },
    { label: 'Sales Order', status: data.HasSO, progress: 'Assigned', key: 'HasSO', isExemptible: true },
    { label: 'Fuel Request', status: data.HasFuelRequest, progress: 'Assigned', key: 'HasFuelRequest' },
    { label: 'Fuel PO', status: data.HasFuelPO, progress: 'Assigned', key: 'HasFuelPO', invalidStatus: data.HasFuelDisapproved, invalidMessage: 'Fuel has been Disapproved.' },
  ];

  const tasks = isExemptedFromATW_SO 
    ? allTasks.filter(task => !task.isExemptible) 
    : allTasks;

  const filteredTasks = tasks.filter(t => t.progress === data.TripProgress || !t.status)
  const taskTotalCount = filteredTasks.length;
  const completedCount = filteredTasks.filter(t => t.status).length;

  const latestEditor = tasks
    .filter(task => task.status) // Only look at completed tasks
    .map(task => getEditorInfo(data.OE, task.key)) // Get editor info for each
    .filter(info => info) // Filter out any nulls
    .sort((a, b) => b.rawTime - a.rawTime) // Sort by timestamp descending
    [0]; // Get the most recent one

  return (
    <div className="trip-cascade-item">
      <div 
        className={`trip-cascade-header ${isExpandedAlready ? 'expanded' : ''} ${completedCount === taskTotalCount ? 'fully-complete' : ''}`} 
        onClick={onToggle} 
      >
        {/* NEW: Progress bar background tracker */}
        <div className="header-progress-container">
          <div 
            className="header-progress-fill" 
            style={{ width: `${(completedCount / taskTotalCount) * 100}%` }}
          ></div>
        </div>

        <div className="header-left">
          {isExpandedAlready ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <span className="trip-oe-text">{data.OE}</span>
          <span className="trip-progress-pill">{data.TripProgress}</span>
        </div>
        
        <div className="header-right">
          {latestEditor && (
            <span className="latest-editor-badge">
              {latestEditor.name}
            </span>
          )}
          {completedCount === taskTotalCount && (<span className="completion-date">Completed: 
            {formatDate(data.LastUpdated, {
                format: {
                  month: 'numeric',   // m
                  day: '2-digit',     // dd
                  year: '2-digit',    // yy
                  hour: 'numeric',    // H
                  minute: '2-digit',  // mm
                  hour12: true       // Forces 24-hour format
                }
              })}
          </span>)}
          <span className="completion-duration">{(() => {
              const duration = formatDate(data.TaggedDate?.replace('Z',''), {mode: 'duration', compareTo: completedCount === taskTotalCount ? data.LastUpdated?.replace('Z','') : new Date() })
              return completedCount === taskTotalCount ? duration.replace(' ago','') : duration;
            })()}
          </span>
          <span className="completion-stats">({completedCount} / {taskTotalCount})</span>
          <button 
            className="go-to-trip-btn"
            onClick={(e) => {
              e.stopPropagation(); // Prevent the row from collapsing/expanding
              const event = new CustomEvent(GSDC_NAVIGATE_TO_TRIP_key, { 
                detail: { oe: data.OE } 
              });
              window.dispatchEvent(event);
              onCloseModal(false);
            }}
          >
            Go To 
          </button>
        </div>
      </div>

      {/* NEW: Use a wrapper for the transition instead of {isExpanded && ...} */}
      <div className={`trip-cascade-transition-wrapper ${isExpandedAlready ? 'is-open' : ''}`}>
        <div className="trip-cascade-content">
          {filteredTasks.map((task, idx) => {
            const isInvalid = task.invalidStatus === true || task.invalidStatus === 1;
            const isMissed = task.progress !== data.TripProgress;
            const isDone = task.status === true || task.status === 1;

            return (
              <div 
                key={idx} 
                className={`task-sub-item ${isInvalid ? 'invalid': isMissed ? 'missed' : isDone ? 'done' : ''}`}
              >
                {/* Icon Logic */}
                {isInvalid ? (
                  <XCircle size={14} className="icon-invalid" />
                ) : isMissed ? (
                  <Circle size={14} className="icon-missed" />
                ) : isDone ? (
                  <CheckCircle2 size={14} className="icon-done" />
                ) : (
                  <Circle size={14} className="icon-pending" />
                )}

                {/* Label */}
                <span className="task-label">{task.label}</span>
                
                {/* Status Tags and Custom Invalid Message */}
                {isInvalid ? (
                  <>
                    {/*<span className="invalid-tag">(Disapproved)</span>*/}
                    {task.invalidMessage && (
                      <span className="task-error-message">
                        {task.invalidMessage}
                      </span>
                    )}
                  </>
                ) : isMissed ? (
                  <span className="task-missing-message">
                    Missing from Previous Task
                  </span>
                )  : isDone ? (
                  <span className="task-done-message">
                    {(() => {
                      const info = getEditorInfo(data.OE, task.key); // Use the key we'll add below
                      return info 
                        ? `Completed by ${info.name} at ${info.time}` 
                        : 'Completed';
                    })()}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TaskTracker = forwardRef<TaskTrackerHandle, {}>((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [taskList, setTaskList] = useState<any[]>([]);
  const [editorMap, setEditorMap] = useState<Map<string, any>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filterTabs = [
    {label: "All", value: "All"}, 
    {label: "Assigned", value: "Assigned"}, 
    {label: "To Source", value: "Dispatched To Source"}, 
    {label: "To Destination", value: "Dispatched To Destination"},
    {label: "Done", value: "Done"}, 
    {label: "Documented", value: "Documented"}
  ];

  const [pendingTasksFilter, setPendingTasksFilter] = useState<string[]>([]);
  // const [isTaskFilterOpen, setIsTaskFilterOpen] = useState(false);

  const taskOptions = [
    { label: 'Unit', key: 'AssignedUnit' },
    { label: 'Driver', key: 'AssignedDriver' },
    { label: 'ATW', key: 'HasATW' },
    { label: 'SO', key: 'HasSO' },
    { label: 'Fuel Req', key: 'HasFuelRequest' },
    { label: 'Fuel PO', key: 'HasFuelPO' },
  ];

  const toggleTaskFilter = (key: string) => {
    setPendingTasksFilter(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // NEW: Store expanded OEs in a Set
  const [expandedOEs, setExpandedOEs] = useState<Set<string>>(new Set());

  const toggleRow = (oe: string) => {
    setExpandedOEs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(oe)) {
        newSet.delete(oe);
      } else {
        newSet.add(oe);
      }
      return newSet;
    });
  };

  const toggleModal = () => setIsOpen(!isOpen);

  const fetchTasks = useCallback(async (isManualRefresh: boolean = false) => {
    if (!canFetch(FETCH_LOADING_KEYS.fetchTripTaskLists)) return;

    console.log("Fetching tasks with isManualRefresh =", isManualRefresh);

    // Determine timestamp - if manual refresh, we set to 0 to bypass delta logic
    const latestTimestamp = !isManualRefresh && taskList.length > 0 
      ? Math.max(...taskList.map(t => t.LastUpdatedAsInt || 0)) 
      : 0;

    const odataFilter = latestTimestamp > 0 
      ? `LastUpdatedAsInt gt ${latestTimestamp}` 
      : '';
    const editorFilter = latestTimestamp > 0 
      ? `TimestampAsInt gt ${latestTimestamp}` 
      : '';

    const result = await ewulFetchAll<any>(
      TripTaskTrackerService,
      { filter: odataFilter, orderBy: ["LastUpdatedAsInt desc"], top: 500 },
      500,
      'OE'
    );

    const resultEditor = await ewulFetchAll<any>(
      TripTaskEditorListService,
      { filter: editorFilter, orderBy: ["TimestampAsInt desc"], top: 500 },
      500
    );


    if (result && result.length > 0) {
      setTaskList(prevList => {
        if (isManualRefresh) return result; // Full replace on manual refresh

        const taskMap = new Map();
        prevList.forEach(task => taskMap.set(task.OE, task));
        result.forEach(task => taskMap.set(task.OE, task));
        return Array.from(taskMap.values()).sort((a, b) => b.LastUpdatedAsInt - a.LastUpdatedAsInt);
      });
    }

    if (resultEditor && resultEditor.length > 0) {
      setEditorMap(prevMap => {
        // Create a new Map instance to trigger a React re-render
        const newMap = new Map(prevMap);
        
        resultEditor.forEach(ed => {
          newMap.set(`${ed.OE}_${ed.Task}`, ed);
        });
        
        return newMap;
      });
      // console.log("Editor Map Entries:", Array.from(editorMap.entries()));
    }


  }, [taskList]);

  const filteredTasks = taskList.filter(trip => {
    const matchesTab = activeFilter === "All" || trip.TripProgress === activeFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch = trip.OE.toLowerCase().includes(query);

    // If no filters, all tasks match
    if (pendingTasksFilter.length === 0) {
      return matchesTab && matchesSearch;
    }

    // Handle the special case for "Fuel PO (w/ Req)" when it's the only filter
    if (pendingTasksFilter.length === 1 && pendingTasksFilter[0] === 'HasFuelPO') {
      const matchesPending = trip.HasFuelRequest && !trip.HasFuelPO;
      return matchesTab && matchesSearch && matchesPending;
    }

    // For multiple filters, check if the trip is missing ANY of the selected tasks
    const matchesPendingTasks = pendingTasksFilter.some(taskKey => !trip[taskKey]);

    return matchesTab && matchesSearch && matchesPendingTasks;
  });

  const getTaskEditorInfo = useCallback((oe: string, taskName: string) => {
    const key = `${oe}_${taskName}`;
    // console.log(`Looking up editor info for key: ${key}`);
    const editor = editorMap.get(key); // Instant lookup
    // console.log(`Editor info found:`, editor);
    
    if (!editor) return null;

    return {
      name: editor.Name,
      time: new Date(editor.Timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      rawTime: new Date(editor.Timestamp).getTime() // Add raw timestamp for sorting
    };
  }, [editorMap]);

  useImperativeHandle(ref, () => ({
    onRefresh: async () => {
      console.log("Manual refresh triggered by parent...");
      await fetchTasks(true); // Call with true to ignore the filter
    }
  }));

  useEffect(() => {
    fetchTasks();

    const intervalId = setInterval(() => {
      fetchTasks();
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);


  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchTasks(true); // Trigger the full fetch without filter
    setIsRefreshing(false);
  };

  return (


    <div className="task-tracker-container">
      <button 
        className={`tracker-icon-btn ${isOpen ? 'active' : ''}`} 
        onClick={toggleModal}
        title="View Task Manager"
      >
        <div className="nav-icon-button">
          <ClipboardList size={24} />
          {taskList.length > 0 && (
            <span className="notification-badge">
              {taskList.length > 99 ? '99+' : taskList.length}
            </span>
          )}
        </div>

      </button>

      {isOpen && (
        <Modal 
          onClose={toggleModal} 
          width="60%" 
          overlayBlur={3}
          contentClassName="tracker-modal-theme"
          contentStyle={{padding: '0px'}}
        >
          <div className="task-tracker-wrapper">
            {/* Professional Task Manager Header */}
            <div className="task-manager-banner">
              <div className="banner-main">
                <div className="icon-badge">
                  <ClipboardList size={'var(--font-size-vlg)'} color="white" />
                </div>
                <div className="title-group">
                  <h2>Trip Tasks</h2>
                  <p className="subtitle">Real-time pending task tracking for active trips</p>
                </div>
              </div>
              {/* <div className="banner-stats">
                <div className="stat-item">
                  <span className="stat-value">{taskList.length}</span>
                  <span className="stat-label">On Going Trips</span>
                </div>
              </div> */}
            </div>

            {/* Status & Sync Info Bar */}
            <div className="task-status-bar">
              <div className="sync-info">
                <div className="pulse-dot"></div>
                <span>Live Sync Active</span>
              </div>

              <div className="last-updated-text">
                {/* NEW REFRESH BUTTON */}
                <button 
                  className={`manual-refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  title="Force Refresh All"
                >
                  <RotateCw size={14} />
                </button>

                Last checked: {new Date().toLocaleTimeString()}
              </div>
            </div>

            <div className="task-manager-layout">
              <div className="task-filter-tabs">
                <div className="sidebar-label" style={{ padding: '10px', fontSize: 'var(--font-size-sm)', color: 'var(--color-muted)', fontWeight: 'bold' }}>
                  FILTER TASKS
                </div>
                {taskOptions.map(opt => {
                  const isSelected = pendingTasksFilter.includes(opt.key);
                  const isFuelReqActive = pendingTasksFilter.includes('HasFuelRequest');

                  // Determine the label for Fuel PO
                  let displayLabel = opt.label;
                  if (opt.key === 'HasFuelPO') {
                    displayLabel = isFuelReqActive ? 'Fuel PO' : 'Fuel PO (w/ Req)';
                  }
                  
                  // Count of trips where this task is NOT done
                  let count = 0;
                  if (opt.key === 'HasFuelPO') {
                    // Special logic for Fuel PO: count only if Fuel Req exists but PO doesn't
                    count = taskList.filter(t => t.HasFuelRequest && !t.HasFuelPO).length;
                  } else {
                    count = taskList.filter(t => !t[opt.key]).length;
                  }

                  return (
                    <button
                      key={opt.key}
                      className={`filter-tab-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => toggleTaskFilter(opt.key)}
                    >
                      {displayLabel}
                      <span className={`tab-count ${count > 0 ? '' : 'hide'}`}>{count}</span>
                    </button>
                  );
                })}
                {pendingTasksFilter.length > 0 && (
                  <button 
                    className="filter-tab-btn clear-all" 
                    onClick={() => setPendingTasksFilter([])}
                    style={{ 
                      marginBottom: 'auto', 
                      background: 'var(--color-accent)', 
                      color: 'var(--color-text-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius)', // Uses your 10px rounded corner
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: 'var(--font-size-sm)' // Maintains consistent 12px text
                    }}
                  >
                    <FilterX size={'var(--font-size-lg)'} /> 
                    <span>Clear Filters</span>
                  </button>
                )}
              </div>
              
              <div className='task-tracker-content-container'>
                <div className="task-body-header">
                  {/* HEADER TOP: Search + Progress Tabs relocated here */}
                  <div className="task-search-container" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0' }}>
                    
                    {/* Search Bar */}
                    <div className="search-input-wrapper" style={{ flex: '1', maxWidth: '300px' }}>
                      <Search size={16} className="search-icon" />
                      <input 
                        type="text"
                        placeholder="Search OE..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="task-search-input"
                      />
                      {searchQuery && (
                        <X size={16} className="clear-search" onClick={() => setSearchQuery("")} />
                      )}
                    </div>

                    {/* RELOCATED: Trip Progress Tabs (Horizontal) */}
                    <div className="horizontal-filter-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: '2' }}>
                      {filterTabs.map(tab => (
                        <button
                          key={tab.value}
                          className={`filter-tab-btn-pill ${activeFilter === tab.value ? 'active' : ''}`}
                          onClick={() => setActiveFilter(tab.value)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: '1px solid var(--color-border)',
                            background: activeFilter === tab.value ? 'var(--bg-gradient-main)' : 'white',
                            color: activeFilter === tab.value ? 'white' : 'var(--color-text)',
                            fontSize: 'var(--font-size-sm)',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'var(--transition)'
                          }}
                        >
                          {tab.label}
                          {(() => {
                            const listlen = tab.value === "All" 
                              ? taskList.length 
                              : taskList.filter(t => t.TripProgress === tab.value).length;
                            return listlen > 0 ? <span style={{ opacity: 0.8, fontSize: '10px' }}>({listlen})</span> : null;
                          })()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="task-tracker-body">
                  {/* Scrollable List Area */}
                  <div className="task-list-scrollable">
                    {filteredTasks.length > 0 ? (
                      filteredTasks.map((trip) => (
                        <TripTaskRow 
                          key={trip.ItemInternalId} 
                          data={trip} 
                          isExpandedAlready={expandedOEs.has(trip.OE)}
                          onToggle={() => toggleRow(trip.OE)}
                          onCloseModal={setIsOpen}
                          getEditorInfo={getTaskEditorInfo}
                        />
                      ))
                    ) : (
                      <div className="empty-state">
                        <p>No active tasks found.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </Modal>
      )}
    </div>



  );
});

// Important: Display name for debugging
TaskTracker.displayName = 'TaskTracker';

export default TaskTracker;