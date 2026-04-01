from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare

"""
Launch file to launch 2 agents, 1 hello, 1 goodbye at once
"""
def generate_launch_description():
    # Variables that will be set at launch time
    agent1_name = LaunchConfiguration('agent1_name')
    agent2_name = LaunchConfiguration('agent2_name')
    agent1_namespace = LaunchConfiguration('agent1_namespace')
    agent2_namespace = LaunchConfiguration('agent2_namespace')
    agent1_behavior = LaunchConfiguration('agent1_behavior')
    agent2_behavior = LaunchConfiguration('agent2_behavior')

    # Finds other launch file used
    agent_launch_path = PathJoinSubstitution([
        FindPackageShare('multi_agent_system'), 'launch', 'agent_launch.py'
    ])

    return LaunchDescription([
        # Declares the default values for the variables set at launch time
        DeclareLaunchArgument('agent1_name', default_value='agent1'),
        DeclareLaunchArgument('agent2_name', default_value='agent2'),
        DeclareLaunchArgument('agent1_namespace', default_value='agent1_ns'),
        DeclareLaunchArgument('agent2_namespace', default_value='agent2_ns'),
        DeclareLaunchArgument('agent1_behavior', default_value='hello'),
        DeclareLaunchArgument('agent2_behavior', default_value='goodbye'),

        # Sets up the coordinator node
        Node(
            package='multi_agent_system',
            executable='coordinator',
            name='coordinator',
        ),

        # Calls the launch file for agents, passes necessary variables to it
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(agent_launch_path),
            launch_arguments={
                'agent_name': agent1_name,
                'agent_namespace': agent1_namespace,
                'behavior': agent1_behavior
            }.items()
        ),

        # Same as above for agent 2
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(agent_launch_path),
            launch_arguments={
                'agent_name': agent2_name,
                'agent_namespace': agent2_namespace,
                'behavior': agent2_behavior
            }.items()
        ),
    ])