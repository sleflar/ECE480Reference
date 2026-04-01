import rclpy
from rclpy.node import Node
import numpy as np
import math
import time
from sensor_msgs.msg import Imu
from rclpy.qos import QoSProfile, ReliabilityPolicy
import os
# imports for rosbags
from rclpy.serialization import serialize_message
import rosbag2_py


class IMURecorder(Node):
    def __init__(self):
        super().__init__("imu_visualizer")
        self.get_logger().info("IMU Recorder Node Started!")

        qos_profile = QoSProfile(depth=10, reliability=ReliabilityPolicy.BEST_EFFORT)
        self.subscription = self.create_subscription(Imu, "imu/data_raw", self.imu_record, qos_profile)

        self.pitch = 0
        self.roll = 0
        self.yaw = 0

        self.writer = rosbag2_py.SequentialWriter()

        # Set the bag path to the correct folder
        bag_path = os.path.join('/home/vu/rosbag_data/imu_rosbags/', time.strftime("%Y-%b-%d_%H-%M-%S"))
        self.get_logger().info(f"Saving bag to: {bag_path}")

        storage_options= rosbag2_py.StorageOptions(uri = bag_path, storage_id='sqlite3')
        converter_options = rosbag2_py.ConverterOptions('','')
        self.writer.open(storage_options, converter_options)

        topic_info_bagger = rosbag2_py.TopicMetadata(
            name='imu_bagging',
            type='imu/data_raw', 
            serialization_format='cdr')          
        self.writer.create_topic(topic_info_bagger)

    def imu_record(self, msg):
        dt = 0.05

        # Convert from red to deg
        self.pitch += msg.angular_velocity.x * dt * 57.2958
        self.roll += msg.angular_velocity.y * dt * 57.2958
        self.yaw += msg.angular_velocity.z * dt * 57.2958

        # Put the imu data into the rosbag
        self.writer.write('imu_bagging', serialize_message(msg), self.get_clock().now().nanoseconds)

def main(args=None):
    rclpy.init(args=args)
    node = IMURecorder()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == "__main__":
    main()

