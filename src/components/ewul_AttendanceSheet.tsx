import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Sp_fetchAttendanceCalendar2Service } from '../generated/services/Sp_fetchAttendanceCalendar2Service';
import { UpsertAttendanceLogService } from '../generated/services/UpsertAttendanceLogService';
import LoadingOverlay from '../components/LoadingOverlay_navblue';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar, Search, PinIcon } from 'lucide-react';
import '../components/comp_css/ewul_AttendanceSheet.css';
import {
  ATTENDANCE_STATUSES,
  ALLOWED_DATE_CLICK,
  NOT_ALLOWED_STAT_EDIT,
} from '../truth.config';

interface AttendanceRecord {
  EmployeeName: string;
  EmployeeID: number;
  AttendanceDate: string;
  AttendanceStatus: string;
  OE: string | null;
  Position: string;
  ModifiedAt: string | null;
}

const AttendanceCell = React.memo(({ 
  dateStr, 
  dayOfWeek, 
  isWeekend, 
  isToday, 
  displayEntries, 
  searchTerm, 
  empName,     
  oeValue,    
  empMetaId,   
  onCellClick,
  isActiveMenuCell
}: {
  dateStr: string;
  dayOfWeek: number;
  isWeekend: boolean;
  isToday: boolean;
  displayEntries: any[];
  searchTerm: string;
  empName: string;
  oeValue: string;
  empMetaId: string;
  onCellClick: (e: React.MouseEvent, empName: string, empId: string, currentOE: string, dateStr: string, currentStatus: string, oeValue: string) => void;
  isActiveMenuCell?: boolean;
}) => {

  const lastEntry = displayEntries.length > 0 ? displayEntries[displayEntries.length - 1] : null;
  const currentStatus = lastEntry?.AttendanceStatus || 'ABSENT';

  const isDateAllowed = 
    dateStr >= ALLOWED_DATE_CLICK.startDate && 
    dateStr <= ALLOWED_DATE_CLICK.endDate;

  // 🟢 2. Check Attendance Status Validity
  const isStatusAllowed = !NOT_ALLOWED_STAT_EDIT.includes(currentStatus.toUpperCase());

  // Combined rule flag
  const isEditable = isDateAllowed && isStatusAllowed;


  return (
    <td 
      className={`status-cell 
        ${isToday ? 'today-cell' : ''} 
        ${isWeekend ? 'weekend-cell' : ''}
        ${dayOfWeek === 0 ? 'sunday-cell' : ''}
        ${isActiveMenuCell ? 'menu-active-cell' : ''}
        ${!isEditable ? 'cell-disabled' : ''}
      `}
      onClick={(e) => {
        e.stopPropagation();
        if (!isEditable) return; // only allow editable cells
        const lastEntry = displayEntries.length > 0 ? displayEntries[displayEntries.length - 1] : null;
        const empId = lastEntry?.EmployeeID || empMetaId || '0';
        const currentOE = lastEntry?.OE || lastEntry?.DMS_OE || oeValue || '';
        const currentStatus = lastEntry?.AttendanceStatus || 'ABSENT';

        onCellClick(e, empName, String(empId), currentOE, dateStr, currentStatus, oeValue);
      }}
    >
      <div className={`status-stack ${displayEntries.length > 1 ? 'expanded' : 'collapsed'}`}>
        {displayEntries.length > 0 ? (
          displayEntries.map((entry, idx) => {
            const statusClass = (entry.status || '').replace(/\s+/g, '-').toLowerCase();
            return (
                <div 
                  key={idx} 
                  className={`status-inner ${statusClass} ${
                    searchTerm && entry.OE?.toLowerCase().includes(searchTerm.toLowerCase()) ? 'force-reveal' : ''
                  }`}
                  // LAZY EVALUATION: parse date when user interacts or requests a native tooltip fallback safely
                  onMouseEnter={(e) => {
                    if (entry.ModifiedAt && !e.currentTarget.getAttribute('title')) {
                      e.currentTarget.setAttribute('title', `Modified: ${new Date(entry.ModifiedAt).toLocaleString()}`);
                    }
                  }}
                >
                  <span className="status-main-value">
                    {entry.AttendanceStatus || '---'}
                  </span>
                  <span className="oe-hover-label">{entry.OE || ''}</span>
                </div>
            );
          })
        ) : (
          <div className="status-inner n/a">---</div>
        )}
      </div>
    </td>
  );
});

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

  const [activeMenu, setActiveMenu] = useState<{
    empName: string;
    empId: string;
    date: Date;
    dateStr: string;
    oeValue: string;
    liveOE: string;
    x: number;
    y: number;
    renderUpwards: boolean;
    currentStatus: string;
  } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, _setPageSize] = useState(15);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState('All');

  // Drag n Drop Scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleUpdateAttendanceStatus = async (newAttendance: string, empId: string, empName: string, OE: string, attendanceDate?: Date) => {
    
    console.log('test attendance:  ', {newAttendance,empId,empName,OE,attendanceDate});
    if (attendanceDate) return;
    
    try {
      UpsertAttendanceLogService.UpsertAttendanceLog({ 
        EmployeeName: empName,
        EmployeeID: empId,
        AttendanceDate: (attendanceDate ? attendanceDate : new Date()).toISOString().split('T')[0],
        AttendanceStatus: newAttendance || 'PRESENT',
        OE: OE || '',
      } as any);
      return { success: true};
    } catch (error) {
      console.error("Fetch error:", error);
      return { success: false, error };
    }
  };

  const getFilteredStatuses = (oe: string) => {
    const hasOE = oe && oe !== '---' && oe.trim() !== '';
    
    return ATTENDANCE_STATUSES.filter(opt => {
      // Basic types are always available (seq 0.x and 1.x)
      if (opt.seq < 2.0) return true;
      
      // If they have an OE, show trip statuses (seq 2.x)
      if (hasOE) return opt.seq >= 2.0 && opt.seq < 3.0;
      
      // If they DON'T have an OE, show off-trip statuses (seq 3.x)
      return opt.seq >= 3.0;
    }).sort((a, b) => a.sort - b.sort);
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
        setData((res.data?.ResultSets?.Table1 || []) as any);
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


  const uniqueEmployeeNames = useMemo(() => {
    const namesSet = new Set<string>();
    filteredData.forEach(item => namesSet.add(item.EmployeeName));
    return Array.from(namesSet).sort();
  }, [filteredData]);

  const totalPages = Math.ceil(uniqueEmployeeNames.length / pageSize);

  const paginatedEmployeeNames = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return uniqueEmployeeNames.slice(start, start + pageSize);
  }, [uniqueEmployeeNames, currentPage, pageSize]);

  // Reset to page 1 when searching or filtering
  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, filterPosition]);

  const pageGroupedData = useMemo(() => {
    const map: Record<string, { positions: string, dates: Record<string, any[]> }> = {};
    
    // Create a quick lookup Set for just the 15 visible names
    const visibleNamesSet = new Set(paginatedEmployeeNames);

    // Stream through filtered data, but skip anything not on the active viewport page
    filteredData.forEach(item => {
      if (!visibleNamesSet.has(item.EmployeeName)) return;

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

    // Run your exact sorting rules, but only on the 15 visible targets
    Object.values(map).forEach(emp => {
      Object.keys(emp.dates).forEach(dateKey => {
        let entries = emp.dates[dateKey];

        const hasValidStatus = entries.some(e => e.AttendanceStatus !== null && e.AttendanceStatus !== "");
        if (hasValidStatus) {
          entries = entries.filter(e => e.AttendanceStatus !== null && e.AttendanceStatus !== "");
        }

        entries.sort((a, b) => a.modifiedAt - b.modifiedAt);

        if (entries.length > 1) {
          entries = entries.filter((entry, index) => {
            const isLatest = index === entries.length - 1;
            const isPresent = entry.AttendanceStatus?.toUpperCase() === 'PRESENT';
            return isLatest || !isPresent;
          });
        }

        emp.dates[dateKey] = entries;
      });
    });

    return map;
  }, [filteredData, paginatedEmployeeNames]);


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


  const liveTripsMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (!liveTrips) return map;
    
    liveTrips.forEach(t => {
      if (Array.isArray(colName)) {
        colName.forEach(col => { if (t[col]) map[t[col]] = t; });
      } else if (t[colName]) {
        map[t[colName]] = t;
      }
    });

    if (map['Pama, Elebert Palma']) {
      console.log('Target Driver Trip Data Found:', map['Pama, Elebert Palma']);
    } else {
      console.log('Target Driver NOT found in liveTripsMap keys:', Object.keys(map));
    }


    return map;
  }, [liveTrips, colName]);


  const employeeMetaMap = useMemo(() => {
    const map: Record<string, { id: number; position: string }> = {};
    filteredData.forEach(item => {
      if (!map[item.EmployeeName]) {
        map[item.EmployeeName] = { id: item.EmployeeID, position: item.Position };
      }
    });
    return map;
  }, [filteredData]);

  const handleCellContextOpen = useCallback((
    e: React.MouseEvent, 
    empName: string, 
    empId: string, 
    currentOE: string, 
    dateStr: string,
    currentStatus: string,
    liveOE: string,
  ) => {
    // Convert target dateStr back into standard date configuration safely[cite: 4]
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDateObject = new Date(y, m - 1, d);

    const clickY = e.clientY;
    const windowHeight = window.innerHeight;
    
    // Estimate your context menu height (e.g., ~220px to 300px depending on status counts)
    const estimatedMenuHeight = 250; 
    
    // Check if opening downwards would push the menu past the bottom edge
    const shouldFlipUp = (clickY + estimatedMenuHeight) > windowHeight;

    setActiveMenu({
      empName,
      empId,
      date: targetDateObject,
      dateStr,
      oeValue: currentOE === '---' ? '' : currentOE,
      x: e.clientX,
      y: clickY,
      renderUpwards: shouldFlipUp,
      currentStatus: currentStatus || 'ABSENT',
      liveOE: liveOE === '---' ? '' : liveOE,
    });
  }, []);

  useEffect(() => {
    if (!activeMenu) return;

    const handleOutsideClick = (event: MouseEvent) => {
      // If the click is outside the context menu container, close it quietly
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    // Listen globally in the capture phase to react instantly
    window.addEventListener('mousedown', handleOutsideClick, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, [activeMenu]);



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
                const tripInfo = liveTripsMap[name];
                const oeValue = tripInfo ? tripInfo[colOE] : '---';
                const tripStatus = tripInfo ? tripInfo[colStatus] : null;
                const meta = employeeMetaMap[name];

                const employeeData = pageGroupedData[name] || { positions: '', dates: {} };

                return (
                  <tr key={name}>
                    <td className="sticky-col emp-name" title={`${name} - ${employeeData.positions || ''}`}>
                      <div className="name-cell-content">
                        {/* 1. Position Indicator */}
                        <div className="position-indicator">
                          {employeeData.positions === 'Driver' ? (
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
                      const allEntries = employeeData.dates[dateStr] || []; 
                      const lastEntry = allEntries.length > 0 ? allEntries[allEntries.length - 1] : null;
                      const displayEntries = showAllStatuses ? allEntries : (lastEntry ? [lastEntry] : []);

                      const dayOfWeek = date.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isToday = dateStr === todayStr;

                      const isContextMenuOpenHere = 
                          activeMenu !== null && 
                          activeMenu.dateStr === dateStr && 
                          String(activeMenu.empId) === String(meta?.id || '0');

                      return (
                        <AttendanceCell
                          key={dateStr}
                          dateStr={dateStr}
                          dayOfWeek={dayOfWeek}
                          isWeekend={isWeekend}
                          isToday={isToday}
                          displayEntries={displayEntries}
                          searchTerm={searchTerm}
                          empName={name}
                          oeValue={oeValue}
                          empMetaId={String(meta?.id || '0')}
                          onCellClick={handleCellContextOpen} 
                          isActiveMenuCell={isContextMenuOpenHere}
                        />
                      );
                    })}

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>


      {activeMenu && (
        <div 
          ref={menuRef} 
          className="gsdc-attendance-context-menu"
          style={{ 
            top: activeMenu.y, 
            left: activeMenu.x,
            transform: activeMenu.renderUpwards ? 'translateY(-105%)' : 'translateY(10px)',
          }}
        >
          <div className="context-menu-header">
            <strong>{activeMenu.empName}</strong>
            <span>{activeMenu.dateStr} {activeMenu.oeValue ? `(${activeMenu.oeValue || 'NO TRIP'})` : ''}</span>
            <button 
              className="context-timeline-btn" 
              title="Feature Coming Soon"
              onClick={(e) => {
                e.stopPropagation();
                // Future feature hook goes here
                console.log("Opening timeline history for:", activeMenu.empName);
              }}
            >
              View Timelogs
            </button>
          </div>
          <hr />
          <div className="context-options-list">
            {getFilteredStatuses(activeMenu.oeValue).map((statusObj) => 
            {
            const isCurrentlySelected = activeMenu.currentStatus?.toUpperCase() === statusObj.Status?.toUpperCase();
            return  (
              <button
                key={statusObj.Status}
                className={`context-option-btn ${statusObj.onduty ? 'on-duty' : 'off-duty'} ${isCurrentlySelected ? 'active-status-highlight' : ''}`}
                onClick={async () => {
                  const selectedStatus = statusObj.Status;
                  setActiveMenu(null); 
                  setLoading(true);

                  const result = await handleUpdateAttendanceStatus(
                    selectedStatus,
                    activeMenu.empId,
                    activeMenu.empName,
                    activeMenu.oeValue,
                    activeMenu.date
                  );

                  if (result?.success) {
                    setCurrentDate(new Date(currentDate)); 
                  } else {
                    alert("Failed to tag attendance.");
                    setLoading(false);
                  }
                }}
              >
                {statusObj.Alias}
              </button>
            )}
            )}
          </div>
        </div>
      )}


    </div>
  );
};

export default AttendanceSheet;