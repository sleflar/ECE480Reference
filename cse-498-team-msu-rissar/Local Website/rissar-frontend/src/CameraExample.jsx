/**
 * CameraExample
 * 
 * Example usage of SimpleCameraDisplay component
 * This shows how to integrate the camera component into your application
 * 
 */

import React from 'react';
import SimpleCameraDisplay from './components/SimpleCameraDisplay';

export default function CameraExample() {
  // Render a centered container for the camera display
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0f0f0f',
      padding: '20px'
    }}>
      {/* Camera display container with fixed dimensions */}
      <div style={{
        width: '800px',
        height: '600px',
        maxWidth: '100%',
        maxHeight: '100%'
      }}>
        {/* SimpleCameraDisplay component connected to car1 camera feed */}
        <SimpleCameraDisplay
          rosbridgeUrl="ws://192.168.8.4:9090"
          topicName="/car1_ns/sensors/camera_feed"
          showConnectionStatus={true}
        />
      </div>
    </div>
  );
}
