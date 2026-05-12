import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from "react-router-dom";
import PageTemplate from './template';
import { 
    NEW_TRIPS_UNFILTERED_TABLE_CONFIG, 
    LIVE_DMS_TABLE_CONFIG,GPS_STATUS_EMOJIS, 
    ATTENDANCE_STATUS_COLORS, 
    ATTENDANCE_STATUSES, 
    TRIP_PROGRESS,
    FETCH_LOADING_KEYS,
    FUEL_REQUESTS_TABLE_CONFIG,
    cementTypeOptions,
    frStatuses,
    GSDC_NAVIGATE_TO_TRIP_key,
} from '../truth.config';
import { RefreshCcw, Download, Maximize2, X, Menu } from 'lucide-react';


// CSS
import './css/OrderManagement.css';

// Power apps services
import { NewTripsView_CEM_unfilteredService} from '../generated/services/NewTripsView_CEM_unfilteredService';
import { LiveDMSView_CEMService} from '../generated/services/LiveDMSView_CEMService';
import { LiveVehicleAssignmentLIstViewService } from '../generated/services/LiveVehicleAssignmentLIstViewService'
import { type LiveVehicleAssignmentLIstView } from '../generated/models/LiveVehicleAssignmentLIstViewModel';
import { LiveDriverDispatchedList_AllService } from '../generated/services/LiveDriverDispatchedList_AllService'
import {GenerateAdditionalOE_IDService} from '../generated/services/GenerateAdditionalOE_IDService';
import { GenerateNewTripTicketService} from '../generated/services/GenerateNewTripTicketService';
//import {Vw_SOURCE_LIST_CEMService } from '../generated/services/Vw_SOURCE_LIST_CEMService'; //alread being fetch on fct routes
//import {DMS_TripFuelRequestsListService} from '../generated/services/DMS_TripFuelRequestsListService';
import { Live_LatestFuelRequestsService } from '../generated/services/Live_LatestFuelRequestsService';
import {Vw_FCT_RouteNodeListService} from '../generated/services/Vw_FCT_RouteNodeListService';
import { DMS_CEMService } from '../generated/services/DMS_CEMService';
import {FctFinalService} from '../generated/services/FctFinalService';
import { type FctFinal } from '../generated/models/FctFinalModel'; 
import { DMS_TripFuelRequestsListService} from '../generated/services/DMS_TripFuelRequestsListService';
import { GetLastLiquidatedOdometerService } from '../generated/services/GetLastLiquidatedOdometerService';
import FuelRequestManager from '../components/FuelRequestManager';
import {Vw_EmployeeServedTodayCountService} from '../generated/services/Vw_EmployeeServedTodayCountService';

// Custom Components
import TableView,  { type ColumnConfig, type scrollToConfig, encodeColumnName as enc } from '../components/ewul_TableFlex';
import DateRangePicker from '../components/ewul_DateRangePicker';
import TripGroup_DonutChart from '../components/tripGroup_DonutChart'; 
import OrderDistributionForm, { type OrderDistributionFormRef, type FormUserInfo } from '../components/OrderDistributionForm';
import Modal from '../components/ewul_Modal';
import AutoDismissBanner from '../components/ewul_Banner';


//Utils
import type { DropdownOption} from '@components/SearchableDropdown';
import { useUser } from '../utils/useUser';
import {

    ewulFetchAll,
    ISOtoInt,

    ewul_canFetch as canFetch,
    ewul_isAnythingLoading as isAnythingLoading,
    ewul_setLoadingFor as setLoadingFor,
    ewul_loadingList as loadingList,

    logDmsUpdate,


} from '../utils/Ewul_GSDC_Utils';
import { useTaskWorker } from '../utils/TaskWorkerContext';
import type { LiveDMSView_CEM } from '../generated/models/LiveDMSView_CEMModel';





interface FuelRequestModalState {
    show: boolean;
    title: string;
    subtitle: string;
    tractor: string;
    trailer: string;
    data: LiveDMSView_CEM | null;
}

interface lastOdometerResult {
    Odometer: string;
    OE: string;
    lastOE: string;
}

const OrderManagement: React.FC = () => {

    const { user } = useUser();
    const { addTask } = useTaskWorker();

    const [orders, setOrders] = useState<any[]>([]);
    const [trips, setTrips] = useState<any[]>([]);
    const [livetruckassignment, setLiveTruckAssignment] = useState<any[]>([]);
    const [driverHelperList, setDriverHelperList] = useState<any[]>([]);

    const [truckOptions, setTruckOptions] = useState<any[]>([]);
    const [trailerOptions, setTrailerOptions] = useState<any[]>([]);
    const [sourceOptions, setSourceOptions] = useState<any[]>([]);
    const [destinationOptions, setDestinationOptions] = useState<any[]>([]);
    const [stationOptions, setStationOptions] = useState<any[]>([]);
    const [fuelRequests, setFuelRequests] = useState<any[]>([]);
    const [employeeServedAttendance, setEmployeeServedAttendance] = useState<any[]>([]);


    const [previewTrip, setPreviewTrip] = useState<any>({});
    //const [loading, setLoading] = useState<boolean>(false);
    const [preview_preloadOE, setPreviewPreloadOE] = useState<any>({});
    const [preview_mobilizationOE, setPreviewMobilizationOE] = useState<any>({});

    const [activeView, setActiveView] = useState<'dashboard' | 'form'>('dashboard');

    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [showNewTripModal, setShowNewTripModal] = useState(false);
    const [showFuelRequestModal, setShowFuelRequestModal] = useState<FuelRequestModalState | null>(null);
    const [lastOdometer, setLastOdometer] = useState<string | null>(null);
    const [lastFuelReqOE, setLastFuelReqOE] = useState<string | null>(null);

    const formRef = useRef<OrderDistributionFormRef>(null);

    const [searchParams, _setSearchParams] = useSearchParams();
    const targetOE = searchParams.get("oe");
    useEffect(() => {
        if (targetOE && trips.length > 0) {
            console.log("Deep link detected for OE:", targetOE);
            
            // Logic to find the trip in your local list
            const trip = trips.find(t => String(t.OE) === String(targetOE));
            
            if (trip) {
                // Trigger your existing table click/row selection logic
                handleTripsTableOnClick(trip,true); // dont do deselect
                
                // OPTIONAL: Clear the URL param so it doesn't re-trigger on refresh
                // setSearchParams({}, { replace: true });
            }
        }
    }, [targetOE, trips]); // Runs when trips load or OE param changes





    const [isFormMaximized, setIsFormMaximized] = useState(false);

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleChangeActiveView = async (view: 'dashboard' | 'form') => {
        if (activeView === 'form' && view === 'dashboard' && formRef.current && selectedOrder !== null) {
            const canClose = await formRef.current?.showUnsavedChangesModal();
            if (canClose) {
                setSelectedOrder(null); 
                setPreviewTrip({});
                handleChangeActiveView('dashboard');
                return;
            }
        } else {
            setActiveView(view);
        }
    };

    const [selectedRange, setSelectedRange] = useState<{from: string, to: string} | null>(null);
    const handleDateChange = useCallback((range: {from: string, to: string}) => {
        setSelectedRange(prev => {
            // If the values are exactly the same, return the previous state to avoid a re-render
            if (prev?.from === range.from && prev?.to === range.to) {
                return prev;
            }
            return range;
        });
    }, []);

    const [selectedRangeNewOrders, setSelectedRangeNewOrders] = useState<{from: string, to: string} | null>(null);
    const handleDateChangeNewOrders = useCallback((range: {from: string, to: string}) => {
        setSelectedRangeNewOrders(prev => {
            // If the values are exactly the same, return the previous state to avoid a re-render
            if (prev?.from === range.from && prev?.to === range.to) {
                
                return prev;
            }
            return range;
        });
    }, []);




    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const currentOrderData = selectedOrder || { OE: '', LS: 0 };

    // 1. Data Fetching Logic
    const fetchNewOrders = useCallback(async () => {
        if (!selectedRangeNewOrders) return;
        if (!canFetch(FETCH_LOADING_KEYS.newOrders)) return;

        console.log("Fetching new orders with date range:", selectedRangeNewOrders);
        
        // Convert "2026-03-26" to 20260326 for your SQL OEDateAsInt column
        const fromInt = ISOtoInt(selectedRangeNewOrders.from);
        const toInt = ISOtoInt(selectedRangeNewOrders.to);
        
        const dateFilter = `OEDateAsInt ge ${fromInt} and OEDateAsInt le ${toInt}`;

        const options = {
                filter: dateFilter, // Pass the filter here!
                orderBy: ["OEDateAsInt desc"]
        }

        setLoadingFor(FETCH_LOADING_KEYS.newOrders, true);
        try { 
            const result = await ewulFetchAll<any>(
                NewTripsView_CEM_unfilteredService, 
                options, 
                10000
            );


            // 'result' is the actual Array now!
            if (result && result.length > 0) {
                setOrders(result);
            } else {
                setOrders([]);
            }
            
        } catch (err) {
            console.error("Fetch Error during batching:", err);
            setOrders([]);
        } finally {
            setLoadingFor(FETCH_LOADING_KEYS.newOrders, false);
            console.log("Fetch new orders completed with count:", orders.length);
        }

    }, [selectedRangeNewOrders]);

    const fetchAttendanceServedCounts = useCallback(async (nocd: boolean = false) => {

        if (!nocd && employeeServedAttendance.length > 0 && !canFetch(`${FETCH_LOADING_KEYS.fetchAttendanceServedCounts}`)) return;
        setLoadingFor(`${FETCH_LOADING_KEYS.fetchAttendanceServedCounts}`, true);


        try {
            const requestsResults = await ewulFetchAll<any>(
                Vw_EmployeeServedTodayCountService,
                { filter: '' },
                2000,
                'EmployeeName'
            );
            setEmployeeServedAttendance(requestsResults);


        } catch (err) {
            console.error("Fetch Error during fuel request batching:", err);
        } finally {
            setLoadingFor(`${FETCH_LOADING_KEYS.fetchAttendanceServedCounts}`, false);
        }
    }, []);



    const fetchFuelRequests = useCallback(async (nocd: boolean = false, vehicle?: string, oe?: string) => {
        console.log("Fetching fuel requests with parameters - nocd:", nocd, "vehicle:", vehicle, "oe:", oe);
        if (!vehicle || !oe) return;
        if (!nocd && fuelRequests.length > 0 && !canFetch(`${FETCH_LOADING_KEYS.fuelRequests}-${vehicle}-${oe}`)) return;
        setLoadingFor(`${FETCH_LOADING_KEYS.fuelRequests}`, true);

        

       
        // Filter 2: All requests for that Head on that OE
        const currentOEFilter = `(Head eq '${vehicle}' and OE eq '${oe}') or (Head eq '${vehicle}' and isOngoing eq 'Yes')`;
        setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, true);
        try {

            console.log(`Fetching fuel requests for vehicle: ${vehicle} and OE: ${oe}`);
            //setFuelRequests([]); // reset to prevent stale data entering the logic
            const requestsResults = await ewulFetchAll<any>(
                Live_LatestFuelRequestsService,
                { filter: currentOEFilter },
                100,
                'DMS_RequestID'
            );

            setFuelRequests(requestsResults);
            setLoadingFor(`${FETCH_LOADING_KEYS.fuelRequests}`, false);

            console.log("fetching last Odometer:");
            const resOdo = await GetLastLiquidatedOdometerService.GetLastLiquidatedOdometer({ 
                        Head: vehicle,
                } as any);


            const tableOdoData = resOdo.data?.ResultSets?.Table1 as lastOdometerResult[];
            const lastOdometer = tableOdoData ? tableOdoData[0].Odometer : 0;
            const lastOE = tableOdoData ? tableOdoData[0].lastOE : null;


            setLastOdometer(lastOdometer || null);
            setLastFuelReqOE(lastOE);
            console.log("Last odometer reading from fuel requests:", lastOdometer || null, 'results: ', lastOdometer);

            console.log("Fetched and combined unique fuel requests:", requestsResults);


        } catch (err) {
            console.error("Fetch Error during fuel request batching:", err);
            setFuelRequests([]);
        } finally {
            setLoadingFor(`${FETCH_LOADING_KEYS.fuelRequests}-${vehicle}-${oe}`, false);
        }
    }, []);

    
    const fetchFCTRoutes = useCallback(async () => {
        if (stationOptions.length > 0 && sourceOptions.length > 0 && destinationOptions.length > 0) if (!canFetch(FETCH_LOADING_KEYS.sourceList,1000*60*60 /** CD of 1 hr since its not always updated */)) return; // Only fetch if we don't already have options

        try{
            const result = await ewulFetchAll<any>(
                Vw_FCT_RouteNodeListService,
                { filter: ''},
                10000,
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
                        record: item // Store the original record for later use when an option is selected
                        
                    }));

                const source_options: DropdownOption[] = result
                    .filter((item: any) => item.Type === 'Source')
                    .filter((item: any) => item.Route && item.Route.startsWith('CLZ')) // Filter out items without a Name
                    .map((item: any) => ({
                        value: item.Route ?? '',
                        label: item.Route ?? '',
                        subtext: item.U_DeliveryType ?? 'OTHERS',
                        type: 'multi',
                        record: item // Store the original record for later use when an option is selected
                    }));

                const destination_options: DropdownOption[] = result
                    .filter((item: any) => item.Type === 'Destination')
                    .filter((item: any) => item.Route && item.Route.startsWith('CLZ')) // Filter out items without a Name
                    .map((item: any) => ({
                        value: item.Route ?? '',
                        label: item.Route ?? '',
                        subtext: item.U_DeliveryType ?? 'OTHERS',
                        type: 'multi',
                        record: item // Store the original record for later use when an option is selected
                    }));


                // Only update if the result is actually different or exists
                setSourceOptions(source_options || []);
                setDestinationOptions(destination_options || []);
                setStationOptions(station_options || []);

            } else {
                throw new Error("No route data found");
            }


        } catch (err) {
            console.error("Fetch Error during FCT Route fetching:", err);
        }
        
    },[]);


    const handleFuelRequestSubmit = async (formData: FctFinal, attachmentSPID?: string, tripID?: string) => {
        setShowFuelRequestModal(null);
        console.log("Submitting new fuel request...");
        // 1. Set loading state
        setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, true);
        let isCreate = formData.Frstatus === 'New' || formData.Frstatus === 'Pre-New';
        let isFRDisapproveUpdate = formData.Frstatus === 'FR Disapproved';
        let createData: FctFinal = { ...formData, Id: Number(attachmentSPID) || 0, Frstatus:  isCreate ? formData.Frstatus === 'Pre-New' ? 'Pre-Request' : 'Request' : formData.Frstatus }; // Ensure the status is set to 'Request' for new submissions
        let updateData: FctFinal  = { ...formData, Frstatus: 'Request', SQLID: undefined}; // For updates, only change status if it's a disapproval update



        console.log("Fuel request form data before submission:", isFRDisapproveUpdate, " // ", formData, ' // Create?', isCreate, ' // Update?', isFRDisapproveUpdate);
        
        addTask({
            id: `fuelRequest-${formData.Orderentryref}-${formData.Head}`,
            name: `Fuel Request for trip ${formData.Orderentryref}`,
            execute: async () => {
                try {
                    let result = null;
                    if (isCreate) {
                        result = await FctFinalService.create(createData);
                        if (result.error) throw new Error("Failed to submit fuel request: " + result.error.message);
                        DMS_TripFuelRequestsListService.create({
                            OE: formData.Orderentryref || '',
                            fuelrequestID: result.data.SQLID?.toString() || '',
                            RequestedBy: user?.FullName || 'Unknown',
                            userID: Number(user?.id) || undefined,
                            fctID: tripID ? Number(tripID) : undefined,
                            CreatedDate: new Date().toISOString(),
                        });
                        logDmsUpdate({ // record transaction in log
                            userName: user?.FullName || 'Unknown User',
                            userID: Number(user?.id) || 0,
                            inputOE: formData.Orderentryref || '',
                            action: `Requested ${result.data.Category} fuel for this trip.`,
                            value: result.data.SQLID?.toString() || '',
                            context: `Trip - Fuel Request`,
                            role: user?.Position || 'Unknown Role',
                        });
                    } else if (formData.SQLID?.toString()) {
                        console.log("Updating existing fuel request with ID:", formData.SQLID.toString());
                        result = await FctFinalService.update(formData.SQLID?.toString(), updateData);
                        if (result.error) throw new Error("Failed to update fuel request: " + result.error.message);
                        logDmsUpdate({ // record transaction in log
                            userName: user?.FullName || 'Unknown User',
                            userID: Number(user?.id) || 0,
                            inputOE: formData.Orderentryref || '',
                            action: `Updated disapproved fuel request [${formData.SQLID?.toString()}] for this trip.`,
                            value: result.data.SQLID?.toString() || '',
                            context: `Trip - Fuel Request Update`,
                            role: user?.Position || 'Unknown Role',
                        });
                    }

                    console.log("Update result:", result);
                    if (!result?.success) {
                        throw new Error("Failed to submit fuel request.");
                    }

                } catch (err) {
                    console.error("Error submitting fuel request:", err);
                    return { success: false, data: null };
                } finally {
                    return { success: true, data: null };
                }
            },
            checkSuccess: (result: { success: boolean }) => result.success,
            onSuccess: () => {null},
            onFailure: () => {null},
            message: `Submitting fuel request for OE ${formData.Orderentryref}...`,
            message_success: `Fuel request for OE ${formData.Orderentryref} submitted successfully.`,
            message_failure: `Failed to submit fuel request for OE ${formData.Orderentryref}.`,
        });

    };



    // State for Change Trip Modal
    const [showChangeTripModal, setShowChangeTripModal] = useState<{
        show: boolean;
        record: any;
        action: 'Divert' | 'Change';
        configChange: any[];
    } | null>(null);
    const [selectedChangeTripOE, setSelectedChangeTripOE] = useState<any | null>(null);

    const handleRequestChangeTrip = (tripData: any, action: 'Divert' | 'Change') => {
        let originalOESource = tripData?.Source || '';
        setSelectedChangeTripOE(null); // Reset selected OE when opening modal
        setShowChangeTripModal({ show: true, record: tripData, action, configChange: changeConfig(originalOESource) });
        fetchNewOrders(); // Refresh orders to get the latest OEs for selection
    };
    


    const fetchTrips = useCallback(async (nocd: boolean = false) => {
        if (!selectedRange) return;
        if (!nocd && trips.length > 0) null; //if (!canFetch(FETCH_LOADING_KEYS.trips)) return;
        console.log("Fetching trips with date range:", selectedRange);

        
        const fromInt = ISOtoInt(selectedRange.from);
        const toInt = ISOtoInt(selectedRange.to);
        const dateFilter = `OEDateAsInt ge ${fromInt} and OEDateAsInt le ${toInt} and TripProgress ne 'PLD Done'`;

        setLoadingFor(FETCH_LOADING_KEYS.trips, true);
        try {
            const result = await ewulFetchAll<any>(
                LiveDMSView_CEMService, 
                { filter: dateFilter, orderBy: ["OEDateAsInt desc"] }, 
                10000,
                'ID'
            );

            // Only update if the result is actually different or exists
            setTrips(result || []);
    
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setLoadingFor(FETCH_LOADING_KEYS.trips, false);
        }
    }, [selectedRange]); // ONLY depend on the range

    const [LSlist, setLSList] = useState<any[]>([]);
    const fetchLSThisMonth = useCallback(async () => {
        if (!canFetch(FETCH_LOADING_KEYS.lsList)) return;
        console.log("Fetching LS list for this month...");

        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const firstDayInt = ISOtoInt(firstDay.toISOString()); // YYYYMMDD

        const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
        const lastDayInt = ISOtoInt(lastDay.toISOString());
        

        const dateFilter = `OEDateAsInt ge ${firstDayInt} and OEDateAsInt le ${lastDayInt} and TripProgress ne 'Done' and TripProgress ne 'PLD Done' `;

        setLoadingFor(FETCH_LOADING_KEYS.lsList, true);
        try {
            const result = await ewulFetchAll<any>(
                LiveDMSView_CEMService, 
                { filter: dateFilter, orderBy: ["OEDateAsInt desc"], select: [`${enc('Loading Sequence')},ID,OE`] }, 
                5000,
                'ID'
            );

            // Only update if the result is actually different or exists
            setLSList(result || []);
    
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setLoadingFor(FETCH_LOADING_KEYS.lsList, false);
        }
    }, []);





    const fetchTruckList = useCallback(async () => {
        if (!canFetch(FETCH_LOADING_KEYS.truckList)) return;
        console.log("Fetching truck list...");

        setLoadingFor(FETCH_LOADING_KEYS.truckList, true);
        try {
            const result = await ewulFetchAll<any>(
                LiveVehicleAssignmentLIstViewService, 
                { filter: `Assignment eq 'VASQUEZ' or Assignment eq 'INTERCITY'` }, 
                3000
            ) || [];


            setLiveTruckAssignment(result);


            const truck_options: DropdownOption[] = result
            .filter((item: any) => item.Head) // Only include if a head exists
            .map((item: any) => {
                const statusEmoji = GPS_STATUS_EMOJIS[item.GpsStatus] ?? '⚫';
                
                return {
                    value: item.Head ?? '',
                    label: item.Head_Full ?? '',
                    subtext: `${statusEmoji} ${item.GpsStatus ?? 'NO GPS'} | ${item.PairedTrailer ?? 'NO BO'} | ${item.OE ?? 'NO TRIP'} |  ${item.TractorJRNumber ? item.TractorJRNumber + ': ' + item.Tractor_JRStatus : 'NO UR '} `,
                    type: 'multi',
                    record: item
                };
            });

            const trailer_options: DropdownOption[] = result
                .filter((item: any) => item.PairedTrailer) // Only include if a trailer exists
                .map((item: any) => ({
                    value: item.PairedTrailer ?? '',
                    label: item.Trailer_Full ?? '',
                    subtext: 'Trailer Unit',
                    type: 'multi',
                    record: item // Store the original record for later use when an option is selected
                }));

            const dummyOption: DropdownOption = {
                value: 'Apple',
                label: 'Apple',
                type: 'multi',
                subtext: 'TESTING'
            };

            // 3. Update dropdown states
            setTruckOptions([dummyOption, ...truck_options]);
            setTrailerOptions([dummyOption, ...trailer_options]);

        } catch (err) {
            console.error("Truck List Fetch Error:", err);
        } finally {
            setLoadingFor(FETCH_LOADING_KEYS.truckList, false);
        }
    }, [activeView, sidebarVisible]);


    const mapToCardOption = (item: any, _fullList: any[]): DropdownOption => {

        return {
            value: item.FullName ?? '',
            label: item.FullName ?? '',
            type: 'card',
            cardConfig: [
            // Row 1: Attendance and Trip Status
            [
                { 
                    label: 'Attendance', 
                    value: item.DMS_Attendance ?? 'ABSENT',
                    color: ATTENDANCE_STATUS_COLORS[item.DMS_Attendance as keyof typeof ATTENDANCE_STATUS_COLORS]?.bg ?? '#ff0000'
                },
                { 
                    label: 'Deployment', 
                    value: item.EmploymentStatus ?? 'Undeployed',
                    color: item.EmploymentStatus === 'Deployed' ? '#3a4efc' : '#64748b'
                }
            ],
            // Row 2: Employment and Pairing
            [
                { 
                    label: 'Trip', 
                    value: item.OE ? `${item.OE}` : 'NO TRIP',
                    color: item.OE ? '#3a4efc' : '#64748b',
                    proportion: 1 // Give more space to the trip description
                },
                { 
                    label: 'Status', 
                    value: `${item.DMS_TripStatus ?? '---'}`,
                    proportion: 1
                }
            ]
            ],
            record: item
        };
    };

    const processPersonnelData = (data: any[]) => {
        // 1. Sort by attendance
        const sorted = [...data].sort((a, b) => {
            const aSort = ATTENDANCE_STATUSES.find(s => s.Status === a.DMS_Attendance)?.sort ?? 999;
            const bSort = ATTENDANCE_STATUSES.find(s => s.Status === b.DMS_Attendance)?.sort ?? 999;
            return aSort - bSort;
        });

        // 2. Separate and Map
        const drivers = sorted
            .filter(item => item.Position === 'Driver')
            .map(item => mapToCardOption(item, data));

        const helpers = sorted
            .filter(item => item.Position === 'Helper')
            .map(item => mapToCardOption(item, data));

        return { drivers, helpers };
    };

    const dummyOption: DropdownOption = {
        value: 'Apple',
        label: 'Apple',
        type: 'multi',
        record: {Id: 'test', FullName: 'Apple', DMS_Attendance: 'PRESENT'}
    };

    const dummyOption2: DropdownOption = {
        value: 'Berry',
        label: 'Berry',
        type: 'single',
        record: {Id: 'test2', FullName: 'Berry'}
    };

    //const [driverOptions, setDriverOptions] = useState<any[]>([]);
    //const [helperOptions, setHelperOptions] = useState<any[]>([]);
    const { driverOptions, helperOptions } = useMemo(() => {
        const { drivers, helpers } = processPersonnelData(driverHelperList);
        
        // Add your dummy options here
        return {
            driverOptions: [dummyOption, ...drivers],
            helperOptions: [dummyOption2, ...helpers]
        };
    }, [driverHelperList]);



    const fetchDriverHelperList = useCallback(async (nocd: boolean = false) => {
        if (driverOptions.length > 0 && !nocd) if (!canFetch(FETCH_LOADING_KEYS.driverHelperList)) return;
        console.log("Fetching driver and helper list...");

        try {
            setLoadingFor(FETCH_LOADING_KEYS.driverHelperList, true);
            const result = await ewulFetchAll<any>(
                LiveDriverDispatchedList_AllService, 
                { filter: `contains(Deploystatus, 'Deployed') and (contains(EmploymentStatus, 'Regular') or contains(EmploymentStatus, 'Probationary'))`  }, 
                3000,
                'Id'
            );

            setDriverHelperList(result);

        } catch (err) {
            console.error("Driver Helper List Fetch Error:", err);
        } finally {
            setLoadingFor(FETCH_LOADING_KEYS.driverHelperList, false);
        }
    }, [activeView, sidebarVisible]);

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
        const res = await GenerateAdditionalOE_IDService.GenerateAdditionalOE_ID({ 
            Type: type,
        } as any);


        const table1 = res.data?.ResultSets?.Table1 as any[] | undefined;
        if (!table1 || table1.length === 0) {
            console.error("No data returned for new OE generation.");
            return;
        }

        if (type === 'Preload') setPreviewPreloadOE( table1[0].NewID);
        if (type === 'Mobilization') setPreviewMobilizationOE( table1[0].NewID);

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
            [enc("Buisness Unit") ]: 'SBUO-1A',
            TripProgress: TRIP_PROGRESS[0].Progress,
            _tripGroup: type,
            TripTicketID: previewTripTicketID || '',
        };

        setPreviewTrip(record);
        setSelectedOrder(record);


        //refresh
        generateTripTicketID();
        generateAdditionalOE('Preload');
        generateAdditionalOE('Mobilization');
    };

    useEffect(() => {
        generateTripTicketID();
        generateAdditionalOE('Preload');
        generateAdditionalOE('Mobilization');
    }, []); // Call once on mount to have it ready for when the user clicks Preload or Mobilization

    // MAIN REFRESH
    const handleRefresh = useCallback(() => {
        fetchTruckList();
        fetchDriverHelperList();
        generateTripTicketID();
        generateAdditionalOE('Preload');
        generateAdditionalOE('Mobilization');
        fetchTrips();
        fetchLSThisMonth();
        //fetchSourceList();
        fetchFCTRoutes();
        fetchAttendanceServedCounts();
    }, []);

    useEffect(() => {
        handleRefresh();
    }, [handleRefresh]);


    // Scheduled refresh every 60 seconds
    useEffect(() => {
        const intervalId = setInterval(() => {
            console.log("Performing scheduled refresh...");
            handleRefresh();
        }, 60000); // 60 seconds

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [handleRefresh]);

    // REFRESH TRIP WHEN DATE RANGE CHANGES WITHOUT CD
    useEffect(() => { 
        fetchTrips();
        //fetchNewOrders();
    }, [selectedRange]);

    // REFRESH NEW ORDERS WHEN DATE RANGE CHANGES WITHOUT CD\
    useEffect(() => {
        fetchNewOrders();
        //fetchNewOrders();
    }, [selectedRangeNewOrders]);

    // run once
    useEffect(() => {
        fetchFCTRoutes();
    }, [fetchFCTRoutes]);


    const handleDonutInteraction = (event: any) => {
        console.log("Filtering table by status:", event);
        // This is where you could trigger a search or filter in your TableView
        // For now, let's just log it to ensure the interaction works.
    };

    const handleExport = () => {
        console.log("Exporting order data...");
        // Logic for CSV/Excel export would go here
    };

    const actions = (
        <>
            <button
                className="header-btn primary"
                onClick={() => setShowNewTripModal(true)}
                style={{ minWidth: 90 }}
            >
                + New Trip
            </button>
            <button className="header-btn secondary preload" onClick={() => { handleAdditionalOEGeneration("Preload"); setActiveView('form'); setSidebarVisible(true);}} style={{ minWidth: 90 }}>Preload</button>
            <button className="header-btn secondary mobilization" onClick={() => { handleAdditionalOEGeneration("Mobilization"); setActiveView('form'); setSidebarVisible(true); }} style={{ minWidth: 120 }}>Mobilization</button>
            {/*<button className="header-btn secondary" onClick={() => {setShowFuelRequestModal(true); fetchFuelRequests(true);}}>
                <Fuel size={16} />
                <span>Fuel Requests</span>
            </button>*/}
            <DateRangePicker 
                    allowedTypes={['Today','Yesterday','Last Week','Weekly','Monthly'/*, 'Yearly', 'Custom'*/]} 
                    initialType='Monthly'
                    onFilterChange={(range) => { handleDateChange(range);}} 
                    opacity={0.2}
                    bgColor='var(--color-primary)'
                    hoverColor='var(--color-primary)'
            />
            <button className="header-btn secondary" onClick={handleExport}>
                <Download size={16} />
                <span>Export CSV</span>
            </button>
            <button 
                className={`header-btn primary ${isAnythingLoading() ? 'spinning' : ''}`} 
                onClick={handleRefresh}
                disabled={isAnythingLoading()}
            >
                <RefreshCcw size={16} />
                <span>Refresh</span>
            </button>
        </>
    );


    // Resizable sidebar state
    const [sidebarWidth, setSidebarWidth] = useState(33.33); // percent, default 1:2 ratio
    const isResizing = useRef(false);

    // Sidebar height tracking
    const sidebarRef = useRef<HTMLDivElement>(null);
    //const [sidebarHeight, setSidebarHeight] = useState<number | undefined>(undefined);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const container = document.getElementById('main-content-split');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            let percent = ((e.clientX - rect.left) / rect.width) * 100;
            // Clamp between 20% and 60%
            percent = Math.max(20, Math.min(60, percent));
            setSidebarWidth(percent);
        };
        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const openRequestsCount = fuelRequests.filter((req) => {


        // 2. Check if the request's status is one of the 'isOpen' statuses
        const isOpenStatus = frStatuses.some(status => 
            status.isOpen && status.value === req.Frstatus
        );

        return isOpenStatus;
    }).length;

    // --- SCROLL TO STATE ---
    const [scrollTo, setScrollTo] = useState<scrollToConfig | null>(null);

    const localUser: FormUserInfo = useMemo(() => {
        return {
            id: user?.id,
            FullName: user?.FullName,
            BusinessUnit: user?.BusinessUnit,
            Position: user?.Position
        } as FormUserInfo;
    }, [user?.id, user?.FullName, user?.BusinessUnit, user?.Position]);

    const renderOrderForm = (isMaximized: boolean) => (
        <OrderDistributionForm
            ref={formRef}
            orderId={currentOrderData.OE}
            initialData={currentOrderData}
            onClose={() => {
                if (isMaximized) {
                    setIsFormMaximized(false);
                } else {
                    setActiveView('dashboard');
                    setScrollTo({ search_col: 'wew', key: 'wew', highlight: 'warning' });
                    setSelectedOrder(null);
                    setPreviewTrip({});
                }
            }}
            allTrips={trips} // Pass all trips here
            onFormDataChange={(formData, editedColumn, isValid) => {
                console.log(`Form validity is: ${isValid}`);
                if (formData.OE) {
                    //const exists = trips.some(t => t.OE === formData.OE);
                    const preview = formData;

                    setPreviewTrip(preview);


                    setScrollTo({ 
                        search_col: 'OE', 
                        key: formData.OE as any, 
                        highlight: isValid ? 'success' : 'danger',
                        target_col: editedColumn,
                    });
                } else {
                    setPreviewTrip({});
                }
            }}
            onClearSelectedTrip={() => {setSelectedOrder(null); setPreviewTrip({});}}
            onProceed={(updatedTrip, deselect) => {
                console.log("Proceeding with trip:", updatedTrip);
                setTrips(prevTrips => {
                    const index = prevTrips.findIndex(t => t.OE === updatedTrip.OE);
                    if (index !== -1) {
                        // Update existing trip
                        const newTrips = [...prevTrips];
                        newTrips[index] = updatedTrip;
                        return newTrips;
                    } else {
                        // Add new trip
                        return [updatedTrip, ...prevTrips];
                    }
                });

                if (deselect) {
                     setSelectedOrder(null);
                     fetchTrips(true);
                } else {
                    setSelectedOrder(updatedTrip);
                }

                
                
            }}
            onOEInputClick={() => {
                setShowNewTripModal(true);
            }}
            onNavigateToTrip={(oe) => {
                const trip = trips.find(t => t.OE === oe);
                if (trip) {
                    setSelectedOrder(trip);
                    setActiveView('form');
                    setSidebarVisible(true);
                    setShowNewTripModal(false);
                    setScrollTo({ search_col: 'OE', key: oe, highlight: 'info' });
                }
            }}
            onCancelTrip={(id) => {
                setTrips(prevTrips => prevTrips.filter(trip => trip.ID !== id));
                setActiveView('dashboard');
                setSelectedOrder(null);
                setPreviewTrip({});
            }}
            onRefreshTrips={() => {fetchTrips(true);}}
            onRefreshDriverHelpers={() => {fetchDriverHelperList(true)}}
            onUpdateDriverHelperAttendance={(name, attendance, position) => {
                setDriverHelperList(prevList => prevList.map(item => {
                    if (item.FullName === name && item.Position === position) {
                        return { ...item, DMS_Attendance: attendance };
                    }
                    return item;
                }));
                // Note: No more sorting or setOptions calls here! 
                // useMemo catches the change to driverHelperList automatically.
            }}
            onShowFuelRequest={(tripData) => {
                setShowFuelRequestModal({
                    show: true,
                    title: `${tripData.Vehicle}`,
                    subtitle: `${tripData.OE}`,
                    tractor: tripData.Vehicle || '',
                    trailer: tripData.BO || '',
                    data: tripData,
                }); 
                fetchFuelRequests(true, tripData.Vehicle, tripData.OE);
            }}
            onRequestChangeTrip={(tripData, action) => {handleRequestChangeTrip(tripData, action); /*handle change trip*/}}

            truckOptions={truckOptions}
            trailerOptions={trailerOptions}
            driverOptions={driverOptions}
            helperOptions={helperOptions}
            sourceOptions={sourceOptions}
            
            lsList={LSlist}
            driverHelperList={driverHelperList}

            attendanceServedCounts={employeeServedAttendance}

            editingUser={localUser}

            canChangeTrip={
                (loadingList[FETCH_LOADING_KEYS.fuelRequests] ? false : true) && 
                openRequestsCount === 0
            } // Disable if there are any open fuel requests for that OE
            fuelFetching={loadingList[FETCH_LOADING_KEYS.fuelRequests] || false}
        />
    );


    const changeConfig = (originalOESource: string) => {

        let changeTripConfig = [
            {
                col: "SourceName", alias: "Source", portion: 1.5,
                filter: {
                    type: "dropdown-multiple",
                    options: [{ label: originalOESource, value: originalOESource }],
                    default: originalOESource ? [originalOESource] : [],
                }
            },
            { 
                col: "CementTypeName", alias: "Type", portion:1, 
                filter: {
                    type: "dropdown-multiple", 
                    options: cementTypeOptions,
                    default: currentOrderData.cementType ? [currentOrderData.cementType] : [],
                }
            }
        ] as ColumnConfig[];

        // Merge logic: replace by col if exists, else add
        const base = NEW_TRIPS_UNFILTERED_TABLE_CONFIG.table_config;
        const overrides = changeTripConfig || [];
        const overrideMap = Object.fromEntries(overrides.map((col: ColumnConfig) => [col.col, col]));
        const merged = base.map(col => overrideMap[col.col] ? overrideMap[col.col] : col);
        const baseCols = new Set(base.map(col => col.col));
        overrides.forEach((col: ColumnConfig) => {
            if (!baseCols.has(col.col)) merged.push(col);
        });

        return merged as ColumnConfig[];
    }

    const [scrollToNewTrips, setScrollToNewTrips] = useState<scrollToConfig | null>(null);
    const renderNewTripsTable = (onRowClickLogic: (row: any) => void, changeConfig: ColumnConfig[] = NEW_TRIPS_UNFILTERED_TABLE_CONFIG.table_config) => {


        return (
            <TableView 
                data={orders}
                config={changeConfig}
                searchCol={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.searchable_cols as string[]}
                storageKey={`order_page_sap_new_orders${user?.id}`}
                isLoading={loadingList[FETCH_LOADING_KEYS.newOrders] || false}
                showRowCount={500}
                onRefresh={(signal) => signal && fetchNewOrders()}
                overflowY={true}
                maxHeight={600}
                colMinWidth={120}
                onRowClick={onRowClickLogic}
                theme="var(--color-primary)"
                allowMultipleSelection={false}
                rowStyle={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.rowStyle}
                loadingNoPreventAction={true}
                showNumbering={true}
                highlightSelected={true}
                scrollTo={scrollToNewTrips}
            />
        );
    };




    //////
    const [selectChangeTripError, setSelectChangeTripError] = useState<string | null>(null);
    const onSelectChangeTrip = (raw_record: any) => {
        if (!showChangeTripModal) return;

        const original = showChangeTripModal.record;
        let errorMessage: string | null = null;

        // 1. Define Validation Rules
        if (["Tagged", "Completed"].includes(raw_record.SAPStatus)) {
            errorMessage = `This Trip is already ${raw_record.SAPStatus.toLowerCase()}.`;
        } 
        else if (raw_record.SAPStatus !== "Approved" && !(raw_record._tripGroup == 'Preload' && raw_record.SAPStatus === 'Manual' && original._tripGroup === 'Preload')) {
            errorMessage = "Only approved trips can be selected.";
        } 
        else if (raw_record.SourceName !== original.Source) {
            errorMessage = "Source does not match the original trip. Please select a trip with the same source.";
        } 
        else if (
            raw_record._tripGroup !== original._tripGroup && 
            !['Preload', 'Mobilization'].includes(original._tripGroup)
        ) {
            errorMessage = "Trip group does not match. Please select a trip with the same trip group.";
        } 
        else if (raw_record.CementTypeName !== original.cementType) {
            errorMessage = "Cement type does not match. Please select a trip with the same cement type.";
        }

        // 2. Execute Result
        if (errorMessage) {
            // Handle Failure
            setSelectChangeTripError(errorMessage);
            setScrollToNewTrips({ search_col: 'OE', key: raw_record.OE, highlight: 'danger' });
            setSelectedChangeTripOE(null);
        } else {
            // Handle Success
            console.log("Selected order for trip change:", raw_record);
            setSelectChangeTripError(null); // Clear previous errors
            setSelectedChangeTripOE(raw_record);
            setScrollToNewTrips({ search_col: 'OE', key: raw_record.OE, highlight: 'success' });
        }
    };

    // handle GSDC_NAVIGATE_TO_TRIP
    useEffect(() => {
        const handleNavigation = (event: any) => {
            const { oe} = event.detail;
            console.log("Navigating to trip:", oe);
            helperNavigateToOEfromExternal(oe);
        };

        window.addEventListener(GSDC_NAVIGATE_TO_TRIP_key, handleNavigation);
        
        return () => {
            window.removeEventListener(GSDC_NAVIGATE_TO_TRIP_key, handleNavigation);
        };
    }, [trips]);

    const [bannerMessage, setBannerMessage] = useState<string | null>(null);
    const helperNavigateToOEfromExternal = async (oe: string) => {
        const oeRecord = displayData.find(item => item.OE === oe);
        
        if (!oeRecord) {
            // Show banner and auto-hide after 3000ms (3 seconds)
            setBannerMessage(`No record found for OE: ${oe}. Make sure the trips are loaded to the correct Month.`);
            setTimeout(() => {
                setBannerMessage(null);
            }, 2000);
            return;
        }

        handleTripsTableOnClick(oeRecord, true);
    };



    const handleTripsTableOnClick = async (record: any, noDeselect?: boolean) => {
        const isDeselecting = noDeselect ? false : selectedOrder?.OE === record.OE;
        const isselectedrecordvalid = /*await formRef.current?.runValidation(record)*/ {isValid: true}; // For now, we'll assume it's valid. You can implement this function to validate the record before selecting it.
        const highlight = isselectedrecordvalid?.isValid ? 'success' : 'danger';
        const selectrecord = () => {
            setSelectedOrder(record);
            handleChangeActiveView('form');
            setShowNewTripModal(false);
            setSidebarVisible(true);
            setScrollTo({ 
                search_col: 'OE', 
                key: record.OE as any, 
                highlight: highlight,
            });
        };

        if (selectedOrder == undefined) {selectrecord(); return;}

        // Always check for unsaved changes if the form might be open.
        const canProceed = await formRef.current?.showUnsavedChangesModal();
        console.log("User chose to proceed with navigation:", canProceed);

        if (!canProceed) {
            console.log("User canceled navigation. Staying on current order.");
            setScrollTo({ 
                search_col: 'OE', 
                key: selectedOrder?.OE as any, 
                highlight: highlight,
            });
            return;
        }

        // If the user confirms or there were no unsaved changes:
        if (isDeselecting) {
            // Deselect the current order and return to the dashboard view.
            setSelectedOrder(null);
            setPreviewTrip({});
            handleChangeActiveView('dashboard');
            setScrollTo({ search_col: 'OE', key: 'wew', highlight: highlight });
        } else {
            // Select the new order and switch to the form view.
            selectrecord();
            fetchFuelRequests(false, record.Vehicle, record.OE);
        }
    }




    //FOR TRIPS TABLE
    const displayData = useMemo(() => {
    if (!previewTrip.OE) return trips;
    
    // Return the preview at the top, followed by all other trips
    return [previewTrip, ...trips.filter(t => t.OE !== previewTrip.OE)];
    }, [trips, previewTrip]);
    

    return (
        <PageTemplate 
            title="Trip Dispatch" 
            actions={actions} 
            overflowY={true}
        >
            {/* Sidebar Toggle Tab */}
            <div 
                title='Open DMS Form/Dashboard'
                className={`sidebar-toggle-tab ${sidebarVisible ? 'hidden' : ''}`}
                onClick={() => setSidebarVisible(true)}
            >
                <Menu size={24} />
            </div>

            <div
                className="main-content-split"
                id="main-content-split"
            >
            {/* LEFT SIDE: Management Utility (Resizable) */}
                <div
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
                        display: !sidebarVisible && isMobile ? 'none' : 'flex',
                        flexDirection: 'column'
                    }}
                    aria-hidden={!sidebarVisible}
                >
                    {/* NEW HEADER ROW */}
                    <div className="sidebar-header-row" style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0 8px',
                        height: '50px',
                        borderBottom: '1px solid rgba(0,0,0,0.05)'
                    }}>
                        {/* LEFT SIDE: Tabs */}
                        <div className="utility-tabs" style={{ marginBottom: 0, width: 'auto' }}>
                            <div className={`tabs-pill-bg ${activeView}`}></div>
                            <button className={`tab-btn ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => handleChangeActiveView('dashboard')}>Dashboard</button>
                            <button className={`tab-btn ${activeView === 'form' ? 'active' : ''}`} onClick={() => handleChangeActiveView('form')}>Form</button>
                        </div>

                        {/* RIGHT SIDE: Action Group */}
                        <div className="utility-actions">
                            {/* Render Maximize first if you want it to the left of Close */}
                            <div className={`utility-maximize ${activeView === 'form' ? 'show-icon' : ''}`}>
                                <button className="maximize-btn" onClick={() => setIsFormMaximized(true)}>
                                    <Maximize2 size={18} />
                                </button>
                            </div>

                            <div className="utility-close">
                                <button className="close-btn" onClick={() => setSidebarVisible(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="utility-content animate-fade-in">
                        {activeView === 'dashboard' ? (
                            <div className="mini-dashboard-stack">
                                <div className="chart-container-card">
                                    <h4 className="chart-title">Trip Distribution</h4>
                                    <TripGroup_DonutChart 
                                        key={selectedRange?.from || 'initial'}
                                        BU={null}
                                        fromStr={selectedRange?.from || ""} 
                                        toStr={selectedRange?.to || ""} 
                                        onChartClick={handleDonutInteraction}
                                        orientation='vertical'
                                    />
                                </div>

                                <div className="sidebar-stats-grid">
                                    <div className="mini-stat">
                                        <span className="stat-label">Total Loaded</span>
                                        <span className="stat-value">{orders.length}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="order-form-compact">
                                {/* Passed false here because this is the sidebar, not the modal */}
                                {renderOrderForm(false)} 
                            </div>
                        )}
                    </div>
                </div>


            {/* RIGHT SIDE: Trips Table */}
            <div className={`table-main-area animate-table${sidebarVisible ? ' table-in' : ' table-out'}`}> 
                <TableView
                    data={displayData}
                    config={LIVE_DMS_TABLE_CONFIG.table_config as ColumnConfig[]}
                    storageKey={`order_page_live_trips${user?.id}`}
                    searchCol={LIVE_DMS_TABLE_CONFIG.searchable_cols as string[]}
                    isLoading={loadingList[FETCH_LOADING_KEYS.trips] || false}
                    showRowCount={50}
                    onRefresh={(signal) => signal && fetchTrips()}
                    overflowY={true}
                    overflowX={true}
                    /* maxHeight={sidebarHeight} REMOVED - This was causing the height issue */
                    colMinWidth={60}
                    // You can add row click or other handlers as needed
                    rowStyle={LIVE_DMS_TABLE_CONFIG.rowStyle}
                    loadingNoPreventAction={true}
                    showNumbering={true}
                    scrollTo={scrollTo}
                    highlightSelected={true}
                    theme="var(--color-primary)"
                    onRowClick={async (record) => {
                        handleTripsTableOnClick(record);
                    }}
                />
            </div>

            {/* Fuel Request Modal */}
            {showFuelRequestModal && (
                <Modal 
                    onClose={() => {setShowFuelRequestModal(null);}}
                    width={'90%'}
                    height={'90vh'}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div className="new-order-modal-header">
                            <div>
                                <h2>{`Fuel Requests: ${showFuelRequestModal?.title || ''}`}</h2>
                                <p>{`Order Reference: ${showFuelRequestModal?.subtitle || ''}`}</p>
                            </div>
                        </div>
                        <div className="fuel-modal-body" style={{padding: 0}}>
                            <FuelRequestManager
                                truckOE={(showFuelRequestModal?.tractor || '') + (showFuelRequestModal?.subtitle || '')}
                                fuelRequests={fuelRequests}
                                lastFuelRequestOE={lastFuelReqOE}
                                vehicleLists={livetruckassignment}
                                tableConfig={FUEL_REQUESTS_TABLE_CONFIG.table_config as ColumnConfig[]}
                                storageKey={`fuel_requests_${localUser?.id}`}
                                searchableCols={FUEL_REQUESTS_TABLE_CONFIG.searchable_cols as string[]}
                                isLoading={loadingList[FETCH_LOADING_KEYS.fuelRequests] || false}
                                onRefresh={(signal) => signal && showFuelRequestModal && fetchFuelRequests(false, showFuelRequestModal.tractor, showFuelRequestModal.subtitle)}
                                onFormSubmit={handleFuelRequestSubmit}
                                tripData={showFuelRequestModal.data}
                                initialFormData={(() => {
                                    const truckRecord: LiveVehicleAssignmentLIstView = livetruckassignment.find((t: any) => t.Head === showFuelRequestModal?.tractor);

                                    return {
                                        Head: showFuelRequestModal.tractor,
                                        Trailer: showFuelRequestModal.trailer,
                                        Driversname: showFuelRequestModal.data?.Driver || '',
                                        Orderentryref: showFuelRequestModal.data?.OE || '',
                                        Category: 'New Trip',
                                        Orderentrystatus: 'OE REFERENCE',
                                        Status: (showFuelRequestModal.data?.QTYWithdrawn ?? 0) > 0 ? 'Loaded' : 'Empty',

                                        Currentlocation: truckRecord?.LiveLocation || '',
                                        Plate: truckRecord?.PlateNo || '',
                                        Brand: truckRecord?.Brand || '',
                                        Wheelertype: truckRecord?.WheelerType || '',
                                        Platetrailer: truckRecord?.TPlateNo || '',
                                        Classification: truckRecord?.Classification || '',
                                        Axle: truckRecord?.Axle || '',
                                        Subengine: truckRecord?.SubEngine || '',
                                        Type: truckRecord?.TrailerType || '',

                                        Odometer:  lastOdometer || '',

                                        Frstatus: 'New',

                                        CreatedBy: localUser?.FullName || '',
                                        Created: new Date().toISOString(),
                                        Businessunit: 'SBUO-1A',
                                        Requestedby: localUser?.FullName || '',

                                        Karga: showFuelRequestModal.data?.QTYWithdrawn || '',

                                        Ts1: new Date().toISOString(),

                                    } as Partial<FctFinal>;
                                })()}
                                onRowClick={(record) => {
                                    console.log("Editing fuel request:", record);
                                    // The component will automatically switch to the form view
                                }}

                                stationOptions={stationOptions}
                                sourceOptions={sourceOptions}
                                destinationOptions={destinationOptions}
                                user={localUser}
                            />
                        </div>
                    </div>
                </Modal>
            )}

            {/* Change Trip/OE Modal */}
            {showChangeTripModal?.show && (
                <Modal 
                    onClose={() => {setShowChangeTripModal(null); setScrollToNewTrips(null);}}
                    width={'90%'}
                    height={'90vh'}
                    contentStyle={{ paddingBottom: "0px"}}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div className="new-order-modal-header">
                            <div>
                                <h2>{showChangeTripModal.action} Trip: {showChangeTripModal.record?.OE} | {showChangeTripModal.record?.Source} | {showChangeTripModal.record?.cementType}</h2>
                                <p>Select a trip to {showChangeTripModal.action.toLowerCase()} into</p>
                            </div>

                            <DateRangePicker 
                                allowedTypes={['Monthly', 'Yearly', 'Custom']} 
                                onFilterChange={(range) => {
                                    handleDateChangeNewOrders(range);
                                }} 
                                opacity={1}
                                bgColor='var(--color-primary)'
                                hoverColor='var(--color-primary)'
                            />

                        </div>
                        <div className="modal-body" style={{ paddingBottom: 80 }}>
                            <div style={{ marginTop: 24 }}>
                                {
                                    (() => {    
                                        
                                        return renderNewTripsTable(onSelectChangeTrip, showChangeTripModal.configChange);
                                    })()
                                }
                            </div>
                        </div>
                        {/* Sticky Footer */}
                        <div
                            style={{
                                position: 'sticky',
                                left: 0,
                                bottom: 0,
                                width: '100%',
                                background: 'var(--color-bg, #fff)',
                                borderTop: '1px solid #eee',
                                padding: '16px 24px',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                zIndex: 10,
                            }}
                        >
                            <span
                                className={`sticky-footer-message${selectedChangeTripOE ? ' selected' : ' not-selected'}`}
                            >
                                {selectedChangeTripOE
                                    ? `Selected ${showChangeTripModal.action.toLocaleLowerCase()} OE: ${selectedChangeTripOE.OE}`
                                    : `Please select an OE to ${showChangeTripModal.action.toLocaleLowerCase()} into.`}
                            </span>
                            <button
                                className={`gradient-btn-proceed ${selectedChangeTripOE ? '' : 'disabled'}`}
                                style={{ minWidth: 120, fontWeight: 600, fontSize: 'var(--font-size-lg, 18px)' }}
                                disabled={!selectedChangeTripOE}
                                onClick={() => {
                                    if (!selectedChangeTripOE) return;
                                    console.log(`${showChangeTripModal.action} Trip to:`, selectedChangeTripOE.OE);
                                    const original = selectedOrder;
                                    const changedTripRecord = 
                                        {

                                            OE: selectedChangeTripOE.OE,
                                            Source: selectedChangeTripOE.SourceName,
                                            Destination: selectedChangeTripOE.DestiName,
                                            Customer: selectedChangeTripOE.Customer,
                                            Ordered_x0020_Date: selectedChangeTripOE.OrderedDate,
                                            Needed_x0020_Date: selectedChangeTripOE.NeededDate,
                                            OE_x0020_Date: selectedChangeTripOE.OE_x0020_Date,
                                            _tripGroup: selectedChangeTripOE._tripGroup,
                                            
                                        }

                                    setSelectedOrder({...selectedOrder, ...changedTripRecord});
                                    setShowChangeTripModal(null);

                                    addTask({
                                        name: `${showChangeTripModal.action} trip ${selectedChangeTripOE.OE}`,
                                        execute: async () => {
                                            try {
                                
                                            const result = await DMS_CEMService.update(
                                                showChangeTripModal.record.ID.toString(), 
                                                changedTripRecord
                                            );
                                
                                            if (result.error) {
                                                throw new Error(result.error.message);
                                            }

                                            //log to transaction history
                                            logDmsUpdate({
                                                userName: user?.FullName || '',
                                                userID: Number(user?.id) || 0,
                                                inputOE: selectedChangeTripOE.OE || '',
                                                action: `Trip ${showChangeTripModal.action}ed from [${showChangeTripModal.record.OE}] to [${selectedChangeTripOE.OE}].`,
                                                value: selectedChangeTripOE.OE || '',
                                                context: `Trip - Divert/Change`,
                                                role: user?.Position || '',
                                            });
                                
                                            return { success: true, data: result.data };
                                
                                            } catch (error) {
                                            console.error('Failed to save trip:', error);
                                            return { success: false, error };
                                            }
                                        },
                                        checkSuccess: (result: { success: boolean }) => result.success,
                                        onSuccess: (data) => {
                                            setTrips(prevTrips => {
                                                const index = prevTrips.findIndex(t => t.OE === data.OE);
                                                if (index !== -1) {
                                                    // Update existing trip
                                                    const newTrips = [...prevTrips];
                                                    newTrips[index] = data;
                                                    return newTrips;
                                                } else {
                                                    // Add new trip
                                                    return [data, ...prevTrips];
                                                }
                                            });
                                        },
                                        onFailure: () => {setSelectedOrder(original);},
                                
                                        message: `Saving changes for trip ${selectedChangeTripOE.OE}...`,
                                        message_success: `Trip ${selectedChangeTripOE.OE} saved successfully!`,
                                        message_failure: (result) => `Failed to save trip ${selectedChangeTripOE.OE}. Reason: ${result.error?.message || 'Unknown error'}`
                                        });

                                }}
                            >
                                {showChangeTripModal.action} Trip
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {(selectChangeTripError && showChangeTripModal) && (
                <Modal 
                    onClose={() => setSelectChangeTripError(null)}
                    width={'400px'} // Using fixed width for small alerts is usually cleaner
                    height={'auto'}
                >
                    <div className="invalid-changetrip-trip-modal-container">
                        {/* Title Section */}
                        <h3 className="invalid-changetrip-modal-title-red">Invalid Trip Selected!</h3>
                        
                        {/* Body Section */}
                        <div className="invalid-changetrip-modal-body-content">
                            <p>{selectChangeTripError}</p>
                        </div>

                        {/* Action Footer */}
                        <div className="invalid-changetrip-modal-footer-right">
                            <button 
                                className="gradient-btn-proceed" 
                                onClick={() => setSelectChangeTripError(null)}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* New Trip Modal */}
            {showNewTripModal && (
                <Modal onClose={() => setShowNewTripModal(false)}>
                    <div className="new-order-modal-header">
                        <div>
                            <h2>SAP New Orders</h2>
                            <p>Select an order for a new trip</p>
                        </div>
                        
                        <DateRangePicker 
                            allowedTypes={['Monthly', 'Yearly', 'Custom']} 
                            onFilterChange={(range) => {
                                handleDateChangeNewOrders(range);
                            }} 
                            opacity={1}
                            bgColor='var(--color-primary)'
                            hoverColor='var(--color-primary)'
                        />
                    </div>
                    <div className="modal-body">
                        <div style={{ marginTop: 24 }}>
                            {
                                (() => {
                                    const onRowClick = (raw_record: any) => {
                                        generateTripTicketID();
                                        const record = {
                                            ...raw_record,
                                            Source: raw_record.SourceName,
                                            Destination: raw_record.DestiName,
                                            cementType: raw_record.CementTypeName,
                                            [enc("Buisness Unit") ]: 'SBUO-1A',
                                            TripProgress: TRIP_PROGRESS[0].Progress,
                                            TripTicketID: previewTripTicketID || '',
                                            Ordered_x0020_Date: raw_record.OrderedDate,
                                            Needed_x0020_Date: raw_record.NeededDate
                                        };
                                        setSelectedOrder(record);
                                        console.log("Selected order for new trip:", record);
                                        setActiveView('form');
                                        setShowNewTripModal(false);
                                        setSidebarVisible(true);
                                        const exists = trips.some(t => t.OE === record.OE);

                                        const preview = record;

                                        if (!exists) setPreviewTrip(preview);
                                        else setPreviewTrip({});
                                        setScrollTo({ search_col: 'OE', key: record.OE, highlight: 'warning' });
                                    };
                                    return renderNewTripsTable(onRowClick);
                                })()
                            }
                        </div>
                    </div>
                </Modal>
            )}

            {/* Fullscreen Form Modal */}
            {isFormMaximized && (
                <Modal onClose={() => setIsFormMaximized(false)}>
                    <div className="modal-header-fullscreen">
                        <h2>Order Distribution: {currentOrderData.OE}</h2>
                    </div>
                    <div className="modal-body-fullscreen" style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
                        {renderOrderForm(true)}
                    </div>
                </Modal>
            )}


            {bannerMessage && (
            <AutoDismissBanner 
                message={bannerMessage} 
                onClose={() => setBannerMessage(null)} 
            />
            )}
        
        </div>
    </PageTemplate>
    );
};

export default OrderManagement;