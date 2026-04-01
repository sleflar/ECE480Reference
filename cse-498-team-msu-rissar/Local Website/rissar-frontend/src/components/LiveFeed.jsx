/**
 * LiveFeed Camera Display Component using roslibjs
 *
 * Connects to rosbridge via WebSocket and subscribes to camera feed topics.
 * Displays compressed JPEG or PNG frames on a canvas with FPS and connection status.
 * Automatically switches between live and bag topics based on replay state.
 * Supports car namespace for multi-car views.
 */

import React, { useEffect, useRef, useState } from 'react';
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import { useReplayTopic } from '../utils/ReplayContext';


export default function LiveFeed({
  rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
  topicName = null,
  carNamespace = null,
  topicCandidates = null,
  showConnectionStatus = true,
}) {
  const canvasRef = useRef(null);
  const rosbridgeRef = useRef(null);
  const topicRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [activeTopic, setActiveTopic] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  const frameTimesRef = useRef([]);

  const effectiveTopicCandidates = carNamespace
    ? [
      `/${carNamespace}/sensors/camera_feed`,
      `/${carNamespace}/sensors/camera_feed_bag`,
    ]
    : topicCandidates || [
      '/camera_feed',
      '/car1_ns/sensors/camera_feed',
      '/camera_feed_bag',
      '/car1_ns/sensors/camera_feed_bag',
    ];

  // Determine the correct topic based on props and replay state
  useEffect(() => {
    if (topicName) {
      setSelectedTopic(topicName);
    } else if (carNamespace) {
      setSelectedTopic(`/${carNamespace}/sensors/camera_feed`);
    } else if (effectiveTopicCandidates.length > 0) {
      setSelectedTopic(effectiveTopicCandidates[0]);
    }
  }, [topicName, carNamespace]);

  // Get the replay-aware topic name (switches between live and bag topics)
  const replayTopic = useReplayTopic(selectedTopic);

  // Handle ROS Connection
  useEffect(() => {
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

  // Subscribe to the camera topic and render frames
  useEffect(() => {
    if (!connected || !rosbridgeRef.current || !selectedTopic) return;

    let currentTopic = null;
    let currentHandler = null;

    const t = replayTopic || selectedTopic;
    if (!t) {
      setError('No camera topic configured');
      return;
    }

    try {
      const topic = rosbridgeRef.current.createTopic(t, 'sensor_msgs/CompressedImage');
      currentTopic = topic;

      currentHandler = (message) => {
        if (!canvasRef.current) return;

        setActiveTopic(t);

        // Calculate FPS based on frame arrival times
        const now = Date.now();
        frameTimesRef.current.push(now);
        if (frameTimesRef.current.length > 30) frameTimesRef.current.shift();

        if (frameTimesRef.current.length > 1) {
          const timeSpan = now - frameTimesRef.current[0];
          const calculatedFps = ((frameTimesRef.current.length - 1) / timeSpan) * 1000;
          setFps(Math.round(calculatedFps));
        }

        // Render image to canvas
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();

        const imageData = message.data;
        const format = message.format || 'jpeg';
        const mimeType = format.includes('png') ? 'image/png' : 'image/jpeg';

        // Handle different data types for image data (string vs byte array)
        let base64String;
        if (typeof imageData === 'string') {
          base64String = imageData;
        } else if (Array.isArray(imageData) || imageData instanceof Uint8Array) {
          const bytes = imageData instanceof Uint8Array ? imageData : new Uint8Array(imageData);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          base64String = btoa(binary);
        } else {
          console.error('Unexpected image data type:', typeof imageData);
          return;
        }

        const dataUrl = `data:${mimeType};base64,${base64String}`;

        img.onload = () => {
          // Resize canvas to match image dimensions if needed
          if (canvas.width !== img.width || canvas.height !== img.height) {
            canvas.width = img.width;
            canvas.height = img.height;
          }
          ctx.drawImage(img, 0, 0);
          setFrameCount((prev) => prev + 1);
        };

        img.onerror = (e) => {
          console.error('Failed to load image:', e);
          setError('Failed to decode image');
        };

        img.src = dataUrl;
      };

      topic.subscribe(currentHandler);
      console.log(`Subscribed to camera topic ${t}`);
    } catch (err) {
      console.error('Failed to subscribe to camera topic:', err);
      setError(err?.message || 'Subscription failed');
    }

    return () => {
      if (currentTopic) {
        try { currentTopic.unsubscribe(); } catch (e) { /* ignore */ }
      }
    };
  }, [connected, replayTopic, selectedTopic]);

  return (
    <div className="flex flex-col h-full w-full rounded-lg overflow-hidden" style={{ backgroundColor: '#17453B' }}>
      <div className="flex-1 flex justify-center items-center relative overflow-hidden min-h-0" style={{ backgroundColor: '#0d2a23' }}>
        {!connected && !error && (
          <div className="text-gray-400 text-center">
            Connecting to rosbridge...
          </div>
        )}
        {error && (
          <div className="text-center">
            <div className="text-red-500">Connection Error</div>
            <div className="text-red-400 text-xs mt-1">{error}</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-contain ${connected ? 'block' : 'hidden'}`}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}