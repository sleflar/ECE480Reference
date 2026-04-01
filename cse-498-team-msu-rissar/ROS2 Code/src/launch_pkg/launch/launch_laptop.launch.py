#!/usr/bin/env python3
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration


def generate_launch_description():
    # Declare launch arguments
    output_dir_arg = DeclareLaunchArgument(
        'output_dir',
        default_value='replays/recorded',
        description='Directory to save recorded bag files'
    )
    
    bag_directory_arg = DeclareLaunchArgument(
        'bag_directory',
        default_value='replays',
        description='Directory to search for bag files to play'
    )
    
    playback_rate_arg = DeclareLaunchArgument(
        'playback_rate',
        default_value='1.0',
        description='Playback rate for bag files'
    )

    return LaunchDescription([
        # Launch arguments
        output_dir_arg,
        bag_directory_arg,
        playback_rate_arg,

        # IMU Subscriber
        Node(
            package='imu_visualizer',
            executable='imu_subscriber',
            name='imu_subscriber',
            output='screen'
        ),

        # LiDAR Subscriber
        Node(
            package='lidar_visualizer',
            executable='lidar_subscriber',
            name='lidar_subscriber',
            output='screen'
        ),

        # GNSS Subscriber
        Node(
            package='gnss_data',
            executable='gnss_subscriber',
            name='gnss_subscriber',
            output='screen'
        ),

        # Camera Subscriber (commented out)
        # Node(
        #     package='my_camera_sensor',
        #     executable='camera_subscriber',
        #     name='camera_subscriber',
        #     output='screen'
        # ),

        # Controller Publisher
        Node(
            package='controller_publisher',
            executable='control_publish',
            name='control_publish',
            output='screen'
        ),

        # Bag Recorder Node (records ALL topics with -a flag)
        Node(
            package='recorder_node',
            executable='bag_recorder_node',
            name='bag_recorder_node',
            output='screen',
            parameters=[
                {'output_dir': LaunchConfiguration('output_dir')},
                {'compression_mode': 'file'},
            ]
        ),

        # Bag Player Node
        Node(
            package='recorder_node',
            executable='bag_player_node',
            name='bag_player_node',
            output='screen',
            parameters=[
                {'bag_directory': LaunchConfiguration('bag_directory')},
                {'playback_rate': LaunchConfiguration('playback_rate')},
                {'loop': False},
            ]
        ),
    ])