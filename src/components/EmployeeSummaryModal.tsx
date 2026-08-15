import React, { useMemo, useEffect, useState } from 'react';
import { X, Calendar, Route, Award, MapPin, CheckCircle2, User, ClipboardList, ShoppingBag, Download } from 'lucide-react';

import { type AttendanceRecord } from './ewul_AttendanceSheet';

import {
    type UserInfo,
    ATTENDANCE_STATUSES
} from '../truth.config';

import './comp_css/EmployeeSummaryModal.css';

//POWERAPPS
import { GSDC_AttendanceService } from '../generated/services/GSDC_AttendanceService';
import { UpsertAttendanceLogService } from '../generated/services/UpsertAttendanceLogService';
import { ResetAttendanceLogBySpIDService } from '../generated/services/ResetAttendanceLogBySpIDService';

//utils
import { useTaskWorker } from '../utils/TaskWorkerContext';


interface CutoffGroup {
    label: string;
    startDate: string;
    endDate: string;
}

interface EmployeeSummaryModalProps {
    employeeName: string;
    selectedCutoff: CutoffGroup | null;
    allRecords: AttendanceRecord[];
    onClose: () => void;
    user?: UserInfo;
    onRecordsUpdate?: (updatedRecords: AttendanceRecord[]) => void;
}

export const EmployeeSummaryModal: React.FC<EmployeeSummaryModalProps> = ({
    employeeName,
    selectedCutoff,
    allRecords,
    onClose,
    user,
    onRecordsUpdate,
}) => {

    const { addTask } = useTaskWorker();

    const [pendingChanges, setPendingChanges] = useState<Record<string, AttendanceRecord>>({});

    // 1. Local state for optimistic updates
    const [localRecords, setLocalRecords] = useState<AttendanceRecord[]>(allRecords);
    const [calcMode, setCalcMode] = useState<'Approved' | 'Theoretical'>('Approved');

    // Keep local records in sync if parent prop updates
    useEffect(() => {
        setLocalRecords(allRecords);
        setPendingChanges({});
    }, [allRecords]);


    // 1. Filter records strictly for this employee & active cutoff date range
    // 1. Filter records strictly for this employee & active cutoff date range (up to today)
    const filteredRecords = useMemo(() => {
        if (!selectedCutoff) return [];

        // Get today's date in YYYY-MM-DD format
        const todayStr = new Date().toISOString().split('T')[0];

        // Helper to safely convert nullable dates to timestamps
        const getTime = (val: string | number | Date | null | undefined): number => {
            return val ? new Date(val).getTime() : 0;
        };

        return localRecords
            .filter((item) => {
                if (item.EmployeeName !== employeeName) return false;
                const dateStr = item.AttendanceDate ? item.AttendanceDate.split('T')[0] : '';

                // Check if date is within cutoff range AND NOT in the future
                return (
                    dateStr >= selectedCutoff.startDate &&
                    dateStr <= selectedCutoff.endDate &&
                    dateStr <= todayStr
                );
            })
            .sort((a, b) => {
                // Primary sort: AttendanceDate DESC
                const dateDiff = getTime(b.AttendanceDate) - getTime(a.AttendanceDate);
                if (dateDiff !== 0) return dateDiff;

                // Secondary sort: ModifiedAt DESC (if AttendanceDate is equal)
                return getTime(b.ModifiedAt) - getTime(a.ModifiedAt);
            });
    }, [localRecords, employeeName, selectedCutoff]);


    // console.log("awdaw: ", filteredRecords)

    // 1. Initial column widths (in pixels)
    const [colWidths, setColWidths] = useState<Record<string, number>>({
        date: 110,
        status: 120,
        oe: 100,
        sd: 220,
        distance: 100,
        score: 90,
        tranType: 130,
        approval: 130,
        ModifiedAt: 110,
        modifiedBy: 130,
        approvedBy: 130,
        coorApp: 100,
    });

    // 2. Mouse drag handler for resizing
    const handleResizeMouseDown = (colKey: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = colWidths[colKey] || 100;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentX = moveEvent.clientX;
            const newWidth = Math.max(60, startWidth + (currentX - startX)); // Min width 60px
            setColWidths((prev) => ({
                ...prev,
                [colKey]: newWidth,
            }));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'default';
        };

        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // 1. Dynamic set of statuses where onduty === true (defined outside component or at top level)
    const ON_DUTY_STATUSES = new Set(
        ATTENDANCE_STATUSES
            .filter((item) => item.onduty)
            .map((item) => item.Status.toUpperCase())
    );

    // 2. Compute KPI Metrics for the Modal
    // 2. Compute KPI Metrics based on calcMode
    const metrics = useMemo(() => {
        let totalScore = 0;
        let totalKM = 0;
        let eligibleBigasCount = 0;
        const servedOEs = new Set<string>();
        const onDutyDays = new Set<string>();

        let empId = '---';
        let position = '---';
        let BU = '---';

        filteredRecords.forEach((rec) => {
            if (rec.EmployeeID) empId = String(rec.EmployeeID);
            if (rec.Position) position = rec.Position;
            if (rec.BU) BU = rec.BU;

            const status = rec.AttendanceStatus?.trim().toUpperCase() || '';
            const isApproved = rec.Approved === 'Approved';
            const oe = rec.OE?.trim();
            const dateStr = rec.AttendanceDate ? rec.AttendanceDate.split('T')[0] : '';

            // Unique days with onduty == true (Independent of mode/approval)
            if (ON_DUTY_STATUSES.has(status) && dateStr) {
                onDutyDays.add(dateStr);
            }

            // In 'Approved' mode, strictly enforce approval. In 'Theoretical', bypass approval check.
            const shouldIncludeInMetrics = calcMode === 'Theoretical' || isApproved;

            if (shouldIncludeInMetrics) {
                // Score & Distance
                totalScore += Number(rec.tripIndex) || 0;
                totalKM += Number(rec.tripKM) || 0;

                // Served Trips & Bigas Count
                if (status === 'SERVED') {
                    if (oe && oe !== '---') {
                        servedOEs.add(oe);
                    }
                    eligibleBigasCount++;
                }
            }
        });

        // Determine Bigas metric in kilos
        let bigasKilos = '0 kilos';
        if (eligibleBigasCount >= 6) {
            bigasKilos = '10 kilos';
        } else if (eligibleBigasCount >= 4) {
            bigasKilos = '5 kilos';
        }

        return {
            empId,
            position,
            totalScore,
            totalKM,
            servedCount: servedOEs.size,
            totalDays: onDutyDays.size,
            bigasCount: eligibleBigasCount,
            bigasKilos,
            BU: BU,
        };
    }, [filteredRecords, calcMode]);



    // 2. Toggle approval locally & track in pendingChanges
    const handleToggleApproval = (targetRecord: AttendanceRecord) => {
        // console.log('awdtest: ', targetRecord);
        const groupKey = `${targetRecord.AttendanceDate?.split('T')[0]}_${targetRecord.OE || ''}`;

        const currentRecord = localRecords.find(
            (rec) => rec === targetRecord || (rec.AttendanceDate === targetRecord.AttendanceDate && rec.OE === targetRecord.OE)
        );

        // Toggle between 'Approved' and undefined
        const newStatus: 'Approved' | undefined = currentRecord?.Approved === 'Approved' ? undefined : 'Approved';

        // Construct full updated record object
        const updatedRecord: AttendanceRecord = {
            ...(currentRecord || targetRecord),
            Approved: newStatus,
        };

        // console.log('wasd: ', updatedRecord);

        // Update optimistic local records for UI/KPIs
        setLocalRecords((prev) =>
            prev.map((rec) =>
                rec === targetRecord || (rec.AttendanceDate === targetRecord.AttendanceDate && rec.OE === targetRecord.OE)
                    ? { ...rec, Approved: newStatus }
                    : rec
            )
        );

        // Update pending changes dictionary
        setPendingChanges((prev) => {
            const updated = { ...prev };

            const originalRec = allRecords.find(
                (rec) => rec === targetRecord || (rec.AttendanceDate === targetRecord.AttendanceDate && rec.OE === targetRecord.OE)
            );

            // Normalize baseline status to 'Approved' or undefined
            const originalStatus = originalRec?.Approved === 'Approved' ? 'Approved' : undefined;

            // Revert back to baseline if toggled back to original state
            if (newStatus === originalStatus) {
                delete updated[groupKey];
            } else {
                updated[groupKey] = updatedRecord;
            }

            return updated;
        });
    };

    const canEditApproval = ["Supervisor", "Developer", "Manager"].includes(user?.Position || '');

    const handleConfirmChanges = async () => {
        const pendingArray: AttendanceRecord[] = Object.values(pendingChanges);
        const processedArray = pendingArray.map((rec) => ({
            ...rec,
            ApprovedBy: rec.Approved === 'Approved' ? (user?.FullName || '') : '',
            ModifiedBy: user?.FullName || '',
            ModifiedAt: new Date().toISOString(), // Standard ISO format ("YYYY-MM-DDTHH:mm:ss.sssZ")
        }));

        if (pendingArray.length === 0) return;

        if (onRecordsUpdate) {
            onRecordsUpdate(processedArray);
        }

        const updateRecords = pendingArray.filter((rec) => rec.spID);
        const createRecords = pendingArray.filter((rec) => !rec.spID);

        console.log('To be updated in SharePoint:', updateRecords);
        console.log('To be created in SharePoint:', createRecords);

        const totalCount = pendingArray.length;
        const summaryLabel = `${totalCount} item${totalCount > 1 ? 's' : ''}`;

        addTask({
            id: `attendanceapproval-${Date.now()}`,
            name: `Attendance Approval`,
            execute: async () => {
                try {

                    // 1. Process SharePoint Creates
                    if (createRecords.length > 0) {
                        const createPayloads = createRecords.map((rec) => {
                            const camelStatus = rec.AttendanceStatus
                                ? rec.AttendanceStatus.charAt(0).toLowerCase() + rec.AttendanceStatus.slice(1)
                                : '';

                            return {
                                OE: rec.OE || '',
                                TripKM: rec.tripKM?.toString() || '',
                                SD: rec.SD || '',
                                Date: rec.AttendanceDate,
                                // Uses loose inequality (!=) to handle both null and undefined safely, 
                                // and uses camelStatus as the fallback
                                AttendanceDetail: rec.tripIndex != null ? rec.tripIndex.toString() : camelStatus,
                                SecondTrip: rec.secondTrip || '',
                                Creator: user?.FullName || '',
                                TCVC: rec.TCVC || '',
                                Position: rec.Position || '',
                                TransactionType: rec.TransactionType || '',
                                EmployeeName: rec.EmployeeName || '',
                                hrID: rec.EmployeeID?.toString() || '',
                                Approval: rec.Approved || '',
                            };
                        });

                        console.log('payload create: ', createPayloads);

                        const createResults = await Promise.all(
                            createPayloads.map((payload) => GSDC_AttendanceService.create(payload))
                        );

                        console.log('success wew1', createResults)

                        const hasCreateFailure = createResults.some((res) => !res?.success);
                        if (hasCreateFailure) {
                            throw new Error("Failed to create one or more attendance records in SharePoint.");
                        }
                    }

                    // 2. Process SharePoint Updates with Fallback Creation
                    if (updateRecords.length > 0) {
                        const updateResults = await Promise.all(
                            updateRecords.map(async (rec) => {
                                try {
                                    // Attempt standard update
                                    const updateRes = await GSDC_AttendanceService.update(rec.spID!, {
                                        Approval: rec.Approved || '',
                                    });

                                    // If update succeeded, return response
                                    if (updateRes?.success) {
                                        return updateRes;
                                    }

                                    // If update returned success: false (e.g., ID no longer exists in SharePoint)
                                    console.warn(`spID ${rec.spID} not found in SharePoint. Resetting orphan log and creating new record...`);

                                    // 1. Reset orphan spID binding in SQL Database
                                    await ResetAttendanceLogBySpIDService.ResetAttendanceLogBySpID({ spID: rec.spID! } as any);

                                    // 2. Create replacement record with FULL payload
                                    const createRes = await GSDC_AttendanceService.create({
                                        OE: rec.OE || '',
                                        TripKM: rec.tripKM?.toString() || '',
                                        SD: rec.SD || '',
                                        Date: rec.AttendanceDate,
                                        AttendanceDetail: rec.tripIndex?.toString() || '',
                                        SecondTrip: rec.secondTrip || '',
                                        Creator: user?.FullName || '',
                                        TCVC: rec.TCVC || '',
                                        Position: rec.Position || '',
                                        TransactionType: rec.TransactionType || '',
                                        EmployeeName: rec.EmployeeName || '',
                                        hrID: rec.EmployeeID?.toString() || '',
                                        Approval: rec.Approved || '',
                                    });

                                    return createRes;
                                } catch (err) {
                                    console.error(`Exception updating spID ${rec.spID}. Executing fallback reset & create:`, err);

                                    // Fallback attempt if update threw an unhandled exception
                                    try {
                                        await ResetAttendanceLogBySpIDService.ResetAttendanceLogBySpID({ spID: rec.spID! } as any);

                                        return await GSDC_AttendanceService.create({
                                            OE: rec.OE || '',
                                            TripKM: rec.tripKM?.toString() || '',
                                            SD: rec.SD || '',
                                            Date: rec.AttendanceDate,
                                            AttendanceDetail: rec.tripIndex?.toString() || '',
                                            SecondTrip: rec.secondTrip || '',
                                            Creator: user?.FullName || '',
                                            TCVC: rec.TCVC || '',
                                            Position: rec.Position || '',
                                            TransactionType: rec.TransactionType || '',
                                            EmployeeName: rec.EmployeeName || '',
                                            hrID: rec.EmployeeID?.toString() || '',
                                            Approval: rec.Approved || '',
                                        });
                                    } catch (fallbackErr) {
                                        console.error(`Fallback failed for spID ${rec.spID}:`, fallbackErr);
                                        return { success: false };
                                    }
                                }
                            })
                        );

                        const hasUpdateFailure = updateResults.some((res) => !res?.success);
                        if (hasUpdateFailure) {
                            throw new Error("Failed to update or recreate one or more attendance records in SharePoint.");
                        }
                    }

                    console.log('upserting to attendance log')
                    // 3. Process SQL Database Upserts (All Records)
                    const upsertResults = await Promise.all(
                        pendingArray.map((rec) => {
                            // Safely parse into a Date object whether rec.AttendanceDate is a string or Date instance
                            const dateObj = new Date(rec.AttendanceDate);
                            const year = dateObj.getFullYear();
                            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const day = String(dateObj.getDate()).padStart(2, '0');
                            const dateStr = `${year}-${month}-${day}`;

                            return UpsertAttendanceLogService.UpsertAttendanceLog({
                                EmployeeName: rec.EmployeeName,
                                EmployeeID: rec.EmployeeID,
                                AttendanceDate: dateStr,
                                OE: rec.OE || '',
                                Approved: rec.Approved,
                                AttendanceStatus: rec.AttendanceStatus,
                                ModifiedBy: user?.FullName || 'Unknown User',
                                ApprovedBy: rec.Approved === 'Approved' ? (user?.FullName || undefined) : undefined,
                            } as any);
                        })
                    );



                    console.log('upserting success!', upsertResults);

                    const hasUpsertFailure = upsertResults.some((res) => res && res.success === false);
                    if (hasUpsertFailure) {
                        throw new Error("Failed to sync one or more attendance records with the SQL database.");
                    }

                    return { success: true, data: null };
                } catch (err) {
                    console.error("Error submitting attendance records:", err);
                    return { success: false, data: null };
                }
            },
            checkSuccess: (result: { success: boolean }) => result.success,
            onSuccess: () => {
                setPendingChanges({});
                // fetchAttendanceRecords(); // Refresh data if needed
            },
            onFailure: () => {
                console.error('Failed to commit attendance approval changes.');
            },
            message: `Submitting approval for ${summaryLabel}...`,
            message_success: `Attendance approvals for ${summaryLabel} submitted successfully.`,
            message_failure: `Failed to submit attendance approvals for ${summaryLabel}.`,
        });

        //close the summary
        if (onClose) {
            onClose();
        };

    };

    // 4. Cancel handler to revert back to original records
    const handleCancelChanges = () => {
        setLocalRecords(allRecords);
        setPendingChanges({});
    };

    const pendingCount = Object.keys(pendingChanges).length;

    const handleExportCSV = () => {
        // Helper to safely escape CSV cell values (handles commas, quotes, and newlines)
        const escapeCSV = (val: any) => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        // 1. Build Metrics & Summary rows at the top
        const csvRows: string[][] = [
            ['EMPLOYEE ATTENDANCE & TRIP SUMMARY'],
            ['Employee Name', employeeName],
            ['Employee ID', metrics.empId],
            ['Position', metrics.position],
            ['Cutoff Period', selectedCutoff ? `${selectedCutoff.label} (${selectedCutoff.startDate} to ${selectedCutoff.endDate})` : 'N/A'],
            [], // Blank row separator
            ['KPI METRICS'],
            ['Cutoff Score (pts)', metrics.totalScore.toFixed(2)],
            ['Served Trips (OE)', String(metrics.servedCount)],
            ['Total Distance (km)', String(metrics.totalKM)],
            ['Active Days', String(metrics.totalDays)],
            ['Bigas Allowance', metrics.bigasKilos],
            [], // Blank row separator
            // 2. Table Headers matching the JSX <table>
            ['Date', 'Status', 'OE', 'Route / Source-Destination (SD)', 'Distance (km)', 'Index', 'Transaction', 'Approval', 'Modified By', 'Approved By', 'Coor App']
        ];

        // 3. Append Table Data Rows matching column order
        filteredRecords.forEach((rec) => {
            const dateStr = rec.AttendanceDate ? rec.AttendanceDate.split('T')[0] : '';
            csvRows.push([
                dateStr,
                rec.AttendanceStatus || '---',
                rec.OE || '---',
                rec.SD || '---',
                rec.tripKM != null ? String(rec.tripKM) : '---',
                rec.tripIndex != null ? String(rec.tripIndex) : '---',
                rec.TransactionType || rec.tripIndex ? 'Full Trip' : '---',
                rec.Approved === 'Approved' ? 'Approved' : 'Not Approved',
                rec.ModifiedBy || '---',
                rec.ApprovedBy || '---',
                rec.spID != null ? String(rec.spID) : '---'
            ]);
        });

        // 4. Convert array of arrays to CSV string
        const csvString = csvRows.map((row) => row.map(escapeCSV).join(',')).join('\n');

        // 5. Trigger download (\uFEFF adds UTF-8 BOM so Excel opens special chars correctly)
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const fileName = `${employeeName.replace(/\s+/g, '_')}_Summary_${selectedCutoff?.startDate || 'export'}.csv`;
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="emp-modal-backdrop" onClick={onClose}>
            <div className="emp-modal-container" onClick={(e) => e.stopPropagation()}>

                {/* Modal Header */}
                <div className="emp-modal-header">
                    <div className="emp-header-info">
                        <div className="emp-avatar">
                            <User size={20} />
                        </div>
                        <div>
                            {/* Title Added Here */}
                            <div className="emp-modal-tag">
                                <ClipboardList size={12} />
                                <span>Attendance Summary</span>
                            </div>
                            <h3 className="emp-modal-title">{employeeName}</h3>
                            <p className="emp-modal-subtitle">
                                ID: <b>{metrics.empId}</b> • {metrics.position} • {metrics.BU}
                            </p>

                        </div>
                    </div>

                    <div className="emp-header-right">

                        {selectedCutoff && (
                            <div className="cutoff-badge-pill">
                                <Calendar size={13} />
                                <span>{selectedCutoff.label} ({selectedCutoff.startDate} to {selectedCutoff.endDate})</span>
                            </div>
                        )}
                        {/* Export CSV Button */}
                        <button
                            className="emp-modal-export-btn"
                            onClick={handleExportCSV}
                            title="Export CSV"
                        >
                            <Download size={15} />
                            <span>Export CSV</span>
                        </button>
                        <button className="emp-modal-close-btn" onClick={onClose} title="Close">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="emp-modal-body">

                    {/* KPI Summary Cards */}
                    <div className="emp-kpi-grid">
                        <div className="kpi-card score">
                            <div className="kpi-icon"><Award size={18} /></div>
                            <div className="kpi-details">
                                <span className="kpi-label">Trip Index</span>
                                <span className="kpi-value">{metrics.totalScore.toFixed(2)} pts</span>
                            </div>
                        </div>

                        <div className="kpi-card served">
                            <div className="kpi-icon"><CheckCircle2 size={18} /></div>
                            <div className="kpi-details">
                                <span className="kpi-label">Served Trips</span>
                                <span className="kpi-value">{metrics.servedCount} OE</span>
                            </div>
                        </div>

                        <div className="kpi-card km">
                            <div className="kpi-icon"><Route size={18} /></div>
                            <div className="kpi-details">
                                <span className="kpi-label">Total Distance</span>
                                <span className="kpi-value">{metrics.totalKM.toLocaleString()} km</span>
                            </div>
                        </div>

                        <div className="kpi-card days">
                            <div className="kpi-icon"><Calendar size={18} /></div>
                            <div className="kpi-details">
                                <span className="kpi-label">Active Records</span>
                                <span className="kpi-value">{metrics.totalDays} Days</span>
                            </div>
                        </div>

                        <div className="kpi-card bigas">
                            <div className="kpi-icon"><ShoppingBag size={18} /></div>
                            <div className="kpi-details">
                                <span className="kpi-label">Bigas Allowance</span>
                                <span className="kpi-value">{metrics.bigasKilos}</span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Attendance History Table */}
                    <div className="emp-history-section">
                        {/* Section Header Row */}
                        <div className="emp-section-header">
                            <div className="emp-section-header-left">
                                <h4 className="section-title">Attendance & Trip Breakdown</h4>

                                {/* Calculation Mode Toggle */}
                                <div className="emp-sum-calc-mode-toggle">
                                    <button
                                        type="button"
                                        className={`toggle-btn approved ${calcMode === 'Approved' ? 'active' : ''}`}
                                        onClick={() => setCalcMode('Approved')}
                                    >
                                        Approved
                                    </button>
                                    <button
                                        type="button"
                                        className={`toggle-btn theoretical ${calcMode === 'Theoretical' ? 'active' : ''}`}
                                        onClick={() => setCalcMode('Theoretical')}
                                    >
                                        Theoretical
                                    </button>
                                </div>
                            </div>

                            {/* Temp Changes Action Bar (Far Right) */}
                            {pendingCount > 0 && (
                                <div className="emp-temp-actions-bar">
                                    <span className="emp-temp-badge">{pendingCount} Unsaved</span>
                                    <button
                                        type="button"
                                        className="emp-btn-confirm"
                                        onClick={handleConfirmChanges}
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        type="button"
                                        className="emp-btn-cancel"
                                        onClick={handleCancelChanges}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="emp-table-wrapper">
                            <table className="emp-history-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: colWidths.date }}>
                                            Date
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('date', e)} />
                                        </th>
                                        <th style={{ width: colWidths.status }}>
                                            Status
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('status', e)} />
                                        </th>
                                        <th style={{ width: colWidths.oe }}>
                                            OE
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('oe', e)} />
                                        </th>
                                        <th style={{ width: colWidths.sd }}>
                                            Route / Source-Destination (SD)
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('sd', e)} />
                                        </th>
                                        <th style={{ width: colWidths.distance }}>
                                            Distance
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('distance', e)} />
                                        </th>
                                        <th style={{ width: colWidths.score }}>
                                            Index
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('score', e)} />
                                        </th>
                                        <th style={{ width: colWidths.tranType }}>
                                            Transaction
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('tranType', e)} />
                                        </th>
                                        <th style={{ width: colWidths.approval }}>
                                            Approval
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('approval', e)} />
                                        </th>
                                        <th style={{ width: colWidths.ModifiedAt }}>
                                            Modified
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('ModifiedAt', e)} />
                                        </th>
                                        <th style={{ width: colWidths.modifiedBy }}>
                                            Modified By
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('modifiedBy', e)} />
                                        </th>
                                        <th style={{ width: colWidths.approvedBy }}>
                                            Approved By
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('approvedBy', e)} />
                                        </th>
                                        <th style={{ width: colWidths.coorApp }}>
                                            Coor App
                                            <div className="col-resizer" onMouseDown={(e) => handleResizeMouseDown('coorApp', e)} />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length > 0 ? (
                                        filteredRecords.map((rec, idx) => {
                                            const isApproved = rec.Approved === 'Approved';

                                            // Check if this record has staged/unsaved changes
                                            const groupKey = `${rec.AttendanceDate?.split('T')[0]}_${rec.OE || ''}`;
                                            const isModified = Boolean(pendingChanges[groupKey]);

                                            return (
                                                <tr key={idx} className={isModified ? 'row-pending-edit' : ''}>
                                                    <td className="font-mono">{rec.AttendanceDate?.split('T')[0]}</td>
                                                    <td>
                                                        <span className={`emp-summ-status-pill ${rec.AttendanceStatus?.toLowerCase().replace(/\s+/g, '-')}`}>
                                                            {rec.AttendanceStatus || '---'}
                                                        </span>
                                                    </td>
                                                    <td className="font-mono font-bold">{rec.OE || '---'}</td>
                                                    <td className="route-cell" title={rec.SD || ''}>
                                                        <MapPin size={11} className="inline-icon" />
                                                        <span>{rec.SD || '---'}</span>
                                                    </td>
                                                    <td className="font-bold text-primary">{rec.tripKM ? `${rec.tripKM} km` : '---'}</td>
                                                    <td className="font-bold text-primary">
                                                        {rec.tripIndex !== null && rec.tripIndex !== undefined ? rec.tripIndex : '---'}
                                                    </td>
                                                    <td className="font-mono font-bold">{rec.TransactionType || rec.tripIndex ? 'Full Trip' : '---'}</td>
                                                    <td>
                                                        <div className="approval-btn-wrapper">
                                                            <button
                                                                type="button"
                                                                disabled={!canEditApproval}
                                                                className={`emp-summ-approve-btn ${isApproved ? 'emp-summ-approved' : 'emp-summ-not-approved'} ${isModified ? 'btn-modified' : ''}`}
                                                                onClick={() => handleToggleApproval(rec)}
                                                            >
                                                                {isApproved ? 'Approved' : 'Not Approved'}
                                                            </button>

                                                            {/* Pulsing visual indicator for unsaved state */}
                                                            {isModified && (
                                                                <span className="edited-indicator-dot" title="Unsaved change" />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="font-mono">
                                                        {
                                                            rec.ModifiedAt
                                                                ? new Date(rec.ModifiedAt).toLocaleString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric',
                                                                    hour: 'numeric',
                                                                    minute: '2-digit',
                                                                    hour12: true,
                                                                })
                                                                : '---'
                                                        }
                                                    </td>
                                                    <td>{rec.ModifiedBy || '---'}</td>
                                                    <td>{rec.ApprovedBy || '---'}</td>
                                                    <td className="text-primary">{rec.spID}</td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="empty-history-cell">
                                                No attendance records found for this cutoff range.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};