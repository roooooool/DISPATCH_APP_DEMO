import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { type UserInfo } from '../truth.config';

// import { mandatoryLogout } from '../truth.config';

const SYNC_EVENT = "gsdc_user_sync";

export const useUser = () => {
  const location = useLocation();

  const [user, setUser] = useState<UserInfo | null>(() => {
    // 1. Check Location State first (fastest)
    if (location.state?.user) return location.state.user;

    // 2. Fallback to Local Storage
    //@ts-ignore
    const saved = localStorage.getItem("gsdc_user");
    const fix = {
      FirstName: "Juan",
      MiddleName: "",
      LastName: "Dela Cruz",
      FullName: "Dela Cruz, Juan",
      BusinessUnit: "SBUO-1A",
      Position: "TEST POSITION",
      id: "BB2D2A51-1D2F-4C3C-A534-EA95ADF62E1A",
      CurrentNav: "/dash",
      email: "test@sample.com.ph"
    };
    return fix;
  });

  // Effect to listen for changes in localStorage from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "gsdc_user" && event.newValue) {
        setUser(JSON.parse(event.newValue));
      } else if (event.key === "gsdc_user" && !event.newValue) {
        // Handle case where user is logged out from another tab
        setUser(null);
      }
    };

    const handleInternalSync = () => {
      const latest = localStorage.getItem("gsdc_user");
      setUser(latest ? JSON.parse(latest) : null);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(SYNC_EVENT, handleInternalSync);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(SYNC_EVENT, handleInternalSync);
    };
  }, []);

  const updateUser = (newData: Partial<UserInfo>) => {
    // Use a functional update to ensure we're always working with the latest state.
    setUser(currentUser => {
      // It's safer to read the latest from storage in case of concurrent updates.
      const fromStorage = localStorage.getItem("gsdc_user");
      const latestUser = fromStorage ? JSON.parse(fromStorage) : currentUser;

      const updated = { ...latestUser, ...newData };
      localStorage.setItem("gsdc_user", JSON.stringify(updated));
      window.dispatchEvent(new Event(SYNC_EVENT));
      return updated;
    });
  };

  return { user, updateUser };
};