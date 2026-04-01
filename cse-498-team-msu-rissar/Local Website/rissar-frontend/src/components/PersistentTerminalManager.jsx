/**
 * Persistent Terminal Manager Component
 * 
 * Manages multiple persistent terminal sessions.
 * Provides UI for creating, switching, and closing terminals.
 * Uses a backend API to maintain terminal state across page reloads.
 * 
 */
import React, { useState, useEffect } from 'react';
import SSHCommandModal from './SSHCommandModal';

export default function PersistentTerminalManager({ connectionId, isConnected }) {
  const [terminals, setTerminals] = useState([]);
  const [activeTerminalId, setActiveTerminalId] = useState(null);
  const [showNewTerminalDialog, setShowNewTerminalDialog] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState('');

  // Create a new persistent terminal session via backend API
  const createTerminal = async (name = 'Terminal', targetDir = '/home/user') => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
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
        const newTerminal = {
          id: data.terminal_id,
          name: data.name,
          cwd: data.target_dir,
          output: '',
        };
        setTerminals(prev => [...prev, newTerminal]);
        setActiveTerminalId(data.terminal_id);
        return data.terminal_id;
      }
    } catch (err) {
      console.error('Failed to create terminal:', err);
    }
  };

  // Close a terminal session via backend API
  const closeTerminal = async (terminalId) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
      await fetch(`${backendUrl}/api/connection/terminal/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminal_id: terminalId }),
      });

      setTerminals(prev => prev.filter(t => t.id !== terminalId));
      // Switch to another terminal if the active one was closed
      if (activeTerminalId === terminalId) {
        setActiveTerminalId(terminals.length > 1 ? terminals[0].id : null);
      }
    } catch (err) {
      console.error('Failed to close terminal:', err);
    }
  };

  const handleNewTerminal = async () => {
    if (newTerminalName.trim()) {
      await createTerminal(newTerminalName, '/home/user');
      setNewTerminalName('');
      setShowNewTerminalDialog(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {terminals.map(terminal => (
          <div
            key={terminal.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: activeTerminalId === terminal.id ? '#17453B' : '#f0f0f0',
              color: activeTerminalId === terminal.id ? 'white' : '#333',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onClick={() => setActiveTerminalId(terminal.id)}
          >
            {terminal.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(terminal.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
                marginLeft: '4px',
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() => setShowNewTerminalDialog(true)}
          style={{
            padding: '6px 12px',
            backgroundColor: '#17453B',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          New Terminal
        </button>
      </div>

      {showNewTerminalDialog && (
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '8px',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          border: '1px solid #ccc',
        }}>
          <input
            type="text"
            value={newTerminalName}
            onChange={(e) => setNewTerminalName(e.target.value)}
            placeholder="Terminal name"
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleNewTerminal();
            }}
            style={{
              flex: 1,
              padding: '6px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          />
          <button
            onClick={handleNewTerminal}
            style={{
              padding: '6px 12px',
              backgroundColor: '#17453B',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Create
          </button>
          <button
            onClick={() => setShowNewTerminalDialog(false)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#f0f0f0',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {activeTerminalId && (
        <SSHCommandModal
          isOpen={true}
          onClose={() => { }}
          connectionId={connectionId}
          terminalId={activeTerminalId}
          isBackgroundTerminal={true}
        />
      )}
    </div>
  );
}
