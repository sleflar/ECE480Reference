/**
 * IMU 3D Visualization Component
 * 
 * Renders a 3D cube that rotates based on IMU gyroscope data.
 * Uses React Three Fiber for rendering.
 * 
 */
import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import { useReplay } from '../utils/ReplayContext';

const GRAV = 9.807;

function IMUCube({ imuData, resetTrigger }) {
  const groupRef = useRef();

  useEffect(() => {
    if (resetTrigger && groupRef.current) {
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.y = 0;
      groupRef.current.rotation.z = 0;
    }
  }, [resetTrigger]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      //This uses the IMU movement measurements to animate the car moving
      groupRef.current.rotation.x += imuData.gyroX * delta * 0.01;
      groupRef.current.rotation.z += imuData.gyroY * delta * 0.01;
      groupRef.current.rotation.y += (imuData.gyroZ * delta * 0.01);
    }
  });
  
  //The following is a model of an F1 car comprising of mesh boxes
  return (
    <group ref={groupRef}>

      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[2, 0.3, 0.6]} />
        <meshPhongMaterial color="#074814ff" />
      </mesh>

      <mesh position={[0.2, 0.5, 0]}>
        <boxGeometry args={[0.8, 0.4, 0.5]} />
        <meshPhongMaterial color="#074814ff" />
      </mesh>

      <mesh position={[0.3, 0.8, 0]}>
        <boxGeometry args={[0.1, 0.2, 0.5]} />
        <meshPhongMaterial color="#1a1a1a" />
      </mesh>

      <mesh position={[1.3, 0.15, 0]}>
        <boxGeometry args={[0.6, 0.15, 0.3]} />
        <meshPhongMaterial color="#074814ff" />
      </mesh>

      <mesh position={[1.7, 0.05, 0]}>
        <boxGeometry args={[0.1, 0.05, 1.4]} />
        <meshPhongMaterial color="#e63946" />
      </mesh>

      <mesh position={[1.7, 0.15, 0.7]}>
        <boxGeometry args={[0.15, 0.25, 0.05]} />
        <meshPhongMaterial color="#e63946" />
      </mesh>
      <mesh position={[1.7, 0.15, -0.7]}>
        <boxGeometry args={[0.15, 0.25, 0.05]} />
        <meshPhongMaterial color="#e63946" />
      </mesh>

      <mesh position={[-1.1, 0.8, 0]}>
        <boxGeometry args={[0.1, 0.05, 1.2]} />
        <meshPhongMaterial color="#e63946" />
      </mesh>

      <mesh position={[-1.1, 0.5, 0.6]}>
        <boxGeometry args={[0.15, 0.6, 0.05]} />
        <meshPhongMaterial color="#e63946" />
      </mesh>
      <mesh position={[-1.1, 0.5, -0.6]}>
        <boxGeometry args={[0.15, 0.6, 0.05]} />
        <meshPhongMaterial color="#e63946" />
      </mesh>

      <mesh position={[0.9, -0.05, 0.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.25, 16]} />
        <meshPhongMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.9, -0.05, -0.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.25, 16]} />
        <meshPhongMaterial color="#1a1a1a" />
      </mesh>

      <mesh position={[-0.8, -0.05, 0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
        <meshPhongMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[-0.8, -0.05, -0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
        <meshPhongMaterial color="#1a1a1a" />
      </mesh>

      <mesh position={[-0.5, 0.35, 0]}>
        <boxGeometry args={[1, 0.25, 0.5]} />
        <meshPhongMaterial color="#074814ff" />
      </mesh>
    </group>
  );
}

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
  const [resetTrigger, setResetTrigger] = useState(0);

  const handleReset = () => {
    setResetTrigger(prev => prev + 1);
  };

  useEffect(() => {
    //Initializes rosbridge connection
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

    //This connects to rosbridge
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

  // Subscribe to IMU topic and update state
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
        //Pull out data from imu message
        const gyroX = message.angular_velocity?.x ?? 0;
        const gyroY = message.angular_velocity?.y ?? 0;
        const gyroZ = message.angular_velocity?.z ?? 0;
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

      console.log(`Subscribed to ${topicName}`);
    } catch (err) {
      console.error('Failed to subscribe to IMU topic:', err);
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
  const gyroX = imuData.gyroX.toFixed(2);
  const gyroY = imuData.gyroY.toFixed(2);
  const gyroZ = imuData.gyroZ.toFixed(2);
  const accelX = imuData.accelX.toFixed(2);
  const accelY = imuData.accelY.toFixed(2);
  const accelZ = imuData.accelZ.toFixed(2);

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
      {showConnectionStatus && (
        <div style={{ padding: "10px" }}>
          {!connected && (
            <p style={{ color: 'orange', fontSize: '0.9em', margin: 0 }}>
              Connecting to IMU...
            </p>
          )}
          {error && (
            <p style={{ color: 'red', fontSize: '0.9em', margin: 0 }}>
              Error: {error}
            </p>
          )}
        </div>
      )}

      <div style={{ height: "50%", width: "100%", minHeight: "200px", position: "relative" }}>
        <Canvas>
          <IMUCube imuData={imuData} resetTrigger={resetTrigger} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        </Canvas>
        <button
          onClick={handleReset}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            padding: "8px 16px",
            backgroundColor: "#074814ff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
            zIndex: 10
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = "#095a1a"}
          onMouseOut={(e) => e.target.style.backgroundColor = "#074814ff"}
        >
          Reset Orientation
        </button>
      </div>
    </div>
  );
}