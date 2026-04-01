/**
 * TopHeader
 * 
 * Global navigation bar containing view switcher, connection controls, settings, and modal triggers.
 * Handles ROS connection status and various system-wide actions.
 * 
 */
import React, { useState, useRef, useEffect, Suspense } from "react";
import { useROS } from "./utils/ROSContext";
import { useDarkMode } from "./utils/DarkModeContext";
import { Moon, Sun } from "lucide-react";
import { useReplay } from "./utils/ReplayContext";
import { getRosbridgeInstance } from "./utils/rosbridgeConnection";
import ConnectionStatus from "./components/ConnectionStatus";
import UnifiedMenuBar from "./components/UnifiedMenuBar";
import { Button } from "@/components/ui/button";
const ConnectionDialog = React.lazy(() => import('./components/ConnectionDialog'));
const SFTPConnectionModal = React.lazy(() => import('./components/SFTPConnectionModal'));
const SSHCommandModal = React.lazy(() => import('./components/SSHCommandModal'));
const SDCardBuilderModal = React.lazy(() => import('./components/SDCardBuilderModal'));
const TerminalSheet = React.lazy(() => import('./components/TerminalSheet'));
const SimpleBagSelector = React.lazy(() => import('./components/SimpleBagSelector'));
const RosbagDownloadModal = React.lazy(() => import('./components/RosbagDownloadModal'));
import msuLogo from "./assets/msulogo.png";
import {
  loadProfiles,
  addProfile,
  deleteProfile,
  setCurrentProfile,
  loadCurrentProfile,
} from './utils/sftpProfiles';
import ROSLIB from 'roslib';

export default function TopHeader({
  activeView,
  setActiveView,
  onOpenLayoutModal,
  onOpenSDCardModal,
  onExportLayout,
  onImportLayout,
  onResetLayout,
  onUploadBagFiles,
  onModalStateChange,
  carNamespace = "car1_ns"
}) {
  // Access ROS context for connection management
  const { middlewareConnected, vehicleConnected, currentCarIp, connect, disconnect } = useROS();
  // Access Dark Mode context 
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  // Access Replay context
  const { startReplay, stopReplay } = useReplay();

  // State for managing modal visibility
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showSFTPModal, setShowSFTPModal] = useState(false);
  const [showSSHModal, setShowSSHModal] = useState(false);
  const [showSDCardModal, setShowSDCardModal] = useState(false);
  const [showTerminalManager, setShowTerminalManager] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [sftpConnection, setSftpConnection] = useState(null);
  const [showBagSelector, setShowBagSelector] = useState(false);

  // State for playback and recording
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayStatus, setReplayStatus] = useState("");
  const [rosbridgeConnected, setRosbridgeConnected] = useState(false);
  const [selectedBagPath, setSelectedBagPath] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [selectedCar, setSelectedCar] = useState("car1_ns");
  const [isLooping, setIsLooping] = useState(false);
  const [isCarStopped, setIsCarStopped] = useState(false);

  // Auto-connect on mount using saved profile
  useEffect(() => {
    const autoConnect = async () => {
      const currentProfile = loadCurrentProfile();
      if (currentProfile) {
        console.log('Attempting auto-connect with profile:', currentProfile.name);
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
          const response = await fetch(`${backendUrl}/api/connection/connect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              host: currentProfile.host,
              port: parseInt(currentProfile.port),
              username: currentProfile.username,
              password: currentProfile.password,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            console.log('Auto-connect successful');
            handleSFTPConnect(data);
          } else {
            console.warn('Auto-connect failed:', data.error);
          }
        } catch (err) {
          console.error('Auto-connect network error:', err);
        }
      }
    };

    autoConnect();
  }, []);

  // Notify parent component about modal state changes
  useEffect(() => {
    const isAnyModalOpen = showConnectionDialog || showSFTPModal || showSSHModal || showSDCardModal || showTerminalManager || showBagSelector || showDownloadModal;
    if (onModalStateChange) {
      onModalStateChange(isAnyModalOpen);
    }
  }, [showConnectionDialog, showSFTPModal, showSSHModal, showSDCardModal, showTerminalManager, showBagSelector, showDownloadModal, onModalStateChange]);

  // Refs for ROS services and topics 
  const rosbridgeRef = useRef(null);
  const playServiceRef = useRef(null);
  const stopServiceRef = useRef(null);
  const bagPathTopicRef = useRef(null);
  const carNamespaceTopicRef = useRef(null);
  const playbackStatusSubscriberRef = useRef(null);
  const loopModeTopicRef = useRef(null);
  const recordServiceRef = useRef(null);
  const stopRecordServiceRef = useRef(null);
  const pauseResumeServiceRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const colorServiceRef = useRef(null);
  const resolutionServiceRef = useRef(null);
  const joyTopicRef = useRef(null);
  const joyEnableServiceRef = useRef(null);


  // Connect to rosbridge and initialize services/topics
  useEffect(() => {
    const rosbridgeUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://192.168.8.4:9090';
    console.log('[TopHeader] Connecting to rosbridge:', rosbridgeUrl);

    const rosbridge = getRosbridgeInstance(rosbridgeUrl);
    rosbridgeRef.current = rosbridge;

    const removeListener = rosbridge.addListener((event) => {
      console.log('[TopHeader] Rosbridge event:', event.type);

      if (event.type === 'connected') {
        setRosbridgeConnected(true);
        console.log('[TopHeader] Connected to rosbridge');

        // Initialize services and topics
        try {
          const rosInstance = rosbridge.getRos?.();
          console.log('[TopHeader] Got ROS instance:', !!rosInstance);

          if (rosInstance) {
            // Replay services  
            playServiceRef.current = new ROSLIB.Service({
              ros: rosInstance,
              name: '/rosbag2_player/play',
              serviceType: 'std_srvs/srv/Trigger'
            });

            stopServiceRef.current = new ROSLIB.Service({
              ros: rosInstance,
              name: '/rosbag2_player/stop',
              serviceType: 'std_srvs/srv/Trigger'
            });

            // Topic to tell bag_player_node which bag to play
            bagPathTopicRef.current = new ROSLIB.Topic({
              ros: rosInstance,
              name: '/rosbag2_player/set_bag_path',
              messageType: 'std_msgs/String'
            });

            // Topic to tell bag_recorder_node which car namespace to use
            carNamespaceTopicRef.current = new ROSLIB.Topic({
              ros: rosInstance,
              name: '/rosbag2_recorder/set_car_namespace',
              messageType: 'std_msgs/String'
            });

            // Topic to tell bag_player_node whether to loop playback
            loopModeTopicRef.current = new ROSLIB.Topic({
              ros: rosInstance,
              name: '/rosbag2_player/set_loop_mode',
              messageType: 'std_msgs/Bool'
            });

            // Recording services
            recordServiceRef.current = new ROSLIB.Service({
              ros: rosInstance,
              name: '/rosbag2_recorder/start',
              serviceType: 'std_srvs/srv/Trigger'
            });

            stopRecordServiceRef.current = new ROSLIB.Service({
              ros: rosInstance,
              name: '/rosbag2_recorder/stop',
              serviceType: 'std_srvs/srv/Trigger'
            });

            pauseResumeServiceRef.current = new ROSLIB.Service({
              ros: rosInstance,
              name: '/rosbag2_recorder/pause_resume',
              serviceType: 'std_srvs/srv/Trigger'
            });

            // Camera control services
            colorServiceRef.current = new ROSLIB.Service({
              ros: rosInstance,
              name: '/car1_ns/sensors/camera_feed/set_color',
              serviceType: 'std_srvs/srv/SetBool'
            });

            resolutionServiceRef.current = new ROSLIB.Service({
              ros: rosInstance,
              name: '/car1_ns/sensors/camera_feed/set_resolution',
              serviceType: 'std_srvs/srv/SetBool'
            });

            // Service to enable/disable joy node
            joyEnableServiceRef.current = new ROSLIB.Service({
              ros: rosInstance,
              name: '/car1_ns/joy_node/enable',
              serviceType: 'std_srvs/srv/SetBool'
            });

            // Joy topic to intercept controller commands during emergency stop
            joyTopicRef.current = new ROSLIB.Topic({
              ros: rosInstance,
              name: '/car1_ns/joy',
              messageType: 'sensor_msgs/Joy'
            });

            // Topic to subscribe to playback status
            playbackStatusSubscriberRef.current = new ROSLIB.Topic({
              ros: rosInstance,
              name: '/rosbag2_player/status',
              messageType: 'std_msgs/String'
            });

            playbackStatusSubscriberRef.current.subscribe((message) => {
              console.log('[TopHeader] Playback status:', message.data);

              if (message.data === 'finished') {
                if (!isLooping) {
                  console.log('[TopHeader] Playback finished and loop is off, stopping replay mode');
                  setIsPlaying(false);
                  setReplayStatus('Finished');
                  stopReplay();
                }
              } else if (message.data === 'playing') {
                setReplayStatus(isLooping ? 'Playing (Looping)' : 'Playing');
              } else if (message.data === 'stopped') {
                setIsPlaying(false);
                setReplayStatus('Stopped');
              }
            });

            console.log('[TopHeader] Services and topics initialized');
          }
        } catch (err) {
          console.error('[TopHeader] Failed to initialize services:', err);
        }
      } else if (event.type === 'disconnected') {
        setRosbridgeConnected(false);
        console.log('[TopHeader] Disconnected from rosbridge');
      } else if (event.type === 'error') {
        console.error('[TopHeader] Rosbridge error:', event.error);
      }
    });

    rosbridge.connect().catch((err) => {
      console.error('[TopHeader] Failed to connect to rosbridge:', err);
    });

    return () => {
      if (playbackStatusSubscriberRef.current) {
        playbackStatusSubscriberRef.current.unsubscribe();
      }
      if (joyTopicRef.current) {
        joyTopicRef.current.unsubscribe();
      }
      removeListener();
    };
  }, []);

  const handleViewClick = (view) => {
    setActiveView(view);
  };

  // Toggle loop mode for playback
  const handleToggleLoop = () => {
    const newLoopState = !isLooping;
    setIsLooping(newLoopState);

    if (loopModeTopicRef.current && rosbridgeConnected) {
      const message = new ROSLIB.Message({
        data: newLoopState
      });
      loopModeTopicRef.current.publish(message);
      console.log(`[TopHeader] Loop mode toggled to: ${newLoopState}`);
    }
  };

  const handleLayoutChange = () => {
    if (onOpenLayoutModal) {
      onOpenLayoutModal();
    }
  };

  const handleConnect = (ip) => {
    connect(ip);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleConnectionClick = () => {
    if (middlewareConnected || vehicleConnected) {
      handleDisconnect();
    } else {
      setShowConnectionDialog(true);
    }
  };

  // Handle SFTP connection
  const handleSFTPConnect = (connectionData) => {
    setSftpConnection(connectionData);
    localStorage.setItem('sftp_connection_id', connectionData.connection_id);
    console.log('SFTP Connected:', connectionData);
  };

  // Handle SFTP disconnection
  const handleSFTPDisconnect = async () => {
    if (sftpConnection) {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
        await fetch(`${backendUrl}/api/connection/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connection_id: sftpConnection.connection_id,
          }),
        });
        localStorage.removeItem('sftp_connection_id');
        setSftpConnection(null);
      } catch (err) {
        console.error('Failed to disconnect SFTP:', err);
      }
    }
  };

  // Handle bag selection from BagSelector
  const handleBagSelected = (bagPath) => {
    console.log('[TopHeader] Bag selected:', bagPath);
    setSelectedBagPath(bagPath);
    setShowBagSelector(false);

    // Publish the selected bag path to ROS
    if (bagPathTopicRef.current && rosbridgeConnected) {
      const message = new ROSLIB.Message({
        data: bagPath
      });
      bagPathTopicRef.current.publish(message);
      setReplayStatus(`Selected: ${bagPath.split('/').pop()}`);
    }
  };

  // Play replay
  const handlePlayReplay = () => {
    if (!rosbridgeConnected) {
      alert("Not connected to rosbridge. Check console for details.");
      return;
    }

    if (!selectedBagPath) {
      alert("No bag selected. Please select a bag file first.");
      setShowBagSelector(true);
      return;
    }

    if (!playServiceRef.current) {
      alert("Play service not initialized. Check console for details.");
      return;
    }

    if (loopModeTopicRef.current && rosbridgeConnected) {
      const message = new ROSLIB.Message({
        data: isLooping
      });
      loopModeTopicRef.current.publish(message);
      console.log(`[TopHeader] Set loop mode to: ${isLooping}`);
    }

    setReplayStatus("Starting...");

    const request = new ROSLIB.ServiceRequest({});

    playServiceRef.current.callService(request, (result) => {
      if (result.success) {
        setIsPlaying(true);
        setReplayStatus(result.message || (isLooping ? "Playing (Looping)" : "Playing"));
        startReplay();
      } else {
        setReplayStatus("Failed");
        alert(`Failed: ${result.message}`);
      }
    }, (error) => {
      console.error('[TopHeader] Play service error:', error);
      setReplayStatus("Error");
      alert("Service call failed. Make sure bag_player_node is running.");
    });
  };

  // Stop replay
  const handleStopReplay = () => {
    if (!rosbridgeConnected || !stopServiceRef.current) {
      alert("Not connected");
      return;
    }

    setReplayStatus("Stopping...");

    const request = new ROSLIB.ServiceRequest({});

    stopServiceRef.current.callService(request, (result) => {
      if (result.success) {
        setIsPlaying(false);
        setReplayStatus("Stopped");
        stopReplay();
      } else {
        setReplayStatus("Failed");
        alert(`Failed: ${result.message}`);
      }
    }, (error) => {
      console.error('[TopHeader] Stop service error:', error);
      setReplayStatus("Error");
      alert("Service call failed");
    });
  };

  const formatRecordingDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle recording state
  const handleRecord = () => {
    if (!rosbridgeConnected) {
      alert("Not connected to rosbridge");
      return;
    }

    if (isRecording) {
      if (stopRecordServiceRef.current) {
        const request = new ROSLIB.ServiceRequest({});

        stopRecordServiceRef.current.callService(request, (result) => {
          console.log('Stop recording response:', result);
          if (result.success) {
            setIsRecording(false);
            setIsPaused(false);
            setRecordingStartTime(null);
          } else {
            console.error('Failed to stop recording:', result.message);
            alert(`Failed to stop recording: ${result.message}`);
          }
        }, (error) => {
          console.error('Stop recording service error:', error);
          alert("Failed to call stop recording service");
        });
      }
    } else {
      if (carNamespaceTopicRef.current && rosbridgeConnected) {
        const namespaceToUse = activeView === "Two Car View" ? selectedCar : "car1_ns";
        const message = new ROSLIB.Message({
          data: namespaceToUse
        });
        carNamespaceTopicRef.current.publish(message);
        console.log(`[TopHeader] Set car namespace to: ${namespaceToUse}`);
      }

      if (recordServiceRef.current) {
        const request = new ROSLIB.ServiceRequest({});

        recordServiceRef.current.callService(request, (result) => {
          if (result.success) {
            setIsRecording(true);
            setIsPaused(false);
            setRecordingStartTime(Date.now());
          } else {
            console.error('Failed to start recording:', result.message);
            alert(`Failed to start recording: ${result.message}`);
          }
        }, (error) => {
          console.error('Start recording service error:', error);
          alert("Failed to call start recording service. Make sure bag_recorder_node is running.");
        });
      }
    }
  };

  // Toggle pause/resume for recording
  const handlePauseResume = () => {
    if (!rosbridgeConnected) {
      alert("Not connected to rosbridge");
      return;
    }

    if (!isRecording) {
      alert("Not currently recording");
      return;
    }

    if (pauseResumeServiceRef.current) {
      const request = new ROSLIB.ServiceRequest({});

      pauseResumeServiceRef.current.callService(request, (result) => {
        console.log('Pause/Resume response:', result);
        if (result.success) {
          setIsPaused(!isPaused);
          console.log(`Recording ${!isPaused ? 'paused' : 'resumed'}`);
        } else {
          console.error('Failed to pause/resume:', result.message);
          alert(`Failed to pause/resume: ${result.message}`);
        }
      }, (error) => {
        console.error('Pause/resume service error:', error);
        alert("Failed to call pause/resume service");
      });
    }
  };

  // Update recording duration timer
  useEffect(() => {
    if (isRecording && recordingStartTime) {
      recordingTimerRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        setRecordingDuration(duration);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording, recordingStartTime]);

  // Handle camera color toggle
  const handleColor = (color) => {

    if (!rosbridgeConnected) {
      alert("Not connected to rosbridge. Check console for details.");
      return false;
    }

    if (!colorServiceRef.current) {
      alert("Color service not initialized. Check console for details.");
      return false;
    }

    const request = new ROSLIB.ServiceRequest({ data: color });

    colorServiceRef.current.callService(request, (result) => {

      if (result.success) {
        console.log(result.message);
      } else {
        alert(`Failed: ${result.message}`);
      }
    }, (error) => {
      console.error('[TopHeader] Color service error:', error);
      alert("Service call failed. Make sure camera_publisher_node is running.");
    });
    return (true);
  };

  // Handle camera resolution toggle
  const handleResolution = (resolution) => {

    if (!rosbridgeConnected) {
      alert("Not connected to rosbridge. Check console for details.");
      return false;
    }

    if (!resolutionServiceRef.current) {
      alert("Resolution service not initialized. Check console for details.");
      return false;
    }

    const request = new ROSLIB.ServiceRequest({ data: resolution });

    resolutionServiceRef.current.callService(request, (result) => {

      if (result.success) {
        console.log(result.message);
      } else {
        alert(`Failed: ${result.message}`);
      }
    }, (error) => {
      console.error('[TopHeader] Resolution service error:', error);
      alert("Service call failed. Make sure camera_publisher_node is running.");
    });
    return (true);
  };

  // Trigger emergency stop
  const handleEmergencyStop = () => {
    if (!rosbridgeConnected) {
      alert("Not connected to rosbridge");
      return;
    }



    // Disable joy node via service
    if (joyEnableServiceRef.current) {
      const request = new ROSLIB.ServiceRequest({ data: false });
      joyEnableServiceRef.current.callService(request, (result) => {
        if (result.success) {
          console.log('[TopHeader] Joy node disabled:', result.message);
        } else {
          console.error('[TopHeader] Failed to disable joy node:', result.message);
        }
      }, (error) => {
        console.error('[TopHeader] Joy enable service error:', error);
      });
    }

    setIsCarStopped(true);
  };

  // Resume car operation
  const handleResumeCar = () => {
    if (!rosbridgeConnected) {
      alert("Not connected to rosbridge");
      return;
    }

    // Re-enable joy node via service
    if (joyEnableServiceRef.current) {
      const request = new ROSLIB.ServiceRequest({ data: true });
      joyEnableServiceRef.current.callService(request, (result) => {
        if (result.success) {
          console.log('[TopHeader] Joy node enabled:', result.message);
        } else {
          console.error('[TopHeader] Failed to enable joy node:', result.message);
        }
      }, (error) => {
        console.error('[TopHeader] Joy enable service error:', error);
      });
    }

    console.log('[TopHeader] Car resumed - manual control restored');
    setIsCarStopped(false);
  };

  // Update loop mode during playback
  useEffect(() => {
    if (isPlaying && loopModeTopicRef.current && rosbridgeConnected) {
      const message = new ROSLIB.Message({
        data: isLooping
      });
      loopModeTopicRef.current.publish(message);
      console.log(`[TopHeader] Loop mode changed during playback to: ${isLooping}`);
    }
  }, [isLooping, isPlaying, rosbridgeConnected]);

  // Cleanup subscriptions and services on unload
  useEffect(() => {
    const handleBeforeUnload = (event) => {

      if (isRecording && stopRecordServiceRef.current && rosbridgeConnected) {
        const request = new ROSLIB.ServiceRequest({});
        stopRecordServiceRef.current.callService(request, (result) => {
          console.log('[TopHeader] Recording stopped on unload:', result);
        }, (error) => {
          console.error('[TopHeader] Failed to stop recording on unload:', error);
        });
      }

      if (isPlaying && stopServiceRef.current && rosbridgeConnected) {
        const request = new ROSLIB.ServiceRequest({});
        stopServiceRef.current.callService(request, (result) => {
          console.log('[TopHeader] Replay stopped on unload:', result);
        }, (error) => {
          console.error('[TopHeader] Failed to stop replay on unload:', error);
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);


      // Unsubscribe from joy topic on unmount if subscribed
      if (joyTopicRef.current) {
        joyTopicRef.current.unsubscribe();
      }

      if (isRecording && stopRecordServiceRef.current && rosbridgeConnected) {
        const request = new ROSLIB.ServiceRequest({});
        stopRecordServiceRef.current.callService(request, () => { }, () => { });
      }

      if (isPlaying && stopServiceRef.current && rosbridgeConnected) {
        const request = new ROSLIB.ServiceRequest({});
        stopServiceRef.current.callService(request, () => { }, () => { });
      }
    };
  }, [isRecording, isPlaying, rosbridgeConnected]);

  return (
    <header className="text-white px-5 py-2.5 flex items-center justify-between w-full" style={{ backgroundColor: '#17453B' }}>
      <div className="flex items-center gap-4">
        <img src={msuLogo} alt="MSU Logo" className="w-8 h-8" />
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-wider hidden md:inline">MICHIGAN STATE</span>
          <span className="font-normal text-sm tracking-wider hidden md:inline">UNIVERSITY</span>
          <span className="font-bold text-sm tracking-wider md:hidden">MSU</span>
        </div>
        <span className="text-5xl font-bold font-super-brigade-laser tracking-tight">PoliMOVE</span>
      </div>

      <div className="flex items-center justify-between gap-8">
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-md transition-colors ${isDarkMode
            ? "bg-black bg-opacity-30 hover:bg-opacity-40 text-white"
            : "bg-white text-black hover:bg-gray-100"
            }`}
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? (
            <Sun className="h-5 w-5 text-yellow-300" />
          ) : (
            <Moon className="h-5 w-5 text-gray-700" />
          )}
        </button>

        {replayStatus && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold"
            style={{
              backgroundColor: isPlaying ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: isPlaying ? '#22c55e' : '#3b82f6',
            }}
          >
            {isPlaying && (
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#22c55e',
                  borderRadius: '50%',
                  animation: 'pulse 1s ease-in-out infinite',
                }}
              />
            )}
            {replayStatus}
          </div>
        )}


        <div className="flex items-center gap-2">
          {activeView === "Simple View" ? (
            <>
              <Button
                onClick={isCarStopped ? handleResumeCar : handleEmergencyStop}
                variant={isCarStopped ? "resume" : "destructive"}
                size="sm"
                className="font-bold"
              >
                {isCarStopped ? 'RESUME' : 'STOP'}
              </Button>
              {isCarStopped && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold"
                  style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.2)',
                    color: '#ef4444',
                  }}
                >
                  CAR STOPPED
                </div>
              )}
            </>
          ) : (
            <>
              {activeView === "Two Car View" && (
                <select
                  value={selectedCar}
                  onChange={(e) => setSelectedCar(e.target.value)}
                  className="px-2 py-1.5 text-sm font-semibold rounded border-0 text-white"
                  style={{
                    backgroundColor: '#1d5c4a',
                    cursor: 'pointer',
                  }}
                >
                  <option value="car1_ns">Car 1</option>
                  <option value="car2_ns">Car 2</option>
                </select>
              )}
              <button
                onClick={handleRecord}
                disabled={!rosbridgeConnected || isPlaying}
                className="px-3 py-1.5 text-sm font-semibold rounded border-0 transition-colors text-white"
                style={{
                  backgroundColor: isRecording ? '#dc2626' : '#1d5c4a',
                  cursor: (rosbridgeConnected && !isPlaying) ? 'pointer' : 'not-allowed',
                  opacity: (rosbridgeConnected && !isPlaying) ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (rosbridgeConnected && !isPlaying) {
                    e.currentTarget.style.backgroundColor = isRecording ? '#b91c1c' : '#216853';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isRecording ? '#dc2626' : '#1d5c4a';
                }}
                title={isPlaying ? 'Recording disabled during replay' : (isRecording ? 'Stop recording all topics' : 'Start recording all topics')}
              >
                {isRecording ? 'Stop' : 'Record'}
              </button>
              <button
                onClick={handlePauseResume}
                disabled={!rosbridgeConnected || !isRecording}
                className="px-3 py-1.5 text-sm font-semibold text-white rounded border-0 transition-colors"
                style={{
                  backgroundColor: isPaused ? '#10b981' : '#f59e0b',
                  cursor: (rosbridgeConnected && isRecording) ? 'pointer' : 'not-allowed',
                  opacity: (rosbridgeConnected && isRecording) ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (rosbridgeConnected && isRecording) {
                    e.currentTarget.style.backgroundColor = isPaused ? '#059669' : '#d97706';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isPaused ? '#10b981' : '#f59e0b';
                }}
                title={isPaused ? 'Resume recording' : 'Pause recording'}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              {isRecording && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold"
                  style={{
                    backgroundColor: isPaused ? 'rgba(245, 158, 11, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                    color: isPaused ? '#fbbf24' : '#ef4444',
                  }}
                >
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: isPaused ? '#fbbf24' : '#ef4444',
                      borderRadius: '50%',
                      animation: isPaused ? 'none' : 'pulse 1s ease-in-out infinite',
                    }}
                  />
                  {isPaused ? 'PAUSED' : 'REC'} {formatRecordingDuration(recordingDuration)}
                </div>
              )}
            </>
          )}
        </div>

        <UnifiedMenuBar
          activeView={activeView}
          setActiveView={setActiveView}
          onOpenLayoutModal={onOpenLayoutModal}
          onExportLayout={onExportLayout}
          onImportLayout={onImportLayout}
          onResetLayout={onResetLayout}
          onConnect={handleConnectionClick}
          onOpenSDCardModal={() => setShowSDCardModal(true)}
          onOpenSFTPModal={() => setShowSFTPModal(true)}
          onOpenSSHModal={() => setShowSSHModal(true)}
          onOpenTerminalManager={() => setShowTerminalManager(true)}
          connected={middlewareConnected || vehicleConnected}
          sftpConnected={!!sftpConnection}
          onDisconnectSFTP={handleSFTPDisconnect}
          onUploadBagFiles={onUploadBagFiles}
          onDownloadBagFiles={() => setShowDownloadModal(true)}
          onSelectPlayback={() => setShowBagSelector(true)}
          onPlayReplay={handlePlayReplay}
          onStopReplay={handleStopReplay}
          onColorChange={handleColor}
          onResolutionChange={handleResolution}
          isLooping={isLooping}
          onToggleLoop={handleToggleLoop}
          isPlaying={isPlaying}
        />
      </div>

      <Suspense fallback={null}>
        <SimpleBagSelector
          isOpen={showBagSelector}
          onClose={() => setShowBagSelector(false)}
          onBagSelected={handleBagSelected}
          connectionId={sftpConnection?.connection_id}
        />
        <ConnectionDialog
          isOpen={showConnectionDialog}
          onClose={() => setShowConnectionDialog(false)}
          onConnect={handleConnect}
          currentIp={currentCarIp}
        />
        <SFTPConnectionModal
          isOpen={showSFTPModal}
          onClose={() => setShowSFTPModal(false)}
          onConnect={handleSFTPConnect}
        />
        <SSHCommandModal
          isOpen={showSSHModal}
          onClose={() => setShowSSHModal(false)}
          connectionId={sftpConnection?.connection_id}
        />
        <SDCardBuilderModal
          isOpen={showSDCardModal}
          onClose={() => setShowSDCardModal(false)}
        />
        {showTerminalManager && (
          <TerminalSheet
            isOpen={showTerminalManager}
            onClose={() => setShowTerminalManager(false)}
            connectionId={sftpConnection?.connection_id}
            isConnected={!!sftpConnection}
          />
        )}
        <RosbagDownloadModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          connectionId={sftpConnection?.connection_id}
        />
      </Suspense>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </header>
  );
}