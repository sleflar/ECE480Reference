/**
 * ROSContext
 * 
 * ROS Context Provider
 * React context for managing ROS connection state across the application
 * 
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getROSConnectionManager } from './rosConnection';

const ROSContext = createContext(null);

/**
 * ROS Provider Component
 * Wraps the application and provides ROS connection to all children
 */
export function ROSProvider({ children, rosUrl }) {
  const [connectionManager] = useState(() => {
    // Get Flask backend URL from environment or use default
    const url = rosUrl || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    return getROSConnectionManager(url);
  });

  const [connectionState, setConnectionState] = useState({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0
  });

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = connectionManager.addListener((event) => {
      switch (event.type) {
        case 'connected':
          setConnectionState(prev => ({
            ...prev,
            connected: true,
            connecting: false,
            error: null
          }));
          break;

        case 'disconnected':
          // ROS connection lost
          setConnectionState(prev => ({
            ...prev,
            connected: false,
            connecting: false
          }));
          break;

        case 'reconnecting':
          // Attempting to reconnect to ROS
          setConnectionState(prev => ({
            ...prev,
            connecting: true,
            reconnectAttempts: event.attempts
          }));
          break;

        case 'error':
          // An error occurred during connection
          setConnectionState(prev => ({
            ...prev,
            error: event.error
          }));
          break;

        case 'reconnect_failed':
          // Max reconnection attempts reached, connection failed
          setConnectionState(prev => ({
            ...prev,
            connected: false,
            connecting: false,
            error: new Error('Max reconnection attempts reached')
          }));
          break;

        case 'status':
          // General status update (e.g., initial state)
          setConnectionState(prev => ({
            ...prev,
            connected: event.connected,
            connecting: event.connecting
          }));
          break;
      }
    });

    // Initial connection
    connectionManager.connect().catch(err => {
      console.error('Failed to connect to ROS:', err);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      // Note: We don't disconnect here to allow connection to persist
      // across navigation. Call connectionManager.disconnect() explicitly if needed.
    };
  }, [connectionManager]);

  const value = {
    socket: connectionManager.socket,
    connectionManager,  // Expose connectionManager for creating topics/services
    ...connectionState
  };

  return (
    <ROSContext.Provider value={value}>
      {children}
    </ROSContext.Provider>
  );
}

/**
 * Hook to access ROS connection
 */
export function useROS() {
  const context = useContext(ROSContext);
  if (!context) {
    throw new Error('useROS must be used within a ROSProvider');
  }
  return context;
}