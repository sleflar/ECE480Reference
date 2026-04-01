from launch import LaunchDescription
from launch_ros.actions import Node
from launch.substitutions import PathJoinSubstitution, LaunchConfiguration
from launch_ros.substitutions import FindPackageShare
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument
from launch.launch_description_sources import PythonLaunchDescriptionSource

def generate_launch_description():
    car_launch_path = PathJoinSubstitution([
        FindPackageShare('launch_pkg'), 'launch', 'launch_car.launch.py'
    ])

    laptop_launch_path = PathJoinSubstitution([
        FindPackageShare('launch_pkg'), 'launch', 'launch_laptop.launch.py'
    ])

    car1_name = LaunchConfiguration('car1_name')
    car1_namespace = LaunchConfiguration('car1_namespace')
    car2_name = LaunchConfiguration('car2_name')
    car2_namespace = LaunchConfiguration('car2_namespace')

    return LaunchDescription([
        DeclareLaunchArgument('car1_name', default_value='Car1'),
        DeclareLaunchArgument('car1_namespace', default_value='car1_ns'),
        DeclareLaunchArgument('car2_name', default_value='Car2'),
        DeclareLaunchArgument('car2_namespace', default_value='car2_ns'),


        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(car_launch_path),
            launch_arguments={
                'car_name': car1_name,
                'car_namespace': car1_namespace,
                'car_port': '/dev/ttyACM0',
            }.items()
        ),

        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(car_launch_path),
            launch_arguments={
                'car_name': car2_name,
                'car_namespace': car2_namespace,
                'car_port': '/dev/ttyACM1',
            }.items()
        ),
    ])