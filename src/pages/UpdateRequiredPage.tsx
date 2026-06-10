import React from 'react';
import { TriangleAlert, Sparkles, RefreshCw } from 'lucide-react'; // Import icons
import { useLocation } from 'react-router-dom';
import './css/UpdateRequiredPage.css';

const UpdateRequired: React.FC = () => {
  const location = useLocation();
  const { newVersion, isMajor } = location.state || { newVersion: "Latest", isMajor: false };

  const handleRefresh = () => {
    window.location.href = window.location.pathname + window.location.search;
  };

  return (
    <div className="update-page-container">
      <div className="update-card">
        <div className={`update-icon-wrapper ${isMajor ? 'major' : 'minor'}`}>
          {isMajor ? (
            <TriangleAlert size={48} strokeWidth={2.5} />
          ) : (
            <Sparkles size={48} strokeWidth={2.5} />
          )}
        </div>

        <h1 className="update-title">
          {isMajor ? "Critical Update" : "New Features Available"}
        </h1>

        <p className="update-message">
          The system version <strong>{newVersion}</strong> is now available. 
          {isMajor 
            ? " A major overhaul has been deployed. You must refresh to continue using the application." 
            : " New minor improvements and features have been added."}
        </p>

        {/* Refresh Instructions Image */}
        <div className="instruction-image-wrapper">
          <img 
            src="/images/clickrefresh.png" 
            alt="How to refresh" 
            className="refresh-instruction-img"
          />
          <p className="instruction-caption">Click the refresh icon in your browser to update.</p>
        </div>




        <button className="refresh-btn" onClick={handleRefresh}>
          <RefreshCw size={18} className="btn-icon" />
          REFRESH TO VERSION {newVersion}
        </button>
      </div>
    </div>
  );
};

export default UpdateRequired;