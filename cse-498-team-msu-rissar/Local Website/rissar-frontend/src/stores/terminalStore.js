/**
 * terminalStore
 * 
 * Zustand store for managing terminal state.
 * Handles creating, selecting, closing terminals, and managing terminal output.
 * Persists terminal configuration (id, name, cwd) to local storage.
 * 
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';

const useTerminalStore = create(
  persist(
    (set, get) => ({
      terminals: [],
      activeTerminal: null,
      socketConnected: false,
      socket: null,

      setSocket: (socket) => set({ socket }),

      setSocketConnected: (connected) => set({ socketConnected: connected }),

      // Create a new terminal session
      createTerminal: async (connectionId, name, targetDir) => {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
        try {
          const response = await fetch(`${backendUrl}/api/connection/terminal/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection_id: connectionId,
              name,
              target_dir: targetDir,
            }),
          });

          const data = await response.json();
          if (response.ok) {
            const terminal = {
              id: data.terminal_id,
              name: data.name,
              cwd: data.cwd || targetDir,
              output: '',
            };
            set(state => ({
              terminals: [...state.terminals, terminal],
            }));
            return data.terminal_id;
          }
        } catch (error) {
          console.error('Failed to create terminal:', error);
          throw error;
        }
      },

      // Select active terminal and subscribe to its output
      selectTerminal: (terminalId) => {
        set(state => {
          const terminal = state.terminals.find(t => t.id === terminalId);
          if (terminal) {
            return { activeTerminal: terminal };
          }
          return state;
        });

        const socket = get().socket;
        if (socket && socket.connected) {
          socket.emit('terminal_subscribe', { terminal_id: terminalId });
        }
      },

      // Close a terminal session
      closeTerminal: (terminalId) => {
        set(state => {
          const remaining = state.terminals.filter(t => t.id !== terminalId);
          const nextActive = state.activeTerminal?.id === terminalId
            ? remaining[0] || null
            : state.activeTerminal;

          return {
            terminals: remaining,
            activeTerminal: nextActive,
          };
        });

        const socket = get().socket;
        if (socket && socket.connected) {
          socket.emit('terminal_unsubscribe', { terminal_id: terminalId });
        }
      },

      // Append new output chunk to terminal buffer
      addOutput: (terminalId, chunk) => {
        set(state => ({
          terminals: state.terminals.map(t =>
            t.id === terminalId
              ? { ...t, output: t.output + chunk }
              : t
          ),
          activeTerminal:
            state.activeTerminal?.id === terminalId
              ? { ...state.activeTerminal, output: state.activeTerminal.output + chunk }
              : state.activeTerminal,
        }));
      },

      setLoading: (terminalId, loading) => {
        set(state => ({
          terminals: state.terminals.map(t =>
            t.id === terminalId ? { ...t, loading } : t
          ),
        }));
      },

      // Clear terminal output buffer
      clearOutput: (terminalId) => {
        set(state => ({
          terminals: state.terminals.map(t =>
            t.id === terminalId ? { ...t, output: '' } : t
          ),
          activeTerminal:
            state.activeTerminal?.id === terminalId
              ? { ...state.activeTerminal, output: '' }
              : state.activeTerminal,
        }));
      },
    }),
    {
      name: 'terminal-store',
      // Persist only necessary fields
      partialize: (state) => ({
        terminals: state.terminals.map(t => ({
          id: t.id,
          name: t.name,
          cwd: t.cwd,
        })),
        activeTerminal: state.activeTerminal
          ? {
            id: state.activeTerminal.id,
            name: state.activeTerminal.name,
            cwd: state.activeTerminal.cwd,
          }
          : null,
      }),
    }
  )
);

export default useTerminalStore;

export { useTerminalStore };
