"""
ROS2 Bag Recorder Node
Provides services to start/stop recording ALL ROS topics to bag files
"""

import rclpy
from rclpy.node import Node
from std_srvs.srv import Trigger
from std_msgs.msg import String
import subprocess
import os
from datetime import datetime
import signal
import pty
import fcntl
import sqlite3


class BagRecorderNode(Node):
    def __init__(self):
        super().__init__('bag_recorder_node')
        
        # Parameters
        self.declare_parameter('output_dir', 'replays/recorded')
        self.declare_parameter('compression_mode', 'file')  
        self.declare_parameter('car_namespace', 'car1_ns')
        
        self.output_dir = self.get_parameter('output_dir').value
        self.compression_mode = self.get_parameter('compression_mode').value
        self.car_namespace = self.get_parameter('car_namespace').value
        
        # Create output directory if it doesn't exist
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Recording state
        self.recording_process = None
        self.current_bag_path = None
        self.master_fd = None 
        
        # Create services
        self.start_service = self.create_service(
            Trigger,
            '/rosbag2_recorder/start',
            self.start_recording_callback
        )
        
        self.stop_service = self.create_service(
            Trigger,
            '/rosbag2_recorder/stop',
            self.stop_recording_callback
        )
        
        self.pause_resume_service = self.create_service(
            Trigger,
            '/rosbag2_recorder/pause_resume',
            self.pause_resume_callback
        )
        
        self.car_namespace_subscriber = self.create_subscription(
            String,
            '/rosbag2_recorder/set_car_namespace',
            self.car_namespace_callback,
            10
        )
    
    def car_namespace_callback(self, msg):
        """Receives car namespace from frontend."""
        new_namespace = msg.data.strip()
        if new_namespace:
            self.car_namespace = new_namespace
    
    def rename_topics_in_bag(self, bag_path):
        """Rename all topics in the bag database to add _bag suffix"""
        try:
            # Find the database file
            db_file = None
            for file in os.listdir(bag_path):
                if file.endswith('.db3'):
                    db_file = os.path.join(bag_path, file)
                    break
            
            if db_file is None:
                self.get_logger().error(f'No .db3 file found in {bag_path}')
                return False
            
            # Connect to the bag database
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            
            cursor.execute("SELECT id, name FROM topics")
            topics = cursor.fetchall()
            
            # Rename each topic by adding _bag suffix (if not already present)
            renamed_count = 0
            for topic_id, topic_name in topics:
                if not topic_name.endswith('_bag'):
                    new_name = f'{topic_name}_bag'
                    cursor.execute("UPDATE topics SET name = ? WHERE id = ?", 
                                 (new_name, topic_id))
                    renamed_count += 1
            
            conn.commit()
            conn.close()
            
            return True
            
        except Exception as e:
            return False
    
    def start_recording_callback(self, request, response):
        """Start recording topics for the selected car namespace"""
        if self.recording_process is not None:
            response.success = False
            response.message = 'Already recording'
            return response
        
        try:
            # Generate bag file name with timestamp and car namespace
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            car_prefix = self.car_namespace.replace('_ns', '')  
            bag_name = f'{car_prefix}_recording_{timestamp}'
            bag_path = os.path.join(self.output_dir, bag_name)
            
            topic_regex = f'^/{self.car_namespace}/.*'
            
            cmd = [
                'ros2', 'bag', 'record',
                '-e', topic_regex,  # Use regex to match topics for this car only
                '-o', bag_path,
                '--compression-mode', self.compression_mode
            ]
            
            # Create pseudo-terminal for interactive control (allows spacebar pause/resume)
            master_fd, slave_fd = pty.openpty()
            
            # Start recording process with pseudo-terminal
            self.recording_process = subprocess.Popen(
                cmd,
                stdin=slave_fd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid  
            )
            
            os.close(slave_fd)
            
            self.master_fd = master_fd
            
            flags = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
            fcntl.fcntl(self.master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
            
            self.current_bag_path = bag_path
            
            response.success = True
            response.message = f'Recording started: {bag_name} (filtering {topic_regex})'
            
        except Exception as e:
            response.success = False
            response.message = f'Error: {str(e)}'
        
        return response
    
    def stop_recording_callback(self, request, response):
        """Stop the current recording"""
        if self.recording_process is None:
            response.success = False
            response.message = 'Not currently recording'
            return response
        
        try:
            if self.master_fd is not None:
                try:
                    os.close(self.master_fd)
                    self.master_fd = None
                except:
                    pass
            
            # Send SIGINT to gracefully stop recording (same as Ctrl+C)
            os.killpg(os.getpgid(self.recording_process.pid), signal.SIGINT)
            
            try:
                stdout, stderr = self.recording_process.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(os.getpgid(self.recording_process.pid), signal.SIGKILL)
                self.recording_process.wait()

            bag_path = self.current_bag_path
            self.recording_process = None
            self.current_bag_path = None
            
            # Rename topics in the bag to add _bag suffix
            if self.rename_topics_in_bag(bag_path):
                response.success = True
                response.message = f'Recording stopped and topics renamed: {os.path.basename(bag_path)}'
            else:
                response.success = True
                response.message = f'Recording stopped (warning: topic rename failed): {os.path.basename(bag_path)}'
            
        except Exception as e:
            response.success = False
            response.message = f'Error: {str(e)}'
        
        return response
    
    def pause_resume_callback(self, request, response):
        """Toggle pause/resume recording by sending space character"""
        if self.recording_process is None or self.master_fd is None:
            response.success = False
            response.message = 'Not currently recording'
            return response
        
        try:
            os.write(self.master_fd, b' ')
            
            response.success = True
            response.message = 'Recording pause/resume toggled'
            
        except Exception as e:
            response.success = False
            response.message = f'Error: {str(e)}'
        
        return response
    
    def destroy_node(self):
        """Clean up on shutdown"""
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except:
                pass
        
        if self.recording_process is not None:
            try:
                os.killpg(os.getpgid(self.recording_process.pid), signal.SIGINT)
                self.recording_process.wait(timeout=5)
            except:
                try:
                    os.killpg(os.getpgid(self.recording_process.pid), signal.SIGKILL)
                except:
                    pass
        
        super().destroy_node()


def main(args=None):
    rclpy.init(args=args)
    node = BagRecorderNode()
    
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()