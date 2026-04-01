/**
 * Modal Component
 * 
 * A generic modal dialog component.
 * Supports custom title, width, and close behavior.
 * Handles Escape key to close.
 * 
 */
import React, { useEffect } from 'react';
import './Modal.css';

export default function Modal({ isOpen, onClose, children, title, maxWidth = '800px' }) {
  useEffect(() => {
    // Handle Escape key to close modal
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && typeof onClose === 'function') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent background scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-wrapper"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header-bar">
            <h2 className="modal-title">{title}</h2>
            <button
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}
        <div className="modal-body-content">
          {children}
        </div>
      </div>
    </div>
  );
}
