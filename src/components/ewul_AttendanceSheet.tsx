import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { HeaderSyncBadge } from './ewul_HeaderSyncBadge';
import { EmployeeSummaryModal } from './EmployeeSummaryModal';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar, Search,
  PinIcon, Star, Mail, Lock, ZoomIn, ZoomOut, RotateCcw,

} from 'lucide-react';
import '../components/comp_css/ewul_AttendanceSheet.css';
import AutoDismissBanner from '../components/ewul_Banner';
import Modal from '../components/ewul_Modal';
import TableView from './ewul_TableFlex';

import { useTaskWorker } from '../utils/TaskWorkerContext';
import { useUser } from '../utils/useUser';

//POWER APPS
// import { Sp_fetchAttendanceCalendar2Service } from '../generated/services/Sp_fetchAttendanceCalendar2Service';
import { FetchAttendanceCalendarService } from '../generated/services/FetchAttendanceCalendarService';
import { UpsertAttendanceLogService } from '../generated/services/UpsertAttendanceLogService';
import { Late_Attendance_RequestsService } from '../generated/services/Late_Attendance_RequestsService';
import { type Late_Attendance_Requests } from '../generated/models/Late_Attendance_RequestsModel';

import {
  ATTENDANCE_STATUSES,
  ALLOWED_DATE_CLICK,
  NOT_ALLOWED_STAT_EDIT,
  LATE_ATTENDANCE_REQUESTS,
} from '../truth.config';

import {

  ewulFetchAll,
  ISOtoInt,
  //@ts-ignore
  encodeColumnName as enc


} from '../utils/Ewul_GSDC_Utils';

export interface AttendanceSheetRef {
  refresh: () => Promise<void>;
}

export interface AttendanceRecord {
  EmployeeName: string;
  EmployeeID: number;
  AttendanceDate: string;
  AttendanceStatus: string;
  OE: string | null;
  Position: string;
  ModifiedAt: string | null;
  tripIndex?: number | null;
  DMS_OE?: string | null;          // <-- Added
  DMS_TripStatus?: string | null;  // <-- Added

  BU?: string | null | undefined;
  Position1?: string;
  SD?: string | null;
  TCVC?: string | null;
  TransactionType?: string | null;
  secondTrip?: string | null;
  tripKM?: number | null;
  Approved?: string;

  spID?: string;
  ModifiedBy?: string;
  ApprovedBy?: string;

  attendanceID?: string;

  isDeleted?: boolean;

  requestID?: string;
  requestStatus?: string;
}

interface CutoffGroup {
  label: string;
  count: number;
  isLastMonth: boolean;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  dates: string[];   // Array of YYYY-MM-DD date strings in this cutoff
}

const AttendanceCell = React.memo(({
  dateStr,
  //@ts-ignore
  dayOfWeek,
  //@ts-ignore
  isWeekend,
  isToday,
  displayEntries,
  searchTerm,
  empName,
  oeValue,
  empMetaId,
  onCellClick,
  isActiveMenuCell,
  isBoundaryCell,
  isEndBoundaryCell,
  //@ts-ignore
  onBannerMsg,
  isCellLoading,
  isSelectedCutoff,
  isCutoffStart,
  isCutoffEnd,
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
  onCellClick: (
    e: React.MouseEvent,
    empName: string,
    empId: string,
    currentOE: string,
    dateStr: string,
    currentStatus: string,
    oeValue: string,
    isEditable: boolean,
    Approval?: string,
    attendanceID?: string,
    requestID?: string | null,
    requestStatus?: string | null
  ) => void;
  isActiveMenuCell?: boolean;
  isBoundaryCell?: boolean;
  isEndBoundaryCell?: boolean;
  onBannerMsg?: (msg: string) => void;
  isCellLoading?: boolean;
  isSelectedCutoff?: boolean;
  isCutoffStart?: boolean;
  isCutoffEnd?: boolean;
}) => {

  const lastEntry = displayEntries.length > 0 ? displayEntries[displayEntries.length - 1] : null;
  const currentStatus = lastEntry?.AttendanceStatus || 'ABSENT';

  const isDateAllowed =
    dateStr >= ALLOWED_DATE_CLICK.startDate &&
    dateStr <= ALLOWED_DATE_CLICK.endDate;

  const isLastEntryApproved = lastEntry?.Approved === 'Approved';
  const isStatusAllowed = !NOT_ALLOWED_STAT_EDIT.includes(currentStatus.toUpperCase());
  const isEditable = isDateAllowed && isStatusAllowed && !isLastEntryApproved;

  // Pre-calculate precedence
  const hasCutoffBoundary = isCutoffStart || isCutoffEnd;
  const showBoundaryEdge = isBoundaryCell && !hasCutoffBoundary;
  const showEndBoundary = isEndBoundaryCell && !hasCutoffBoundary;

  return (
    <td
      className={`status-cell 
        ${isToday ? 'today-cell' : ''} 
        ${isActiveMenuCell ? 'menu-active-cell' : ''}
        ${showBoundaryEdge ? 'lock-boundary-edge' : ''}
        ${showEndBoundary ? 'lock-end-boundary' : ''}
        ${isCellLoading ? 'cell-is-updating' : ''}
        ${isSelectedCutoff ? 'selected-cutoff-cell' : ''}
        ${isCutoffStart ? 'selected-cutoff-boundary-start' : ''}
        ${isCutoffEnd ? 'selected-cutoff-boundary-end' : ''}
      `}
    >
      <div className={`status-stack ${displayEntries.length > 1 ? 'expanded' : 'collapsed'}`}>
        {isCellLoading && (
          <div className="cell-mini-loader-overlay">
            <div className="mini-spinner"></div>
          </div>
        )}
        <div className={`status-stack ${displayEntries.length > 1 ? 'expanded' : 'collapsed'}`}>
          {displayEntries.length > 0 ? (
            displayEntries.map((entry, idx) => {
              const statusClass = (entry.status || '').replace(/\s+/g, '-').toLowerCase();
              const isApproved = entry.Approved === 'Approved';
              const isIndividualStatusAllowed = !NOT_ALLOWED_STAT_EDIT.includes((entry.AttendanceStatus || '').toUpperCase());
              const isEntryEditable = isDateAllowed && isIndividualStatusAllowed && !isApproved;

              // Request flags
              const hasRequest = Boolean(entry.requestID ?? entry.request_id);
              const rawReqStatus = entry.requestStatus ?? entry.request_status ?? 'Pending';
              const reqStatusClass = rawReqStatus.toLowerCase();

              return (
                <div
                  key={idx}
                  className={`
                    status-inner ${statusClass} 
                    ${searchTerm && entry.OE?.toLowerCase().includes(searchTerm.toLowerCase()) ? 'force-reveal' : ''}
                    ${!isEntryEditable ? (statusClass ? 'entry-locked' : 'entry-locked-na') : ''}
                    ${hasRequest ? 'has-pending-request' : ''}
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    const empId = entry.EmployeeID || empMetaId || '0';
                    const currentOE = entry.OE || entry.DMS_OE || '';
                    const currentStatus = entry.AttendanceStatus || 'ABSENT';

                    onCellClick(
                      e,
                      empName,
                      String(empId),
                      currentOE,
                      dateStr,
                      currentStatus,
                      oeValue,
                      isEntryEditable,
                      entry.Approved,
                      entry.attendanceID,
                      entry.requestID ?? entry.request_id,
                      entry.requestStatus ?? entry.request_status
                    );
                  }}
                  onMouseEnter={(e) => {
                    const isServed = entry.AttendanceStatus?.toUpperCase() === 'SERVED';
                    if (!isServed && entry.ModifiedAt && !e.currentTarget.getAttribute('title')) {
                      e.currentTarget.setAttribute('title', `Modified: ${new Date(entry.ModifiedAt).toLocaleString()}`);
                    }
                  }}
                >
                  {/* Lock icon for approval */}
                  {isApproved && (
                    <Lock
                      size={12}
                      strokeWidth={3}
                      className="approved-lock-icon"

                    />
                  )}

                  {/* File icon for active request */}
                  {hasRequest && (
                    <span
                      className={`request-rec-dot req-${reqStatusClass}`}
                      title={`Request: ${rawReqStatus}`}
                    />
                  )}

                  <span className="status-main-value">
                    {entry.AttendanceStatus?.toUpperCase() === 'SERVED' ? (
                      <div className="served-details">
                        <span className="served-oe">{entry.OE || 'NO OE'}</span>
                        <span className="served-meta">
                          {entry.tripIndex ?? 0}
                        </span>
                      </div>
                    ) : (
                      entry.AttendanceStatus || '---'
                    )}
                  </span>
                  {entry.AttendanceStatus?.toUpperCase() !== 'SERVED' && (
                    <span className="oe-hover-label">{entry.OE || ''}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div
              className={`
                status-inner status-na
                ${!isEditable ? 'entry-locked' : ''}
              `}
              onClick={(e) => {
                e.stopPropagation();
                const empId = empMetaId || '0';
                const currentOE = oeValue === '---' ? '' : oeValue;
                const currentStatus = 'ABSENT';

                onCellClick(
                  e,
                  empName,
                  String(empId),
                  currentOE,
                  dateStr,
                  currentStatus,
                  oeValue,
                  isEditable,
                  undefined,
                  undefined,
                  null,
                  null
                );
              }}
            >
              ---
            </div>
          )}
        </div>
      </div>
    </td>
  );
});

interface AttendanceSheetProps {
  liveTrips: any[]; // The table passed in
  colName: string[]; // e.g., "EmployeeName"
  colOE: string;    // e.g., "OE_Number"
  colStatus: string; // e.g., "Trip_Status"
  BU?: string | null | undefined;
  onLoadingChange?: (isLoading: boolean) => void;
}

const AttendanceSheet = React.forwardRef<AttendanceSheetRef, AttendanceSheetProps>(({
  liveTrips,
  colName,
  colOE,
  colStatus,
  BU = 'SBUO-1A,SBUO-1B',
  onLoadingChange,
}, ref) => {
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [rawAttendanceData, setRawAttendanceData] = useState<AttendanceRecord[]>([]);
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [cellLoadingStates, setCellLoadingStates] = useState<Record<string, boolean>>({});

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
    isEditable: boolean;
    Approval?: string;
    attendanceID: string;
    requestID?: string | null;
    requestStatus?: string | null;
  } | null>(null);

  const { addTask } = useTaskWorker();
  const { user, updateUser } = useUser();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, _setPageSize] = useState(25); //11

  // Initialize state from user object or fallback to 1
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    return user?.attendanceSheetZoom ? Number(user.attendanceSheetZoom) : 1;
  });

  // Helper function to update state AND trigger updateUser
  const updateZoom = (newZoom: number) => {
    const roundedZoom = Number(newZoom.toFixed(1)); // Prevents JS floating point precision issues (e.g., 1.1000000000000001)
    setZoomLevel(roundedZoom);

    // Sync to User Context / Backend
    if (updateUser) {
      updateUser({ attendanceSheetZoom: roundedZoom });
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const next = Math.min(prev + 0.1, 2);
      updateZoom(next);
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const next = Math.max(prev - 0.1, 0.7);
      updateZoom(next);
      return next;
    });
  };

  const handleZoomReset = () => {
    updateZoom(1);
  };

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
  const [selectedCutoff, setSelectedCutoff] = useState<CutoffGroup | null>(null);
  const [activeSummaryEmp, setActiveSummaryEmp] = useState<string | null>(null);


  const scrollToDateStr = useCallback((targetDateStr?: string) => {
    setTimeout(() => {
      if (!scrollContainerRef.current) return;

      let dateStr = targetDateStr;

      // Default to the latest date in the active month <= Today
      if (!dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (daysInMonth && daysInMonth.length > 0) {
          // Filter out any dates that are strictly in the future
          const validPastOrTodayDates = daysInMonth.filter(date => {
            const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            return checkDate <= today;
          });

          if (validPastOrTodayDates.length > 0) {
            // Latest valid date (Today if current month, or month's end if past month)
            const targetDate = validPastOrTodayDates[validPastOrTodayDates.length - 1];
            const y = targetDate.getFullYear();
            const m = String(targetDate.getMonth() + 1).padStart(2, '0');
            const d = String(targetDate.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
          } else {
            // If viewing a future month, default to the 1st of that month
            const firstDate = daysInMonth[0];
            const y = firstDate.getFullYear();
            const m = String(firstDate.getMonth() + 1).padStart(2, '0');
            const d = String(firstDate.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
          }
        }
      }

      if (!dateStr) return;

      // Locate the header cell with the matching data-date attribute
      const targetEl = scrollContainerRef.current.querySelector<HTMLElement>(`[data-date="${dateStr}"]`);

      if (targetEl) {
        const container = scrollContainerRef.current;
        const containerWidth = container.clientWidth;
        const targetWidth = targetEl.offsetWidth;
        const scrollPos = targetEl.offsetLeft - (containerWidth / 2) + (targetWidth / 2);

        container.scrollTo({
          left: scrollPos,
          behavior: 'smooth'
        });
      }
    }, 150);
  }, [currentDate]);


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
    e.preventDefault();

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

  const handleUpdateAttendanceStatus = async (
    newAttendance: string,
    empId: string,
    empName: string,
    OE: string,
    attendanceDate?: Date
  ) => {
    if (!attendanceDate) return;

    const year = attendanceDate.getFullYear();
    const month = String(attendanceDate.getMonth() + 1).padStart(2, '0');
    const day = String(attendanceDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const cellKey = `${empId}-${dateStr}`;

    setCellLoadingStates(prev => ({ ...prev, [cellKey]: true }));

    // 1. Capture snapshots of the current state before modifying it for rollback
    let previousRecord: AttendanceRecord | null = null;
    let hadExistingRecord = false;

    const updateRecordList = (prevData: AttendanceRecord[]) => {
      const targetIdx = prevData.findIndex(
        item => String(item.EmployeeID) === String(empId) && item.AttendanceDate.split('T')[0] === dateStr
      );

      const updated = [...prevData];

      if (targetIdx !== -1) {
        previousRecord = { ...updated[targetIdx] };
        hadExistingRecord = true;
        updated[targetIdx] = {
          ...updated[targetIdx],
          AttendanceStatus: newAttendance,
          ModifiedAt: new Date().toISOString(),
          ModifiedBy: user?.FullName || 'Unknown User'
        };
      } else {
        hadExistingRecord = false;
        const targetMeta = employeeMetaMap[empName];

        updated.push({
          EmployeeName: empName,
          EmployeeID: Number(empId),
          AttendanceDate: dateStr,
          AttendanceStatus: newAttendance,
          OE: OE || null,
          Position: targetMeta?.position || 'Driver',
          ModifiedAt: new Date().toISOString(),
          ModifiedBy: user?.FullName || 'Unknown User'
        });
      }
      return updated;
    };

    // Optimistically update BOTH table view data AND raw modal data
    setData(prevData => updateRecordList(prevData));
    setRawAttendanceData(prevRaw => updateRecordList(prevRaw));

    // 2. Queue the task worker
    addTask({
      id: `attendance-update-${empId}-${dateStr}-${Date.now()}`,
      name: `Employee Attendance Update`,
      execute: async () => {
        try {
          await UpsertAttendanceLogService.UpsertAttendanceLog({
            EmployeeName: empName,
            EmployeeID: empId,
            AttendanceDate: dateStr,
            AttendanceStatus: newAttendance || 'PRESENT',
            OE: OE || '',
            ModifiedBy: user?.FullName || 'Unknown User'
          } as any);
          return { success: true };
        } catch (error) {
          console.error("Fetch error:", error);
          return { success: false, error };
        }
      },
      checkSuccess: (result: { success: boolean }) => result.success,
      onSuccess: () => {
        setCellLoadingStates(prev => ({ ...prev, [cellKey]: false }));
      },
      onFailure: () => {
        setCellLoadingStates(prev => ({ ...prev, [cellKey]: false }));

        // Revert rollback for BOTH data sources on failure
        const revertRecordList = (prevList: AttendanceRecord[]) => {
          const updated = [...prevList];
          const targetIdx = updated.findIndex(
            item => String(item.EmployeeID) === String(empId) && item.AttendanceDate.split('T')[0] === dateStr
          );

          if (targetIdx !== -1) {
            if (hadExistingRecord && previousRecord) {
              updated[targetIdx] = previousRecord;
            } else {
              updated.splice(targetIdx, 1);
            }
          }
          return updated;
        };

        setData(prevData => revertRecordList(prevData));
        setRawAttendanceData(prevRaw => revertRecordList(prevRaw));
      },
      message: `Setting attendance for ${empName}...`,
      message_success: `${empName} tagged '${newAttendance || 'PRESENT'}' successfully!`,
      message_failure: `${empName} failed to be tagged '${newAttendance || 'PRESENT'}'.`
    });
  };



  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBannerMessage = (msg: string) => {
    // 1. Clear any pending timeout to prevent premature erasure if a new message arrives
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }

    // 2. Commit the new text payload to state instantly
    setBannerMessage(msg);

    // 3. Queue a clean exit layout reset exactly 2 seconds later
    bannerTimeoutRef.current = setTimeout(() => {
      setBannerMessage(null);
      bannerTimeoutRef.current = null;
    }, 1000); // 2000ms = 2 seconds
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

  // Track if the Create Late Attendance Request modal is open
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false);

  // Form state for creating late request
  const [requestFormData, setRequestFormData] = useState({
    Employee: '',
    Date: '',
    Attendance: 'ABSENT',
    Trip: '',
    Approval: 'Not Approved',
    RequestDeletion: false,
    remarks: '',
    attendanceID: '',
  });
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [lateAttendanceRequests, setLateAttendanceRequests] = useState<any[]>([]);
  const fetchLateAttendanceRequests = useCallback(async () => {

    const pad = (n: number) => String(n).padStart(2, '0');

    // Last day of the requested month
    const lastDay = new Date(year, month, 0).getDate();

    // Explicit UTC ISO strings with full time boundaries
    const monthStartStr = `${year}-${pad(month)}-01T00:00:00.000Z`;
    const monthEndStr = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59.999Z`;

    console.log("Fetching late attendance requests with date range:", monthStartStr, "to", monthEndStr);

    // Convert "2026-03-26" to 20260326 for your SQL OEDateAsInt column
    const fromInt = ISOtoInt(monthStartStr, true);
    const toInt = ISOtoInt(monthEndStr, true);

    console.log("as int start: ", fromInt, " as int end: ", toInt)

    const dateFilter = `created_at_as_int ge ${fromInt} and created_at_as_int le ${toInt}`;

    const options = {
      filter: dateFilter, // Pass the filter here!
      orderBy: ["created_at_as_int desc"]
    }

    try {
      const result = await ewulFetchAll<any>(
        Late_Attendance_RequestsService,
        options,
        500
      );

      // console.log("Fetched late attendance requests:", result);


      // 'result' is the actual Array now!
      if (result && result.length > 0) {
        setLateAttendanceRequests(result);
      } else {
        setLateAttendanceRequests([]);
      }

    } catch (err) {
      console.error("Fetch Error during batching:", err);
      setLateAttendanceRequests([]);
    } finally {
      console.log("Fetch late attendance requests completed with count:", lateAttendanceRequests.length);
    }

  }, [year, month, lateAttendanceRequests.length]);

  useEffect(() => {
    fetchLateAttendanceRequests();
  }, []);

  const handleCreateRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Resolve cutoff date target
    const targetCutoff = cutoffGroups.find(group =>
      group.dates.includes(requestFormData.Date)
    ) || selectedCutoff;

    // 2. Build payload
    const payload = {
      employee_name: requestFormData.Employee,
      request_date: requestFormData.Date,
      attendance_status: requestFormData.Attendance,
      OE: requestFormData.Trip,
      request_status: 'Pending',
      request_to_delete: requestFormData.RequestDeletion,
      requested_by: user?.FullName || 'Unknown User',
      cutoff_start: targetCutoff?.startDate || '',
      cutoff_end: targetCutoff?.endDate || '',
      remarks: requestFormData?.remarks,
      attendanceID: requestFormData.attendanceID,
      attendance_approval: requestFormData.Approval === 'Approved' ? 'Approved' : null,
    } as Partial<Late_Attendance_Requests>;

    // 3. Close modal instantly for seamless UI response
    setShowCreateRequestModal(false);

    // 4. Queue task to background worker
    const taskId = `late-request-create-${requestFormData.Employee}-${requestFormData.Date}-${Date.now()}`;

    addTask({
      id: taskId,
      name: `Create Late Attendance Request`,
      execute: async () => {
        try {
          const result = await Late_Attendance_RequestsService.create(payload as any);
          console.log('creating late attendance request: ', payload);
          console.log('late attendance request result: ', result);
          return { success: true, data: result };
        } catch (error) {
          console.error("Task worker error creating request:", error);
          return { success: false, error };
        }
      },
      checkSuccess: (result: { success: boolean }) => result.success,
      onSuccess: async () => {
        // Refresh requests data upon worker success
        await fetchLateAttendanceRequests();
      },
      onFailure: () => {
        // Optionally notify user or handle error state
        console.error(`Failed to submit request for ${requestFormData.Employee}`);
      },
      message: `Submitting late attendance request for ${requestFormData.Employee}...`,
      message_success: `Late request for ${requestFormData.Employee} submitted successfully!`,
      message_failure: `Failed to submit late request for ${requestFormData.Employee}.`
    });
  };



  // 1. Add a ref near your other useRef declarations
  const lastScrolledTargetRef = useRef<string | null>(null);

  // 2. Modify the data-load effect to scroll ONLY on first load of the selected date
  useEffect(() => {
    if (!loading && selectedCutoff?.endDate) {
      const currentTargetKey = `${year}-${month}`;

      // Execute scroll only if this target date/month hasn't been scrolled yet
      if (lastScrolledTargetRef.current !== currentTargetKey) {
        scrollToDateStr(selectedCutoff.endDate);
        lastScrolledTargetRef.current = currentTargetKey;
      }
    }
  }, [loading, selectedCutoff, year, month, scrollToDateStr]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Extract fetch logic so it can be re-used
  const fetchAttendance = useCallback(async () => {
    console.log('fetching data...')
    setLoading(true);
    try {
      const res = await FetchAttendanceCalendarService.FetchAttendanceCalendar({
        Year: year,
        Month: month,
        BU: BU || 'SBUO-1A,SBUO-1B',
        CutoffStartDay: 5,
        CutoffEndDay: 4
      } as any);
      // console.log('fetching attendance successfull...', res)
      const rawData = (res.data?.ResultSets?.Table1 || []) as any;



      // // --- DEBUG LOG START ---
      // if (rawData.length > 0) {
      //   const dates = rawData
      //     .map((item: any) => item.AttendanceDate?.split('T')[0])
      //     .filter(Boolean)
      //     .sort();

      //   if (dates.length > 0) {
      //     console.log(`📅 [Attendance Range]: ${dates[0]} ➔ ${dates[dates.length - 1]} (Total: ${rawData.length} rows)`);
      //   }
      // } else {
      //   console.log('⚠️ [Attendance Range]: No records returned.');
      // }
      // // --- DEBUG LOG END ---

      setData(rawData as any);

      const formattedRecords: AttendanceRecord[] = rawData.map((item: any) => ({
        EmployeeName: item.EmployeeName ?? '',
        EmployeeID: item.EmployeeID ?? 0,
        AttendanceDate: item.AttendanceDate ?? '',
        AttendanceStatus: item.AttendanceStatus ?? 'ABSENT',
        OE: item.OE ?? null,
        Position: item.Position ?? 'Driver',
        ModifiedAt: item.ModifiedAt ?? null,
        tripIndex: item.tripIndex !== undefined && item.tripIndex !== null ? Number(item.tripIndex) : null,
        DMS_OE: item.DMS_OE ?? null,
        DMS_TripStatus: item.DMS_TripStatus ?? null,
        BU: item.BU ?? null,
        Position1: item.Position1 ?? item.Position ?? 'Driver',
        SD: item.SD ?? null,
        TCVC: item.TCVC ?? null,
        TransactionType: item.TransactionType ?? null,
        secondTrip: item.secondTrip ?? 'N',
        tripKM: item.tripKM !== undefined && item.tripKM !== null ? Number(item.tripKM) : null,
        Approved: item.Approved ?? null,
        spID: item.spID ?? null,
        ModifiedBy: item.ModifiedBy ?? null,
        ApprovedBy: item.ApprovedBy ?? null,
        attendanceID: item.attendanceID ?? null,
      }));

      setRawAttendanceData(formattedRecords);


    } catch (error) {
      console.error("Fetch error:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, BU, scrollToDateStr]);

  // Expose the refresh function to parent ref
  React.useImperativeHandle(ref, () => ({
    refresh: fetchAttendance
  }), [fetchAttendance]);

  // Re-fetch automatically when date/BU changes
  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // 1. Generate Header Dates based on actual records returned by SP
  const daysInMonth = useMemo(() => {
    // Fallback: If no data yet, default to standard 1st-to-end of month while loading
    if (!data || data.length === 0) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const days = [];
      while (date.getMonth() === currentDate.getMonth()) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
      }
      return days;
    }

    // Extract unique AttendanceDate strings from SQL response
    const dateMap = new Map<string, Date>();

    data.forEach(item => {
      if (item.AttendanceDate) {
        const dateStr = item.AttendanceDate.split('T')[0];
        if (!dateMap.has(dateStr)) {
          // Parse date as local time (YYYY-MM-DD)
          const [y, m, d] = dateStr.split('-').map(Number);
          dateMap.set(dateStr, new Date(y, m - 1, d));
        }
      }
    });

    // Sort dates chronologically
    return Array.from(dateMap.values()).sort((a, b) => a.getTime() - b.getTime());
  }, [data, currentDate]);

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
      if (!item.AttendanceDate) return;

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

        entries.sort((a, b) => {
          // 1. Prioritize SERVED only when "Latest Only" (!showAllStatuses) is active
          if (!showAllStatuses) {
            const aServed = a.AttendanceStatus?.toUpperCase() === 'SERVED' ? 1 : 0;
            const bServed = b.AttendanceStatus?.toUpperCase() === 'SERVED' ? 1 : 0;

            if (aServed !== bServed) {
              return aServed - bServed; // Pushes SERVED to the end so lastEntry picks SERVED
            }
          }

          // 2. Default / Original Sort: Chronological by timestamp
          return a.modifiedAt - b.modifiedAt;
        });

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
  }, [filteredData, paginatedEmployeeNames, showAllStatuses]);


  const boundaryDateStr = useMemo(() => {
    const allowedStart = ALLOWED_DATE_CLICK.startDate;
    // Find the exact date in our array that marks the start of the editable zone
    const match = daysInMonth.find(date => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}` >= allowedStart;
    });

    if (!match) return null;
    const y = match.getFullYear();
    const m = String(match.getMonth() + 1).padStart(2, '0');
    const d = String(match.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [daysInMonth]);

  const endBoundaryDateStr = useMemo(() => {
    const allowedEnd = ALLOWED_DATE_CLICK.endDate;
    const match = daysInMonth.find(date => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}` === allowedEnd;
    });

    if (!match) return null;
    const y = match.getFullYear();
    const m = String(match.getMonth() + 1).padStart(2, '0');
    const d = String(match.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [daysInMonth]);

  // 1. Compute cutoff groups with exact start/end dates
  const cutoffGroups = useMemo(() => {
    const getFirstCutoffAnchor = (startDay: number, current: Date): Date => {
      const yr = current.getFullYear();
      const mo = current.getMonth();
      const target = new Date(yr, mo, 1);
      while (target.getDay() !== startDay) {
        target.setDate(target.getDate() + 1);
      }
      return target;
    };

    const groups: CutoffGroup[] = [];
    const firstTrueAnchor = getFirstCutoffAnchor(ALLOWED_DATE_CLICK.startDayOfWeek, currentDate);

    daysInMonth.forEach((date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      let label = '';
      let isLastMonth = false;

      if (date < firstTrueAnchor) {
        label = "LAST MONTH CUT OFF";
        isLastMonth = true;
      } else {
        const diffTime = date.getTime() - firstTrueAnchor.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const cutoffIndex = Math.floor(diffDays / 7) + 1;

        let ordinal = 'th';
        if (cutoffIndex === 1) ordinal = 'st';
        else if (cutoffIndex === 2) ordinal = 'nd';
        else if (cutoffIndex === 3) ordinal = 'rd';

        label = `${cutoffIndex}${ordinal} CUT OFF`;
      }

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === label) {
        lastGroup.count++;
        lastGroup.endDate = dateStr;
        lastGroup.dates.push(dateStr);
      } else {
        groups.push({
          label,
          count: 1,
          isLastMonth,
          startDate: dateStr,
          endDate: dateStr,
          dates: [dateStr],
        });
      }
    });

    return groups;
  }, [daysInMonth, currentDate]);

  // 2. Automatically pick the latest cutoff when month/year changes
  useEffect(() => {
    if (cutoffGroups.length === 0) return;

    // 1. Try to find the cutoff group that contains TODAY
    const todayCutoff = cutoffGroups.find(group => group.dates.includes(todayStr));

    // 2. Fall back to finding the cutoff group matching your active truth config cutoff start date
    const configCutoff = cutoffGroups.find(group => group.dates.includes(ALLOWED_DATE_CLICK.startDate));

    // 3. Fall back to the latest cutoff group of the viewed month
    const defaultCutoff = todayCutoff || configCutoff || cutoffGroups[cutoffGroups.length - 1];

    setSelectedCutoff(defaultCutoff);
  }, [cutoffGroups]); // Fires on mount when cutoffGroups initializes



  // Handler to process optimistic updates from EmployeeSummaryModal
  const handleOptimisticSummaryUpdate = useCallback((updatedRecords: AttendanceRecord[]) => {
    const applyUpdates = (prevList: AttendanceRecord[]) => {
      let listCopy = [...prevList];

      updatedRecords.forEach((updatedRec) => {
        const targetDate = updatedRec.AttendanceDate?.split('T')[0];
        const targetOE = (updatedRec.OE || '').trim();

        // Find target by unique IDs first, then fallback to composite key
        const index = listCopy.findIndex((item) => {
          if (updatedRec.spID && item.spID) {
            return item.spID === updatedRec.spID;
          }
          if (updatedRec.attendanceID && item.attendanceID) {
            return item.attendanceID === updatedRec.attendanceID;
          }
          const itemDate = item.AttendanceDate?.split('T')[0];
          const itemOE = (item.OE || '').trim();
          return (
            item.EmployeeName === updatedRec.EmployeeName &&
            itemDate === targetDate &&
            itemOE === targetOE
          );
        });

        // 1. Handle Deletion
        if (updatedRec.isDeleted) {
          if (index !== -1) {
            listCopy.splice(index, 1);
          }
          return;
        }

        // 2. Handle Update or Create
        if (index !== -1) {
          // Merge changed properties
          listCopy[index] = {
            ...listCopy[index],
            ...updatedRec,
          };
        } else {
          // Append newly created record
          listCopy.push(updatedRec);
        }
      });

      return listCopy;
    };

    // Update both UI state and raw data cache
    setData((prevData) => applyUpdates(prevData));
    setRawAttendanceData((prevRaw) => applyUpdates(prevRaw));
  }, []);



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

    // if (map['Pama, Elebert Palma']) {
    //   console.log('Target Driver Trip Data Found:', map['Pama, Elebert Palma']);
    // } else {
    //   console.log('Target Driver NOT found in liveTripsMap keys:', Object.keys(map));
    // }


    return map;
  }, [liveTrips, colName]);


  const employeeMetaMap = useMemo(() => {
    const map: Record<string, { id: number; position: string; dmsOE?: string; dmsStatus?: string; BU?: string }> = {};

    filteredData.forEach(item => {
      if (!map[item.EmployeeName]) {
        map[item.EmployeeName] = {
          id: item.EmployeeID,
          position: item.Position,
          dmsOE: item.DMS_OE || undefined,
          dmsStatus: item.DMS_TripStatus || undefined,
          BU: item.BU || '',
        };
      } else if (!map[item.EmployeeName].dmsOE && item.DMS_OE) {
        // Pick up DMS_OE and BU if a subsequent row has it populated
        map[item.EmployeeName].dmsOE = item.DMS_OE;
        map[item.EmployeeName].dmsStatus = item.DMS_TripStatus || undefined;
        map[item.EmployeeName].BU = item.BU || map[item.EmployeeName].BU;
      }
    });

    return map;
  }, [filteredData]);


  const employeeCutoffMetricsMap = useMemo(() => {
    const result: Record<string, {
      score: number;
      servedCount: number;
      bigasCount: number;
      bigasKilos: string;
    }> = {};

    // Early return empty result object if no cutoff is selected
    if (!selectedCutoff) return result;

    const map: Record<string, {
      totalScore: number;
      servedOEs: Set<string>;
      eligibleBigasCount: number;
    }> = {};
    const { startDate, endDate } = selectedCutoff;

    filteredData.forEach(item => {
      const dateStr = item.AttendanceDate ? item.AttendanceDate.split('T')[0] : '';

      if (dateStr >= startDate && dateStr <= endDate) {
        if (!map[item.EmployeeName]) {
          map[item.EmployeeName] = {
            totalScore: 0,
            servedOEs: new Set(),
            eligibleBigasCount: 0
          };
        }

        const score = Number(item.tripIndex) || 0;
        map[item.EmployeeName].totalScore += score;

        const status = item.AttendanceStatus?.toUpperCase();
        const isApproved = item.Approved === 'Approved';
        const oe = item.OE?.trim();

        if (status === 'SERVED' && oe && oe !== '---') {
          map[item.EmployeeName].servedOEs.add(oe);
        }

        // Track records where status is SERVED and Approved is Approved
        if (status === 'SERVED' && isApproved) {
          map[item.EmployeeName].eligibleBigasCount += 1;
        }
      }
    });

    Object.keys(map).forEach(name => {
      const eligibleCount = map[name].eligibleBigasCount;

      let bigasKilos = '0 kilos';
      if (eligibleCount >= 6) {
        bigasKilos = '10 kilos';
      } else if (eligibleCount >= 4) {
        bigasKilos = '5 kilos';
      }

      result[name] = {
        score: map[name].totalScore,
        servedCount: map[name].servedOEs.size,
        bigasCount: eligibleCount,
        bigasKilos,
      };
    });

    return result;
  }, [filteredData, selectedCutoff]);

  // @ts-ignore 
  const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleCellContextOpen = useCallback((
    e: React.MouseEvent,
    empName: string,
    empId: string,
    currentOE: string,
    dateStr: string,
    currentStatus: string,
    liveOE: string,
    isEditable: boolean,
    Approval?: string,
    attendanceID?: string,
    requestID?: string | null,
    requestStatus?: string | null
  ) => {
    // Prevent menu from opening for future dates
    if (dateStr > todayStr) {
      handleBannerMessage("Cannot log or modify attendance for future dates.");
      return;
    };

    // Convert target dateStr back into standard date configuration safely
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDateObject = new Date(y, m - 1, d);

    const clickY = e.clientY;
    const windowHeight = window.innerHeight;

    // Estimate context menu height (~250px)
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
      isEditable,
      Approval,
      attendanceID: attendanceID || '',
      requestID: requestID || null,
      requestStatus: requestStatus || null,
    });
  }, [todayStr]); // Added todayStr to dependencies

  useEffect(() => {
    if (!activeMenu || !scrollContainerRef.current) return;

    // const container = scrollContainerRef.current;

    const handleScroll = () => {
      // Option A: Close menu on scroll (Standard UI pattern for context menus)
      setActiveMenu(null);
    };

    const handleOutsideClick = (event: MouseEvent) => {
      // If the click is outside the context menu container, close it quietly
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    // Listen globally in the capture phase to react instantly
    window.addEventListener('mousedown', handleOutsideClick, true);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeMenu]);



  return (
    <div
      className="attendance-container"
      style={{
        // Pass the zoom multiplier directly into CSS variables
        '--grid-zoom': zoomLevel,
        '--grid-font-scale': `${zoomLevel}rem`,
      } as React.CSSProperties}
    >

      <div className="attendance-control-header">

        {/* LEFT CONTROL */}
        <div className="header-section left" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          <button style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => { fetchLateAttendanceRequests(); setShowRequestsModal(true); }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} />
              {(() => {
                const pendingCount = lateAttendanceRequests.filter((req: any) => req.request_status === 'Pending').length;
                return pendingCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-10px',
                    background: '#e74c3c',
                    color: 'white',
                    borderRadius: '50%',
                    padding: '2px 5px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    lineHeight: 1
                  }}>{pendingCount}</span>
                );
              })()}
            </div>
            <span>Attendance Requests</span>
          </button>
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

          <button className="gsdc-today-btn" onClick={() => scrollToDateStr()}>
            <PinIcon size={14} />
            Today
          </button>
        </div>


        {/* RIGHT CONTROL */}
        <div className="header-section right">

          {/* ADD ZOOM CONTROLS HERE */}
          <div className="zoom-controls-group" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {zoomLevel !== 1 && (
              <button
                onClick={handleZoomReset}
                title="Reset Zoom"
                className="gsdc-toggle-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}

            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="gsdc-toggle-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px' }}
            >
              <ZoomOut size={14} />
            </button>

            <span style={{ fontSize: '12px', minWidth: '38px', textAlign: 'center', fontWeight: 'bold' }}>
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="gsdc-toggle-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px' }}
            >
              <ZoomIn size={14} />
            </button>
          </div>

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
            title={showAllStatuses ? "Show Latest Status Only" : "Show All Status"}
          >
            {showAllStatuses ? "Showing All" : "Latest Only"}
          </button>

        </div>



      </div>
      <>
        <div
          className={`attendance-scroll-area ${isDragging ? 'grabbing' : ''}`}
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeaveOrUp}
          onMouseUp={handleMouseLeaveOrUp}
          onMouseMove={handleMouseMove}
          style={{ position: 'relative' }}
        >
          <div
            style={{
              position: 'sticky',
              left: 0,
              right: 0,
              top: '10px',
              display: 'flex',
              justifyContent: 'center',
              zIndex: 100,
              pointerEvents: 'none',
              height: 0, // Prevents pushing table headers down
            }}
          >
            <HeaderSyncBadge loading={showOverlay} label="Syncing attendance..." />
          </div>
          <table className="attendance-table">
            <thead>
              <tr>
                <th className="sticky-col sticky-header cutoff-super-header-fortitle">
                  <div className="super-header-title">Cutoff Groups</div>
                </th>
                {/* Cutoff Super-Headers */}
                {(() => {
                  let regularCutoffCounter = 0;

                  return cutoffGroups.map((group, idx) => {
                    let alternatingClass = 'last-month-bg';

                    if (!group.isLastMonth) {
                      alternatingClass = regularCutoffCounter % 2 === 0 ? 'odd-cutoff' : 'even-cutoff';
                      regularCutoffCounter++;
                    }

                    const isSelected = selectedCutoff?.startDate === group.startDate && selectedCutoff?.endDate === group.endDate;

                    return (
                      <th
                        key={idx}
                        colSpan={group.count}
                        onClick={() => setSelectedCutoff(group)}
                        className={`sticky-header cutoff-super-header group-span-cell ${alternatingClass} ${isSelected ? 'active-cutoff-header' : ''}`}
                        style={{ cursor: 'pointer' }}
                        title={`Click to focus ${group.label} (${group.startDate} to ${group.endDate})`}
                      >
                        <span className="cutoff-text-header">
                          {group.label} {isSelected ? '(SELECTED)' : ''}
                        </span>
                      </th>
                    );
                  });
                })()}
              </tr>

              {/* 🟢 BOTTOM ROW: Dynamic Date Headers Matching Parent Colors */}
              <tr>
                <th className="sticky-col sticky-header employee-name-header">
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

                {(() => {
                  const getFirstCutoffAnchor = (startDay: number, current: Date): Date => {
                    const year = current.getFullYear();
                    const month = current.getMonth();
                    const target = new Date(year, month, 1);
                    while (target.getDay() !== startDay) {
                      target.setDate(target.getDate() + 1);
                    }
                    return target;
                  };

                  const firstTrueAnchor = getFirstCutoffAnchor(ALLOWED_DATE_CLICK.startDayOfWeek, currentDate);
                  let regularCutoffCounter = 0;
                  let lastLoggedLabel = '';

                  return daysInMonth.map((date, index) => {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    const dateStr = `${y}-${m}-${d}`;

                    const dayOfWeek = date.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const isToday = dateStr === todayStr;

                    const isBoundary = dateStr === boundaryDateStr;
                    const isEndBoundary = dateStr === endBoundaryDateStr;

                    // Check if date belongs to a different month
                    const isDifferentMonth = date.getMonth() !== currentDate.getMonth();

                    // Get 3-letter uppercase month (e.g., 'JUL', 'SEP')
                    const monthAbbrev = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

                    // Display 'JUL 30' for extra days, or just '30' for the current month
                    const dateDisplay = isDifferentMonth
                      ? `${monthAbbrev} ${date.getDate()}`
                      : date.getDate();


                    // Compute cutoff group context
                    let currentLabel = '';
                    let isLastMonth = false;

                    if (date < firstTrueAnchor) {
                      currentLabel = "LAST MONTH CUT OFF";
                      isLastMonth = true;
                    } else {
                      const diffTime = date.getTime() - firstTrueAnchor.getTime();
                      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      const cutoffIndex = Math.floor(diffDays / 7) + 1;
                      currentLabel = `${cutoffIndex} CUT OFF`;
                    }

                    // 🔴 DETECT FIRST DAY OF CUTOFF: Brand new label string OR index 0
                    const isFirstDayOfCutoff = index === 0 || (lastLoggedLabel !== '' && lastLoggedLabel !== currentLabel);

                    if (lastLoggedLabel !== '' && lastLoggedLabel !== currentLabel && !isLastMonth) {
                      regularCutoffCounter++;
                    }
                    lastLoggedLabel = currentLabel;

                    let matchingColorClass = 'last-month-bg';
                    if (!isLastMonth) {
                      matchingColorClass = regularCutoffCounter % 2 === 0 ? 'odd-cutoff' : 'even-cutoff';
                    }

                    const isCellInSelectedCutoff = selectedCutoff ? (dateStr >= selectedCutoff.startDate && dateStr <= selectedCutoff.endDate) : false;
                    const isCutoffStart = selectedCutoff?.startDate === dateStr;
                    const isCutoffEnd = selectedCutoff?.endDate === dateStr;

                    return (
                      <th
                        key={dateStr}
                        data-date={dateStr}
                        ref={isToday ? todayRef : null}
                        className={`sticky-header date-sub-header ${matchingColorClass}
                        ${isToday ? 'today-column' : ''} 
                        ${isWeekend ? 'weekend-column' : ''}
                        ${/*dayOfWeek === 0 ? 'sunday' : ''*/''}
                        ${isBoundary ? 'lock-boundary-edge' : ''}
                        ${isEndBoundary ? 'lock-end-boundary' : ''}
                        ${isFirstDayOfCutoff ? 'cutoff-start-column' : ''} 
                        ${isCellInSelectedCutoff ? 'selected-cutoff-col' : ''}
                        ${isCutoffStart ? 'selected-cutoff-boundary-start' : ''}
                        ${isCutoffEnd ? 'selected-cutoff-boundary-end' : ''}
                      `}
                      >
                        {isToday &&
                          <span className="today-label-flag">
                            <Star size={10} strokeWidth={3} className="today-star-icon" />
                            TODAY
                          </span>
                        }
                        <div className="header-date-box">
                          <span className="day-name">
                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                          <span className={`day-num ${isDifferentMonth ? 'different-month-num' : ''}`}>
                            {dateDisplay}
                          </span>
                        </div>
                      </th>
                    );
                  });
                })()}
              </tr>
            </thead>
            <tbody>
              {showSkeleton ? (
                <AttendanceSkeleton days={daysInMonth} />
              ) : (
                paginatedEmployeeNames.map(name => {
                  const meta = employeeMetaMap[name];
                  // Find trip info for the current employee from liveTrips table

                  // 1. Read directly from API data first, then fall back to liveTripsMap, then '---'
                  const tripInfo = liveTripsMap[name];
                  const oeValue = meta?.dmsOE || (tripInfo ? tripInfo[colOE] : null) || '---';
                  const tripStatus = meta?.dmsStatus || (tripInfo ? tripInfo[colStatus] : null);

                  // Retrieve cutoff summary metrics
                  const metrics = employeeCutoffMetricsMap[name] || { score: 0, servedCount: 0 };
                  const employeeData = pageGroupedData[name] || { positions: '', dates: {} };

                  return (
                    <tr key={name}>
                      <td
                        className="sticky-col emp-name"
                        title={`${name} - ${employeeData.positions || ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSummaryEmp(name);
                        }}
                      >
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

                            {/* Primary Employee Name + Summary Icon */}
                            <div className="primary-name-row">
                              <span
                                className="primary-name-text clickable-name"
                                title="Click to view employee summary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSummaryEmp(name);
                                }}
                              >
                                <HighlightText text={name} highlight={searchTerm} />
                              </span>

                              <div
                                className="summary-icon-btn"
                                title="View Employee Summary"
                              >
                                {meta.BU?.slice(-2) || 'N/A'}
                              </div>
                            </div>

                            {/* Tier 2: Current Live Trip Status */}
                            <div className="secondary-oe-row">
                              <div className="oe-left-group">
                                <span className="oe-label">Trip:</span>
                                <span className="oe-value">{oeValue}</span>
                              </div>

                              {tripStatus && (
                                <div className="oe-status-tag">
                                  {tripStatus}
                                </div>
                              )}
                            </div>

                            {/* Tier 3: Cutoff Summary Metrics Bar */}
                            <div className="cutoff-metrics-row">
                              <span
                                className="metric-pill served"
                                title={`Unique Served Trips in current cutoff (${ALLOWED_DATE_CLICK.startDate} to ${ALLOWED_DATE_CLICK.endDate})`}
                              >
                                <b>{metrics.servedCount}</b> Served
                              </span>

                              <span
                                className="metric-pill score"
                                title={`Accumulated Trip Score in current cutoff (${ALLOWED_DATE_CLICK.startDate} to ${ALLOWED_DATE_CLICK.endDate})`}
                              >
                                <b>{metrics.score > 0 ? metrics.score.toFixed(2) : '0'}</b> pts
                              </span>

                              {/* New Bigas Metric Pill */}
                              <span
                                className="metric-pill bigas"
                                title={`Bigas Allowance (${metrics.bigasCount || 0} approved served trips in cutoff)`}
                              >
                                <b>{metrics.bigasKilos || '0 kilos'}</b>
                              </span>
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

                        const isBoundary = dateStr === boundaryDateStr;
                        const isEndBoundary = dateStr === endBoundaryDateStr;

                        const cellKey = `${meta?.id || '0'}-${dateStr}`;
                        const isCellLoading = !!cellLoadingStates[cellKey];

                        const isCellInSelectedCutoff = selectedCutoff ? (dateStr >= selectedCutoff.startDate && dateStr <= selectedCutoff.endDate) : false;
                        const isCutoffStart = selectedCutoff?.startDate === dateStr;
                        const isCutoffEnd = selectedCutoff?.endDate === dateStr;



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
                            isBoundaryCell={isBoundary}
                            isEndBoundaryCell={isEndBoundary}
                            onBannerMsg={handleBannerMessage}
                            isCellLoading={isCellLoading}
                            // Add cutoff selection flags below:
                            isSelectedCutoff={isCellInSelectedCutoff}
                            isCutoffStart={isCutoffStart}
                            isCutoffEnd={isCutoffEnd}
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
      </>


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
            {/* <button
              className="context-timeline-btn"
              title="Feature Coming Soon"
              onClick={(e) => {
                e.stopPropagation();
                // Future feature hook goes here
                console.log("Opening timeline history for:", activeMenu.empName);
              }}
            >
              View Timelogs
            </button> */}
            {!activeMenu.isEditable && (
              <button
                className="context-request-btn context-timeline-btn"
                style={{
                  marginTop: '5px',
                  background: activeMenu.requestID ? '#3a4efc' : 'var(--color-green)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();

                  if (activeMenu.requestID) {
                    // Open requests list view if request already exists
                    fetchLateAttendanceRequests();
                    setShowRequestsModal(true);
                  } else {
                    // Auto-fill and open creation modal if no request exists
                    setRequestFormData({
                      Employee: activeMenu.empName,
                      Date: activeMenu.dateStr,
                      Attendance: activeMenu.currentStatus || 'ABSENT',
                      Trip: activeMenu.oeValue || '',
                      Approval: activeMenu.Approval || 'Not Approved',
                      RequestDeletion: false,
                      remarks: '',
                      attendanceID: activeMenu.attendanceID,
                    });
                    setShowCreateRequestModal(true);
                  }

                  setActiveMenu(null);
                }}
              >
                {activeMenu.requestID
                  ? `View Request: ${activeMenu.requestStatus || 'Pending'}`
                  : '+ Request'}
              </button>
            )}
          </div>
          <hr />
          <div className="context-options-list">
            {getFilteredStatuses(activeMenu.oeValue).map((statusObj) => {
              const isCurrentlySelected = activeMenu.currentStatus?.toUpperCase() === statusObj.Status?.toUpperCase();
              return (
                <button
                  key={statusObj.Status}
                  className={`context-option-btn ${statusObj.onduty ? 'on-duty' : 'off-duty'} ${isCurrentlySelected ? 'active-status-highlight' : ''}`}
                  disabled={!activeMenu.isEditable}
                  style={{ opacity: activeMenu.isEditable ? 1 : 0.5, cursor: activeMenu.isEditable ? 'pointer' : 'not-allowed' }}
                  onClick={() => {
                    if (!activeMenu.isEditable) return;
                    const selectedStatus = statusObj.Status;
                    setActiveMenu(null);

                    // Fire asynchronously—the component will handle local state and workers under the hood
                    handleUpdateAttendanceStatus(
                      selectedStatus,
                      activeMenu.empId,
                      activeMenu.empName,
                      activeMenu.oeValue,
                      activeMenu.date
                    );
                  }}
                >
                  {statusObj.Alias}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showRequestsModal && (
        <Modal onClose={() => setShowRequestsModal(false)} width="80vw" height="80vh">
          <div className="attendance-requests-modal-container">
            <h2 className="attendance-requests-modal-header">Attendance Requests</h2>
            <div className="attendance-requests-modal-body">
              <TableView
                data={lateAttendanceRequests}
                config={LATE_ATTENDANCE_REQUESTS.table_config}
                searchCol={LATE_ATTENDANCE_REQUESTS.searchable_cols as string[]}
                storageKey="attendance_sheet_requests"
                overflowY={true}
                maxHeight={600}
                colMinWidth={120}
              />
            </div>
          </div>
        </Modal>
      )}

      {showCreateRequestModal && (
        <Modal onClose={() => setShowCreateRequestModal(false)} width="480px" height="auto">
          <div className="late-request-modal-container">
            <h2 className="late-request-modal-title">Create Late Attendance Request</h2>


            <form onSubmit={handleCreateRequestSubmit} className="late-request-form">
              {/* Request Deletion Checkbox */}
              <label className="form-checkbox-label">
                <input
                  type="checkbox"
                  className="form-checkbox-input"
                  checked={requestFormData.RequestDeletion}
                  onChange={(e) => setRequestFormData(prev => ({ ...prev, RequestDeletion: e.target.checked }))}
                />
                Request Attendance Deletion
              </label>

              {/* Employee Name (Disabled) */}
              <div className="form-group">
                <label className="form-label">Employee</label>
                <div className="form-input-wrapper disabled">
                  <input
                    type="text"
                    className="form-control"
                    value={requestFormData.Employee}
                    disabled
                  />
                </div>
              </div>

              {/* Date (Disabled) */}
              <div className="form-group">
                <label className="form-label">Date</label>
                <div className="form-input-wrapper disabled">
                  <input
                    type="text"
                    className="form-control"
                    value={requestFormData.Date}
                    disabled
                  />
                </div>
              </div>

              {/* Attendance (Dropdown) */}
              <div className="form-group">
                <label className="form-label">Attendance Status</label>
                <div className={`form-input-wrapper ${requestFormData.RequestDeletion ? 'disabled' : ''}`}>
                  <select
                    className="form-control"
                    value={requestFormData.Attendance}
                    disabled={requestFormData.RequestDeletion}
                    onChange={(e) => setRequestFormData(prev => ({ ...prev, Attendance: e.target.value }))}
                  >
                    {ATTENDANCE_STATUSES.map((status) => (
                      <option key={status.Status} value={status.Status}>
                        {status.Alias || status.Status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Trip (Disabled) */}
              <div className="form-group">
                <label className="form-label">Trip (OE)</label>
                <div className="form-input-wrapper disabled">
                  <input
                    type="text"
                    className="form-control"
                    value={requestFormData.Trip || '---'}
                    disabled
                  />
                </div>
              </div>

              {/* Approval (Dropdown) */}
              <div className="form-group">
                <label className="form-label">Approval Status</label>
                <div className={`form-input-wrapper ${requestFormData.RequestDeletion ? 'disabled' : ''}`}>
                  <select
                    className="form-control"
                    value={requestFormData.Approval}
                    disabled={requestFormData.RequestDeletion}
                    onChange={(e) => setRequestFormData(prev => ({ ...prev, Approval: e.target.value }))}
                  >
                    <option value="Approved">Approved</option>
                    <option value="Not Approved">Not Approved</option>
                  </select>
                </div>
              </div>

              {/* Remarks Input */}
              <div className="form-group">
                <label className="form-label">Remarks</label>
                <div className="form-input-wrapper">
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Enter reason or additional details..."
                    value={requestFormData.remarks}
                    onChange={(e) => setRequestFormData(prev => ({ ...prev, remarks: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateRequestModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Submit Request
                </button>
              </div>

            </form>
          </div>
        </Modal>
      )}

      {bannerMessage && (
        <AutoDismissBanner
          message={bannerMessage}
          onClose={() => setBannerMessage(null)}
        />
      )}

      {/* Employee Summary Modal */}
      {activeSummaryEmp && (
        <EmployeeSummaryModal
          employeeName={activeSummaryEmp}
          selectedCutoff={selectedCutoff}
          allRecords={rawAttendanceData}
          onClose={() => setActiveSummaryEmp(null)}
          user={user || undefined}
          onRecordsUpdate={handleOptimisticSummaryUpdate}
          allowedDateClick={ALLOWED_DATE_CLICK}
        />
      )}

    </div>
  );
});
AttendanceSheet.displayName = 'AttendanceSheet';
export default AttendanceSheet;