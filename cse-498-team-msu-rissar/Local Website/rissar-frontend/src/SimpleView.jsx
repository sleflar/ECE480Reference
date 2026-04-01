/**
 * SimpleView
 * 
 * Fixed layout dashboard view with essential components (Live Feed, Map, Stats, Joystick).
 * 
 */
import StaticCardComponent from "./components/StaticCardComponent";
import LiveFeed from "./components/LiveFeed";
import OnlineMapView from "./components/OnlineMapView";
import Joystick from "./components/Joystick";
import VehicleStats from "./components/VehicleStats";
import NetworkStats from "./components/NetworkStats";

export default function SimpleView() {
  // Render a fixed grid layout with specific components
  return (
    <div className="p-2 sm:p-4 h-[calc(100dvh-60px)] w-full box-border flex flex-col overflow-hidden bg-white dark:bg-black">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 grid-rows-auto lg:grid-rows-2 gap-2 h-full w-full">
        {/* Top Left: Live Camera Feed */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-3 row-span-1 flex flex-col min-h-0 overflow-hidden">
          <StaticCardComponent title="Live Feed">
            <LiveFeed rosbridgeUrl="ws://192.168.8.4:9090" topicName="/car1_ns/sensors/camera_feed" showConnectionStatus={true} />
          </StaticCardComponent>
        </div>
        {/* Top Middle: Map View */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-3 row-span-1 flex flex-col min-h-0 overflow-hidden">
          <StaticCardComponent title="Map">
            <OnlineMapView />
          </StaticCardComponent>
        </div>
        {/* Bottom Left: Vehicle Statistics */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-1 row-span-1 flex flex-col min-h-0 overflow-hidden">
          <StaticCardComponent title="Vehicle Stats">
            <VehicleStats rosbridgeUrl="ws://192.168.8.4:9090" />
          </StaticCardComponent>
        </div>
        {/* Bottom Middle: Joystick Control */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-4 row-span-1 flex flex-col min-h-0 overflow-hidden">
          <StaticCardComponent title="Joystick">
            <Joystick rosbridgeUrl="ws://192.168.8.4:9090" topicName="/joy" simpleView={true} />
          </StaticCardComponent>
        </div>
        {/* Bottom Right: Network Statistics */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-1 row-span-1 flex flex-col min-h-0 overflow-hidden">
          <StaticCardComponent title="Network Stats">
            <NetworkStats rosbridgeUrl="ws://192.168.8.4:9090" serviceName='/car1_ns/get_time' topicName='/car1_ns/sensors/gnss' />
          </StaticCardComponent>
        </div>
      </div>
    </div>
  );
}