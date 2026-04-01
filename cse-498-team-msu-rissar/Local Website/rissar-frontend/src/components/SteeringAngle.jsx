/**
 * Steering Angle Visualization Component
 * 
 * Visualizes the current steering angle by rotating a steering wheel image.
 * Connects to a ROS topic to receive servo position data.
 * 
 */
import React, { useState, useEffect, useRef } from "react";
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import wheel from "../assets/steering-wheel.png";
import { useReplay } from '../utils/ReplayContext';

export default function SteeringAngle({
    rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
    topicName = null,
    carNamespace = null,
    showConnectionStatus = true
}) {
    const { getTopicName } = useReplay();

    const baseTopic = carNamespace
        ? `/${carNamespace}/commands/servo/position`
        : (topicName || '/car1_ns/commands/servo/position');

    const currentTopicName = getTopicName(baseTopic);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const rosbridgeRef = useRef(null);
    const topicRef = useRef(null);
    const [degrees, setDegrees] = useState(0);

    useEffect(() => {
        // Initialize rosbridge connection
        const rosbridge = getRosbridgeInstance(rosbridgeUrl);
        rosbridgeRef.current = rosbridge;

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

        rosbridge.connect().catch((err) => {
            console.error('Failed to connect to rosbridge:', err);
            setError(err?.message || 'Connection failed');
        });

        return () => {
            removeListener();
            if (topicRef.current) {
                topicRef.current.unsubscribe();
                topicRef.current = null;
            }
        };
    }, [rosbridgeUrl]);

    // Subscribe to servo position topic
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

            topic.subscribe((message) => {
                const servoPosition = message.data;
                // Convert servo position (0-1) to degrees
                // 0.5 is center, ratio determines range
                const steeringAngleRatio = 2.25;
                const calculatedDegrees = (servoPosition - 0.5) * 180 / steeringAngleRatio;
                setDegrees(calculatedDegrees);
            });
            setIsSubscribed(true);
            console.log(`Subscribed to ${topicName}`);
        } catch (err) {
            setIsSubscribed(false);
            console.error('Failed to subscribe to steering angle topic:', err);
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

    return (
        <div className="flex flex-col h-full w-full items-center justify-center min-h-40 gap-2 p-2 dark:text-white">
            {showConnectionStatus && !isSubscribed && (
                <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                    Connecting to steering sensor...
                </p>
            )}
            {error && (
                <p className="text-red-600 dark:text-red-400 text-xs">
                    Error: {error}
                </p>
            )}
            <div className="flex w-full max-w-full max-h-full items-center justify-center flex-1">
                <img
                    src={wheel}
                    className="w-1/4 h-auto block"
                    style={{
                        transform: `rotate(${degrees}deg)`,
                        transition: 'transform 0.1s ease-out'
                    }}
                    alt="Steering Wheel"
                />
            </div>
            <p className="text-base font-bold text-brand-green dark:text-brand-accent-green">
                {degrees.toFixed(1)}°
            </p>
        </div>
    );
}