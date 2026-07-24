import React, { useRef, useState, useEffect } from 'react';
  import { useNavigate } from "react-router-dom";
  import Navbar, { type NavbarHandle } from '../components/Navbar';
  import {useUser} from '../utils/useUser';
  import { ArrowBigUp, ChevronUp, ChevronDown } from 'lucide-react'; // Match your dashboard icon
  //import { type Notification} from '../components/NotificationBell'; // Import Notification type if needed
  import EwulCursor from '../components/ewul_Cursor';

  // CSS
  import './css/template.css';

  interface PageTemplateProps {
    title?: string;
    children?: React.ReactNode;
    actions?: React.ReactNode; // For the Refresh/Export buttons
    className?: string;
    contentWidth?: string; // e.g., '80%'
    contentHeight?: string; // e.g., '90%'
    contentPadding?: string;
    overflowX?: boolean;
    overflowY?: boolean;
    hideFooter?: boolean;
  }

  


  const PageTemplate: React.FC<PageTemplateProps> = ({ 
    title, 
    children, 
    actions, 
    className, 
    contentWidth, 
    contentHeight, 
    contentPadding,
    overflowX = false, 
    overflowY = false, 
    hideFooter = true 
  }) => {
    // --- 1. ALL HOOKS AT THE TOP ---
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);
    const { user, updateUser } = useUser();

    const [headerVisible, setHeaderVisible] = useState(true);
    const [showTopBtn, setShowTopBtn] = useState(false);

    const navbarRef = useRef<NavbarHandle>(null);

    // --- 2. ALL EFFECTS ---
    
    // Handle redirection logic inside an Effect
    useEffect(() => {
      if (!user) {
        console.log("No user found. Redirecting to login page.");
        navigate("/login"); 
      }
    }, [user, navigate]);

    // Scroll logic
    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;
      const handleScroll = () => setShowTopBtn(container.scrollTop > 400);
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    // --- 3. THE "SHIELD" (Early Return) ---
    // We do this AFTER hooks so the hook order never changes.
    if (!user) {
      return null; 
    }

    // --- 4. FUNCTIONS & RENDER ---
    const scrollToTop = () => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    const toggleHeader = () => {
      setHeaderVisible(!headerVisible);
    };

    return (
      <>
        <div className={`page-layout-wrapper ${className || ''}`}>
          <Navbar ref={navbarRef} user={user} onNavigate={(path) => updateUser({ CurrentNav: path })} />
          
          <div className="header-area">
            {!headerVisible && (
              <div className="sticky-header-toggle-container">
                <button className="header-slim-toggle" onClick={toggleHeader} title="Show Actions & Filters">
                  <ChevronDown size={20} />
                </button>
              </div>
            )}
            
            {/* Dynamic Ribbon for BU Dropdowns and Date Filters */}
            <header className={`page-header-ribbon ${headerVisible ? 'expanded' : 'collapsed'}`}>
              <div className="header-container">
                <h2 className="page-title">
                  <span className="brand-accent">GSDC</span> 
                  <span className="title-separator">/</span> 
                  {title}
                </h2>
                <div className="header-actions">
                  {actions}
                  <button className="header-collapse-btn" onClick={toggleHeader}>
                    <ChevronUp size={20} />
                  </button>
                </div>
              </div>
            </header>
          </div>

          <main 
            className={`main-content-container ${!headerVisible ? 'expanded-main' : ''}`} 
            ref={scrollRef}
            style={{
              overflowX: overflowX ? 'auto' : 'hidden',
              overflowY: overflowY ? 'auto' : 'hidden'
            }}
          >
            <div 
              className="content-inner-box"
              style={{ 
                width: contentWidth, 
                height: contentHeight, 
                padding: contentPadding
              }}
            >
              {children}
            </div>
          </main>

          {!hideFooter && (
            <footer className="main-footer">
              <div className="footer-content">
                <p>SYSTEM STATUS: ONLINE</p>
                <div className="footer-links">
                  <span>© 2026 GSDC Fleet Analytics</span>
                </div>
              </div>
            </footer>
          )}

          <button 
            className={`floating-scroll-btn ${showTopBtn ? 'show-btn' : ''}`} 
            onClick={scrollToTop}
          >
            <ArrowBigUp size={200} strokeWidth={5}/>
          </button>
        </div>
        <EwulCursor show={user?.showCustomCursor} />
      </>
    );
  };

  export default PageTemplate;