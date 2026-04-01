from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package="imu_visualizer",
            executable="imu_subscriber",
            name="imu_publisher",
            output="screen"
        ),
        Node(
            package="lidar_visualizer",
            executable="lidar_subscriber",
            name="lidar_publisher",
            output="screen"
        ),
        Node(
            package="gnss_data",
            executable="gnss_subscriber",
            name="gnss_publisher",
            output="screen"
        ),
        Node(
            package="my_camera_sensor",
            executable="camera_subscriber",
            name="camera_subscriber",
            output="screen"
        ),
        Node(
            package="controller_publisher",
            executable="control_publish",
            name="control_receive",
            output="screen"
        ),
    ])
