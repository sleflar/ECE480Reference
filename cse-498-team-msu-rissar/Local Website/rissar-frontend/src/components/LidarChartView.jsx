/**
 * 2D Lidar Chart View Component
 * 
 * Visualizes Lidar scan data in a polar plot using SciChart.
 * Connects to a ROS topic to receive sensor_msgs/LaserScan messages.
 * 
 */
import React, { useEffect, useRef, useState } from "react";
import { getRosbridgeInstance } from "../utils/rosbridgeConnection";
import {
  SciChartPolarSurface,
  PolarNumericAxis,
  EPolarAxisMode,
  EPolarLabelMode,
  EAxisAlignment,
  PolarXyScatterRenderableSeries,
  XyDataSeries,
  NumberRange,
  EPointMarkerType
} from "scichart";
import { useReplay } from '../utils/ReplayContext';

SciChartPolarSurface.loadWasmFromCDN();
SciChartPolarSurface.UseCommunityLicense();

export default function LidarChartView({
  rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || "ws://192.168.8.4:9090",
  topicName = null,
  carNamespace = null,
}) {
  const { getTopicName } = useReplay();

  const baseTopic = carNamespace
    ? `/${carNamespace}/scan`
    : (topicName || '/car1_ns/scan');

  const currentTopicName = getTopicName(baseTopic);
  const chartDivRef = useRef(null);
  const rosbridgeRef = useRef(null);
  const lidarSeriesRef = useRef(null);
  const surfaceRef = useRef(null);
  const radialAxisRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(7);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const topicRef = useRef(null);
  const rawDataRef = useRef({ angleValues: [], radiusValues: [] });

  useEffect(() => {
    if (!chartDivRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(chartDivRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Connect to ROSBridge
  useEffect(() => {
    const rosbridge = getRosbridgeInstance(rosbridgeUrl);
    rosbridgeRef.current = rosbridge;

    const removeListener = rosbridge.addListener((event) => {
      if (event.type === 'connected') {
        setConnected(true);
      } else if (event.type === 'disconnected') {
        setConnected(false);
      }
    });

    rosbridge.connect().catch((err) => {
      console.error('Failed to connect to rosbridge:', err);
    });

    return () => {
      removeListener();
      if (topicRef.current) {
        topicRef.current.unsubscribe();
      }
    };
  }, [rosbridgeUrl]);

  // Initialize SciChart Polar Surface
  useEffect(() => {
    const initSciChart = async () => {
      const { sciChartSurface: surface, wasmContext } =
        await SciChartPolarSurface.create(chartDivRef.current);

      surfaceRef.current = surface;

      // Radial Axis (Distance)
      const radialYAxis = new PolarNumericAxis(wasmContext, {
        polarAxisMode: EPolarAxisMode.Radial,
        axisAlignment: EAxisAlignment.Right,
        visibleRange: new NumberRange(0, zoomLevel),
        drawLabels: false,
      });
      surface.yAxes.add(radialYAxis);
      radialAxisRef.current = radialYAxis;

      // Angular Axis (Degrees)
      const polarXAxis = new PolarNumericAxis(wasmContext, {
        polarAxisMode: EPolarAxisMode.Angular,
        axisAlignment: EAxisAlignment.Top,
        polarLabelMode: EPolarLabelMode.Parallel,
        visibleRange: new NumberRange(0, 360),
        autoTicks: false,
        majorDelta: 45,
        labelPostfix: "°",
      });
      surface.xAxes.add(polarXAxis);

      // Lidar Data Series
      const lidarSeries = new PolarXyScatterRenderableSeries(wasmContext, {
        dataSeries: new XyDataSeries(wasmContext),
        pointMarker: {
          type: EPointMarkerType.Ellipse,
          options: {
            width: 5,
            height: 5,
            fill: "rgba(0, 200, 200, 0.6)",
            stroke: "white",
            strokeThickness: 0.8,
          },
        },
      });

      surface.renderableSeries.add(lidarSeries);
      lidarSeriesRef.current = lidarSeries;
    };

    initSciChart();
  }, []);

  // Update chart zoom level and filter data
  useEffect(() => {
    if (radialAxisRef.current) {
      radialAxisRef.current.visibleRange = new NumberRange(0, zoomLevel);
    }

    if (lidarSeriesRef.current && lidarSeriesRef.current.dataSeries) {
      const { angleValues, radiusValues } = rawDataRef.current;
      if (angleValues && angleValues.length > 0) {
        const filteredAngles = [];
        const filteredRadii = [];

        // Filter points based on current zoom level
        for (let i = 0; i < angleValues.length; i++) {
          if (radiusValues[i] <= zoomLevel) {
            filteredAngles.push(angleValues[i]);
            filteredRadii.push(radiusValues[i]);
          }
        }

        const ds = lidarSeriesRef.current.dataSeries;
        ds.clear();
        ds.appendRange(filteredAngles, filteredRadii);
      }
    }
  }, [zoomLevel]);

  // Update chart data
  useEffect(() => {
    if (!lidarSeriesRef.current || !lidarSeriesRef.current.dataSeries) return;

    const { angleValues, radiusValues } = rawDataRef.current;
    if (angleValues.length === 0) return;

    const ds = lidarSeriesRef.current.dataSeries;
    ds.clear();
    ds.appendRange(angleValues, radiusValues);
  }, []);

  // Subscribe to LiDAR topic
  useEffect(() => {
    if (!connected || !rosbridgeRef.current) return;

    const topic = rosbridgeRef.current.createTopic(
      currentTopicName,
      'sensor_msgs/LaserScan'
    );

    topicRef.current = topic;

    topic.subscribe((msg) => {
      if (!lidarSeriesRef.current || !lidarSeriesRef.current.dataSeries) return;

      const { ranges, angle_min, angle_increment } = msg;
      const angleValues = [];
      const radiusValues = [];

      // Process ranges and convert to polar coordinates
      for (let i = 0; i < ranges.length; i++) {
        const angle = ((angle_min + i * angle_increment) * 180) / Math.PI;
        const adjustedAngle = (-angle) % 360;
        const normalizedAngle = ((adjustedAngle % 360) + 360) % 360;
        const range = ranges[i];

        // Filter invalid ranges
        if (range > 0 && range < 10) {
          angleValues.push(normalizedAngle);
          radiusValues.push(range);
        }
      }

      const filteredAngles = [];
      const filteredRadii = [];

      // Apply zoom filtering
      for (let i = 0; i < angleValues.length; i++) {
        if (radiusValues[i] <= zoomLevel) {
          filteredAngles.push(angleValues[i]);
          filteredRadii.push(radiusValues[i]);
        }
      }

      rawDataRef.current = { angleValues, radiusValues };

      const ds = lidarSeriesRef.current.dataSeries;
      ds.clear();
      ds.appendRange(filteredAngles, filteredRadii);
    });

    console.log(`Subscribed to ${topicName}`);

    return () => {
      if (topic) {
        topic.unsubscribe();
        console.log(`Unsubscribed from ${topicName}`);
      }
    };
  }, [connected, currentTopicName]);

  const handleResetZoom = () => {
    setZoomLevel(7);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.max(1, prev - 1));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.min(15, prev + 1));
  };

  const baseFontSize = Math.min(containerSize.width, containerSize.height) * 0.02;
  const fontSize = Math.max(10, Math.min(16, baseFontSize));
  const buttonSize = Math.max(28, fontSize * 2);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={chartDivRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
          borderRadius: "8px",
        }}
      />
      <div
        className="absolute top-3 right-3 z-20 flex flex-col gap-2 rounded-xl border border-white/15 bg-black/85 p-3 text-white shadow-2xl backdrop-blur"
        style={{ gap: `${fontSize * 0.5}px` }}
      >
        <div
          className="flex items-center justify-between rounded-lg border border-white/20 bg-white/5 font-semibold"
          style={{ padding: `${fontSize * 0.4}px ${fontSize * 0.8}px` }}
        >
          <span style={{ fontSize: `${fontSize}px` }}>Range: {zoomLevel}m</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomIn}
              className="flex items-center justify-center rounded-md border border-white/30 bg-white/10 text-white transition hover:bg-white/20"
              style={{ height: buttonSize, width: buttonSize, fontSize: `${fontSize}px` }}
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="flex items-center justify-center rounded-md border border-white/30 bg-white/10 text-white transition hover:bg-white/20"
              style={{ height: buttonSize, width: buttonSize, fontSize: `${fontSize}px` }}
            >
              -
            </button>
          </div>
        </div>
        <button
          onClick={handleResetZoom}
          className="rounded-lg border border-white/25 bg-white/10 font-semibold text-white transition hover:bg-white/20"
          style={{ padding: `${fontSize * 0.5}px ${fontSize}px`, fontSize: `${fontSize}px` }}
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
