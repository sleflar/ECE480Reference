from flask import Blueprint, jsonify, request, send_file
import paramiko
import io
import uuid
import threading
import queue
import time
import socket
import os
import tempfile
import stat

connection_bp = Blueprint('connection', __name__)

def get_socketio():
    """Get the socketio instance from the app."""
    from flask_app import socketio
    return socketio

# Store active connections (keyed by session ID or host)
active_connections = {}

# Store SSH channels for stateful operations
ssh_channels = {}

# Store persistent terminal sessions
terminal_sessions = {}


@connection_bp.route('/api/connection/connect', methods=['POST'])
def connect():
    """
    Establish an SFTP connection to a remote server.
    Accepts host, port, username, and either password or private key for authentication.
    """
    try:
        data = request.get_json()

        host = data.get('host')
        port = data.get('port', 22)
        username = data.get('username')
        password = data.get('password')
        private_key = data.get('private_key')

        if not host or not username:
            return jsonify({"error": "Host and username are required"}), 400

        # Create SSH client
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        # Connect with password or key
        if private_key:
            key_file = io.StringIO(private_key)
            pkey = paramiko.RSAKey.from_private_key(key_file)
            ssh.connect(hostname=host, port=port, username=username, pkey=pkey)
        elif password:
            ssh.connect(hostname=host, port=port, username=username, password=password)
        else:
            return jsonify({"error": "Password or private key required"}), 400

        # Open SFTP session
        sftp = ssh.open_sftp()

        # Store connection for later use
        connection_id = f"{username}@{host}:{port}"
        active_connections[connection_id] = {
            'ssh': ssh,
            'sftp': sftp
        }

        return jsonify({
            "status": "connected",
            "connection_id": connection_id,
            "host": host,
            "port": port,
            "username": username
        }), 200

    except paramiko.AuthenticationException:
        return jsonify({"error": "Authentication failed"}), 401
    except paramiko.SSHException as e:
        return jsonify({"error": f"SSH error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/disconnect', methods=['POST'])
def disconnect():
    """
    Close an active SFTP connection.
    """
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')

        if not connection_id:
            return jsonify({"error": "Connection ID required"}), 400

        if connection_id not in active_connections:
            return jsonify({"error": "Connection not found"}), 404

        # Close SFTP and SSH
        conn = active_connections[connection_id]
        conn['sftp'].close()
        conn['ssh'].close()

        del active_connections[connection_id]
        
        # Clean up channel state
        if connection_id in ssh_channels:
            del ssh_channels[connection_id]

        return jsonify({"status": "disconnected"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/list', methods=['POST'])
def list_directory():
    """
    List files in a remote directory via SFTP.
    """
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')
        path = data.get('path', '.')

        if not connection_id:
            return jsonify({"error": "Connection ID required"}), 400

        if connection_id not in active_connections:
            return jsonify({"error": "Connection not found"}), 404

        sftp = active_connections[connection_id]['sftp']
        files = []

        for entry in sftp.listdir_attr(path):
            files.append({
                'name': entry.filename,
                'size': entry.st_size,
                'is_dir': stat.S_ISDIR(entry.st_mode),
                'modified': entry.st_mtime
            })

        return jsonify({
            "status": "success",
            "path": path,
            "files": files
        }), 200

    except FileNotFoundError:
        return jsonify({"error": "Directory not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/upload', methods=['POST'])
def upload_file():
    """
    Upload a file to the remote server via SFTP.
    Creates remote directories if they don't exist.
    """
    try:
        connection_id = request.form.get('connection_id')
        remote_path = request.form.get('remote_path')

        if not connection_id or not remote_path:
            return jsonify({"error": "Connection ID and remote path required"}), 400

        if connection_id not in active_connections:
            return jsonify({"error": "Connection not found"}), 404

        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        sftp = active_connections[connection_id]['sftp']

        # Ensure remote directory exists
        remote_dir = '/'.join(remote_path.split('/')[:-1])
        if remote_dir:
            try:
                sftp.stat(remote_dir)
            except FileNotFoundError:
                # Create directory recursively
                dirs = []
                temp_dir = remote_dir
                while temp_dir and temp_dir != '/':
                    try:
                        sftp.stat(temp_dir)
                        break
                    except FileNotFoundError:
                        dirs.append(temp_dir)
                        temp_dir = '/'.join(temp_dir.split('/')[:-1])

                # Create directories from parent to child
                for dir_path in reversed(dirs):
                    sftp.mkdir(dir_path)

        # Upload file
        file_data = file.read()
        with sftp.file(remote_path, 'wb') as remote_file:
            remote_file.write(file_data)

        return jsonify({
            "status": "uploaded",
            "remote_path": remote_path,
            "size": len(file_data)
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/download', methods=['POST'])
def download_file():
    """
    Download a file from the remote server via SFTP and stream it to the client.
    """
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')
        remote_path = data.get('remote_path')

        if not connection_id or not remote_path:
            return jsonify({"error": "Connection ID and remote path required"}), 400

        if connection_id not in active_connections:
            return jsonify({"error": "Connection not found"}), 404

        sftp = active_connections[connection_id]['sftp']

        # Create a temporary file to store the download
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        try:
            sftp.get(remote_path, temp_file.name)
            temp_file.close()

            # Get the filename from the remote path
            filename = remote_path.split('/')[-1]

            # Send the file to the client
            return send_file(
                temp_file.name,
                as_attachment=True,
                download_name=filename,
                mimetype='application/octet-stream'
            )
        finally:
            # Clean up the temp file after sending
            try:
                os.unlink(temp_file.name)
            except:
                pass

    except FileNotFoundError:
        return jsonify({"error": "Remote file not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/execute', methods=['POST'])
def execute_command():
    """
    Execute a command on the remote server via SSH.
    Maintains state for directory changes and other stateful operations.
    Supports execution in a specific directory via target_dir parameter.
    """
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')
        command = data.get('command')
        target_dir = data.get('target_dir')

        if not connection_id or not command:
            return jsonify({"error": "Connection ID and command required"}), 400

        if connection_id not in active_connections:
            return jsonify({"error": "Connection not found"}), 404

        ssh = active_connections[connection_id]['ssh']
        
        # Initialize channel for this connection if it doesn't exist
        if connection_id not in ssh_channels:
            ssh_channels[connection_id] = {
                'cwd': '/home/user',
                'history': []
            }
        
        channel_state = ssh_channels[connection_id]
        
        # For cd command, update the state without executing on remote
        if command.strip().startswith('cd '):
            new_dir = command.strip()[3:].strip()
            if not new_dir:
                new_dir = '/home/user'
            channel_state['cwd'] = new_dir
            return jsonify({
                "status": "executed",
                "output": f"Changed directory to {new_dir}",
                "cwd": new_dir
            }), 200
        
        # Handle pwd command
        if command.strip() == 'pwd':
            return jsonify({
                "status": "executed",
                "output": channel_state['cwd'],
                "cwd": channel_state['cwd']
            }), 200
        
        # Determine execution directory
        exec_dir = target_dir if target_dir else channel_state['cwd']
        
        # Execute command in the specified or current working directory
        full_command = f"cd {exec_dir} && {command}"
        _, stdout, stderr = ssh.exec_command(full_command)

        output = stdout.read().decode('utf-8')
        error_output = stderr.read().decode('utf-8')
        
        channel_state['history'].append({
            'command': command,
            'output': output,
            'error': error_output
        })

        return jsonify({
            "status": "executed",
            "output": output,
            "error": error_output if error_output else None,
            "cwd": channel_state['cwd']
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/terminal/create', methods=['POST'])
def create_terminal():
    """
    Create a new persistent terminal session that runs in the background.
    Terminal output is streamed via WebSocket instead of polling.
    """
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')
        target_dir = data.get('target_dir', '/home/user')
        name = data.get('name', 'Terminal')

        if not connection_id:
            return jsonify({"error": "Connection ID required"}), 400

        if connection_id not in active_connections:
            return jsonify({"error": "Connection not found"}), 404

        terminal_id = str(uuid.uuid4())
        ssh = active_connections[connection_id]['ssh']

        terminal_sessions[terminal_id] = {
            'connection_id': connection_id,
            'name': name,
            'cwd': target_dir,
            'output': '',
            'last_sent_length': 0,
            'channel': ssh.invoke_shell(),
            'output_queue': queue.Queue()
        }

        channel = terminal_sessions[terminal_id]['channel']
        channel.settimeout(0.1)

        def read_output():
            """Read terminal output and store it. The polling endpoint will send it to clients."""
            while terminal_id in terminal_sessions:
                try:
                    data = channel.recv(1024)
                    if data:
                        decoded = data.decode('utf-8', errors='ignore')
                        terminal_sessions[terminal_id]['output'] += decoded
                except socket.timeout:
                    pass
                except Exception:
                    break
                time.sleep(0.05)

        thread = threading.Thread(target=read_output, daemon=True)
        thread.start()

        return jsonify({
            "status": "created",
            "terminal_id": terminal_id,
            "name": name,
            "cwd": target_dir
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/terminal/execute', methods=['POST'])
def terminal_execute():
    """
    Execute a command in a persistent terminal session.
    """
    try:
        data = request.get_json()
        terminal_id = data.get('terminal_id')
        command = data.get('command')

        if not terminal_id or not command:
            return jsonify({"error": "Terminal ID and command required"}), 400

        if terminal_id not in terminal_sessions:
            return jsonify({"error": "Terminal not found"}), 404

        session = terminal_sessions[terminal_id]
        channel = session['channel']

        channel.send(command + '\n')

        return jsonify({
            "status": "sent",
            "terminal_id": terminal_id
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/terminal/output', methods=['POST'])
def terminal_output():
    """
    Get current output from a terminal session.
    Frontend calls this periodically. The output is stored server-side,
    so clients can see everything even after disconnecting/reconnecting.
    """
    try:
        data = request.get_json()
        terminal_id = data.get('terminal_id')
        last_length = data.get('last_length', 0)

        if not terminal_id:
            return jsonify({"error": "Terminal ID required"}), 400

        if terminal_id not in terminal_sessions:
            return jsonify({"error": "Terminal not found"}), 404

        session = terminal_sessions[terminal_id]
        output = session['output']
        
        new_chunk = output[last_length:] if last_length < len(output) else ''

        return jsonify({
            "status": "success",
            "terminal_id": terminal_id,
            "output": output,
            "chunk": new_chunk,
            "total_length": len(output),
            "name": session['name'],
            "cwd": session['cwd']
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/terminal/close', methods=['POST'])
def terminal_close():
    """
    Close a persistent terminal session.
    """
    try:
        data = request.get_json()
        terminal_id = data.get('terminal_id')

        if not terminal_id:
            return jsonify({"error": "Terminal ID required"}), 400

        if terminal_id not in terminal_sessions:
            return jsonify({"error": "Terminal not found"}), 404

        session = terminal_sessions[terminal_id]
        try:
            session['channel'].close()
        except:
            pass

        del terminal_sessions[terminal_id]

        return jsonify({
            "status": "closed",
            "terminal_id": terminal_id
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/terminal/list', methods=['POST'])
def terminal_list():
    """
    List all active terminal sessions for a connection.
    """
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')

        if not connection_id:
            return jsonify({"error": "Connection ID required"}), 400

        terminals = []
        for term_id, session in terminal_sessions.items():
            if session['connection_id'] == connection_id:
                terminals.append({
                    'terminal_id': term_id,
                    'name': session['name'],
                    'cwd': session['cwd']
                })

        return jsonify({
            "status": "success",
            "terminals": terminals
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/rosbag/list', methods=['POST'])
def list_rosbag_files():
    """
    List all rosbag files in the remote recorded directory.
    Uses the existing SFTP connection to access files on the remote device.
    Default path is ~/ros2_ws/replays/recorded unless overridden.
    """
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')
        path = data.get('path', '~/ros2_ws/replays/recorded')

        if not connection_id:
            return jsonify({"error": "Connection ID required"}), 400

        if connection_id not in active_connections:
            return jsonify({"error": "Connection not found"}), 404

        sftp = active_connections[connection_id]['sftp']
        ssh = active_connections[connection_id]['ssh']

        try:
            expanded_path = path
            if path.startswith('~'):
                _, stdout, _ = ssh.exec_command(f'echo {path}')
                expanded_path = stdout.read().decode('utf-8').strip()

            files = []
            for entry in sftp.listdir_attr(expanded_path):
                files.append({
                    'name': entry.filename,
                    'size': entry.st_size,
                    'is_dir': stat.S_ISDIR(entry.st_mode),
                    'modified': entry.st_mtime
                })

            files.sort(key=lambda x: x['modified'], reverse=True)

            return jsonify({
                "status": "success",
                "path": expanded_path,
                "files": files
            }), 200

        except FileNotFoundError:
            return jsonify({
                "status": "success",
                "path": path,
                "files": [],
                "message": "Directory not found"
            }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@connection_bp.route('/api/connection/rosbag/download', methods=['POST'])
def download_rosbag_file():
    """
    Download a rosbag file from the remote recorded directory.
    Uses the existing SFTP connection to fetch the file from the remote device.
    Supports both individual files and directories (directories are compressed as tar.gz).
    """
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')
        filename = data.get('filename')
        base_path = data.get('path', '~/ros2_ws/replays/recorded')

        if not connection_id or not filename:
            return jsonify({"error": "Connection ID and filename required"}), 400

        if connection_id not in active_connections:
            return jsonify({"error": "Connection not found"}), 404

        sftp = active_connections[connection_id]['sftp']
        ssh = active_connections[connection_id]['ssh']

        expanded_base_path = base_path
        if base_path.startswith('~'):
            _, stdout, _ = ssh.exec_command(f'echo {base_path}')
            expanded_base_path = stdout.read().decode('utf-8').strip()

        remote_path = f"{expanded_base_path}/{filename}".replace('//', '/')

        try:
            file_stat = sftp.stat(remote_path)
            is_dir = stat.S_ISDIR(file_stat.st_mode)

            if is_dir:
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.tar.gz')
                temp_file.close()

                try:
                    tar_command = f"cd {expanded_base_path} && tar -czf - {filename}"
                    _, stdout, stderr = ssh.exec_command(tar_command)

                    with open(temp_file.name, 'wb') as f:
                        f.write(stdout.read())

                    error = stderr.read().decode('utf-8')
                    if error and 'error' in error.lower():
                        raise Exception(f"Tar error: {error}")

                    return send_file(
                        temp_file.name,
                        as_attachment=True,
                        download_name=f"{filename}.tar.gz",
                        mimetype='application/gzip'
                    )
                finally:
                    try:
                        os.unlink(temp_file.name)
                    except:
                        pass
            else:
                temp_file = tempfile.NamedTemporaryFile(delete=False)
                try:
                    sftp.get(remote_path, temp_file.name)
                    temp_file.close()

                    return send_file(
                        temp_file.name,
                        as_attachment=True,
                        download_name=filename,
                        mimetype='application/octet-stream'
                    )
                finally:
                    try:
                        os.unlink(temp_file.name)
                    except:
                        pass

        except FileNotFoundError:
            return jsonify({"error": "File not found"}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500