from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node( 
            package='rosbridge_server',
            executable='rosbridge_websocket',
            name='rosbridge_websocket',
            output='screen',
         ),
         Node(
             package="imu_visualizer",
             executable="imu_publisher",
             name="imu_publisher",
             output="screen"
         ),
         Node(
             package="lidar_visualizer",
             executable="lidar_publisher",
             name="lidar_publisher",
             output="screen"
         ),
         Node(
             package="gnss_data",
             executable="gnss_publisher",
             name="gnss_publisher",
             output="screen"
         ),
        Node(
            package="controller_receiver",
            executable="control_receive",
            name="control_receive",
            output="screen"
        ),
        Node(
            package="my_camera_sensor",
            executable="camera_publisher",
            name="camera_publisher",
            output="screen"
        ),
        Node(
            package="vesc_driver",
            executable="vesc_driver_node",
            name="vesc_driver_node",
            parameters=[
                {"port": "/dev/sensors/vesc"},
                {"baud": 115200},
                {"speed_max": 20000.0},
                {"speed_min": -20000.0},
                {"current_max": 100.0},
                {"current_min": 0.0},
                {"brake_max": 200000.0},
                {"brake_min": -20000.0},
                {"servo_max": 1.0},
                {"servo_min": 0.0},
                {"duty_cycle_max": 1.0},
                {"duty_cycle_min": -1.0},
                {"position_max": 0.0},
                {"position_min": 0.0},
                {"enable_imu": False},  # Disable IMU to prevent crash
                {"imu_rate": 50.0}
            ],
            output="screen"
        ),
    ])

