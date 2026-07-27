import React, { useMemo, useRef, useState } from 'react';
import TableView from './ewul_TableFlex';
import { NEW_TRIPS_UNFILTERED_TABLE_CONFIG } from '../truth.config'; // Adjust path if needed
import './comp_css/OrderAssignmentDashboard.css';

interface OrderAssignmentDashboardProps {
    newOrdersList: any[];
    newOrdersLoading?: boolean;
    tripAssignedList: any[];
    tripAssignedLoading?: boolean;
    businessUnits: string[]; // List of Business Unit names to generate cards
    displayMapping: CardDisplayMapping;
    cardBodyMaxHeight?: string;
}

interface DroppedItemsState {
    [buId: string]: any[]; // Maps BU ID to an array of dropped row objects
}

export interface ColumnFieldConfig {
    field: string;
    label: string;
}

export interface CardDisplayMapping {
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
}) => {
    console.log(tripAssignedLoading);
    const [collapsedBUs, setCollapsedBUs] = useState<Record<string, boolean>>({});
    const toggleCollapse = (buName: string) => {
        setCollapsedBUs(prev => ({
            ...prev,
            [buName]: !prev[buName]
        }));
    };

    // 💡 MOVE STATE INSIDE THE COMPONENT
    const [buDroppedItems, setBuDroppedItems] = useState<DroppedItemsState>({});
    const [recentDroppedId, setRecentDroppedId] = useState<string | null>(null);

    const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Group assigned trips by Business Unit for the card bodies
    const assignedByBU = useMemo(() => {
        const groups: Record<string, any[]> = {};
        businessUnits.forEach(bu => {
            groups[bu] = tripAssignedList.filter(trip => trip.BusinessUnit === bu);
        });
        return groups;
    }, [tripAssignedList, businessUnits]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Required for drop event to fire!
        e.dataTransfer.dropEffect = "move";
    };

    // 💡 REFACTORED: Expect a string for buName instead of an object
    const handleDropOnBUCard = (e: React.DragEvent, buName: string) => {
        e.preventDefault();
        const rawData = e.dataTransfer.getData("application/json");

        if (rawData) {
            try {
                const droppedRowRecord = JSON.parse(rawData);
                const targetRowKey = droppedRowRecord._rowId || droppedRowRecord.id;

                setBuDroppedItems(prev => {
                    const currentItems = prev[buName] || [];
                    const isDuplicate = currentItems.some(item =>
                        (item._rowId && item._rowId === droppedRowRecord._rowId) ||
                        (item.id && item.id === droppedRowRecord.id)
                    );
                    if (isDuplicate) return prev;
                    return { ...prev, [buName]: [...currentItems, droppedRowRecord] };
                });

                // 💡 3. Clear the previous pending cleanup timer if it exists
                if (flashTimeoutRef.current) {
                    clearTimeout(flashTimeoutRef.current);
                }

                // Set the new drop key active
                setRecentDroppedId(targetRowKey);

                setTimeout(() => {
                    const targetElement = document.getElementById(`dropped-item-${targetRowKey}`);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }

                    // 💡 4. Save the new timeout reference
                    flashTimeoutRef.current = setTimeout(() => {
                        setRecentDroppedId(null);
                        flashTimeoutRef.current = null; // Reset ref
                    }, 2000);
                }, 50);

            } catch (err) {
                console.error("Failed to process dropped row payload:", err);
            }
        }
    };

    // Check if there's at least one trip sitting in the local drop zone state
    const hasLocalDrops = Object.values(buDroppedItems).some(
        (trips) => trips && trips.length > 0
    );

    const locallyDroppedIds = useMemo(() => {
        const ids = new Set<string>();

        Object.values(buDroppedItems).forEach((trips) => {
            trips?.forEach((trip) => {
                // Read OE directly, falling back to internal table IDs if needed
                const tripKey = trip.OE !== undefined && trip.OE !== null ? trip.OE : (trip._rowId || trip.id);

                if (tripKey !== undefined && tripKey !== null) {
                    ids.add(String(tripKey)); // Coerce to string for safe type checking
                }
            });
        });
        return ids;
    }, [buDroppedItems]);

    // 💡 Filters out any order whose 'OE' matches an item in the drop set
    const filteredNewOrdersList = useMemo(() => {
        // console.log("locallyDroppedIds", locallyDroppedIds);
        // console.log("newOrdersList", newOrdersList);

        return newOrdersList.filter((order) => {
            const orderKey = order.OE !== undefined && order.OE !== null ? order.OE : (order._rowId || order.id);

            // If the key isn't in the dropped Set, we keep it in the new orders list
            return orderKey !== undefined && orderKey !== null ? !locallyDroppedIds.has(String(orderKey)) : true;
        });
    }, [newOrdersList, locallyDroppedIds]);

    return (
        <div className="order-assignment-container">
            {/* Left Side: New Orders Table (Ratio 6) */}
            <div className="orders-table-section">
                <div className="bu-ass-dash-section-header">
                    <h2>New Orders</h2>
                </div>
                <TableView
                    data={filteredNewOrdersList}
                    config={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.table_config}
                    rowStyle={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.rowStyle}
                    searchCol={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.searchable_cols as any}
                    overflowX
                    overflowY
                    tableMinHeight="calc(100% - 50px)"
                    rowActionMode='dragndrop'
                    // accordion={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.accordion}
                    showRowCount={100}
                    // isLoading={newOrdersLoading}
                    density='tight'
                />
            </div>


            {/* <div className="dashboard-flow-arrow-container">
                <div className="dashboard-flow-arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="12" x2="20" y2="12"></line>
                        <polyline points="13 5 20 12 13 19"></polyline>
                    </svg>
                </div>
            </div> */}


            {/* Right Side: Kanban/BU Visual Cards (Ratio 5) */}
            <div className="bu-cards-section">
                <div className="bu-ass-dash-section-header">
                    <h2>
                        Business Units
                        {hasLocalDrops && (
                            <span className="bu-header-pending-tag">
                                (Unsaved Changes)
                            </span>
                        )}
                    </h2>

                    {/* 💡 NEW: Shows up only when there are uncommitted local drops */}
                    {hasLocalDrops && (
                        <div className="header-actions-container">
                            <button
                                className="btn-action-outline btn-confirm"
                                onClick={() => {/* Call your confirm/save API logic here */ }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Confirm
                            </button>

                            <button
                                className="btn-action-outline btn-cancel"
                                onClick={() => setBuDroppedItems({})} // Clears all local drops instantly
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

                        // 💡 COMBINE BOTH LISTS SO DROPPED ROWS SHOW UP IMMEDIATELY
                        const allCombinedTrips = [...originalBuTrips, ...locallyDroppedTrips];

                        const currentLoad = allCombinedTrips.length;
                        const maxCapacity = 50;
                        const loadPercentage = Math.min((currentLoad / maxCapacity) * 100, 100);

                        return (
                            <div
                                key={bu}
                                className="bu-visual-card"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDropOnBUCard(e, bu)}
                            >
                                {/* Header Dashboard */}
                                <div className="bu-card-header">

                                    {/* Line 1: BU Name & Count Analytics */}
                                    <div className="bu-title-row">

                                        {/* 💡 NEW: Grouped Chevron and Title */}
                                        <div className="bu-title-left">
                                            <button
                                                className={`collapse-chevron ${collapsedBUs[bu] ? 'is-collapsed' : ''}`}
                                                onClick={() => toggleCollapse(bu)}
                                                aria-label="Toggle Business Unit"
                                            >
                                                {/* Simple inline SVG Chevron */}
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                            </button>
                                            <h3>{bu}</h3>
                                        </div>

                                        <div className="bu-metrics-grid">
                                            {hasLocalDrops && (<><div className="metric-box">
                                                <span className="metric-label">Add:</span>
                                                <span className="metric-value">{locallyDroppedTrips.length}</span>
                                            </div><>|</></>)}
                                            <div className="metric-box">
                                                <span className="metric-label">Total:</span>
                                                <span className="metric-value">{currentLoad}</span>
                                            </div>
                                            <div className="metric-box">
                                                <span className="metric-label">Assi:</span>
                                                <span className="metric-value">{originalBuTrips.length}</span>
                                            </div>
                                            <div className="metric-box">
                                                <span className="metric-label">Disp:</span>
                                                <span className="metric-value">{originalBuTrips.length}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Line 2: Progress Bar & Capacity Constraints */}
                                    <div className="bu-progress-row">
                                        <div className="bu-load-bar-container">
                                            <div
                                                className="bu-load-bar-fill"
                                                style={{ width: `${loadPercentage}%` }}
                                            />
                                        </div>
                                        <span className="capacity-badge">
                                            {currentLoad}/{maxCapacity} Max
                                        </span>
                                    </div>
                                </div>

                                {/* Drop Zone Body */}
                                <div
                                    className={`bu-card-body drop-zone ${collapsedBUs[bu] ? 'is-collapsed' : ''}`}
                                    style={{
                                        // 💡 1. Animate between 0px and your configured max height
                                        maxHeight: collapsedBUs[bu] ? '0px' : (cardBodyMaxHeight || '350px'),

                                        // 💡 2. Override the 100px min-height from your CSS when collapsed
                                        minHeight: collapsedBUs[bu] ? '0px' : '100px',

                                        // 💡 3. Flatten vertical padding so the box doesn't leave a 30px gap when closed
                                        paddingTop: collapsedBUs[bu] ? '0px' : '15px',
                                        paddingBottom: collapsedBUs[bu] ? '0px' : '15px',

                                        // 💡 4. Fade out the text
                                        opacity: collapsedBUs[bu] ? 0 : 1,

                                        // 💡 5. Prevent scrollbars from jumping around during the animation
                                        overflowY: collapsedBUs[bu] ? 'hidden' : 'auto',

                                        // 💡 6. Hide from screen readers / tab indexing when fully closed
                                        visibility: collapsedBUs[bu] ? 'hidden' : 'visible',

                                        display: 'flex',
                                        flexDirection: 'column',

                                        // 💡 7. Apply the smooth transition to all changed properties
                                        transition: 'all 0.3s ease-in-out'
                                    }}
                                >
                                    {allCombinedTrips.length === 0 ? (
                                        <div className="drop-zone-placeholder" style={{ margin: 'auto', padding: '16px' }}>
                                            <span>Drag orders here to assign</span>
                                        </div>
                                    ) : (
                                        <div className="assigned-orders-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {allCombinedTrips.map((trip, idx) => {
                                                const tripKey = trip._rowId || trip.id || idx;
                                                const isNewDrop = tripKey === recentDroppedId;

                                                const orderId = trip[displayMapping.titleField] || `New #${idx + 1}`;
                                                const status = displayMapping.statusField ? trip[displayMapping.statusField] : undefined;
                                                const source = trip[displayMapping.routeStartField] || '—';
                                                const destination = trip[displayMapping.routeEndField] || '—';

                                                return (
                                                    <div
                                                        key={tripKey}
                                                        id={`dropped-item-${tripKey}`}
                                                        className={`assigned-order-item ${isNewDrop ? 'just-dropped-flash' : ''}`}
                                                    >
                                                        <div className="order-item-header">
                                                            <span className="order-id">
                                                                {displayMapping.titleField.toUpperCase()}: {orderId}
                                                            </span>
                                                            {status && <span className="order-status">{status}</span>}
                                                        </div>
                                                        <div className="order-item-route">
                                                            <span>{source} → {destination}</span>
                                                        </div>
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
        </div>
    );
};

export default OrderAssignmentDashboard;