import os
import shutil
import paramiko
from flask import jsonify, request
from flask_app import create_app, socketio
from werkzeug.utils import secure_filename

app = create_app()

UPLOAD_FOLDER = 'replays/uploaded_local'  
ALLOWED_EXTENSIONS = {'db3', 'yaml', 'mcap'}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB

# Jetson connection info
JETSON_HOST = "192.168.8.4"        
JETSON_USER = "user"                 
JETSON_PASSWORD = "password"    
JETSON_UPLOAD_PATH = "/home/user/ros2_ws/replays/uploaded"  

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Ensure local temp directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def upload_to_jetson(local_path, remote_dir):
    """Transfer a file to the Jetson via SFTP"""
    filename = os.path.basename(local_path)
    remote_path = os.path.join(remote_dir, filename)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        app.logger.info(f"Connecting to Jetson {JETSON_HOST} as {JETSON_USER}...")
        client.connect(JETSON_HOST, username=JETSON_USER, password=JETSON_PASSWORD)

        sftp = client.open_sftp()
        sftp.put(local_path, remote_path)
        sftp.close()

        app.logger.info(f"Transferred {filename} to Jetson: {remote_path}")
        return remote_path

    except Exception as e:
        app.logger.error(f"Failed to upload to Jetson: {str(e)}")
        raise
    finally:
        client.close()

@app.route('/upload-bag', methods=['POST'])
def upload_bag():
    """Handle ROS2 bag file upload and send to Jetson"""
    if 'bagFile' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['bagFile']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only .db3, .yaml, and .mcap allowed'}), 400

    try:
        filename = secure_filename(file.filename)

        if filename.endswith('_0.db3'):
            bag_name = filename[:-7]
        elif filename.endswith('.db3'):
            bag_name = filename[:-4]
        else:
            bag_name = filename.rsplit('.', 1)[0]

        bag_dir_local = os.path.join(app.config['UPLOAD_FOLDER'], bag_name)
        os.makedirs(bag_dir_local, exist_ok=True)

        file_path_local = os.path.join(bag_dir_local, filename)
        file.save(file_path_local)
        app.logger.info(f"Saved locally: {file_path_local}")

        remote_bag_dir = os.path.join(JETSON_UPLOAD_PATH, bag_name)

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(JETSON_HOST, username=JETSON_USER, password=JETSON_PASSWORD)

        stdin, stdout, stderr = client.exec_command(f"mkdir -p {remote_bag_dir}")
        stdout.channel.recv_exit_status()  # Wait for command to finish
        client.close()

        # Upload to Jetson
        remote_path = upload_to_jetson(file_path_local, remote_bag_dir)

        # Return success response
        return jsonify({
            'success': True,
            'message': 'File uploaded and transferred to Jetson successfully',
            'filename': filename,
            'local_path': file_path_local,
            'remote_path': remote_path,
            'size': os.path.getsize(file_path_local)
        }), 200

    except Exception as e:
        app.logger.error(f"Upload failed: {str(e)}")
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500


@app.route('/list-bags', methods=['GET'])
def list_bags():
    """List all available bag directories (local + Jetson)"""
    try:
        bags = []

        # List local bags (optional)
        if os.path.exists(app.config['UPLOAD_FOLDER']):
            for item in os.listdir(app.config['UPLOAD_FOLDER']):
                item_path = os.path.join(app.config['UPLOAD_FOLDER'], item)
                if os.path.isdir(item_path):
                    bags.append({
                        'name': item,
                        'path': item_path,
                        'size': sum(os.path.getsize(os.path.join(item_path, f))
                                    for f in os.listdir(item_path)),
                        'modified': os.path.getmtime(item_path),
                        'files': len(os.listdir(item_path))
                    })

        bags.sort(key=lambda x: x['modified'], reverse=True)

        return jsonify({
            'success': True,
            'bags': bags,
            'count': len(bags)
        }), 200

    except Exception as e:
        app.logger.error(f"Error listing bags: {str(e)}")
        return jsonify({'error': f'Failed to list bags: {str(e)}'}), 500


@app.route('/delete-bag', methods=['DELETE'])
def delete_bag():
    """Delete a bag directory locally"""
    try:
        bag_path = request.json.get('path')

        if not bag_path:
            return jsonify({'error': 'No path provided'}), 400

        if not os.path.exists(bag_path):
            return jsonify({'error': 'Bag not found'}), 404

        if os.path.isdir(bag_path):
            shutil.rmtree(bag_path)
        else:
            os.remove(bag_path)

        return jsonify({'success': True, 'message': 'Bag deleted successfully'}), 200

    except Exception as e:
        app.logger.error(f"Error deleting bag: {str(e)}")
        return jsonify({'error': f'Failed to delete bag: {str(e)}'}), 500



if __name__ == "__main__":
    socketio.run(
        app,
        host='0.0.0.0',
        port=int(os.environ.get("PORT", 8080)),
        debug=True,
        use_reloader=False
    )
