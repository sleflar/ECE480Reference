/**
 * Joystick Control Component
 * 
 * Provides a virtual joystick for controlling the vehicle.
 * Supports both on-screen touch/mouse interaction and physical gamepad input.
 * Publishes sensor_msgs/Joy messages to ROS.
 * 
 */
import React, { useRef, useState, useEffect } from "react";
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import ROSLIB from "roslib";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function Joystick({
    rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
    topicName = '/joy',
    simpleView = false
}) {
    const MAX_JOYSTICK_SIZE = 340;
    const [connected, setConnected] = useState(false);
    const [debugMode, setDebugMode] = useState(false);
    const [speedMode, setSpeedMode] = useState('0');
    const [currentValues, setCurrentValues] = useState({
        steering: 0,
        throttle: 0,
        brake: 0
    });

    const [normalizedPosition, setNormalizedPosition] = useState({ x: 0, y: 0 });

    // Track input source
    const [inputSource, setInputSource] = useState('none'); // 'none', 'hardware', 'virtual'

    const [buttons, setButtons] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const rosbridgeRef = useRef(null);
    const topicRef = useRef(null);
    const speedModeTopicRef = useRef(null);
    const gamepadIndexRef = useRef(null);
    const animationFrameRef = useRef(null);
    const virtualJoystickActive = useRef(false);
    const lastPublishTime = useRef(0);
    const baseRef = useRef(null);
    const surfaceRef = useRef(null);
    const [baseSize, setBaseSize] = useState(0);
    const [gamepadConnected, setGamepadConnected] = useState(false);
    const inputSourceRef = useRef('none');

    useEffect(() => {
        const rosbridge = getRosbridgeInstance(rosbridgeUrl);
        rosbridgeRef.current = rosbridge;

        const removeListener = rosbridge.addListener((event) => {
            if (event.type === 'connected') {
                setConnected(true);
            } else if (event.type === 'disconnected') {
                setConnected(false);
            }
        });

        rosbridge.connect().catch((err) => {
            console.error('Failed to connect to rosbridge:', err);
        });

        return () => {
            removeListener();
            if (topicRef.current) {
                topicRef.current.unadvertise();
                topicRef.current = null;
            }
        };
    }, [rosbridgeUrl]);

    // Setup Joy topic
    useEffect(() => {
        if (!connected || !rosbridgeRef.current) return;

        try {
            const topic = rosbridgeRef.current.createTopic(
                topicName,
                'sensor_msgs/msg/Joy'
            );
            topicRef.current = topic;
            topic.advertise();
            console.log(`Successfully advertised to ${topicName}`);

            const speedModeTopic = rosbridgeRef.current.createTopic(
                '/car1_ns/set_speed_mode',
                'std_msgs/msg/Int32'
            );
            speedModeTopicRef.current = speedModeTopic;
            speedModeTopic.advertise();
        } catch (err) {
            console.error('Failed to advertise to topics:', err);
        }

        return () => {
            if (topicRef.current) {
                topicRef.current.unadvertise();
            }
            if (speedModeTopicRef.current) {
                speedModeTopicRef.current.unadvertise();
            }
        };
    }, [connected, topicName]);

    // Publish Joy message to ROS
    const publishJoyMessage = (steering, throttle, brake, buttons = []) => {
        if (!topicRef.current) return;

        const now = Date.now();
        if (now - lastPublishTime.current < 50) return; // 20Hz max

        // Map inputs to axes array (standard ROS Joy mapping)
        const axes = [
            steering,    // axes[0]: steering
            0.0,         // axes[1]: unused
            brake,       // axes[2]: brake
            0.0,         // axes[3]: unused
            0.0,         // axes[4]: unused
            throttle     // axes[5]: throttle
        ];

        // Update current values for debug display
        setCurrentValues({ steering, throttle, brake });

        if (debugMode) {
            console.log(`Publishing - Steering: ${steering.toFixed(3)}, Throttle: ${throttle.toFixed(3)}, Brake: ${brake.toFixed(3)}`);
        }

        topicRef.current.publish(new ROSLIB.Message({
            axes: axes,
            buttons: buttons
        }));

        lastPublishTime.current = now;
        setCurrentValues({
            steering: steering,
            throttle: throttle,
            brake: brake
        });
    };

    // Handle Gamepad Connection/Disconnection
    useEffect(() => {
        const handleGamepadConnected = (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            setInputSource('hardware');
            inputSourceRef.current = 'hardware';
            setGamepadConnected(true);
            gamepadIndexRef.current = e.gamepad.index;
        };

        const handleGamepadDisconnected = (e) => {
            console.log('Gamepad disconnected');
            if (gamepadIndexRef.current === e.gamepad.index) {
                setInputSource('none');
                inputSourceRef.current = 'none';
                setGamepadConnected(false);
                gamepadIndexRef.current = null;
                setNormalizedPosition({ x: 0, y: 0 });
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            }
        };

        window.addEventListener('gamepadconnected', handleGamepadConnected);
        window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

        return () => {
            window.removeEventListener('gamepadconnected', handleGamepadConnected);
            window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Track previous button states to detect press events
    const previousButtonsRef = useRef([]);

    // Gamepad polling loop (runs on animation frame)
    useEffect(() => {
        if (inputSource !== 'hardware' || gamepadIndexRef.current === null || !connected) {
            return;
        }

        const pollGamepad = () => {
            const gamepads = navigator.getGamepads();
            const gamepad = gamepads[gamepadIndexRef.current];

            if (gamepad) {
                // Read raw values from hardware controller
                const steering = typeof gamepad.axes[0] !== 'undefined' ? gamepad.axes[0] : 0;
                const leftTrigger = typeof gamepad.axes[4] !== 'undefined' ? gamepad.axes[4] : -1;
                const rightTrigger = typeof gamepad.axes[5] !== 'undefined' ? gamepad.axes[5] : -1;

                const buttons = Array.from(gamepad.buttons).map(btn => btn.pressed ? 1 : 0);
                setButtons(buttons);

                // Handle A button (index 0) and B button (index 1) for speed mode changes
                // Detect button press events (transition from 0 to 1)
                if (buttons[0] === 1 && previousButtonsRef.current[0] === 0) {
                    // A button pressed - increase speed mode
                    const nextMode = Math.min(parseInt(speedMode) + 1, 5);
                    handleSpeedModeChange(nextMode.toString());
                }
                if (buttons[1] === 1 && previousButtonsRef.current[1] === 0) {
                    // B button pressed - decrease speed mode
                    const nextMode = Math.max(parseInt(speedMode) - 1, 0);
                    handleSpeedModeChange(nextMode.toString());
                }

                // Update previous button states for next frame
                previousButtonsRef.current = buttons;

                // Update visual position to mirror hardware controller
                // Y-axis is inverted for display (negative throttle = move up)
                setNormalizedPosition({
                    x: steering,
                    y: -rightTrigger * 0.75  // Scale for visual representation
                });

                // Publish raw values - backend will handle all processing
                publishJoyMessage(steering, rightTrigger, leftTrigger, buttons);
            }

            animationFrameRef.current = requestAnimationFrame(pollGamepad);
        };

        animationFrameRef.current = requestAnimationFrame(pollGamepad);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [inputSource, connected, debugMode, speedMode]);

    // Update virtual joystick position based on mouse/touch input
    const updatePosition = (clientX, clientY) => {
        const base = baseRef.current;
        if (!base || inputSourceRef.current === 'hardware') return;

        const rect = base.getBoundingClientRect();
        const radius = rect.width / 2;
        const centerX = rect.left + radius;
        const centerY = rect.top + radius;

        const dx = clientX - centerX;
        const dy = clientY - centerY;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Clamp stick to base radius
        const clampedDistance = Math.min(distance, radius);
        const normalizedDistance = clampedDistance / radius;

        const normalizedX = normalizedDistance * Math.cos(angle);
        const normalizedY = normalizedDistance * Math.sin(angle);

        setNormalizedPosition({ x: normalizedX, y: normalizedY });

        const steering = normalizedX;

        let throttle;
        let brake;

        // Map Y-axis to throttle/brake (Up = Throttle, Down = Brake)
        if (normalizedY < 0) {
            throttle = Math.abs(normalizedY);
            brake = -1.0;
        } else if (normalizedY > 0) {
            throttle = -1.0; // This logic seems to imply reverse or braking depending on backend
            brake = Math.abs(normalizedY);
        } else {
            throttle = -1.0;
            brake = 1.0;
        }

        publishJoyMessage(
            steering,
            throttle,
            brake,
            []
        );
    };

    const handleSpeedModeChange = (newMode) => {
        setSpeedMode(newMode);
        if (speedModeTopicRef.current) {
            speedModeTopicRef.current.publish(new ROSLIB.Message({
                data: parseInt(newMode)
            }));
        }
    };

    const handleMouseMove = (e) => updatePosition(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
        if (e.touches.length > 0) {
            updatePosition(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const endInteraction = () => {
        setNormalizedPosition({ x: 0, y: 0 });
        setInputSource('none');
        inputSourceRef.current = 'none';
        virtualJoystickActive.current = false;

        publishJoyMessage(0, -1.0, 0, []);

        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", endInteraction);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", endInteraction);
    };

    const startMouse = () => {
        if (inputSourceRef.current === 'hardware') return;
        setInputSource('virtual');
        inputSourceRef.current = 'virtual';
        virtualJoystickActive.current = true;
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", endInteraction);
    };

    const startTouch = () => {
        if (inputSourceRef.current === 'hardware') return;
        setInputSource('virtual');
        inputSourceRef.current = 'virtual';
        virtualJoystickActive.current = true;
        window.addEventListener("touchmove", handleTouchMove, { passive: false });
        window.addEventListener("touchend", endInteraction);
    };

    // Joystick size management
    useEffect(() => {
        const surface = surfaceRef.current;
        if (!surface) return;

        const updateBaseSize = (width, height) => {
            const usableWidth = Math.max(0, width);
            const usableHeight = Math.max(0, height);
            const nextSize = Math.min(usableWidth, usableHeight, MAX_JOYSTICK_SIZE);
            setBaseSize((prev) => (Math.abs(prev - nextSize) > 0.5 ? nextSize : prev));
        };

        const applySurfaceSize = () => {
            updateBaseSize(surface.clientWidth, surface.clientHeight);
        };

        applySurfaceSize();

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver((entries) => {
                if (entries.length) {
                    const { width, height } = entries[0].contentRect;
                    updateBaseSize(width, height);
                }
            })
            observer.observe(surface);
            return () => observer.disconnect();
        } else {
            window.addEventListener('resize', applySurfaceSize);
            return () => window.removeEventListener('resize', applySurfaceSize);
        }
    }, []);

    // Convert normalized position to pixel offset for visual rendering
    const getPixelPosition = () => {
        if (!baseRef.current) return { x: 0, y: 0 };
        const radius = baseRef.current.offsetWidth / 2;
        return {
            x: normalizedPosition.x * radius,
            y: normalizedPosition.y * radius
        };
    };

    const pixelPos = getPixelPosition();
    const baseDimensions = baseSize > 0 ? { width: `${baseSize}px`, height: `${baseSize}px` } : undefined;

    return (
        <div className="flex flex-col h-full rounded-lg overflow-hidden" style={{ backgroundColor: '#17453B' }}>
            {!simpleView && (
                <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ backgroundColor: '#1a5042', borderBottom: '1px solid #0d2a23' }}>
                    <div className="text-xs font-semibold text-white tracking-wide">
                        Drive Joystick
                    </div>
                    <div className="flex gap-1.5 items-center">
                        <Select value={speedMode} onValueChange={handleSpeedModeChange} disabled={!connected}>
                            <SelectTrigger className="w-32 h-6 px-2 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">Slowest</SelectItem>
                                <SelectItem value="1">Slower</SelectItem>
                                <SelectItem value="2">Slow</SelectItem>
                                <SelectItem value="3">Normal</SelectItem>
                                <SelectItem value="4">Fast</SelectItem>
                                <SelectItem value="5">Full</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant={debugMode ? 'default' : 'outline'}
                            onClick={() => setDebugMode(!debugMode)}
                            className="h-6 px-2 text-xs dark:bg-gray-800 dark:hover:bg-gray-700"
                        >
                            {debugMode ? 'Debug Off' : 'Debug'}
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col gap-2 p-2 min-h-0 w-full overflow-hidden" style={{ backgroundColor: '#0d2a23' }}>
                <div className="flex gap-2 min-h-0 flex-1 overflow-hidden">
                    <div className="flex flex-col gap-1 min-h-0 flex-1">
                        <div className="flex justify-center gap-2 flex-wrap w-full flex-shrink-0">
                            {inputSource === 'hardware' && (
                                <div className="px-2 py-1 bg-brand-green dark:bg-brand-accent-green text-white dark:text-black rounded-md text-xs font-medium border border-gray-600 dark:border-gray-500">
                                    Controller
                                </div>
                            )}
                            {!connected && (
                                <div className="px-2 py-1 text-white rounded-md text-xs font-medium" style={{ backgroundColor: '#1a5042', border: '1px solid #17453B' }}>
                                    Disconnected
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-center flex-1 min-h-0 w-full" ref={surfaceRef}>
                            <div
                                className="rounded-full border-2 relative overflow-hidden bg-[#1a5042] border-color:white dark:border-black"
                                style={{
                                    ...baseDimensions,
                                    boxShadow: 'inset 0 0 8px rgba(0, 0, 0, 0.3)'
                                }}
                                ref={baseRef}
                            >
                                <div
                                    className="w-1/4 aspect-square rounded-full absolute top-1/2 left-1/2 cursor-grab shadow-md active:cursor-grabbing active:shadow-sm bg-white border-color:white dark:bg-black"
                                    style={{
                                        transform: `translate(calc(-50% + ${pixelPos.x}px), calc(-50% + ${pixelPos.y}px))`
                                    }}
                                    onMouseDown={startMouse}
                                    onTouchStart={startTouch}
                                />
                            </div>
                        </div>
                    </div>

                    {debugMode && (
                        <div className="w-48 p-2 bg-gray-950 dark:bg-black text-white rounded-md font-mono text-xs border border-gray-700 dark:border-gray-800 overflow-y-auto flex-shrink-0 space-y-2">
                            <div className="space-y-1">
                                <div className="font-bold text-brand-accent-green">Published Values</div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400 dark:text-gray-500">Steering:</span>
                                    <span className="text-brand-accent-green font-semibold">{currentValues.steering.toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400 dark:text-gray-500">Throttle:</span>
                                    <span className="text-brand-accent-green font-semibold">{currentValues.throttle.toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400 dark:text-gray-500">Brake:</span>
                                    <span className="text-brand-accent-green font-semibold">{currentValues.brake.toFixed(3)}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="font-bold text-brand-accent-green">Normalized</div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400 dark:text-gray-500">X:</span>
                                    <span className="text-brand-accent-green font-semibold">{normalizedPosition.x.toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400 dark:text-gray-500">Y:</span>
                                    <span className="text-brand-accent-green font-semibold">{normalizedPosition.y.toFixed(3)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
