/**
 * Network Statistics Component
 * 
 * Displays real-time network performance metrics.
 * Shows latency, RTT, packet loss, and queue size.
 * Also displays the last known GNSS location.
 * 
 */
import React, { useEffect, useRef, useState } from "react";
import { getRosbridgeInstance } from "../utils/rosbridgeConnection";

export default function NetworkStats({
    rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
    serviceName = null,
    topicName = null,
    carNamespace = null
}) {
    const baseServiceName = carNamespace
        ? `/${carNamespace}/get_time`
        : (serviceName || '/car1_ns/get_time');

    const baseTopicName = carNamespace
        ? `/${carNamespace}/sensors/gnss`
        : (topicName || '/car1_ns/sensors/gnss');

    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const rosbridgeRef = useRef(null);
    const [latency, setLatency] = useState(0);
    const [rtt, setRtt] = useState(0);
    const [lastSeenAt, setLastSeenAt] = useState(0);
    const [queueSize, setQueueSize] = useState(0);
    const serviceRef = useRef(null);
    const topicRef = useRef(null);
    const [lastConnection, setLastConnection] = useState(0);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [droppedPackets, setDroppedPackets] = useState(0);
    const [receivedPackets, setReceivedPackets] = useState(0);
    const [gnssData, setGnssData] = useState({
        latitude: 42.725100,
        longitude: -84.479100,
        altitude: 0.0
    });

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
            // Unsubscribe from service when component unmounts
            if (serviceRef.current) {
                serviceRef.current = null;
            }
        };
    }, [rosbridgeUrl]);


    useEffect(() => {
        // Subscribe to latency service when connected
        if (!connected || !rosbridgeRef.current) {
            return;
        }

        try {
            // Create service for latency measurement
            const service = rosbridgeRef.current.createService(
                baseServiceName,
                'std_srvs/srv/Trigger'
            );
            serviceRef.current = service;

            setIsSubscribed(true);
            console.log(`Subscribed to ${baseServiceName}`);
        } catch (err) {
            setIsSubscribed(false);
            console.error('Failed to subscribe to service:', err);
            setError(err?.message || 'Subscription failed');
        }

        return () => {
            if (serviceRef.current) {
                setIsSubscribed(false);
                console.log(`Unsubscribed from ${baseServiceName}`);
            }
        };
    }, [connected, baseServiceName]);

    // Periodically call service to measure latency
    useEffect(() => {
        if (!serviceRef.current) return;
        const interval = setInterval(() => {
            const startTime = Date.now();

            serviceRef.current.callService(
                {},
                (res) => {
                    const receiveTime = Date.now();
                    const rtt = receiveTime - startTime;
                    setLastConnection(receiveTime);

                    // Calculate one-way latency (approximate)
                    const oneWayApprox = Math.round(rtt / 2);

                    setRtt(rtt);
                    setLatency(oneWayApprox);
                    setReceivedPackets(prev => prev + 1);
                },
                (error) => {
                    setDroppedPackets(prev => prev + 1);
                },
                0.5 // Timeout
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [connected, baseServiceName]);

    // Subscribe to GNSS topic for location data
    useEffect(() => {
        if (!connected || !rosbridgeRef.current) {
            return;
        }

        try {
            const topic = rosbridgeRef.current.createTopic(
                baseTopicName,
                'geometry_msgs/Point'
            );
            topicRef.current = topic;

            topic.subscribe((message) => {
                // Extract coordinates from Point message
                setLastSeenAt(Date.now());
                const latitude = message.x ?? 42.725100;
                const longitude = message.y ?? -84.479100;
                const altitude = message.z ?? 0.0;

                setGnssData({
                    latitude,
                    longitude,
                    altitude
                });
            });

            console.log(`Subscribed to ${baseTopicName}`);
        } catch (err) {
            console.error('Failed to subscribe to GNSS topic:', err);
            setError(err?.message || 'Subscription failed');
        }

        return () => {
            if (topicRef.current) {
                topicRef.current.unsubscribe();
                console.log(`Unsubscribed from ${baseTopicName}`);
            }
        };
    }, [connected, baseTopicName]);

    // Monitor WebSocket queue size
    useEffect(() => {
        const sock = rosbridgeRef.current?.ros?.socket;
        if (!sock) return;

        const id = setInterval(() => {
            setQueueSize(sock.bufferedAmount || 0);
        }, 1000);

        return () => clearInterval(id);
    }, [connected]);

    //Pull out values and format them
    const latitude = gnssData.latitude.toFixed(6);
    const longitude = gnssData.longitude.toFixed(6);

    //Validation test - check if we have non-default values
    const hasValidData = gnssData.latitude !== 42.725100 && gnssData.longitude !== -84.479100;

    return (
        <div className="p-2 sm:p-3 md:p-4 text-[10px] sm:text-xs md:text-sm leading-relaxed overflow-auto h-full space-y-1">
            <div>Latency: {latency} ms</div>
            <div>RTT: {rtt} ms</div>
            <div>Packet Loss: {(droppedPackets / (droppedPackets + receivedPackets)) * 100}%</div>
            <div>Last Connection: {(lastConnection == 0) ? "unknown" : new Date(lastConnection).toLocaleTimeString()}</div>
            <div>Last Seen Location: {latitude},{longitude}</div>
            <div>Last Seen at: {(lastSeenAt == 0) ? "unknown" : (Date.now() - lastSeenAt) / 1000} s</div>
            <div>Queue Size: {queueSize} bytes</div>
        </div>
    )
}