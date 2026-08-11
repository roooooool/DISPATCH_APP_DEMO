import React, { useMemo, useEffect, useState } from 'react';
import { X, Calendar, Route, Award, MapPin, CheckCircle2, User, ClipboardList, ShoppingBag, Download } from 'lucide-react';

import { type AttendanceRecord } from './ewul_AttendanceSheet';

import {
    type UserInfo,
    ATTENDANCE_STATUSES
} from '../truth.config';

import './comp_css/EmployeeSummaryModal.css';

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
}

export const EmployeeSummaryModal: React.FC<EmployeeSummaryModalProps> = ({
    employeeName,
    selectedCutoff,
    allRecords,
    onClose,
    user,
}) => {
    // 1. Local state for optimistic updates
    const [localRecords, setLocalRecords] = useState<AttendanceRecord[]>(allRecords);
    const [calcMode, setCalcMode] = useState<'Approved' | 'Theoretical'>('Approved');

    // Keep local records in sync if parent prop updates
    useEffect(() => {
        setLocalRecords(allRecords);
    }, [allRecords]);


    // 1. Filter records strictly for this employee & active cutoff date range
    const filteredRecords = useMemo(() => {
        if (!selectedCutoff) return [];

        // Helper to safely convert nullable dates to timestamps
        const getTime = (val: string | number | Date | null | undefined): number => {
            return val ? new Date(val).getTime() : 0;
        };

        return localRecords
            .filter((item) => {
                if (item.EmployeeName !== employeeName) return false;
                const dateStr = item.AttendanceDate ? item.AttendanceDate.split('T')[0] : '';
                return dateStr >= selectedCutoff.startDate && dateStr <= selectedCutoff.endDate;
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



    const handleToggleApproval = async (targetRecord: AttendanceRecord) => {
        const previousStatus = targetRecord.Approved;
        const newStatus = previousStatus === 'Approved' ? 'Not Approved' : 'Approved';

        // Step A: Instant Optimistic UI Update
        setLocalRecords((prev) =>
            prev.map((rec) =>
                rec === targetRecord || (rec.AttendanceDate === targetRecord.AttendanceDate && rec.OE === targetRecord.OE)
                    ? { ...rec, Approved: newStatus }
                    : rec
            )
        );

        try {
            // Step B: API call placeholder
            console.log(`[API CALL PLACEHOLDER] Updating Approval status for ${targetRecord.EmployeeName}: ${newStatus}`);

            // await api.updateApprovalStatus({ id: targetRecord.id, status: newStatus });
        } catch (error) {
            console.error('Failed to update approval status:', error);

            // Step C: Rollback on API Error
            setLocalRecords((prev) =>
                prev.map((rec) =>
                    rec === targetRecord || (rec.AttendanceDate === targetRecord.AttendanceDate && rec.OE === targetRecord.OE)
                        ? { ...rec, Approved: previousStatus }
                        : rec
                )
            );
            alert('Failed to update approval status. Changes reverted.');
        }
    };

    const canEditApproval = ["Supervisor", "Developer", "Manager"].includes(user?.Position || '');

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
            // 2. Table Headers
            ['Date', 'Status', 'OE', 'DMS OE', 'Route / SD', 'Distance (km)', 'Score', 'BU', 'Approval']
        ];

        // 3. Append Table Data Rows
        filteredRecords.forEach((rec) => {
            const dateStr = rec.AttendanceDate ? rec.AttendanceDate.split('T')[0] : '';
            csvRows.push([
                dateStr,
                rec.AttendanceStatus || '---',
                rec.OE || '---',
                rec.DMS_OE || '---',
                rec.SD || '---',
                rec.tripKM != null ? String(rec.tripKM) : '---',
                rec.tripIndex != null ? String(rec.tripIndex) : '---',
                rec.BU || '---',
                rec.Approved === 'Approved' ? 'Approved' : 'Not Approved'
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
                                <span className="kpi-label">Cutoff Score</span>
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
                        <h4 className="section-title">Attendance & Trip Breakdown</h4>
                        <div className="emp-table-wrapper">
                            <table className="emp-history-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th>OE</th>
                                        {/* <th>DMS OE</th> */}
                                        <th>Route / Source-Destination (SD)</th>
                                        <th>Distance</th>
                                        <th>Score</th>
                                        {/* <th>BU</th> */}
                                        <th>Approval</th>
                                        <th>Modified By</th>
                                        <th>Approved By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length > 0 ? (
                                        filteredRecords.map((rec, idx) => {
                                            const isApproved = rec.Approved === 'Approved';

                                            return (

                                                <tr key={idx}>
                                                    <td className="font-mono">{rec.AttendanceDate?.split('T')[0]}</td>
                                                    <td>
                                                        <span className={`emp-summ-status-pill ${rec.AttendanceStatus?.toLowerCase().replace(/\s+/g, '-')}`}>
                                                            {rec.AttendanceStatus || '---'}
                                                        </span>
                                                    </td>
                                                    <td className="font-mono font-bold">{rec.OE || '---'}</td>
                                                    {/* <td className="font-mono text-muted">{rec.DMS_OE || '---'}</td> */}
                                                    <td className="route-cell" title={rec.SD || ''}>
                                                        <MapPin size={11} className="inline-icon" />
                                                        <span>{rec.SD || '---'}</span>
                                                    </td>
                                                    <td className="font-bold text-primary">{rec.tripKM ? `${rec.tripKM} km` : '---'}</td>
                                                    <td className="font-bold text-primary">
                                                        {rec.tripIndex !== null && rec.tripIndex !== undefined ? rec.tripIndex : '---'}
                                                    </td>
                                                    {/* <td>{rec.BU || '---'}</td> */}
                                                    <td>
                                                        <button
                                                            type="button"
                                                            disabled={!canEditApproval}
                                                            className={`emp-summ-approve-btn ${isApproved ? 'emp-summ-approved' : 'emp-summ-not-approved'} `}
                                                            onClick={() => handleToggleApproval(rec)}
                                                        >
                                                            {isApproved ? 'Approved' : 'Not Approved'}
                                                        </button>
                                                    </td>
                                                    <td>---</td>
                                                    <td>---</td>
                                                </tr>
                                            )
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