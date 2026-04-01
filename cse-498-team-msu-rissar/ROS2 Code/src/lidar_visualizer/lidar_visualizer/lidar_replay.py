import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
import matplotlib.pyplot as plt
import numpy as np

from rclpy.serialization import deserialize_message
import rosbag2_py

import sys



class LidarReplay(Node):
    def __init__(self,bagname):
        super().__init__('lidar_replay')

        self.fig, self.ax = plt.subplots(subplot_kw={'projection': 'polar'})
        self.scat = self.ax.scatter([], [], s=5, c=[], cmap='Greys_r', lw=0)
        self.ax.set_rmax(5.0)

        self.lidar_reader = rosbag2_py.SequentialReader()

        storage_options= rosbag2_py.StorageOptions(
            uri = 'output_lidar_bagging/' + bagname,
            storage_id='sqlite3'
        )

        converter_options = rosbag2_py.ConverterOptions('','')
        self.lidar_reader.open(storage_options, converter_options)

        self.timer = self.create_timer(0.1, self.replay_scan)


    def replay_scan(self):
        while self.lidar_reader.has_next():
            msg = self.lidar_reader.read_next()

            if msg[0] == 'lidar_bagging':
                deserialized = deserialize_message(msg[1], LaserScan)

                angles = np.linspace(deserialized.angle_min, deserialized.angle_max, len(deserialized.ranges))
                ranges = np.array(deserialized.ranges)

                self.scat.set_offsets(np.c_[angles, ranges])
                self.scat.set_array(np.array(ranges))
                plt.draw()
                plt.pause(0.01)



    

def main(args=None):
    if len(sys.argv) != 2:
        print("please provide a single folder name (relative to output_lidar_bagging/ )")
    else:
        rclpy.init(args=args)
        node = LidarReplay(sys.argv[1])
        try:
            rclpy.spin(node)
        except KeyboardInterrupt:
            pass
        finally:
            node.destroy_node()
            rclpy.shutdown()

if __name__ == '__main__':
    main()