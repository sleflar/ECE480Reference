/**
 * Terminal Panel Component
 * 
 * Displays the content of the active terminal session.
 * Handles command input and output rendering.
 * Supports multiple tabs for different terminal sessions.
 * 
 */
import React, { useState, useEffect, useRef } from 'react';
import { useTerminalStore } from '../stores/terminalStore';
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const stripAnsiCodes = (text) => {
  if (!text) return text;
  return text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[[\d;]*[a-zA-Z]/g, '');
};

export default function TerminalPanel({ connectionId, isConnected }) {
  const {
    terminals,
    activeTerminal,
    createTerminal: storeCreateTerminal,
    selectTerminal,
    closeTerminal,
    addOutput,
  } = useTerminalStore();

  const [command, setCommand] = useState('');
  const [lastOutputLength, setLastOutputLength] = useState(0);
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [activeTerminal?.output]);

  // Focus input when active terminal changes
  useEffect(() => {
    if (activeTerminal && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeTerminal]);

  // Polling logic (to be replaced by WebSockets later)
  // Periodically fetches new terminal output from the backend
  useEffect(() => {
    if (!activeTerminal) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

    const pollOutput = async () => {
      try {
        // Request only new output since last known length
        const response = await fetch(`${backendUrl}/api/connection/terminal/output`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            terminal_id: activeTerminal.id,
            last_length: lastOutputLength,
          }),
        });

        const data = await response.json();
        if (response.ok && data.chunk) {
          addOutput(activeTerminal.id, data.chunk);
          setLastOutputLength(data.total_length);
        }
      } catch (err) {
        console.error('Failed to poll terminal output:', err);
      }
    };

    pollIntervalRef.current = setInterval(pollOutput, 200);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeTerminal?.id, lastOutputLength]);

  // Handle creating a new terminal tab
  const handleCreateTerminal = async () => {
    try {
      // Find first available terminal number for naming
      let terminalNumber = 1;
      while (terminals.some(t => t.name === `Terminal ${terminalNumber}`)) {
        terminalNumber++;
      }
      const name = `Terminal ${terminalNumber}`;

      // Create terminal session on backend
      const terminalId = await storeCreateTerminal(connectionId, name, '/home/user');
      selectTerminal(terminalId);
    } catch (error) {
      console.error('Failed to create terminal:', error);
    }
  };

  // Execute command in the active terminal
  const handleExecuteCommand = (e) => {
    e.preventDefault();
    if (!command.trim() || !activeTerminal) return;

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

    // Send command to backend for execution
    fetch(`${backendUrl}/api/connection/terminal/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        terminal_id: activeTerminal.id,
        command: command.trim(),
      }),
    }).catch(err => console.error('Command execution failed:', err));

    setCommand('');
  };

  // Close a terminal tab
  const handleCloseTerminal = (e, terminalId) => {
    e.stopPropagation(); // Prevent tab selection when closing
    closeTerminal(terminalId);

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    fetch(`${backendUrl}/api/connection/terminal/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminal_id: terminalId }),
    }).catch(err => console.error('Failed to close terminal:', err));
  };

  if (!isConnected) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-background">
        <TerminalIcon className="w-12 h-12 mb-4 opacity-20" />
        <p>Connect to a server to use the terminal</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Tabs Header */}
      <div className="flex items-center bg-muted/30 border-b border-border overflow-x-auto scrollbar-hide">
        {terminals.map(terminal => {
          const isActive = activeTerminal?.id === terminal.id;
          return (
            <div
              key={terminal.id}
              onClick={() => selectTerminal(terminal.id)}
              className={cn(
                "group flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer border-r border-border/50 transition-all min-w-[140px] justify-between select-none relative",
                isActive
                  ? "bg-background text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />}
              <div className="flex items-center gap-2 truncate">
                <TerminalIcon className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "opacity-70")} />
                <span className="truncate">{terminal.name}</span>
              </div>
              <button
                onClick={(e) => handleCloseTerminal(e, terminal.id)}
                className={cn(
                  "p-0.5 rounded-sm hover:bg-destructive/10 hover:text-destructive transition-all",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        <button
          onClick={handleCreateTerminal}
          className="p-2 ml-1 hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors rounded-sm"
          title="New Terminal"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Terminal Content */}
      {activeTerminal ? (
        <div className="flex-1 flex flex-col min-h-0 bg-muted/5 relative">
          {/* Left accent border */}
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary/10" />

          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-4 pl-6 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent selection:bg-primary/20"
            onClick={() => inputRef.current?.focus()}
          >
            {stripAnsiCodes(activeTerminal.output) || (
              <span className="text-muted-foreground opacity-50 italic">Terminal ready. Start typing...</span>
            )}
          </div>

          <form onSubmit={handleExecuteCommand} className="flex items-center gap-3 p-3 pl-5 border-t border-border bg-background shadow-sm">
            <span className="font-mono text-sm text-primary font-bold select-none">
              ➜
            </span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-foreground font-mono text-sm placeholder:text-muted-foreground/40"
              placeholder="Enter command..."
              autoComplete="off"
              spellCheck="false"
            />
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
          <div className="p-6 rounded-full bg-muted/20 mb-4">
            <TerminalIcon className="w-8 h-8 opacity-40" />
          </div>
          <p className="font-medium">No active terminal</p>
          <button
            onClick={handleCreateTerminal}
            className="mt-2 text-primary hover:underline text-sm font-medium"
          >
            Create a new terminal
          </button>
        </div>
      )}
    </div>
  );
}
