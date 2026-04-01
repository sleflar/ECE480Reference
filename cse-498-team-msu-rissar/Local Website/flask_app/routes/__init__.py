from .general import general_bp
from .upload import upload_bp
from .ros_playback import ros_playback_bp
from .ros_recording import ros_recording_bp
from .maps import maps_bp
from .connection import connection_bp


def register_blueprints(app):
    """
    Register all application blueprints with the Flask app.

    Args:
        app: Flask application instance
    """
    app.register_blueprint(general_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(ros_playback_bp)
    app.register_blueprint(ros_recording_bp)
    app.register_blueprint(maps_bp)
    app.register_blueprint(connection_bp)