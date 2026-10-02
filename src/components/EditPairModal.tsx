import React, { useState, useEffect, useMemo } from 'react';
import { X, User, Search, CheckCircle2, UserX, UserCheck, AlertTriangle, Filter } from 'lucide-react';
import './comp_css/EditPairModal.css';

export interface PairingRecord {
    Driver?: string;
    Helper?: string;
    Truck?: string;
    Trailer?: string;
    [key: string]: any;
}

export interface PairItem {
    D_UserID?: string | number | null;
    H_UserID?: string | number | null;
    Driver?: string | null;
    Helper?: string | null;
    PairingStatus?: string | number | null;
    PairID?: string | number | null;
    OE?: string | number | null;
    [key: string]: any;
}

interface EditPairModalProps {
    isOpen: boolean;
    type: 'driver' | 'helper' | null;
    record: PairingRecord | null;
    driverList?: any[];
    helperList?: any[];
    pairList?: PairItem[];
    onClose: () => void;
    onSave: (updatedRecord: PairingRecord, type: 'driver' | 'helper', selectedPerson: string) => Promise<void> | void;
}

const EditPairModal: React.FC<EditPairModalProps> = ({
    isOpen,
    type,
    record,
    driverList = [],
    helperList = [],
    pairList = [],
    onClose,
    onSave,
}) => {
    const isDriver = type === 'driver';
    const roleLabel = isDriver ? 'Driver' : 'Helper';
    const currentlyAssignedPerson = isDriver ? record?.Driver : record?.Helper;
    const rawPersonnelList = isDriver ? driverList : helperList;

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [selectedPerson, setSelectedPerson] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);

    useEffect(() => {
        if (record) {
            setSelectedPerson(currentlyAssignedPerson || '');
            setSearchTerm('');
            setStatusFilter('All');
        }
    }, [record, type, currentlyAssignedPerson]);

    // Extract display name safely
    const getDisplayName = (person: any): string => {
        if (!person) return '';
        if (typeof person === 'string') return person;
        return String(
            person.FullName ||
            (person.FirstName && person.LastName ? `${person.LastName}, ${person.FirstName}` : '') ||
            person.Name ||
            ''
        ).trim();
    };

    // Evaluate exact pair status and paired partner name by matching ID against pairList
    const getPairStatusDetails = (person: any) => {
        const personId = String(person?.Id ?? person?.ID ?? '').trim();
        if (!personId) return { status: 'Unpaired', partnerName: '', tripStatus: '', isBlocked: false };

        const matchedPair = pairList.find((p) => {
            const dUser = p.D_UserID !== null && p.D_UserID !== undefined ? String(p.D_UserID).trim() : '';
            const hUser = p.H_UserID !== null && p.H_UserID !== undefined ? String(p.H_UserID).trim() : '';

            return isDriver ? dUser === personId : hUser === personId;
        });

        if (!matchedPair) {
            return { status: 'Unpaired', partnerName: '', tripStatus: '', isBlocked: false };
        }

        const tripStatus = matchedPair.Status ? String(matchedPair.Status).trim() : '';

        const rawPairID = matchedPair.PairID;
        const pairIdStr = String(rawPairID ?? '').trim().toUpperCase();
        const hasValidPairID = rawPairID !== null && rawPairID !== undefined && pairIdStr !== '' && pairIdStr !== '0' && pairIdStr !== 'N' && pairIdStr !== 'NULL';

        if (!hasValidPairID) {
            return { status: 'Unpaired', partnerName: '', tripStatus, isBlocked: false };
        }

        const partnerName = isDriver ? matchedPair.Helper : matchedPair.Driver;
        const formattedPartnerName = partnerName ? String(partnerName).trim() : 'No Partner Name';

        const rawOE = matchedPair.OE;
        const hasOE = rawOE !== null && rawOE !== undefined && String(rawOE).trim() !== '' && String(rawOE).trim().toUpperCase() !== 'NULL';

        if (hasOE) {
            return {
                status: 'System',
                partnerName: formattedPartnerName,
                tripStatus,
                isBlocked: true
            };
        }

        return {
            status: 'Paired',
            partnerName: formattedPartnerName,
            tripStatus,
            isBlocked: false
        };
    };

    // Filter list based on search term AND status filter
    const filteredPersonnel = useMemo(() => {
        return rawPersonnelList.filter((person) => {
            const name = getDisplayName(person).toLowerCase();
            const bu = String(person?.BU || '').toLowerCase();
            const area = String(person?.AreaAssignment || '').toLowerCase();
            const term = searchTerm.toLowerCase();

            const matchesSearch = name.includes(term) || bu.includes(term) || area.includes(term);

            const { status } = getPairStatusDetails(person);
            const matchesStatus = statusFilter === 'All' || status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [rawPersonnelList, searchTerm, statusFilter, pairList, isDriver]);

    if (!isOpen || !record || !type) return null;

    const handleSelectAndSave = async (personName: string, isBlocked: boolean) => {
        if (isBlocked) return;

        setSelectedPerson(personName);
        setIsSaving(true);
        try {
            await onSave(record, type, personName);
            onClose();
        } catch (error) {
            console.error('Failed to update pair:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="edit-pair-modal-overlay" onClick={onClose}>
            <div className="edit-pair-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="edit-pair-modal-header">
                    <div className="modal-title-group">
                        <User className="modal-icon" size={20} />
                        <h3 className="modal-header-title">Pair {roleLabel}</h3>
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="Close modal">
                        <X size={18} />
                    </button>
                </div>

                {/* Sub-Header Showing Currently Assigned Person */}
                <div className="current-assignment-banner">
                    <span className="banner-label">Currently Assigned {roleLabel}:</span>
                    <span className="banner-value">
                        {currentlyAssignedPerson ? (
                            <>
                                <UserCheck size={15} className="banner-icon" />
                                {currentlyAssignedPerson}
                            </>
                        ) : (
                            <span className="banner-none">None (Unassigned)</span>
                        )}
                    </span>
                </div>

                {/* Search Bar & Filter Section */}
                <div className="search-bar-wrapper">
                    <div className="filter-controls-container">
                        {/* Search Input with Gradient Outline */}
                        <div className="gradient-search-wrapper">
                            <div className="gradient-search-inner">
                                <Search size={16} className="search-icon" />
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder={`Search ${roleLabel.toLowerCase()} by name, BU, or area...`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                                {searchTerm && (
                                    <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Status Filter Dropdown */}
                        <div className="gradient-filter-wrapper">
                            <div className="gradient-filter-inner">
                                <Filter size={15} className="filter-icon" />
                                <select
                                    className="status-filter-select"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="All">All Statuses</option>
                                    <option value="Paired">Paired</option>
                                    <option value="Unpaired">Unpaired</option>
                                    <option value="System">System</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Body */}
                <div className="edit-pair-modal-body">
                    <div className="table-responsive-container">
                        <table className="personnel-selection-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>BU</th>
                                    <th>Area</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Unassign Row */}
                                <tr
                                    className={`unassign-row ${!selectedPerson ? 'active-selection' : ''}`}
                                    onClick={() => handleSelectAndSave('', false)}
                                >
                                    <td colSpan={4} className="unassign-label">
                                        <UserX size={16} /> <span>Unassign Current {roleLabel}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {!selectedPerson && <CheckCircle2 size={18} className="selected-icon" />}
                                    </td>
                                </tr>

                                {filteredPersonnel.length > 0 ? (
                                    filteredPersonnel.map((person, idx) => {
                                        const name = getDisplayName(person);
                                        const isCurrent = currentlyAssignedPerson === name;
                                        const isSelected = selectedPerson === name;
                                        const rowKey = person?.Id || person?.ID || idx;

                                        const { status, partnerName, tripStatus, isBlocked } = getPairStatusDetails(person);

                                        return (
                                            <tr
                                                key={String(rowKey)}
                                                className={`
                                                    ${isSelected ? 'active-selection' : ''} 
                                                    ${isCurrent ? 'current-assigned-row' : ''}
                                                    ${isBlocked ? 'disabled-row' : ''}
                                                `}
                                                onClick={() => handleSelectAndSave(name, isBlocked)}
                                            >
                                                <td className="person-name">
                                                    <div className="name-cell-wrapper">
                                                        <span>{name}</span>
                                                        {isCurrent && (
                                                            <span className="badge-current-pill">CURRENT</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td><span className="badge-bu">{person.BU || 'N/A'}</span></td>
                                                <td>{person.AreaAssignment || 'N/A'}</td>

                                                {/* Status Column */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                        {status === 'System' && (
                                                            <span className="fleetmon-status-pill fleetmon-status-system">
                                                                <AlertTriangle size={12} /> System
                                                            </span>
                                                        )}

                                                        {status === 'Paired' && (
                                                            <div className="fleetmon-tooltip-container">
                                                                <span className="fleetmon-status-pill fleetmon-status-paired">
                                                                    Paired
                                                                </span>
                                                                {partnerName && (
                                                                    <div className="fleetmon-status-tooltip">
                                                                        Paired with: <strong>{partnerName}</strong>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {status === 'Unpaired' && (
                                                            <span className="fleetmon-status-pill fleetmon-status-unpaired">
                                                                Unpaired
                                                            </span>
                                                        )}

                                                        {tripStatus && (
                                                            <small className="fleetmon-trip-status-subtext">
                                                                {tripStatus}
                                                            </small>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Action Column */}
                                                <td style={{ textAlign: 'center' }}>
                                                    {isSelected ? (
                                                        <CheckCircle2 size={18} className="selected-icon" />
                                                    ) : (
                                                        <button
                                                            className={`btn-select-pair ${isBlocked ? 'disabled-btn' : ''}`}
                                                            disabled={isBlocked || isSaving}
                                                        >
                                                            Select
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="no-data-cell">
                                            No {roleLabel.toLowerCase()}s found matching filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="edit-pair-modal-footer">
                    <button className="btn-secondary" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditPairModal;