/**
 * Connection Status Indicator Component
 * 
 * Displays the current status of the ROS connection (middleware and vehicle).
 * Uses color-coded icons and text to indicate state (connected, error, etc.).
 * 
 */
import React, { useEffect, useState } from 'react';
import { useROS } from '../utils/ROSContext';
import './ConnectionStatus.css';

export default function ConnectionStatus() {
  const { middlewareConnected, vehicleConnected, currentCarIp, error } = useROS();
  const [statusInfo, setStatusInfo] = useState(null);

  useEffect(() => {
    // Determine status based on connection state and errors
    if (error) {
      // Ensure we never pass an Error object directly into JSX
      const errorText = error?.message || String(error);
      setStatusInfo({
        state: 'error',
        color: '#F44336',
        icon: '○',
        mainText: 'IP incorrect or service not functional',
        subText: errorText
      });
    } else if (!currentCarIp) {
      // No IP configured
      setStatusInfo({
        state: 'disconnected',
        color: '#F44336',
        icon: '○',
        mainText: 'IP incorrect or service not functional',
        subText: 'No IP configured'
      });
    } else if (!middlewareConnected) {
      // Connected to ROSBridge but middleware is not responding
      setStatusInfo({
        state: 'middleware-only',
        color: '#FFA726',
        icon: '◐',
        mainText: 'Connecting to middleware',
        subText: currentCarIp
      });
    } else if (!vehicleConnected) {
      // Middleware connected, but vehicle (robot) is not
      setStatusInfo({
        state: 'middleware-connected',
        color: '#FFD54F',
        icon: '◑',
        mainText: 'Attempting to connect to car',
        subText: currentCarIp
      });
    } else {
      // Fully connected to vehicle
      setStatusInfo({
        state: 'fully-connected',
        color: '#4CAF50',
        icon: '●',
        mainText: 'Fully connected',
        subText: currentCarIp
      });
    }
  }, [currentCarIp, middlewareConnected, vehicleConnected, error]);

  if (!statusInfo) return null;

  // Keep the status visually compact; expose detailed subText via title and aria-label
  const ariaLabel = `${statusInfo.mainText}${statusInfo.subText ? ' — ' + statusInfo.subText : ''}`;

  return (
    <div className="connection-status">
      <div
        className="status-display"
        title={statusInfo.subText || ''}
        aria-label={ariaLabel}
      >
        <span className="status-icon" style={{ color: statusInfo.color }}>
          {statusInfo.icon}
        </span>
        <div className="status-text">
          <div className="main-text">{statusInfo.mainText}</div>
          <div className="sub-text">{statusInfo.subText}</div>
        </div>
      </div>
    </div>
  );
}
