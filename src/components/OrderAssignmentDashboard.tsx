import React, { useMemo, useRef, useState } from 'react';
import TableView, { type ColumnConfig } from './ewul_TableFlex';
import { NEW_TRIPS_UNFILTERED_TABLE_CONFIG } from '../truth.config'; // Adjust path if needed
import './comp_css/OrderAssignmentDashboard.css';
import { AlertTriangle, Ban, Sparkles, ThumbsUp } from 'lucide-react';


// POWER APPS SERVICES

import { DMS_CEMService } from '../generated/services/DMS_CEMService';
import { GenerateAdditionalOE_IDService } from '../generated/services/GenerateAdditionalOE_IDService';
import { GenerateNewTripTicketService } from '../generated/services/GenerateNewTripTicketService';

import type { UpsertTripTaskTrackerRequest } from '../generated/models/UpsertTripTaskTrackerModel';
import { UpsertTripTaskTrackerService } from '../generated/services/UpsertTripTaskTrackerService';
import { CheckIfOEExistsService } from '../generated/services/CheckIfOEExistsService';

//
import { useUser } from '../utils/useUser';
import { useTaskWorker } from '../utils/TaskWorkerContext';
import AutoDismissBanner from './ewul_Banner';



interface OrderAssignmentDashboardProps {
    newOrdersList: any[];
    newOrdersLoading?: boolean;
    tripAssignedList: any[];
    tripAssignedLoading?: boolean;
    businessUnits: string[]; // List of Business Unit names to generate cards
    displayMapping: CardDisplayMapping;
    cardBodyMaxHeight?: string;
    onRefreshTrips?: () => void;
    onUpdateTripAssignedList?: (result: {
        success: boolean;
        added: any[];
        updated: any[];
        removed: string[];
    }) => void;
    newTripsTableConfig: ColumnConfig[];
    buCapacity?: any[];
}

interface DroppedItemsState {
    [buId: string]: any[]; // Maps BU ID to an array of dropped row objects
}

export interface ColumnFieldConfig {
    field: string;
    label: string;
}

export interface CardDisplayMapping {
    buField: string;
    titleField: string;      // e.g., 'OE' or 'OrderNo'
    statusField?: string;    // e.g., 'SAPStatus' or 'Status'
    routeStartField: string; // e.g., 'SourceName'
    routeEndField: string;   // e.g., 'DestiName'

    // Allow extra tracking metrics columns to display in the items if wanted
    additionalDetails?: ColumnFieldConfig[];
}

export const OrderAssignmentDashboard: React.FC<OrderAssignmentDashboardProps> = ({
    newOrdersList,
    newOrdersLoading,
    tripAssignedList,
    tripAssignedLoading,
    businessUnits,
    displayMapping,
    cardBodyMaxHeight = '350px',
    onRefreshTrips,
    onUpdateTripAssignedList,
    newTripsTableConfig,
    buCapacity,
}) => {
    console.log(tripAssignedLoading, newOrdersLoading);

    const { user } = useUser();
    const { addTask } = useTaskWorker();

    const [isTableVisible, setIsTableVisible] = useState(true);
    const [collapsedBUs, setCollapsedBUs] = useState<Record<string, boolean>>({});

    // 💡 Track which collapsed BU is temporarily expanded due to an active drag hover
    const [tempExpandedBU, setTempExpandedBU] = useState<string | null>(null);

    const toggleCollapse = (buName: string) => {
        setCollapsedBUs(prev => ({
            ...prev,
            [buName]: !prev[buName]
        }));
    };

    const [buFilters, setBuFilters] = useState<Record<string, string>>({});

    const handleMetricClick = (buName: string, filterKey: string) => {
        setBuFilters(prev => ({
            ...prev,
            [buName]: prev[buName] === filterKey ? 'all' : filterKey
        }));
    };

    // State for locally dropped/moved items and removed original trips
    const [buDroppedItems, setBuDroppedItems] = useState<DroppedItemsState>({});
    const [removedOriginalKeys, setRemovedOriginalKeys] = useState<Set<string>>(new Set());
    const [recentDroppedId, setRecentDroppedId] = useState<string | null>(null);
    const [dragOverBu, setDragOverBu] = useState<string | null>(null);
    const [isDraggingItem, setIsDraggingItem] = useState(false);
    const [draggedSourceBu, setDraggedSourceBu] = useState<string | null>(null);

    // Banner state for feedback messages
    const [bannerMsg, setBannerMsg] = useState<string | null>(null);

    const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Group assigned trips by Business Unit for the card bodies, accounting for moved items
    const assignedByBU = useMemo(() => {
        const groups: Record<string, any[]> = {};
        const groupColumn = displayMapping.buField;

        businessUnits.forEach(bu => {
            groups[bu] = tripAssignedList.filter(trip => {
                if (trip[groupColumn] !== bu) return false;
                const tripKey = trip.OE !== undefined && trip.OE !== null ? trip.OE : (trip._rowId || trip.id);
                return !removedOriginalKeys.has(String(tripKey));
            });
        });
        return groups;
    }, [tripAssignedList, businessUnits, displayMapping.buField, removedOriginalKeys]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Required for drop event to fire!
        e.dataTransfer.dropEffect = "move";
    };

    const handleDropOnBUCard = (e: React.DragEvent, targetBu: string) => {
        e.preventDefault();
        const rawData = e.dataTransfer.getData("application/json");

        if (rawData) {
            try {
                const parsedPayload = JSON.parse(rawData);

                const isBUItem = parsedPayload && typeof parsedPayload === 'object' && parsedPayload.type === 'BU_ITEM';
                const record = isBUItem ? parsedPayload.data : parsedPayload;
                const sourceBu = isBUItem ? parsedPayload.sourceBu : null;

                // 🛑 RESTRICTION: Reject drop if a New Order record's SAPStatus is not 'Approved'
                if (!isBUItem && record?.SAPStatus !== 'Approved') {
                    setBannerMsg('Only Approved order can be assigned.')
                    return;
                }

                console.log("weeeew: ", rawData);

                if (isBUItem && sourceBu === targetBu) return;

                const targetRowKey = record.OE !== undefined && record.OE !== null ? record.OE : (record._rowId || record.id);

                if (isBUItem && sourceBu) {
                    const sourceDroppedItems = buDroppedItems[sourceBu] || [];
                    const wasLocalInSource = sourceDroppedItems.some(item => {
                        const itemKey = item.OE !== undefined && item.OE !== null ? item.OE : (item._rowId || item.id);
                        return String(itemKey) === String(targetRowKey);
                    });

                    if (wasLocalInSource) {
                        setBuDroppedItems(prev => ({
                            ...prev,
                            [sourceBu]: (prev[sourceBu] || []).filter(item => {
                                const itemKey = item.OE !== undefined && item.OE !== null ? item.OE : (item._rowId || item.id);
                                return String(itemKey) !== String(targetRowKey);
                            })
                        }));
                    } else {
                        setRemovedOriginalKeys(prev => {
                            const next = new Set(prev);
                            next.add(String(targetRowKey));
                            return next;
                        });
                    }
                }

                const droppedRowRecord = {
                    ...record,
                    _isLocal: true,
                    ...(displayMapping.statusField ? { [displayMapping.statusField]: isBUItem ? record[displayMapping.statusField] : 'New Trip' } : {})
                };

                setBuDroppedItems(prev => {
                    const currentItems = prev[targetBu] || [];
                    const isDuplicate = currentItems.some(item => {
                        const existingKey = item.OE !== undefined && item.OE !== null ? item.OE : (item._rowId || item.id);
                        return String(existingKey) === String(targetRowKey);
                    });
                    if (isDuplicate) return prev;
                    return { ...prev, [targetBu]: [...currentItems, droppedRowRecord] };
                });

                // Turn temporary hover expansion into an actual open state upon successful drop
                setCollapsedBUs(prev => ({
                    ...prev,
                    [targetBu]: false
                }));
                setTempExpandedBU(null);

                if (flashTimeoutRef.current) {
                    clearTimeout(flashTimeoutRef.current);
                }

                setRecentDroppedId(String(targetRowKey));

                setTimeout(() => {
                    const targetElement = document.getElementById(`dropped-item-${targetRowKey}`);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }

                    flashTimeoutRef.current = setTimeout(() => {
                        setRecentDroppedId(null);
                        flashTimeoutRef.current = null;
                    }, 2000);
                }, 50);

            } catch (err) {
                console.error("Failed to process dropped row payload:", err);
            }
        }
    };

    const handleDropToRemoval = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingItem(false);
        const rawData = e.dataTransfer.getData("application/json");

        if (rawData) {
            try {
                const parsedPayload = JSON.parse(rawData);
                if (parsedPayload.type === 'BU_ITEM') {
                    const { sourceBu, data } = parsedPayload;
                    const targetRowKey = data.OE !== undefined && data.OE !== null ? data.OE : (data._rowId || data.id);

                    const sourceDroppedItems = buDroppedItems[sourceBu] || [];
                    const wasLocalInSource = sourceDroppedItems.some(item => {
                        const itemKey = item.OE !== undefined && item.OE !== null ? item.OE : (item._rowId || item.id);
                        return String(itemKey) === String(targetRowKey);
                    });

                    if (wasLocalInSource) {
                        // Remove from local drops
                        setBuDroppedItems(prev => ({
                            ...prev,
                            [sourceBu]: (prev[sourceBu] || []).filter(item => {
                                const itemKey = item.OE !== undefined && item.OE !== null ? item.OE : (item._rowId || item.id);
                                return String(itemKey) !== String(targetRowKey);
                            })
                        }));
                    } else {
                        // Mark original assigned trip as removed so it returns to New Orders
                        setRemovedOriginalKeys(prev => {
                            const next = new Set(prev);
                            next.add(String(targetRowKey));
                            return next;
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to process removal payload:", err);
            }
        }
    };

    const [ShowOEDuplicateWarningModal, setShowOEDuplicateWarningModal] = useState(false);
    console.log(ShowOEDuplicateWarningModal);
    const handleConfirmChanges = async () => {
        // 1. Orders to Add or Update (All items currently dropped/moved into any BU card)
        const ordersToUpsert = Object.entries(buDroppedItems).flatMap(([buName, items]) =>
            items.map(item => ({
                ...item,
                [displayMapping.buField]: buName // Ensure the correct Business Unit is stamped
            }))
        );

        // 1. Gather all dropped keys across all BUs
        const allDroppedIds = new Set<string>();
        Object.values(buDroppedItems).forEach(items => {
            items?.forEach(item => {
                // Fallback checks including the nested rawData object property
                const key = item.OE !== undefined && item.OE !== null
                    ? item.OE
                    : (item.rawData?.OE || item._rowId || item.ID || item.rawData?.ID);
                if (key !== undefined && key !== null) {
                    allDroppedIds.add(String(key));
                }
            });
        });

        // 2. Extract full records from tripAssignedList that were moved to the trash zone
        const ordersToDelete = tripAssignedList
            .filter(trip => {
                // Check root first, fallback to the nested rawData structure
                const tripKey = trip.OE !== undefined && trip.OE !== null
                    ? trip.OE
                    : (trip.rawData?.OE || trip._rowId || trip.ID || trip.rawData?.ID);

                // The item must be in removedOriginalKeys, but NOT re-assigned/dropped elsewhere
                return removedOriginalKeys.has(String(tripKey)) && !allDroppedIds.has(String(tripKey));
            })
            .map(trip => trip.rawData?.ID || trip.ID) // Transform the remaining objects down to just the ID
            .filter(id => id !== undefined && id !== null); // Safety clearing filter

        // =============================================================
        // PREPARE AND FIRE OPTIMISTIC UPDATE STAGE (Runs instantly)
        // =============================================================
        const addedRows: any[] = [];
        const updatedRows: any[] = [];
        const removedRows: string[] = ordersToDelete.map(id => id.toString());

        ordersToUpsert.forEach(order => {
            const optimisticRecord = {
                ...order,
                TripProgress: "Assigned",
                Buisness_x0020_Unit: order[displayMapping.buField]
            };

            if (order._isLocal) {
                addedRows.push(optimisticRecord);
            } else {
                updatedRows.push(optimisticRecord);
            }
        });

        // 🚀 Update the UI state right now before firing any promises
        if (onUpdateTripAssignedList) {
            onUpdateTripAssignedList({
                success: true,
                added: addedRows,
                updated: updatedRows,
                removed: removedRows,
            });
        }

        // Capture staging state reference for error rollbacks, then clear immediately to unblock drag UI
        setBuDroppedItems({});
        setRemovedOriginalKeys(new Set());



        // --- Ready for API submission ---
        console.log("Orders to Add / Update:", ordersToUpsert);
        console.log("Orders to Delete / Unassign:", ordersToDelete);

        // API CALL:
        addTask({
            id: "confirm-order-assignment",
            name: "Confirm Order Assignment",

            message: "Applying order assignments...",
            message_success: `Successfully processed ${ordersToUpsert.length} order(s).`,
            message_failure: "Failed to process order assignments.",

            execute: async () => {

                // Create / Update Loop
                for (const order of ordersToUpsert) {

                    // If this is a NEW order dragged from New Orders
                    if (order._isLocal) {

                        console.log("Checking duplicate");

                        // 1. Check duplicate OE
                        const duplicateCheck = await CheckIfOEExistsService.CheckIfOEExists(order.OE);
                        const table1 = duplicateCheck.data?.ResultSets?.Table1 as any[] | undefined;
                        if (table1 && table1.length > 0) {
                            if (table1[0].DoesExist) {
                                setShowOEDuplicateWarningModal(true);
                                throw new Error(`Duplicate OE detected: ${order.OE}`);
                            }

                            console.log("generating new trip ticket");
                            // 2. Generate Trip Ticket if missing
                            let tripTicketID = order.TripTicketID;
                            if (!tripTicketID) {
                                const ticketResult = await GenerateNewTripTicketService.GenerateNewTripTicket(order.OE);
                                const table1 = ticketResult.data?.ResultSets?.Table1 as any[] | undefined;
                                if (table1 && table1.length > 0) {
                                    tripTicketID = table1[0].TripTicketID;
                                }
                            }

                            console.log("confirming manual OE");
                            // 3. Generate Additional OE if needed (Preload / Mobilization)
                            let currentOE = order.OE;
                            let additionalOE = '';
                            if (order._tripGroup === 'Preload' || order._tripGroup === 'Mobilization') {
                                const additionalOEres = await GenerateAdditionalOE_IDService.GenerateAdditionalOE_ID(order);
                                const table1 = additionalOEres.data?.ResultSets?.Table1 as any[] | undefined;
                                if (!table1 || table1.length === 0) {
                                    // nothing
                                } else {
                                    additionalOE = table1[0].NewID;
                                }
                            }

                            console.log("building payload");
                            // 4. Build payload
                            const payload = {
                                OE: additionalOE ? additionalOE : currentOE,
                                // TripTicketID: tripTicketID,
                                TripProgress: 'Assigned',
                                Tagged_x0020_Date: new Date().toISOString(),
                                Ordered_x0020_Date: order.Ordered_x0020_Date || new Date().toISOString(),
                                Needed_x0020_Date: order.Needed_x0020_Date || new Date().toISOString(),

                                Customer: order.Customer,
                                Source: order.SourceName,
                                Destination: order.DestiName,

                                Trip_x0020_Status: undefined,
                                Buisness_x0020_Unit: order.BU,

                                _tripGroup: order._tripGroup,
                                cementType: order.CementTypeName,

                                Loading_x0020_Sequence: 9999,

                                OE_x0020_Date: additionalOE ? new Date().toDateString() : order.OE_x0020_Date,
                                //MonitoredBy: formData.MonitoredBy,
                                DispatchedBy: user?.FullName || 'Unknown User',

                                DriverLoaderType: "Full Trip",
                                DriverUnloaderType: "Full Trip",
                                HelperLoaderType: "Full Trip",
                                HelperUnloaderType: "Full Trip"
                            };

                            // 5. DMS_CEMService.create(...)
                            console.log("creating trip");
                            const createResult = await DMS_CEMService.create(payload);
                            console.log('created new trip: ', createResult)

                            // 6. Update tripID to match the newly generated database record ID
                            if (createResult?.data?.ID) {
                                console.log("updating tripID");
                                const newId = createResult.data.ID;
                                await DMS_CEMService.update(newId.toString(), { tripID: newId });

                                // 7. Update TripTaskTracker side-effects
                                const payload: UpsertTripTaskTrackerRequest = {
                                    OE: currentOE || '',
                                    TripProgress: 'Assigned',
                                    AssignedDriver: false,
                                    AssignedUnit: false,
                                    HasATW: false,
                                    HasSO: false,

                                    UpdateOnly: false, // always create or update the record regardless of progress for better tracking of changes

                                    deleteIfComplete: false, // Only delete if the trip is progressing to Done (or beyond) and has a valid OE. This prevents premature deletion of the tracker record for trips that are still in progress or don't have an OE assigned yet.
                                    deleteAnyways: false,

                                    EditorName: '',

                                    TripJSON: JSON.stringify({
                                        SourceName: order.SourceName,
                                        TripGroup: order._tripGroup,
                                        CementType: order.cementType
                                    })

                                };

                                console.log('trip task update: ', payload);

                                UpsertTripTaskTrackerService.UpsertTripTaskTracker(payload as any);
                            }

                            //track added
                            addedRows.push({
                                ...order,
                                TripProgress: "Assigned",
                                Buisness_x0020_Unit: order.BU
                            });

                        }
                        else {
                            // ✅ FIXED: Safely placed outside the local conditional block
                            const existingId = order.rawData?.ID || order.ID;
                            console.log("Updating BU for existing trip record ID:", existingId);

                            await DMS_CEMService.update(
                                existingId.toString(),
                                {
                                    Buisness_x0020_Unit: order[displayMapping.buField]
                                }
                            );
                        }
                    }


                }

                console.log("to delete IDs: ", ordersToDelete);
                // Remove / Unassign Execution Loop
                for (const id of ordersToDelete) {
                    console.log("Deleting database ID reference:", id);
                    await DMS_CEMService.delete(id.toString());
                }

                // Return the same payload structure for completeness
                return {
                    success: true,
                    added: addedRows,
                    updated: updatedRows,
                    removed: removedRows,
                };
            },

            checkSuccess: result => result.success === true,

            onSuccess: () => {
                console.log("Finished.");
                // if (onUpdateTripAssignedList) onUpdateTripAssignedList?.(result);
                // Trigger UI refresh callbacks
                if (onRefreshTrips) {
                    // Background refresh to reconcile with the server
                    setTimeout(() => {
                        onRefreshTrips?.();
                    }, 2000);
                }
                setBuDroppedItems({});
                setRemovedOriginalKeys(new Set());
            },

            onFailure: err => {
                console.error(err);

                if (onRefreshTrips) onRefreshTrips();

                setBuDroppedItems({});
                setRemovedOriginalKeys(new Set());
            }
        });

    };


    const hasLocalDrops = Object.values(buDroppedItems).some(
        (trips) => trips && trips.length > 0
    ) || removedOriginalKeys.size > 0;

    const locallyDroppedIds = useMemo(() => {
        const ids = new Set<string>();

        Object.values(buDroppedItems).forEach((trips) => {
            trips?.forEach((trip) => {
                const tripKey = trip.OE !== undefined && trip.OE !== null ? trip.OE : (trip._rowId || trip.id);
                if (tripKey !== undefined && tripKey !== null) {
                    ids.add(String(tripKey));
                }
            });
        });
        return ids;
    }, [buDroppedItems]);

    const filteredNewOrdersList = useMemo(() => {
        return newOrdersList.filter((order) => {
            const orderKey = order.OE !== undefined && order.OE !== null ? order.OE : (order._rowId || order.id);
            return orderKey !== undefined && orderKey !== null ? !locallyDroppedIds.has(String(orderKey)) : true;
        });
    }, [newOrdersList, locallyDroppedIds]);

    const isEmptyStr = (val: any) => val === null || val === undefined || (typeof val === 'string' && val.trim() === '');
    const getCapacityColor = (current: number, max: number) => {
        if (!max || max <= 0) return '#ff8c00'; // fallback to orange if max is 0/undefined
        const ratio = Math.min(Math.max(current / max, 0), 1); // clamp between 0 and 1

        // Interpolate RGB from Orange (255, 140, 0) to Green (0, 255, 102)
        const r = Math.round(255 * (1 - ratio));
        const g = Math.round(140 + (115 * ratio));
        const b = Math.round(102 * ratio);

        return `rgb(${r}, ${g}, ${b})`;
    };
    const getCapacitySuggestion = (current: number, max: number) => {
        if (!max || max <= 0) return { text: "Set capacity limit", color: "#a0a0a0", icon: null };
        const ratio = current / max;

        if (ratio === 0 || ratio < 0.4) {
            return { text: "Underloaded, Assign more orders to meet qouta.", color: "#ffcc00ff", icon: <AlertTriangle size={18} /> }; // Orange (Bad - too low)
        } else if (ratio > 1.0) {
            return { text: "Over capacity, Re-assign orders to other BU to reduce load!", color: "#f09c9cff", icon: <Ban size={32} /> }; // Red (Bad - overloaded)
        } else if (ratio >= 0.85 && ratio <= 1.0) {
            return { text: "100% Utilization Perfect load!", color: "#00ff66", icon: <Sparkles size={14} /> }; // Green (Goal reached)
        } else {
            return { text: "Good distribution, Keep going", color: "#ffffff", icon: <ThumbsUp size={14} /> }; // Neutral / Encouraging
        }
    };

    return (
        <div className="order-assignment-container">
            {/* Left Side: New Orders Table */}
            <div className={`orders-table-section ${!isTableVisible ? 'is-hidden' : ''}`}>
                <div className="bu-ass-dash-section-header">
                    <h2>New Orders</h2>
                </div>
                <>
                    <TableView
                        data={filteredNewOrdersList}
                        config={newTripsTableConfig}
                        rowStyle={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.rowStyle}
                        searchCol={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.searchable_cols as any}
                        overflowX
                        overflowY
                        tableMinHeight="calc(100% - 50px)"
                        rowActionMode='dragndrop'
                        showRowCount={500}
                        density='tight'
                        isLoading={newOrdersLoading}
                        loadingNoPreventAction={true}
                        accordion={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.accordion}
                    />
                    {/** TRASH ZONE */}
                    {isDraggingItem && (
                        <div
                            className="unassign-drop-zone"
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                            onDrop={handleDropToRemoval}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            <span>Drop here to unassign / remove</span>
                        </div>
                    )}
                </>
            </div>

            {/* Right Side: Kanban/BU Visual Cards */}
            <div className={`bu-cards-section ${!isTableVisible ? 'is-expanded' : ''}`}>
                <div className="bu-ass-dash-section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button
                            onClick={() => setIsTableVisible(!isTableVisible)}
                            style={{
                                backgroundColor: '#ffffff',
                                color: '#000080', // Navy blue
                                border: '1.5px solid #3a4efc', // Primary 2nd blue
                                borderRadius: '8px',
                                padding: '6px 7px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                                {isTableVisible ? (
                                    <>
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="9" y1="3" x2="9" y2="21"></line>
                                    </>
                                ) : (
                                    <>
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="9" y1="3" x2="9" y2="21"></line>
                                        <polyline points="13 8 17 12 13 16"></polyline>
                                    </>
                                )}
                            </svg>
                            {/* {isTableVisible ? 'Hide New Orders' : 'Show New Orders'} */}
                        </button>

                        {/* Wrap your existing <h2> inside this new flex container */}
                        <h2>
                            Business Units
                            {hasLocalDrops && (
                                <span className="bu-header-pending-tag">
                                    (Unsaved Changes)
                                </span>
                            )}
                        </h2>
                    </div>

                    {hasLocalDrops && (
                        <div className="header-actions-container">
                            <button
                                className="btn-action-outline btn-confirm"
                                onClick={() => { handleConfirmChanges() }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Confirm
                            </button>

                            <button
                                className="btn-action-outline btn-cancel"
                                onClick={() => {
                                    setBuDroppedItems({});
                                    setRemovedOriginalKeys(new Set());
                                }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
                <div className="bu-cards-grid">
                    {businessUnits.map((bu) => {
                        const originalBuTrips = assignedByBU[bu] || [];
                        const locallyDroppedTrips = buDroppedItems[bu] || [];
                        const allCombinedTrips = [...originalBuTrips, ...locallyDroppedTrips];

                        const activeFilter = buFilters[bu] || 'all';


                        const filteredCardTrips = allCombinedTrips.filter(trip => {
                            const sourceObj = trip.rawData || trip;
                            if (activeFilter === 'new') return trip._isLocal === true;
                            if (activeFilter === 'plan') return sourceObj.TripProgress === 'Planned';
                            // 'bal' handles what used to be 'assi'
                            if (activeFilter === 'bal') return sourceObj.TripProgress === 'Assigned' && isEmptyStr(sourceObj.Driver) && isEmptyStr(sourceObj.Vehicle);
                            // 'assi' now handles what used to be 'disp' (dispatched/in-progress trips)
                            if (activeFilter === 'assi') return sourceObj.TripProgress !== 'Assigned' && sourceObj.TripProgress !== 'New Trip';
                            return true; // 'all'
                        });

                        const totalCount = allCombinedTrips.length;

                        const planCount = allCombinedTrips.filter(trip => {
                            const sourceObj = trip.rawData || trip;
                            return sourceObj.TripProgress === 'Planned';
                        }).length;

                        // This was assiCount, now renamed to balCount
                        const balCount = allCombinedTrips.filter(trip => {
                            const sourceObj = trip.rawData || trip;
                            return sourceObj.TripProgress === 'Assigned' &&
                                isEmptyStr(sourceObj.Driver) &&
                                isEmptyStr(sourceObj.Vehicle);
                        }).length;

                        // This was dispCount, now renamed to assiCount
                        const assiCount = allCombinedTrips.filter(trip => {
                            const sourceObj = trip.rawData || trip;
                            return sourceObj.TripProgress !== 'Assigned' && sourceObj.TripProgress !== 'New Trip';
                        }).length;

                        const matchedBu = buCapacity?.find((item) => item.BU === bu);
                        const maxCapacity = matchedBu?.TotalHeadcount ?? 50; // Fallback to 50 if undefined or not found
                        // const loadPercentage = Math.min((totalCount / maxCapacity) * 100, 100);

                        // Determine if the card is collapsed, factoring in temporary drag hover expansion
                        const isCardCollapsed = Boolean(collapsedBUs[bu]) && tempExpandedBU !== bu;

                        return (
                            <div
                                key={bu}
                                className="bu-visual-card"
                                onDragOver={handleDragOver}
                                onDragEnter={(_e) => {
                                    // If dragging over a collapsed card, temporarily expand it
                                    if (collapsedBUs[bu]) {
                                        setTempExpandedBU(bu);
                                    }
                                    setDragOverBu(bu);
                                }}
                                onDragLeave={(e) => {
                                    // Ensure we only trigger leave if leaving the card boundary entirely
                                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                        if (tempExpandedBU === bu) {
                                            setTempExpandedBU(null);
                                        }
                                        setDragOverBu(null);
                                    }
                                }}
                                onDrop={(e) => { handleDropOnBUCard(e, bu); setDragOverBu(null); }}
                            >

                                {/* Drop Overlay Visual Hint */}
                                {(dragOverBu === bu && draggedSourceBu !== bu) && (
                                    <div className="bu-drop-overlay">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                                            <path d="M12 3v13m0 0l-4-4m4 4l4-4M2 17v2a2 2 0 002 2h16a2 2 0 002-2v-2" />
                                        </svg>
                                        <span>Drop to assign to {bu}</span>
                                    </div>
                                )}

                                {/* Header Dashboard */}
                                <div className="bu-card-header">
                                    <div className="bu-title-row">
                                        <div className="bu-title-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                className={`collapse-chevron ${isCardCollapsed ? 'is-collapsed' : ''}`}
                                                onClick={() => toggleCollapse(bu)}
                                                aria-label="Toggle Business Unit"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                            </button>
                                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                                                {bu}
                                                {totalCount > maxCapacity && (
                                                    <>
                                                        <style>{`
                                                            @keyframes pulseGlow {
                                                                0% { transform: scale(1); text-shadow: 0 0 4px #ff3333; opacity: 0.85; }
                                                                50% { transform: scale(1.25); text-shadow: 0 0 14px #ff3333, 0 0 22px #ff3333; opacity: 1; }
                                                                100% { transform: scale(1); text-shadow: 0 0 4px #ff3333; opacity: 0.85; }
                                                            }
                                                            .pulse-alert {
                                                                animation: pulseGlow 1.2s infinite ease-in-out;
                                                                display: inline-block;
                                                            }
                                                        `}</style>
                                                        <span
                                                            className="pulse-alert"
                                                            style={{
                                                                color: '#ff4d4d',
                                                                fontWeight: '900',
                                                                fontSize: '1.15em',
                                                                marginLeft: '4px',
                                                                lineHeight: 1
                                                            }}
                                                            title={`Over capacity by ${totalCount - maxCapacity} items!`}
                                                        >
                                                            !
                                                        </span>
                                                    </>
                                                )}
                                            </h3>
                                        </div>

                                        <div className="bu-metrics-grid">
                                            {hasLocalDrops && (
                                                <>
                                                    <div
                                                        className={`metric-box ${activeFilter === 'new' ? 'active-metric' : ''}`}
                                                        onClick={() => handleMetricClick(bu, 'new')}
                                                        style={{
                                                            cursor: 'pointer',
                                                            opacity: activeFilter === 'all' || activeFilter === 'new' ? 1 : 0.5,
                                                            borderBottom: activeFilter === 'new' ? '2.5px solid #ffffff' : '2.5px solid transparent',
                                                            paddingBottom: '2px',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        title="Click to filter new dropped items"
                                                    >
                                                        <span className="metric-label">New:</span>
                                                        <span className="metric-value">{locallyDroppedTrips.length}</span>
                                                    </div>
                                                    <>|</>
                                                </>
                                            )}
                                            <div
                                                className={`metric-box ${activeFilter === 'all' ? 'active-metric' : ''}`}
                                                onClick={() => handleMetricClick(bu, 'all')}
                                                style={{
                                                    cursor: 'pointer',
                                                    opacity: activeFilter === 'all' ? 1 : 0.5,
                                                    borderBottom: activeFilter === 'all' ? '2.5px solid #ffffff' : '2.5px solid transparent',
                                                    paddingBottom: '2px',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                title="Click to show all items"
                                            >
                                                <span className="metric-label">Total:</span>
                                                <span className="metric-value">{totalCount}</span>
                                            </div>
                                            <div
                                                className={`metric-box ${activeFilter === 'plan' ? 'active-metric' : ''}`}
                                                onClick={() => handleMetricClick(bu, 'plan')}
                                                style={{
                                                    cursor: 'pointer',
                                                    opacity: activeFilter === 'all' || activeFilter === 'plan' ? 1 : 0.5,
                                                    borderBottom: activeFilter === 'plan' ? '2.5px solid #ffffff' : '2.5px solid transparent',
                                                    paddingBottom: '2px',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                title="Click to filter planned items"
                                            >
                                                <span className="metric-label">Plan:</span>
                                                <span className="metric-value">{planCount}</span>
                                            </div>

                                            {/* RENAMED FROM ASSI TO BAL */}
                                            <div
                                                className={`metric-box ${activeFilter === 'bal' ? 'active-metric' : ''}`}
                                                onClick={() => handleMetricClick(bu, 'bal')}
                                                style={{
                                                    cursor: 'pointer',
                                                    opacity: activeFilter === 'all' || activeFilter === 'bal' ? 1 : 0.5,
                                                    borderBottom: activeFilter === 'bal' ? '2.5px solid #ffffff' : '2.5px solid transparent',
                                                    paddingBottom: '2px',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                title="Click to filter unassigned balance items"
                                            >
                                                <span className="metric-label">Bal:</span>
                                                <span className="metric-value">{balCount}</span>
                                            </div>

                                            {/* RENAMED FROM DISP TO ASSI */}
                                            <div
                                                className={`metric-box ${activeFilter === 'assi' ? 'active-metric' : ''}`}
                                                onClick={() => handleMetricClick(bu, 'assi')}
                                                style={{
                                                    cursor: 'pointer',
                                                    opacity: activeFilter === 'all' || activeFilter === 'assi' ? 1 : 0.5,
                                                    borderBottom: activeFilter === 'assi' ? '2.5px solid #ffffff' : '2.5px solid transparent',
                                                    paddingBottom: '2px',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                title="Click to filter active assigned/dispatched items"
                                            >
                                                <span className="metric-label">Assi:</span>
                                                <span className="metric-value">{assiCount}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bu-progress-row">
                                        <div className="bu-load-bar-container" style={{ display: 'flex', overflow: 'hidden' }}>
                                            {totalCount <= maxCapacity ? (
                                                // Normal state: scales up to max capacity
                                                <div
                                                    className="bu-load-bar-fill"
                                                    style={{
                                                        width: `${Math.min((totalCount / maxCapacity) * 100, 100)}%`,
                                                        backgroundColor: getCapacityColor(totalCount, maxCapacity),
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                />
                                            ) : (
                                                // Over-capacity state: Split into Green (max capacity) and Red (excess)
                                                <>
                                                    <div
                                                        style={{
                                                            width: `${(maxCapacity / totalCount) * 100}%`,
                                                            backgroundColor: '#00ff66',
                                                            height: '100%',
                                                            transition: 'all 0.3s ease'
                                                        }}
                                                        title={`Max Capacity: ${maxCapacity}`}
                                                    />
                                                    <div
                                                        style={{
                                                            width: `${((totalCount - maxCapacity) / totalCount) * 100}%`,
                                                            backgroundColor: '#ff3333',
                                                            height: '100%',
                                                            transition: 'all 0.3s ease'
                                                        }}
                                                        title={`Over Capacity by: ${totalCount - maxCapacity} items`}
                                                    />
                                                </>
                                            )}
                                        </div>
                                        <span className="capacity-badge" style={{ color: totalCount > maxCapacity ? '#fdbabaff' : 'inherit' }}>
                                            {totalCount}/{maxCapacity} Max {totalCount > maxCapacity && `(+${totalCount - maxCapacity})`}
                                        </span>
                                    </div>

                                    {/* Middle: Dynamic Suggestion Message */}
                                    {(() => {
                                        const suggestion = getCapacitySuggestion(totalCount, maxCapacity);
                                        return (
                                            <span
                                                className="bu-suggestion-msg"
                                                style={{
                                                    flex: 1,
                                                    textAlign: 'center',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
                                                    color: suggestion.color,
                                                    padding: '0 2px',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {suggestion.text}
                                            </span>
                                        );
                                    })()}
                                </div>

                                {/* Drop Zone Body */}
                                <div
                                    className={`bu-card-body drop-zone ${isCardCollapsed ? 'is-collapsed' : ''}`}
                                    style={{
                                        maxHeight: isCardCollapsed ? '0px' : (cardBodyMaxHeight || '350px'),
                                        minHeight: isCardCollapsed ? '0px' : '100px',
                                        paddingTop: isCardCollapsed ? '0px' : '15px',
                                        paddingBottom: isCardCollapsed ? '0px' : '15px',
                                        opacity: isCardCollapsed ? 0 : 1,
                                        overflowY: isCardCollapsed ? 'hidden' : 'auto',
                                        visibility: isCardCollapsed ? 'hidden' : 'visible',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: 'all 0.3s ease-in-out'
                                    }}
                                >
                                    {filteredCardTrips.length === 0 ? (
                                        <div className="drop-zone-placeholder" style={{ margin: 'auto', padding: '16px' }}>
                                            <span>{activeFilter !== 'all' ? `No items match filter (${activeFilter.toUpperCase()})` : 'Drag orders here to assign'}</span>
                                        </div>
                                    ) : (
                                        <div className="assigned-orders-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {filteredCardTrips.map((trip, idx) => {
                                                const tripKey = trip.OE !== undefined && trip.OE !== null ? trip.OE : (trip._rowId || trip.id || idx);
                                                const isNewDrop = String(tripKey) === recentDroppedId;
                                                const isLocal = trip._isLocal === true;

                                                const orderId = trip[displayMapping.titleField] || `New #${idx + 1}`;
                                                //@ts-ignore
                                                const status = displayMapping.statusField ? trip[displayMapping.statusField] : undefined;
                                                const source = trip[displayMapping.routeStartField] || '—';
                                                const destination = trip[displayMapping.routeEndField] || '—';
                                                const sourceObj = trip.rawData || trip;
                                                const canDrag = isLocal || (
                                                    sourceObj.TripProgress === 'Assigned' &&
                                                    isEmptyStr(sourceObj.Driver) &&
                                                    isEmptyStr(sourceObj.Helper) &&
                                                    isEmptyStr(sourceObj.Vehicle) &&
                                                    isEmptyStr(sourceObj.BO)
                                                );

                                                return (
                                                    <div
                                                        key={tripKey}
                                                        id={`dropped-item-${tripKey}`}
                                                        className={`assigned-order-item ${isNewDrop ? 'just-dropped-flash' : ''}`}
                                                        draggable={canDrag}
                                                        onDragStart={(e) => {
                                                            if (!canDrag) {
                                                                e.preventDefault();
                                                                return;
                                                            }
                                                            setIsDraggingItem(true);
                                                            setDraggedSourceBu(bu);
                                                            const payload = {
                                                                type: 'BU_ITEM',
                                                                sourceBu: bu,
                                                                data: trip
                                                            };
                                                            e.dataTransfer.setData("application/json", JSON.stringify(payload));
                                                            e.dataTransfer.dropEffect = "move";
                                                        }}
                                                        onDragEnd={() => { setTempExpandedBU(null); setIsDraggingItem(false); setDraggedSourceBu(null); }}
                                                        style={{
                                                            borderLeft: isLocal ? '4px solid var(--color-primary-2)' : undefined,
                                                            cursor: canDrag ? 'grab' : 'not-allowed',
                                                            opacity: canDrag ? 1 : 0.7
                                                        }}
                                                    >
                                                        <div className="order-item-header">
                                                            <span className="order-id">
                                                                {/*{displayMapping.titleField.toUpperCase()}:*/} {orderId}
                                                            </span>
                                                            {/* Conditional Rendering for TripProgress Status Label */}
                                                            {(() => {
                                                                const rawProgress = sourceObj.TripProgress;
                                                                let displayStatus = 'Assigned'; // fallback matching "everything else"

                                                                if (rawProgress === 'Planned') {
                                                                    displayStatus = 'Planned';
                                                                } else if (rawProgress === 'Assigned') {
                                                                    displayStatus = 'Balance';
                                                                }

                                                                return <span className="order-status">{displayStatus}</span>;
                                                            })()}
                                                        </div>
                                                        <div className="order-item-route">
                                                            <span>{source} → {destination}</span>
                                                        </div>

                                                        {displayMapping.additionalDetails && displayMapping.additionalDetails.length > 0 && (
                                                            <div className="order-item-details" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: '6px', fontSize: '0.82rem', opacity: 0.65 }}>
                                                                {displayMapping.additionalDetails.map((detail, dIdx) => {
                                                                    const detailValue = sourceObj[detail.field];

                                                                    if (!detailValue) return null;

                                                                    return (
                                                                        <span key={detail.field || dIdx} className="order-detail-span">
                                                                            <strong>{detail.label}:</strong> {detailValue}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {bannerMsg && (
                <AutoDismissBanner
                    message={bannerMsg}
                    onClose={() => setBannerMsg(null)}
                    duration={2000}
                />
            )}
        </div>
    );
};



export default OrderAssignmentDashboard;