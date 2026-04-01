import rclpy
from rclpy.node import Node
import numpy as np
import math
import time
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from sensor_msgs.msg import Imu
from rclpy.qos import QoSProfile, ReliabilityPolicy
import os

from rclpy.serialization import deserialize_message
import rosbag2_py

import sys



class imuReplay(Node):
    def __init__(self,bagname):
        super().__init__('imu_replay')
        
        plt.ion()  
        self.fig = plt.figure()
        self.ax = self.fig.add_subplot(111, projection='3d')

        self.imu_reader = rosbag2_py.SequentialReader()

        storage_options= rosbag2_py.StorageOptions(
            uri = os.path.join('/home/vu/rosbag_data/imu_rosbags/', bagname),
            storage_id='sqlite3'
        )

        converter_options = rosbag2_py.ConverterOptions('','')
        self.imu_reader.open(storage_options, converter_options)

        self.timer = self.create_timer(0.1, self.replay_imu)
        
        self.x, self.y, self.z = self.create_cylinder(radius=1, height=3)
        points = np.array([self.x.flatten(), self.y.flatten(), self.z.flatten()]).T
        self.x, self.y, self.z = points[:, 0].reshape(self.x.shape), points[:, 1].reshape(self.y.shape), points[:, 2].reshape(self.z.shape)

        self.pitch = 0
        self.yaw = 0
        self.roll = 0


    # identical code snippet to one in the subscriber node
    # may change so as to reduce redundancy
    def create_cylinder(self, radius=1, height=3, resolution=30):
        z = np.linspace(-height / 2, height / 2, 20)
        theta = np.linspace(0, 2 * np.pi, resolution)
        theta_grid, z_grid = np.meshgrid(theta, z)
        x = radius * np.cos(theta_grid)
        y = radius * np.sin(theta_grid)
        return x, y, z_grid

    def rotate(self, points, pitch, roll, yaw):
        pitch, roll, yaw = np.radians([pitch, roll, yaw])
        Rx = np.array([[1, 0, 0], [0, np.cos(pitch), -np.sin(pitch)], [0, np.sin(pitch), np.cos(pitch)]])
        Ry = np.array([[np.cos(roll), 0, np.sin(roll)], [0, 1, 0], [-np.sin(roll), 0, np.cos(roll)]])
        Rz = np.array([[np.cos(yaw), -np.sin(yaw), 0], [np.sin(yaw), np.cos(yaw), 0], [0, 0, 1]])
        R = Rz @ Ry @ Rx
        return np.dot(points, R.T)
    # end identical code

    def replay_imu(self):
        while self.imu_reader.has_next():
            msg = self.imu_reader.read_next()

            if msg[0] == 'imu_bagging':
                deserialized = deserialize_message(msg[1], Imu)

                #also mostly identical
                dt = 0.05

                self.pitch += deserialized.angular_velocity.x * dt * 57.2958
                self.roll += deserialized.angular_velocity.y * dt * 57.2958
                self.yaw += deserialized.angular_velocity.z * dt * 57.2958

                self.get_logger().info(f"IMU data unbagged")

                points = np.array([self.x.flatten(), self.y.flatten(), self.z.flatten()]).T
                rotated_points = self.rotate(points, self.pitch, self.roll, self.yaw)
                x_rot, y_rot, z_rot = rotated_points[:, 0], rotated_points[:, 1], rotated_points[:, 2]
                x_rot = x_rot.reshape(self.x.shape)
                y_rot = y_rot.reshape(self.y.shape)
                z_rot = z_rot.reshape(self.z.shape)

                self.ax.cla()
                self.ax.plot_surface(x_rot, y_rot, z_rot, color='cyan', alpha=0.6, edgecolor='black')

                self.ax.set_xlim(-3, 3)
                self.ax.set_ylim(-3, 3)
                self.ax.set_zlim(-3, 3)
                self.ax.set_xlabel("X")
                self.ax.set_ylabel("Y")
                self.ax.set_zlabel("Z")
                self.ax.set_title("IMU Visualization")

                self.fig.canvas.draw()

                self.fig.canvas.flush_events()
                #end also mostly identical



    

def main(args=None):
    if len(sys.argv) != 2:
        print("please provide a single folder name (relative to /home/vu/rosbag_data/imu_rosbags/ )")
    else:
        rclpy.init(args=args)
        node = imuReplay(sys.argv[1])
        try:
            rclpy.spin(node)
        except KeyboardInterrupt:
            pass
        finally:
            node.destroy_node()
            rclpy.shutdown()

if __name__ == '__main__':
    main()
