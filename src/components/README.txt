Components in src/components
===========================

This file documents the reusable components located in this folder and shows how to import and use them.

1) TripStatus_BarChart (tripStatus_BarChart.tsx)
- Purpose: Displays a live bar chart of trip counts by status with filter toggles.
- Props:
  - BU: string | null | undefined
  - fromStr: string (YYYY-MM-DD)
  - toStr: string (YYYY-MM-DD)
  - onBarClick?: (data: { status: string; count: number }) => void
- Import example:
  import TripStatus_BarChart from './tripStatus_BarChart';
- Usage:
  <TripStatus_BarChart BU={bu} fromStr={from} toStr={to} onBarClick={(d)=>console.log(d)} />
Notes: Uses TRIP_STATUSES from truth.config and shows/hides counts. Requires CSS in comp_css/tripStatus_BarChart.css.

2) TripGroup_DonutChart (tripGroup_DonutChart.tsx)
- Purpose: Renders a matrix of donut charts for trip groups (Assigned, To Source, To Dest, Done).
- Props:
  - BU: string | null | undefined
  - fromStr: string
  - toStr: string
  - orientation?: 'horizontal' | 'vertical' (default 'horizontal')
  - onChartClick?: (data) => void
- Import example:
  import TripGroup_DonutChart from './tripGroup_DonutChart';
- Usage:
  <TripGroup_DonutChart BU={bu} fromStr={from} toStr={to} onChartClick={(d)=>{}} />
Notes: Uses TRIP_GROUPS and STATUS_COLORS from truth.config. Uses comp_css/tripGroup_DonutChart.css.

3) OrderDistributionForm (OrderDistributionForm.tsx)
- Purpose: Form UI for assigning business unit, OE, loading sequence and remarks for one or multiple orders.
- Props:
  - orderIds: string[] (one or many)
  - initialData?: { oe?: string; ls?: number }
  - onClose: () => void
- Import example:
  import OrderDistributionForm from './OrderDistributionForm';
- Usage:
  <OrderDistributionForm orderIds={[id]} initialData={{oe:'OE123'}} onClose={() => setShow(false)} />
Notes: If orderIds.length > 1 it hides OE/LS inputs (batch mode). Uses comp_css/OrderDistributionForm.css and BUSINESS_UNITS from truth.config.

4) Navbar (Navbar.tsx)
- Purpose: Top navigation bar showing user profile and navigation buttons filtered by position.
- Props:
  - user: { FirstName, LastName, Position, BusinessUnit }
- Import example:
  import Navbar from './Navbar';
- Usage:
  <Navbar user={userObj} />
Notes: Reads/saves gsdc_user in localStorage when navigating. Uses comp_css/Navbar.css and NAV_DESTINATIONS from truth.config.

5) LoadingOverlay_navblue (LoadingOverlay_navblue.tsx)
- Purpose: Reusable loading overlay with animated truck GIF.
- Props:
  - message?: string
  - blur?: number
  - bgColor?: string
  - size?: 'sm' | 'md' | 'lg'
- Import example:
  import LoadingOverlay from './LoadingOverlay_navblue';
- Usage:
  {loading && <LoadingOverlay message="Loading..." size="md" />}
Notes: CSS in comp_css/LoadingOverlay.css. Image asset in public/animated.

6) imgHighlights / ImageCarousel (imgHighlights.tsx)
- Purpose: Simple scrolling image carousel that loads images from public/images/scroll_highlights.
- Props:
  - images?: string[] (optional override)
- Import example:
  import ImageCarousel from './imgHighlights';
- Usage:
  <ImageCarousel />
Notes: Uses Vite's import.meta.glob to eager-load images. Styles in comp_css/* as needed.

7) ewul_TableFlex / TableView (ewul_TableFlex.tsx)
- Purpose: Powerful, configurable table with sorting, filtering, resizing, drag reorder, selection and theming.
- Props (selected):
  - data: any[]
  - config: ColumnConfig[] (see file for ColumnConfig, FilterConfig types)
  - isLoading?: boolean
  - onRowClick?: (record) => void
  - onSelectionChange?: (selectedRecords) => void
  - theme?: string (CSS color)
  - tableMinHeight?: number | string
- Import example:
  import TableView from './ewul_TableFlex';
- Usage (basic):
  <TableView data={rows} config={cols} isLoading={loading} onRowClick={(r)=>console.log(r)} />
Notes: Complex API — inspect ColumnConfig and FilterConfig types at top of file for filters, calculate, cellStyle and custom callbacks. Styles: comp_css/ewul_TableFlex.css.

8) ewul_ProtectedRoute (ewul_ProtectedRoute.tsx)
- Purpose: Route guard that redirects to /login if gsdc_user missing in localStorage.
- Props:
  - children: ReactElement
- Import example:
  import ProtectedRoute from './ewul_ProtectedRoute';
- Usage:
  <ProtectedRoute><MyPage /></ProtectedRoute>
Notes: Preserves attempted URL in state.from for post-login redirect.

9) ewul_Maps / GSDCMap (ewul_Maps.tsx)
- Purpose: Map component (maplibre) rendering markers with popups and exposing imperative scrollTo method via ref.
- Props:
  - data: any[]
  - latCol: string
  - lngCol: string
  - labelCol: string
- Import example:
  import GSDCMap, { GSDCMapHandle } from './ewul_Maps';
- Usage with ref:
  const mapRef = useRef<GSDCMapHandle>(null);
  <GSDCMap ref={mapRef} data={data} latCol="lat" lngCol="lng" labelCol="id" />
  mapRef.current?.scrollTo(14.6, 121.0, 12);
Notes: Requires maplibre-gl CSS and network tiles. Styles in comp_css/ewul_Maps.css.

10) ewul_DateRangePicker (ewul_DateRangePicker.tsx)
- Purpose: Date range selector supporting Today, Yesterday, Weekly, Monthly, Yearly, Custom.
- Props:
  - allowedTypes?: DateRangeType[]
  - initialType?: DateRangeType
  - onFilterChange: (range: { from:string; to:string }) => void
  - opacity?, blur?, bgColor?, hoverColor? (styling helpers)
- Import example:
  import DateRangePicker from './ewul_DateRangePicker';
- Usage:
  <DateRangePicker onFilterChange={({from,to})=>setRange({from,to})} />
Notes: Emits {from,to} as YYYY-MM-DD whenever selection changes. Styles in comp_css/ewul_DateRangePicker.css.

General notes
- CSS: Each component references a corresponding CSS file under comp_css/ inside this folder.
- Data/services: Several components call generated services in src/generated/services/* and use constants from truth.config — ensure those are available when using the components.
- Assets: Loading GIFs and icons live in public/animated and public/icons.


Project-wide context
- src/truth.config.ts is the single source of truth for variables/constants used across the app. Many components import from this file for enums, config, and shared values.
- src/theme.css is the global theme file. All thematic colors (primary, secondary, accent, background, etc.) are managed here. Update this file to change the app's color scheme globally.
