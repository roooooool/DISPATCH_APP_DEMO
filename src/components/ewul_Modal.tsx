import React from 'react';
import { createPortal } from 'react-dom';
import './comp_css/ewul_Modal.css';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  width?: string | number;
  height?: string | number;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  overlayBlur?: number; // e.g., 5
  overlayColor?: string; // e.g., 'rgba(0, 8, 45, 0.85)'
}

const Modal: React.FC<ModalProps> = ({ onClose, children, width, height, contentClassName, contentStyle, overlayBlur, overlayColor }) => {
  const modalRoot = document.getElementById('modal-root') || document.body;

  const modalStyle: React.CSSProperties = {
    width: width,
    height: height,
    ...(contentStyle || {}),
  };

  const overlayStyle: React.CSSProperties = {};
  if (overlayColor) {
    overlayStyle.backgroundColor = overlayColor;
  }
  if (overlayBlur) {
    overlayStyle.backdropFilter = `blur(${overlayBlur}px)`;
  }


  return createPortal(
    <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
      <div 
        className={`modal-content ${contentClassName || ''}`} 
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>&times;</button>
        {children}
      </div>
    </div>,
    modalRoot
  );
};

export default Modal;
