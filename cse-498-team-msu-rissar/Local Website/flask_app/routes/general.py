from flask import Blueprint, jsonify, render_template, redirect, request
import datetime
import subprocess

general_bp = Blueprint('general', __name__)


@general_bp.route('/')
def root():
    """Redirect root to home page."""
    return redirect('/home')


@general_bp.route('/health')
def health():
    """
    Health check endpoint that reports system status.
    Returns status of Flask app and ROS proxy.
    """
    from ..ros_proxy import get_ros_proxy

    health_status = {
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat()
    }

    proxy = get_ros_proxy()
    if proxy:
        clients = proxy.get_all_clients_info()
        health_status["ros"] = {
            "proxy_initialized": True,
            "connected_clients": len(clients),
            "rosbridge_url": proxy.rosbridge_url
        }
    else:
        health_status["ros"] = {
            "proxy_initialized": False
        }

    return jsonify(health_status), 200


@general_bp.route('/home', methods=['GET', 'POST'])
def home():
    """
    Home page route. Handles GET requests for page display and POST requests
    for updating ROS2 node parameters.
    """
    status_msg = ""

    if request.method == 'POST':
        try:
            new_span = float(request.form['span'])

            result = subprocess.run(
                ["ros2", "param", "set", "/depth_heatmap_only_node", "span", str(new_span)],
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                status_msg = f"Span updated to {new_span}"
            else:
                status_msg = f"Failed: {result.stderr}"

        except Exception as e:
            status_msg = f"Exception: {e}"

    return render_template('home.html', status_msg=status_msg)