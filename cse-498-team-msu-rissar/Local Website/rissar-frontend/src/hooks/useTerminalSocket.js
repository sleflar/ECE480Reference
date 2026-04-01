/**
 * useTerminalSocket
 * 
 * Hook to manage the WebSocket connection for the terminal.
 * Connects to the backend socket.io server and handles events like connect, disconnect, and terminal_output.
 * 
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useTerminalStore } from '../stores/terminalStore';

export function useTerminalSocket() {
  const socketRef = useRef(null);
  const {
    setSocket,
    setSocketConnected,
    addOutput,
  } = useTerminalStore();

  useEffect(() => {
    // Prevent multiple connections
    if (socketRef.current) {
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

    // Initialize socket connection
    const socket = io(backendUrl, {
      namespace: '/terminal',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;
    setSocket(socket);

    // Handle connection events
    socket.on('connect', () => {
      setSocketConnected(true);
    });

    // Handle incoming terminal output
    socket.on('terminal_output', (data) => {
      const { terminal_id, chunk } = data;
      if (chunk) {
        addOutput(terminal_id, chunk);
      }
    });

    // Handle errors
    socket.on('terminal_error', (data) => {
      console.error('Terminal error:', data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [setSocket, setSocketConnected, addOutput]);
}
