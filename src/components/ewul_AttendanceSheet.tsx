import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Sp_fetchAttendanceCalendar2Service } from '../generated/services/Sp_fetchAttendanceCalendar2Service';
import LoadingOverlay from '../components/LoadingOverlay_navblue';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar, Search, PinIcon } from 'lucide-react';
import '../components/comp_css/ewul_AttendanceSheet.css';

interface AttendanceRecord {
  EmployeeName: string;
  EmployeeID: number;
  AttendanceDate: string;
  AttendanceStatus: string;
  OE: string | null;
  Position: string;
  ModifiedAt: string | null;
}

interface AttendanceSheetProps {
  liveTrips: any[]; // The table passed in
  colName: string[]; // e.g., "EmployeeName"
  colOE: string;    // e.g., "OE_Number"
  colStatus: string; // e.g., "Trip_Status"
  BU: string;
}

const AttendanceSheet: React.FC<AttendanceSheetProps> = ({ liveTrips, colName, colOE, colStatus, BU = 'SBUO-1A' }) => {
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, _setPageSize] = useState(15);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState('All');

  // Drag n Drop Scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Control State for Date
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const dateInputRef = useRef<HTMLInputElement>(null);

  const todayRef = useRef<HTMLTableCellElement>(null);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const scrollToDate = (targetRef?: React.RefObject<HTMLTableCellElement>, targetDate?: Date) => {
    const date = targetDate || new Date();
    if (currentDate.getMonth() !== date.getMonth() || currentDate.getFullYear() !== date.getFullYear()) {
      setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    setTimeout(() => {
      const ref = targetRef || todayRef;
      if (ref.current && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const target = ref.current;
        const containerWidth = container.clientWidth;
        const targetWidth = target.offsetWidth;
        const scrollPos = target.offsetLeft - (containerWidth / 2) + (targetWidth / 2);
        container.scrollTo({
          left: scrollPos,
          behavior: 'smooth'
        });
      }
    }, 100);
  };


  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed for SP

  // Navigation Handlers
  const changeMonth = (offset: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const changeYear = (offset: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear() + offset, prev.getMonth(), 1));
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const selected = new Date(e.target.value);
      setCurrentDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  };


  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    // Get initial click position and current scroll offset
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    
    // Calculate distance moved
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Multiply by 1.5 for faster scrolling
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      console.log(`Fetching attendance for Year: ${year}, Month: ${month}, BU: ${BU}`);
      setLoading(true);
      try {
        const res = await Sp_fetchAttendanceCalendar2Service.Sp_fetchAttendanceCalendar2({ 
          Year: year,
          Month: month,
          BU: BU
        } as any);
        setData(res.data?.ResultSets?.Table1 || [] as any);
        // Only scroll to today if viewing the current month and year
        const now = new Date();
        if (year === now.getFullYear() && month === now.getMonth() + 1) {
          scrollToDate();
        }
      } catch (error) {
        console.error("Fetch error:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [currentDate]); // Re-fetch whenever date changes

  // 1. Generate Header Dates for the selected Month
  const daysInMonth = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const days = [];
    while (date.getMonth() === currentDate.getMonth()) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Position Check
      const matchesPosition = filterPosition === 'All' || item.Position === filterPosition;
      
      // Search Check (Name or OE)
      const lowerSearch = searchTerm.toLowerCase();
      const matchesSearch = searchTerm.trim() === '' || 
        item.EmployeeName.toLowerCase().includes(lowerSearch) || 
        (item.OE && item.OE.toLowerCase().includes(lowerSearch));

      return matchesPosition && matchesSearch;
    });
  }, [data, searchTerm, filterPosition]);

  // 2. Pivot Data: Group records by EmployeeName
  // Optimized Pivot Logic (Alternative)
  const groupedData = useMemo(() => {
    const map: Record<string, { positions: string, dates: Record<string, any[]> }> = {};

    filteredData.forEach(item => {
        if (!map[item.EmployeeName]) {
            map[item.EmployeeName] = { positions: item.Position, dates: {} };
        }

        const dateKey = item.AttendanceDate.split('T')[0];

        if (!map[item.EmployeeName].dates[dateKey]) {
            map[item.EmployeeName].dates[dateKey] = [];
        }

        map[item.EmployeeName].dates[dateKey].push({
            ...item,
            status: item.AttendanceStatus,
            modifiedAt: new Date(item.ModifiedAt || 0).getTime()
        });
    });

    Object.values(map).forEach(emp => {
        Object.keys(emp.dates).forEach(dateKey => {
            let entries = emp.dates[dateKey];

            // 1. Basic cleaning: Remove null/empty statuses
            const hasValidStatus = entries.some(e => e.AttendanceStatus !== null && e.AttendanceStatus !== "");
            if (hasValidStatus) {
                entries = entries.filter(e => e.AttendanceStatus !== null && e.AttendanceStatus !== "");
            }

            // 2. Sort by time (Oldest to Newest)
            entries.sort((a, b) => a.modifiedAt - b.modifiedAt);

            // 3. SPECIAL CONDITION: Remove "PRESENT" if it is not the latest status
            if (entries.length > 1) {
                //const latestStatus = entries[entries.length - 1].AttendanceStatus;
                
                // Filter out "PRESENT" only if it's not the one we just identified as latest
                entries = entries.filter((entry, index) => {
                    const isLatest = index === entries.length - 1;
                    const isPresent = entry.AttendanceStatus?.toUpperCase() === 'PRESENT';
                    
                    // Keep it if: It's the latest OR it's not a "PRESENT" status
                    return isLatest || !isPresent;
                });
            }

            emp.dates[dateKey] = entries;
        });
    });

    return map;
  }, [filteredData]);

  const employeeNames = Object.keys(groupedData).sort();
  // Pagination Logic
  const totalPages = Math.ceil(employeeNames.length / pageSize);
  const paginatedEmployeeNames = useMemo(() => {
      const start = (currentPage - 1) * pageSize;
      return employeeNames.slice(start, start + pageSize);
  }, [employeeNames, currentPage, pageSize]);

  // Reset to page 1 when searching or filtering
  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, filterPosition]);

  const AttendanceSkeleton = ({ days }: { days: any[] }) => (
    <>
      {[...Array(10)].map((_, i) => (
        <tr key={i} className="skeleton-row">
          <td className="sticky-col emp-name"><div className="skeleton-text" /></td>
          {days.map((_, d) => (
            <td key={d} className="status-cell"><div className="skeleton-box" /></td>
          ))}
        </tr>
      ))}
    </>
  );

  const showSkeleton = loading && data.length === 0;
  const showOverlay = loading && data.length > 0;

  const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) return <>{text}</>;

    // Escape special characters in search term and create regex
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="gsdc-highlight">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  //if (loading && data.length > 0) return <div className="attendance-loader">Loading GSDC Attendance...</div>;

  return (
    <div className="attendance-container">
      {showOverlay && <div><LoadingOverlay  message="Fetching Attendance..." bgColor="rgba(255, 255, 255, 0.2)" blur={2} size="md"  /></div>}





      <div className="attendance-control-header">

        {/* LEFT CONTROL */}
        <div className="header-section left">
          <div className="attendance-search-wrapper">
            <div className="gsdc-gradient-outline-wrapper">
              <div className="search-input-container">
                <Search size={16} className="search-icon" />
                <input 
                  type="text"
                  placeholder="Search Name or OE..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CENTER CONTROL */}
        <div className="header-section center">
          <div className="nav-group">
            <button onClick={() => changeYear(-1)} title="Prev Year"><ChevronsLeft size={18} /></button>
            <button onClick={() => changeMonth(-1)} title="Prev Month"><ChevronLeft size={18} /></button>
          </div>

          <div className="date-display" onClick={() => dateInputRef.current?.showPicker()}>
            <Calendar size={16} className="cal-icon" />
            <span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <input type="date" ref={dateInputRef} className="hidden-date-picker" onChange={handleDateSelect} />
          </div>

          <div className="nav-group">
            <button onClick={() => changeMonth(1)} title="Next Month"><ChevronRight size={18} /></button>
            <button onClick={() => changeYear(1)} title="Next Year"><ChevronsRight size={18} /></button>
          </div>

          <button className="gsdc-today-btn" onClick={() => scrollToDate()}>
            <PinIcon size={14} />
            Today
          </button>
        </div>


        {/* RIGHT CONTROL */}
        <div className="header-section right">

          {/* Position Dropdown */}
            <div className="attendance-dropdown-wrapper">
              <div className="gsdc-gradient-outline-wrapper">
                <select 
                  className="gsdc-filter-select"
                  value={filterPosition}
                  onChange={(e) => setFilterPosition(e.target.value)}
                >
                  <option value="All">All Positions</option>
                  <option value="Driver">Driver</option>
                  <option value="Helper">Helper</option>
                </select>
              </div>
            </div>

            <button 
              className={`gsdc-toggle-btn ${showAllStatuses ? 'active' : ''}`}
              onClick={() => setShowAllStatuses(!showAllStatuses)}
              title={showAllStatuses ?  "Show Latest Status Only" : "Show All Status"}
            >
              {showAllStatuses ? "Showing All" : "Latest Only"}
            </button>

        </div>



      </div>

      <div 
        className={`attendance-scroll-area ${isDragging ? 'grabbing' : ''}`}
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
      >
        <table className="attendance-table">
          <thead>
              <tr>
                <th className="sticky-col sticky-header">
                  <div className="header-top-row">
                    Employee Name
                  </div>
                  
                  <div className="header-pagination-container">
                    <div className="pagination-centered-group">
                      <button 
                        className="pager-btn"
                        disabled={currentPage === 1} 
                        onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev - 1); }}
                      >
                        <ChevronLeft size={14} />
                      </button>

                      <div className="pager-info">
                        <span className="current">{currentPage}</span>
                        <span className="separator">/</span>
                        <span className="total">{totalPages || 1}</span>
                      </div>

                      <button 
                        className="pager-btn"
                        disabled={currentPage === totalPages || totalPages === 0} 
                        onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev + 1); }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </th>
                {daysInMonth.map(date => {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    const dateStr = `${y}-${m}-${d}`;
                    
                    const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const isToday = dateStr === todayStr;

                    return (
                      <th 
                        key={dateStr} 
                        ref={isToday ? todayRef : null}
                        className={`sticky-header 
                          ${isToday ? 'today-column' : ''} 
                          ${isWeekend ? 'weekend-column' : ''}
                          ${dayOfWeek === 0 ? 'sunday' : ''}
                        `}
                      >
                        <div className="header-date-box">
                          <span className="day-name">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <span className="day-num">{date.getDate()}</span>
                        </div>
                      </th>
                    );
                  })}
              </tr>
            </thead>
          <tbody>
            {showSkeleton ? (
              <AttendanceSkeleton days={daysInMonth} />
            ) : (
              paginatedEmployeeNames.map(name => {
                // Find trip info for the current employee from liveTrips table
                const tripInfo = liveTrips?.find(t => 
                  Array.isArray(colName) 
                    ? colName.some(col => t[col] === name) // Check every column in the array
                    : t[colName] === name                  // Fallback for a single string
                );
                const oeValue = tripInfo ? tripInfo[colOE] : '---';
                const tripStatus = tripInfo ? tripInfo[colStatus] : null;

                return (
                  <tr key={name}>
                    <td className="sticky-col emp-name" title={`${name} - ${groupedData[name].positions || ''}`}>
                      <div className="name-cell-content">
                        {/* 1. Position Indicator */}
                        <div className="position-indicator">
                          {groupedData[name].positions === 'Driver' ? (
                            <span className="indicator-d">D</span>
                          ) : (
                            <span className="indicator-h">H</span>
                          )}
                        </div>

                        {/* 2. Text Stack (Name + Trip Info) */}
                        <div className="name-details-stack">
                          <div className="primary-name-row">
                            <HighlightText text={name} highlight={searchTerm} />
                          </div>
                          <div className="secondary-oe-row">
                            <div className="oe-left-group">
                              <span className="oe-label">Trip:</span> 
                              <span className="oe-value">{oeValue}</span>
                            </div>
                            
                            {/* Trip Status on the right, no labels */}
                            {tripStatus && (
                              <div className="oe-status-tag">
                                {tripStatus}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Attendance Status Cells */}
                    {daysInMonth.map(date => {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      const dateStr = `${y}-${m}-${d}`;
                      const allEntries = groupedData[name].dates[dateStr] || []; // Fallback to empty array
                      const lastEntry = allEntries.length > 0 ? allEntries[allEntries.length - 1] : null;
                      const displayEntries = showAllStatuses ? allEntries : (lastEntry ? [lastEntry] : []);

                      const dayOfWeek = date.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isToday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === todayStr;

                      return (
                        <td 
                          key={date.toISOString()} 
                          className={`status-cell 
                            ${isToday ? 'today-cell' : ''} 
                            ${isWeekend ? 'weekend-cell' : ''}
                            ${dayOfWeek === 0 ? 'sunday-cell' : ''}
                          `}
                        >
                          <div className={`status-stack ${showAllStatuses ? 'expanded' : 'collapsed'}`}>
                            {displayEntries.length > 0 ? (
                              displayEntries.map((entry, idx) => {
                                const statusClass = (entry.status || '').replace(/\s+/g, '-').toLowerCase();
                                return (
                                  <div 
                                      key={idx} 
                                      className={`status-inner ${statusClass} ${
                                        searchTerm && entry.OE?.toLowerCase().includes(searchTerm.toLowerCase()) 
                                        ? 'force-reveal' 
                                        : ''
                                      }`}
                                      title={`Modified: ${new Date(entry.ModifiedAt).toLocaleString()}`}
                                  >
                                      {/* The Main Status Value */}
                                      <span className="status-main-value">
                                          {entry.AttendanceStatus ? entry.AttendanceStatus : '---'}
                                      </span>
                                      {/* The OE Label - Invisible by default */}
                                      <span className="oe-hover-label">
                                        <HighlightText text={entry.OE || ''} highlight={searchTerm} />
                                      </span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="status-inner n/a">---</div>
                            )}
                          </div>
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


    </div>
  );
};

export default AttendanceSheet;