import React, { useState, useEffect } from 'react';
import MaintenancePage from '../pages/MaintenancePage';
import { useUser } from '../utils/useUser'; // Custom hook to get user info, including role

interface MaintenanceCheckerProps {
  children: React.ReactNode;
}

const MaintenanceChecker: React.FC<MaintenanceCheckerProps> = ({ children}) => {
  const user = useUser();
  const userRole = user?.user?.Position || 'User'; // Default to 'User' if role is not available
  const [maintStatus, setMaintStatus] = useState({ isDown: false, details: null as any });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        // Cache busting with timestamp to ensure fresh data from GitHub
        const res = await fetch(`https://raw.githubusercontent.com/ewul/GSDC_Config/main/maintenance.json?t=${Date.now()}`);
        if (!res.ok) throw new Error("Config fetch failed");
        
        const data = await res.json();
        const config = data?.maintenance;

        if (config?.enabled) {
          const now = new Date();
          const start = new Date(config.startTime);
          const end = new Date(config.endTime);

          // Trigger lockout if within the scheduled window
          if (now >= start && now <= end) {
            setMaintStatus({ isDown: true, details: config });
          }
        }
      } catch (err) {
        console.error("Maintenance check failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkMaintenance();
  }, []);

  if (isLoading) return null; // Let the App's LoadingOverlayMask handle the visual

  // Bypass for Ed/ewul (Developer role)
  if (maintStatus.isDown && userRole !== 'Developer') {
    return <MaintenancePage details={maintStatus.details} />;
  }

  return <>{children}</>;
};

export default MaintenanceChecker;