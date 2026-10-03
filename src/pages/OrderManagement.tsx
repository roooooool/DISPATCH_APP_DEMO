import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from "react-router-dom";
import PageTemplate from './template';
import {
    NEW_TRIPS_UNFILTERED_TABLE_CONFIG,
    LIVE_DMS_TABLE_CONFIG, GPS_STATUS_EMOJIS,
    ATTENDANCE_STATUS_COLORS,
    ATTENDANCE_STATUSES,
    TRIP_PROGRESS,
    FETCH_LOADING_KEYS,
    FUEL_REQUESTS_TABLE_CONFIG,
    cementTypeOptions,
    frStatuses,
    GSDC_NAVIGATE_TO_TRIP_key,
    // BUSINESS_UNITS,
    TRIP_GROUPS,
    STORAGE_KEY_PREFIX,
} from '../truth.config';
import { RefreshCcw, Download, Maximize2, X, Menu, Eye, EyeOff } from 'lucide-react';

import { getContext } from "@microsoft/power-apps/app";

// CSS
import './css/OrderManagement.css';

// Power apps services
import { NewTripsView_CEM_unfilteredService } from '../generated/services/NewTripsView_CEM_unfilteredService';
import { LiveDMSView_CEMService } from '../generated/services/LiveDMSView_CEMService';
import { LiveVehicleAssignmentLIstViewService } from '../generated/services/LiveVehicleAssignmentLIstViewService'
import { type LiveVehicleAssignmentLIstView } from '../generated/models/LiveVehicleAssignmentLIstViewModel';
//@ts-ignore
import { LiveDriverDispatchedList_AllService } from '../generated/services/LiveDriverDispatchedList_AllService'
//@ts-ignore
import { GenerateAdditionalOE_IDService } from '../generated/services/GenerateAdditionalOE_IDService';
//@ts-ignore
import { GenerateNewTripTicketService } from '../generated/services/GenerateNewTripTicketService';
//import {Vw_SOURCE_LIST_CEMService } from '../generated/services/Vw_SOURCE_LIST_CEMService'; //alread being fetch on fct routes
import { Live_LatestFuelRequestsService } from '../generated/services/Live_LatestFuelRequestsService';
import { Vw_FCT_RouteNodeListService } from '../generated/services/Vw_FCT_RouteNodeListService';
//@ts-ignore
import { DMS_CEMService } from '../generated/services/DMS_CEMService';
//@ts-ignore
import { FctFinalService } from '../generated/services/FctFinalService';
import { type FctFinal } from '../generated/models/FctFinalModel';
//@ts-ignore
import { DMS_TripFuelRequestsListService } from '../generated/services/DMS_TripFuelRequestsListService';
//@ts-ignore
import { GetLastLiquidatedOdometerService } from '../generated/services/GetLastLiquidatedOdometerService';
import FuelRequestManager from '../components/FuelRequestManager';
// import { UpsertTripTaskTrackerService } from '../generated/services/UpsertTripTaskTrackerService';
//@ts-ignore
import { TripTicketsService } from '../generated/services/TripTicketsService';
//@ts-ignore
import { Usp_ChangeTripTaskTrackerOEService } from '../generated/services/Usp_ChangeTripTaskTrackerOEService';
//@ts-ignore
import { OnFCTDivertService } from '../generated/services/OnFCTDivertService';
import { CIFMETripsView_CEM_unfilteredService } from '../generated/services/CIFMETripsView_CEM_unfilteredService';
//@ts-ignore
import { Changelog2Service } from '../generated/services/Changelog2Service';
import { type Changelog2 } from '../generated/models/Changelog2Model';




// Custom Components
import TableView, { type ColumnConfig, type scrollToConfig } from '../components/ewul_TableFlex';
import DateRangePicker, { type DateRangeType } from '../components/ewul_DateRangePicker';
import TripGroup_DonutChart, { type TripGroupDonutChartRef } from '../components/tripGroup_DonutChart';
import OrderDistributionForm, { type OrderDistributionFormRef, type FormUserInfo } from '../components/OrderDistributionForm';
import Modal from '../components/ewul_Modal';
import AutoDismissBanner from '../components/ewul_Banner';


//Utils
import type { DropdownOption } from '@components/SearchableDropdown';
import { useUser } from '../utils/useUser';
import {

    //@ts-ignore
    ewulFetchAll, ewulCreate, ewulUpdate, ewulDelete, ewulExecute, ewulSharePointAPI, getDriverHelperList,
    ISOtoInt,

    ewul_canFetch as canFetch,
    ewul_isAnythingLoading as isAnythingLoading,
    ewul_setLoadingFor as setLoadingFor,
    ewul_loadingList as loadingList,

    logDmsUpdate,

    formatToLocalISO,

    encodeColumnName as enc,

    logDebug, type DebugLogParams,



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


    const [previewTrip, setPreviewTrip] = useState<any>({});
    //const [loading, setLoading] = useState<boolean>(false);
    const [preview_preloadOE, setPreviewPreloadOE] = useState<any>({});
    const [preview_mobilizationOE, setPreviewMobilizationOE] = useState<any>({});

    const [activeView, setActiveView] = useState<'dashboard' | 'form'>('dashboard');

    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [showCharts, setShowCharts] = useState<boolean>(() => {
        if (!user?.id) return true; // Default fallback if user is not loaded yet
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}showCharts_${user.id}`);
            return saved !== null ? JSON.parse(saved) : true;
        } catch (error) {
            console.error('Failed to parse saved showCharts state from localStorage:', error);
            return true;
        }
    });
    useEffect(() => {
        if (!user?.id) return;
        const storageKey = `${STORAGE_KEY_PREFIX}showCharts_${user.id}`;
        localStorage.setItem(storageKey, JSON.stringify(showCharts));
    }, [showCharts, user?.id]);
    const [showNewTripModal, setShowNewTripModal] = useState(false);
    const [showFuelRequestModal, setShowFuelRequestModal] = useState<FuelRequestModalState | null>(null);
    const [lastOdometer, setLastOdometer] = useState<string | null>(null);
    const [lastFuelReqOE, setLastFuelReqOE] = useState<string | null>(null);
    // const [selectedBU, setSelectedBU] = useState<string>(user?.BusinessUnit || '');

    const formRef = useRef<OrderDistributionFormRef>(null);
    const donutChartRef = useRef<TripGroupDonutChartRef>(null);


    const [searchParams, _setSearchParams] = useSearchParams();
    useEffect(() => {
        const handlePowerAppsDeepLink = async () => {
            try {
                // 1. Fetch the native Power Apps Code App context container
                const ctx = await getContext();
                const queryParams = ctx.app.queryParams;

                // 2. Look specifically for your tracking 'oe' parameter
                const targetOE = queryParams?.['oe'];

                if (targetOE && displayData.length > 0) {
                    const oeRecord = displayData.find(item => item.OE === targetOE);
                    handleTripsTableOnClick(oeRecord);
                }
                console.log('Did not go to target OE for table is not fully loaded.');

            } catch (error) {
                console.error("Failed to parse query params via Power Apps SDK:", error);
            }
        };

        handlePowerAppsDeepLink();
    }, [searchParams, trips]);




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


    // 1. Initialize state with type support & fallback for legacy entries
    const [selectedRange, setSelectedRange] = useState<{
        from: string;
        to: string;
        type?: string;
    } | null>(() => {
        if (!user?.id) return null;
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
            if (!saved) return null;

            const parsed = JSON.parse(saved);
            return {
                from: parsed.from,
                to: parsed.to,
                type: parsed.type || parsed.dateType || 'Monthly', // Fallback for legacy items without a type
            };
        } catch (error) {
            console.error('Failed to parse saved date range from localStorage:', error);
            return null;
        }
    });

    // 2. Updated memoized change handler
    const handleDateChange = useCallback(
        (range: { from: string; to: string; type?: string; dateType?: string }) => {
            setSelectedRange(prev => {
                const incomingType = range.type || range.dateType || 'Monthly';

                if (
                    prev?.from === range.from &&
                    prev?.to === range.to &&
                    prev?.type === incomingType
                ) {
                    return prev;
                }

                return {
                    from: range.from,
                    to: range.to,
                    type: incomingType,
                };
            });
        },
        []
    );

    // 3. Persist state to localStorage (automatically includes from, to, and type)
    useEffect(() => {
        if (!user?.id) return;

        const storageKey = `${STORAGE_KEY_PREFIX}${user.id}`;
        if (selectedRange) {
            localStorage.setItem(storageKey, JSON.stringify(selectedRange));
        } else {
            localStorage.removeItem(storageKey);
        }
    }, [selectedRange, user?.id]);

    const [selectedRangeNewOrders, setSelectedRangeNewOrders] = useState<{ from: string, to: string } | null>(null);
    const handleDateChangeNewOrders = useCallback((range: { from: string, to: string }) => {
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

        const dateFilter = `(OEDateAsInt ge ${fromInt} and OEDateAsInt le ${toInt}) and ( SAPStatus ne 'Tagged' or TaggedBU eq '${user?.BusinessUnit}')`;

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

            // console.log("Fetched new orders:", result);


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
    fetchNewOrders(); // Call it once on component mount to load initial data



    // 1. Data Fetching Logic
    const [CIFMEOrders, setCIFMEOrders] = useState<any[]>([]);
    const fetchCIFMEOrders = useCallback(async (cifmeso: string) => {
        // if (!selectedRangeNewOrders) return;
        // if (!canFetch(FETCH_LOADING_KEYS.cifmeOrders)) return;

        console.log("Fetching new orders with date range:", selectedRangeNewOrders);

        const dateFilter = `U_CIFMESO eq '${cifmeso}'`;

        const options = {
            filter: dateFilter, // Pass the filter here!
            orderBy: ["OEDateAsInt desc"]
        }

        // setLoadingFor(FETCH_LOADING_KEYS.cifmeOrders, true);
        try {
            const result = await ewulFetchAll<any>(
                CIFMETripsView_CEM_unfilteredService,
                options,
                500
            );

            console.log("Fetched cifme orders:", result);


            // 'result' is the actual Array now!
            if (result && result.length > 0) {
                setCIFMEOrders(result);
            } else {
                setCIFMEOrders([]);
            }

        } catch (err) {
            console.error("Fetch Error during batching:", err);
            setCIFMEOrders([]);
        } finally {
            // setLoadingFor(FETCH_LOADING_KEYS.cifmeOrders, false);
            console.log("Fetch new orders completed with count:", CIFMEOrders.length);
        }

    }, [selectedRangeNewOrders]);
    // fetchCIFMEOrders(); // Call it once on component mount to load initial data


    const handleGlobalRefresh = async () => {
        if (donutChartRef.current) {
            // Execute the child's internal data fetch call smoothly
            await donutChartRef.current.refresh();
        }
    };



    const [frLoading, setFRLoading] = useState(false);
    const fetchFuelRequests = useCallback(async (nocd: boolean = false, vehicle?: string, oe?: string) => {
        console.log("Fetching fuel requests with parameters - nocd:", nocd, "vehicle:", vehicle, "oe:", oe);
        if (!vehicle || !oe) return;
        if (!nocd && fuelRequests.length > 0 && !canFetch(`${FETCH_LOADING_KEYS.fuelRequests}-${vehicle}-${oe}`)) return;
        setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, true);
        setFRLoading(true);





        // Filter 2: All requests for that Head on that OE
        const currentOEFilter = `(Head eq '${vehicle}' and OE eq '${oe}') or (Head eq '${vehicle}' and isOngoing eq 'Yes')`;
        setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, true);
        try {

            console.log(`Fetching fuel requests for vehicle: ${vehicle} and OE: ${oe}`);
            //setFuelRequests([]); // reset to prevent stale data entering the logic
            const requestsResults = await ewulFetchAll<any>(
                Live_LatestFuelRequestsService,
                { filter: currentOEFilter, orderBy: ["CreatedDate desc"] },
                100,
                'DMS_RequestID'
            );

            setFuelRequests(requestsResults);
            setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, false);

            console.log("fetching last Odometer:");
            const resOdo = await ewulExecute('DISPATCH_APP_DMS', 'GetLastLiquidatedOdometer', { Head: vehicle } as any);


            const tableOdoData = resOdo as lastOdometerResult[];
            const lastOdometer = tableOdoData ? tableOdoData[0].Odometer : 0;
            const lastOE = tableOdoData ? tableOdoData[0].lastOE : null;


            setLastOdometer(lastOdometer || null);
            setLastFuelReqOE(lastOE);
            console.log("Last odometer reading from fuel requests:", lastOdometer || null, 'results: ', lastOdometer);

            console.log("Fetched and combined unique fuel requests:", requestsResults);
            setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, false);

        } catch (err) {
            console.error("Fetch Error during fuel request batching:", err);
            setFuelRequests([]);
        } finally {
            setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, false);
            setFRLoading(false);
        }
    }, []);


    const fetchFCTRoutes = useCallback(async () => {
        if (stationOptions.length > 0 && sourceOptions.length > 0 && destinationOptions.length > 0) if (!canFetch(FETCH_LOADING_KEYS.sourceList, 1000 * 60 * 60 /** CD of 1 hr since its not always updated */)) return; // Only fetch if we don't already have options

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

    }, []);



    const handleFuelRequestSubmit = async (formData: FctFinal, attachmentSPID?: string, tripID?: string) => {
        setShowFuelRequestModal(null);
        console.log("Submitting new fuel request...");
        // 1. Set loading state
        setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, true);
        let isCreate = formData.Frstatus === 'New' || formData.Frstatus === 'Pre-New';
        let isFRDisapproveUpdate = formData.Frstatus === 'FR Disapproved';
        let createData: FctFinal = { ...formData, Id: Number(attachmentSPID) || 0, Frstatus: isCreate ? formData.Frstatus === 'Pre-New' ? 'Pre-Request' : 'Request' : formData.Frstatus, Businessunit: user?.BusinessUnit }; // Ensure the status is set to 'Request' for new submissions
        let updateData: FctFinal = { ...formData, Frstatus: 'Request', SQLID: undefined }; // For updates, only change status if it's a disapproval update



        console.log("Fuel request form data before submission:", isFRDisapproveUpdate, " // ", formData, ' // Create?', isCreate, ' // Update?', isFRDisapproveUpdate);

        addTask({
            id: `fuelRequest-${formData.Orderentryref}-${formData.Head}`,
            name: `Fuel Request for trip ${formData.Orderentryref}`,
            execute: async () => {
                try {
                    let result = null;
                    if (isCreate) {
                        result = await ewulCreate<any>('FCT_Reporting', 'fctFinal', createData);
                        console.log('created fuel: ', result);
                        if (result.error) throw new Error("Failed to submit fuel request: " + result.error.message);
                        ewulCreate('DISPATCH_APP_DMS', 'DMS_TripFuelRequestsList', {
                            OE: formData.Orderentryref || '',
                            fuelrequestID: result.data.SQLID?.toString() || '',
                            RequestedBy: user?.FullName || 'Unknown',
                            userID: Number(user?.id) || undefined,
                            fctID: tripID ? Number(tripID) : undefined,
                            CreatedDate: new Date().toISOString()
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
                        result = await ewulUpdate('FCT_Reporting', 'fctFinal', formData.SQLID?.toString(), updateData);
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

                    // console.log("Update result:", result);
                    if (result?.error) {
                        throw new Error("Failed to submit fuel request.");
                    }

                    return { success: true, data: result };

                } catch (error) {
                    console.error("Error submitting fuel request:", error);
                    const err: DebugLogParams = {
                        contextType: "Fuel - Submit",
                        user: user?.FullName || 'Unkown User',
                        nav: `fuelrequest.submit`,
                        error: error,
                        details: formData as any,
                        tripOE: formData.Orderentryref,
                    }
                    logDebug(err)
                    return { success: false, data: null };
                }
            },
            checkSuccess: (result: { success: boolean; data: any }) => result.success,
            onSuccess: (result) => {
                // console.log('fct2 changelog: ', result);
                let changelogData: Changelog2 = {
                    Title: result.data.Orderentryref || '',
                    Name: user?.FullName || 'Unknown User',
                    Ts: new Date().toISOString(),
                    Status: isCreate ? result.data.Frstatus : 'Re-Submit',
                    Fctid: result.data.Id || '' // use attachment ID dito
                }

                // console.log('fct2 to log: ', changelogData);
                //update change log
                ewulCreate('FCT_Reporting', 'Changelog2', changelogData);
            },
            onFailure: () => { null },
            message: `Submitting fuel request for OE ${formData.Orderentryref}...`,
            message_success: `Fuel request for OE ${formData.Orderentryref} submitted successfully.`,
            message_failure: `Failed to submit fuel request for OE ${formData.Orderentryref}.`,
        });

    };



    // State for Change Trip Modal
    const [showChangeTripModal, setShowChangeTripModal] = useState<{
        show: boolean;
        record: LiveDMSView_CEM;
        action: 'Divert' | 'Change';
        configChange: any[];
    } | null>(null);
    const [selectedChangeTripOE, setSelectedChangeTripOE] = useState<any | null>(null);

    const handleRequestChangeTrip = (tripData: any, action: 'Divert' | 'Change') => {
        let originalOESource = tripData?.Source || '';
        setSelectedChangeTripOE(null); // Reset selected OE when opening modal
        // Sync the modal's date range filter with the main picked date
        if (selectedRange) {
            setSelectedRangeNewOrders(selectedRange);
        }
        setShowChangeTripModal({ show: true, record: tripData, action, configChange: changeConfig(originalOESource) });
        // console.log("trip data: ", tripData);
        fetchNewOrders(); // Refresh orders to get the latest OEs for selection
    };

    const buFilter = (col: string) => {
        return ['Coor', 'Supervisor'].includes(user?.Position || '') ? `and ${enc(col)} eq '${user?.BusinessUnit}'` : ''
    };

    const fetchTrips = useCallback(async (nocd: boolean = false) => {
        if (!selectedRange) return;
        if (!nocd && trips.length > 0) null; //if (!canFetch(FETCH_LOADING_KEYS.trips)) return;
        console.log("Fetching trips with date range:", selectedRange);


        const fromInt = ISOtoInt(selectedRange.from, true);
        const toInt = ISOtoInt(selectedRange.to, true);
        const dateFilter = `OEDateAsInt2 ge ${fromInt} and OEDateAsInt2 le ${toInt} and TripProgress ne 'PLD Done' ${buFilter('Buisness Unit')}`;
        //const dateFilter2 = `OEDateOffset ge datetime'2026-09-01T10:34:29'`

        setLoadingFor(FETCH_LOADING_KEYS.trips, true);
        try {
            console.log('fetching trips: ')
            const result = await ewulFetchAll<LiveDMSView_CEM>(
                LiveDMSView_CEMService,
                { filter: dateFilter, orderBy: ["OEDateAsInt2 desc"] },
                10000,
                'ID',
            );




            //orderBy: ["OEDateAsInt desc"]

            // Find and log inside the async scope where `result` exists
            const targetRecord = result?.find((record: any) => record.OE === 'SOC26-09-0428');
            console.log('target record: ', targetRecord, 'date filter: ', dateFilter, 'result length: ', result.length);

            // Only update if the result is actually different or exists
            setTrips(result || []);

        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setLoadingFor(FETCH_LOADING_KEYS.trips, false);
        }
    }, [selectedRange]); // ONLY depend on the range

    const LSlist = useMemo(() => {
        const encodedLSKey = enc('Loading Sequence');

        // Filter out 'Done' items since fetchTrips only handles 'PLD Done'
        return trips
            .filter(trip => trip.TripProgress !== 'Done')
            .map(trip => ({
                [encodedLSKey]: trip[encodedLSKey],
                ID: trip.ID,
                OE: trip.OE,
                Source: trip.Source
            }));
    }, [trips]);





    const fetchTruckList = useCallback(async () => {
        if (!canFetch(FETCH_LOADING_KEYS.truckList)) return;
        console.log("Fetching truck list...");

        setLoadingFor(FETCH_LOADING_KEYS.truckList, true);
        try {
            const result = await ewulFetchAll<LiveVehicleAssignmentLIstView>(
                LiveVehicleAssignmentLIstViewService,
                { filter: `(Assignment eq 'VASQUEZ' or Assignment eq 'INTERCITY') ${buFilter('Bu')}` },
                3000
            ) || [];


            setLiveTruckAssignment(result);

            // console.log('tractor: ',result.find((item: any) => item.Head == 'H-1020'));

            const truck_options: DropdownOption[] = result
                .filter((item: any) => item.Head) // Only include if a head exists
                .map((item: any) => {
                    const statusEmoji = GPS_STATUS_EMOJIS[item.GpsStatus] ?? '⚫';

                    return {
                        value: item.Head ?? '',
                        label: item.Head_Full ?? '',
                        subtext: `${statusEmoji} ${item.GpsStatus ?? 'NO GPS'} | ${item.PairedTrailer ?? 'NO BO'} | ${item.OE ?? 'NO TRIP'} |  ${item.TractorJrNumber ? item.TractorJrNumber + ': ' + item.Tractor_JRStatus : 'NO UR '} | ${item.TractorIRID ? item.TractorIRID : 'NO IR'}`,
                        type: 'multi',
                        record: item
                    };
                });

            const trailer_options: DropdownOption[] = result
                .filter((item: any) => item.PairedTrailer) // Only include if a trailer exists
                .map((item: any) => {
                    const statusEmoji = GPS_STATUS_EMOJIS[item.GpsStatus] ?? '⚫';

                    return {
                        value: item.PairedTrailer ?? '',
                        label: item.Trailer_Full ?? '',
                        subtext: `${statusEmoji} ${item.GpsStatus ?? 'NO GPS'} | ${item.Head ?? 'NO HEAD'} | ${item.OE ?? 'NO TRIP'} |  ${item.TrailerJrNumber ? item.TrailerJrNumber + ': ' + item.Trailer_JRStatus : 'NO UR '} | ${item.TrailerIRID ? item.TrailerIRID : 'NO IR'}`,
                        type: 'multi',
                        record: item // Store the original record for later use when an option is selected
                    }
                });

            const dummyOption: DropdownOption = {
                value: 'Apple',
                label: 'Apple',
                type: 'multi',
                subtext: 'TESTING',
                record: { Head: 'Apple', PairedTrailer: 'Berry', PlateNo: '4Px2L3', TPlateNo: 'TAppl3-0' }
            };

            // 3. Update dropdown states
            const prefix = user?.Position === 'Developer' ? [dummyOption] : [];
            setTruckOptions([...prefix, ...truck_options]);
            setTrailerOptions([...prefix, ...trailer_options]);

        } catch (err) {
            console.error("Truck List Fetch Error:", err);
        } finally {
            setLoadingFor(FETCH_LOADING_KEYS.truckList, false);
        }
    }, [activeView, sidebarVisible]);

    const handleUpdateTruckTrailerOptions = (item: any) => {

        const result = livetruckassignment.map((oldItem) =>
            oldItem.Id === item.Id ? { ...oldItem, ...item } : oldItem
        );

        setLiveTruckAssignment(result);

        const truck_options: DropdownOption[] = result
            .filter((item: any) => item.Head) // Only include if a head exists
            .map((item: any) => {
                const statusEmoji = GPS_STATUS_EMOJIS[item.GpsStatus] ?? '⚫';

                return {
                    value: item.Head ?? '',
                    label: item.Head_Full ?? '',
                    subtext: `${statusEmoji} ${item.GpsStatus ?? 'NO GPS'} | ${item.PairedTrailer ?? 'NO BO'} | ${item.OE ?? 'NO TRIP'} |  ${item.TractorJRNumber ? item.TractorJRNumber + ': ' + item.Tractor_JRStatus : 'NO UR '} | ${item.TractorIRID ? item.TractorIRID : 'NO IR'}`,
                    type: 'multi',
                    record: item
                };
            });

        const trailer_options: DropdownOption[] = result
            .filter((item: any) => item.PairedTrailer) // Only include if a trailer exists
            .map((item: any) => {
                const statusEmoji = GPS_STATUS_EMOJIS[item.GpsStatus] ?? '⚫';

                return {
                    value: item.PairedTrailer ?? '',
                    label: item.Trailer_Full ?? '',
                    subtext: `${statusEmoji} ${item.GpsStatus ?? 'NO GPS'} | ${item.Head ?? 'NO HEAD'} | ${item.OE ?? 'NO TRIP'} |  ${item.TrailerJRNumber ? item.TrailerJRNumber + ': ' + item.Trailer_JRStatus : 'NO UR '} | ${item.TrailerIRID ? item.TrailerIRID : 'NO IR'}`,
                    type: 'multi',
                    record: item // Store the original record for later use when an option is selected
                }
            });

        const dummyOption: DropdownOption = {
            value: 'Apple',
            label: 'Apple',
            type: 'multi',
            subtext: 'TESTING',
            record: { Head: 'Apple', PairedTrailer: 'Berry', PlateNo: '4Px2L3', TPlateNo: 'TAppl3-0' }
        };


        // 3. Update dropdown states
        const prefix = user?.Position === 'Developer' ? [dummyOption] : [];
        setTruckOptions([...prefix, ...truck_options]);
        setTrailerOptions([...prefix, ...trailer_options]);


    };


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

    const dummyOption: DropdownOption[] = [
        {
            value: 'Apple',
            label: 'Apple',
            type: 'multi',
            record: { Id: 'test', FullName: 'Apple', DMS_Attendance: 'PRESENT' }
        },
        {
            value: 'Cherry',
            label: 'Cherry',
            type: 'multi',
            record: { Id: 'test3', FullName: 'Cherry', DMS_Attendance: 'PRESENT' }
        }
    ];

    const dummyOption2: DropdownOption[] = [
        {
            value: 'Berry',
            label: 'Berry',
            type: 'single',
            record: { Id: 'test2', FullName: 'Berry' }
        },
        {
            value: 'Dates',
            label: 'Dates',
            type: 'multi',
            record: { Id: 'test4', FullName: 'Dates', DMS_Attendance: 'PRESENT' }
        }
    ];

    //const [driverOptions, setDriverOptions] = useState<any[]>([]);
    //const [helperOptions, setHelperOptions] = useState<any[]>([]);
    const { driverOptions, helperOptions } = useMemo(() => {
        const { drivers, helpers } = processPersonnelData(driverHelperList);
        const isDeveloper = user?.Position === 'Developer';

        return {
            driverOptions: isDeveloper ? [...dummyOption, ...drivers] : drivers,
            helperOptions: isDeveloper ? [...dummyOption2, ...helpers] : helpers
        };
    }, [driverHelperList, user?.Position]);



    const fetchDriverHelperList = useCallback(async (nocd: boolean = false) => {
        if (driverOptions.length > 0 && !nocd) if (!canFetch(FETCH_LOADING_KEYS.driverHelperList)) return;
        console.log("Fetching driver and helper list...");
        console.log("wew...");
        try {
            console.log('drivers2: ')
            setLoadingFor(FETCH_LOADING_KEYS.driverHelperList, true);






            const result = await getDriverHelperList(['Coor', 'Supervisor'].includes(user?.Position || '') ? user?.BusinessUnit : undefined);
            setDriverHelperList(result);

            // console.log('dh: ', result.find((item) => item.FullName == 'Baria, Joshua Ordanza'));





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

            const res = await ewulExecute('DISPATCH_APP_DMS', 'GenerateNewTripTicket', {
                OE: OE,
            });


            const table1 = res as any[] | undefined;
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
            const res = await ewulExecute('DISPATCH_APP_DMS', 'GenerateAdditionalOE_ID', {
                Type: type,
            })


            const table1 = res as any[] | undefined;
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
    //@ts-ignore
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
        setSelectedOrder(record);


        //refresh
        generateTripTicketID();
        generateAdditionalOE('Preload');
        generateAdditionalOE('Mobilization');
    };

    const handleSelectCIFMEOrder = (order: any) => {
        setSelectedOrder({ ...selectedOrder, CIFME_OE: order.OE, CIFME_DESTINATION: order.DestiName });
    };

    const [cooldown, setCooldown] = useState<number>(0);
    const clickStreakRef = useRef<number>(0);
    const streakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (cooldown <= 0) return;

        const timer = setInterval(() => {
            setCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [cooldown]);

    // MAIN REFRESH
    const handleRefresh = useCallback(() => {

        fetchTruckList();
        fetchDriverHelperList();
        generateTripTicketID();
        generateAdditionalOE('Preload');
        generateAdditionalOE('Mobilization');
        fetchTrips();
        // fetchLSThisMonth();
        //fetchSourceList();
        fetchFCTRoutes();
        handleGlobalRefresh();

    }, []);

    const TIME_PENALTY = 5;
    const MAX_PENALTY = 30;
    const handleRefreshWithCooldown = async () => {
        // 1. Guard against clicking during active cooldown
        if (cooldown > 0 || isAnythingLoading()) {
            // If their streak is greater than 1, they are suffering from a spam penalty
            if (clickStreakRef.current > 1) {
                setBannerMessage(`You are clicking too fast! Please wait ${cooldown} sec/s for cooling down.`);
            } else {
                setBannerMessage(`Please wait ${cooldown} sec/s while we fetch data for you.`);
            }

            setTimeout(() => {
                setBannerMessage(null);
            }, 4000);
            return;
        }

        // 2. Clear any existing timeout that resets the spam streak
        if (streakTimeoutRef.current) clearTimeout(streakTimeoutRef.current);

        // 3. Increment the click streak tracking spam
        clickStreakRef.current += 1;

        // 4. Calculate dynamic cooldown: Base 3s + 5s extra per streak level beyond the first click
        const baseCooldown = 3;
        const penalty = (clickStreakRef.current - 1) * TIME_PENALTY; // <-- CHANGED TO +5 SECONDS
        const totalCooldown = baseCooldown + penalty;

        // 5. Trigger your actual refresh logic
        await handleRefresh();

        // 6. Lock the button
        setCooldown(totalCooldown);

        /* --- THE DYNAMIC TRAP WINDOW --- */
        // Base trap window is 8s, adding 5s per extra streak level, capping it at 15s max (15000ms)
        const baseTrapWindowMs = 8000;
        const trapPenaltyMs = (clickStreakRef.current - 1) * (TIME_PENALTY * 1000); // Scales up cleanly with your penalty
        const dynamicTrapWindow = Math.min(baseTrapWindowMs + trapPenaltyMs, (MAX_PENALTY * 1000));

        // 7. Reset the streak if they manage to stay cool for the duration of the dynamic window
        streakTimeoutRef.current = setTimeout(() => {
            clickStreakRef.current = 0;
        }, dynamicTrapWindow);
    };

    useEffect(() => {
        handleRefresh();
    }, [handleRefresh]);


    // Scheduled refresh every 60 seconds
    useEffect(() => {
        const intervalId = setInterval(() => {
            console.log("Performing scheduled refresh...");
            handleRefresh();
        }, 60000 * 2); // 60 seconds

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


    const [tableFilters, setTableFilters] = useState<Record<string, any>>({});
    const encodeColumnName = (name: string): string => {
        return name.replace(/[^a-zA-Z0-9_]|_(?=[xX])/g, (char) => {
            const hex = char.charCodeAt(0).toString(16).padStart(4, '0');
            return `_x${hex}_`;
        });
    };

    const capitalizeOnlyFirstLetter = (str: string): string => {
        if (!str) return str;

        // 1. Lowercase the entire string first
        const lowercased = str.toLowerCase();

        // 2. Capitalize just the absolute first character of the string
        const processedStr = lowercased.charAt(0).toUpperCase() + lowercased.slice(1);
        console.log(processedStr)
        // 3. Split by words to find and replace any variant of "fb" with "FB"
        return processedStr
            .split(/\s+/)
            .map((word) => {
                // If the word matches "fb" (since we lowercased everything), force it to "FB"
                // We check strip punctuation if FB might be attached to a comma/dash, 
                // but if it's standalone, a simple check works:
                if (word === 'fb') {
                    return 'FB';
                }
                return word;
            })
            .join(' ');
    };

    const handleDonutInteraction = (chartClickData: {
        tripgroup: string | null;
        tripgroup_total: number | null;
        tripprogress: string | null;
        tripprogress_count: number | null;
    }) => {
        if (!chartClickData) return;

        const encodedTripGroupKey = encodeColumnName("_tripGroup");
        const encodedProgressKey = encodeColumnName("TripProgress");

        setTableFilters(prevFilters => {
            const nextFilters = { ...prevFilters };

            // If tripgroup is null, completely purge both filters to reset back to default
            if (chartClickData.tripgroup === null) {
                delete nextFilters[encodedTripGroupKey];
                delete nextFilters[encodedProgressKey];
                return nextFilters;
            }

            // Otherwise, carry out normal resolution & filter adjustments
            const matchedGroup = TRIP_GROUPS.find(
                group => group.id === chartClickData.tripgroup || group.label === chartClickData.tripgroup
            );

            const rawLabelValue = matchedGroup ? matchedGroup.label : chartClickData.tripgroup;
            const formattedLabelValue = capitalizeOnlyFirstLetter(rawLabelValue);

            if (formattedLabelValue) {
                nextFilters[encodedTripGroupKey] = [formattedLabelValue];
            } else {
                delete nextFilters[encodedTripGroupKey];
            }

            if (chartClickData.tripprogress) {
                nextFilters[encodedProgressKey] = [chartClickData.tripprogress];
            } else {
                delete nextFilters[encodedProgressKey];
            }

            return nextFilters;
        });
    };

    const liveTripsTableConfig = useMemo(() => {
        if (!LIVE_DMS_TABLE_CONFIG?.table_config) return [];

        return LIVE_DMS_TABLE_CONFIG.table_config.map((column: ColumnConfig) => {
            const encodedKey = encodeColumnName(column.col);

            // 1. Priority: Apply filter selections coming from tableFilters (e.g., chart selections)
            if (tableFilters[encodedKey]) {
                return {
                    ...column,
                    filter: {
                        ...column.filter,
                        type: column.filter?.type || "dropdown-multiple",
                        default: tableFilters[encodedKey]
                    }
                };
            }

            // 2. Fallback: Default "Buisness Unit" filter to user's BusinessUnit only if user is a Coordinator ('Coor')
            if ((column.col === "Buisness Unit" || column.col === "Buisness_x0020_Unit") && user?.BusinessUnit && user?.Position === 'Coor') {
                return {
                    ...column,
                    filter: {
                        ...column.filter,
                        type: column.filter?.type || "dropdown-multiple",
                        default: [user.BusinessUnit]
                    }
                };
            }

            // Return a clean structural copy to ensure the component recognizes the reference change
            return { ...column };
        });
    }, [tableFilters, user?.BusinessUnit, user?.Position]); // Added user?.Position to dependencies


    const handleExport = () => {
        console.log("Exporting order data...");
        // Logic for CSV/Excel export would go here
    };

    const [showCIFMETable, setShowCIFMETable] = useState<string | null>(null);
    const renderCIFMETable = (onRowClickLogic: (row: any) => void, soNumber: string, changeConfig: ColumnConfig[] = NEW_TRIPS_UNFILTERED_TABLE_CONFIG.table_config) => {
        console.log(soNumber);

        return (
            <TableView
                data={CIFMEOrders}
                config={changeConfig}
                searchCol={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.searchable_cols as string[]}
                storageKey={`order_page_sap_new_orders${user?.id}`}
                isLoading={loadingList[FETCH_LOADING_KEYS.cifmeOrders] || false}
                showRowCount={500}
                onRefresh={(signal) => signal && fetchCIFMEOrders(showCIFMETable || '')}
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
                accordion={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.accordion}
            />
        );
    };

    const actions = (
        <>
            {/* <span className="bu-label">Business Unit:</span>
            <select 
                className="bu-dropdown-title"
                value={selectedBU}
                onChange={(e) => {
                    setSelectedBU(e.target.value);
                }}
            >
                <option value="">Select BU</option>
                {BUSINESS_UNITS.map((unit) => (
                    <option key={unit.Title} value={unit.Title}>
                        {unit.Title}
                    </option>
                ))}
            </select> */}
            <button
                className="header-btn primary"
                onClick={() => null}
                style={{ minWidth: 90 }}
            >
                Fuel PO Tracking
            </button>
            <button
                className="header-btn secondary cancellation"
                onClick={() => null}
                style={{ minWidth: 90 }}
            >
                Cancellation Requests
            </button>
            <button
                className="header-btn secondary"
                onClick={() => setShowCharts(prev => !prev)}
                style={{ minWidth: 110 }}
            >
                {showCharts ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>{showCharts ? 'Hide Trip Groups' : 'Show Trip Groups'}</span>
            </button>
            {/* <button
                className="header-btn primary"
                onClick={() => setShowNewTripModal(true)}
                style={{ minWidth: 90 }}
            >
                + New Trip
            </button> */}
            {/* <button className="header-btn secondary preload" onClick={() => { handleAdditionalOEGeneration("Preload"); setActiveView('form'); setSidebarVisible(true); }} style={{ minWidth: 90 }}>Preload</button>
            <button className="header-btn secondary mobilization" onClick={() => { handleAdditionalOEGeneration("Mobilization"); setActiveView('form'); setSidebarVisible(true); }} style={{ minWidth: 120 }}>Mobilization</button> */}
            {/*<button className="header-btn secondary" onClick={() => {setShowFuelRequestModal(true); fetchFuelRequests(true);}}>
                <Fuel size={16} />
                <span>Fuel Requests</span>
            </button>*/}
            <DateRangePicker
                allowedTypes={['Today', 'Yesterday', 'Last Week', 'Weekly', 'Monthly'/*, 'Yearly'*/, 'Custom']}
                initialType={(selectedRange?.type as DateRangeType) || 'Monthly'}
                initialFrom={selectedRange?.from}
                initialTo={selectedRange?.to}
                onFilterChange={(range) => { handleDateChange(range); }}
                opacity={0.2}
                bgColor='var(--color-primary)'
                hoverColor='var(--color-primary)'
            />
            <button className="header-btn secondary" onClick={handleExport}>
                <Download size={16} />
                <span>Export CSV</span>
            </button>
            <button
                className={`header-btn primary`}
                onClick={handleRefreshWithCooldown}
            // disabled={cooldown > 0}
            >
                <RefreshCcw size={16} className={`${cooldown > 0 ? 'spinning' : ''}`} />
                <span>
                    {cooldown > 0 ? `Wait ${cooldown}s...` : 'Refresh'}
                </span>
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
                    // setActiveView('dashboard');
                    setSidebarVisible(false);
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
            onClearSelectedTrip={() => { setSelectedOrder(null); setPreviewTrip({}); }}
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
            onRefreshTrips={() => { fetchTrips(true); }}
            onRefreshDriverHelpers={() => { fetchDriverHelperList(true) }}
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
            onUpdateTruckTrailers={handleUpdateTruckTrailerOptions}
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
            onRequestChangeTrip={(tripData, action) => {
                handleRequestChangeTrip(tripData, action); /*handle change trip*/
            }}
            onCIFMESelect={(son) => { fetchCIFMEOrders(son); setShowCIFMETable(son); }}

            truckOptions={truckOptions}
            trailerOptions={trailerOptions}
            driverOptions={driverOptions}
            helperOptions={helperOptions}
            sourceOptions={sourceOptions}

            lsList={LSlist}
            driverHelperList={driverHelperList}

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
                col: "Source", alias: "Source", portion: 1.5,
                filter: {
                    type: "dropdown-multiple",
                    options: [{ label: originalOESource, value: originalOESource }],
                    default: originalOESource ? [originalOESource] : [],
                }
            },
            {
                col: "cementType", alias: "Type", portion: 1,
                filter: {
                    type: "dropdown-multiple",
                    options: cementTypeOptions,
                    default: currentOrderData.cementType ? [currentOrderData.cementType] : [],
                }
            },
            {
                col: "TripProgress",
                alias: "Progress",
                filter: {
                    type: "dropdown-multiple",
                    options: [...TRIP_PROGRESS.map(item => ({ value: item.Progress, label: item.label })), { value: 'Verified', label: 'Verified' }],
                    default: ['Assigned'],
                    useCalculatedValue: true
                },
                cellStyle: (row: any) => {
                    let font_color: React.CSSProperties = { color: '#666' };
                    font_color = TRIP_PROGRESS.find(item => item.Progress === row["TripProgress"])?.color ? { color: TRIP_PROGRESS.find(item => item.Progress === row["TripProgress"])!.color } : font_color;
                    if (row.TripProgress === 'Done' && !!row.Verified_x0020_By && !!row.Documented_x0020_Date) font_color = { color: 'var(--progress-newtrip)' };
                    return { textAlign: 'left', fontWeight: 'bold', ...font_color }
                },
                calculate(row) {
                    if (row.TripProgress === 'Done' && !!row.Verified_x0020_By && !!row.Documented_x0020_Date) return 'Verified'
                    return row.TripProgress
                },
            },
        ] as ColumnConfig[];

        // Merge logic: replace by col if exists, else add
        //const base = NEW_TRIPS_UNFILTERED_TABLE_CONFIG.table_config;
        const base = LIVE_DMS_TABLE_CONFIG.table_config;
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
            // <TableView
            //     data={orders}
            //     config={changeConfig}
            //     searchCol={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.searchable_cols as string[]}
            //     storageKey={`order_page_sap_new_orders${user?.id}`}
            //     isLoading={loadingList[FETCH_LOADING_KEYS.newOrders] || false}
            //     showRowCount={500}
            //     onRefresh={(signal) => signal && fetchNewOrders()}
            //     overflowY={true}
            //     maxHeight={600}
            //     colMinWidth={120}
            //     onRowClick={onRowClickLogic}
            //     theme="var(--color-primary)"
            //     allowMultipleSelection={false}
            //     rowStyle={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.rowStyle}
            //     loadingNoPreventAction={true}
            //     showNumbering={true}
            //     highlightSelected={true}
            //     scrollTo={scrollToNewTrips}
            // />
            <TableView
                data={
                    displayData.filter((item: any) =>
                        ["Assigned", "Planned"].includes(item.TripProgress) &&
                        !["Preload", "Mobilization"].includes(item._tripGroup) &&
                        (item.Driver === null || item.Driver === undefined) &&
                        (item.Helper === null || item.Helper === undefined)
                    )
                }
                config={changeConfig}
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
                onRowClick={onRowClickLogic}
                accordion={LIVE_DMS_TABLE_CONFIG.accordion}
            />
        );
    };




    //////
    const [selectChangeTripError, setSelectChangeTripError] = useState<string | null>(null);
    const onSelectChangeTrip = (raw_record: any) => {
        if (!showChangeTripModal) return;

        const isDev = user?.Position === 'Developer';
        const original = showChangeTripModal.record;
        let errorMessage: string | null = null;

        // 1. Define Validation Rules
        if (["Tagged", "Completed"].includes(raw_record.SAPStatus)) {
            errorMessage = isDev ? null : `This Trip is already ${raw_record.SAPStatus.toLowerCase()}.`;
        }
        else if (!["Assigned", 'Planned'].includes(raw_record.TripProgress) && !(raw_record._tripGroup == 'Preload' && raw_record.SAPStatus === 'Manual' && original._tripGroup === 'Preload')) {
            errorMessage = "Only ASSIGNED trips can be selected.";
        }
        else if (raw_record.Source !== original.Source) {
            errorMessage = isDev ? null : "Source does not match the original trip. Please select a trip with the same source.";
        }
        else if (
            raw_record._tripGroup !== original._tripGroup &&
            !['Preload', 'Mobilization'].includes(original?._tripGroup || '')
        ) {
            errorMessage = isDev ? null : "Trip group does not match. Please select a trip with the same trip group.";
        }
        else if (raw_record.cementType !== original.cementType) {
            errorMessage = isDev ? null : "Cement type does not match. Please select a trip with the same cement type.";
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
            const { oe } = event.detail;
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
        const isselectedrecordvalid = /*await formRef.current?.runValidation(record)*/ { isValid: true }; // For now, we'll assume it's valid. You can implement this function to validate the record before selecting it.
        const highlight = isselectedrecordvalid?.isValid ? 'success' : 'danger';
        const selectrecord = () => {
            setSelectedOrder({
                ...record,
                QTYDelivered_Actual: record.TripProgress === 'Done'
                    ? (record.QTYDelivered_Actual ?? record.QTYDelivered ?? 0)
                    : (record.QTYDelivered_Actual ?? 0),

                QTYWithdrawn_Actual: record.TripProgress === 'Done'
                    ? (record.QTYWithdrawn_Actual ?? record.QTYWithdrawn ?? 0)
                    : (record.QTYWithdrawn_Actual ?? 0),
            });
            handleChangeActiveView('form');
            setShowNewTripModal(false);
            setSidebarVisible(true);
            setScrollTo({
                search_col: 'OE',
                key: record.OE as any,
                highlight: highlight,
            });
        };

        if (selectedOrder == undefined) { selectrecord(); return; }

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
            // overflowY={true}
            contentHeight='100%'
        >
            <div className="order-management-page">
                {/* Sidebar Toggle Tab */}
                <div
                    title='Open DMS Form/Dashboard'
                    className={`sidebar-toggle-tab ${sidebarVisible ? 'hidden' : ''}`}
                    onClick={() => setSidebarVisible(true)}
                >
                    <Menu size={24} />
                </div>



                <div className='chart-stretch-wrapper' hidden={!showCharts}>
                    <div className="mini-dashboard-stack" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '130px' }}>
                        <div className="chart-container-card">
                            {/* <h4 className="chart-title">Trip Distribution</h4> */}
                            <TripGroup_DonutChart
                                ref={donutChartRef}
                                key={selectedRange?.from || 'initial'}
                                BU={null}
                                fromStr={selectedRange?.from || ""}
                                toStr={selectedRange?.to || ""}
                                onChartClick={handleDonutInteraction}
                                defaultView='simple'
                                orientation='horizontal'
                                highlight={null}
                                showScrollX={false}
                                showScrollY={true}
                                defaultFilterOptions={{
                                    done: false // Starts unchecked
                                }}
                            />
                        </div>
                    </div>
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
                            display: !sidebarVisible && isMobile ? 'none' : 'flex'
                        }}
                        aria-hidden={!sidebarVisible}
                    >
                        {/* FLOATING ACTION UTILITIES */}
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

                        {/* CONTENT AREA */}
                        <div className="utility-content animate-fade-in">
                            <div className="order-form-compact">
                                {renderOrderForm(false)}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE: Trips Table */}
                    <div className={`table-main-area animate-table${sidebarVisible ? ' table-in' : ' table-out'}`}>
                        <TableView
                            data={displayData}
                            config={liveTripsTableConfig as ColumnConfig[]}
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
                                console.log('recordsss: ', record)
                                handleTripsTableOnClick(record);
                            }}
                            accordion={LIVE_DMS_TABLE_CONFIG.accordion}
                        />
                    </div>

                    {/* Fuel Request Modal */}
                    {showFuelRequestModal && (
                        <Modal
                            onClose={() => { setShowFuelRequestModal(null); }}
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
                                <div className="fuel-modal-body" style={{ padding: 0 }}>
                                    <FuelRequestManager
                                        truckOE={(showFuelRequestModal?.tractor || '') + (showFuelRequestModal?.subtitle || '')}
                                        fuelRequests={fuelRequests}
                                        lastFuelRequestOE={lastFuelReqOE}
                                        vehicleLists={livetruckassignment}
                                        tableConfig={FUEL_REQUESTS_TABLE_CONFIG.table_config as ColumnConfig[]}
                                        storageKey={`fuel_requests_${localUser?.id}`}
                                        searchableCols={FUEL_REQUESTS_TABLE_CONFIG.searchable_cols as string[]}
                                        isLoading={/*loadingList[FETCH_LOADING_KEYS.fuelRequests] || false*/ frLoading}
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

                                                Odometer: lastOdometer || '',

                                                Frstatus: 'New',

                                                CreatedBy: localUser?.FullName || '',
                                                Created: formatToLocalISO(new Date().toISOString()),
                                                Businessunit: 'SBUO-1A',
                                                Requestedby: localUser?.FullName || '',

                                                Karga: showFuelRequestModal.data?.QTYWithdrawn || '',

                                                Ts1: formatToLocalISO(new Date().toISOString()),

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
                            onClose={() => { setShowChangeTripModal(null); setScrollToNewTrips(null); }}
                            width={'90%'}
                            height={'90vh'}
                            contentStyle={{ paddingBottom: "0px" }}
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
                                            const originalID = selectedChangeTripOE.ID.toString()
                                            const changedTripRecord =
                                            {
                                                OE: selectedChangeTripOE.OE,
                                                Source: selectedChangeTripOE.Source,
                                                Destination: selectedChangeTripOE.Destination,
                                                Customer: selectedChangeTripOE.Customer,
                                                Ordered_x0020_Date: selectedChangeTripOE.OrderedDate,
                                                Needed_x0020_Date: selectedChangeTripOE.NeededDate,
                                                OE_x0020_Date: selectedChangeTripOE.OE_x0020_Date,
                                                _tripGroup: selectedChangeTripOE._tripGroup,
                                            }

                                            setSelectedOrder({ ...selectedOrder, ...changedTripRecord });
                                            setShowChangeTripModal(null);

                                            addTask({
                                                name: `${showChangeTripModal.action} trip ${selectedChangeTripOE.OE}`,
                                                execute: async () => {
                                                    try {

                                                        const checkResult = await ewulFetchAll<LiveDMSView_CEM>(
                                                            LiveDMSView_CEMService,
                                                            { filter: `OE eq '${selectedChangeTripOE.OE}'`, orderBy: ["OEDateAsInt asc"] },
                                                            1,
                                                            'ID'
                                                        );

                                                        console.log('check change trip: ', checkResult, ' with fikter: ', `OE eq '${selectedChangeTripOE.OE}'`);

                                                        // 1. Verify a record was actually returned
                                                        if (!checkResult || checkResult.length === 0) {
                                                            throw new Error(`OE ${selectedChangeTripOE.OE} not found in the DMS.`);
                                                        }

                                                        const targetRecord = checkResult[0];

                                                        // console.log('targetRecord: ', targetRecord.Driver, ' record: ', targetRecord);

                                                        // 2. Throw explicit Error when validation fails
                                                        if (targetRecord.Driver || targetRecord.Helper) {
                                                            throw new Error(`OE ${selectedChangeTripOE.OE} already has a driver or helper assigned.`);
                                                        }

                                                        const result = await ewulUpdate('DISPATCH_APP_DMS', 'DMS_CEM',
                                                            showChangeTripModal.record.ID.toString(),
                                                            changedTripRecord
                                                        )


                                                        await ewulDelete('DISPATCH_APP_DMS', 'DMS_CEM', originalID)


                                                        const result2 = await ewulUpdate('DISPATCH_APP_DMS', 'TripTickets',
                                                            showChangeTripModal.record.TripTicketID || '',
                                                            {
                                                                OE: selectedChangeTripOE.OE,
                                                            }
                                                        );

                                                        //change OF of triptask too
                                                        console.log("changing oe of trip task from ", showChangeTripModal.record.OE || '', " to ", selectedChangeTripOE.OE || '');
                                                        ewulExecute('DISPATCH_APP_DMS', 'Usp_ChangeTripTaskTrackerOE', {
                                                            OldOE: showChangeTripModal.record.OE || '',
                                                            NewOE: selectedChangeTripOE.OE || '',
                                                        } as any);

                                                        ewulExecute('DISPATCH_APP_DMS', 'OnFCTDivert', {
                                                            prevOE: showChangeTripModal.record.OE || '',
                                                            newOE: selectedChangeTripOE.OE || ''
                                                        } as any);

                                                        // const result3 = await TripTaskTrackerService.update(
                                                        //     showChangeTripModal.record?.OE,
                                                        //     { OE: selectedChangeTripOE.OE }
                                                        // );

                                                        const assetPairingPayload = formRef.current?.buildPayloadWithOE(selectedChangeTripOE.OE);
                                                        ewulExecute('DISPATCH_APP_DMS', 'Upsert_DispatchedAssetPairing', assetPairingPayload as any);



                                                        if (result.error) {
                                                            throw new Error(result.error.message);
                                                        }
                                                        if (result2.error) {
                                                            throw new Error(result2.error.message);
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
                                                onSuccess: (updatedData) => {
                                                    const data = updatedData.data

                                                    // console.log("Successfully saved trip change. Updating trips state... ",data);
                                                    handleTripsTableOnClick({});
                                                    setTrips(prevTrips => {
                                                        const index = prevTrips.findIndex(t => t.ID === data.ID);
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

                                                    handleRefresh();
                                                },
                                                onFailure: () => { setSelectedOrder(original); handleRefresh(); },

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
                                                    Source: raw_record.Source,
                                                    Destination: raw_record.Destination,
                                                    cementType: raw_record.cementType,
                                                    [enc("Buisness Unit")]: user?.BusinessUnit,
                                                    TripProgress: TRIP_PROGRESS[0].Progress,
                                                    TripTicketID: previewTripTicketID || '',
                                                    Ordered_x0020_Date: raw_record.Ordered_x0020_Date,
                                                    Needed_x0020_Date: raw_record.Needed_x0020_Date
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

                    {/* CIFME Trip Modal */}
                    {showCIFMETable && (
                        <Modal onClose={() => setShowCIFMETable(null)}>
                            <div className="new-order-modal-header">
                                <div>
                                    <h2>Select a CIFME order for {currentOrderData.OE} | {showCIFMETable}</h2>
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
                                                handleSelectCIFMEOrder(raw_record);
                                                console.log("CIFME row clicked:", raw_record);
                                                setShowCIFMETable(null);
                                            };
                                            return renderCIFMETable(onRowClick, showCIFMETable);
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
            </div>
        </PageTemplate>
    );
};

export default OrderManagement;