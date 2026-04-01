"""
Launch file for rosbridge with test data publisher
This starts both rosbridge and the test publisher for development/testing
"""

from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.substitutions import LaunchConfiguration
from launch.launch_description_sources import PythonLaunchDescriptionSource
from ament_index_python.packages import get_package_share_directory
import os


def generate_launch_description():
    # Get the config file path
    config_file = os.path.join(
        get_package_share_directory('rosbridge_launcher'),
        'config',
        'rosbridge_config.yaml'
    )

    # Get the main rosbridge launch file
    rosbridge_launch = os.path.join(
        get_package_share_directory('rosbridge_launcher'),
        'launch',
        'rosbridge.launch.py'
    )

    # Declare launch arguments
    port_arg = DeclareLaunchArgument(
        'port',
        default_value='9090',
        description='WebSocket server port'
    )

    address_arg = DeclareLaunchArgument(
        'address',
        default_value='0.0.0.0',
        description='WebSocket server address'
    )

    # Include the main rosbridge launch file
    include_rosbridge = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(rosbridge_launch),
        launch_arguments={
            'port': LaunchConfiguration('port'),
            'address': LaunchConfiguration('address'),
        }.items()
    )

    # Test data publisher node
    test_publisher = Node(
        package='rosbridge_launcher',
        executable='rosbridge_test_publisher',
        name='rosbridge_test_publisher',
        output='screen',
        emulate_tty=True,
    )

    return LaunchDescription([
        port_arg,
        address_arg,
        include_rosbridge,
        test_publisher,
    ])
