"""
Launch file for rosbridge WebSocket server with RISSAR sensor nodes
This starts the rosbridge_websocket node for real-time web communication
"""

from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from ament_index_python.packages import get_package_share_directory
import os


def generate_launch_description():
    # Get the config file path
    config_file = os.path.join(
        get_package_share_directory('rosbridge_launcher'),
        'config',
        'rosbridge_config.yaml'
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

    # rosbridge WebSocket server node
    rosbridge_websocket = Node(
        package='rosbridge_server',
        executable='rosbridge_websocket',
        name='rosbridge_websocket',
        parameters=[
            config_file,
            {
                'port': LaunchConfiguration('port'),
                'address': LaunchConfiguration('address'),
            }
        ],
        output='screen',
        emulate_tty=True,
    )

    # rosapi node (provides service/topic introspection)
    rosapi_node = Node(
        package='rosapi',
        executable='rosapi_node',
        name='rosapi',
        parameters=[config_file],
        output='screen',
        emulate_tty=True,
    )

    return LaunchDescription([
        port_arg,
        address_arg,
        rosbridge_websocket,
        rosapi_node,
    ])
