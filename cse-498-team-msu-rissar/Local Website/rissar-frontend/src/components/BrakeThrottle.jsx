/**
 * Brake and Throttle Chart Component
 * 
 * Visualizes brake and throttle commands over time using SciChart.
 * Connects to ROS topics to receive command values.
 * 
 */
import React, { useEffect, useRef, useState } from "react";
import { getRosbridgeInstance } from "../utils/rosbridgeConnection";
import { Button } from "@/components/ui/button";
import { useReplay } from "../utils/ReplayContext";
import {
	EAxisType,
	SciChartSurface,
	ESeriesType,
	EChart2DModifierType,
	NumericAxis,
	EAxisMode,
	ELabelMode,
	EAxisAlignment,
	FastLineRenderableSeries,
	XyDataSeries,
	NumberRange,
	EPointMarkerType,
	ZoomPanModifier,
	MouseWheelZoomModifier,
	ZoomExtentsModifier,
	EXyDirection
} from "scichart";
import { SciChartReact } from "scichart-react";

SciChartSurface.loadWasmFromCDN();
SciChartSurface.UseCommunityLicense();


// Helper function to export chart data as CSV
function handleCopy(throttleTimeValues, throttleValues, brakeTimeValues, brakeValues) {
	let content = "";
	content += "time,throttle\n";
	for (let i = 0; i < throttleTimeValues.length; i++) {
		content += throttleTimeValues[i] + ',' + throttleValues[i] + '\n';
	}
	content += "\ntime,brake\n";
	for (let i = 0; i < brakeTimeValues.length; i++) {
		content += brakeTimeValues[i] + ',' + brakeValues[i] + '\n';
	}
	try {
		const blob = new Blob([content], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = "brakeThrottleValues.csv";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		return { success: true };
	} catch (error) {
		console.error('Failed to download XML file:', error);
		return { success: false, error: error.message };
	}
}

export default function BrakeThrottle({
	rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090',
	throttleTopicName = null,
	brakeTopicName = null,
	carNamespace = 'car1_ns',
}) {
	const { getTopicName, isReplaying } = useReplay();

	const baseThrottleTopic = carNamespace
		? `/${carNamespace}/commands/motor/duty_cycle`
		: (throttleTopicName || '/car1_ns/commands/motor/duty_cycle');

	const baseBrakeTopic = carNamespace
		? `/${carNamespace}/commands/motor/brake`
		: (brakeTopicName || '/car1_ns/commands/motor/brake');

	const currentThrottleTopic = getTopicName(baseThrottleTopic);
	const currentBrakeTopic = getTopicName(baseBrakeTopic);

	const chartDivRef = useRef(null);
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState(null);
	const rosbridgeRef = useRef(null);
	const brakeSeriesRef = useRef(null);
	const throttleSeriesRef = useRef(null);
	const throttleTopicRef = useRef(null);
	const brakeTopicRef = useRef(null);
	const [throttleTimeValues, setThrottleTimeValues] = useState([]);
	const [brakeTimeValues, setBrakeTimeValues] = useState([]);
	const [throttleValues, setThrottleValues] = useState([]);
	const [brakeValues, setBrakeValues] = useState([]);
	const [runtime, setRuntime] = useState(0);

	useEffect(() => {
		// Initialize rosbridge connection
		const rosbridge = getRosbridgeInstance(rosbridgeUrl);
		rosbridgeRef.current = rosbridge;

		// Add connection status listener
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

		// Connect to rosbridge
		rosbridge.connect().catch((err) => {
			console.error('Failed to connect to rosbridge:', err);
			setError(err?.message || 'Connection failed');
		});

		return () => {
			removeListener();
			// Unsubscribe from topic when component unmounts
			if (throttleTopicRef.current) {
				throttleTopicRef.current.unsubscribe();
				throttleTopicRef.current = null;
			}
			if (brakeTopicRef.current) {
				brakeTopicRef.current.unsubscribe();
				brakeTopicRef.current = null;
			}
		};
	}, [rosbridgeUrl]);

	// Track runtime for X-axis timestamps
	useEffect(() => {
		const startTime = Date.now();
		const interval = setInterval(() => {
			const elapsed = Math.floor((Date.now() - startTime) / 1000);
			setRuntime(elapsed);
		}, 1000);

		return () => clearInterval(interval);
	}, []);

	const speed_to_erpm_gain = 20.0;

	// Subscribe to throttle topic and update chart
	useEffect(() => {
		if (!connected || !rosbridgeRef.current) {
			return;
		}

		try {
			const throttleTopic = rosbridgeRef.current.createTopic(
				currentThrottleTopic,
				'std_msgs/msg/Float64'
			);
			throttleTopicRef.current = throttleTopic;

			// Subscribe to topic and handle incoming messages
			throttleTopic.subscribe((message) => {
				if (!throttleSeriesRef.current || !throttleSeriesRef.current.dataSeries) return;

				const throttleValue = Math.abs(message.data * speed_to_erpm_gain);
				setThrottleValues([...throttleValues, throttleValue]);
				setThrottleTimeValues([...throttleTimeValues, runtime]);
				// When throttle is active, brake is assumed 0
				setBrakeValues([...brakeValues, 0]);
				setBrakeTimeValues([...brakeTimeValues, runtime]);

				// Update SciChart data series
				const throttleDs = throttleSeriesRef.current.dataSeries;
				throttleDs.clear();
				throttleDs.appendRange(throttleTimeValues, throttleValues);
				const brakeDs = brakeSeriesRef.current.dataSeries;
				brakeDs.clear();
				brakeDs.appendRange(brakeTimeValues, brakeValues);
			});

			console.log(`Subscribed to ${currentThrottleTopic}`);
		} catch (err) {
			console.error('Failed to subscribe to throttle topic:', err);
			setError(err?.message || 'Subscription failed');
		}

		return () => {
			if (throttleTopicRef.current) {
				throttleTopicRef.current.unsubscribe();
				console.log(`Unsubscribed from ${currentThrottleTopic}`);
			}
		};
	}, [connected, currentThrottleTopic, throttleTimeValues, throttleValues, brakeTimeValues, brakeValues]);

	// Subscribe to brake topic and update chart
	useEffect(() => {
		if (!connected || !rosbridgeRef.current) {
			return;
		}

		try {
			const brakeTopic = rosbridgeRef.current.createTopic(
				currentBrakeTopic,
				'std_msgs/msg/Float64'
			);
			brakeTopicRef.current = brakeTopic;

			// Subscribe to topic and handle incoming messages
			brakeTopic.subscribe((message) => {
				if (!brakeSeriesRef.current || !brakeSeriesRef.current.dataSeries) return;

				// Logarithmic scaling for brake visualization
				const brakeValue = Math.log10(Math.max(message.data, 1)) * 4;
				setBrakeValues([...brakeValues, brakeValue]);
				setBrakeTimeValues([...brakeTimeValues, runtime]);
				// When brake is active, throttle is assumed 0
				setThrottleValues([...throttleValues, 0]);
				setThrottleTimeValues([...throttleTimeValues, runtime]);

				// Update SciChart data series
				const throttleDs = throttleSeriesRef.current.dataSeries;
				throttleDs.clear();
				throttleDs.appendRange(throttleTimeValues, throttleValues);
				const brakeDs = brakeSeriesRef.current.dataSeries;
				brakeDs.clear();
				brakeDs.appendRange(brakeTimeValues, brakeValues);
			});

			console.log(`Subscribed to ${currentBrakeTopic}`);
		} catch (err) {
			console.error('Failed to subscribe to brake topic:', err);
			setError(err?.message || 'Subscription failed');
		}

		return () => {
			if (brakeTopicRef.current) {
				brakeTopicRef.current.unsubscribe();
				console.log(`Unsubscribed from ${currentBrakeTopic}`);
			}
		};
	}, [connected, currentBrakeTopic, brakeTimeValues, brakeValues]);

	useEffect(() => {
		const initSciChart = async () => {
			const { sciChartSurface: surface, wasmContext } =
				await SciChartSurface.create(chartDivRef.current);

			const YAxis = new NumericAxis(wasmContext, {
				axisAlignment: EAxisAlignment.Left,
				visibleRange: new NumberRange(0, 21),
			});
			surface.yAxes.add(YAxis);

			const XAxis = new NumericAxis(wasmContext, {
				axisAlignment: EAxisAlignment.Bottom,
				visibleRange: new NumberRange(0, 60),
			});
			surface.xAxes.add(XAxis);

			XAxis.visibleRangeLimit = new NumberRange(0, Number.MAX_SAFE_INTEGER);
			YAxis.visibleRangeLimit = new NumberRange(0, Number.MAX_SAFE_INTEGER);

			XAxis.minVisibleRange = 0.5;
			YAxis.minVisibleRange = 0.05;

			const throttleSeries = new FastLineRenderableSeries(wasmContext, {
				dataSeries: new XyDataSeries(wasmContext),
				pointMarker: {
					type: EPointMarkerType.Ellipse,
					options: {
						width: 5,
						height: 5,
						fill: "rgba(15, 243, 7, 0.6)",
						stroke: "green",
						strokeThickness: 0.8,
					},
				},
			});
			const brakeSeries = new FastLineRenderableSeries(wasmContext, {
				dataSeries: new XyDataSeries(wasmContext),
				pointMarker: {
					type: EPointMarkerType.Ellipse,
					options: {
						width: 5,
						height: 5,
						fill: "rgba(200, 0, 0, 0.6)",
						stroke: "red",
						strokeThickness: 0.8,
					},
				},
			});

			surface.renderableSeries.add(throttleSeries);
			throttleSeriesRef.current = throttleSeries;
			surface.renderableSeries.add(brakeSeries);
			brakeSeriesRef.current = brakeSeries;

			surface.chartModifiers.add(
				new ZoomPanModifier({ xyDirection: EXyDirection.XDirection, enableZoom: true }),
				new MouseWheelZoomModifier({ xyDirection: EXyDirection.XDirection }),
				new ZoomExtentsModifier()
			);
		};

		initSciChart();
	}, []);

	return (
		<div className="relative w-full h-full rounded-lg overflow-hidden">
			<div
				ref={chartDivRef}
				className="w-full h-full bg-gray-900 dark:bg-black"
			/>
			<Button
				onClick={() => handleCopy(throttleTimeValues, throttleValues, brakeTimeValues, brakeValues)}
				variant="default"
				className="absolute top-2 right-2 z-10 h-6 px-2 text-xs dark:bg-brand-accent-green dark:hover:bg-brand-green dark:text-black"
			>
				Download
			</Button>
		</div>
	);
}