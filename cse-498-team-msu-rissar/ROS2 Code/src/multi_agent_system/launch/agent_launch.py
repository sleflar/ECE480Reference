from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

"""
Launch file for individual agents
"""
def generate_launch_description():

    # Variables that will be configured at launch time
    agent_name = LaunchConfiguration('agent_name')
    agent_namespace = LaunchConfiguration('agent_namespace')
    behavior = LaunchConfiguration('behavior')

    return LaunchDescription([
        # Set default for variables set at launch time
        DeclareLaunchArgument('agent_name', default_value='agent1'),
        DeclareLaunchArgument('agent_namespace', default_value='agent1_ns'),
        DeclareLaunchArgument('behavior', default_value='hello'),
        # Launches the agent with variables 
        Node(
            package='multi_agent_system',
            executable='agent',
            namespace=agent_namespace, # allows use of multiple agents at once
            name=agent_name,
            parameters=[{'agent_name': agent_name, 'behavior': behavior}]
        )
    ])