import os
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_failsafe import failsafe
from .ros_proxy import init_ros_proxy

socketio = SocketIO(cors_allowed_origins="*")

@failsafe
def create_app():
	app = Flask(__name__)

	# enable CORS for all routes
	CORS(app, resources={r"/*": {"origins": "*"}})

	# Initialize SocketIO with the app
	socketio.init_app(app, async_mode='eventlet', logger=True, engineio_logger=True)
	
	# Initialize ROS proxy
	rosbridge_url = os.environ.get('ROSBRIDGE_URL', 'ws://192.168.8.4:9090')
	init_ros_proxy(rosbridge_url)
	
	# Register blueprints
	from .routes import register_blueprints
	register_blueprints(app)

	with app.app_context():
		from . import ros_socketio_handlers
		from . import terminal_socketio_handlers
		return app
