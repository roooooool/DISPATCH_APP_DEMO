import { HashRouter, Routes, Route, Navigate } from "react-router-dom"; // Changed to HashRouter
import { useEffect, useState, useCallback } from 'react';
//wew

import Login from "./pages/login";
import TEMPLATE_PAGE from "./pages/template";
import DASHPage from "./pages/FleetDashboard";
import Not_Found from "./pages/not_found";
import ORDER_MANAGEMENT from "./pages/OrderManagement";
import FleetMonitoring from "./pages/FleetMonitoring";
import LoadingPage from "./pages/LoadingPage";
import MaintenancePage from "./pages/MaintenancePage";
import DeveloperPage from './pages/DeveloperPage';
import ErrorPage from "./pages/ErrorPage";
import UpdateRequired from "./pages/UpdateRequiredPage";
import IncidentManagement from "./pages/IncidentManagement";

//CUSTOM
import ProtectedRoute from "./components/ewul_ProtectedRoute"; // Route guard 
import { TaskWorkerProvider } from "./utils/TaskWorkerContext";
import type { Notification } from "./components/NotificationBell"; // Ensure fetch_notifications is imported to set up the polling mechanism
import NotificationFetcher from "./components/fetch_notifications"; // Import to set up the polling mechanism for notifications
import LoadingOverlayMask from './components/loaderMask';
import { NotificationProvider, useNotifications } from './utils/NotificationContext'; // Ensure the context is imported to wrap the app and provide notification state
import MaintenanceChecker from './components/maintenanceChecker';
import {ErrorChecker} from './components/errorChecker'; // Import the error checker to wrap the app
import { useVersionCheck } from './components/versionChecker'; // Import the version checker hook

const VersionGuard = ({ children }: { children: React.ReactNode }) => {
  useVersionCheck(); // This runs the Major/Minor comparison logic
  return <>{children}</>;
};

// Move the logic into a child component
function MainContent() {
  // Now this works because it's inside the Provider
  const { setNotifications } = useNotifications();
  
  const [worker_notifications, setWorkerNotifications] = useState<Notification[]>([]);
  const [toastNotifications, setToastNotifications] = useState<Notification[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [overlayFading, setOverlayFading] = useState(false);

  const handleNewToasts = useCallback((newData: Notification[]) => {
    setToastNotifications((prev) => {
      const combined = [...prev, ...newData];
      const uniqueMap = new Map();
      combined.forEach((item) => uniqueMap.set(item.id, item));
      const deduplicated = Array.from(uniqueMap.values());
      return deduplicated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    });
    //setToastNotifications(newData);
  }, []);

  useEffect(() => {

    // Combine worker (internal) and toast (external) notifications
    const combinedNotifications = [...worker_notifications, ...toastNotifications];
    setNotifications(combinedNotifications);
  }, [worker_notifications, toastNotifications, setNotifications]);

  const handleOverlayProgress = (progress: number) => {
    setOverlayProgress(progress);
    if (progress >= 100 && showOverlay && !overlayFading) {
      setOverlayFading(true);
      setTimeout(() => {
        setShowOverlay(false);
        setOverlayFading(false);
      }, 700);
    }
  };

  return (
    <>
      {showOverlay && (
        <div className={`loading-overlay-mask${overlayFading ? ' fade-out' : ''}`}>
          <LoadingOverlayMask onProgressChange={handleOverlayProgress} />
        </div>
      )}

      <TaskWorkerProvider setNotifications={setWorkerNotifications}>
        <HashRouter>
          <MaintenanceChecker>
            <NotificationFetcher onDataLoaded={handleNewToasts} stopFetching={overlayProgress < 99} />
              <ErrorChecker>
              <VersionGuard>
                <Routes>
                  <Route path="/" element={<Navigate to="/loading" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/dash" element={<ProtectedRoute><DASHPage/></ProtectedRoute>} />
                  <Route path="/order" element={<ProtectedRoute><ORDER_MANAGEMENT/></ProtectedRoute>} />
                  <Route path="/fleet" element={<ProtectedRoute><FleetMonitoring/></ProtectedRoute>} />
                  <Route path="/test_page" element={<ProtectedRoute><TEMPLATE_PAGE /></ProtectedRoute>} />
                  <Route path="/maintenance" element={<MaintenancePage details={{}} />} />
                  <Route path="/developer" element={<ProtectedRoute><DeveloperPage /></ProtectedRoute>} />
                  <Route path="/loading" element={<LoadingPage />} />
                  <Route path="/error" element={<ErrorPage />} />
                  <Route path="/update-required" element={<UpdateRequired />} />
                  <Route path="/incidents" element={<ProtectedRoute><IncidentManagement /></ProtectedRoute>} />
                  <Route path="*" element={<Not_Found />} />
                </Routes>
              </VersionGuard>
              </ErrorChecker>
          </MaintenanceChecker>
        </HashRouter>
      </TaskWorkerProvider>
    </>
  );
}

// The main App component only handles the top-level Provider
function App() {
  return (
    <NotificationProvider>
      <MainContent />
    </NotificationProvider>
  );
}

export default App;
