import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { NAV_DESTINATIONS, SPECIAL_POSITIONS, type UserInfo, GSDC_NAVIGATE_TO_TRIP_key } from "../truth.config";
import "./comp_css/Navbar.css";
import "./comp_css/ChatBadge.css";
import SettingsModal from "./SettingsModal";
import { Menu, X, MessageSquare } from 'lucide-react'; // Import icons for hamburger menu
import NotificationBell  from './NotificationBell'; // Import the new component
import ChatBox, { type ChatBoxHandle } from './ChatBox'; // Import the new ChatBox component and its handle
import TaskTracker from './ewul_TripTaskTracker';

import { useUser  } from "../utils/useUser";


import profile_icon_placeholder from "../../public/icons/pwhite.svg"; // Placeholder profile icon path

interface NavbarProps {
  user: UserInfo;
  onNavigate: (path: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ user: _user, onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChatBoxOpen, setIsChatBoxOpen] = useState(false);
  const [unreadChatMessages, setUnreadChatMessages] = useState(0);
  const chatBoxRef = useRef<ChatBoxHandle>(null);


  //const prev_notifications: Notification[] = notifications;

  const { user, updateUser } = useUser();

  useEffect(() => {
    const fetchCount = async () => {
        if (chatBoxRef.current) {
            try {
                const total = await chatBoxRef.current.fetchTotalUnread();
                setUnreadChatMessages(total);
            } catch (error) {
                console.error("Failed to fetch total unread chat messages:", error);
            }
        }
    };

    // Fetch count immediately and then poll
    fetchCount();
    const interval = setInterval(fetchCount, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount


  const [theme, setTheme] = useState(localStorage.getItem("gsdc_theme") || "light");
  // Apply theme to the document root
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("gsdc_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleNavigate = (path: string) => {
    // 1. Notify the Parent (PageTemplate) to update the global state and localStorage
    if (onNavigate) {
      onNavigate(path);
    }

    // 2. Perform the actual navigation
    // Note: We don't necessarily need state: { user } anymore because the 
    // hook in the next page will read the updated localStorage automatically.
    navigate(path);
    setIsMobileMenuOpen(false); // Close mobile menu on navigation
  };

  const handleLogout = () => {
    localStorage.removeItem("gsdc_user");
    navigate("/");
  };


  useEffect(() => {
    const handleTaskNavigation = (event: any) => {
        const { oe } = event.detail;
        const targetPath = "/order"; // Adjust this to your actual dispatch route

        // 1. Determine if we need to navigate
        // If we are already on the page, we still push the new OE to the URL
        // If not, we move to that page
        navigate(`${targetPath}?oe=${oe}`, { 
            replace: false, 
            state: { fromTaskTracker: true } 
        });

        // 2. Notify parent if you have global state tracking active path
        if (onNavigate) {
            onNavigate(targetPath);
        }
        
        console.log(`Navbar navigating to ${targetPath} for OE: ${oe}`);
    };

    window.addEventListener(GSDC_NAVIGATE_TO_TRIP_key, handleTaskNavigation);
    return () => window.removeEventListener(GSDC_NAVIGATE_TO_TRIP_key, handleTaskNavigation);
  }, [navigate, onNavigate]);




  // Filter navigation based on user position whitelist
  const allowedNavs = user ? NAV_DESTINATIONS.filter((nav) => {
      const isSpecial = SPECIAL_POSITIONS.includes(user.Position);
      const isWhitelisted = nav.whiteList.includes(user.Position);
      
      return isSpecial || isWhitelisted;
  }) : [];

  return (
    <nav className="main-navbar">
      {/* LEFT: User Profile Section */}
        <div className="nav-profile-section" onClick={() => setShowDropdown(!showDropdown)}>
            <img 
            src={profile_icon_placeholder}
            alt="Profile" 
            className="nav-avatar" 
            />
            <div className="nav-user-info">
            <span className="nav-username">{user?.FirstName} {user?.LastName}</span>
            <span className="nav-position">{user?.Position} | {user?.BusinessUnit}</span>
            </div>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="nav-dropdown">
                <button onClick={() => {}}>User Profile</button>
                <button onClick={() => { setIsSettingsOpen(true); setShowDropdown(false);  }}>
                  Settings
                </button>
                <hr />
                <button className="logout-btn" onClick={handleLogout}>Log out</button>
              </div>
            )}

            {/*<div className="nav-divider-streak"></div>*/}
        </div>

      {/* RIGHT: Navigation Buttons & Notifications */}
      <div className="nav-right-section">
        <div className="nav-links">
          {allowedNavs.map((nav) => (
            <button 
              key={nav.path} 
              // Optional: Add an 'active' class if this is the current path
              className={`nav-item ${location.pathname === nav.path ? 'active' : ''}`} 
              onClick={() => handleNavigate(nav.path)} // Use our new helper
            >
              {nav.label}
            </button>
          ))}
        </div>

        {/* Notification Bell */}
        <NotificationBell />


        {/* Chat/Message Icon */}
        <button className="nav-icon-button" onClick={() => {setIsChatBoxOpen(true);}}>
          <MessageSquare size={24} />
          {unreadChatMessages > 0 && (
            <span className="notification-badge"> {/** Borrowed Badge CSS FROM Notification Bell AHAHHA */}
              {unreadChatMessages > 99 ? '99+' : unreadChatMessages}
            </span>
          )}
        </button>
        

        {/** Task Tracker */}
        <TaskTracker />


        {/* Hamburger Menu for Mobile */}
        <div className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </div>


      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-nav-menu">
          {allowedNavs.map((nav) => (
            <button 
              key={nav.path} 
              className={`nav-item ${location.pathname === nav.path ? 'active' : ''}`} 
              onClick={() => handleNavigate(nav.path)}
            >
              {nav.label}
            </button>
          ))}
        </div>
      )}

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        theme={theme}
        toggleTheme={toggleTheme}
        key={`${isSettingsOpen}`} // Force remount to reset internal state
        user={user}
        updateUser={updateUser}
      />

      <ChatBox 
        ref={chatBoxRef}
        isOpen={isChatBoxOpen}
        onOpen={() => setIsChatBoxOpen(true)}
        onClose={() => setIsChatBoxOpen(false)}
        user={user}
      />
    </nav>
  );
};

export default Navbar;