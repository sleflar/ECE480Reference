/**
 * TwoCarView
 * 
 * Dashboard view designed for monitoring two vehicles simultaneously.
 * Split screen layout with configurable slots for each vehicle.
 * 
 */
import { useState, useEffect } from "react";
import CardComponent from "./components/CardComponent";
import StaticCardComponent from "./components/StaticCardComponent";
import LiveFeed from "./components/LiveFeed";

export default function TwoCarView() {
  const [car1Slot1, setCar1Slot1] = useState(() => {
    return localStorage.getItem('twoCarView_car1_slot1') || 'None';
  });
  const [car1Slot2, setCar1Slot2] = useState(() => {
    return localStorage.getItem('twoCarView_car1_slot2') || 'None';
  });
  const [car2Slot1, setCar2Slot1] = useState(() => {
    return localStorage.getItem('twoCarView_car2_slot1') || 'None';
  });
  const [car2Slot2, setCar2Slot2] = useState(() => {
    return localStorage.getItem('twoCarView_car2_slot2') || 'None';
  });

  useEffect(() => {
    localStorage.setItem('twoCarView_car1_slot1', car1Slot1);
  }, [car1Slot1]);

  useEffect(() => {
    localStorage.setItem('twoCarView_car1_slot2', car1Slot2);
  }, [car1Slot2]);

  useEffect(() => {
    localStorage.setItem('twoCarView_car2_slot1', car2Slot1);
  }, [car2Slot1]);

  useEffect(() => {
    localStorage.setItem('twoCarView_car2_slot2', car2Slot2);
  }, [car2Slot2]);

  return (
    <div className="p-2 sm:p-4 h-[calc(100dvh-60px)] w-full box-border flex flex-col overflow-hidden bg-white dark:bg-black">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 grid-rows-auto lg:grid-rows-2 gap-2 h-full w-full">
        {/* Car 1 - Left Half */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-2 row-span-1 rounded-lg bg-white dark:bg-[#181818] border border-brand-green/20 flex flex-col min-h-0 overflow-hidden">
          <StaticCardComponent title="Car 1 - Live Feed">
            <LiveFeed
              rosbridgeUrl="ws://192.168.8.4:9090"
              carNamespace="car1_ns"
              showConnectionStatus={true}
            />
          </StaticCardComponent>
        </div>

        {/* Car 2 - Right Half */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-2 row-span-1 rounded-lg bg-white dark:bg-[#181818] border border-brand-green/20 flex flex-col min-h-0 overflow-hidden">
          <StaticCardComponent title="Car 2 - Live Feed">
            <LiveFeed
              rosbridgeUrl="ws://192.168.8.4:9090"
              carNamespace="car2_ns"
              showConnectionStatus={true}
            />
          </StaticCardComponent>
        </div>

        {/* Car 1 Components - Bottom Left Half */}
        <div className="col-span-1 row-span-1 rounded-lg bg-white dark:bg-[#181818] border border-brand-green/20 flex flex-col min-h-0 overflow-hidden">
          <CardComponent
            value={car1Slot1}
            onChange={setCar1Slot1}
            carNamespace="car1_ns"
            disabledOptions={["LiveFeed"]}
          />
        </div>
        <div className="col-span-1 row-span-1 rounded-lg bg-white dark:bg-[#181818] border border-brand-green/20 flex flex-col min-h-0 overflow-hidden">
          <CardComponent
            value={car1Slot2}
            onChange={setCar1Slot2}
            carNamespace="car1_ns"
            disabledOptions={["LiveFeed"]}
          />
        </div>

        {/* Car 2 Components - Bottom Right Half */}
        <div className="col-span-1 row-span-1 rounded-lg bg-white dark:bg-[#181818] border border-brand-green/20 flex flex-col min-h-0 overflow-hidden">
          <CardComponent
            value={car2Slot1}
            onChange={setCar2Slot1}
            carNamespace="car2_ns"
            disabledOptions={["LiveFeed"]}
          />
        </div>
        <div className="col-span-1 row-span-1 rounded-lg bg-white dark:bg-[#181818] border border-brand-green/20 flex flex-col min-h-0 overflow-hidden">
          <CardComponent
            value={car2Slot2}
            onChange={setCar2Slot2}
            carNamespace="car2_ns"
            disabledOptions={["LiveFeed"]}
          />
        </div>
      </div>
    </div>
  );
}