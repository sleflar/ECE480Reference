"""
ros websocket proxy service
manages connections between flask clients and ros2 rosbridge
"""

import os
import json
import logging
from datetime import datetime
from flask_socketio import emit, disconnect
from websocket import create_connection, WebSocketConnectionClosedException
import threading

logger = logging.getLogger(__name__)

class ROSBridgeProxy:
    """proxy for managing connections between flask-socketio and ros2 rosbridge"""
    
    def __init__(self, rosbridge_url=None):
        self.rosbridge_url = rosbridge_url or os.environ.get('ROSBRIDGE_URL', 'ws://192.168.8.4:9090')
        self.client_connections = {}
        self.connection_lock = threading.Lock()
        logger.info(f"rosbridgeproxy initialized with rosbridge at {self.rosbridge_url}")
    
    def connect_to_rosbridge(self, client_sid):
        """create websocket connection to rosbridge for a specific client"""
        try:
            logger.info(f"connecting client {client_sid} to rosbridge at {self.rosbridge_url}")
            ws = create_connection(self.rosbridge_url, timeout=5)
            
            with self.connection_lock:
                self.client_connections[client_sid] = {
                    'websocket': ws,
                    'connected': True,
                    'connected_at': datetime.now(),
                    'messages_sent': 0,
                    'messages_received': 0
                }
            
            listen_thread = threading.Thread(
                target=self._listen_to_rosbridge,
                args=(client_sid, ws),
                daemon=True
            )
            listen_thread.start()
            
            logger.info(f"client {client_sid} connected to rosbridge successfully")
            return ws
            
        except Exception as e:
            logger.error(f"failed to connect client {client_sid} to rosbridge: {e}")
            return None
    
    def _listen_to_rosbridge(self, client_sid, ws):
        """listen for messages from rosbridge and forward to flask-socketio client"""
        from flask import current_app
        try:
            while True:
                with self.connection_lock:
                    if client_sid not in self.client_connections:
                        logger.info(f"client {client_sid} removed, stopping listener")
                        break
                    
                    if not self.client_connections[client_sid]['connected']:
                        logger.info(f"client {client_sid} disconnected, stopping listener")
                        break
                
                try:
                    message = ws.recv()
                    
                    if message:
                        data = json.loads(message)
                        
                        with self.connection_lock:
                            if client_sid in self.client_connections:
                                self.client_connections[client_sid]['messages_received'] += 1
                        
                        with current_app.app_context():
                            emit('ros_message', data, room=client_sid, namespace='/ros')
                        
                except WebSocketConnectionClosedException:
                    logger.warning(f"ros bridge connection closed for client {client_sid}")
                    break
                except json.JSONDecodeError as e:
                    logger.error(f"failed to parse message from rosbridge: {e}")
                except Exception as e:
                    logger.error(f"error receiving from rosbridge for client {client_sid}: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"listener thread error for client {client_sid}: {e}")
        finally:
            from flask import current_app
            with current_app.app_context():
                emit('ros_disconnected', {'reason': 'rosbridge connection lost'}, room=client_sid, namespace='/ros')
    
    def send_to_rosbridge(self, client_sid, message):
        """send message from client to rosbridge"""
        with self.connection_lock:
            if client_sid not in self.client_connections:
                logger.warning(f"client {client_sid} not connected to rosbridge")
                return False
            
            client_info = self.client_connections[client_sid]
            
            if not client_info['connected']:
                logger.warning(f"client {client_sid} connection is not active")
                return False
            
            ws = client_info['websocket']
        
        try:
            message_str = json.dumps(message)
            ws.send(message_str)
            
            with self.connection_lock:
                if client_sid in self.client_connections:
                    self.client_connections[client_sid]['messages_sent'] += 1
            
            if message.get('op') == 'subscribe':
                logger.info(f"client {client_sid} subscribed to topic: {message.get('topic')}")
            elif message.get('op') == 'publish':
                logger.debug(f"client {client_sid} published to topic: {message.get('topic')}")
            
            return True
            
        except Exception as e:
            logger.error(f"failed to send message to rosbridge for client {client_sid}: {e}")
            return False
    
    def disconnect_client(self, client_sid):
        """disconnect client from rosbridge"""
        with self.connection_lock:
            if client_sid in self.client_connections:
                client_info = self.client_connections[client_sid]
                
                try:
                    ws = client_info['websocket']
                    ws.close()
                    logger.info(f"closed rosbridge connection for client {client_sid}")
                except Exception as e:
                    logger.error(f"error closing rosbridge connection for client {client_sid}: {e}")
                
                duration = (datetime.now() - client_info['connected_at']).total_seconds()
                logger.info(
                    f"client {client_sid} stats: "
                    f"duration={duration:.1f}s, "
                    f"sent={client_info['messages_sent']}, "
                    f"received={client_info['messages_received']}"
                )
                
                del self.client_connections[client_sid]
    
    def get_client_info(self, client_sid):
        """get connection info for specific client"""
        with self.connection_lock:
            if client_sid in self.client_connections:
                info = self.client_connections[client_sid].copy()
                info.pop('websocket', None)
                info['connected_at'] = info['connected_at'].isoformat()
                return info
        return None
    
    def get_all_clients_info(self):
        """get info about all connected clients"""
        with self.connection_lock:
            clients = []
            for sid, info in self.client_connections.items():
                client_info = info.copy()
                client_info['sid'] = sid
                client_info.pop('websocket', None)
                client_info['connected_at'] = client_info['connected_at'].isoformat()
                clients.append(client_info)
            return clients

# global proxy instance
ros_proxy = None

def init_ros_proxy(rosbridge_url=None):
    """initialize the global ros proxy instance"""
    global ros_proxy
    ros_proxy = ROSBridgeProxy(rosbridge_url)
    return ros_proxy

def get_ros_proxy():
    """get the global ros proxy instance"""
    return ros_proxy