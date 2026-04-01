/**
 * GNSS 2D Chart View Component
 * 
 * Visualizes GNSS path data in 2D using SciChart.
 * Plots Latitude vs Longitude.
 * 
 */
import React, { useEffect, useRef, useState } from 'react';
import { EAxisType, SciChartSurface, ESeriesType, EChart2DModifierType, EPointMarkerType, NumericAxis, XyDataSeries, FastLineRenderableSeries, EllipsePointMarker, ZoomPanModifier, MouseWheelZoomModifier, ZoomExtentsModifier, LegendModifier, EAxisAlignment } from "scichart";
import { SciChartReact } from "scichart-react";
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import { useReplay } from '../utils/ReplayContext';

SciChartSurface.loadWasmFromCDN();
SciChartSurface.UseCommunityLicense();

export default function GNSSChartView({
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
      dataSeriesRef.current.appendRange(latitudeHistory, longitudeHistory);
    }
  }, [latitudeHistory, longitudeHistory]);

  // Initialize SciChart 2D Surface
  const initChart = async (rootElement) => {
    const { sciChartSurface, wasmContext } = await SciChartSurface.create(rootElement);
    sciChartSurfaceRef.current = sciChartSurface;

    // X Axis - Latitude
    const xAxis = new NumericAxis(wasmContext, {
      axisTitle: "Latitude (°)",
      axisTitleStyle: {
        fontSize: 15,      
      }
    });
    sciChartSurface.xAxes.add(xAxis);

    // Y Axis - Longitude
    const yAxis = new NumericAxis(wasmContext, {
      axisTitle: "Longitude (°)",
      axisTitleStyle: {
        fontSize: 15,

      }
    });
    sciChartSurface.yAxes.add(yAxis);

    // Create data series
    const gpsDataSeries = new XyDataSeries(wasmContext, {
      dataSeriesName: "GPS Path"
    });
    dataSeriesRef.current = gpsDataSeries;

    // Create line series with markers
    const lineSeries = new FastLineRenderableSeries(wasmContext, {
      dataSeries: gpsDataSeries,
      stroke: "#4ecdc4",
      strokeThickness: 2,
      pointMarker: new EllipsePointMarker(wasmContext, {
        width: 8,
        height: 8,
        fill: "#4ecdc4",
        stroke: "#2a9d8f",
        strokeThickness: 1
      })
    });

    sciChartSurface.renderableSeries.add(lineSeries);

    // Add modifiers for interaction (Zoom, Pan, MouseWheel, Legend)
    sciChartSurface.chartModifiers.add(new ZoomPanModifier({ enableZoom: true }));
    sciChartSurface.chartModifiers.add(new MouseWheelZoomModifier());
    sciChartSurface.chartModifiers.add(new ZoomExtentsModifier());
    sciChartSurface.chartModifiers.add(new LegendModifier({
      showLegend: true,
      showSeriesMarkers: true
    }));

    return { sciChartSurface };
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Chart */}
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