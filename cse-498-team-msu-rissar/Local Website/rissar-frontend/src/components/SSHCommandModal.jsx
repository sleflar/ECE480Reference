/**
 * SSH Command Modal Component
 * 
 * A terminal interface for executing SSH commands on the connected vehicle.
 * Supports both simple preset commands and an advanced interactive terminal.
 * 
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  /* DialogDescription unused */
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PRESET_COMMANDS = [
  { label: 'Start Car', command: 'ros2 launch launch_pkg launch_car.launch.py', targetDir: '/home/user/ros2_ws' },
  { label: 'Start Motor', command: 'ros2 run vesc_driver vesc_driver_node --ros-args -p port:=/dev/sensors/vesc -p speed_max:=20000.0 -p speed_min:=-20000.0 -p current_max:=100.0 -p current_min:=0.0 -p brake_max:=200000.0 -p brake_min:=-20000.0 -p servo_max:=1.0 -p servo_min:=0.0 -p duty_cycle_max:=1.0 -p duty_cycle_min:=-1.0 -p enable_imu:=False --log-level debug', targetDir: '/home/user/ros2_ws' },
  { label: 'List Directory', command: 'ls -l' },
  { label: 'Current Directory', command: 'pwd' },
  { label: 'Disk Usage', command: 'df -h' },
];

export default function SSHCommandModal({ isOpen, onClose, connectionId, terminalId, isBackgroundTerminal = false }) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [currentDir, setCurrentDir] = useState('/home/user');
  const outputEndRef = useRef(null);

  // Poll for terminal output if in background mode
  useEffect(() => {
    if (!isBackgroundTerminal || !terminalId) return;

    const pollInterval = setInterval(async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
        const response = await fetch(`${backendUrl}/api/connection/terminal/output`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ terminal_id: terminalId }),
        });

        const data = await response.json();
        if (response.ok) {
          setOutput(data.output);
          setCurrentDir(data.cwd);
        }
      } catch (err) {
        console.error('Failed to poll terminal output:', err);
      }
    }, 500);

    return () => clearInterval(pollInterval);
  }, [terminalId, isBackgroundTerminal]);

  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  // Executes a command on the backend
  // Supports both persistent terminal sessions and one-off command execution
  // Executes a command on the backend
  // Supports both persistent terminal sessions and one-off command execution
  const handleExecuteCommand = async (cmd, targetDir = null) => {
    if (!cmd || !cmd.trim()) {
      setError('Please enter a command');
      return;
    }

    setError('');
    setExecuting(true);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

      if (isBackgroundTerminal && terminalId) {
        // Execute in persistent terminal session
        await fetch(`${backendUrl}/api/connection/terminal/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            terminal_id: terminalId,
            command: cmd,
          }),
        });
        setCommand('');
      } else {
        // Execute as one-off command
        const body = {
          connection_id: connectionId,
          command: cmd,
        };

        if (targetDir) {
          body.target_dir = targetDir;
        }

        const response = await fetch(`${backendUrl}/api/connection/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (response.ok) {
          const result = data.output || '';
          setOutput(prev => prev + `$ ${cmd}\n${result}\n`);
          setCurrentDir(data.cwd || currentDir);
          setCommand('');
        } else {
          const errorMsg = data.error || 'Command execution failed';
          setOutput(prev => prev + `$ ${cmd}\nError: ${errorMsg}\n\n`);
          setError(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = 'Network error executing command';
      setOutput(prev => prev + `$ ${cmd}\nError: ${errorMsg}\n\n`);
      setError(errorMsg);
    } finally {
      setExecuting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleExecuteCommand(command);
  };

  const handlePresetCommand = (preset) => {
    handleExecuteCommand(preset.command, preset.targetDir);
  };

  const handleClearOutput = () => {
    setOutput('');
    setError('');
  };

  const handleClose = () => {
    setCommand('');
    setOutput('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] bg-white dark:bg-[#0b0b0b]">
        <DialogHeader>
          <DialogTitle>SSH Terminal</DialogTitle>
          {/* <DialogDescription unused /> */}
        </DialogHeader>

        <Tabs defaultValue="advanced" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">Simple</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-white bg-red-600 dark:bg-red-700 border border-red-700 dark:border-red-600 rounded">
                {error}
              </div>
            )}

            <div className="bg-gray-900 dark:bg-black border border-gray-700 dark:border-gray-800 rounded p-4 font-mono text-sm text-gray-300 dark:text-gray-400 min-h-64 max-h-80 overflow-y-auto whitespace-pre-wrap break-words">
              {output || 'Command output will appear here...'}
              <div ref={outputEndRef} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PRESET_COMMANDS.map((preset) => (
                <Button
                  key={preset.label}
                  onClick={() => handlePresetCommand(preset)}
                  disabled={executing}
                  className="bg-[#008208] text-white shadow-md hover:bg-[#17453B] focus-visible:ring-[#17453B]"
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <Button
              onClick={handleClearOutput}
              disabled={executing}
              variant="outline"
              className="w-full"
            >
              Clear Output
            </Button>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-white bg-red-600 dark:bg-red-700 border border-red-700 dark:border-red-600 rounded">
                {error}
              </div>
            )}

            <div className="bg-gray-900 dark:bg-black border border-gray-700 dark:border-gray-800 rounded p-4 font-mono text-sm text-gray-300 dark:text-gray-400 min-h-64 max-h-80 overflow-y-auto whitespace-pre-wrap break-words">
              {output || 'Command output will appear here...'}
              <div ref={outputEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="font-mono text-sm text-gray-500 dark:text-gray-600 whitespace-nowrap">
                  {currentDir} $
                </span>
                <Input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Enter command..."
                  disabled={executing}
                  className="flex-1 font-mono text-sm dark:border-gray-600 dark:bg-black dark:text-white dark:placeholder-gray-500"
                />
              </div>
              <Button
                type="submit"
                disabled={executing}
                className="bg-[#008208] text-white shadow-md hover:bg-[#17453B] focus-visible:ring-[#17453B]"
              >
                {executing ? 'Running...' : 'Run'}
              </Button>
              <Button
                type="button"
                onClick={handleClearOutput}
                disabled={executing}
                variant="outline"
              >
                Clear
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
