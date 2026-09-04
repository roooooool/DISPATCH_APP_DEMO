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
  hideX?: boolean;
  hidden?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  onClose,
  children,
  width,
  height,
  contentClassName,
  contentStyle,
  overlayBlur,
  overlayColor,
  hideX = false,
  hidden = false
}) => {
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
  if (hidden) {
    overlayStyle.display = 'none';
  }

  return createPortal(
    <div
      className={`modal-overlay ${hidden ? 'is-hidden' : ''}`}
      style={overlayStyle}
      onClick={onClose}
    >
      <div
        className={`modal-content ${contentClassName || ''}`}
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        {!hideX && <button className="modal-close" onClick={onClose}>&times;</button>}
        {children}
      </div>
    </div>,
    modalRoot
  );
};

export default Modal;