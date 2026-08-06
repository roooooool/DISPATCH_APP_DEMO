import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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

  // ewul_canFetch as canFetch,
  ewul_setLoadingFor as setLoadingFor,

} from '../utils/Ewul_GSDC_Utils';

//itshover icons
import PenIcon from '@ui/pen-icon';


//POWER APPS SERVICES
import { NewTripsView_CEM_unfilteredService } from '../generated/services/NewTripsView_CEM_unfilteredService';
import { LiveDMSView_CEMService } from '../generated/services/LiveDMSView_CEMService';
import { type LiveDMSView_CEM } from '../generated/models/LiveDMSView_CEMModel'
// import { LiveVehicleAssignmentLIstViewService } from '../generated/services/LiveVehicleAssignmentLIstViewService';
// import { LiveDriverDispatchedList_AllService } from '../generated/services/LiveDriverDispatchedList_AllService';
import { GenerateNewTripTicketService } from '../generated/services/GenerateNewTripTicketService';
import { GenerateAdditionalOE_ID2Service } from '../generated/services/GenerateAdditionalOE_ID2Service';
import { Vw_FCT_RouteNodeListService } from '../generated/services/Vw_FCT_RouteNodeListService';

import {
  NEW_TRIPS_UNFILTERED_TABLE_CONFIG,
  LIVE_DMS_ASSIGNED_TABLE_CONFIG,
  TRIP_GROUPS,
  LIVE_DMS_TABLE_CONFIG,
  FETCH_LOADING_KEYS,
  cementTypeOptions,
  // frStatuses,
  TRIP_PROGRESS,
} from '../truth.config';

const BUSINESS_UNITS = ['SBUO-1A', 'SBUO-1B'];

//COMPONENTS
import TableView, { type ColumnConfig, type TableViewRef, type DragDropSignalData, encodeColumnName as enc } from '../components/ewul_TableFlex';
import DateRangePicker from '../components/ewul_DateRangePicker';
import AutoDismissBanner from '../components/ewul_Banner';
import OrderAssignmentDashboard from '../components/OrderAssignmentDashboard';
// import OrderDistributionForm, { type OrderDistributionFormRef, type FormUserInfo } from '../components/OrderDistributionForm';
import Modal from '../components/ewul_Modal';
import type { DropdownOption } from '@components/SearchableDropdown';

import './css/OrderDistribution.css';
import './css/OrderManagement.css';


interface BulkTaskRow {
  id: string;
  type: 'Preload' | 'Mobilization';
  oe: string;
  businessUnit?: string; // Appended configuration tracker
  source: string;
  cementType: string;
  isLoadingOE: boolean;
}

// The unified shape your OrderAssignmentDashboard expects
interface NormalizedOrder {
  BU: string;
  OE: string;
  SAPStatus: string;
  SourceName: string;
  DestiName: string;
  rawData: LiveDMSView_CEM;
  additionalDetails: {
    field: string;
    label: string;
  }[];
}

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
  liveDmsTableConfig: ColumnConfig[];
  onRowSelect: (record: any) => void;
  handleRowDragDrop: (signal: any) => void;
  isArrangementMode: boolean;
  onArrangementModeChange: (data: any) => void;
  onOptimisticUpdate: (result: {
    success: boolean;
    added: any[];
    updated: any[];
    removed: string[];
  }) => void;
  onRefreshTripsAssigned: () => void;
}

const OrdersModule: React.FC<OrdersModuleProps> = ({
  mode,
  newOrders,
  assignedOrders,
  isLoadingNew,
  isLoadingAssigned,
  // @ts-ignore 
  fetchNewOrders,
  fetchAssignedOrders,
  assignedTableRef,
  onAccordionChange,
  assignedTableConfig,
  newTripsTableConfig,
  liveDmsTableConfig,
  onRowSelect,
  handleRowDragDrop,
  isArrangementMode,
  onArrangementModeChange,
  onOptimisticUpdate,
  onRefreshTripsAssigned
}) => {
  const { user } = useUser();

  const handleRowClick = (record: any) => {
    onRowSelect(record);
    console.log(record.OE || record.ID);
  };

  const tripDisplayConfig = {
    buField: 'BU',
    titleField: 'OE',
    statusField: 'SAPStatus',
    routeStartField: 'SourceName',
    routeEndField: 'DestiName',
    rawData: {},
    additionalDetails: [
      { field: 'Driver', label: 'Driver' },
      { field: 'Helper', label: 'Helper' },
      { field: 'Head_Full', label: 'Truck' },
      { field: 'BO_Full', label: 'Trailer' },
    ]
  };

  const formattedAssignedOrders = useMemo(() => {
    if (!assignedOrders) return [];

    return assignedOrders.map((trip: LiveDMSView_CEM): NormalizedOrder => ({
      BU: trip.Buisness_x0020_Unit || '',
      OE: trip.OE || '',
      SAPStatus: trip.TripProgress || '',
      SourceName: trip.Source || '',
      DestiName: trip.Destination || '',
      rawData: trip,
      additionalDetails: [
        { field: 'Driver', label: 'Driver' },
        { field: 'Helper', label: 'Helper' },
        { field: 'Head_Full', label: 'Truck' },
        { field: 'BO_Full', label: 'Trailer' },
      ]
    }));
  }, [assignedOrders]);

  useEffect(() => {
    console.log("formattedAssignedOrders", formattedAssignedOrders[0]);
  }, [formattedAssignedOrders]);




  return (
    <div className="ordr-dist-orders-slider-viewport">
      <div className={`ordr-dist-orders-slider-track state-${mode.toLowerCase()}`}>

        {/* NEW ORDERS PANEL */}
        <div className="ordr-dist-dashboard-table-frame unique-dashboard-override">
          <OrderAssignmentDashboard
            newOrdersList={newOrders}
            newOrdersLoading={isLoadingNew}
            tripAssignedList={formattedAssignedOrders}
            tripAssignedLoading={isLoadingAssigned}
            businessUnits={BUSINESS_UNITS}
            displayMapping={tripDisplayConfig}
            onUpdateTripAssignedList={onOptimisticUpdate}
            onRefreshTrips={onRefreshTripsAssigned}
            newTripsTableConfig={newTripsTableConfig}
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
          <TableView
            data={assignedOrders.filter(order => order[enc("Buisness Unit")] === 'SBUO-1A' || order[enc("Buisness Unit")] === '1A')}
            rowKey='ID'
            config={liveDmsTableConfig}
            storageKey={`ordr_dist_1a_grid_${user?.id || 'guest'}`}
            searchCol={LIVE_DMS_TABLE_CONFIG.searchable_cols as string[]}
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
            isArrangementMode={isArrangementMode}
            onArrangementModeChange={onArrangementModeChange}
            emptyHint={{
              emptyMsg: "Looks like no orders assigned to 1A yet.",
              suggestActionMsg: "select new orders for this BU",
              onHintClick: () => {
                // Optional: Could add logic here to open date picker or reset filters
              }
            }}
          />
        </div>

        <div className="ordr-dist-dashboard-table-frame">
          <TableView
            data={assignedOrders.filter(order => order[enc("Buisness Unit")] === 'SBUO-1B' || order[enc("Buisness Unit")] === '1B')}
            rowKey='ID'
            config={liveDmsTableConfig}
            storageKey={`ordr_dist_1b_grid_${user?.id || 'guest'}`}
            searchCol={LIVE_DMS_TABLE_CONFIG.searchable_cols as string[]}
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
            isArrangementMode={isArrangementMode}
            onArrangementModeChange={onArrangementModeChange}
            emptyHint={{
              emptyMsg: "Looks like no orders assigned to 1B yet.",
              suggestActionMsg: "select new orders for this BU",
              onHintClick: () => {
                // Optional: Could add logic here to open date picker or reset filters
              }
            }}
          />
        </div>

      </div>
    </div>
  );
};

const OrderDistribution: React.FC = () => {
  // const { user } = useUser();
  const [activeMode, setActiveMode] = useState<ViewMode>('ASSIGNED');
  const [selectedRangeNewOrders, setSelectedRangeNewOrders] = useState<{ from: string, to: string } | null>(null);

  const [stationOptions, setStationOptions] = useState<DropdownOption[]>([]);
  const [sourceOptions, setSourceOptions] = useState<DropdownOption[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<DropdownOption[]>([]);

  // Safety fallback helper function if it doesn't already exist globally in your project
  const canFetch = (key: string, cooldownMs: number): boolean => {
    // You can customize this to check sessionStorage or custom local state timestamps if desired
    console.log(key, cooldownMs);
    return true;
  };


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

  // const [assignedTableConfig, setAssignedTableConfig] = useState<ColumnConfig[]>(
  //   LIVE_DMS_ASSIGNED_TABLE_CONFIG.table_config as ColumnConfig[]
  // );

  // const [newTripsTableConfig, setNewTripsTableConfig] = useState<ColumnConfig[]>(
  //   NEW_TRIPS_UNFILTERED_TABLE_CONFIG.table_config as ColumnConfig[]
  // );

  // const [liveDmsTableConfig, setLiveDmsTableConfig] = useState<ColumnConfig[]>(
  //   LIVE_DMS_TABLE_CONFIG.table_config as ColumnConfig[]
  // );

  const assignedTableConfig = useMemo(() => {
    let formattedGroup: string[] = [];
    if (activeGroup !== 'ALL') {
      const processedString = (activeGroup.charAt(0).toUpperCase() + activeGroup.slice(1).toLowerCase()).replace("_", " - ");
      formattedGroup = [processedString];
    }

    return (LIVE_DMS_ASSIGNED_TABLE_CONFIG.table_config as ColumnConfig[]).map((colConfig) => {
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
    });
  }, [activeGroup]);

  const newTripsTableConfig = useMemo(() => {
    let formattedGroup: string[] = [];
    if (activeGroup !== 'ALL') {
      const processedString = (activeGroup.charAt(0).toUpperCase() + activeGroup.slice(1).toLowerCase()).replace("_", " - ");
      formattedGroup = [processedString];
    }

    return (NEW_TRIPS_UNFILTERED_TABLE_CONFIG.table_config as ColumnConfig[]).map((colConfig) => {
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
    });
  }, [activeGroup]);

  const liveDmsTableConfig = useMemo(() => {
    let formattedGroup: string[] = [];
    if (activeGroup !== 'ALL') {
      const processedString = (activeGroup.charAt(0).toUpperCase() + activeGroup.slice(1).toLowerCase()).replace("_", " - ");
      formattedGroup = [processedString];
    }

    return (LIVE_DMS_TABLE_CONFIG.table_config as ColumnConfig[]).map((colConfig) => {
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
    });
  }, [activeGroup]);



  //MANUAL OE
  // Track active modal mode
  const [activeModalType, setActiveModalType] = useState<'Preload' | 'Mobilization' | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [bulkRows, setBulkRows] = useState<BulkTaskRow[]>([]);

  // Form Fields
  const [modalOE, setModalOE] = useState<string>('');
  const [modalSource, setModalSource] = useState<string>('');
  const [modalCementType, setModalCementType] = useState<string>('');
  const [modalBatch, setModalBatch] = useState<number>(1);

  // Helper to reset fields when modal closes
  const resetModalForm = () => {
    setActiveModalType(null);
    setModalOE('');
    setModalSource('');
    setModalCementType('');
    setModalBatch(1);
    setActiveModalType(null);
    setBulkRows([]);
    setModalBatch(1);
    setIsBulkModalOpen(false);
  };

  // @ts-ignore 
  const handleModalConfirm = (bulkRows: any[]) => {
    if (!modalOE || !modalSource) return;

    console.log("Submitting payload:", {
      actionType: activeModalType,
      OE: modalOE,
      Source: modalSource,
      Type: modalCementType,
      batch: modalBatch,
      bulkRows: bulkRows
    });

    // Run your native allocation tracking configurations
    handleAdditionalOEGeneration(activeModalType!);
    console.log(previewTrip);


    // Place your Power Apps sequence / service trigger logic here...

    resetModalForm();
  };

  const [previewTrip, setPreviewTrip] = useState<any>({});
  const [preview_preloadOE, setPreviewPreloadOE] = useState<any>({});
  const [preview_mobilizationOE, setPreviewMobilizationOE] = useState<any>({});
  const [previewTripTicketID, setPreviewTripTicketID] = useState<any>(null);
  const generateTripTicketID = async (OE?: string | undefined) => {
    setLoadingFor(FETCH_LOADING_KEYS.generatedTripID, true);

    try {
      const res = await GenerateNewTripTicketService.GenerateNewTripTicket({
        OE: OE,
      } as any);


      const table1 = res.data?.ResultSets?.Table1 as any[] | undefined;
      console.log("Response from GenerateNewTripTicketService:", res);
      if (table1 && table1.length > 0) {
        setPreviewTripTicketID(table1[0].TripTicketID + ' (Preview)' || null);
      } else {
        setPreviewTripTicketID(null);
      }


    } catch (error) {
      console.error("Error generating trip ticket ID:", error);
      setPreviewTripTicketID(null);
    } finally {
      setLoadingFor(FETCH_LOADING_KEYS.generatedTripID, false);
    }

  };

  const generateAdditionalOE = async (type: 'Preload' | 'Mobilization') => {
    //if (selectedOrder && ['Preload', 'Mobilization'].some(t => t === selectedOrder._tripGroup) ) return;


    setLoadingFor(FETCH_LOADING_KEYS.generateAddOE, true);

    try {
      const res = await GenerateAdditionalOE_ID2Service.GenerateAdditionalOE_ID2({
        Type: type,
      } as any);


      const table1 = res.data?.ResultSets?.Table1 as any[] | undefined;
      if (!table1 || table1.length === 0) {
        console.error("No data returned for new OE generation.");
        return;
      }

      if (type === 'Preload') setPreviewPreloadOE(table1[0].NewID);
      if (type === 'Mobilization') setPreviewMobilizationOE(table1[0].NewID);

    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoadingFor(FETCH_LOADING_KEYS.generateAddOE, false);
    }
  };

  const getAdditionalOEForType = (type: 'Preload' | 'Mobilization') => {
    if (type === 'Preload') return preview_preloadOE;
    if (type === 'Mobilization') return preview_mobilizationOE;
    return '';
  }

  const handleAdditionalOEGeneration = (type: 'Preload' | 'Mobilization') => {
    const record = {
      OE: getAdditionalOEForType(type),
      Source: "",
      Destination: "",
      cementType: "",
      [enc("Buisness Unit")]: 'SBUO-1A',
      TripProgress: TRIP_PROGRESS[0].Progress,
      _tripGroup: type,
      TripTicketID: previewTripTicketID || '',
    };

    setPreviewTrip(record);
    // setSelectedOrder(record);


    //refresh
    generateTripTicketID();
    generateAdditionalOE('Preload');
    generateAdditionalOE('Mobilization');
  };



  useEffect(() => {
    if (!activeModalType) return;

    const initializeModalData = async () => {
      // 1. Fire API call to generate the raw text sequence
      await generateAdditionalOE(activeModalType);
    };

    initializeModalData();
  }, [activeModalType]);

  // Watch for the specific preview string changes to instantly populate the form state
  useEffect(() => {
    if (!activeModalType) return;

    const currentGeneratedOE = getAdditionalOEForType(activeModalType);
    if (currentGeneratedOE) {
      setModalOE(currentGeneratedOE);

      // Optional: Chain generateTripTicketID automatically here if you want to preview the ticket code ahead of time
      generateTripTicketID(currentGeneratedOE);
    }
  }, [preview_preloadOE, preview_mobilizationOE, activeModalType]);


  // Helper to generate a unique ID for a specific row and trigger its API fetch
  const addNewRow = async (taskType: 'Preload' | 'Mobilization') => {
    if (bulkRows.length >= 10) return; // Enforce the 10-batch upper limit safely

    const rowId = Math.random().toString(36).substring(2, 9);

    const newSkeleton: BulkTaskRow = {
      id: rowId,
      type: taskType,
      oe: '',
      source: '',
      cementType: '',
      isLoadingOE: true
    };

    setBulkRows(prev => [...prev, newSkeleton]);

    try {
      const res = await GenerateAdditionalOE_ID2Service.GenerateAdditionalOE_ID2({
        Type: taskType, // Automatically uses correct type for endpoint routing
      } as any);

      const table1 = res.data?.ResultSets?.Table1 as any[] | undefined;
      const generatedId = (table1 && table1.length > 0) ? table1[0].NewID : 'ERR-GEN';

      setBulkRows(prev => prev.map(row =>
        row.id === rowId ? { ...row, oe: generatedId, isLoadingOE: false } : row
      ));
    } catch (error) {
      console.error(`Failed to generate ${taskType} OE:`, error);
      setBulkRows(prev => prev.map(row =>
        row.id === rowId ? { ...row, oe: 'ERROR', isLoadingOE: false } : row
      ));
    }
  };

  const handleRemoveRow = (idToRemove: string) => {
    setBulkRows(prev => prev.filter(row => row.id !== idToRemove));
  };


  useEffect(() => {
    if (isBulkModalOpen && bulkRows.length === 0) {
      addNewRow('Preload');
    }
  }, [isBulkModalOpen]);



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
            TripProgress eq 'Dispatched To Destination' or 
            TripProgress eq 'Planned'
          )
        `;
      const result = await ewulFetchAll<any>(LiveDMSView_CEMService, { filter: dateFilter, orderBy: ["OEDateAsInt desc"] }, 10000, 'ID');
      console.log('awda: ', result[0]);
      setAssignedOrders(result || []);
    } catch (err) {
      console.error(err);
      setAssignedOrders([]);
    } finally {
      setIsLoadingAssigned(false);
    }
  }, [selectedRangeNewOrders]);


  const fetchFCTRoutes = useCallback(async () => {
    if (stationOptions.length > 0 && sourceOptions.length > 0 && destinationOptions.length > 0) {
      if (!canFetch(FETCH_LOADING_KEYS.sourceList, 1000 * 60 * 60)) return;
    }

    try {
      const result = await ewulFetchAll<any>(
        Vw_FCT_RouteNodeListService,
        { filter: '' },
        2000,
        'Route'
      );

      if (result && result.length > 0) {
        const station_options: DropdownOption[] = result
          .filter((item: any) => item.Type === 'Station')
          .map((item: any) => ({
            value: item.Route ?? '',
            label: item.Route ?? '',
            subtext: item.Type,
            type: 'multi',
            record: item
          }));

        const source_options: DropdownOption[] = result
          .filter((item: any) => item.Type === 'Source')
          .filter((item: any) => item.Route && item.Route.startsWith('CLZ'))
          .map((item: any) => ({
            value: item.Route ?? '',
            label: item.Route ?? '',
            subtext: item.U_DeliveryType ?? 'OTHERS',
            type: 'multi',
            record: item
          }));

        const destination_options: DropdownOption[] = result
          .filter((item: any) => item.Type === 'Destination')
          .filter((item: any) => item.Route && item.Route.startsWith('CLZ'))
          .map((item: any) => ({
            value: item.Route ?? '',
            label: item.Route ?? '',
            subtext: item.U_DeliveryType ?? 'OTHERS',
            type: 'multi',
            record: item
          }));

        setSourceOptions(source_options || []);
        setDestinationOptions(destination_options || []);
        setStationOptions(station_options || []);
      } else {
        throw new Error("No route data found");
      }
    } catch (err) {
      console.error("Fetch Error during FCT Route fetching:", err);
    }
  }, [stationOptions.length, sourceOptions.length, destinationOptions.length]);

  // --- AUTO-RUN TRIGGERS ON COMPONENT MOUNT ---
  useEffect(() => {
    fetchFCTRoutes();
  }, [fetchFCTRoutes]);






  const handleOptimisticUpdate = useCallback((result: {
    added: any[];
    updated: any[];
    removed: string[];
  }) => {

    setAssignedOrders(prev => {
      let next = [...prev];

      // 1. Remove deleted/unassigned trips using database IDs instead of OE strings
      next = next.filter(row => {
        const rowId = row.rawData?.ID || row.ID;
        // Stringify rowId to ensure type alignment with the incoming result strings
        return rowId === undefined || rowId === null || !result.removed.includes(rowId.toString());
      });

      // 2. Update existing trips (Stays the same if tracking via OE works here)
      result.updated.forEach(updatedRow => {
        const index = next.findIndex(r => r.OE === updatedRow.OE);

        if (index >= 0) {
          next[index] = {
            ...next[index],
            ...updatedRow
          };
        }
      });

      // 3. Add newly created trips
      result.added.forEach(newRow => {
        if (!next.some(r => r.OE === newRow.OE)) {
          next.push(newRow);
        }
      });

      return next;
    });

  }, []);






  // COMBINED CONTROLLER: Targets active runtime context grid
  const handleSync = useCallback(() => {
    if (activeMode === 'NEW') {
      fetchNewOrders();
    } else if (activeMode === 'ASSIGNED') {
      fetchAssignedOrders();
    } else return;
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

  const handleDateChangeNewOrders = useCallback((range: { from: string, to: string }) => {
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
      contentPadding='5px'
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


          <button className="header-btn secondary mobilization" onClick={() => setIsBulkModalOpen(true)} style={{ minWidth: 180, textAlign: 'center' }}>
            Create Manual Trip
          </button>



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

      <div className="ordr-dist-order-management-page" style={{ height: '100%', position: 'relative' }}>

        <div className="ordr-dist-dashboard-workspace-bg" style={{ display: 'flex', height: '100%', width: '100%', position: 'relative', gap: '5px' }}>



          {/* MAIN TABLES CONTAINER */}
          <div className="ordr-dist-dashboard-gradient-wrapper ordr-dist-fullscreen-mode">
            <div className="ordr-dist-dashboard-floating-container">
              {/* EDIT HERE: Sync button is now packed side-by-side with the dynamic h3 heading */}
              <div className="ordr-dist-dashboard-panel-header">

                <div className="ordr-dist-heading-crossfade-wrapper">
                  <h3 className={`ordr-dist-fade-heading ${(activeMode === 'NEW' && !isArranging) ? 'visible' : ''}`}>
                    Assign Orders to BU
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


                <div style={{ gap: '8px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>

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
                    <>
                      {activeMode === "ASSIGNED" && (
                        <button
                          onClick={handleStartArranging}
                          className="ordr-dist-dashboard-action-btn btn-sequence-edit"
                        >
                          <Pencil size={16} strokeWidth={2} />
                          Edit Sequence
                        </button>
                      )}
                    </>
                  )}

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

                {/** RIGHT BUTTONS */}

                <>
                  <button
                    className="ordr-dist-dashboard-action-btn ordr-dist-primary-solid"
                    onClick={handleSyncWithCooldown}
                  // disabled={cooldown > 0 || isSyncing || !selectedRangeNewOrders} // UPDATE: Explicitly checks cooldown > 0
                  >
                    <RefreshCcw size={15} className={isSyncing ? 'ordr-dist-spinning' : ''} />
                    <span>{cooldown > 0 || isSyncing ? `Wait ${cooldown}s...` : `Sync View`}</span>
                  </button>
                </>


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
                  liveDmsTableConfig={liveDmsTableConfig}
                  onRowSelect={() => null}
                  handleRowDragDrop={handleRowDragDrop}
                  isArrangementMode={isArranging}
                  onArrangementModeChange={setIsArranging}
                  onOptimisticUpdate={handleOptimisticUpdate}
                  onRefreshTripsAssigned={fetchAssignedOrders}
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

        {isBulkModalOpen && (
          <Modal onClose={resetModalForm} width={'75%'} height={'auto'}> {/* Bumped width to 75% to comfortably fit the 4th input column */}
            <div className="ordr-dist-modal-wrapper">

              <div className="ordr-dist-modal-header-block">
                <h3>Manual Trips Planner</h3>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#64748b' }}>
                  Batch Allocation: {bulkRows.length} / 10
                </span>
              </div>

              <div className="ordr-dist-table-container">
                <table className="ordr-dist-bulk-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>OE Number & Task Type</th>
                      <th style={{ width: '22%' }}>Business Unit</th>
                      <th style={{ width: '22%' }}>Source Node</th>
                      <th style={{ width: '20%' }}>Cement Type</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((row) => {
                      const isMobilization = row.type === 'Mobilization';

                      return (
                        <tr key={row.id}>

                          {/* OE Column with Row Workflow Variant Badge Indicator */}
                          <td>
                            <div className="ordr-dist-gradient-input-container">
                              <input
                                type="text"
                                value={row.isLoadingOE ? "Generating ID..." : row.oe}
                                readOnly
                                style={{ background: '#f8fafc', color: '#475569', fontWeight: 500 }}
                              />
                            </div>
                            <span className={`ordr-dist-type-badge ${row.type === 'Preload' ? 'preload-badge' : 'mobilization-badge'}`}>
                              {row.type}
                            </span>
                          </td>

                          {/* Business Unit Selection Dropdown */}
                          <td>
                            <div className="ordr-dist-gradient-input-container">
                              <select
                                value={row.businessUnit || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, businessUnit: val } : r));
                                }}
                              >
                                <option value="">-- Select BU --</option>
                                {BUSINESS_UNITS.map((bu) => (
                                  <option key={bu} value={bu}>
                                    {bu}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Source Selection Dropdown */}
                          <td>
                            <div className={isMobilization ? "" : "ordr-dist-gradient-input-container"}>
                              <select
                                value={isMobilization ? "" : row.source}
                                disabled={isMobilization}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, source: val } : r));
                                }}
                                style={isMobilization ? {
                                  background: '#e2e8f0',
                                  color: '#94a3b8',
                                  borderColor: '#cbd5e1',
                                  cursor: 'not-allowed'
                                } : undefined}
                              >
                                <option value="">{isMobilization ? "Not Required" : "-- Select Source --"}</option>
                                {!isMobilization && sourceOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Cement Type Selection Dropdown */}
                          <td>
                            <div className={isMobilization ? "" : "ordr-dist-gradient-input-container"}>
                              <select
                                value={isMobilization ? "" : row.cementType}
                                disabled={isMobilization}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, cementType: val } : r));
                                }}
                                style={isMobilization ? {
                                  background: '#e2e8f0',
                                  color: '#94a3b8',
                                  borderColor: '#cbd5e1',
                                  cursor: 'not-allowed'
                                } : undefined}
                              >
                                <option value="">{isMobilization ? "Not Required" : "-- Select Type --"}</option>
                                {!isMobilization && cementTypeOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Delete row inline handler */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="ordr-dist-row-del-btn"
                              onClick={() => handleRemoveRow(row.id)}
                              disabled={bulkRows.length <= 1}
                              style={{ opacity: bulkRows.length <= 1 ? 0.3 : 1 }}
                            >
                              ✕
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Dual Row Entry Append Control Bar */}
              <div className="ordr-dist-action-bar-row">
                <button
                  type="button"
                  className="ordr-dist-add-row-btn preload-btn"
                  onClick={() => addNewRow('Preload')}
                  disabled={bulkRows.length >= 10}
                  style={{ opacity: bulkRows.length >= 10 ? 0.5 : 1 }}
                >
                  + Add Preload
                </button>

                <button
                  type="button"
                  className="ordr-dist-add-row-btn mobilization-btn"
                  onClick={() => addNewRow('Mobilization')}
                  disabled={bulkRows.length >= 10}
                  style={{ opacity: bulkRows.length >= 10 ? 0.5 : 1 }}
                >
                  + Add Mobilization
                </button>
              </div>

              {/* Footer System Dialog Submissions */}
              <div className="ordr-dist-modal-footer-actions">
                <button
                  type="button"
                  className="ordr-dist-modal-btn-cancel"
                  onClick={resetModalForm}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="ordr-dist-modal-btn-confirm"
                  onClick={() => {
                    console.log("Processing structured unified batch submission:", bulkRows);
                    resetModalForm();
                  }}
                  disabled={bulkRows.some(row => {
                    // General Validation: OE must exist, loading must be done, and a Business Unit must be chosen
                    if (!row.oe || row.isLoadingOE || !row.businessUnit) return true;

                    // Contextual Validation: Preloads additionally require Source and Cement Type definitions
                    if (row.type === 'Preload' && (!row.source || !row.cementType)) return true;

                    return false;
                  })}
                >
                  Confirm Trip Creation
                </button>
              </div>

            </div>
          </Modal>
        )}


      </div>
    </PageTemplate>
  );
};

export default OrderDistribution;