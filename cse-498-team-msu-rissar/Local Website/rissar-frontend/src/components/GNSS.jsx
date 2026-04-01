/**
 * GNSS Data Display Component
 * 
 * Displays real-time GNSS data (Latitude, Longitude, Altitude) in a text format.
 * Connects to a ROS topic to receive geometry_msgs/Point messages.
 * 
 */
import React, { useEffect, useRef, useState } from 'react';
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import { useReplay } from '../utils/ReplayContext';

export default function GNSS({
  rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
  topicName = null,
  carNamespace = null,
  showConnectionStatus = true
}) {
  const { getTopicName } = useReplay();

  const baseTopic = carNamespace
    ? `/${carNamespace}/sensors/gnss`
    : (topicName || '/car1_ns/sensors/gnss');

  const currentTopicName = getTopicName(baseTopic);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const [gnssData, setGnssData] = useState({
    latitude: 42.725100,
    longitude: -84.479100,
    altitude: 0.0
  });

  const rosbridgeRef = useRef(null);
  const topicRef = useRef(null);

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

    // Connect to rosbridge
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

  // Subscribe to GNSS topic when connected
  useEffect(() => {
    if (!connected || !rosbridgeRef.current) {
      return;
    }

    try {
      const topic = rosbridgeRef.current.createTopic(
        currentTopicName,
        'geometry_msgs/Point'
      );
      topicRef.current = topic;

      topic.subscribe((message) => {
        // Extract coordinates from Point message
        // Default values are used if message fields are missing
        const latitude = message.x ?? 42.725100;
        const longitude = message.y ?? -84.479100;
        const altitude = message.z ?? 0.0;

        setGnssData({
          latitude,
          longitude,
          altitude
        });

        setMessageCount(prev => prev + 1);
      });

      console.log(`Subscribed to ${topicName}`);
    } catch (err) {
      console.error('Failed to subscribe to GNSS topic:', err);
      setError(err?.message || 'Subscription failed');
    }

    return () => {
      if (topicRef.current) {
        topicRef.current.unsubscribe();
        console.log(`Unsubscribed from ${topicName}`);
      }
    };
  }, [connected, currentTopicName]);

  //Pull out values and format them
  const latitude = gnssData.latitude.toFixed(6);
  const longitude = gnssData.longitude.toFixed(6);
  const altitude = gnssData.altitude;

  //Validation test - check if we have non-default values
  const hasValidData = gnssData.latitude !== 42.725100 && gnssData.longitude !== -84.479100;

  return (
    <div className="flex flex-col gap-3 p-4 text-black dark:text-white text-sm">
      {!connected && (
        <p className="text-yellow-600 dark:text-yellow-400 text-xs">
          Connecting to GNSS...
        </p>
      )}
      {error && (
        <p className="text-red-600 dark:text-red-400 text-xs">
          Error: {error}
        </p>
      )}
      <div className="space-y-1.5">
        <p><span className="font-semibold">Latitude:</span> <span className="text-brand-green dark:text-brand-accent-green">{latitude}°</span></p>
        <p><span className="font-semibold">Longitude:</span> <span className="text-brand-green dark:text-brand-accent-green">{longitude}°</span></p>
        <p><span className="font-semibold">Altitude:</span> <span className="text-brand-green dark:text-brand-accent-green">{altitude} m (above sea level)</span></p>
        <p>
          <span className="font-semibold">Status:</span> <span className={hasValidData ? 'text-brand-accent-green dark:text-brand-accent-green' : 'text-yellow-600 dark:text-yellow-400'}>
            {hasValidData ? 'Fix' : 'No Fix'}
          </span>
        </p>
      </div>
    </div>
  );
}
