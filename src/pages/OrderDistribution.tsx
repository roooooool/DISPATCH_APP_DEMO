import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PageTemplate from './template';
import { 
  RefreshCcw, 
  Pencil, Check,
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

type ViewMode = 'NEW' | 'ASSIGNED';

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

      </div>
    </div>
  );
};

const OrderDistribution: React.FC = () => {
  const { user } = useUser();
  const [activeMode, setActiveMode] = useState<ViewMode>('ASSIGNED');
  const [selectedRangeNewOrders, setSelectedRangeNewOrders] = useState<{from: string, to: string} | null>(null);

  const assignedTableRef = useRef<TableViewRef>(null);
  // const formRef = useRef<OrderDistributionFormRef>(null);

  // Lifted States & Sidebar Management
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const currentOrderData = selectedOrder || { OE: '', LS: 0 };
  // const [sidebarVisible, setSidebarVisible] = useState(false);
  // const [sidebarWidth, setSidebarWidth] = useState(33.33);
  // const isResizing = useRef(false);
  // const sidebarRef = useRef<HTMLDivElement>(null);
  // const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  // const [isFormMaximized, setIsFormMaximized] = useState(false);

  // Options & Aux States required by OrderDistributionForm
  // const [livetruckassignment, setLiveTruckAssignment] = useState<any[]>([]);
  // const [truckOptions, setTruckOptions] = useState<any[]>([]);
  // const [trailerOptions, setTrailerOptions] = useState<any[]>([]);
  // const [sourceOptions, setSourceOptions] = useState<any[]>([]);
  // const [destinationOptions, setDestinationOptions] = useState<any[]>([]);
  // const [stationOptions, setStationOptions] = useState<any[]>([]);
  // const [driverHelperList, setDriverHelperList] = useState<any[]>([]);
  // const [fuelRequests, setFuelRequests] = useState<any[]>([]);
  // const [previewTripTicketID, setPreviewTripTicketID] = useState<any>(null);


  const [isArranging, setIsArranging] = useState<boolean>(false);

  // useEffect(() => {
  //   const handleResize = () => setIsMobile(window.innerWidth <= 1024);
  //   window.addEventListener('resize', handleResize);
  //   return () => window.removeEventListener('resize', handleResize);
  // }, []);

  // LIFTED ARCHITECTURE: State tracking for both tables is managed here
  const [newOrders, setNewOrders] = useState<any[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);
  
  const [isLoadingNew, setIsLoadingNew] = useState<boolean>(false);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState<boolean>(false);

  const [activeGroup, setActiveGroup] = useState<typeof TRIP_GROUPS[number]['id'] | 'ALL'>('ALL');
  const [sliderStyles, setSliderStyles] = useState<React.CSSProperties>({ left: 0, width: 0 });
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Re-calculate the position whenever the active selection changes
  useEffect(() => {
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
  }, [activeGroup]);

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


  // const [isAnyCollapsed, setIsAnyCollapsed] = useState(false);
  // const handleAccordionToggle = () => {
  //   if (!assignedTableRef.current) return;
    
  //   if (isAnyCollapsed) {
  //     assignedTableRef.current.expandAll();
  //   } else {
  //     assignedTableRef.current.collapseAll();
  //   }
  // };

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
      const dateFilter = `OEDateAsInt ge ${fromInt} and OEDateAsInt le ${toInt} and TripProgress eq 'Assigned'`;
      const result = await ewulFetchAll<any>(LiveDMSView_CEMService, { filter: dateFilter, orderBy: ["OEDateAsInt desc"] }, 10000, 'ID');
      setAssignedOrders(result || []);
    } catch (err) {
      console.error(err);
      setAssignedOrders([]);
    } finally {
      setIsLoadingAssigned(false);
    }
  }, [selectedRangeNewOrders]);


  //FETCH 2
  // const fetchTruckList = useCallback(async () => {
  //   try {
  //     const result = await ewulFetchAll<any>(LiveVehicleAssignmentLIstViewService, { filter: `Assignment eq 'VASQUEZ' or Assignment eq 'INTERCITY'` }, 3000) || [];
  //     setLiveTruckAssignment(result);
  //   } catch (err) {
  //     console.error(err);
  //   }
  // }, []);

  // const fetchDriverHelperList = useCallback(async () => {
  //   try {
  //     const result = await ewulFetchAll<any>(LiveDriverDispatchedList_AllService, { filter: `contains(Deploystatus, 'Deployed')` }, 3000, 'Id');
  //     setDriverHelperList(result || []);
  //   } catch (err) {
  //     console.error(err);
  //   }
  // }, []);

  // const generateTripTicketID = async (OE?: string) => {
  //   try {
  //     const res = await GenerateNewTripTicketService.GenerateNewTripTicket({ OE } as any);
  //     const table1 = res.data?.ResultSets?.Table1 as any[] | undefined;
  //     if (table1 && table1.length > 0) setPreviewTripTicketID(table1[0].TripTicketID + ' (Preview)');
  //   } catch (error) {
  //     console.error(error);
  //   }
  // };

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

  // // Action handler for generating Preload or Mobilization context
  // const handleAdditionalOEGeneration = async (type: 'Preload' | 'Mobilization') => {
  //   try {
  //     // 1. Generate the extra OE logic via your imported Service
  //     const response = await GenerateAdditionalOE_IDService.GenerateAdditionalOE_ID({
  //       Type: type,
  //       User: localUser.FullName
  //     } as any);

  //     const generatedData = (response.data?.ResultSets?.Table1 as any[])[0];
      
  //     if (generatedData) {
  //       // 2. Map the generated structural shell to the selection state
  //       setSelectedOrder({
  //         OE: generatedData.OE_ID || '',
  //         LS: 0,
  //         TripProgress: 'Unassigned',
  //         _tripGroup: type.toUpperCase(),
  //         QTYDelivered_Actual: 0,
  //         QTYWithdrawn_Actual: 0,
  //         // Spread default values needed by OrderDistributionForm
  //       });
        
  //       // 3. Open the sidebar so the user can immediately edit the newly generated item
  //       setSidebarVisible(true);
  //     }
  //   } catch (error) {
  //     console.error(`Failed to execute additional OE generation for ${type}:`, error);
  //   }
  // };

  // const handleRowClick = async (record: any) => {
  //   const canProceed = await formRef.current?.showUnsavedChangesModal();
  //   if (canProceed === false) return;

  //   setSelectedOrder({
  //     ...record,
  //     QTYDelivered_Actual: record.QTYDelivered_Actual ?? 0,
  //     QTYWithdrawn_Actual: record.QTYWithdrawn_Actual ?? 0,
  //   });
  //   // setSidebarVisible(true);
  // };

  // const localUser: FormUserInfo = useMemo(() => {
  //   return {
  //     id: user?.id,
  //     FullName: user?.FullName,
  //     BusinessUnit: user?.BusinessUnit,
  //     Position: user?.Position
  //   } as FormUserInfo;
  // }, [user?.id, user?.FullName, user?.BusinessUnit, user?.Position]);
  // console.log(localUser);

  // const renderOrderForm = (isMaximized: boolean) => (
  //   <OrderDistributionForm
  //     ref={formRef}
  //     orderId={currentOrderData.OE}
  //     initialData={currentOrderData}
  //     onClose={() => {
  //       if (isMaximized) {
  //         setIsFormMaximized(false);
  //       } else {
  //         setSidebarVisible(false);
  //         setSelectedOrder(null);
  //       }
  //     }}
  //     allTrips={activeMode === 'ASSIGNED' ? assignedOrders : newOrders}
  //     onFormDataChange={(formData) => {
  //       if (formData.OE) setSelectedOrder(formData);
  //     }}
  //     onClearSelectedTrip={() => setSelectedOrder(null)}
  //     onProceed={(updatedTrip, deselect) => {
  //       if (deselect) setSelectedOrder(null);
  //       else setSelectedOrder(updatedTrip);
  //       handleSync();
  //     }}
  //     onCancelTrip={() => {
  //       setSelectedOrder(null);
  //       setSidebarVisible(false);
  //     }}
  //     onRefreshTrips={handleSync}
  //     onRefreshDriverHelpers={fetchDriverHelperList}
  //     onUpdateDriverHelperAttendance={(name, attendance, position) => {
  //       setDriverHelperList(prev => prev.map(item => item.FullName === name && item.Position === position ? { ...item, DMS_Attendance: attendance } : item));
  //     }}
  //     onUpdateTruckTrailers={() => {}}
  //     onShowFuelRequest={() => {}}
  //     onRequestChangeTrip={() => {}}
  //     truckOptions={truckOptions}
  //     trailerOptions={trailerOptions}
  //     driverOptions={[]}
  //     helperOptions={[]}
  //     sourceOptions={sourceOptions}
  //     lsList={[]}
  //     driverHelperList={driverHelperList}
  //     editingUser={localUser}
  //     canChangeTrip={true}
  //     fuelFetching={false}
  //   />
  // );


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
      actions={
        <div className="ordr-dist-dashboard-actions-bar">
          <div className="ordr-dist-sliding-toggle-container">
            {/* The sliding highlight background block */}
            <div 
              className={`ordr-dist-slider-highlight ${
                activeMode === 'NEW' ? 'slide-left' : 'slide-right'
              }`} 
            />
            
            <button 
              type="button"
              className={`ordr-dist-toggle-btn ${activeMode === 'NEW' ? 'active' : ''}`}
              onClick={() => setActiveMode('NEW')}
            >
              <span>New Orders</span>
            </button>
            
            <button 
              type="button"
              className={`ordr-dist-toggle-btn ${activeMode === 'ASSIGNED' ? 'active' : ''}`}
              onClick={() => setActiveMode('ASSIGNED')}
            >
              <span>Assigned Orders</span>
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

        {/* Sidebar Toggle Tab */}
        {/* <div 
          title='Open DMS Form/Dashboard'
          className={`ordr-dist-sidebar-toggle-tab ${sidebarVisible ? 'ordr-dist-hidden' : ''}`}
          onClick={() => setSidebarVisible(true)}
        >
          <Menu size={24} />
        </div> */}


          {/* MANAGEMENT SIDEBAR PANEL */}
          {/* <div
            ref={sidebarRef}
            className={`management-sidebar animate-sidebar${sidebarVisible ? ' sidebar-in' : ' sidebar-out'}`}
            style={{
              flex: sidebarVisible ? `0 0 ${isMobile ? 100 : sidebarWidth}%` : '0 0 0%',
              minWidth: sidebarVisible ? (isMobile ? '100%' : 200) : 0,
              maxWidth: sidebarVisible ? (isMobile ? '100%' : '60%') : 0,
              pointerEvents: sidebarVisible ? 'auto' : 'none',
              opacity: sidebarVisible ? 1 : 0,
              transition: 'all 0.35s cubic-bezier(.4,2,.6,1), opacity 0.25s',
              zIndex: 2,
              display: !sidebarVisible && isMobile ? 'none' : 'flex'
            }}
            aria-hidden={!sidebarVisible}
          >
            <div className="utility-floating-actions">
              <div className="utility-maximize show-icon">
                <button className="maximize-btn" onClick={() => setIsFormMaximized(true)}>
                  <Maximize2 size={16} />
                </button>
              </div>
              <div className="utility-close">
                <button className="close-btn" onClick={() => setSidebarVisible(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="utility-content animate-fade-in">
              <div className="order-form-compact">
                {renderOrderForm(false)} 
              </div>
            </div>
          </div> */}

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
                  <h3 className={`ordr-dist-fade-heading ${isArranging ? 'visible' : ''}`}>
                    Editing Loading Sequence
                  </h3>
                </div>


                <div className="ordr-dist-group-toggle-container">
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
                <div style={{gap: '5px', display: 'flex', flexDirection: 'row'}}>
                  <button 
                    onClick={() => setIsArranging(!isArranging)}
                    className='ordr-dist-dashboard-action-btn ordr-dist-primary-solid'
                  >
                    {isArranging ? (
                      <>
                        <Check size={16} strokeWidth={2.5} />
                        Confirm Sequence
                      </>
                    ) : (
                      <>
                        <Pencil size={16} strokeWidth={2} />
                        Edit Sequence
                      </>
                    )}
                  </button>

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