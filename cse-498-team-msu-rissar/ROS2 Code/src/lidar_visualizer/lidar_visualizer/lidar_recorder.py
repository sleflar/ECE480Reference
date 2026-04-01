import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
import numpy as np

from rclpy.serialization import serialize_message
import rosbag2_py

import time

class LidarRecorder(Node):
    def __init__(self):
        super().__init__('lidar_subscriber')
        self.subscription = self.create_subscription(LaserScan, 'scan', self.lidar_record, 10)
        self.writer = rosbag2_py.SequentialWriter()


        storage_options= rosbag2_py.StorageOptions(
            uri = 'output_lidar_bagging/' + time.strftime("%Y_%b_%d-%H_%M_%S"), #str(self.get_clock().now().nanoseconds)
            storage_id='sqlite3'
        )
        converter_options = rosbag2_py.ConverterOptions('','')
        self.writer.open(storage_options, converter_options)

        topic_info_bagger = rosbag2_py.TopicMetadata(
            name='lidar_bagging',
            type='sensor_msgs/msg/LaserScan', 
            serialization_format='cdr')          
        self.writer.create_topic(topic_info_bagger)


    def lidar_record(self, msg):
        # bag the data for later (done here because otherwise the bag's on the car, less retrievable)
        self.writer.write('lidar_bagging', serialize_message(msg), self.get_clock().now().nanoseconds)



def main(args=None):
    rclpy.init(args=args)
    node = LidarRecorder()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()

