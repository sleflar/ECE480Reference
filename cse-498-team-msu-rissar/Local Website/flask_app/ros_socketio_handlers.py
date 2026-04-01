"""
ros websocket handlers for flask-socketio
handles client connections and message routing for ros2 integration
"""

import logging
from flask import request
from flask_socketio import emit, disconnect, join_room, leave_room
from flask_app import socketio
from .ros_proxy import get_ros_proxy

logger = logging.getLogger(__name__)

@socketio.on('connect', namespace='/ros')
def handle_connect():
    """handle client connection to ros websocket namespace"""
    client_sid = request.sid
    logger.info(f"client {client_sid} connecting to /ros namespace")
    
    proxy = get_ros_proxy()
    
    if not proxy:
        logger.error("ros proxy not initialized")
        emit('error', {'message': 'ros proxy not available'})
        disconnect()
        return False
    
    ws = proxy.connect_to_rosbridge(client_sid)
    
    if ws:
        join_room(client_sid)
        
        emit('ros_connected', {
            'status': 'connected',
            'message': 'successfully connected to ros bridge'
        })
        logger.info(f"client {client_sid} connected to ros bridge")
        return True
    else:
        emit('error', {'message': 'failed to connect to ros bridge'})
        disconnect()
        return False

@socketio.on('disconnect', namespace='/ros')
def handle_disconnect():
    """handle client disconnection from ros websocket namespace"""
    client_sid = request.sid
    logger.info(f"client {client_sid} disconnecting from /ros namespace")
    
    proxy = get_ros_proxy()
    if proxy:
        proxy.disconnect_client(client_sid)
    
    leave_room(client_sid)

@socketio.on('ros_command', namespace='/ros')
def handle_ros_command(data):
    """
    handle ros command from client (subscribe, publish, call_service, etc.)
    expects rosbridge protocol format
    """
    client_sid = request.sid
    
    if not data:
        emit('error', {'message': 'no data provided'})
        return
    
    # Log command for debugging
    
    op = data.get('op', 'unknown')
    topic = data.get('topic', data.get('service', 'unknown'))
    logger.debug(f"client {client_sid} sent command: op={op}, topic={topic}")
    
    proxy = get_ros_proxy()
    
    if not proxy:
        emit('error', {'message': 'ros proxy not available'})
        return
    
    success = proxy.send_to_rosbridge(client_sid, data)
    
    if not success:
        emit('error', {
            'message': 'failed to send command to ros bridge',
            'command': data
        })

@socketio.on('ping', namespace='/ros')
def handle_ping():
    """handle ping from client for connection health check"""
    emit('pong', {'timestamp': request.sid})

@socketio.on('get_client_info', namespace='/ros')
def handle_get_client_info():
    """get connection info for the requesting client"""
    client_sid = request.sid
    proxy = get_ros_proxy()
    
    if proxy:
        info = proxy.get_client_info(client_sid)
        emit('client_info', info or {'error': 'not connected'})
    else:
        emit('error', {'message': 'ros proxy not available'})

@socketio.on('get_all_clients', namespace='/ros')
def handle_get_all_clients():
    """get info about all connected clients (for monitoring/admin)"""
    proxy = get_ros_proxy()
    
    if proxy:
        clients = proxy.get_all_clients_info()
        emit('all_clients_info', {'clients': clients, 'count': len(clients)})
    else:
        emit('error', {'message': 'ros proxy not available'})

@socketio.on_error(namespace='/ros')
def handle_error(e):
    """handle errors in the /ros namespace"""
    logger.error(f"socketio error for client {request.sid}: {e}")
    emit('error', {'message': str(e)})

@socketio.on_error_default
def default_error_handler(e):
    """default error handler for all namespaces"""
    logger.error(f"socketio error: {e}")
    emit('error', {'message': 'an error occurred'})