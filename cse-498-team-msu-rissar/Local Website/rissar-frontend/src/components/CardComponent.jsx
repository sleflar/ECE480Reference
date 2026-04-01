/**
 * Card Component
 * 
 * A versatile container component that can display various types of content.
 * Supports switching content type via a dropdown, fullscreen mode, and swapping positions.
 * 
 */
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Maximize2, Minimize2, ChevronLeft, ChevronRight } from "lucide-react";
import { useFullscreen } from "../utils/FullscreenContext";
import LidarChartView from "./LidarChartView";
import OnlineMapView from "./OnlineMapView";
import OfflineMapView from "./OfflineMap";
import ThreeDLidarChart from "./3DLidarChartView";
import LiveFeed from "../components/LiveFeed";
import SteeringAngle from "./SteeringAngle";
import BrakeThrottle from "./BrakeThrottle";
import GNSSChartView from "./GNSSChartView";
import GNSS3DChartView from "./GNSS3DChartView";
import GNSS from "./GNSS";
import IMU from "./IMU";
import IMUChartView from "./IMUChartView";
import SpeedRuntime from "./SpeedRuntime";
import Joystick from "../components/Joystick";
import NetworkStats from "./NetworkStats";

export default function CardComponent({
  value: controlledValue,
  onChange,
  disabledOptions = [],
  carNamespace = "car1_ns",
  cardIndex,
  gridColumns,
  cardCount,
  onCardSwap,
}) {
  const [localValue, setLocalValue] = useState(controlledValue || "None");
  const value = controlledValue !== undefined ? controlledValue : localValue;
  const { fullscreenCardIndex, enterFullscreen, exitFullscreen } = useFullscreen();
  const isThisCardFullscreen = fullscreenCardIndex === cardIndex;

  const handleChange = (newValue) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setLocalValue(newValue);
    }
  };

  // Handle fullscreen toggle
  const handleFullscreenToggle = () => {
    if (isThisCardFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen(cardIndex);
    }
  };

  // Handle swapping card position to the left
  const handleSwapLeft = () => {
    if (cardIndex > 0 && onCardSwap) {
      onCardSwap(cardIndex, cardIndex - 1);
    }
  };

  // Handle swapping card position to the right
  const handleSwapRight = () => {
    if (cardIndex < cardCount - 1 && onCardSwap) {
      onCardSwap(cardIndex, cardIndex + 1);
    }
  };

  const isFirstCard = cardIndex === 0;
  const isLastCard = cardIndex === cardCount - 1;

  // Render the selected component based on 'value' prop
  const renderContent = () => {
    switch (value) {
      case "LiDar":
        return <LidarChartView carNamespace={carNamespace} />;
      case "LiveFeed":
        return (
          <LiveFeed
            rosbridgeUrl="ws://192.168.8.4:9090"
            carNamespace={carNamespace}
            showConnectionStatus={true}
          />
        );
      case "3dlidar":
        return <ThreeDLidarChart carNamespace={carNamespace} />;
      case "OnlineMap":
        return <OnlineMapView carNamespace={carNamespace} />;
      case "OfflineMap":
        return <OfflineMapView carNamespace={carNamespace} />;
      case "SteerAngle":
        return (
          <SteeringAngle
            rosbridgeUrl="ws://192.168.8.4:9090"
            topicName={`/${carNamespace}/commands/servo/position`}
            showConnectionStatus={true}
          />
        );
      case "BrakeThrottle":
        return (
          <BrakeThrottle
            rosbridgeUrl="ws://192.168.8.4:9090"
            throttleTopicName={`/${carNamespace}/commands/motor/duty_cycle`}
            brakeTopicName={`/${carNamespace}/commands/motor/brake`}
          />
        );
      case "GNSS_chart":
        return <GNSSChartView carNamespace={carNamespace} />;
      case "GNSS_3d_chart":
        return <GNSS3DChartView carNamespace={carNamespace} />;
      case "GNSS":
        return <GNSS carNamespace={carNamespace} />;
      case "IMU":
        return <IMU carNamespace={carNamespace} />;
      case "IMU_chart":
        return <IMUChartView carNamespace={carNamespace} />;
      case "SpeedRuntime":
        return (
          <SpeedRuntime
            rosbridgeUrl="ws://192.168.8.4:9090"
            topicName={`/${carNamespace}/commands/motor/duty_cycle`}
            showConnectionStatus={true}
          />
        );
      case "Joystick":
        return <Joystick rosbridgeUrl="ws://192.168.8.4:9090" topicName="/joy" simpleView={false} />;
      case "NetworkStats":
        return <NetworkStats rosbridgeUrl="ws://192.168.8.4:9090" serviceName={`/${carNamespace}/get_time`} topicName={`/${carNamespace}/sensors/gnss`} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-black dark:text-white">
            [None]
          </div>
        );
    }
  };

  return (
    <Card className="flex flex-col h-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-black">
      <CardContent className="flex flex-col h-full p-0 gap-0">
        <div className="px-0 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Select value={value} onValueChange={handleChange}>
            <SelectTrigger className="flex-1 h-10 text-lg font-lg rounded-md px-0 py-2">
              <SelectValue placeholder="Select content" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="None">None</SelectItem>
              <SelectItem
                value="LiveFeed"
                disabled={disabledOptions.includes("LiveFeed")}
              >
                Live Feed
              </SelectItem>
              <SelectItem value="LiDar">LiDAR</SelectItem>
              <SelectItem value="GNSS">GNSS</SelectItem>
              <SelectItem value="GNSS_chart">GNSS chart</SelectItem>
              <SelectItem value="GNSS_3d_chart">GNSS 3D chart</SelectItem>
              <SelectItem value="OnlineMap">Online Map</SelectItem>
              <SelectItem value="OfflineMap">Offline Map</SelectItem>
              <SelectItem value="IMU">IMU</SelectItem>
              <SelectItem value="IMU_chart">IMU chart</SelectItem>
              <SelectItem value="BrakeThrottle">Brake & Throttle</SelectItem>
              <SelectItem value="SteerAngle">Steering angle</SelectItem>
              <SelectItem value="SpeedRuntime">Speed & Runtime</SelectItem>
              <SelectItem value="3dlidar">3D lidar</SelectItem>
              <SelectItem value="Joystick">Joystick</SelectItem>
              <SelectItem value="NetworkStats">Network Stats</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={handleSwapLeft}
            disabled={isFirstCard}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Swap left"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={handleSwapRight}
            disabled={isLastCard}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Swap right"
          >
            <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={handleFullscreenToggle}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            title={isThisCardFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isThisCardFullscreen ? (
              <Minimize2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <Maximize2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
        <div className="flex flex-col flex-1 overflow-hidden w-full px-0 py-0">
          {renderContent()}
        </div>
      </CardContent>
    </Card>
  );
}