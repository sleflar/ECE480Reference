/**
 * Vehicle Statistics Component
 * 
 * Displays real-time vehicle telemetry (Speed, Brake, Throttle).
 * Connects to ROS topics to receive vehicle command/status data.
 * 
 */
import React, { useEffect, useRef, useState } from "react";
import { getRosbridgeInstance } from "../utils/rosbridgeConnection";
import { useReplay } from '../utils/ReplayContext';

export default function VehicleStats(
    rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
    throttleTopicName = '/car1_ns/commands/motor/duty_cycle',
    brakeTopicName = '/car1_ns/commands/motor/brake',
) {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const rosbridgeRef = useRef(null);
    const brakeSeriesRef = useRef(null);
    const throttleSeriesRef = useRef(null);
    const throttleTopicRef = useRef(null);
    const brakeTopicRef = useRef(null);
    const [throttleValue, setThrottleValue] = useState(20);
    const [brakeValue, setBrakeValue] = useState(20000);

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
            if (throttleTopicRef.current) {
                throttleTopicRef.current.unsubscribe();
                throttleTopicRef.current = null;
            }
            if (brakeTopicRef.current) {
                brakeTopicRef.current.unsubscribe();
                brakeTopicRef.current = null;
            }
        };
    }, [rosbridgeUrl]);

    const speed_to_erpm_gain = 20.0;
    // Subscribe to throttle topic
    useEffect(() => {
        if (!connected || !rosbridgeRef.current) {
            return;
        }

        try {
            const throttleTopic = rosbridgeRef.current.createTopic(
                throttleTopicName,
                'std_msgs/msg/Float64'
            );
            throttleTopicRef.current = throttleTopic;

            throttleTopic.subscribe((message) => {
                // Apply gain to convert raw speed to ERPM/display value
                setThrottleValue(Math.abs(message.data * speed_to_erpm_gain));
                // Reset brake value when throttle is active
                setBrakeValue(1);
            });

            console.log(`Subscribed to ${throttleTopicName}`);
        } catch (err) {
            console.error('Failed to subscribe to camera topic:', err);
            setError(err?.message || 'Subscription failed');
        }

        return () => {
            if (throttleTopicRef.current) {
                throttleTopicRef.current.unsubscribe();
                console.log(`Unsubscribed from ${throttleTopicName}`);
            }
        };
    }, [connected, throttleTopicName]);

    // Subscribe to brake topic
    useEffect(() => {
        if (!connected || !rosbridgeRef.current) {
            return;
        }

        try {
            const brakeTopic = rosbridgeRef.current.createTopic(
                brakeTopicName,
                'std_msgs/msg/Float64'
            );
            brakeTopicRef.current = brakeTopic;

            brakeTopic.subscribe((message) => {
                // Ensure brake value is at least 1 for logarithmic scaling
                setBrakeValue(Math.max(message.data, 1));
            });

            console.log(`Subscribed to ${brakeTopicName}`);
        } catch (err) {
            console.error('Failed to subscribe to camera topic:', err);
            setError(err?.message || 'Subscription failed');
        }

        return () => {
            if (brakeTopicRef.current) {
                brakeTopicRef.current.unsubscribe();
                console.log(`Unsubscribed from ${brakeTopicName}`);
            }
        };
    }, [connected, brakeTopicName]);
    return (
        <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
            <div>Speed: <strong>{(throttleValue).toFixed(2)} m/s</strong></div>
            <div style={{ marginTop: "8px" }}>Brake:</div>
            <div className="bar brake-bar" style={{ height: "1ex", backgroundColor: "red", marginBottom: "8px", width: `${Math.log10(brakeValue) * 17.4376835492}%` }} />
            <div>Throttle:</div>
            <div className="bar throttle-bar" style={{ height: "1ex", backgroundColor: "green", width: `${throttleValue * 3.75}%` }} />
        </div>
    );
}
