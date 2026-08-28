import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './comp_css/OEDuplicateWarningModal.css';

interface OEDuplicateWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    duplicateOE?: string;
}

export const OEDuplicateWarningModal: React.FC<OEDuplicateWarningModalProps> = ({
    isOpen,
    onClose,
    duplicateOE
}) => {
    if (!isOpen) return null;

    return (
        <div className="oe-modal-overlay" onClick={onClose}>
            <div
                className="oe-modal-gradient-wrapper"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="oe-modal-content">
                    <button
                        className="oe-modal-close-btn"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>

                    <div className="oe-modal-header">
                        <div className="oe-modal-icon-badge">
                            <AlertTriangle size={28} />
                        </div>
                        <h3>Duplicate OE Detected</h3>
                    </div>

                    <div className="oe-modal-body">
                        <p>
                            The Order Entry (OE) identifier{' '}
                            {duplicateOE ? <strong>"{duplicateOE}"</strong> : 'you selected'} already exists in the system.
                        </p>
                        <p className="oe-modal-subtext">
                            Duplicate OE entries are not allowed. Please verify the OE number and try again.
                        </p>
                    </div>

                    <div className="oe-modal-footer">
                        <button className="oe-modal-confirm-btn" onClick={onClose}>
                            Acknowledge & Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OEDuplicateWarningModal;