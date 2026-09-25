import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MoreVertical } from 'lucide-react';
import LoadingOverlay from './LoadingOverlay_navblue';
import './comp_css/tripGroup_DonutChart.css';
import { getApiUrl } from "../api/config";

//@ts-ignore
import { Get_AggregatedAssigned_CountsByBUService } from '../generated/services/Get_AggregatedAssigned_CountsByBUService';

// TRUTH LIST
import { TRIP_GROUPS, STATUS_COLORS } from '../truth.config';


//
import { AuthService } from "../api/AuthService.ts";

/* --- DonutChart Sub-component remains the same --- */
const DonutChart = ({ total, segments, isLoading }: { total: number; segments: { value: number; color: string }[]; isLoading?: boolean }) => {
  let cumulativePercent = 0;
  return (
    <div className={`donut-container ${isLoading ? 'is-loading' : ''}`}>
      <svg viewBox="0 0 36 36" className="donut-svg">
        <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f1f5f9" strokeWidth="3.2" />
        {segments.map((seg, i) => {
          const percent = total > 0 ? (seg.value / total) * 100 : 0;
          const offset = 100 - cumulativePercent;
          cumulativePercent += percent;
          return (
            <circle
              key={i} cx="18" cy="18" r="15.9" fill="transparent"
              stroke={isLoading ? '#e2e8f0' : seg.color}
              strokeWidth="3.8"
              strokeDasharray={`${percent} ${100 - percent}`}
              strokeDashoffset={offset}
              transform="rotate(-90 18 18)"
              style={{ transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          );
        })}
      </svg>
      <div className="donut-text">
        {isLoading ? (
          <Loader2 className="animate-spin opacity-20" size={20} />
        ) : (
          <>
            <span className="total-num">{total}</span>
            <span className="total-label">Orders</span>
          </>
        )}
      </div>
    </div>
  );
};

export interface TripGroupDonutChartRef {
  refresh: () => Promise<void>;
}

interface GridProps {
  BU: string | null | undefined;
  fromStr: string;
  toStr: string;
  orientation?: 'horizontal' | 'vertical';
  showScrollX?: boolean;
  showScrollY?: boolean;
  defaultView?: 'simple' | 'detailed';
  highlight?: string | null;
  onChartClick?: (data: {
    tripgroup: string | null;
    tripgroup_total: number | null;
    tripprogress: string | null;
    tripprogress_count: number | null
  }) => void;
  defaultFilterOptions?: {
    assigned?: boolean;
    source?: boolean;
    destination?: boolean;
    done?: boolean;
  };
}

const TripGroup_DonutChart = forwardRef<TripGroupDonutChartRef, GridProps>(({
  BU,
  fromStr,
  toStr,
  onChartClick,
  defaultView = 'detailed',
  orientation = 'horizontal',
  highlight = null,
  showScrollX = true,
  showScrollY = true,
  defaultFilterOptions,
}, ref) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>(defaultView);
  const [showSettings, setShowSettings] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState({
    assigned: true,
    source: true,
    destination: true,
    done: true,
    ...defaultFilterOptions
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  const toggleSettingsMenu = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position menu directly under the gear button, right aligned to it
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 180 // 180 is menu min-width
      });
    }
    setShowSettings((prev) => !prev);
  };

  // Close the popup dropdown if the user resizes the layout window
  useEffect(() => {
    const handleResize = () => setShowSettings(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchStats = async () => {
    console.log("fetching donut chart data");
    setLoading(true);
    try {
      const database = "DISPATCH_APP_DMS";
      const spName = "Get_AggregatedAssigned_CountsByBU";
      const endpoint = `/api/${database}/sp/${spName}`;
      const token = await AuthService.ensureValidToken();

      // Fix: Resolve full API URL using getApiUrl
      const url = getApiUrl(endpoint);

      const payload = {
        colToGet: "*",
        ...(BU && { BU: BU }),
        FROM: fromStr,
        TO: toStr,
        transpose: false
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched donut stats:", data);

      // Extract records array returned in 'value' property
      setData(data.value || []);
    } catch (error) {
      console.error("Failed to fetch donut stats:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: async () => {
      await fetchStats();
    }
  }));

  useEffect(() => {
    if (fromStr && toStr) {
      fetchStats();
    }
  }, [BU, fromStr, toStr]);

  useEffect(() => {
    if (!showSettings) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if the click happened outside both the trigger button and the portal menu layout
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showSettings]);

  useEffect(() => {
    if (!highlight) {
      setActiveHighlight(null);
      return;
    }

    // Find if the passed highlight is an ID or a Label from TRIP_GROUPS
    const matchedGroup = TRIP_GROUPS.find(
      (g) => g.id.toLowerCase() === highlight.toLowerCase() || g.label.toLowerCase() === highlight.toLowerCase()
    );

    if (matchedGroup) {
      setActiveHighlight(matchedGroup.id);
    } else {
      setActiveHighlight(null);
    }
  }, [highlight]);

  /* --- AGGREGATION LOGIC --- */
  // Instead of taking data[0], we reduce the entire array into a single "totals" object
  const aggregatedTotals = data.reduce((acc, currentRow) => {
    Object.keys(currentRow).forEach(key => {
      const value = currentRow[key];
      // Only sum up properties that are numeric
      if (typeof value === 'number') {
        acc[key] = (acc[key] || 0) + value;
      } else {
        // Keep non-numeric values (like names) from the first row if needed
        acc[key] = acc[key] || value;
      }
    });
    return acc;
  }, {} as any);

  const tripGroups = TRIP_GROUPS;

  const containerStyle: React.CSSProperties = {
    overflowX: showScrollX ? 'auto' : 'hidden',
    overflowY: showScrollY ? 'auto' : 'hidden',
    scrollbarWidth: (showScrollX || showScrollY) ? 'auto' : 'none', // Standard adherence
  };

  const gridStyle: React.CSSProperties = {
    overflowX: showScrollX ? 'auto' : 'hidden',
    overflowY: showScrollY ? 'auto' : 'hidden',
    // Force nowrap behavior if horizontal scrolling is requested explicitly on a grid layout
    flexWrap: showScrollX ? 'nowrap' : 'wrap',
    height: 'max-content',
  };

  return (
    <div className={`donut-grid-container-relative`} style={containerStyle}>

      <div className="chart-settings-wrapper">
        <button
          ref={buttonRef}
          className="chart-settings-button"
          onClick={toggleSettingsMenu}
          aria-label="Chart view settings"
        >
          <MoreVertical size={16} strokeWidth={2} color='var(--color-primary)' />
        </button>

        {showSettings && createPortal(
          <div
            ref={menuRef}
            className="chart-settings-dropdown-portal"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-section-title">View Mode</div>
            <button
              className={`chart-settings-option ${viewMode === 'detailed' ? 'active' : ''}`}
              onClick={() => { setViewMode('detailed'); }}
            >
              Detailed
            </button>
            <button
              className={`chart-settings-option ${viewMode === 'simple' ? 'active' : ''}`}
              onClick={() => { setViewMode('simple'); }}
            >
              Simple
            </button>

            <div className="settings-divider"></div>
            <div className="settings-section-title" style={{ color: 'var(--color-primary)' }}>Filter Status</div>

            {(['assigned', 'source', 'destination', 'done'] as const).map((status) => {
              const labelMap = { assigned: 'Assigned', source: 'To Source', destination: 'To Dest', done: 'Done' };
              return (
                <label key={status} className="chart-filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={visibleStatuses[status]}
                    onChange={(e) => setVisibleStatuses(prev => ({ ...prev, [status]: e.target.checked }))}
                  />
                  <span>{labelMap[status]}</span>
                </label>
              );
            })}
          </div>,
          document.body // Appends the menu cleanly outside your relative grid containers
        )}
      </div>



      {loading && (
        <div className="grid-loader-wrapper">
          <LoadingOverlay message="Generating Chart Data..." bgColor="rgba(255, 255, 255, 0.2)" blur={2} size="md" />
        </div>
      )}

      <div
        className={`matrix-grid ${loading ? 'grid-blur' : ''} grid-${orientation} ${viewMode === 'simple' ? 'grid-simple-row' : ''
          }`}
        style={gridStyle}
      >
        {tripGroups.map((group) => {
          // 1. Get real values or default to 0
          const realAssigned = Number(aggregatedTotals[`Assigned_${group.id}`] || 0);
          const realSrc = Number(aggregatedTotals[`DispSrc_${group.id}`] || 0);
          const realDst = Number(aggregatedTotals[`DispDst_${group.id}`] || 0);
          const realDone = Number(aggregatedTotals[`Done_${group.id}`] || 0);

          // 2. Filter values depending on what checkboxes are checked
          const stats = {
            assigned: visibleStatuses.assigned ? realAssigned : 0,
            source: visibleStatuses.source ? realSrc : 0,
            destination: visibleStatuses.destination ? realDst : 0,
            done: visibleStatuses.done ? realDone : 0,
          };

          // Calculate total dynamically using only active status items
          const total = stats.assigned + stats.source + stats.destination + stats.done;

          const handleClick = (progress: string | null, count: number | null) => {
            const isCurrentlySelected = activeHighlight === group.id;

            if (isCurrentlySelected) {
              // Toggle Off: Reset selection
              setActiveHighlight(null);
              if (onChartClick) {
                onChartClick({
                  tripgroup: null,
                  tripgroup_total: null,
                  tripprogress: null,
                  tripprogress_count: null
                });
              }
            } else {
              // Toggle On: Select card
              setActiveHighlight(group.id);
              if (onChartClick) {
                onChartClick({
                  tripgroup: group.id,
                  tripgroup_total: total,
                  tripprogress: progress,
                  tripprogress_count: count
                });
              }
            }
          };

          // Check highlight states
          const isHighlighted = activeHighlight === group.id;
          const hasAnyHighlight = activeHighlight !== null;

          return (
            <div
              key={group.id}
              className={`analytic-card ${viewMode === 'simple' ? 'analytic-card-simple' : 'analytic-card-detailed'
                } ${isHighlighted ? 'highlighted' : ''} ${hasAnyHighlight && !isHighlighted ? 'dimmed' : ''
                }`}
            >
              {viewMode === 'detailed' ? (
                <>
                  <div className="card-sidebar">
                    {/* 3. Conditionally render standard label lists if checked */}
                    {visibleStatuses.assigned && (
                      <div className="card-stat clickable" onClick={() => handleClick("Assigned", stats.assigned)}>
                        <span><span className="dot" style={{ backgroundColor: STATUS_COLORS.assigned }}></span>Assigned</span>
                        <b>{stats.assigned}</b>
                      </div>
                    )}
                    {visibleStatuses.source && (
                      <div className="card-stat clickable" onClick={() => handleClick("Dispatched To Source", stats.source)}>
                        <span><span className="dot" style={{ backgroundColor: STATUS_COLORS.source }}></span>To Source</span>
                        <b>{stats.source}</b>
                      </div>
                    )}
                    {visibleStatuses.destination && (
                      <div className="card-stat clickable" onClick={() => handleClick("Dispatched To Destination", stats.destination)}>
                        <span><span className="dot" style={{ backgroundColor: STATUS_COLORS.destination }}></span>To Dest</span>
                        <b>{stats.destination}</b>
                      </div>
                    )}
                    {visibleStatuses.done && (
                      <div className="card-stat clickable" onClick={() => handleClick("Done", stats.done)}>
                        <span><span className="dot" style={{ backgroundColor: STATUS_COLORS.done }}></span>Done</span>
                        <b>{stats.done}</b>
                      </div>
                    )}
                  </div>

                  <div className="card-content clickable" onClick={() => handleClick(null, null)}>
                    <DonutChart
                      isLoading={loading}
                      total={total}
                      segments={[
                        { value: stats.assigned, color: STATUS_COLORS.assigned },
                        { value: stats.source, color: STATUS_COLORS.source },
                        { value: stats.destination, color: STATUS_COLORS.destination },
                        { value: stats.done, color: STATUS_COLORS.done }
                      ]}
                    />
                    <h3>{group.label}</h3>
                  </div>
                </>
              ) : (
                /* Simple View Block mapping */
                <div className="card-content simple-card-content clickable" onClick={() => handleClick(null, null)}>
                  <div className="simple-card-title">
                    <h3>{group.label}</h3>
                  </div>
                  <DonutChart
                    isLoading={loading}
                    total={total}
                    segments={[
                      { value: stats.assigned, color: STATUS_COLORS.assigned },
                      { value: stats.source, color: STATUS_COLORS.source },
                      { value: stats.destination, color: STATUS_COLORS.destination },
                      { value: stats.done, color: STATUS_COLORS.done }
                    ]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

TripGroup_DonutChart.displayName = 'TripGroup_DonutChart';
export default TripGroup_DonutChart;