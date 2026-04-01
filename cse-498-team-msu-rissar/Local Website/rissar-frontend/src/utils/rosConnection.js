/**
 * rosConnection
 * 
 * ros connection manager
 * handles websocket connection to flask backend which proxies to rosbridge
 * 
 */

import io from 'socket.io-client';

export class ROSConnectionManager {
  constructor(flaskUrl = 'http://localhost:8080') {
    this.flaskUrl = flaskUrl;
    this.socket = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.listeners = new Set();
    this.reconnectTimeout = null;
    this.messageQueue = [];
    this.subscribedTopics = new Map();
    this.topicMetadata = new Map();
  }

  // connect to flask backend
  connect() {
    if (this.connected || this.connecting) {
      console.log('already connected or connecting');
      return Promise.resolve(this.socket);
    }

    this.connecting = true;
    console.log(`connecting to flask at ${this.flaskUrl}...`);

    return new Promise((resolve, reject) => {
      this.socket = io(`${this.flaskUrl}/ros`, {
        transports: ['websocket', 'polling'],
        reconnection: false,
      });

      this.socket.on('connect', () => {
        console.log('connected to flask backend');
      });

      // Handle successful connection to ROS bridge
      this.socket.on('ros_connected', (data) => {
        console.log('ros bridge connected:', data);
        this.connected = true;
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        this.flushMessageQueue();
        this.notifyListeners({ type: 'connected', connected: true });
        resolve(this.socket);
      });

      // Handle incoming ROS messages
      this.socket.on('ros_message', (data) => {
        this.handleROSMessage(data);
      });

      // Handle disconnection from ROS bridge
      this.socket.on('ros_disconnected', (data) => {
        console.log('ros bridge disconnected:', data);
        this.connected = false;
        this.connecting = false;
        this.notifyListeners({ type: 'disconnected', connected: false });
        this.attemptReconnect();
      });

      // Handle disconnection from Flask backend
      this.socket.on('disconnect', (reason) => {
        console.log('flask backend disconnected:', reason);
        this.connected = false;
        this.connecting = false;
        this.notifyListeners({ type: 'disconnected', connected: false, reason });
        this.attemptReconnect();
      });

      this.socket.on('error', (error) => {
        console.error('socket error:', error);
        this.notifyListeners({ type: 'error', error });
        reject(error);
      });

      this.socket.on('connect_error', (error) => {
        console.error('connection error:', error);
        this.connecting = false;
        this.notifyListeners({ type: 'error', error });
        reject(error);
      });
    });
  }

  // disconnect from flask
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connected = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.subscribedTopics = new Map();
    this.topicMetadata = new Map();
  }

  // route incoming ros messages to subscribers
  handleROSMessage(data) {
    if (data.op === 'publish' && data.topic) {
      const callbacks = this.subscribedTopics.get(data.topic);

      if (callbacks && callbacks.size > 0) {
        callbacks.forEach(callback => {
          try {
            callback(data.msg);
          } catch (error) {
            console.error(`callback error for ${data.topic}:`, error);
          }
        });
      }
    }
  }

  // send any queued messages after reconnecting
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      this.sendToFlask(this.messageQueue.shift());
    }

    // Ensure active topic subscriptions are re-established after reconnect
    this.topicMetadata.forEach(({ messageType, options = {} }, topicName) => {
      const command = {
        op: 'subscribe',
        topic: topicName,
        type: messageType,
      };

      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          command[key] = value;
        }
      });

      this.sendToFlask(command);
    });
  }

  // send command to flask (which forwards to rosbridge)
  sendToFlask(command) {
    if (!this.socket || !this.connected) {
      console.warn('not connected, queueing message');
      this.messageQueue.push(command);
      return false;
    }

    try {
      this.socket.emit('ros_command', command);
      return true;
    } catch (error) {
      console.error('error sending to flask:', error);
      return false;
    }
  }

  // reconnect with exponential backoff
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('max reconnect attempts reached');
      this.notifyListeners({
        type: 'reconnect_failed',
        attempts: this.reconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);

    this.notifyListeners({
      type: 'reconnecting',
      attempts: this.reconnectAttempts,
      delay
    });

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(err => {
        console.error('reconnection failed:', err);
      });
    }, delay);
  }

  // subscribe to connection state changes
  addListener(callback) {
    this.listeners.add(callback);

    // notify immediately with current state
    callback({
      type: 'status',
      connected: this.connected,
      connecting: this.connecting
    });

    return () => this.listeners.delete(callback);
  }

  // notify all listeners of state changes
  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('listener error:', error);
      }
    });
  }

  // create a topic subscription
  createTopic(topicName, messageType) {
    if (!topicName || !messageType) {
      throw new Error('topicName and messageType are required to create a topic');
    }

    if (!this.subscribedTopics.has(topicName)) {
      this.subscribedTopics.set(topicName, new Set());
    }

    const buildSubscribeCommand = (options = {}) => {
      const command = {
        op: 'subscribe',
        topic: topicName,
        type: messageType,
      };

      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          command[key] = value;
        }
      });

      return command;
    };

    return {
      name: topicName,
      messageType,
      subscribe: (callback, options = {}) => {
        if (typeof callback !== 'function') {
          throw new Error('subscribe callback must be a function');
        }

        const callbacks = this.subscribedTopics.get(topicName);
        const isFirstSubscriber = callbacks.size === 0;

        callbacks.add(callback);

        if (isFirstSubscriber) {
          const command = buildSubscribeCommand(options);
          this.topicMetadata.set(topicName, {
            messageType,
            options: { ...options },
          });
          this.sendToFlask(command);
        } else if (!this.topicMetadata.has(topicName)) {
          this.topicMetadata.set(topicName, {
            messageType,
            options: { ...options },
          });
        }

        return () => {
          const currentCallbacks = this.subscribedTopics.get(topicName);
          if (!currentCallbacks) {
            return;
          }

          currentCallbacks.delete(callback);

          if (currentCallbacks.size === 0) {
            this.subscribedTopics.delete(topicName);
            this.topicMetadata.delete(topicName);
            this.sendToFlask({
              op: 'unsubscribe',
              topic: topicName,
            });
          }
        };
      },
      unsubscribe: (callback) => {
        if (callback) {
          const callbacks = this.subscribedTopics.get(topicName);
          if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
              this.subscribedTopics.delete(topicName);
              this.topicMetadata.delete(topicName);
              this.sendToFlask({
                op: 'unsubscribe',
                topic: topicName,
              });
            }
          }
        } else {
          // Unsubscribe all callbacks when none specified
          this.subscribedTopics.delete(topicName);
          this.topicMetadata.delete(topicName);
          this.sendToFlask({
            op: 'unsubscribe',
            topic: topicName,
          });
        }
      },
      publish: (message) => {
        this.sendToFlask({
          op: 'publish',
          topic: topicName,
          msg: message,
        });
      },
    };
  }

  // create a service client
  createService(serviceName, serviceType) {
    return {
      name: serviceName,
      serviceType: serviceType,
      callService: (request, callback, errorCallback) => {
        // Generate a unique ID for this service call
        const callId = `service_call_${Date.now()}_${Math.random()}`;

        // Define a handler for the service response
        const responseHandler = (data) => {
          if (data.op === 'service_response' && data.id === callId) {
            this.socket.off('ros_message', responseHandler);
            data.result ? callback(data.values) : errorCallback?.(data.values);
          }
        };

        // Listen for the response on the socket
        if (this.socket) {
          this.socket.on('ros_message', responseHandler);
        }

        this.sendToFlask({
          op: 'call_service',
          service: serviceName,
          args: request,
          id: callId
        });
      }
    };
  }

  // create a parameter client
  createParam(paramName) {
    return {
      name: paramName,
      get: (callback) => {
        // Generate a unique ID for this parameter get request
        const requestId = `get_param_${Date.now()}_${Math.random()}`;

        // Define a handler for the parameter get response
        const responseHandler = (data) => {
          if (data.op === 'get_param' && data.id === requestId) {
            this.socket.off('ros_message', responseHandler);
            callback(data.value);
          }
        };

        // Listen for the response on the socket
        if (this.socket) {
          this.socket.on('ros_message', responseHandler);
        }

        this.sendToFlask({
          op: 'get_param',
          name: paramName,
          id: requestId
        });
      },
      set: (value, callback) => {
        // Generate a unique ID for this parameter set request
        const requestId = `set_param_${Date.now()}_${Math.random()}`;

        // Define a handler for the parameter set response
        const responseHandler = (data) => {
          if (data.op === 'set_param' && data.id === requestId) {
            this.socket.off('ros_message', responseHandler);
            callback?.();
          }
        };

        // Listen for the response on the socket
        if (this.socket) {
          this.socket.on('ros_message', responseHandler);
        }

        this.sendToFlask({
          op: 'set_param',
          name: paramName,
          value: value,
          id: requestId
        });
      }
    };
  }

  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      reconnectAttempts: this.reconnectAttempts,
      url: this.flaskUrl
    };
  }
}

// singleton instance
let globalConnectionManager = null;

export function getROSConnectionManager(flaskUrl) {
  if (!globalConnectionManager) {
    globalConnectionManager = new ROSConnectionManager(flaskUrl);
  }
  return globalConnectionManager;
}

export function resetROSConnectionManager() {
  if (globalConnectionManager) {
    globalConnectionManager.disconnect();
    globalConnectionManager = null;
  }
}
