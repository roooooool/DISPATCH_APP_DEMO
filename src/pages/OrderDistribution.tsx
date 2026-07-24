import React, { useState, useCallback, useEffect, useRef } from 'react';
import PageTemplate from './template';
import { 
  RefreshCcw, 
  Pencil, Check, X
} from 'lucide-react';

import { useUser } from '../utils/useUser';
import { 
  ewulFetchAll, 
  ISOtoInt, 
  useAntiSpam,
} from '../utils/Ewul_GSDC_Utils'; 

//itshover icons
import PenIcon from '@ui/pen-icon';


//POWER APPS SERVICES
import { NewTripsView_CEM_unfilteredService } from '../generated/services/NewTripsView_CEM_unfilteredService';
import { LiveDMSView_CEMService } from '../generated/services/LiveDMSView_CEMService';
// import { LiveVehicleAssignmentLIstViewService } from '../generated/services/LiveVehicleAssignmentLIstViewService';
// import { LiveDriverDispatchedList_AllService } from '../generated/services/LiveDriverDispatchedList_AllService';
// import { GenerateNewTripTicketService } from '../generated/services/GenerateNewTripTicketService';
// import { GenerateAdditionalOE_IDService } from '../generated/services/GenerateAdditionalOE_IDService';
// import { Vw_FCT_RouteNodeListService } from '../generated/services/Vw_FCT_RouteNodeListService';

import { 
  NEW_TRIPS_UNFILTERED_TABLE_CONFIG, 
  LIVE_DMS_ASSIGNED_TABLE_CONFIG, 
  TRIP_GROUPS,
  // FETCH_LOADING_KEYS,
  // cementTypeOptions,
  // frStatuses,
} from '../truth.config';

//COMPONENTS
import TableView, { type ColumnConfig, type TableViewRef, type DragDropSignalData } from '../components/ewul_TableFlex';
import DateRangePicker from '../components/ewul_DateRangePicker';
import AutoDismissBanner from '../components/ewul_Banner';
// import OrderDistributionForm, { type OrderDistributionFormRef, type FormUserInfo } from '../components/OrderDistributionForm';
// import Modal from '../components/ewul_Modal';

import './css/OrderDistribution.css';
import './css/OrderManagement.css';

type ViewMode = 'NEW' | 'ASSIGNED' | '1A' | '1B';

interface OrdersModuleProps {
  mode: ViewMode;
  newOrders: any[];
  assignedOrders: any[];
  isLoadingNew: boolean;
  isLoadingAssigned: boolean;
  fetchNewOrders: () => Promise<void>;
  fetchAssignedOrders: () => Promise<void>;
  assignedTableRef: React.RefObject<any>;
  onAccordionChange?: (isAnyCollapsed: boolean) => void;
  assignedTableConfig: ColumnConfig[];
  newTripsTableConfig: ColumnConfig[];
  onRowSelect: (record: any) => void;
  handleRowDragDrop: (signal: any) => void;
  isArrangementMode: boolean;
  onArrangementModeChange: (data: any) => void;
}

const OrdersModule: React.FC<OrdersModuleProps> = ({ 
  mode,
  newOrders,
  assignedOrders,
  isLoadingNew,
  isLoadingAssigned,
  fetchNewOrders,
  fetchAssignedOrders,
  assignedTableRef,
  onAccordionChange,
  assignedTableConfig,
  newTripsTableConfig,
  onRowSelect,
  handleRowDragDrop,
  isArrangementMode,
  onArrangementModeChange,
}) => {
  const { user } = useUser();

  const handleRowClick = (record: any) => {
    onRowSelect(record);
    console.log(record.OE || record.ID);
  };
  

  

  return (
    <div className="ordr-dist-orders-slider-viewport">
      <div className={`ordr-dist-orders-slider-track state-${mode.toLowerCase()}`}>
        
        {/* NEW ORDERS PANEL */}
        <div className="ordr-dist-dashboard-table-frame">
          <TableView
            data={newOrders}
            config={newTripsTableConfig}
            storageKey={`ordr_dist_new_grid_${user?.id || 'guest'}`}
            searchCol={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.searchable_cols as string[]}
            isLoading={isLoadingNew}
            showRowCount={20}
            onRefresh={fetchNewOrders}
            overflowY={true}
            colMinWidth={100}
            onRowClick={handleRowClick}
            highlightSelected={true}
            theme="var(--color-primary)"
            showNumbering={true}
            loadingNoPreventAction={true}
            accordion={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.accordion}
          />
        </div>

        {/* ASSIGNED ORDERS PANEL */}
        <div className="ordr-dist-dashboard-table-frame">
          <TableView
            ref={assignedTableRef}
            data={assignedOrders}
            rowKey='ID'
            config={assignedTableConfig}
            storageKey={`ordr_dist_assigned_grid_${user?.id || 'guest'}`}
            searchCol={LIVE_DMS_ASSIGNED_TABLE_CONFIG.searchable_cols as string[]}
            isLoading={isLoadingAssigned}
            showRowCount={50}
            onRefresh={fetchAssignedOrders}
            overflowY={true}
            overflowX={true}
            colMinWidth={100}
            onRowClick={handleRowClick}
            highlightSelected={true}
            theme="var(--color-primary)"
            showNumbering={true}
            loadingNoPreventAction={true}
            accordion={LIVE_DMS_ASSIGNED_TABLE_CONFIG.accordion}
            onAccordionChange={onAccordionChange}
            onDragDrop={handleRowDragDrop}
            isArrangementMode={isArrangementMode} // Binds the parent state
            onArrangementModeChange={onArrangementModeChange}
          />
        </div>

        <div className="ordr-dist-dashboard-table-frame">
          1A
        </div>

        <div className="ordr-dist-dashboard-table-frame">
          1B
        </div>

      </div>
    </div>
  );
};

const OrderDistribution: React.FC = () => {
  // const { user } = useUser();
  const [activeMode, setActiveMode] = useState<ViewMode>('ASSIGNED');
  const [selectedRangeNewOrders, setSelectedRangeNewOrders] = useState<{from: string, to: string} | null>(null);

  const assignedTableRef = useRef<TableViewRef>(null);
  // const formRef = useRef<OrderDistributionFormRef>(null);

  // Lifted States & Sidebar Management
  // const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  // const currentOrderData = selectedOrder || { OE: '', LS: 0 };

  const modeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null); // 1. Add a container ref
  const [modeSliderStyles, setModeSliderStyles] = useState<React.CSSProperties>({ left: 0, width: 0 });

  useEffect(() => {
    const modes: ViewMode[] = ['NEW', 'ASSIGNED', '1A', '1B'];
    
    const updateSlider = () => {
      const activeIndex = modes.indexOf(activeMode);
      const activeTarget = modeButtonRefs.current[activeIndex];

      if (activeTarget) {
        setModeSliderStyles({
          left: `${activeTarget.offsetLeft}px`,
          width: `${activeTarget.offsetWidth}px`,
        });
      }
    };

    // Run immediately on mount/mode changes
    updateSlider();

    // 2. Watch for parent layout changes to handle dynamic flex rendering perfectly
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => {
      updateSlider(); // Recalculates if fonts load, window resizes, or flex snaps into place
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, [activeMode]);


  
  const [isArranging, setIsArranging] = useState<boolean>(false);
  const [assignedOrdersBackup, setAssignedOrdersBackup] = useState<any[]>([]);
  const handleStartArranging = () => {
    // Take a snapshot of the current state before modifications happen
    setAssignedOrdersBackup([...assignedOrders]);
    setIsArranging(true);
  };

  const handleConfirmArrangement = () => {
    // Commit changes (you can trigger an API save sequence here if needed)
    setIsArranging(false);
    setAssignedOrdersBackup([]); 
  };

  const handleCancelArrangement = () => {
    // Roll back the table data to your original snapshot
    setAssignedOrders(assignedOrdersBackup);
    setIsArranging(false);
    // setAssignedOrdersBackup([]);
  };

  // Continuous execution for pen icon animation
  const penIconRef = useRef<{ startAnimation: () => Promise<void>; stopAnimation: () => void }>(null);
  useEffect(() => {
    let isMounted = true;

    const runRepeatedAnimation = async () => {
      // Keep looping as long as arrangement mode is enabled
      while (isArranging && isMounted) {
        if (penIconRef.current?.startAnimation) {
          // Wait for the complete 1.55s timeline to run completely
          await penIconRef.current.startAnimation();
          // Add a tiny padding delay before triggering the next cycle if desired
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          // Break instantly if reference is unavailable to prevent lock loops
          break;
        }
      }
    };

    if (isArranging) {
      runRepeatedAnimation();
    } else {
      // Immediately stop and snap the pen back to baseline if turned off
      penIconRef.current?.stopAnimation();
    }

    return () => {
      isMounted = false;
    };
  }, [isArranging]);



  // LIFTED ARCHITECTURE: State tracking for both tables is managed here
  const [newOrders, setNewOrders] = useState<any[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);
  
  const [isLoadingNew, setIsLoadingNew] = useState<boolean>(false);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState<boolean>(false);

  const [activeGroup, setActiveGroup] = useState<typeof TRIP_GROUPS[number]['id'] | 'ALL'>('ALL');
  const [sliderStyles, setSliderStyles] = useState<React.CSSProperties>({ left: 0, width: 0 });
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const groupContainerRef = useRef<HTMLDivElement | null>(null); // 1. Added container ref

  // Re-calculate the position whenever active selection changes or layout mounts
  useEffect(() => {
    const updateGroupSlider = () => {
      // Find the correct index based on the option state
      const activeIndex = activeGroup === 'ALL' 
        ? 0 
        : TRIP_GROUPS.findIndex(group => group.id === activeGroup) + 1; // +1 to offset the 'All' button
        
      const activeTarget = buttonRefs.current[activeIndex];

      if (activeTarget) {
        setSliderStyles({
          left: `${activeTarget.offsetLeft}px`,
          width: `${activeTarget.offsetWidth}px`,
        });
      }
    };

    // Run calculation immediately on state updates
    updateGroupSlider();

    // Watch for mount layout updates and parent dimension adjustments
    if (!groupContainerRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => {
      updateGroupSlider();
    });
    
    resizeObserver.observe(groupContainerRef.current);
    
    return () => resizeObserver.disconnect();
  }, [activeGroup, TRIP_GROUPS]); // TRIP_GROUPS included in deps in case it loads asynchronously

  const [assignedTableConfig, setAssignedTableConfig] = useState<ColumnConfig[]>(
    LIVE_DMS_ASSIGNED_TABLE_CONFIG.table_config as ColumnConfig[]
  );

  const [newTripsTableConfig, setNewTripsTableConfig] = useState<ColumnConfig[]>(
    NEW_TRIPS_UNFILTERED_TABLE_CONFIG.table_config as ColumnConfig[]
  );

  useEffect(() => {
    // 1. Process the string once for both configurations
    let formattedGroup: string[] = [];
    
    if (activeGroup !== 'ALL') {
      const processedString = (activeGroup.charAt(0).toUpperCase() + activeGroup.slice(1).toLowerCase()).replace("_", " - ");
      console.log("processed string: ", processedString);
      formattedGroup = [processedString];
    }

    // 2. Update Assigned Table Configuration
    setAssignedTableConfig((prevConfig) =>
      prevConfig.map((colConfig) => {
        if (colConfig.col === "_tripGroup") {
          return {
            ...colConfig,
            filter: {
              ...colConfig.filter,
              default: formattedGroup,
            },
          } as ColumnConfig;
        }
        return colConfig;
      })
    );

    // 3. Update New Trips Table Configuration
    setNewTripsTableConfig((prevConfig) =>
      prevConfig.map((colConfig) => {
        if (colConfig.col === "_tripGroup") {
          return {
            ...colConfig,
            filter: {
              ...colConfig.filter,
              default: formattedGroup,
            },
          } as ColumnConfig;
        }
        return colConfig;
      })
    );
  }, [activeGroup]);




  // DATA SOURCE 1: Fetching Unassigned Requests
  const fetchNewOrders = useCallback(async () => {
    if (!selectedRangeNewOrders?.from || !selectedRangeNewOrders?.to) return;
    setIsLoadingNew(true);
    try {
      const fromInt = ISOtoInt(selectedRangeNewOrders.from);
      const toInt = ISOtoInt(selectedRangeNewOrders.to);
      const options = {
        filter: `OEDateAsInt ge ${fromInt} and OEDateAsInt le ${toInt}`,
        orderBy: ["OEDateAsInt desc"]
      };
      const result = await ewulFetchAll<any>(NewTripsView_CEM_unfilteredService, options, 2000);
      setNewOrders(result || []);
    } catch (err) {
      console.error(err);
      setNewOrders([]);
    } finally {
      setIsLoadingNew(false);
    }
  }, [selectedRangeNewOrders]);

  // DATA SOURCE 2: Fetching Fleet Assigned Logs
  const fetchAssignedOrders = useCallback(async () => {
    if (!selectedRangeNewOrders?.from || !selectedRangeNewOrders?.to) return;
    setIsLoadingAssigned(true);
    try {
      const fromInt = ISOtoInt(selectedRangeNewOrders.from);
      const toInt = ISOtoInt(selectedRangeNewOrders.to);
      const dateFilter = 
        `
          OEDateAsInt ge ${fromInt} and 
          OEDateAsInt le ${toInt} and 
          (
            TripProgress eq 'Assigned' or 
            TripProgress eq 'Dispatched To Source' or 
            TripProgress eq 'Dispatched To Destination'
          ) and 
          (
            _tripGroup ne 'Preload' and _tripGroup ne 'Mobilization'
          )
        `;
      const result = await ewulFetchAll<any>(LiveDMSView_CEMService, { filter: dateFilter, orderBy: ["OEDateAsInt desc"] }, 10000, 'ID');
      setAssignedOrders(result || []);
    } catch (err) {
      console.error(err);
      setAssignedOrders([]);
    } finally {
      setIsLoadingAssigned(false);
    }
  }, [selectedRangeNewOrders]);



  // COMBINED CONTROLLER: Targets active runtime context grid
  const handleSync = useCallback(() => {
    if (activeMode === 'NEW') {
      fetchNewOrders();
    } else {
      fetchAssignedOrders();
    }
  }, [activeMode, fetchNewOrders, fetchAssignedOrders]);

  const { 
    cooldown, 
    bannerMessage, 
    executeProtectedAction: handleSyncWithCooldown 
  } = useAntiSpam(
    handleSync, // Wrap the main routing function that handles fetchNewOrders / fetchAssignedOrders
    () => isLoadingNew || isLoadingAssigned,
    { bannerDurationMs: 2000 }
  );

  useEffect(() => {
    if (selectedRangeNewOrders) {
      handleSync();
    }
  }, [selectedRangeNewOrders, activeMode, handleSync]);

  const handleDateChangeNewOrders = useCallback((range: {from: string, to: string}) => {
    setSelectedRangeNewOrders(prev => {
      if (prev?.from === range.from && prev?.to === range.to) return prev;
      return range;
    });
  }, []);



  const handleRowDragDrop = (signal: DragDropSignalData) => {
    console.log("Row Dragged n Dropped!: ", signal);
    
    const { group, newOrder, record } = signal;
    const lsCol = "Loading_x0020_Sequence"; // Adjust if the internal column name matches Power Apps / OData styling (e.g., 'LOADING_x0020_SEQ')
    const groupByCol = LIVE_DMS_ASSIGNED_TABLE_CONFIG.accordion?.groupByCol;

    setAssignedOrders((prevOrders) => {
      // 1. Find the actual landing index of the dragged record within the new order array
      const draggedId = record.ItemInternalId || record.ID;
      const targetIndex = newOrder.findIndex(
        (row) => (row.ItemInternalId || row.ID) === draggedId
      );

      // Safety fallback: if we can't find it in the new order, don't mutate state
      if (targetIndex === -1) return prevOrders;

      // 2. Identify the immediate neighbors inside the rearranged group
      const rowAbove = newOrder[targetIndex - 1];
      const rowBelow = newOrder[targetIndex + 1];

      let newLS = 1.0;
      const lsAbove = rowAbove && rowAbove[lsCol] !== undefined ? parseFloat(rowAbove[lsCol]) : null;
      const lsBelow = rowBelow && rowBelow[lsCol] !== undefined ? parseFloat(rowBelow[lsCol]) : null;

      // 3. Floating point allocation logic
      if (lsAbove !== null && lsBelow !== null) {
        // Dropped between two existing rows
        newLS = (lsAbove + lsBelow) / 2;
      } else if (lsBelow !== null) {
        // Dropped at the absolute top of the group
        newLS = lsBelow - 1.0;
      } else if (lsAbove !== null) {
        // Dropped at the absolute bottom of the group
        newLS = lsAbove + 1.0;
      } else {
        // Only item in the group
        newLS = 1.0;
      }

      // 4. Update the dragged record's value inside the freshly sorted group array
      const updatedGroupOrders = newOrder.map((row, idx) => {
        if (idx === targetIndex) {
          return {
            ...row,
            [lsCol]: Number(newLS.toFixed(4)) // Clean up float precision
          };
        }
        return row;
      });

      // 5. If it's a flat table without groups, just return the updated order
      if (!group || !groupByCol) {
        return updatedGroupOrders;
      }

      // 6. Partition out the untouched groups
      const untouchedOrders = prevOrders.filter((row) => {
        const val = row[groupByCol];
        const currentGroup = val !== null && val !== undefined && val !== '' ? String(val) : 'Unassigned';
        return currentGroup !== group;
      });

      // 7. Merge the untouched rows with our newly sequenced group rows
      return [...untouchedOrders, ...updatedGroupOrders];
    });
  };



  const isSyncing = isLoadingNew || isLoadingAssigned;

  return (
    <PageTemplate
      title="Orders Distribution Center"
      contentPadding='0px'
      contentWidth='100%'
      contentHeight='100%'
      actions={
        <div className="ordr-dist-dashboard-actions-bar">
          <div ref={containerRef} className="ordr-dist-sliding-toggle-container">
            {/* Dynamic sliding highlight block */}
            <div 
              className="ordr-dist-slider-highlight" 
              style={modeSliderStyles}
            />
            
            <button 
              ref={(el) => { modeButtonRefs.current[0] = el; }}
              type="button"
              className={`ordr-dist-toggle-btn ${activeMode === 'NEW' ? 'active' : ''}`}
              onClick={() => setActiveMode('NEW')}
            >
              <span>New Orders</span>
            </button>
            
            <button 
              ref={(el) => { modeButtonRefs.current[1] = el; }}
              type="button"
              className={`ordr-dist-toggle-btn ${activeMode === 'ASSIGNED' ? 'active' : ''}`}
              onClick={() => setActiveMode('ASSIGNED')}
            >
              <span>Order Summary</span>
            </button>

            <button 
              ref={(el) => { modeButtonRefs.current[2] = el; }}
              type="button"
              className={`ordr-dist-toggle-btn ${activeMode === '1A' ? 'active' : ''}`}
              onClick={() => setActiveMode('1A')}
            >
              <span>1A</span>
            </button>

            <button 
              ref={(el) => { modeButtonRefs.current[3] = el; }}
              type="button"
              className={`ordr-dist-toggle-btn ${activeMode === '1B' ? 'active' : ''}`}
              onClick={() => setActiveMode('1B')}
            >
              <span>1B</span>
            </button>
          </div>



          <DateRangePicker 
            allowedTypes={['Monthly', 'Yearly', 'Custom']} 
            onFilterChange={handleDateChangeNewOrders} 
            opacity={1}
            bgColor='var(--color-primary)'
            hoverColor='var(--color-primary)'
          />
        </div>
      }
      className="ordr-dist-flush-dashboard-page"
      hideFooter={true}
    >

      <div className="order-management-page" style={{ height: '100%', position: 'relative' }}>

        <div className="ordr-dist-dashboard-workspace-bg" style={{ display: 'flex', height: '100%', width: '100%', position: 'relative', gap: '5px' }}>

        

          {/* MAIN TABLES CONTAINER */}
          <div className="ordr-dist-dashboard-gradient-wrapper ordr-dist-fullscreen-mode">
            <div className="ordr-dist-dashboard-floating-container">
              {/* EDIT HERE: Sync button is now packed side-by-side with the dynamic h3 heading */}
              <div className="ordr-dist-dashboard-panel-header">

                <div className="ordr-dist-heading-crossfade-wrapper">
                  <h3 className={`ordr-dist-fade-heading ${(activeMode === 'NEW' && !isArranging) ? 'visible' : ''}`}>
                    Plot New Orders
                  </h3>
                  <h3 className={`ordr-dist-fade-heading ${(activeMode === 'ASSIGNED' && !isArranging) ? 'visible' : ''}`}>
                    Waiting to be Dispatched
                  </h3>
                  <h3 className={`ordr-dist-fade-heading ${(activeMode === '1A' && !isArranging) ? 'visible' : ''}`}>
                    Trip Monitoring: 1A
                  </h3>
                  <h3 className={`ordr-dist-fade-heading ${(activeMode === '1B' && !isArranging) ? 'visible' : ''}`}>
                    Trip Monitoring: 1B
                  </h3>
                  <h3 
                    className={`ordr-dist-fade-heading ${isArranging ? 'visible' : ''}`} 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    Editing Loading Sequence
                    <PenIcon 
                      ref={penIconRef} 
                      size={25} 
                      color="var(--color-primary, `#000080`)" 
                      className="sequence-edit-pen"
                    />
                  </h3>
                </div>


                <div ref={groupContainerRef} className="ordr-dist-group-toggle-container">
                  {/* Sliding highlight box */}
                  <div 
                    className="ordr-dist-group-slider-highlight"
                    style={sliderStyles}
                  />
                  
                  {/* HARDCODED 'ALL' BUTTON AT INDEX 0 */}
                  <button
                    ref={(el) => { buttonRefs.current[0] = el; }}
                    type="button"
                    className={`ordr-dist-group-toggle-btn ${activeGroup === 'ALL' ? 'active' : ''}`}
                    onClick={() => setActiveGroup('ALL')}
                  >
                    {/* Clean gradient circle for 'All' grouping */}
                    <span 
                      className="ordr-dist-group-dot" 
                      style={{ 
                        background: 'linear-gradient(135deg, var(--color-primary, #092162) 0%, var(--color-accent, #ff0000) 100%)',
                        boxShadow: activeGroup === 'ALL' ? '0 0 4px rgba(255,255,255,0.6)' : 'none'
                      }} 
                    />
                    All
                  </button>

                  {/* EXISTING MAPPED GROUPS (Indexed at i + 1) */}
                  {TRIP_GROUPS.map((group, index) => {
                    const isActive = activeGroup === group.id;
                    const refIndex = index + 1; // Shifted by 1 to make space for 'All'
                    
                    return (
                      <button
                        key={group.id}
                        ref={(el) => { buttonRefs.current[refIndex] = el; }}
                        type="button"
                        className={`ordr-dist-group-toggle-btn ${isActive ? 'active' : ''}`}
                        onClick={() => setActiveGroup(group.id)}
                      >
                        <span 
                          className="ordr-dist-group-dot" 
                          style={{ 
                            backgroundColor: group.color,
                            boxShadow: isActive ? '0 0 4px rgba(255,255,255,0.6)' : 'none'
                          }} 
                        />
                        {group.label}
                      </button>
                    );
                  })}
                </div>

                {/* SINGLE ICON ACCORDION TOGGLE */}
                {/* {activeMode === 'ASSIGNED' && assignedOrders.length > 0 && (
                  <button 
                    className="ordr-dist-dashboard-action-btn ordr-dist-secondary-outline"
                    onClick={handleAccordionToggle}
                    title={isAnyCollapsed ? "Expand All" : "Collapse All"}
                    style={{ 
                      padding: '6px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginRight: 'auto', 
                      marginLeft: '16px' 
                    }}
                  >
                    {!isAnyCollapsed ? (
                      <ChevronsDownUp size={16} className="animate-pop-in" />
                    ) : (
                      <ChevronsUpDown size={16} className="animate-pop-in" />
                    )}
                  </button>
                )} */}
                
                {/** RIGHT BUTTONS */}
                <div style={{gap: '8px', display: 'flex', flexDirection: 'row', alignItems: 'center'}}>

                    {isArranging ? (
                      <>
                        {/* CANCEL BUTTON */}
                        <button 
                          onClick={handleCancelArrangement}
                          className="ordr-dist-dashboard-action-btn btn-sequence-cancel"
                        >
                          <X size={16} strokeWidth={2.5} />
                          Cancel
                        </button>

                        {/* CONFIRM BUTTON */}
                        <button 
                          onClick={handleConfirmArrangement}
                          className="ordr-dist-dashboard-action-btn btn-sequence-confirm"
                        >
                          <Check size={16} strokeWidth={2.5} />
                          Confirm Sequence
                        </button>
                      </>
                    ) : (
                      /* ENTER EDIT MODE BUTTON */
                      <button 
                        onClick={handleStartArranging}
                        className="ordr-dist-dashboard-action-btn btn-sequence-edit"
                      >
                        <Pencil size={16} strokeWidth={2} />
                        Edit Sequence
                      </button>
                    )}


                  <button 
                    className="ordr-dist-dashboard-action-btn ordr-dist-primary-solid" 
                    onClick={handleSyncWithCooldown}
                    // disabled={cooldown > 0 || isSyncing || !selectedRangeNewOrders} // UPDATE: Explicitly checks cooldown > 0
                  >
                    <RefreshCcw size={15} className={isSyncing ? 'ordr-dist-spinning' : ''} /> 
                    <span>{cooldown > 0 || isSyncing ? `Wait ${cooldown}s...` : `Sync View`}</span>
                  </button>
                </div>

              </div>

              {/* EDIT HERE: Pass all lifted props directly into OrdersModule */}
              <div className="ordr-dist-dashboard-panel-content">
                <OrdersModule 
                  mode={activeMode}
                  newOrders={newOrders}
                  assignedOrders={assignedOrders}
                  isLoadingNew={isLoadingNew}
                  isLoadingAssigned={isLoadingAssigned}
                  fetchNewOrders={fetchNewOrders}
                  fetchAssignedOrders={fetchAssignedOrders}
                  assignedTableRef={assignedTableRef}
                  // onAccordionChange={setIsAnyCollapsed}
                  assignedTableConfig={assignedTableConfig}
                  newTripsTableConfig={newTripsTableConfig}
                  onRowSelect={() => null}
                  handleRowDragDrop={handleRowDragDrop}
                  isArrangementMode={isArranging}
                  onArrangementModeChange={setIsArranging}
                />
                {bannerMessage &&             
                <AutoDismissBanner 
                  message={bannerMessage} 
                  onClose={() => null} 
                />}
              </div>

            </div>
          </div>
        </div>

        {/* Fullscreen Form Modal Support */}
        {/* {isFormMaximized && (
            <Modal onClose={() => setIsFormMaximized(false)}>
                <div className="modal-header-fullscreen">
                    <h2>Order Distribution: {currentOrderData.OE}</h2>
                </div>
                <div className="modal-body-fullscreen" style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
                    {renderOrderForm(true)}
                </div>
            </Modal>
        )} */}


      </div>
    </PageTemplate>
  );
};

export default OrderDistribution;