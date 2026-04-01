/**
 * 3D Lidar Point Cloud Viewer Component
 * 
 * Renders a 3D point cloud using Three.js and OrbitControls.
 * Connects to a ROS topic (default: /livox/lidar) to receive PointCloud2 messages.
 * 
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import { useReplay } from '../utils/ReplayContext';

export default function LivoxMID360Viewer({
  rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
  topicName = null,
  carNamespace = null,
}) {
  const { getTopicName } = useReplay();

  const baseTopic = carNamespace
    ? `/${carNamespace}/livox/lidar`
    : (topicName || '/car1_ns/livox/lidar');

  const currentTopicName = getTopicName(baseTopic);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [pointCount, setPointCount] = useState(0);
  const [fps, setFps] = useState(0);


  //Stores all objects
  const refs = useRef({
    container: null,
    scene: null,
    camera: null,
    renderer: null,
    pointCloud: null,
    controls: null,
    rosbridge: null,
    topic: null,
    lastUpdate: 0,
    frame: null,
    mounted: false,
    cameraInit: false,
    lastFpsTime: Date.now(),
    frameCount: 0
  });

  // Initialize Three.js scene, camera, and renderer
  useEffect(() => {
    if (refs.current.mounted) return;
    refs.current.mounted = true;


    const container = refs.current.container;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    refs.current.scene = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    refs.current.camera = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    refs.current.renderer = renderer;

    // Orbit controls for user interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    refs.current.controls = controls;

    // Helpers and Lights
    scene.add(new THREE.GridHelper(50, 50, 0x444444, 0x222222));
    scene.add(new THREE.AxesHelper(10));
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // Point Cloud Object
    const pointCloud = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ size: 0.05, vertexColors: true, sizeAttenuation: true })
    );
    pointCloud.frustumCulled = false;
    scene.add(pointCloud);
    refs.current.pointCloud = pointCloud;

    // Animation Loop
    const animate = () => {
      if (!refs.current.mounted) return;
      refs.current.frame = requestAnimationFrame(animate);

      refs.current.frameCount++;
      const now = Date.now();
      if (now - refs.current.lastFpsTime >= 1000) {
        setFps(60);
        refs.current.frameCount = 0;
        refs.current.lastFpsTime = now;
      }


      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    //Handler for resizing the screen
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    //Some clean up
    return () => {
      refs.current.mounted = false;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(refs.current.frame);
      renderer.dispose();
      pointCloud.geometry.dispose();
      pointCloud.material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Handle ROS Connection
  useEffect(() => {
    const rosbridge = getRosbridgeInstance(rosbridgeUrl);
    refs.current.rosbridge = rosbridge;

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

    rosbridge.connect().catch(err => setError(err?.message || 'Connection failed'));

    return () => {
      removeListener();
      refs.current.topic?.unsubscribe();
    };
  }, [rosbridgeUrl]);

  // Subscribe to PointCloud2 topic and update geometry
  useEffect(() => {
    if (!connected || !refs.current.rosbridge) return;

    const topic = refs.current.rosbridge.createTopic(currentTopicName, 'sensor_msgs/PointCloud2');
    refs.current.topic = topic;

    topic.subscribe((message) => {
      // Limit update rate to ~10Hz
      const now = Date.now();
      if (now - refs.current.lastUpdate < 100) return;
      refs.current.lastUpdate = now;

      if (!refs.current.pointCloud || !refs.current.mounted) return;

      try {
        const points = parsePointCloud2(message);
        if (points.positions.length === 0) return;

        // Update BufferGeometry attributes
        const geometry = refs.current.pointCloud.geometry;
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(points.colors, 3));
        geometry.computeBoundingSphere();

        // Auto-center camera on first valid data
        if (!refs.current.cameraInit && geometry.boundingSphere) {
          const { center, radius } = geometry.boundingSphere;
          if (radius > 0 && radius < 500) {
            const dist = radius * 2.5;
            refs.current.camera.position.set(center.x + dist * 0.7, center.y + dist * 0.7, center.z + dist * 0.7);
            refs.current.controls.target.copy(center);
            refs.current.controls.update();
            refs.current.cameraInit = true;
          }
        }


        setPointCount(points.positions.length / 3);
      } catch (e) {
        console.error('Error updating point cloud:', e);
      }
    });

    return () => refs.current.topic?.unsubscribe();
  }, [connected, topicName]);

  // Helper to parse binary PointCloud2 data
  const parsePointCloud2 = (msg) => {
    let dataArray;
    // Handle different data formats (Uint8Array, base64 string, regular array)
    if (msg.data instanceof Uint8Array) {
      dataArray = msg.data;
    } else if (typeof msg.data === 'string') {
      const binaryString = atob(msg.data);
      dataArray = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        dataArray[i] = binaryString.charCodeAt(i);
      }
    } else if (Array.isArray(msg.data)) {
      dataArray = new Uint8Array(msg.data);
    } else {
      return { positions: [], colors: [] };
    }

    const view = new DataView(dataArray.buffer, dataArray.byteOffset, dataArray.byteLength);

    const fieldOffsets = {};
    msg.fields.forEach(f => fieldOffsets[f.name] = f.offset);


    const numPoints = msg.width * msg.height;
    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);
    let validCount = 0;


    if (dataArray.length < numPoints * msg.point_step) return { positions: [], colors: [] };

    // Iterate through points and extract X, Y, Z, Intensity
    for (let i = 0; i < numPoints; i++) {
      const offset = i * msg.point_step;


      try {
        const x = view.getFloat32(offset + fieldOffsets.x, true);
        const y = view.getFloat32(offset + fieldOffsets.y, true);
        const z = view.getFloat32(offset + fieldOffsets.z, true);

        // Filter invalid points
        if ((x === 0 && y === 0 && z === 0) || !isFinite(x) || !isFinite(y) || !isFinite(z)) continue;

        const intensity = fieldOffsets.intensity !== undefined
          ? Math.min(1.0, view.getFloat32(offset + fieldOffsets.intensity, true) / 255.0)
          : 0.5;

        const idx = validCount * 3;
        // Coordinate transform for visualization (ROS to Three.js)
        positions[idx] = x;
        positions[idx + 1] = z;
        positions[idx + 2] = -y;

        // Color mapping based on intensity
        colors[idx] = intensity;
        colors[idx + 1] = intensity * 0.9;
        colors[idx + 2] = intensity * 0.8;
        validCount++;
      } catch (e) {
        break;
      }
    }

    return {
      positions: positions.slice(0, validCount * 3),
      colors: colors.slice(0, validCount * 3)
    };
  };

  return (
    <div style={{ height: "100%", width: "100%", position: "relative", overflow: "hidden" }}>
      {!connected && !error && (
        <div style={{
          position: "absolute", top: 20, left: 20, color: "#aaa", zIndex: 1,
          background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px'
        }}>
          Connecting to rosbridge...
        </div>
      )}
      {error && (
        <div style={{
          position: "absolute", top: 20, left: 20, color: "#ef4444", zIndex: 1,
          background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px'
        }}>
          <div>Connection Error</div>
          <div style={{ fontSize: "12px", marginTop: "5px" }}>{error}</div>
        </div>
      )}
      {connected && (
        <div style={{
          position: "absolute", top: 20, right: 20, color: "#4ade80", zIndex: 1,
          background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px', fontSize: '14px'
        }}>
          <div>Connected to: {topicName}</div>
          <div>Points: {pointCount.toLocaleString()}</div>
          <div>FPS: {fps}</div>
        </div>
      )}
      <div ref={el => refs.current.container = el}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
    </div>
  );
}
