import React, { useMemo } from 'react';
import { X, Calendar, Route, Award, MapPin, CheckCircle2, User, ClipboardList } from 'lucide-react';

import { type AttendanceRecord } from './ewul_AttendanceSheet';

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
}

export const EmployeeSummaryModal: React.FC<EmployeeSummaryModalProps> = ({
    employeeName,
    selectedCutoff,
    allRecords,
    onClose,
}) => {
    // 1. Filter records strictly for this employee & active cutoff date range
    const filteredRecords = useMemo(() => {
        if (!selectedCutoff) return [];

        return allRecords.filter((item) => {
            if (item.EmployeeName !== employeeName) return false;
            const dateStr = item.AttendanceDate ? item.AttendanceDate.split('T')[0] : '';
            return dateStr >= selectedCutoff.startDate && dateStr <= selectedCutoff.endDate;
        }).sort((a, b) => new Date(a.AttendanceDate).getTime() - new Date(b.AttendanceDate).getTime());
    }, [allRecords, employeeName, selectedCutoff]);

    // 2. Compute KPI Metrics for the Modal
    const metrics = useMemo(() => {
        let totalScore = 0;
        let totalKM = 0;
        const servedOEs = new Set<string>();
        let empId = '---';
        let position = '---';

        filteredRecords.forEach((rec) => {
            if (rec.EmployeeID) empId = String(rec.EmployeeID);
            if (rec.Position) position = rec.Position;

            // Accumulate score & distance
            totalScore += Number(rec.tripIndex) || 0;
            totalKM += Number(rec.tripKM) || 0;

            // Count served trips
            const status = rec.AttendanceStatus?.toUpperCase();
            const oe = rec.OE?.trim();
            if (status === 'SERVED' && oe && oe !== '---') {
                servedOEs.add(oe);
            }
        });

        return {
            empId,
            position,
            totalScore,
            totalKM,
            servedCount: servedOEs.size,
            totalDays: filteredRecords.length,
        };
    }, [filteredRecords]);

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
                                ID: <b>{metrics.empId}</b> • {metrics.position}
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
                                        <th>DMS OE</th>
                                        <th>Route / Source-Destination (SD)</th>
                                        <th>Distance</th>
                                        <th>Score</th>
                                        <th>BU</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length > 0 ? (
                                        filteredRecords.map((rec, idx) => (
                                            <tr key={idx}>
                                                <td className="font-mono">{rec.AttendanceDate?.split('T')[0]}</td>
                                                <td>
                                                    <span className={`status-pill ${rec.AttendanceStatus?.toLowerCase().replace(/\s+/g, '-')}`}>
                                                        {rec.AttendanceStatus || '---'}
                                                    </span>
                                                </td>
                                                <td className="font-mono font-bold">{rec.OE || '---'}</td>
                                                <td className="font-mono text-muted">{rec.DMS_OE || '---'}</td>
                                                <td className="route-cell" title={rec.SD || ''}>
                                                    <MapPin size={11} className="inline-icon" />
                                                    <span>{rec.SD || '---'}</span>
                                                </td>
                                                <td>{rec.tripKM ? `${rec.tripKM} km` : '---'}</td>
                                                <td className="font-bold text-primary">
                                                    {rec.tripIndex !== null && rec.tripIndex !== undefined ? rec.tripIndex : '---'}
                                                </td>
                                                <td>{rec.BU || '---'}</td>
                                            </tr>
                                        ))
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