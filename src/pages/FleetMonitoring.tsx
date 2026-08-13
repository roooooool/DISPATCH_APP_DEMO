import React, { useState, useEffect, useRef } from 'react';
// import Modal from '../components/ewul_Modal';
import AttendanceSheet from '../components/ewul_AttendanceSheet';
import PageTemplate from './template';
import GSDCMap, { type GSDCMapHandle, type HighlightConfig } from '../components/ewul_Maps';
import { Calendar, Fuel, Settings, FileDown, MapIcon, RefreshCw, MapPin, Lock, Unlock, TruckIcon, Map, Fullscreen } from 'lucide-react';
import './css/FleetMonitoring.css';
import { GlobalFleetModal } from '../truth_react_helper';
import { MapTruckEmptyIcon, MapTruckDoneIcon, MapTruckLoadedIcon, MapTruckLoadingIcon, MapTruckRepairIcon, MapTruckUnloadingIcon, MapTruckWaitingIcon, MapTruckNoTripIcon } from '../components/ewul_Icons';


// Power apps services
import { Vw_LiveDMS_TruckDriverHelper_PairingService } from '../generated/services/Vw_LiveDMS_TruckDriverHelper_PairingService';


// Ewul Components
import TableView, { encodeColumnName as enc, type scrollToConfig } from '../components/ewul_TableFlex';
import FuelRequestManager from '../components/FuelRequestManager';
import FleetPairManager from '../components/FleetPairManager';
import { InfoCardGallery } from '../components/ewul_CardGallery';
import { PAIRING_LIST_TABLE_CONFIG, cardFields, BUSINESS_UNITS, FETCH_LOADING_KEYS, GPS_STATUS_COLOR, FUEL_REQUESTS_TABLE_CONFIG } from '../truth.config';
import { useUser } from '../utils/useUser';
import { useTaskWorker } from '../utils/TaskWorkerContext';
import {
    ewulFetchAll,
    ewul_canFetch,
    ewul_isAnythingLoading,
    ewul_setLoadingFor,
    ewul_loadingList,
} from '../utils/Ewul_GSDC_Utils';







const FleetMonitoring: React.FC = () => {


    const { user, updateUser } = useUser();
    const { addTask } = useTaskWorker();

    const [tableExpanded, _setTableExpanded] = useState(true);
    const [pairingData, setPairingData] = useState<any[]>([]);
    const [fuelRequests, setFuelRequests] = useState<any[]>([]);
    //const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState<null | 'attendance' | 'fuel' | 'fleet' | 'export'>(() => {
        return (user?.lastActiveModule as any) || null;
    });
    /*const [selectedBU, setSelectedBU] = useState(() => {
        const user = localStorage.getItem("gsdc_user");
        if (user) {
            const parsed = JSON.parse(user);
            return parsed.BusinessUnit || BUSINESS_UNITS[0].Title;
        }
        return BUSINESS_UNITS[0].Title;
    });*/
    const [selectedBU, setSelectedBU] = useState(['Coor'].includes(user?.Position || '') ? user?.BusinessUnit : null);
    const [viewMode, _setViewMode] = useState<'table' | 'gallery'>('table');

    const mapRef = useRef<GSDCMapHandle>(null);

    const [highlightedUnit, setHighlightedUnit] = useState<HighlightConfig | null>(null); // For fleet management modal
    const [isolateHighlighted, setIsolateHighlighted] = useState(false);

    const [scrollTo, setScrollTo] = useState<scrollToConfig | null>(null);
    const [mapScrollLocked, setMapScrollLocked] = useState(false);

    const fetchFuelRequests = async () => {
        // Placeholder: This should be implemented to fetch all recent fuel requests
        // For now, it will just show a loading state and then an empty array.
        ewul_setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, true);
        console.log("Fetching all fuel requests...");
        try {
            // TODO: Replace with a real API call, e.g., ewulFetchAll(Live_LatestFuelRequestsService, ...)
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
            setFuelRequests([]); // Set to empty or fetched data
        } catch (error) {
            console.error("Error fetching fuel requests:", error);
            setFuelRequests([]);
        } finally {
            ewul_setLoadingFor(FETCH_LOADING_KEYS.fuelRequests, false);
        }
    };

    const generatePairingId = (row: any): string => {
        const truck = String(row.Truck || '').trim();
        const trailer = String(row.Trailer || '').trim();
        const driver = String(row.Driver || '').trim();
        const helper = String(row.Helper || '').trim();

        // Join with a separator to ensure unique string patterns
        return `${truck}-${trailer}-${driver}-${helper}`;
    };


    // Data fetch logic extracted for refresh
    const fetchPairingData = async () => {
        if (pairingData.length > 0 && (!ewul_loadingList[FETCH_LOADING_KEYS.fleetPairing]) || false) if (!ewul_canFetch(FETCH_LOADING_KEYS.fleetPairing)) return;
        ewul_setLoadingFor(FETCH_LOADING_KEYS.fleetPairing, true);
        console.log("Fetching fleet pairing data...");
        try {
            // 1. Await the result. 'result' is now the actual array
            const result = await ewulFetchAll<any>(
                Vw_LiveDMS_TruckDriverHelper_PairingService,
                { filter: '' },
                10000,
                //'ID'
            );

            // 2. Access data directly. No .then() needed
            const rawData = result || [];
            // console.log("Raw pairing data fetched:", rawData);

            const getWeight = (row: any) => {
                let weight = 0;
                if (row.Driver && String(row.Driver).trim() !== "") weight += 8;
                if (row.Helper && String(row.Helper).trim() !== "") weight += 4;
                if (row.Truck && String(row.Truck).trim() !== "") weight += 2;
                if (row.Trailer && String(row.Trailer).trim() !== "") weight += 1;
                return weight;
            };

            const processedData = rawData.map((row: any) => ({
                ...row,
                _sort: getWeight(row),
                _id: generatePairingId(row)
            }));

            processedData.sort((a, b) => {
                if (b._sort !== a._sort) return b._sort - a._sort;
                const avs = [a.Driver, a.Helper, a.Truck, a.Trailer].map(x => (x || "").toString().toLowerCase());
                const bvs = [b.Driver, b.Helper, b.Truck, b.Trailer].map(x => (x || "").toString().toLowerCase());
                for (let i = 0; i < avs.length; i++) {
                    if (avs[i] < bvs[i]) return -1;
                    if (avs[i] > bvs[i]) return 1;
                }
                return 0;
            });

            setPairingData(processedData);

        } catch (error) {
            console.error("Error fetching pairing data:", error);
        } finally {
            ewul_setLoadingFor(FETCH_LOADING_KEYS.fleetPairing, false);
        }
    };

    useEffect(() => {
        fetchPairingData();
        const interval = setInterval(() => {
            fetchPairingData();
        }, 60000); // 30 seconds
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // Add these layout states at the top of your component
    const [isWindowed, setIsWindowed] = useState(false);
    const [windowStyle, setWindowStyle] = useState({
        width: '50vw',
        height: '70vh',
        top: '15vh',
        left: '20px'
    });

    // Dragging and Resizing Ref References
    const windowRef = useRef<HTMLDivElement>(null);
    const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

    // Handle Dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        // Stop behavior if full-screen or if interacting with action buttons
        if (!isWindowed || (e.target as HTMLElement).closest('.header-controls') || (e.target as HTMLElement).closest('button')) return;

        e.preventDefault();

        const element = windowRef.current;
        const parent = element?.parentElement;
        if (!element || !parent) return;

        const rect = element.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();

        // Measure exactly where the mouse cursor is relative to the box borders
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            // Position relative to the parent container bounds
            let nextLeft = moveEvent.clientX - parentRect.left - offsetX;
            let nextTop = moveEvent.clientY - parentRect.top - offsetY;

            // 🟢 Boundary Constraints: Prevent going out of bounds (Left & Top)
            if (nextLeft < 0) nextLeft = 0;
            if (nextTop < 0) nextTop = 0;

            // 🟢 Boundary Constraints: Prevent going out of bounds (Right & Bottom)
            const maxLeft = parentRect.width - rect.width;
            const maxTop = parentRect.height - rect.height;

            if (nextLeft > maxLeft) nextLeft = maxLeft;
            if (nextTop > maxTop) nextTop = maxTop;

            setWindowStyle(prev => ({
                ...prev,
                left: `${nextLeft}px`,
                top: `${nextTop}px`
            }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Handle Manual Border Pull-tab Resizing
    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const rect = windowRef.current?.getBoundingClientRect();
        if (!rect) return;

        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            width: rect.width,
            height: rect.height
        };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - resizeStart.current.x;
            const deltaY = moveEvent.clientY - resizeStart.current.y;

            setWindowStyle(prev => ({
                ...prev,
                width: `${Math.max(400, resizeStart.current.width + deltaX)}px`,
                height: `${Math.max(300, resizeStart.current.height + deltaY)}px`
            }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Toggle window mode and auto-set width/placement values
    const toggleWindowMode = () => {
        setIsWindowed(prev => {
            const nextState = !prev;
            if (nextState) {
                // 🟢 Calculate half screen width and stable height in strict pixels 
                const pixelWidth = Math.floor(window.innerWidth * 0.5);
                const pixelHeight = Math.floor(window.innerHeight * 0.7);

                setWindowStyle({
                    width: `${pixelWidth}px`,
                    height: `${pixelHeight}px`,
                    top: '100px',
                    left: '20px'
                });
            }
            return nextState;
        });
    };



    const changeModule = (targetModule: null | 'attendance' | 'fuel' | 'fleet' | 'export') => {
        setModalOpen(targetModule);
        updateUser({ lastActiveModule: targetModule as string });

        // Handle background async fetch triggers normally 
        if (targetModule === 'fuel') {
            fetchFuelRequests();
        }
    };


    const renderModalContent = () => {
        switch (modalOpen) {
            case 'attendance':
                return (
                    <AttendanceSheet
                        liveTrips={pairingData}
                        colName={['Driver', 'Helper']}
                        colOE={'OE'}
                        colStatus={enc("Trip Status")}
                        BU={selectedBU}
                    />
                );
            case 'fuel':
                return (
                    <FuelRequestManager
                        truckOE={/*selectedPairing?.tractor + ' ' + selectedPairing?.subtitle ||*/ ''}
                        fuelRequests={fuelRequests}
                        vehicleLists={[]}
                        lastFuelRequestOE={''}
                        tableConfig={FUEL_REQUESTS_TABLE_CONFIG.table_config}
                        storageKey={`fuel_requests_fleet_mon_${user?.id}`}
                        searchableCols={FUEL_REQUESTS_TABLE_CONFIG.searchable_cols as string[]}
                        isLoading={ewul_loadingList[FETCH_LOADING_KEYS.fuelRequests] || false}
                        onRefresh={() => fetchFuelRequests()}
                        onFormSubmit={(data) => {
                            console.log("Fuel Request Submitted:", data);
                            // Here you would call your service to save the data
                            setModalOpen(null); // Close modal on submit
                        }}
                        onRowClick={(record) => {
                            console.log("Fuel request row clicked:", record);
                            // The manager will automatically switch to the form with the record's data
                        }}


                        user={user}
                    />
                );

            case 'fleet':
                return (
                    <FleetPairManager
                        initialPairing={/*selectedPairing*/ null}
                        onSave={async (updatedData) => {
                            // 1. Call your API/Service here
                            console.log("Saving to Database:", updatedData);

                            // 2. Refresh your main list
                            // await fetchPairingData(); 

                            // 3. Close modal
                            setModalOpen(null);
                        }}
                        onDelete={(id) => {
                            if (window.confirm("Are you sure you want to break this pairing?")) {
                                console.log("Deleting pair ID:", id);
                                setModalOpen(null);
                            }
                        }}
                    />
                );

            default:
                // This is your fallback for 'fleet', 'export', or any unmatched string
                return (
                    <div style={{ minWidth: 320, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#888', fontSize: 18 }}>Modal for: {modalOpen}</span>
                    </div>
                );
        }
    };

    const handleFocusOnTruck = (lat: number, lng: number) => {
        // 2. Call the externally exposed function
        mapRef.current?.scrollTo(lat, lng, 15, tableExpanded ? '85%' : '75%'); // zoom level 15 for a close-up
    };



    const fetchMapIcon = (key: string, color_fill?: { color?: string, shadow?: string }, isHighlighted?: boolean) => {
        switch (key) {
            case 'No Trip':
                return <MapTruckNoTripIcon
                    size={isHighlighted ? 60 : 50}
                    color={color_fill?.color || "#39FF14"}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    style={{
                        filter: `drop-shadow(${color_fill?.shadow || '0 0 12px rgba(57, 255, 20, 0.6)'})`,
                    }}
                />
            case 'Assigned':
                return <MapTruckWaitingIcon
                    size={isHighlighted ? 60 : 50}
                    color={color_fill?.color || "#39FF14"}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    style={{
                        filter: `drop-shadow(${color_fill?.shadow || '0 0 12px rgba(57, 255, 20, 0.6)'})`,
                    }}
                />
            case 'Dispatched To Source':
                return <MapTruckEmptyIcon
                    size={isHighlighted ? 60 : 50}
                    color={color_fill?.color || "#39FF14"}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    style={{
                        filter: `drop-shadow(${color_fill?.shadow || '0 0 12px rgba(57, 255, 20, 0.6)'})`,
                    }}
                />
            case 'Loading':
                return <MapTruckLoadingIcon
                    size={isHighlighted ? 60 : 50}
                    color={color_fill?.color || "#39FF14"}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    style={{
                        filter: `drop-shadow(${color_fill?.shadow || '0 0 12px rgba(57, 255, 20, 0.6)'})`,
                    }}
                />
            case 'Dispatched To Destination':
                return <MapTruckLoadedIcon
                    size={isHighlighted ? 60 : 50}
                    color={color_fill?.color || "#39FF14"}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    style={{
                        filter: `drop-shadow(${color_fill?.shadow || '0 0 12px rgba(57, 255, 20, 0.6)'})`,
                    }}
                />
            case 'Unloading':
                return <MapTruckUnloadingIcon
                    size={isHighlighted ? 60 : 50}
                    color={color_fill?.color || "#39FF14"}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    style={{
                        filter: `drop-shadow(${color_fill?.shadow || '0 0 12px rgba(57, 255, 20, 0.6)'})`,
                    }}
                />
            case 'Done':
                return <MapTruckDoneIcon
                    size={isHighlighted ? 60 : 50}
                    color={color_fill?.color || "#39FF14"}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    style={{
                        filter: `drop-shadow(${color_fill?.shadow || '0 0 12px rgba(57, 255, 20, 0.6)'})`,
                    }}
                />
            case 'UR':
                return <MapTruckRepairIcon
                    size={isHighlighted ? 60 : 50}
                    color={color_fill?.color || "#39FF14"}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    style={{
                        filter: `drop-shadow(${color_fill?.shadow || '0 0 12px rgba(57, 255, 20, 0.6)'})`,
                    }}
                />
            default:
                return <TruckIcon
                    size={isHighlighted ? 60 : 50}
                    color={color_fill?.color || "#39FF14"}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    style={{
                        filter: `drop-shadow(${color_fill?.shadow || '0 0 12px rgba(57, 255, 20, 0.6)'})`,
                    }}
                />
        }

    };


    return (
        <>
            <PageTemplate
                title="Fleet Monitoring"
                actions={
                    <div className="fleet-actions-bar">
                        <select
                            className="fleet-bu-selector"
                            value={selectedBU || ''}
                            onChange={e => setSelectedBU(e.target.value)}
                        >
                            {BUSINESS_UNITS.map(bu => (
                                <option key={bu.Title} value={bu.Title}>{bu.Title}</option>
                            ))}
                        </select>

                        <button className={`fleet-action-btn ${modalOpen === null ? 'active-highlight' : 'primary-solid'}`} onClick={() => changeModule(null)}>
                            <MapIcon size={14} /> <span>Fleet Monitoring</span>
                        </button>
                        <button className={`fleet-action-btn ${modalOpen === 'attendance' ? 'active-highlight' : 'primary-solid'}`} onClick={() => changeModule('attendance')}>
                            <Calendar size={14} /> <span>Attendance</span>
                        </button>
                        <button className={`fleet-action-btn ${modalOpen === 'fuel' ? 'active-highlight' : 'primary-solid'}`} onClick={() => { changeModule('fuel'); fetchFuelRequests(); }}>
                            <Fuel size={14} /> <span>Fuel Request</span>
                        </button>
                        <button className={`fleet-action-btn ${modalOpen === 'fleet' ? 'active-highlight' : 'primary-solid'}`} onClick={() => changeModule('fleet')}>
                            <Settings size={14} /> <span>Fleet Manage</span>
                        </button>
                        <button className="fleet-action-btn primary-solid" title="Refresh Data" onClick={fetchPairingData} disabled={ewul_isAnythingLoading()}>
                            <RefreshCw size={14} className={ewul_isAnythingLoading() ? 'spin-refresh' : ''} /> <span>Refresh</span>
                        </button>
                        <button className="fleet-action-btn secondary-outline">
                            <FileDown size={14} /> <span>Export CSV</span>
                        </button>
                    </div>
                }
                className="flush-map-page"
                hideFooter={true}
            >
                {modalOpen ?
                    (
                        renderModalContent()
                    )
                    : (
                        <div className="fleet-monitoring-bg">
                            {true && (<GSDCMap
                                ref={mapRef}
                                data={pairingData}
                                latCol="Latitude"
                                lngCol="Longitude"
                                labelCol={enc("Truck")}
                                highlight={highlightedUnit}
                                isolateHighlighted={isolateHighlighted}
                                renderMarker={(record: any, isHighlighted: boolean) => {
                                    //const highlightColor = 'var(--color-yellow)';
                                    const color_fill = GPS_STATUS_COLOR[record[enc("GPS Status")] as keyof typeof GPS_STATUS_COLOR]; // Default to bright green if status is unknown
                                    let key = record[enc("Trip Progress")];
                                    const trip_status = record[enc("Trip Status")];
                                    const trip_progress = record[enc("Trip Progress")];

                                    if (!record.OE) key = 'No Trip';
                                    if (record["JR_Truck"] || record["JR_Trailer"]) key = 'UR';
                                    if (trip_progress === 'Dispatched To Source' && record[enc("Source in")]) key = 'Loading';
                                    if (["LDG"].some(status => status === trip_status)) key = 'Dispatched To Destination';
                                    if (trip_progress === 'Dispatched To Destination' && record[enc("Destination in")]) key = 'Unloading';



                                    return fetchMapIcon(key, color_fill, isHighlighted);

                                }}
                            />)}

                            <div
                                ref={windowRef}
                                className={`fleet-table-gradient-wrapper ${isWindowed ? 'windowed-mode' : 'fullscreen-mode'}`}
                                style={isWindowed ? {
                                    position: 'absolute',
                                    zIndex: 1000,
                                    width: windowStyle.width,
                                    height: windowStyle.height,
                                    top: windowStyle.top,
                                    left: windowStyle.left,
                                } : undefined}
                            >
                                <div className="fleet-floating-table">

                                    {/* Header acts as the dragging handle when windowed */}
                                    <div className="fleet-table-header" onMouseDown={handleMouseDown} style={{ cursor: isWindowed ? 'move' : 'default' }}>
                                        <h3>Live Fleet Status</h3>

                                        <div className="header-controls">
                                            <span style={{ color: 'var(--color-text-2)' }}>Show Pin: </span>
                                            <button
                                                className={`map-action-btn ${isolateHighlighted ? 'primary-solid' : 'secondary-outline'}`}
                                                style={{ marginLeft: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                onClick={() => setIsolateHighlighted(v => !v)}
                                                title={isolateHighlighted ? 'Show All Units on Map' : 'Show Only Highlighted on Map'}
                                            >
                                                <MapPin size={18} style={{ color: 'var(--color-text-2)' }} />
                                                {isolateHighlighted ? " Selected" : " All"}
                                            </button>

                                            <button
                                                className={`map-action-btn ${mapScrollLocked ? 'primary-solid-lock' : 'secondary-outline'}`}
                                                style={{ marginLeft: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                onClick={() => setMapScrollLocked(v => !v)}
                                                title={mapScrollLocked ? 'Unlock Map Auto Scroll' : 'Lock Map Auto Scroll'}
                                            >
                                                {mapScrollLocked ? <Lock size={20} style={{ color: 'var(--color-yellow)' }} /> : <Unlock size={20} style={{ color: 'var(--color-text-2)' }} />}
                                            </button>

                                            {/* <button 
                                    className="view-mode-toggle"
                                    onClick={() => setViewMode(prev => prev === 'table' ? 'gallery' : 'table')}
                                    title={viewMode === 'table' ? "Switch to Gallery View" : "Switch to Table View"}
                                >
                                    {viewMode === 'table' ? <LayoutGrid size={18} /> : <TableProperties size={18} />}
                                </button> */}

                                            {/* Windowed / Fullscreen Mode Toggle replacing old chevron */}
                                            <button
                                                className={`view-mode-toggle ${isWindowed ? 'active-highlight' : ''}`}
                                                onClick={toggleWindowMode}
                                                title={isWindowed ? "Switch to Fullscreen" : "View Live Map"}
                                            >
                                                {isWindowed ? <Fullscreen size={18} style={{ transform: 'rotate(90deg)' }} /> : <Map size={18} style={{ opacity: 1 }} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Dynamic Inner Layout Body */}
                                    <div className="fleet-table-content" style={{ flex: 1, minHeight: 0, height: 'calc(100% - 50px)' }}>
                                        {viewMode === 'table' ? (
                                            <div className="view-transition-in view-wrapper" style={{ height: '100%' }} key="table-view">
                                                <TableView
                                                    data={pairingData}
                                                    config={PAIRING_LIST_TABLE_CONFIG.table_config}
                                                    storageKey={`fleetmon${user?.id}`}
                                                    isLoading={ewul_loadingList[FETCH_LOADING_KEYS.fleetPairing] || false}
                                                    searchCol={PAIRING_LIST_TABLE_CONFIG.searchable_cols}
                                                    rowStyle={PAIRING_LIST_TABLE_CONFIG.rowStyle}
                                                    showRowCount={100}
                                                    overflowX={true}
                                                    overflowY={true}
                                                    colMinWidth={20}
                                                    loadingNoPreventAction={true}
                                                    scrollTo={scrollTo}
                                                    highlightSelected={true}
                                                    onRowClick={(record: any) => {
                                                        const pid = generatePairingId(record);
                                                        setScrollTo({
                                                            search_col: '_id',
                                                            key: pid,
                                                            highlight: 'info',
                                                        });
                                                        !mapScrollLocked ? handleFocusOnTruck(parseFloat(record.Latitude), parseFloat(record.Longitude)) : null;
                                                        const hl = {
                                                            col_key: 'Truck',
                                                            key: record.Truck,
                                                            type: 'info'
                                                        } as HighlightConfig;
                                                        const isdeselecting = highlightedUnit && highlightedUnit.col_key === hl.col_key && highlightedUnit.key === hl.key;
                                                        setHighlightedUnit(isdeselecting ? null : hl);
                                                    }}
                                                    addTask={addTask}
                                                />
                                            </div>
                                        ) : (
                                            <div className="view-transition-in view-wrapper" style={{ height: '100%' }} key="gallery-view">
                                                <InfoCardGallery
                                                    title="Active Fleet"
                                                    data={pairingData}
                                                    fields={cardFields}
                                                    searchFields={['Truck', 'Driver', 'Helper', 'Trailer', 'OE']}
                                                    columns={isWindowed ? 1 : 2} /* Dynamically change layout grid based directly on screen state */
                                                    overflowY='scroll'
                                                    defaultImage='defaultUser'
                                                    sortColumn='_sort'
                                                    loading={ewul_loadingList[FETCH_LOADING_KEYS.fleetPairing] || false}
                                                    cardHeight='200px'
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Drag Resizer corner tab */}
                                    {isWindowed && (
                                        <div
                                            className="window-resize-handle"
                                            onMouseDown={handleResizeMouseDown}
                                            style={{
                                                position: 'absolute',
                                                right: 0,
                                                bottom: 0,
                                                width: '15px',
                                                height: '15px',
                                                cursor: 'se-resize',
                                                background: 'linear-gradient(135deg, transparent 50%, var(--color-primary, #00082d) 50%)',
                                                borderBottomRightRadius: '8px',
                                                zIndex: 1001
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}




            </PageTemplate>
            {/* Modal container for header actions */}
            {/* Simplified Modal Container */}
            {/*modalOpen && (
                <Modal onClose={() => setModalOpen(null)}>
                    {renderModalContent()}
                </Modal>
            )*/}


            <GlobalFleetModal />
        </>
    );
};

export default FleetMonitoring;
