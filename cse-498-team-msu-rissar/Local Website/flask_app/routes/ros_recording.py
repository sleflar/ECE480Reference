from flask import Blueprint, jsonify, request
import os
import subprocess
import signal
import datetime

ros_recording_bp = Blueprint('ros_recording', __name__)

recordProcess = {}
relayProcess = {}
recordFolder = None


@ros_recording_bp.route('/recordROS2Bag', methods=['POST'])
def recordRos2Bag():
    """
    Start or stop ROS2 bag recording.
    Manages recording of multiple topics to separate bag files and handles relay processes.
    """
    global recordProcess, recordFolder, relayProcess
    data = request.get_json()
    isRecording = data.get("isRecordMode", False)
    topicsToRecord = [
        ("/gnss", "gnss_bag"),
        ("/scan", "lidar_bag"),
        ("/imu/data_raw", "imu_bag"),
        ("/camera_feed", "camera_bag"),
        ("/controller_data", "controller_bag"),
    ]
    if isRecording:
        if recordProcess:
            return jsonify({"status": "recording"}), 400

        fixed_dir = "/home/vu/Desktop/ros2_bags"
        timeAtRecord = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        recordFolder = os.path.join(fixed_dir, timeAtRecord)
        os.makedirs(recordFolder, exist_ok=True)

        relayProcess = {}
        for (topic, folder) in topicsToRecord:
            pathToFolder = os.path.join(recordFolder, folder)

            rlayCmd = ('sudo bash -c "'
                'source /home/vu/ros2_humble/install/setup.bash; '
                'source /home/vu/ros2_ws/install/setup.bash; '
                f'ros2 run topic_tools relay {topic} {topic}_bag"')
            process = subprocess.Popen(
                rlayCmd,
                shell=True,
                preexec_fn=os.setsid,
            )
            relayProcess[folder] = process

        recordProcess = {}

        for (topic, folder) in topicsToRecord:
            pathToFolder = os.path.join(recordFolder, folder)

            cmd = ('sudo bash -c "'
                'source /home/vu/ros2_humble/install/setup.bash; '
                'source /home/vu/ros2_ws/install/setup.bash; '
                f'cd {recordFolder} && ros2 bag record {topic}_bag -o {folder}"')
            process = subprocess.Popen(
                cmd,
                shell=True,
                preexec_fn=os.setsid,
            )
            recordProcess[folder] = process

        return jsonify({"status": "recording started", "folder": recordFolder}), 200
    else:
        if not recordProcess:
            return ("no bag is running")

        try:
            cmd = (
                "ps aux | grep '[p]ython3 /opt/ros/humble/bin/ros2 bag record' "
                "| awk '{print $2}' | xargs sudo kill -SIGINT"
            )
            subprocess.run(cmd, shell=True, check=False)
            print("recording stop cmd sent")

            stopCmd = ("sudo pkill -f record")
            subprocess.run(stopCmd, shell=True, check=False)

            relayCmd = ("sudo pkill -f topic_tools")
            subprocess.run(relayCmd, shell=True, check=False)
            print("recording stop cmd sent")
            stopSuccessful = True

        except Exception as e:
            print("failed to stop")
            stopSuccessful = False
            for folder, process in recordProcess.items():
                os.killpg(os.getpgid(process.pid), signal.SIGINT)

            for folder, process in recordProcess.items():
                try:
                    print('2')
                    process.wait(timeout=0.5)
                except subprocess.TimeoutExpired:
                    print('3')
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                    process.wait(timeout=3)

            for topic, process in relayProcess.items():
                try:
                    os.killpg(os.getpgid(process.pid), signal.SIGINT)
                    process.wait(timeout=0.5)
                except subprocess.TimeoutExpired:
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                    process.wait(timeout=3)

        relayProcess.clear()

        recordProcess.clear()

        allRecordingFinished = False

        if not stopSuccessful:
            for (topic, folder) in topicsToRecord:
                pathToFolder = os.path.join(recordFolder, folder)
                reindexCmd = (
                    'sudo bash -c "'
                    'source /home/vu/ros2_humble/install/setup.bash; '
                    'source /home/vu/ros2_ws/install/setup.bash; '
                    f'ros2 bag reindex {pathToFolder}"'
                )
                process = subprocess.Popen(reindexCmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                out, err = process.communicate()

                if process.returncode != 0:
                    allRecordingFinished = True

            if allRecordingFinished:
                return jsonify({
                    "status": "recording stopped, but reindex failed",
                    "error": err.decode("utf-8")
                }), 500
            else:
                return jsonify({
                    "status": "recording stopped, reindex complete",
                    "folder": recordFolder
                }), 200

        return jsonify({"status": "no recording running"}), 200