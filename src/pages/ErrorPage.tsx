import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../utils/useUser';
import './css/ErrorPage.css'; // Styled via your standard component CSS folder
import { ERROR_EMAIL_ENDPOINT } from '../truth.config'; // Ensure this endpoint is defined in your config file for handling error report submissions

type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
interface ErrorState {
  title?: string;
  message?: string;
  actionText?: string;
  actionPath?: string;
  details?: string;
  priority?: SeverityLevel;
  required?: boolean; // Optional flag to indicate if this error is critical and requires the user to submit a report before proceeding
}

const SEVERITY_HINTS: Record<string, string> = {
  low: "Least priority. The issue is causing minor inconvenience but operations are mostly unaffected.",
  medium: "Core workflows are functional, but specific features or buttons cannot be used properly.",
  high: "Attention Needed. Important features are broken, actively interrupting dispatching causing delays and workarounds.",
  critical: "App is unusable. Operations are being postponed due to this issue. Needs to be fixed ASAP."
};

const ErrorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUser();
  
  // Report state tracking
 
  const [reportText, setReportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true); // Controls collapsible visibility
  
  // Extract custom error messages passed via navigation state, or fall back to defaults
  const state = location.state as ErrorState || {};
  const errorTitle = state.title || "Oops! Something Went Wrong :(";
  const errorMessage = state.message || "Something went wrong on our end. Please try refreshing or contact system operations.";
  const actionText = state.actionText || "Return to Dashboard";
  const actionPath = state.actionPath || "/dash";
  const errorDetails = state.details || "Unknown Error.";
  const priority = state.priority || 'low';
  const required = state.required || false; // Default to false if not provided

  const [severity, setSeverity] = useState<SeverityLevel>(priority || 'low'); // Default to 'low' if not provided in state

  const handleAction = () => {
    // If routing back to dashboard, ensure user session context is preserved
    const savedUser = localStorage.getItem("gsdc_user");
    if (savedUser && actionPath === "/dash") {
      const userInfo = JSON.parse(savedUser);
      userInfo.CurrentNav = "/dash";
      localStorage.setItem("gsdc_user", JSON.stringify(userInfo));
      navigate("/dash", { state: { user: userInfo } });
    } else {
      navigate(actionPath);
    }
  };

  const handleSendReport = async () => {
    if (!reportText.trim()) return;
    setIsSubmitting(true);
    console.log("Preparing to send error report with the following details:");
    // Prepare the payload based on your schema
    const payload = {
      name: user.user?.FullName || "Unknown User",
      priority: severity,
      title: errorTitle,
      message: reportText,
      error: errorDetails
    };

    try {
      const response = await fetch(ERROR_EMAIL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Successful submission logic
      console.log("Telemetry transmitted successfully");
      handleAction();
    } catch (err) {
      console.error("Failed to transmit error log:", err);
      // Optional: Add a small error state here to notify the user if the "Send" failed
      setIsSubmitting(false);
    }
  };

  return (
    <div className="error-page-container">
      <div className="error-card-wrapper">
        <div className="error-card-inner">
          <div className="error-icon-shield">⚠️</div>
          <h1 className="error-title">{errorTitle}</h1>
          <p className="error-message">{errorMessage}</p>
          
          {/* Integrated Telemetry Report Form */}
          <div className="inline-report-section">
            <h3 className="report-section-heading">Create a Ticket to Development Team</h3>
            
            {/* Priority Selection Row */}
            <div className="severity-group">
              <span className="label-text">Priority:</span>
              <div className="radio-options">
                {(['low', 'medium', 'high', 'critical'] as SeverityLevel[]).map((level) => (
                  <label key={level} className={`radio-label severity-${level} ${severity === level ? 'active' : ''}`}>
                    <input 
                      type="radio" 
                      name="severity" 
                      value={level} 
                      checked={severity === level}
                      onChange={(e) => setSeverity(e.target.value as SeverityLevel)} 
                    />
                    <span className="capitalize-text">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Dynamic Contextual Hint Span */}
            <div className={`priority-hint-container hint-${severity}`}>
              <span className="priority-hint-text">
                {SEVERITY_HINTS[severity]}
              </span>
            </div>

            {/* Simulated Gradient Outline Container */}
            <div className="gradient-input-wrapper">
              <div className="inner-input-container">
                <textarea 
                  placeholder="Please provide a summary of what you were doing when the error occurred, any specific actions that triggered it, and any other details you think might help the development team investigate the issue."
                  className="report-textarea"
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Collapsible Technical Error Details Panel */}
            <div className="error-details-collapsible">
              <button 
                type="button"
                className={`details-toggle-trigger ${isDetailsExpanded ? 'active' : ''}`}
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              >
                <span>Error Details</span>
                <span className="arrow-icon">{isDetailsExpanded ? '▲' : '▼'}</span>
              </button>
              
              <div className={`details-content-panel ${isDetailsExpanded ? 'expanded' : ''}`}>
                <pre className="details-raw-output">{errorDetails}</pre>
              </div>
            </div>
          </div>

          {/* Validation Message */}
          {!reportText.trim() && !isSubmitting && (
            <div className="validation-hint">
              <span className="hint-icon">ℹ</span> 
              Please describe the issue above to enable the send button.
            </div>
          )}

          {/* Core Layout Action Modals */}
          <div className="error-action-row">
            {(user.user?.Position === 'Developer' || (!required)) && (
              <button 
                className="error-action-btn secondary-back" 
                onClick={handleAction}
                disabled={isSubmitting}
              >
                {actionText}
              </button>
            )}
            <button 
              className="error-action-btn primary-send" 
              onClick={handleSendReport}
              disabled={isSubmitting || !reportText.trim()}
            >
              {isSubmitting ? "Transmitting..." : "Send Report & Return"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;