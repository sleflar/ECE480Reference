/**
 * Speed and Runtime Component
 * 
 * Displays the vehicle's current speed and total runtime.
 * Subscribes to ROS topics to fetch real-time speed data.
 * 
 */
import React, { useState, useEffect, useRef } from "react";
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import { useReplay } from '../utils/ReplayContext';

export default function SpeedRuntime({
    rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
    topicName = null,
    carNamespace = null,
    showConnectionStatus = true
}) {
    const { getTopicName } = useReplay();

    const baseTopic = carNamespace
        ? `/${carNamespace}/commands/motor/duty_cycle`
        : (topicName || '/car1_ns/commands/motor/duty_cycle');

    const currentTopicName = getTopicName(baseTopic);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const rosbridgeRef = useRef(null);
    const topicRef = useRef(null);
    const [runtime, setRuntime] = useState(0);
    const [speed, setSpeed] = useState(0);

    useEffect(() => {
        // Initialize rosbridge connection
        const rosbridge = getRosbridgeInstance(rosbridgeUrl);
        rosbridgeRef.current = rosbridge;

        // Add connection status listener
        const removeListener = rosbridge.addListener((event) => {
            if (event.type === 'connected') {
                setConnected(true);
                setError(null);
            } else if (event.type === 'disconnected') {
                setConnected(false);
            } else if (event.type === 'error') {
                setError(event.error?.message || 'Connection error');
            }
        });

        // Connect to rosbridge
        rosbridge.connect().catch((err) => {
            console.error('Failed to connect to rosbridge:', err);
            setError(err?.message || 'Connection failed');
        });

        return () => {
            removeListener();
            // Unsubscribe from topic when component unmounts
            if (topicRef.current) {
                topicRef.current.unsubscribe();
                topicRef.current = null;
            }
        };
    }, [rosbridgeUrl]);

    const speed_to_erpm_gain = 20.0;

    // Subscribe to speed topic (using duty cycle as proxy)
    useEffect(() => {
        if (!connected || !rosbridgeRef.current) {
            return;
        }

        try {
            const topic = rosbridgeRef.current.createTopic(
                currentTopicName,
                'std_msgs/msg/Float64'
            );
            topicRef.current = topic;

            // Subscribe to topic and handle incoming messages
            topic.subscribe((message) => {
                // Calculate speed from duty cycle
                setSpeed(Math.abs(message.data * speed_to_erpm_gain).toFixed(2));
            });
            setIsSubscribed(true);
            console.log(`Subscribed to ${topicName}`);
        } catch (err) {
            setIsSubscribed(false);
            console.error('Failed to subscribe to speed topic:', err);
            setError(err?.message || 'Subscription failed');
        }

        return () => {
            if (topicRef.current) {
                setIsSubscribed(false);
                topicRef.current.unsubscribe();
                console.log(`Unsubscribed from ${topicName}`);
            }
        };
    }, [connected, currentTopicName]);


    // Calculate runtime since component mount
    useEffect(() => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setRuntime(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col gap-6 p-5 h-full justify-center dark:text-white">
            {showConnectionStatus && !isSubscribed && (
                <p className="text-yellow-600 dark:text-yellow-400 text-xs mb-2">
                    Connecting to vehicle data...
                </p>
            )}
            <div>
                <h3 className="text-sm font-semibold mb-2">Speed</h3>
                <p className="text-3xl font-bold text-brand-green dark:text-brand-accent-green">
                    {speed} <span className="text-base">m/s</span>
                </p>
            </div>
            <div>
                <h3 className="text-sm font-semibold mb-2">Runtime</h3>
                <p className="text-2xl font-mono text-brand-green dark:text-brand-accent-green">
                    {formatTime(runtime)}
                </p>
            </div>
        </div>
    );
}