import React, { useState, useEffect } from 'react';
import { RefreshCcw, X } from 'lucide-react';
import Modal from './ewul_Modal';
import type { DMS_CancellationRequests } from '../generated/models/DMS_CancellationRequestsModel';
import { type LiveDMSView_CEM } from '../generated/models/LiveDMSView_CEMModel';
import { LiveDMSView_CEMService } from '../generated/services/LiveDMSView_CEMService';
import type { UpsertTripTaskTrackerRequest } from '../generated/models/UpsertTripTaskTrackerModel';
import './comp_css/CancellationRequestsModal.css';

//@ts-ignore
import TableView, { type ColumnConfig, type scrollToConfig } from '../components/ewul_TableFlex';

//Utils
import {
    //@ts-ignore
    ewulFetchAll, ewulCreate, ewulUpdate, ewulDelete, ewulExecute, ewulSharePointAPI,
    logDmsUpdate,
    convertFormDataToHtmlTable,
    logDebug, type DebugLogParams,
} from '../utils/Ewul_GSDC_Utils';
import { useTaskWorker } from '../utils/TaskWorkerContext';

import {
    CANCELLATION_REQUEST_TABLE_CONFIG,
    GSDC_ANNOUNCEMENT_ENDPOINT,
    type UserInfo,
    TRIP_PROGRESS,
} from '../truth.config';

interface CancellationRequestsModalProps {
    requests: DMS_CancellationRequests[];
    isLoading: boolean;
    user?: UserInfo | null;
    onClose: () => void;
    onRefresh: () => void;
    onProceed?: (record: LiveDMSView_CEM, deselect: boolean) => void;
    onRefreshTrips?: () => void;
    onCancelTrip?: (id: number) => void;
    onCancellationSignal?: (updatedRequest: DMS_CancellationRequests) => void;
}

const CancellationRequestsModal: React.FC<CancellationRequestsModalProps> = ({
    requests,
    isLoading,
    user,
    onClose,
    onRefresh,
    onProceed,
    onRefreshTrips,
    onCancelTrip,
    onCancellationSignal,
}) => {
    const { addTask } = useTaskWorker();

    // State for the confirmation popup modal
    const [confirmModalData, setConfirmModalData] = useState<{
        signal: string;
        record: any;
    } | null>(null);
    const [remarks, setRemarks] = useState('');
    const [isProceedLocked, setIsProceedLocked] = useState(true);
    const [countdown, setCountdown] = useState(0);

    // Timer effect: Starts a 1-second interval countdown once remarks are valid
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (confirmModalData && remarks.trim() !== '') {
            setIsProceedLocked(true);
            setCountdown(3);

            interval = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setIsProceedLocked(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setIsProceedLocked(true);
            setCountdown(0);
        }

        return () => clearInterval(interval);
    }, [confirmModalData, remarks.trim() !== '']);

    const handleLogError = (formData: any, error: unknown, action: string, context: string, jsonDetails?: any, user?: UserInfo | null) => {
        const err: DebugLogParams = {
            contextType: context,
            user: user?.FullName,
            nav: `ordrcancel.${action}`,
            error: error,
            details: jsonDetails ? jsonDetails : formData as any,
            tripOE: formData.OE,
        }
        logDebug(err);
    }

    const handleTripAnnounce = async (formData: any, title: string, message: string, hasDeepLink?: boolean, composeMessage?: boolean, imageName?: string, imageData?: string) => {
        const chat = 'dispapp';
        const now = Date.now();
        const appID = import.meta.env.VITE_APP_ID;
        const tenantID = import.meta.env.VITE_TENANT_ID;
        const sourceTime = now;

        const liveUrl = `https://apps.powerapps.com/play/e/${appID}?tenantId=${tenantID}&sourcetime=${sourceTime}&oe=${encodeURIComponent(formData.OE || '')}`;
        const deepLink = liveUrl;

        const formatted = new Date(now).toLocaleTimeString('en-US', {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        try {
            const response = await fetch(GSDC_ANNOUNCEMENT_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat: chat,
                    messageTitle: `${title} - ${formData.OE} - ${formatted}`,
                    message: message,
                    messagedBy: user?.FullName,
                    referenceLink: hasDeepLink ? deepLink : '',
                    referenceMessage: hasDeepLink ? `View Trip Details here` : '',
                    imageName: imageName || '',
                    imageData: imageData || '',
                    compose: composeMessage || false
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error(`Failed to broadcast announcement for [${formData.OE}]:`, error);
        }
    };

    const handleUpdateTripTaskTracker = async (formData: any, wouldbeformData: LiveDMSView_CEM, deleteAnyways?: boolean) => {
        const progress = wouldbeformData.TripProgress;
        if (!progress) return;

        const deleteIfComplete: boolean = !!((TRIP_PROGRESS ? TRIP_PROGRESS.find(p => p.Progress === progress)?.idx ?? 0 : 0) >= 2 && wouldbeformData.OE);
        const payload: UpsertTripTaskTrackerRequest = {
            OE: wouldbeformData.OE || '',
            TripProgress: progress,
            AssignedDriver: !!wouldbeformData.Driver,
            AssignedUnit: !!wouldbeformData.Vehicle,
            HasATW: !!wouldbeformData.ATW_x002f_LO_x0023_,
            HasSO: !!wouldbeformData.SO_x0023_,
            UpdateOnly: false,
            deleteIfComplete: deleteIfComplete,
            deleteAnyways: !!deleteAnyways,
            EditorName: user?.FullName || 'Unknown User',
            TripJSON: JSON.stringify({
                SourceName: formData.Source,
                TripGroup: formData._tripGroup,
                CementType: formData.cementType
            })
        };

        try {
            ewulExecute('DISPATCH_APP_DMS', 'UpsertTripTaskTracker', payload as any);
        } catch (error) {
            console.error("Failed to sync TripTaskTracker:", error);
            handleLogError(error, `synctriptask`, 'Trip - Sync Trip Task', payload.OE || '');
        }
    };

    const handleTripRevert = async (OE: string) => {
        const wew = await ewulFetchAll<LiveDMSView_CEM>(
            LiveDMSView_CEMService,
            { filter: `OE eq '${OE}'`, orderBy: ["OEDateAsInt2 desc"] },
            1,
            'ID',
        );

        const formData = wew[0] as LiveDMSView_CEM;

        addTask({
            id: `triprevert-${OE}-${Date.now()}`,
            name: `Reverting trip ${OE}`,
            execute: async () => {
                try {
                    const result = await ewulUpdate('DISPATCH_APP_DMS', 'DMS_CEM',
                        formData.ID.toString(),
                        {
                            Trip_x0020_Status: 'ITD',
                            TripProgress: 'Dispatched To Destination',
                            Completed_x0020_Date: null,
                            Documented_x0020_Date: null,
                            Verified_x0020_By: null,
                        } as any
                    );

                    if (result.error) {
                        throw new Error(result.error.message);
                    }

                    return { success: true, data: result.data };
                } catch (error) {
                    handleLogError(OE, error, `triprevert`, 'Trip - Revert');
                    return { success: false, error };
                }
            },
            checkSuccess: (result: { success: boolean }) => result.success,
            onSuccess: () => {
                onRefreshTrips?.();
                onProceed?.({
                    ...formData,
                    Documented_x0020_Date: undefined,
                    Verified_x0020_By: undefined,
                }, false);
                logDmsUpdate({
                    userName: user?.FullName || '',
                    userID: Number(user?.id) || 0,
                    inputOE: formData.OE || '',
                    action: `Trip Approve Reversion.`,
                    value: formData.OE || '',
                    isRecordJSON: true,
                    context: `Trip - Approve Reversion`,
                    role: user?.Position || '',
                });
                handleTripAnnounce(
                    formData,
                    'TRIP REVERSION APPROVED',
                    'The trip was reverted back to [Dispatch To Destination] status for Correction / Resubmission. All ASSIGNMENT changes will be made must be coordinated with the Team.',
                    true
                );
            },
            onFailure: () => { onRefreshTrips?.(); },
            message: `Reverting trip ${formData.OE}...`,
            message_success: `Trip ${formData.OE} reverted successfully!`,
            message_failure: (result) => `Failed to revert trip ${formData.OE}. Reason: ${result.error?.message || 'Unknown error'}`
        });
    };

    const handleCancelTrip = async (OE: string, remarksText?: string, broadcast?: boolean) => {
        const wew = await ewulFetchAll<LiveDMSView_CEM>(
            LiveDMSView_CEMService,
            { filter: `OE eq '${OE}'`, orderBy: ["OEDateAsInt2 desc"] },
            1,
            'ID',
        );

        const formData = wew[0] as LiveDMSView_CEM;

        addTask({
            id: `tripcancel-${formData.OE}`,
            name: `Cancelling trip ${formData.OE}`,
            execute: async () => {
                onCancelTrip?.(formData.ID);
                try {
                    await ewulDelete('DISPATCH_APP_DMS', 'DMS_CEM', formData.ID.toString());

                    ewulExecute('DISPATCH_APP_DMS', 'UpsertTripTaskTracker', {
                        OE: formData.OE || '',
                        TripProgress: formData.TripProgress || '',
                        AssignedDriver: !!formData.Driver,
                        AssignedUnit: !!formData.Vehicle,
                        HasATW: !!formData.ATW_x002f_LO_x0023_,
                        HasSO: !!formData.SO_x0023_,
                        UpdateOnly: false,
                        deleteIfComplete: true,
                        deleteAnyways: true,
                        EditorName: user?.FullName || 'Unknown User',
                    } as any);

                    logDmsUpdate({
                        userName: user?.FullName || '',
                        userID: Number(user?.id) || 0,
                        inputOE: formData.OE || '',
                        action: `Trip Approve Cancellation`,
                        value: formData.OE || '',
                        isRecordJSON: true,
                        context: `Trip - Approve Cancellation`,
                        role: user?.Position || '',
                    });

                    return { success: true };
                } catch (error) {
                    handleLogError(formData, error, `tripcancel`, 'Trip - Cancel');
                    return { success: false, error };
                }
            },
            checkSuccess: (result: { success: boolean }) => result.success,
            onSuccess: () => {
                onRefreshTrips?.();
                if (formData.OE) {
                    handleUpdateTripTaskTracker(formData, formData, true);
                    if (broadcast) {
                        handleTripAnnounce(
                            formData,
                            `TRIP CANCELLATION APPROVED`,
                            `<p>The trip <strong>[${formData.TripTicketID}]</strong> was cancelled and all of its dispatch data was cleared from DMS.</p><br><p>Reason: ${remarksText}</p>${convertFormDataToHtmlTable(formData)}`,
                            false,
                            true
                        );
                    }
                }
            },
            onFailure: () => { onRefreshTrips?.(); },
            message: `Cancelling trip ${formData.OE}...`,
            message_success: `Trip ${formData.OE} has been cancelled successfully.`,
            message_failure: (result) => `Failed to cancel trip ${formData.OE}. Reason: ${result.error?.message || 'Unknown error'}`
        });
    };

    const handleConfirmAction = async () => {
        if (!confirmModalData) return;
        const { signal, record } = confirmModalData;

        const currentRemarks = remarks;

        setConfirmModalData(null);
        setRemarks('');

        try {
            if (signal === 'APPROVE_CANCELLATION') {
                if (record.requestType === 'REVERT') {
                    await handleTripRevert(record.oldOE);
                } else if (record.requestType === 'CANCEL') {
                    await handleCancelTrip(record.oldOE, currentRemarks, true);
                }

                const updatedRecord = {
                    status: 'Approved',
                    approver: user?.FullName,
                    remarks: currentRemarks,
                } as DMS_CancellationRequests;

                ewulUpdate('DISPATCH_APP_DMS', 'DMS_CancellationRequests', record.CancellationID, updatedRecord);
                onCancellationSignal?.({ ...record, ...updatedRecord });
            } else if (signal === 'DISAPPROVE_CANCELLATION') {
                const updatedRecord = {
                    status: 'Disapproved',
                    approver: user?.FullName,
                    remarks: currentRemarks,
                } as DMS_CancellationRequests;

                ewulUpdate('DISPATCH_APP_DMS', 'DMS_CancellationRequests', record.CancellationID, updatedRecord);
                onCancellationSignal?.({ ...record, ...updatedRecord });
            }
        } catch (e) {
            console.error('Failed to process cancellation request signal:', e);
        } finally {
            setConfirmModalData(null);
            setRemarks('');
        }
    };

    return (
        <Modal
            onClose={onClose}
            hideX
            width={'90%'}
            height={'90vh'}
        >
            <div className="cancellation-requests-modal">
                <div className="cancellation-requests-header">
                    <div>
                        <h2>Cancellation Requests</h2>
                        <span>{requests.length} request(s)</span>
                    </div>
                    <div className="cancellation-requests-actions">
                        <button onClick={onRefresh} disabled={isLoading} title="Refresh">
                            <RefreshCcw size={16} className={isLoading ? 'spinning' : ''} />
                        </button>
                        <button onClick={onClose} title="Close">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="cancellation-requests-table-wrapper">
                    <TableView
                        data={requests}
                        config={CANCELLATION_REQUEST_TABLE_CONFIG.table_config}
                        searchCol={CANCELLATION_REQUEST_TABLE_CONFIG.searchable_cols as string[]}
                        storageKey={`order_page_cancellation_request${user?.id}`}
                        isLoading={isLoading}
                        showRowCount={500}
                        onRefresh={(signal: boolean) => signal && onRefresh()}
                        overflowY={true}
                        overflowX={true}
                        colMinWidth={120}
                        onRowClick={() => { null }}
                        theme="var(--color-primary)"
                        allowMultipleSelection={false}
                        rowStyle={CANCELLATION_REQUEST_TABLE_CONFIG.rowStyle}
                        loadingNoPreventAction={true}
                        showNumbering={true}
                        highlightSelected={true}
                        onSignal={async (signal: string, record: any) => {
                            if (signal === 'APPROVE_CANCELLATION' || signal === 'DISAPPROVE_CANCELLATION') {
                                setRemarks('');
                                setConfirmModalData({ signal, record });
                            }
                        }}
                    />
                </div>
            </div>

            {/* Confirmation Popup Modal */}
            {confirmModalData && (
                <Modal onClose={() => setConfirmModalData(null)} width={'450px'} height={'auto'}>
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <h3>
                            {confirmModalData.signal === 'APPROVE_CANCELLATION'
                                ? 'Approve Cancellation Request'
                                : 'Disapprove Cancellation Request'}
                        </h3>
                        <p style={{ fontSize: '14px', color: '#555' }}>
                            Please provide your remarks below before proceeding.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600 }}>Remarks:</label>
                            <textarea
                                rows={4}
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter remarks here..."
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                            <button
                                onClick={() => setConfirmModalData(null)}
                                style={{ padding: '8px 16px', background: '#e0e0e0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Back
                            </button>
                            <button
                                onClick={handleConfirmAction}
                                disabled={isProceedLocked}
                                style={{
                                    padding: '8px 16px',
                                    background: isProceedLocked ? '#cccccc' : 'var(--color-primary, #3a4efc)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: isProceedLocked ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {remarks.trim() === ''
                                    ? 'Enter Remarks First'
                                    : isProceedLocked
                                        ? `Please wait (${countdown}s)...`
                                        : 'Proceed'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </Modal>
    );
};

export default CancellationRequestsModal;