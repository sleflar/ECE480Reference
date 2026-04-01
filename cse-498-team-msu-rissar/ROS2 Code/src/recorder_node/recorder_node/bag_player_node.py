"""
ROS2 Bag Player Node
Provides a service to play back uploaded bag files with automatic finish detection and loop support
"""

import rclpy
from rclpy.node import Node
from std_srvs.srv import Trigger
from std_msgs.msg import String, Bool
import subprocess
import os
import signal
import glob
import time
import traceback


class BagPlayerNode(Node):
    def __init__(self):
        super().__init__('bag_player_node')

        self.declare_parameter('bag_directory', 'replays')
        self.declare_parameter('upload_directory', 'replays/uploaded')
        self.declare_parameter('playback_rate', 1.0)

        self.bag_directory = self.get_parameter('bag_directory').value
        self.upload_directory = self.get_parameter('upload_directory').value
        self.playback_rate = self.get_parameter('playback_rate').value

        self.playback_process = None
        self.current_bag_path = None
        self.uploaded_bag_path = None
        self.monitoring_timer = None
        self.loop_mode = False

        self.play_service = self.create_service(Trigger, '/rosbag2_player/play', self.play_callback)
        self.stop_service = self.create_service(Trigger, '/rosbag2_player/stop', self.stop_callback)
        self.bag_path_subscriber = self.create_subscription(String, '/rosbag2_player/set_bag_path', self.bag_path_callback, 10)
        
        self.loop_mode_subscriber = self.create_subscription(
            Bool,
            '/rosbag2_player/set_loop_mode',
            self.loop_mode_callback,
            10
        )
        
        self.playback_status_publisher = self.create_publisher(String, '/rosbag2_player/status', 10)
        
        self.get_logger().info('Bag player initialized')

    def loop_mode_callback(self, msg):
        """Receives loop mode setting from frontend."""
        old_loop_mode = self.loop_mode
        self.loop_mode = msg.data
        
        if old_loop_mode and not self.loop_mode and self.playback_process is not None:
            try:
                pgid = os.getpgid(self.playback_process.pid)
                os.killpg(pgid, signal.SIGINT)
            except Exception as e:
                self.get_logger().error(f'Failed to send SIGINT: {e}')

    def publish_status(self, status):
        """Publish playback status"""
        msg = String()
        msg.data = status
        self.playback_status_publisher.publish(msg)

    def monitor_playback(self):
        """Check if playback process has finished"""
        if self.playback_process is not None:
            poll_result = self.playback_process.poll()
            
            if poll_result is not None:
                
                self.publish_status('finished')
                
                self.playback_process = None
                self.current_bag_path = None
                
                if self.monitoring_timer:
                    self.monitoring_timer.cancel()
                    self.monitoring_timer = None

    def find_db3_in_subdirs(self, base_dir):
        """Recursively find all directories that contain at least one .db3 file."""
        bag_dirs = []
        for root, dirs, files in os.walk(base_dir):
            for f in files:
                if f.endswith('.db3'):
                    bag_dirs.append(root)
                    break
        return bag_dirs

    def bag_path_callback(self, msg):
        """Receives uploaded bag file path from frontend."""
        self.uploaded_bag_path = msg.data.strip()

        possible_paths = [
            self.uploaded_bag_path,
            os.path.join(self.upload_directory, self.uploaded_bag_path),
            os.path.join(self.bag_directory, self.uploaded_bag_path),
        ]

        resolved = None
        for path in possible_paths:
            if os.path.exists(path):
                resolved = os.path.abspath(path)
                break

        if not resolved:
            self.get_logger().error(f'Path does not exist: {self.uploaded_bag_path}')
            self.get_logger().info('=' * 70)
            return

        # If it's a file, go to its parent
        if resolved.endswith('.db3'):
            resolved = os.path.dirname(resolved)

        # If it's a directory but contains subfolders (like camera_bag), search recursively
        db3_dirs = self.find_db3_in_subdirs(resolved)
        if db3_dirs:
            latest = max(db3_dirs, key=os.path.getmtime)
            self.uploaded_bag_path = latest
        else:
            self.uploaded_bag_path = resolved

    def find_latest_bag(self):
        """Find the most recently modified directory containing a .db3 file."""

        search_dirs = [
            self.upload_directory,
            self.bag_directory,
        ]

        valid_dirs = []
        for search_dir in search_dirs:
            if not os.path.exists(search_dir):
                continue
            self.get_logger().info(f'Checking: {search_dir}')
            valid_dirs += self.find_db3_in_subdirs(search_dir)

        if not valid_dirs:
            self.get_logger().warn('No .db3 bag files found in any directory!')
            return None

        latest = max(valid_dirs, key=os.path.getmtime)
        self.get_logger().info(f'Latest bag found: {latest}')
        return latest

    def play_callback(self, request, response):
        """Start playback using ros2 bag play."""

        if self.playback_process and self.playback_process.poll() is None:
            self.get_logger().warn('Already playing a bag file')
            response.success = False
            response.message = 'Already playing'
            return response

        try:
            bag_path = None
            if self.uploaded_bag_path and os.path.exists(self.uploaded_bag_path):
                bag_path = self.uploaded_bag_path
            else:
                bag_path = self.find_latest_bag()

            if not bag_path:
                response.success = False
                response.message = 'No bag file found'
                return response

            db3_files = sorted(glob.glob(os.path.join(bag_path, '*.db3')))
            if not db3_files:
                self.get_logger().error(f'No .db3 files found in: {bag_path}')
                response.success = False
                response.message = 'Invalid bag (no .db3 found)'
                return response

            db3_file = db3_files[0]

            cmd = f'exec ros2 bag play "{db3_file}" --rate {self.playback_rate}'
            if self.loop_mode:
                cmd += ' --loop'
                self.get_logger().info('Playback will loop continuously')

            self.playback_process = subprocess.Popen(
                cmd,
                shell=True,
                preexec_fn=os.setsid,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            self.current_bag_path = bag_path
            time.sleep(0.5)

            if self.playback_process.poll() is not None:
                stdout, stderr = self.playback_process.communicate()
                self.get_logger().error('Playback failed to start!')
                self.get_logger().error(stderr.decode() if stderr else "Unknown error")
                response.success = False
                response.message = 'Playback failed to start'
                self.playback_process = None
                return response

            self.monitoring_timer = self.create_timer(1.0, self.monitor_playback)
            
            self.publish_status('playing')

            response.success = True
            response.message = f'Playing: {os.path.basename(db3_file)}' + (' (Looping)' if self.loop_mode else '')

        except Exception as e:
            self.get_logger().error(f'Failed to start playback: {e}')
            self.get_logger().error(traceback.format_exc())
            response.success = False
            response.message = f'Error: {str(e)}'
            self.playback_process = None

        self.get_logger().info('=' * 70)
        return response

    def stop_callback(self, request, response):
        """Stop playback process."""
        self.get_logger().info('STOP SERVICE CALLED')

        if not self.playback_process:
            self.get_logger().warn('No playback in progress')
            response.success = False
            response.message = 'No playback in progress'
            return response

        try:
            pgid = os.getpgid(self.playback_process.pid)
            os.killpg(pgid, signal.SIGINT)
            self.playback_process.wait(timeout=5)
        except Exception:
            self.get_logger().warn('Force-killing process...')
            try:
                os.killpg(pgid, signal.SIGKILL)
            except Exception:
                pass
        finally:
            self.playback_process = None
            self.current_bag_path = None
          
            if self.monitoring_timer:
                self.monitoring_timer.cancel()
                self.monitoring_timer = None
            
            self.publish_status('stopped')

        response.success = True
        response.message = 'Playback stopped'
        return response

    def destroy_node(self):
        if self.monitoring_timer:
            self.monitoring_timer.cancel()
            
        if self.playback_process:
            try:
                pgid = os.getpgid(self.playback_process.pid)
                os.killpg(pgid, signal.SIGTERM)
                self.playback_process.wait(timeout=5)
            except Exception:
                pass
        super().destroy_node()


def main(args=None):
    rclpy.init(args=args)
    node = BagPlayerNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()