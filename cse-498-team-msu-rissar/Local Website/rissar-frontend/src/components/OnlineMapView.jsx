/**
 * Online Map View Component
 * 
 * Displays a live map using Leaflet, tracking the vehicle's position via GNSS data.
 * Connects to a ROS topic to receive geometry_msgs/Point messages representing latitude/longitude.
 * 
 */
import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents
} from 'react-leaflet'
import "leaflet/dist/leaflet.css"
import { getRosbridgeInstance } from '../utils/rosbridgeConnection';
import { useReplay } from '../utils/ReplayContext';

function ChangeMapView({ center }) {
  const map = useMap();
  const prevCenterRef = useRef(center);

  useEffect(() => {
    const prev = prevCenterRef.current;
    const next = center;

    if (prev[0] !== next[0] || prev[1] !== next[1]) {
      map.setView(next);
      prevCenterRef.current = next;
    }
  }, [center, map]);

  return null;
}

function DetectManualPan({ setFollowCar }) {
  useMapEvents({
    movestart() {
      setFollowCar(false);
    }
  });
  return null;
}

export default function OnlineMapView({
  rosbridgeUrl = 'ws://192.168.8.4:9090',
  topicName = null,
  carNamespace = null
}) {
  const { getTopicName } = useReplay();

  const baseTopic = carNamespace
    ? `/${carNamespace}/sensors/gnss`
    : (topicName || '/car1_ns/sensors/gnss');

  const currentTopicName = getTopicName(baseTopic);
  const [mapCenter, setMapCenter] = useState([42.7251, -84.4791]);
  const [carPosition, setCarPosition] = useState([42.7251, -84.4791]);
  const [followCar, setFollowCar] = useState(true);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [hasValidData, setHasValidData] = useState(false);

  const rosbridgeRef = useRef(null);
  const topicRef = useRef(null);

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

  // Subscribe to GNSS topic and update map center
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

        const newPosition = [latitude, longitude];
        setCarPosition(newPosition);

        // Check if data is valid (not default 0,0 or similar placeholder)
        const isValid = latitude !== 42.725100 && longitude !== -84.479100;
        setHasValidData(isValid);

        // Auto-pan map if follow mode is active
        if (followCar) {
          setMapCenter(newPosition);
        }
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
  }, [connected, currentTopicName, followCar]);

  const handleFollowClick = () => {
    setFollowCar(true);
    setMapCenter(carPosition);
  };

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      <div className="flex flex-col gap-1 flex-shrink-0 mb-1">
        <div className={`px-2 py-0.5 rounded text-xs flex items-center gap-2 ${connected
          ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200'
          : 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200'
          }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-600 dark:bg-green-500' : 'bg-yellow-600 dark:bg-yellow-500'
            }`} />
          <span className="text-[10px]">
            {connected ? 'GNSS Connected' : 'Connecting to GNSS...'}
            {hasValidData && ' - GPS Fix'}
            {connected && !hasValidData && ' - No GPS Fix'}
          </span>
          {error && <span className="text-red-600 dark:text-red-400 ml-auto text-[10px]">Error: {error}</span>}
        </div>

        <div className="px-2 py-0 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-between gap-2 text-gray-900 dark:text-gray-100 h-6">
          <span className="text-[10px] font-mono">{carPosition[0].toFixed(6)}°, {carPosition[1].toFixed(6)}°</span>
          <button
            onClick={handleFollowClick}
            className={`h-full text-[9px] px-2 rounded flex items-center leading-none ${followCar
              ? 'bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-600'
              : 'bg-gray-500 dark:bg-gray-600 text-white hover:bg-gray-600 dark:hover:bg-gray-500'
              }`}
          >
            {followCar ? 'Following' : 'Follow Car'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full">
        <MapContainer
          center={mapCenter}
          zoom={17}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <ChangeMapView center={mapCenter} />
          <DetectManualPan setFollowCar={setFollowCar} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={carPosition}>
            <Popup>
              <div className="text-gray-900">
                Car Position <br />
                Latitude: {carPosition[0].toFixed(6)}° <br />
                Longitude: {carPosition[1].toFixed(6)}° <br />
                <span className={hasValidData ? 'text-green-700 font-semibold' : 'text-yellow-700 font-semibold'}>
                  {hasValidData ? 'GPS Fix' : 'No GPS Fix'}
                </span>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}