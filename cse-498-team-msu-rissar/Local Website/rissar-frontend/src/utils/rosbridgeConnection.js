/**
 * rosbridgeConnection
 * 
 * Simple roslibjs connection utility for direct rosbridge connection
 * This is a lightweight alternative to the socket.io proxy approach
 * 
 */

import ROSLIB from 'roslib';

export class RosbridgeConnection {
  constructor(url = 'ws://192.168.8.4:9090') {
    this.url = url;
    this.ros = null;
    this.connected = false;
    this.reconnectDelay = 2000;
    this.listeners = new Set();
  }

  // Connect to rosbridge websocket
  connect() {
    if (this.ros && this.connected) {
      console.log('Already connected to rosbridge');
      return Promise.resolve(this.ros);
    }

    return new Promise((resolve) => {
      try {
        this.ros = new ROSLIB.Ros({
          url: this.url
        });

        this.ros.on('connection', () => {
          console.log('Connected to rosbridge websocket server.');
          this.connected = true;
          this.notifyListeners({ type: 'connected', connected: true });
          resolve(this.ros);
        });

        this.ros.on('error', (error) => {
          console.error('Error connecting to rosbridge websocket server:', error);
          this.connected = false;
          this.notifyListeners({ type: 'error', error });
          this.attemptReconnect();
        });

        this.ros.on('close', () => {
          console.log('Connection to rosbridge websocket server closed.');
          this.connected = false;
          this.notifyListeners({ type: 'disconnected', connected: false });
          this.attemptReconnect();
        });
      } catch (error) {
        console.error('Failed to create rosbridge connection:', error);
        this.connected = false;
        this.notifyListeners({ type: 'error', error });
        this.attemptReconnect();
      }
    });
  }

  // Attempt to reconnect with exponential backoff
  attemptReconnect() {
    const delay = this.reconnectDelay;
    console.log(`Attempting to reconnect in ${delay}ms...`);
    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  // Disconnect from rosbridge
  disconnect() {
    if (this.ros) {
      this.ros.close();
      this.ros = null;
      this.connected = false;
      this.notifyListeners({ type: 'disconnected', connected: false });
    }
  }

  // Create a topic for publishing/subscribing
  createTopic(topicName, messageType) {
    if (!this.ros) {
      throw new Error('Not connected to rosbridge');
    }

    return new ROSLIB.Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });
  }

  createService(serviceName, serviceType) {
    if (!this.ros) {
      throw new Error('Not connected to rosbridge');
    }

    return new ROSLIB.Service({
      ros: this.ros,
      name: serviceName,
      serviceType: serviceType
    });
  }

  // Add connection status listener
  addListener(callback) {
    this.listeners.add(callback);
    callback({ type: this.connected ? 'connected' : 'disconnected', connected: this.connected });
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners of connection status changes
  notifyListeners(event) {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  // Get current connection status
  isConnected() {
    return this.connected;
  }

  // Get the ros instance
  getRos() {
    return this.ros;
  }
}

// Singleton instance for app-wide use
let rosbridgeInstance = null;

export function getRosbridgeInstance(url) {
  if (!rosbridgeInstance) {
    rosbridgeInstance = new RosbridgeConnection(url);
    rosbridgeInstance.connect();
  }
  return rosbridgeInstance;
}
