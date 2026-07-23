/**
 * ============================================================================
 * DEVELOPER ARCHITECTURE & IMPLEMENTATION GUIDE NOTES
 * ============================================================================
 * 
 * [1] SINGLE SOURCE OF TRUTH (SSOT) CONFIGURATIONS
 *     - Data Table Structure: Defined strictly within `src/truth.config.ts` 
 *       via `NEW_TRIPS_UNFILTERED_TABLE_CONFIG`. Do not hardcode columns locally.
 * 
 * [2] FILE & COMPONENT LOCATION RULES
 *     - Page Root: Placed in `src/pages/`.
 *     - Page Styling: Specific page styles reside in `./css/`.
 *     - Sub-modules/Components: Stored inside `src/components/`.
 *     - Component Styling: Shared component styles reside in `src/components/comp_css/`.
 * 
 * [3] DATA ORCHESTRATION & DELEGATION
 *     - Page shells (`PageTemplate`) must remain clean layout frameworks.
 *     - All actual data fetching, API queries (`ewulFetchAll`), and grid mutations 
 *       MUST be handled isolated down inside the sub-components (`<OrdersModule />`).
 * 
 * [4] DISPATCH DATE FILTERING LOGIC
 *     - Date inputs collect standard HTML5 YYYY-MM-DD string values via the custom component.
 *     - Queries to T-SQL endpoints require high-performance integer keys. Use the utility 
 *       `ISOtoInt()` to convert values to `YYYYMMDD` integers (e.g., 20260721) before dispatching.
 * 
 * [5] BRANDING & DESIGN SYSTEM STANDARDS
 *     - Palette: Navy Blue (Primary), White (Background), and Red (Accent/Sub).
 *     - Gradients: Navy Blue to Red gradients are utilized for component wrappers and headers.
 *     - Inputs: All input elements use a gentle rounded design. 
 *     - Sizing: All inner modules must maintain relative, flexible, and responsive layouts.
 * 
 * ============================================================================
 */

import React, { useState, useCallback, useEffect } from 'react';
import PageTemplate from './template';
import { Layers, Download, RefreshCcw } from 'lucide-react';

// Utilities & Data Services
import { useUser } from '../utils/useUser';
import { ewulFetchAll, ISOtoInt } from '../utils/Ewul_GSDC_Utils'; 
import { NewTripsView_CEM_unfilteredService } from '../generated/services/NewTripsView_CEM_unfilteredService';

// Single Source of Truth Config & Custom Flex Table / Date Picker
import { NEW_TRIPS_UNFILTERED_TABLE_CONFIG } from '../truth.config';
import TableView, { type ColumnConfig } from '../components/ewul_TableFlex';
import DateRangePicker from '../components/ewul_DateRangePicker';

// CSS Integration (Page Context Scope)
import './css/NewFeatureDashboard.css';

/**
 * Sub-Component: Dynamic Orders Grid with Live Range Filters
 */
const OrdersModule: React.FC = () => {
  const { user } = useUser();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Custom Date Picker Range Local State
  const [selectedRangeNewOrders, setSelectedRangeNewOrders] = useState<{from: string, to: string} | null>(null);

  // Memoized state update evaluation handler
  const handleDateChangeNewOrders = useCallback((range: {from: string, to: string}) => {
    setSelectedRangeNewOrders(prev => {
      // If the values are exactly the same, return the previous state to avoid a re-render
      if (prev?.from === range.from && prev?.to === range.to) {
        return prev;
      }
      return range;
    });
  }, []);

  // Isolated data fetching utilizing structural date filters
  const fetchNewOrders = useCallback(async () => {
    if (!selectedRangeNewOrders?.from || !selectedRangeNewOrders?.to) return;
    
    setIsLoading(true);
    try {
      // Convert standard string dates (YYYY-MM-DD) to optimized integer keys (YYYYMMDD)
      const fromInt = ISOtoInt(selectedRangeNewOrders.from);
      const toInt = ISOtoInt(selectedRangeNewOrders.to);
      
      const options = {
        filter: `OEDateAsInt ge ${fromInt} and OEDateAsInt le ${toInt}`,
        orderBy: ["OEDateAsInt desc"]
      };

      const result = await ewulFetchAll<any>(
        NewTripsView_CEM_unfilteredService, 
        options, 
        2000
      );
      setOrders(result || []);
    } catch (err) {
      console.error("Fetch Error:", err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRangeNewOrders]);

  // Re-fetch automatically anytime the user updates the custom date ranges
  useEffect(() => {
    if (selectedRangeNewOrders) {
      fetchNewOrders();
    }
  }, [selectedRangeNewOrders, fetchNewOrders]);

  const handleRowClick = (record: any) => {
    console.log("Selected Order record:", record.OE);
  };

  return (
    <div className="orders-module-layout">
      
      {/* Custom DatePicker Filtration Control Panel */}
      <div className="dashboard-filter-row">
        <div className="datepicker-group-container">
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

        {/* Action Controls */}
        <button 
          className="dashboard-action-btn primary-solid" 
          onClick={fetchNewOrders} 
          disabled={isLoading || !selectedRangeNewOrders}
        >
          <RefreshCcw size={15} className={isLoading ? 'spinning' : ''} /> 
          <span>Query Fleet</span>
        </button>
      </div>

      {/* Primary Flex Data Grid */}
      <div className="dashboard-table-frame">
        <TableView
          data={orders}
          config={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.table_config as ColumnConfig[]}
          storageKey={`new_feature_orders_${user?.id || 'guest'}`}
          searchCol={NEW_TRIPS_UNFILTERED_TABLE_CONFIG.searchable_cols as string[]}
          isLoading={isLoading}
          showRowCount={20} //either: 10 | 20 | 50 | 100 | 500
          onRefresh={fetchNewOrders}
          overflowY={true}
          maxHeight={450}
          colMinWidth={100}
          onRowClick={handleRowClick}
          highlightSelected={true}
          theme="var(--color-primary)"
          showNumbering={true}
        />
      </div>
    </div>
  );
};

/**
 * Main Layout Shell
 */
const NewFeatureDashboard: React.FC = () => {
  const { user } = useUser();

  return (
    <PageTemplate
      title="New Feature Dashboard"
      actions={
        <div className="dashboard-actions-bar">
          <button className="dashboard-action-btn active-highlight">
            <Layers size={18} /> <span>Overview</span>
          </button>
          <button className="dashboard-action-btn secondary-outline">
            <Download size={18} /> <span>Export Data</span>
          </button>
        </div>
      }
      className="flush-dashboard-page"
      hideFooter={true}
    >
      <div className="dashboard-workspace-bg">
        <div className="dashboard-gradient-wrapper fullscreen-mode">
          <div className="dashboard-floating-container">
            
            <div className="dashboard-panel-header">
              <h3>Active Dispatch Orders</h3>
              <span>Operator: {user?.FullName || 'Guest'}</span>
            </div>

            <div className="dashboard-panel-content">
              <OrdersModule />
            </div>

          </div>
        </div>
      </div>
    </PageTemplate>
  );
};

export default NewFeatureDashboard;