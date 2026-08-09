// src/pages/MaintenancePage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ShieldAlert, Zap, ArrowLeft, CheckCircle2 } from 'lucide-react';
import './css/MaintenancePage.css';

const MaintenancePage = ({ details }: { details: any }) => {
  const navigate = useNavigate();

  // Check if the maintenance time has passed
  const isMaintenanceOver = React.useMemo(() => {
    // 1. If details or endTime is missing, treat as true (maintenance not active)
    if (!details?.endTime) return true;

    const endTime = new Date(details.endTime);

    // 2. If the date provided is invalid, treat as true
    if (isNaN(endTime.getTime())) {
      return true;
    }

    // 3. Otherwise, perform the actual time comparison
    return new Date() >= endTime;
  }, [details]);

  const handleGoBack = () => {
    const savedUser = localStorage.getItem("gsdc_user");

    if (savedUser) {
      const userInfo = JSON.parse(savedUser);
      userInfo.CurrentNav = "/order"; // Update navigation state
      localStorage.setItem("gsdc_user", JSON.stringify(userInfo));

      navigate("/order", { state: { user: userInfo } });
    } else {
      navigate("/order");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("gsdc_user");
    navigate("/");
  };


  return (
    <div className="maintenance-container">
      <div className="maintenance-outline-wrapper">
        <div className="maintenance-card">
          <div className="status-badge">
            <Zap size={12} fill="currentColor" />
            <span>SYSTEM STATUS: {isMaintenanceOver ? 'READY' : 'MAINTENANCE'}</span>
          </div>

          <div className="icon-stack">
            <Settings size={60} className={isMaintenanceOver ? "" : "spinning-icon"} />
            {isMaintenanceOver ? (
              <CheckCircle2
                size={24}
                className="alert-overlay success-icon"
                color="#22c55e"
              />
            ) : (
              <ShieldAlert
                size={22}
                className="alert-overlay"
                color="#ff0000"
              />
            )}
          </div>

          <h1 className="maint-title">Fleet Systems Update</h1>

          <div className="accent-divider" />

          <p className="maint-message">
            {isMaintenanceOver
              ? "Optimization complete. You can now return to the dispatch dashboard."
              : (details.message || "We are currently optimizing the dispatching database.")}
          </p>

          <div className="maint-time-box">
            <span className="time-label">Estimated Back Online</span>
            <span className="time-value">
              {new Date(details.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* New Go Back Button - Only enabled if maintenance is over */}
          <button
            onClick={handleGoBack}
            className="maint-back-btn"
            disabled={!isMaintenanceOver}
          >
            <ArrowLeft size={18} />
            Return to Dispatch
          </button>

          <button
            onClick={handleLogout}
            className="maint-back-btn"
          // disabled={!isMaintenanceOver}
          >
            {/* <ArrowLeft size={18} /> */}
            Log Out
          </button>

          <div className="maint-footer">
            <strong>GSDC</strong> Systems Engineering
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;