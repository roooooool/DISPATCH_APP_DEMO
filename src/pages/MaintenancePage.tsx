// src/pages/MaintenancePage.tsx
// import React from 'react';
import { Settings, Clock } from 'lucide-react';
import '../components/comp_css/MaintenancePage.css';

const MaintenancePage = ({ details }: { details: any }) => {
  return (
    <div className="maintenance-container">
      <div className="maintenance-card">
        <div className="icon-wrapper">
          <Settings size={48} className="spinning-icon" />
        </div>
        
        <h1 className="maint-title">System Maintenance</h1>
        <p className="maint-message">{details.message}</p>
        
        <div className="maint-time-box">
          <Clock size={16} />
          <span>Estimated Back Online: {new Date(details.endTime).toLocaleString()}</span>
        </div>

        <div className="maint-footer">
          Great Sierra Development Corp.
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;