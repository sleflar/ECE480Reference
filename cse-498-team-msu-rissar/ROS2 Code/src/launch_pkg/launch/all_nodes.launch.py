from launch import LaunchDescription
from launch_ros.actions import Node
from launch.substitutions import PathJoinSubstitution
from launch_ros.substitutions import FindPackageShare
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource

def generate_launch_description():
    car_launch_path = PathJoinSubstitution([
        FindPackageShare('launch_pkg'), 'launch', 'launch_car.launch.py'
    ])

    laptop_launch_path = PathJoinSubstitution([
        FindPackageShare('launch_pkg'), 'launch', 'launch_laptop.launch.py'
    ])

    return LaunchDescription([
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(car_launch_path),
        ),

        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(laptop_launch_path),
        ),
    ])