import React, {useState} from "react";
import { Sun, Moon, Trash2, SlidersHorizontal } from 'lucide-react';
import "./comp_css/SettingsModal.css";

import { type UserInfo } from "../truth.config";


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  toggleTheme: () => void;
  user: UserInfo | null;
  updateUser: (data: Partial<UserInfo>) => void; // Function to update user data
}

type SettingsCategory = 'Appearance' | 'Debug';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, theme, toggleTheme, user, updateUser }) => {
  /*const { user, updateUser } = useUser();
  const userRef = useRef(user);
    useEffect(() => {
    userRef.current = user;
  }, [user]);*/

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('Appearance');


  if (!isOpen) return null;

  const handleClearNotificationCheck = () => {
    // Check if user exists before attempting update
    user ? updateUser({ lastNotificationCheck: undefined }) : alert("User data not found.");
  };

  const handleClearToastTimestamp = () => {
    user ? updateUser({ lastToastTimestamp: undefined }) : alert("User data not found.");
  };

  const renderContent = () => {
    switch (activeCategory) {
      case 'Appearance':
      return (
        <>
          <div className="setting-item">
            <div className="setting-label">
              {theme === "dark" ? <Sun className="setting-icon" /> : <Moon className="setting-icon" />}
              <span>Dark Mode</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={theme === "dark"} 
                onChange={toggleTheme} 
              />
              <span className="slider round"></span>
            </label>
          </div>

          {/* NEW: Custom Cursor Toggle */}
          <div className="setting-item">
            <div className="setting-label">
              <SlidersHorizontal className="setting-icon" />
              <div className="setting-text">
                <span>Show Custom Cursor</span>
                <small className="timestamp-display">Triangle navy & red pointer</small>
              </div>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                // Default to false if the property doesn't exist in user data yet
                checked={user?.showCustomCursor || false} 
                onChange={(e) => updateUser({ showCustomCursor: e.target.checked })} 
              />
              <span className="slider round"></span>
            </label>
          </div>
        </>
      );
      case 'Debug':
        const lastSeen =  user?.lastNotificationCheck 
          ? new Date(user?.lastNotificationCheck).toLocaleString()
          : 'Not set';

        const lastToast=  user?.lastToastTimestamp 
          ? new Date(user?.lastToastTimestamp).toLocaleString()
          : 'Not set';

        return (
          <>
            <div className="setting-item">
              <div className="setting-label">
                  <Trash2 className="setting-icon" />
                  <div className="setting-text">
                      <span>Clear Notification Timestamp</span>
                      <small className="timestamp-display">Last Seen: {lastSeen}</small>
                  </div>
              </div>
              <button className="debug-button" onClick={handleClearNotificationCheck}>
                Clear Data
              </button>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                  <Trash2 className="setting-icon" />
                  <div className="setting-text">
                      <span>Clear Toast Timestamp</span>
                      <small className="timestamp-display">Last Toast: {lastToast}</small>
                  </div>
              </div>
              <button className="debug-button" onClick={handleClearToastTimestamp}>
                Clear Data
              </button>
            </div>
          </>

          
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><SlidersHorizontal size={20} /> Settings</h3>
          <button className="close-x" onClick={onClose}>&times;</button>
        </div>
        
        <div className="settings-body">
          <aside className="settings-sidebar">
            <button 
              className={`sidebar-item ${activeCategory === 'Appearance' ? 'active' : ''}`}
              onClick={() => setActiveCategory('Appearance')}
            >
              <Sun size={18} /> Appearance
            </button>
            <button 
              className={`sidebar-item ${activeCategory === 'Debug' ? 'active' : ''}`}
              onClick={() => setActiveCategory('Debug')}
            >
              <Trash2 size={18} /> Debug
            </button>
          </aside>
          
          <main className="settings-content">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;