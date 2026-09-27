import React, { useState, useCallback, useEffect, useRef } from 'react';
//@ts-ignore
import { RefreshCw, Download, ArrowLeft, ArrowBigUp } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import 'react-day-picker/dist/style.css';

// Power apps services
import { LiveDMSView_CEMService } from '../generated/services/LiveDMSView_CEMService';
//@ts-ignore
import { type LiveDMSView_CEM } from '../generated/models/LiveDMSView_CEMModel';


// Global Component imports
import Navbar from '../components/Navbar';
import TripGroup_DonutChart from '../components/tripGroup_DonutChart';
import TripStatus_BarChart from '../components/tripStatus_BarChart';
//@ts-ignore
import TableView from '../components/ewul_TableFlex';
import GSDCMap, { type GSDCMapHandle } from '../components/ewul_Maps';
import DateRangePicker from '../components/ewul_DateRangePicker';


// CSS imports
import './css/FleetDashboard.css';
import '../theme.css';

//truth list
import { BUSINESS_UNITS, SPECIAL_POSITIONS, LIVE_DMS_TABLE_CONFIG, TRIP_GROUPS } from '../truth.config';

// Utilities
import { encodeColumnName as enc } from '../components/ewul_TableFlex';
import { ewulFetchAll } from '../utils/Ewul_GSDC_Utils';
import { useUser } from '../utils/useUser';




const BU_TITLES = ["ALL", ...BUSINESS_UNITS.map(bu => bu.Title)];





const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const mapRef = useRef<GSDCMapHandle>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // 1. ALL HOOKS MUST BE AT THE TOP
  const { user, updateUser } = useUser();

  // Initialize Business Unit state
  const [selectedBU, setSelectedBU] = useState(() => {
    const userBU = user?.BusinessUnit || "*";
    if (userBU && BU_TITLES.includes(userBU)) {
      return userBU;
    }
    return BU_TITLES[0];
  });

  const [showDetails, setShowDetails] = useState(false);
  //@ts-ignore
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any[]>([]);
  const [detailTitle, setDetailTitle] = useState("");
  //@ts-ignore
  const [isLoading, _setLoading] = useState(false);
  const [_tablerefreshSignal, setTableRefreshSignal] = useState(false);
  //@ts-ignore
  const [scrollToTable, setScrollToTable] = useState<number>(0);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [_showCalendar, _setShowCalendar] = useState(false);

  const [dateRange, setDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const { from, to } = dateRange;

  const initialTableConfig = LIVE_DMS_TABLE_CONFIG.table_config;
  //@ts-ignore
  const [tableConfig, setTableConfig] = useState(initialTableConfig);
  //@ts-ignore
  const searchcols = LIVE_DMS_TABLE_CONFIG.searchable_cols;

  // 2. HELPER FUNCTIONS
  const handleScrollRequest = () => {
    setScrollToTable(Date.now());
  };

  const handleDateChange = useCallback((range: { from: string; to: string }) => {
    setDateRange(range);
  }, []);

  const fetchDetailedTrips = useCallback(async (top: number = 10000, buOverride?: string) => {
    console.log('fetching trips.');
    // Only fetch if user is logged in
    if (!user) return;

    _setLoading(true);
    const dateFilter = `OEDateAsInt ge ${parseInt(from.replace(/-/g, ''), 10)} and OEDateAsInt le ${parseInt(to.replace(/-/g, ''), 10)}`;
    const buToUse = buOverride !== undefined ? buOverride : selectedBU;

    let filterBU = "";
    if (buToUse !== "ALL") {
      filterBU = `${enc("Buisness Unit")} eq '${buToUse}'`;
    }

    let finalFilter = dateFilter;
    if (filterBU) {
      finalFilter = `${filterBU} and ${finalFilter}`;
    }

    try {
      // const options = {
      //   filter: `${enc("Trip Status")} ne 'PLD Served' and (${finalFilter})`,
      //   orderBy: ['OEDateAsInt desc']
      // };

      // const result = await ewulFetchAll<any>(
      //   LiveDMSView_CEMService,
      //   options,
      //   5,  //top,
      //   'ID', 'test', undefined, true
      // );

      const result = await ewulFetchAll<any>(
        LiveDMSView_CEMService,
        { filter: `${enc("Trip Status")} ne 'PLD Served' and ${dateFilter}`, orderBy: ["OEDateAsInt2 desc"] },
        top ? top : 10000,
        'ID',
        "dashboard - live dms"
      );

      // Define your item interface
      interface MapDataItem {
        Vehicle: string;
        OEDateAsInt2: number;
        [key: string]: unknown;
      }

      // Compact approach with explicit Map typing
      const processedResult = Array.from(
        (result as MapDataItem[])
          .reduce((map, item) => {
            const existing = map.get(item.Vehicle);
            if (!existing || item.OEDateAsInt2 > existing.OEDateAsInt2) {
              map.set(item.Vehicle, item);
            }
            return map;
          }, new Map<string, MapDataItem>())
          .values()
      ).sort((a, b) => b.OEDateAsInt2 - a.OEDateAsInt2);
      console.log('fetched trips: ', result.length, result[0])

      if (result && result.length > 0) {
        setFilteredData(result);
        setMapData(processedResult);
      } else {
        setFilteredData([]);
        setMapData([]);
        console.log("No data found!");
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      _setLoading(false);
    }
  }, [from, to, selectedBU, user]);

  const updateTableDefaults = (overrides: Record<string, any[]>) => {
    return LIVE_DMS_TABLE_CONFIG.table_config.map((col) => {
      if (overrides.hasOwnProperty(col.col)) {
        return {
          ...col,
          filter: col.filter ? { ...col.filter, default: overrides[col.col] } : null
        };
      }
      return col;
    });
  };

  const handleDonutInteraction = (event: any) => {
    const transformLabel = (label: string): string => {
      if (!label.includes(' - ')) return label;
      const [prefix, suffix] = label.split(' - ');
      return `${prefix} - ${suffix.toLowerCase()}`;
    };

    const getLabelById = (targetId: string) => {
      const match = TRIP_GROUPS.find(item => item.id === targetId);
      return match ? transformLabel(match.label) : "Unknown Category";
    };

    let selected_tg = getLabelById(event.tripgroup);
    let selected_tp = event.tripprogress;

    setShowDetails(true);
    setDetailTitle(`Group: ${event.tripgroup}`);

    if (selected_tp === null) {
      setTableConfig(updateTableDefaults({ "_tripGroup": [selected_tg], "TripProgress": [] }));
    } else {
      setTableConfig(updateTableDefaults({ "_tripGroup": [selected_tg], "TripProgress": [selected_tp] }));
    }
    handleScrollRequest();
  };

  const handleChartSelection = (data: { status: string; count: number }) => {
    setTableConfig(updateTableDefaults({ "Trip Status": [data.status] }));
    setShowDetails(true);
    setDetailTitle(`Status: ${data.status}`);
    handleScrollRequest();
  };


  //@ts-ignore
  const handleTableRefresh = (signal: boolean) => {
    setTableRefreshSignal(signal);
    if (signal) fetchDetailedTrips();
  };

  const scrollToTop = () => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleManualRefresh = (e: React.MouseEvent<HTMLButtonElement>) => {
    fetchDetailedTrips();
    setIsSpinning(true);
    setRefreshKey(prev => prev + 1);
    e.currentTarget.blur();
    setTimeout(() => setIsSpinning(false), 800);
  };

  // 3. ALL EFFECTS
  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    fetchDetailedTrips();
  }, [user, navigate, fetchDetailedTrips]);


  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (showDetails) {
      interval = setInterval(() => fetchDetailedTrips(), 30000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [showDetails, fetchDetailedTrips]);

  useEffect(() => {
    const container = mainScrollRef.current;
    if (!container) return;
    const handleScroll = () => setShowTopBtn(container.scrollTop > 400);
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // 4. THE EARLY RETURN SHIELD
  if (!user) return null;

  // Constants derived from user (safe because of shield above)
  const canChangeBU = SPECIAL_POSITIONS.includes(user.Position as any);

  return (
    <div className="dashboard-wrapper light-theme">
      <Navbar user={user} onNavigate={(path) => updateUser({ CurrentNav: path })} />

      <main className="dashboard-main" ref={mainScrollRef}>
        <div className="dashboard-grid-layout">

          {/* PANEL LEFT (0.5 + 2 Ratio) */}
          <div className="panel-left">
            <div className="panel-content-inner">
              <div className="placeholder-card">
                <h3>Trip Histories / Live Tracking</h3>
                <p>Data Range: {from} to {to}</p>

                {/* GSDC Map */}

                <div className="gsdc-map-container" style={{ flex: 1, minHeight: 0 }}>
                  {true && (<GSDCMap
                    ref={mapRef}
                    data={mapData}
                    latCol="Latitude"
                    lngCol="Longitude"
                    labelCol="Vehicle"
                  />)}
                </div>


              </div>
            </div>
          </div>

          {/* PANEL RIGHT (1.5 Ratio) */}
          <div className="panel-right">

            {/* CONSOLIDATED HEADER: Title + BU + Filters + Refresh */}
            <div className="content-top-bar">
              <div className="top-bar-left">
                <button onClick={() => navigate(-1)} className="content-back-btn">
                  <ArrowLeft size={18} />
                </button>
                <h1 className="page-main-title">
                  FLEET ANALYTICS
                  <span className="accent-slash"> / </span>
                  {canChangeBU ? (
                    /* EDITABLE MODE: Show the Dropdown */
                    <select
                      className="bu-dropdown-title"
                      value={selectedBU}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setSelectedBU(newVal);
                      }}
                    >
                      {BU_TITLES.map((title) => (
                        <option key={title} value={title}>
                          {title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    /* READ-ONLY MODE: Show static text */
                    <span className="bu-display-static">{selectedBU}</span>
                  )}
                </h1>
              </div>

              <div className="top-bar-right">
                <DateRangePicker
                  initialType="Weekly"
                  onFilterChange={handleDateChange}
                  opacity={0}
                  bgColor="transparent"
                  hoverColor='transparent'
                  blur={5}
                />
                <button
                  onClick={handleManualRefresh}
                  className={`content-refresh-btn ${isSpinning ? 'spinning' : ''}`}
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            <div className="panel-right-top">
              <div className="panel-content-inner">
                <div className="analytic-card-full">
                  <div className="card-header-flex">
                    <div>
                      <h3 className="navy-title">Fleet Status Update</h3>
                      <p className="sub-label">
                        Real-time metrics for <strong>{selectedBU || "All Units"}</strong>
                        <span className="date-range-span">
                          {from && to ? ` • ${from} to ${to}` : ""}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="chart-wrapper-main">
                    <TripStatus_BarChart
                      key={refreshKey}
                      BU={selectedBU === "ALL" ? BUSINESS_UNITS.map(unit => unit.Title).join(', ') : selectedBU}
                      fromStr={dateRange.from}
                      toStr={dateRange.to}
                      onBarClick={handleChartSelection}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="panel-right-bottom">
              <TripGroup_DonutChart
                key={refreshKey}
                BU={selectedBU === "ALL" ? null : selectedBU}
                fromStr={dateRange.from}
                toStr={dateRange.to}
                onChartClick={handleDonutInteraction}
                orientation='horizontal'
              />
            </div>
          </div>


        </div>

        {/* TABLE LIST*/}
        {showDetails && (
          <div className="appended-details-section animate-slide-down">
            <div className="details-header-bar">
              <div className="details-title-group">
                <h2 className="navy-title">Detailed View</h2>
                <span className="details-subtitle">{detailTitle}</span>
              </div>
              <button
                className="close-details-btn"
                onClick={() => setShowDetails(false)}
              >
                x
              </button>
            </div>

            <div className="details-body">
              {/*<TableView
                data={filteredData}
                config={tableConfig}
                storageKey={`landing_page2${user?.id}`}
                isLoading={isLoading}
                triggerScroll={scrollToTable}
                searchCol={searchcols}
                overflowY={true}
                overflowX={true}
                loadingNoPreventAction={true}
                onRefresh={handleTableRefresh}
                colMinWidth={60}
                rowStyle={LIVE_DMS_TABLE_CONFIG.rowStyle}
                showNumbering={true}
                maxHeight={600}
              />*/}
            </div>
          </div>
        )}




      </main>
      {/* 
      <footer className="footer-status">
        <p>SYSTEM STATUS: ONLINE | DATA RANGE: {from} TO {to}</p>

        <div className="footer-actions">

          <button className="btn-export" onClick={() => window.print()}>
            <Download size={14} /> EXPORT PDF
          </button>

        </div>

      </footer> */}

      <button
        className={`floating-scroll-btn ${showTopBtn ? 'show-btn' : ''}`}
        onClick={scrollToTop}
        data-tooltip="Scroll to Top"
        aria-label="Scroll to top"
      >
        <ArrowBigUp size={45} strokeWidth={5} />
      </button>

    </div>
  );
};

export default LandingPage;