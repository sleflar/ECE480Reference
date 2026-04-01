/**
 * IMU Data Display Component
 * 
 * Displays real-time IMU data (Gyroscope and Accelerometer) in a text format.
 * Connects to a ROS topic to receive sensor_msgs/Imu messages.
 * 
 */
import React, { useEffect, useRef, useState } from 'react';
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import { useReplay } from '../utils/ReplayContext';

const GRAV = 9.807

export default function IMU({
  rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
  topicName = null,
  carNamespace = null,
  showConnectionStatus = true
}) {
  const { getTopicName } = useReplay();

  const baseTopic = carNamespace
    ? `/${carNamespace}/sensors/imu/raw`
    : (topicName || '/car1_ns/sensors/imu/raw');

  const currentTopicName = getTopicName(baseTopic);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const [imuData, setImuData] = useState({
    gyroX: 0,
    gyroY: 0,
    gyroZ: 0,
    accelX: 0,
    accelY: 0,
    accelZ: 0
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

  // Subscribe to IMU topic when connected
  useEffect(() => {
    if (!connected || !rosbridgeRef.current) {
      return;
    }

    try {
      const topic = rosbridgeRef.current.createTopic(
        currentTopicName,
        'sensor_msgs/Imu'
      );
      topicRef.current = topic;

      topic.subscribe((message) => {
        // Extract angular velocity (gyroscope) data
        const gyroX = message.angular_velocity?.x ?? 0;
        const gyroY = message.angular_velocity?.y ?? 0;
        const gyroZ = message.angular_velocity?.z ?? 0;

        // Extract linear acceleration data and convert to m/s^2 (assuming input is in G)
        const accelX = GRAV * (message.linear_acceleration?.x ?? 0);
        const accelY = GRAV * (message.linear_acceleration?.y ?? 0);
        const accelZ = GRAV * (message.linear_acceleration?.z ?? 0);

        setImuData({
          gyroX,
          gyroY,
          gyroZ,
          accelX,
          accelY,
          accelZ
        });

        setMessageCount(prev => prev + 1);
      });

      console.log(`Subscribed to ${currentTopicName}`);
    } catch (err) {
      console.error('Failed to subscribe to IMU topic:', err);
      setError(err?.message || 'Subscription failed');
    }

    return () => {
      if (topicRef.current) {
        topicRef.current.unsubscribe();
        console.log(`Unsubscribed from ${currentTopicName}`);
      }
    };
  }, [connected, currentTopicName]);

  //Pull out values and format them
  const gyroX = imuData.gyroX.toFixed(2);
  const gyroY = imuData.gyroY.toFixed(2);
  const gyroZ = imuData.gyroZ.toFixed(2);
  const accelX = imuData.accelX.toFixed(2);
  const accelY = imuData.accelY.toFixed(2);
  const accelZ = imuData.accelZ.toFixed(2);

  return (
    <div className="flex flex-col gap-2 p-2 sm:p-3 md:p-4 text-black dark:text-white text-xs sm:text-sm overflow-auto h-full">
      {!connected && (
        <p className="text-yellow-600 dark:text-yellow-400 text-[10px] sm:text-xs">
          Connecting to IMU...
        </p>
      )}
      {error && (
        <p className="text-red-600 dark:text-red-400 text-[10px] sm:text-xs">
          Error: {error}
        </p>
      )}
      <div className="space-y-1 sm:space-y-1.5">
        <p className="text-[10px] sm:text-xs md:text-sm"><span className="font-semibold">Gyro X:</span> <span className="text-brand-green dark:text-brand-accent-green">{gyroX} deg/s</span></p>
        <p className="text-[10px] sm:text-xs md:text-sm"><span className="font-semibold">Gyro Y:</span> <span className="text-brand-green dark:text-brand-accent-green">{gyroY} deg/s</span></p>
        <p className="text-[10px] sm:text-xs md:text-sm"><span className="font-semibold">Gyro Z:</span> <span className="text-brand-green dark:text-brand-accent-green">{gyroZ} deg/s</span></p>
        <p className="text-[10px] sm:text-xs md:text-sm"><span className="font-semibold">Acceleration X:</span> <span className="text-brand-green dark:text-brand-accent-green">{accelX} m/s²</span></p>
        <p className="text-[10px] sm:text-xs md:text-sm"><span className="font-semibold">Acceleration Y:</span> <span className="text-brand-green dark:text-brand-accent-green">{accelY} m/s²</span></p>
        <p className="text-[10px] sm:text-xs md:text-sm"><span className="font-semibold">Acceleration Z:</span> <span className="text-brand-green dark:text-brand-accent-green">{accelZ} m/s²</span></p>
      </div>
    </div>
  );
}