import React from 'react';
import { Bell, CheckCircle, XCircle, Loader, Loader2, Trash2, X } from 'lucide-react';
import './comp_css/NotificationBell.css';
import './comp_css/NotificationItem.css';
import { useUser } from '../utils/useUser';
import {MarkAllAsRead} from './ewul_Icons';
import { useNotifications } from '../utils/NotificationContext';


interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onRemove?: (id: string) => void; // Added for removing a single notification
  isSeen: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  status: 'seen' | 'unseen' | 'auto';
  state: 'ongoing' | 'success' | 'failed' | 'default';
  onClick?: () => void;
}


const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkAsRead, onRemove, isSeen }) => {
  const getIcon = () => {
    switch (notification.state) {
      case 'ongoing':
        return <Loader size={18} className="animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'failed':
        return <XCircle size={18} className="text-red-500" />;
      default:
        return <Bell size={18} className="text-gray-500" />;
    }
  };

  const handleClick = () => {
    onMarkAsRead(notification.id);
    if (notification.onClick) {
      notification.onClick();
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the item's onClick from firing
    if (onRemove) {
      onRemove(notification.id);
    }
  };

  const formatBracketText = (text: string) => {
    // Regex looks for anything starting with [ and ending with ]
    const parts = text.split(/(\[.*?\])/g); 
    
    return parts.map((part, index) => 
      part.startsWith('[') && part.endsWith(']') ? (
        <span key={index} className="bracket-bold">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div 
      className={`notification-item ${isSeen ? 'seen' : 'unseen'}`}
      onClick={handleClick}
    >
      <div className="notification-icon">{getIcon()}</div>
      <div className="notification-content">
        <p className="notification-title">
          {notification.title}
        </p>
        <p className="notification-message">
            {
              formatBracketText(notification.message)
            }
        </p>
        <p className="notification-timestamp">
          {new Date(notification.timestamp).toLocaleString()}
        </p>
      </div>
      {onRemove && <button className="notification-item-close-btn" onClick={handleRemoveClick}>
        <X size={16} />
      </button>}
    </div>
  );
};





const NotificationBell: React.FC = () => {
  const { user, updateUser } = useUser();
  const { notifications, setNotifications } = useNotifications(); // Access the notifications context
  const [isOpen, setIsOpen] = React.useState(false);
  const [toastNotifications, setToastNotifications] = React.useState<Notification[]>([]);
  const prevNotificationsRef = React.useRef<Notification[]>(undefined);

  React.useEffect(() => {
    prevNotificationsRef.current = notifications;
  });

  const prevNotifications = prevNotificationsRef.current ?? [];

  const [lastCheckTimestamp, setLastCheckTimestamp] = React.useState(/*user?.lastNotificationCheck ? new Date(user.lastNotificationCheck) :*/ new Date(0));
  const lastToastTimestamp = user?.lastToastTimestamp ? new Date(user.lastToastTimestamp) : new Date(0);

  const isNotificationUnseen = (n: Notification) => {
    if (n.status === 'unseen') return true;
    return new Date(n.timestamp) > lastCheckTimestamp;
  };

  const unreadCount = notifications.filter(isNotificationUnseen).length;
  const hasOngoing = notifications.some(n => n.state === 'ongoing');

  React.useEffect(() => {
    // When the main notifications list changes, ensure toast notifications are still valid
    setToastNotifications(currentToasts =>
      currentToasts.filter(toast =>
        notifications.some(notification => notification.id === toast.id)
      )
    );
  }, [notifications, setToastNotifications]);

  React.useEffect(() => {
    // Find newly created notifications
    const newNotifications = notifications.filter(n => 
      !prevNotifications.some(pn => pn.id === n.id) && isNotificationUnseen(n)
    );

    // Find notifications that just completed (state changed from ongoing)
    const updatedNotifications = notifications.filter(n => {
      const prevN = prevNotifications.find(pn => pn.id === n.id);
      return prevN && 
             prevN.state === 'ongoing' && 
             (n.state === 'success' || n.state === 'failed');
    });

    let notificationsToShow = [...newNotifications, ...updatedNotifications];

    // Filter out notifications older than the last toast
    notificationsToShow = notificationsToShow.filter(n => new Date(n.timestamp) > lastToastTimestamp);

    if (notificationsToShow.length > 0) {
      // Sort by timestamp to find the latest
      notificationsToShow.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const latestTimestamp = new Date(notificationsToShow[0].timestamp);
      if (latestTimestamp > lastToastTimestamp) {
        updateUser({ lastToastTimestamp: latestTimestamp.toISOString() });
      }

      setToastNotifications(prevToasts => {
        const uniqueNewToasts = notificationsToShow.filter(nt => !prevToasts.some(pt => pt.id === nt.id));
        const updatedToasts = [...uniqueNewToasts, ...prevToasts];
        return updatedToasts.slice(0, 3); // Keep only the latest 3
      });
    }
  }, [notifications, prevNotifications, user, updateUser, lastToastTimestamp]);


  const removeToast = React.useCallback((id: string) => {
    setToastNotifications(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, [setToastNotifications]);

  const handleBellClick = () => {
    setIsOpen(!isOpen);
    setLastCheckTimestamp(new Date(user?.lastNotificationCheck ? user.lastNotificationCheck : new Date().toISOString())); // always use the previous timestamp for the badge count
    if (!isOpen) {
      const newTimestamp = new Date();
      updateUser({ lastNotificationCheck: newTimestamp.toISOString() });
      console.log("Updating user's lastNotificationCheck to:", newTimestamp.toLocaleString());
      setToastNotifications([]);
    }
  };

  const handleRemoveNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, status: 'seen' } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, status: 'seen' })));
  };

  const handleClearAll = () => {
    setNotifications([]);
    setIsOpen(false);
  };


  return (
    <div className="notification-bell-container">
      <button className="notification-bell-icon" onClick={() => { handleBellClick(); }}>
        {hasOngoing && <Loader2 size={40} className="animate-spin bell-spinner" />}
        <Bell size={24} className="bell-icon-foreground" />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h3>Notifications</h3>
            <div className="notification-actions">
              <button onClick={handleMarkAllAsRead} title="Mark all as read">
                <MarkAllAsRead size={16} />
              </button>
              <button onClick={handleClearAll} title="Clear all notifications">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="notification-list">
            {notifications.length > 0 ? (
              notifications.map(n => (
                <NotificationItem 
                  key={n.id} 
                  notification={n} 
                  onMarkAsRead={handleMarkAsRead}
                  onRemove={handleRemoveNotification}
                  isSeen={!isNotificationUnseen(n)}
                />
              ))
            ) : (
              <p className="no-notifications">No new notifications</p>
            )}
          </div>
        </div>
      )}

      <div className="notification-toast-container">
        {toastNotifications.map(notification => (
          <Toast 
            key={notification.id}
            notification={notification}
            onRemove={removeToast}
          />
        ))}
      </div>
    </div>
  );
};

interface ToastProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ notification, onRemove }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(notification.id);
    }, 5000); // Each toast lasts 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [notification.id, onRemove]);

  return (
    <div className="notification-toast">
      <NotificationItem 
        notification={notification} 
        onMarkAsRead={() => {}}
        isSeen={false}
      />
      <button className="toast-close-btn" onClick={() => onRemove(notification.id)}>
        <X size={18} />
      </button>
      <div className="toast-timer-bar"></div>
    </div>
  );
};

export default NotificationBell;
