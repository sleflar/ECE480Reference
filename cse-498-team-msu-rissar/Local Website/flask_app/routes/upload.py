from flask import Blueprint, jsonify, request
import os

upload_bp = Blueprint('upload', __name__)

UPLOAD_FOLDER = 'replay_sessions'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

session_folder_name = None


@upload_bp.route('/upload', methods=['POST'])
def upload():
    """
    Handle file uploads for replay sessions.
    Saves uploaded files to the replay_sessions directory maintaining folder structure.
    """
    global session_folder_name

    uploaded_file = request.files['file']
    rel_path = uploaded_file.filename

    parts = rel_path.split('/')
    session_folder_name = parts[0]
    print("Session folder name:", session_folder_name)

    save_path = os.path.join(UPLOAD_FOLDER, rel_path)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    uploaded_file.save(save_path)

    return jsonify({
        "message": f"Saved to {rel_path}",
        "session": session_folder_name
    })


def get_session_folder_name():
    """Get the current session folder name."""
    return session_folder_name