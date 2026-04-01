from flask import Blueprint, jsonify, request
import os
import subprocess
import signal

ros_playback_bp = Blueprint('ros_playback', __name__)

bagProcess = {}


@ros_playback_bp.route('/playROS2Bag', methods=['POST'])
def playROS2Bag():
    """
    Start or stop ROS2 bag playback based on replay mode.
    Manages multiple bag processes for different topics.
    """
    global bagProcess
    from .upload import get_session_folder_name

    data = request.get_json()
    isReplayMode = data.get("isReplayMode", False)
    bagToplay = get_session_folder_name()

    if isReplayMode:
        relayCmd = ("sudo pkill -f topic_tools")
        subprocess.run(relayCmd, shell=True, check=False)
        print("recording stop cmd sent")

        if bagProcess:
            for process in bagProcess.values():
                process.send_signal(signal.SIGINT)

            bagProcess.clear()

        bags = [
            "gnss_bag",
            "lidar_bag",
            "imu_bag",
            "camera_bag",
            "controller_bag",
        ]

        topics = [
            "/camera_feed",
            "/controller_data"
            "/scan"
            "/gnss"
            "/imu/data_raw"
        ]

        fixed_dir = "/home/vu/Desktop/ros2_bags"

        for bag in bags:
            bagPath = os.path.join(fixed_dir, bagToplay, bag)

            cmd = ('sudo bash -c "'
                'source /home/vu/ros2_humble/install/setup.bash; '
                'source /home/vu/ros2_ws/install/setup.bash; '
                f'exec ros2 bag play {bagPath}"')
            process = subprocess.Popen(cmd, shell=True, preexec_fn=os.setsid)
            bagProcess[bag] = process

        response = {"status": "bag started"}

    else:
        if bagProcess:
            try:
                stop_cmd = (
                    "ps aux | grep '[p]ython3 /opt/ros/humble/bin/ros2 bag play' "
                    "| awk '{print $2}' | xargs sudo kill -SIGINT"
                )

                subprocess.run(stop_cmd, shell=True, check=False)
                response = {"status": "all ros2 bag playback stopped"}
            except Exception as e:
                print(f"[ERROR] Failed to stop rosbag: {e}")
                response = {"status": "error stopping bags", "error": str(e)}

            bagProcess.clear()
            response = {"status": "bag stopped"}
        else:
            response = {"status": "no bag is running"}

    return jsonify(response), 200


@ros_playback_bp.route('/pauseResume', methods=['POST'])
def pauseResume():
    """
    Toggle pause/resume for ROS2 bag playback.
    Sends SIGINT to all running playback processes.
    """
    cmd = ("ps aux | grep '[p]ython3 /opt/ros/humble/bin/ros2 bag play' | awk '{print $2}' | xargs sudo kill -SIGINT")
    try:
        subprocess.run(cmd, shell=True, check=True)
        return jsonify({"status": "toggled"}), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500