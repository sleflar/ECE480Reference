import logging
from flask import request
from flask_socketio import emit, disconnect, join_room, leave_room
from flask_app import socketio
from .routes.connection import terminal_sessions

logger = logging.getLogger(__name__)


@socketio.on('connect', namespace='/terminal')
def handle_terminal_connect():
    client_sid = request.sid
    logger.info(f"client {client_sid} connecting to /terminal namespace")
    emit('terminal_connected', {'status': 'connected'})


@socketio.on('disconnect', namespace='/terminal')
def handle_terminal_disconnect():
    client_sid = request.sid
    logger.info(f"client {client_sid} disconnecting from /terminal namespace")


@socketio.on('terminal_subscribe', namespace='/terminal')
def handle_terminal_subscribe(data):
    terminal_id = data.get('terminal_id')
    
    if not terminal_id:
        emit('terminal_error', {'error': 'terminal_id required'})
        return
    
    if terminal_id not in terminal_sessions:
        emit('terminal_error', {'error': 'Terminal not found'})
        return
    
    room = f"terminal_{terminal_id}"
    join_room(room)
    
    session = terminal_sessions[terminal_id]
    
    emit('terminal_state', {
        'terminal_id': terminal_id,
        'name': session['name'],
        'cwd': session['cwd'],
        'output': session['output']
    })
    
    logger.info(f"client subscribed to terminal {terminal_id}")


@socketio.on('terminal_unsubscribe', namespace='/terminal')
def handle_terminal_unsubscribe(data):
    terminal_id = data.get('terminal_id')
    
    if not terminal_id:
        return
    
    room = f"terminal_{terminal_id}"
    leave_room(room)
    logger.info(f"client unsubscribed from terminal {terminal_id}")


@socketio.on('terminal_command', namespace='/terminal')
def handle_terminal_command(data):
    terminal_id = data.get('terminal_id')
    command = data.get('command')
    
    if not terminal_id or not command:
        emit('terminal_error', {'error': 'terminal_id and command required'})
        return
    
    if terminal_id not in terminal_sessions:
        emit('terminal_error', {'error': 'Terminal not found'})
        return
    
    session = terminal_sessions[terminal_id]
    channel = session['channel']
    
    try:
        channel.send(command + '\n')
    except Exception as e:
        emit('terminal_error', {'error': str(e)})


def broadcast_terminal_output(terminal_id, new_output):
    """
    Called by the output reader thread to broadcast new terminal output.
    """
    room = f"terminal_{terminal_id}"
    socketio.emit('terminal_output', {
        'terminal_id': terminal_id,
        'output': new_output
    }, to=room, namespace='/terminal')
