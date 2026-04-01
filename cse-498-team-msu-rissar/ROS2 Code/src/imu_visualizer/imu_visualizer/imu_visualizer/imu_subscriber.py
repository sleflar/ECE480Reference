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
# imports for rosbags
import rosbag2_py


class IMUVisualizer(Node):
    def __init__(self):
        super().__init__("imu_visualizer")
        self.get_logger().info("IMU Visualizer Node Started!")

        qos_profile = QoSProfile(depth=10, reliability=ReliabilityPolicy.BEST_EFFORT)
        self.subscription = self.create_subscription(Imu, "imu/data_raw", self.imu_graph, qos_profile)

        plt.ion()  
        self.fig = plt.figure()
        self.ax = self.fig.add_subplot(111, projection='3d')

        self.x, self.y, self.z = self.create_cylinder(radius=1, height=3)
        points = np.array([self.x.flatten(), self.y.flatten(), self.z.flatten()]).T
        self.x, self.y, self.z = points[:, 0].reshape(self.x.shape), points[:, 1].reshape(self.y.shape), points[:, 2].reshape(self.z.shape)

        self.pitch = 0
        self.roll = 0
        self.yaw = 0

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

    def imu_graph(self, msg):
        dt = 0.05

        # Convert from red to deg
        self.pitch += msg.angular_velocity.x * dt * 57.2958
        self.roll += msg.angular_velocity.y * dt * 57.2958
        self.yaw += msg.angular_velocity.z * dt * 57.2958

        self.get_logger().info(f"IMU data received")

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

def main(args=None):
    rclpy.init(args=args)
    node = IMUVisualizer()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == "__main__":
    main()


