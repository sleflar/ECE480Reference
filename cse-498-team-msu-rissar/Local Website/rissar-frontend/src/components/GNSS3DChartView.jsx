/**
 * GNSS 3D Chart View Component
 * 
 * Visualizes GNSS path data in 3D using SciChart.
 * Plots Latitude (X), Altitude (Y), and Longitude (Z).
 * 
 */
import React, { useEffect, useRef, useState } from 'react';
import { SciChart3DSurface, NumericAxis3D, XyzDataSeries3D, ScatterRenderableSeries3D, SpherePointMarker3D, Vector3, MouseWheelZoomModifier3D, OrbitModifier3D, ResetCamera3DModifier, EAxisAlignment } from "scichart";
import { SciChartReact } from "scichart-react";
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import { useReplay } from '../utils/ReplayContext';

SciChart3DSurface.loadWasmFromCDN();
SciChart3DSurface.UseCommunityLicense();

export default function GNSS3DChartView({
  rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
  topicName = null,
  carNamespace = null,
  maxDataPoints = 100,
}) {
  const { getTopicName } = useReplay();

  const baseTopic = carNamespace
    ? `/${carNamespace}/sensors/gnss`
    : (topicName || '/car1_ns/sensors/gnss');

  const currentTopicName = getTopicName(baseTopic);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [gnssData, setGnssData] = useState({
    latitude: 42.725100,
    longitude: -84.479100,
    altitude: 0.0
  });

  // Store historical data for plotting
  const [latitudeHistory, setLatitudeHistory] = useState([]);
  const [longitudeHistory, setLongitudeHistory] = useState([]);
  const [altitudeHistory, setAltitudeHistory] = useState([]);

  const rosbridgeRef = useRef(null);
  const topicRef = useRef(null);
  const dataSeriesRef = useRef(null);
  const sciChartSurfaceRef = useRef(null);

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

  // Subscribe to ROS topic and update state
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
        // Extract coordinates (defaulting to MSU coordinates if missing)
        const latitude = message.x ?? 42.725100;
        const longitude = message.y ?? -84.479100;
        const altitude = message.z ?? 0.0;

        setGnssData({
          latitude,
          longitude,
          altitude
        });

        // Update history buffers
        setLatitudeHistory(prev => {
          const newHistory = [...prev, latitude];
          return newHistory.length > maxDataPoints
            ? newHistory.slice(-maxDataPoints)
            : newHistory;
        });

        setLongitudeHistory(prev => {
          const newHistory = [...prev, longitude];
          return newHistory.length > maxDataPoints
            ? newHistory.slice(-maxDataPoints)
            : newHistory;
        });

        setAltitudeHistory(prev => {
          const newHistory = [...prev, altitude];
          return newHistory.length > maxDataPoints
            ? newHistory.slice(-maxDataPoints)
            : newHistory;
        });
      });

      console.log(`Subscribed to ${currentTopicName}`);
    } catch (err) {
      console.error('Failed to subscribe to GNSS topic:', err);
      setError(err?.message || 'Subscription failed');
    }

    return () => {
      if (topicRef.current) {
        topicRef.current.unsubscribe();
        console.log(`Unsubscribed from ${currentTopicName}`);
      }
    };
  }, [connected, currentTopicName, maxDataPoints]);

  // Update chart data when history changes
  useEffect(() => {
    if (dataSeriesRef.current && latitudeHistory.length > 0) {
      dataSeriesRef.current.clear();
      dataSeriesRef.current.appendRange(latitudeHistory, altitudeHistory, longitudeHistory);
    }
  }, [latitudeHistory, longitudeHistory, altitudeHistory]);

  // Initialize SciChart 3D Surface
  const initChart = async (rootElement) => {
    const { sciChart3DSurface, wasmContext } = await SciChart3DSurface.create(rootElement);
    sciChartSurfaceRef.current = sciChart3DSurface;

    // X Axis - Latitude
    const xAxis = new NumericAxis3D(wasmContext, {
      axisTitle: "Latitude (°)",
      axisAlignment: EAxisAlignment.Bottom
    });
    sciChart3DSurface.xAxis = xAxis;

    // Y Axis - Altitude
    const yAxis = new NumericAxis3D(wasmContext, {
      axisTitle: "Altitude (m)",
      axisAlignment: EAxisAlignment.Left
    });
    sciChart3DSurface.yAxis = yAxis;

    // Z Axis - Longitude
    const zAxis = new NumericAxis3D(wasmContext, {
      axisTitle: "Longitude (°)",
      axisAlignment: EAxisAlignment.Left
    });
    sciChart3DSurface.zAxis = zAxis;

    // Create 3D data series
    const gpsDataSeries = new XyzDataSeries3D(wasmContext, {
      dataSeriesName: "GPS 3D Path"
    });
    dataSeriesRef.current = gpsDataSeries;

    // Create scatter series with sphere markers
    const scatterSeries = new ScatterRenderableSeries3D(wasmContext, {
      dataSeries: gpsDataSeries,
      pointMarker: new SpherePointMarker3D(wasmContext, {
        size: 5,
        fill: "#4ecdc4"
      })
    });

    sciChart3DSurface.renderableSeries.add(scatterSeries);

    // Add 3D modifiers for interaction (Orbit, Zoom, Reset)
    sciChart3DSurface.chartModifiers.add(new OrbitModifier3D());
    sciChart3DSurface.chartModifiers.add(new MouseWheelZoomModifier3D());
    sciChart3DSurface.chartModifiers.add(new ResetCamera3DModifier());

    // Set initial camera position
    sciChart3DSurface.camera.position = new Vector3(300, 300, 300);
    sciChart3DSurface.camera.target = new Vector3(0, 0, 0);

    return { sciChartSurface: sciChart3DSurface };
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <SciChartReact
          initChart={initChart}
          style={{
            height: "100%",
            width: "100%"
          }}
        />
      </div>
    </div>
  );
}