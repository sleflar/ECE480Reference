/**
 * Accordion Component
 * 
 * A collapsible content container.
 * Displays a title bar that toggles the visibility of children content.
 * 
 */
import { useState } from 'react';
import './Accordion.css';

export default function Accordion({ title, children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="accordion-item">
      <button
        className="accordion-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${title}`}
      >
        <span className="accordion-title">{title}</span>
        {/* Toggle icon based on state */}
        <span className="accordion-icon">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && (
        <div className="accordion-content" id={`accordion-content-${title}`}>
          {children}
        </div>
      )}
    </div>
  );
}
