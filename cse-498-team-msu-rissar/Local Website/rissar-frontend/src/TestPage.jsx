/**
 * TestPage
 * 
 * Debugging page for testing ROS bridge connection and topic subscriptions.
 * 
 */
import React, { useState, useEffect, useRef } from 'react';
import './TestPage.css';

export default function TestPage() {
    const [ws, setWs] = useState(null);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [rosbridgeRunning, setRosbridgeRunning] = useState(false);
    const [rosbridgeChecking, setRosbridgeChecking] = useState(false);
    const [rosbridgeStarting, setRosbridgeStarting] = useState(false);
    const [logs, setLogs] = useState([]);
    const [speedData, setSpeedData] = useState({ value: '--', time: 'No data' });
    const [steeringData, setSteeringData] = useState({ value: '--', time: 'No data' });
    const [statusData, setStatusData] = useState({ value: '--', time: 'No data' });
    const logRef = useRef(null);

    const ROS_URL = 'ws://192.168.8.4:9090';
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { timestamp, message, type }]);
    };

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
        addLog('WebSocket test page loaded', 'info');
        addLog(`Target: ${ROS_URL}`, 'info');
        checkRosbridgeStatus();
    }, []);

    const handleConnect = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            addLog('Already connected', 'info');
            return;
        }

        setConnecting(true);
        addLog(`Connecting to ${ROS_URL}...`, 'info');

        const websocket = new WebSocket(ROS_URL);

        websocket.onopen = () => {
            addLog('Connected to ROS Bridge!', 'success');
            setConnected(true);
            setConnecting(false);
        };

        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.op === 'publish') {
                handleMessage(data);
            } else {
                addLog(`Received: ${JSON.stringify(data)}`, 'data');
            }
        };

        websocket.onerror = (error) => {
            addLog(`WebSocket error: ${error.message || 'Connection failed'}`, 'error');
            setConnecting(false);
        };

        websocket.onclose = () => {
            addLog('Connection closed', 'info');
            setConnected(false);
            setConnecting(false);
        };

        setWs(websocket);
    };

    const handleDisconnect = () => {
        if (ws) {
            ws.close();
            setWs(null);
        }
    };

    const subscribeToTopic = (topic, messageType) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            addLog('Not connected to ROS Bridge', 'error');
            return;
        }

        const subscribeMsg = {
            op: 'subscribe',
            topic: topic,
            type: messageType
        };

        ws.send(JSON.stringify(subscribeMsg));
        addLog(`Subscribed to ${topic} (${messageType})`, 'success');
    };

    const listTopics = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            addLog('Not connected to ROS Bridge', 'error');
            return;
        }

        const msg = {
            op: 'call_service',
            service: '/rosapi/topics',
            type: 'rosapi/Topics'
        };

        ws.send(JSON.stringify(msg));
        addLog('Requesting topic list...', 'info');
    };

    const handleMessage = (data) => {
        const topic = data.topic;
        const msg = data.msg;

        if (topic === '/vehicle/speed') {
            setSpeedData({
                value: msg.data.toFixed(2) + ' m/s',
                time: new Date().toLocaleTimeString()
            });
        } else if (topic === '/vehicle/steering_angle') {
            setSteeringData({
                value: msg.data.toFixed(2) + '°',
                time: new Date().toLocaleTimeString()
            });
        } else if (topic === '/vehicle/status') {
            setStatusData({
                value: msg.data,
                time: new Date().toLocaleTimeString()
            });
        }

        addLog(`${topic}: ${JSON.stringify(msg)}`, 'data');
    };

    const clearLog = () => {
        setLogs([]);
    };

    // Rosbridge control functions
    const checkRosbridgeStatus = async () => {
        setRosbridgeChecking(true);
        try {
            const response = await fetch(`${BACKEND_URL}/rosbridge/status`);
            const data = await response.json();

            if (data.status === 'success') {
                setRosbridgeRunning(data.running && data.port_accessible);
                if (data.running) {
                    addLog('Rosbridge is running on port 9090', 'success');
                } else {
                    addLog('Rosbridge is not running', 'info');
                }
            }
        } catch (error) {
            addLog(`Failed to check rosbridge status: ${error.message}`, 'error');
            setRosbridgeRunning(false);
        } finally {
            setRosbridgeChecking(false);
        }
    };

    const startRosbridge = async () => {
        setRosbridgeStarting(true);
        addLog('Starting rosbridge...', 'info');

        try {
            const response = await fetch(`${BACKEND_URL}/rosbridge/start`, {
                method: 'POST',
            });
            const data = await response.json();

            if (data.status === 'success') {
                addLog('Rosbridge started successfully!', 'success');
                addLog('Test publisher is now generating data', 'success');
                setRosbridgeRunning(true);

                // Wait a moment then try to connect
                setTimeout(() => {
                    addLog('Attempting auto-connect...', 'info');
                    handleConnect();
                }, 2000);
            } else if (data.status === 'already_running') {
                addLog('Rosbridge is already running', 'info');
                setRosbridgeRunning(true);
            } else if (data.requires_manual_start) {
                // Show manual start instructions
                addLog('Manual start required from your host machine:', 'info');
                addLog('Copy this command:', 'info');
                addLog(data.command, 'info');
                addLog('', 'info');
                addLog('Paste and run it in your terminal, then click "Check Status"', 'success');

                // Copy command to clipboard
                try {
                    await navigator.clipboard.writeText(data.command);
                    addLog('Command copied to clipboard!', 'success');
                } catch (e) {
                    addLog('Could not auto-copy. Please copy the command above manually.', 'info');
                }
            } else {
                addLog(`Failed to start rosbridge: ${data.message}`, 'error');
            }
        } catch (error) {
            addLog(`Error starting rosbridge: ${error.message}`, 'error');
        } finally {
            setRosbridgeStarting(false);
        }
    };

    const stopRosbridge = async () => {
        addLog('Stopping rosbridge...', 'info');

        try {
            // Send a POST request to the backend to stop the rosbridge server
            const response = await fetch(`${BACKEND_URL}/rosbridge/stop`, {
                method: 'POST',
            });
            const data = await response.json();

            // Check the response status from the backend
            if (data.status === 'success' || data.status === 'partial') {
                addLog('Rosbridge stopped', 'success');
                setRosbridgeRunning(false);

                // Disconnect WebSocket if connected
                if (ws) {
                    handleDisconnect();
                }
            } else {
                // Log error if stopping failed
                addLog(`Failed to stop rosbridge: ${data.message}`, 'error');
            }
        } catch (error) {
            // Catch and log any network or other errors during the fetch operation
            addLog(`Error stopping rosbridge: ${error.message}`, 'error');
        }
    };

    const getStatusClass = () => {
        if (connected) return 'connected';
        if (connecting) return 'connecting';
        return 'disconnected';
    };

    const getStatusText = () => {
        if (connected) return 'Connected';
        if (connecting) return 'Connecting...';
        return 'Disconnected';
    };

    return (
        <div className="test-page" style={{
            height: 'calc(100vh - 60px)',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '15px 20px',
            boxSizing: 'border-box',
            maxWidth: '100%'
        }}>
            <h1 style={{ margin: '0 0 15px 0', fontSize: '22px' }}>ROS Bridge WebSocket Test</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', flex: '0 0 auto' }}>
                {/* Rosbridge Control Section */}
                <div className="test-container" style={{ background: '#1a2332', margin: 0, padding: '12px' }}>
                    <h2 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Rosbridge Server Control</h2>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                        <div className={`test-status ${rosbridgeRunning ? 'connected' : 'disconnected'}`}
                            style={{ flex: '0 0 auto', minWidth: '130px', padding: '5px 10px', fontSize: '13px' }}>
                            {rosbridgeRunning ? 'Running' : 'Stopped'}
                        </div>
                        <button
                            className="test-btn"
                            onClick={checkRosbridgeStatus}
                            disabled={rosbridgeChecking}
                            style={{ background: '#607D8B', padding: '5px 10px', fontSize: '13px' }}
                        >
                            {rosbridgeChecking ? 'Checking...' : 'Check Status'}
                        </button>
                    </div>
                    <div className="test-button-group" style={{ gap: '8px' }}>
                        <button
                            className="test-btn"
                            onClick={startRosbridge}
                            disabled={rosbridgeRunning || rosbridgeStarting}
                            style={{ background: '#4CAF50', padding: '5px 10px', fontSize: '13px' }}
                        >
                            {rosbridgeStarting ? 'Starting...' : 'Start Rosbridge'}
                        </button>
                        <button
                            className="test-btn"
                            onClick={stopRosbridge}
                            disabled={!rosbridgeRunning}
                            style={{ background: '#f44336', padding: '5px 10px', fontSize: '13px' }}
                        >
                            Stop Rosbridge
                        </button>
                    </div>
                </div>

                <div className="test-container" style={{ margin: 0, padding: '12px' }}>
                    <h2 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>WebSocket Connection</h2>
                    <div className={`test-status ${getStatusClass()}`} style={{ marginBottom: '10px', padding: '5px 10px', fontSize: '13px' }}>
                        {getStatusText()}
                    </div>
                    <div className="test-button-group" style={{ gap: '8px' }}>
                        <button
                            className="test-btn"
                            onClick={handleConnect}
                            disabled={connected}
                            style={{ padding: '5px 10px', fontSize: '13px' }}
                        >
                            Connect
                        </button>
                        <button
                            className="test-btn"
                            onClick={handleDisconnect}
                            disabled={!connected}
                            style={{ padding: '5px 10px', fontSize: '13px' }}
                        >
                            Disconnect
                        </button>
                        <button
                            className="test-btn"
                            onClick={clearLog}
                            style={{ padding: '5px 10px', fontSize: '13px' }}
                        >
                            Clear Log
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px', flex: '1 1 auto', minHeight: 0, marginTop: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', minHeight: 0 }}>
                    <div className="test-container" style={{ margin: 0, padding: '12px', flex: '0 0 auto' }}>
                        <h2 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Subscribe to Topics</h2>
                        <div className="test-button-group" style={{ gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                className="test-btn"
                                onClick={() => subscribeToTopic('/vehicle/speed', 'std_msgs/Float32')}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                                Subscribe to Speed
                            </button>
                            <button
                                className="test-btn"
                                onClick={() => subscribeToTopic('/vehicle/steering_angle', 'std_msgs/Float32')}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                                Subscribe to Steering
                            </button>
                            <button
                                className="test-btn"
                                onClick={() => subscribeToTopic('/vehicle/status', 'std_msgs/String')}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                                Subscribe to Status
                            </button>
                            <button
                                className="test-btn"
                                onClick={listTopics}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                                List All Topics
                            </button>
                        </div>
                    </div>

                    <div className="test-container" style={{ margin: 0, padding: '12px', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Console Log</h2>
                        <div className="test-log" ref={logRef} style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
                            {logs.map((log, index) => (
                                <div key={index} className={`test-log-entry ${log.type}`} style={{ fontSize: '12px', padding: '3px 5px' }}>
                                    [{log.timestamp}] {log.message}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="test-container" style={{ margin: 0, padding: '12px' }}>
                    <h2 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Live Data</h2>
                    <div className="test-data-display" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="test-data-card" style={{ padding: '10px' }}>
                            <h3 style={{ margin: '0 0 5px 0', fontSize: '13px' }}>Vehicle Speed</h3>
                            <div className="test-data-value" style={{ fontSize: '18px' }}>{speedData.value}</div>
                            <div className="test-data-timestamp" style={{ fontSize: '11px' }}>{speedData.time}</div>
                        </div>
                        <div className="test-data-card" style={{ padding: '10px' }}>
                            <h3 style={{ margin: '0 0 5px 0', fontSize: '13px' }}>Steering Angle</h3>
                            <div className="test-data-value" style={{ fontSize: '18px' }}>{steeringData.value}</div>
                            <div className="test-data-timestamp" style={{ fontSize: '11px' }}>{steeringData.time}</div>
                        </div>
                        <div className="test-data-card" style={{ padding: '10px' }}>
                            <h3 style={{ margin: '0 0 5px 0', fontSize: '13px' }}>Status</h3>
                            <div className="test-data-value" style={{ fontSize: '15px' }}>
                                {statusData.value}
                            </div>
                            <div className="test-data-timestamp" style={{ fontSize: '11px' }}>{statusData.time}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
