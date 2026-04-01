from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():

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

    car_name = LaunchConfiguration('car_name')
    car_namespace = LaunchConfiguration('car_namespace')
    car_port = LaunchConfiguration('car_port')
    baud = LaunchConfiguration('baud')
    speed_max = LaunchConfiguration('speed_max')
    duty_cycle_max = LaunchConfiguration('duty_cycle_max')
    duty_cycle_min = LaunchConfiguration('duty_cycle_min')
    servo_max = LaunchConfiguration('servo_max')
    servo_min = LaunchConfiguration('servo_min')
    brake_min = LaunchConfiguration('brake_min')
    brake_max = LaunchConfiguration('brake_max')
    enable_imu = LaunchConfiguration('enable_imu')
    imu_rate = LaunchConfiguration('imu_rate')


    return LaunchDescription([

        output_dir_arg,
        bag_directory_arg,
        playback_rate_arg,

        DeclareLaunchArgument('car_name', default_value='Car1'),
        DeclareLaunchArgument('car_namespace', default_value='car1_ns'),
        DeclareLaunchArgument('car_port', default_value='/dev/sensors/vesc'),
        DeclareLaunchArgument('baud', default_value='115200'),
        DeclareLaunchArgument('speed_max', default_value='8000.0'),
        DeclareLaunchArgument('duty_cycle_max', default_value='1.0'),
        DeclareLaunchArgument('duty_cycle_min', default_value='-1.0'),
        DeclareLaunchArgument('servo_max', default_value='1.0'),
        DeclareLaunchArgument('servo_min', default_value='0.0'),
        DeclareLaunchArgument('brake_min', default_value='0.0'),
        DeclareLaunchArgument('brake_max', default_value='20000.0'),
        DeclareLaunchArgument('enable_imu', default_value='True'),
        DeclareLaunchArgument('imu_rate', default_value='50.0'),

        Node( 
            package='rosbridge_server',
            executable='rosbridge_websocket',
            name='rosbridge_websocket',
            output='screen',
            parameters=[{
                'port': 9090,                       # These are to suppress rosbridge warnings
                'default_call_service_timeout': 5.0,  # 5 second timeout for service calls
                'call_services_in_new_thread': True,  # Non-blocking service calls
                'send_action_goals_in_new_thread': True,  # Non-blocking action goals
            }],
        ),
        Node(
            package='gnss_data',
            executable='gnss_publisher',
            namespace=car_namespace,
            name='gnss_publisher',
            output='screen'
        ),

        Node(
            package='lidar_visualizer',
            executable='lidar_publisher',
            namespace=car_namespace,
            name='lidar_publisher',
            output='screen'
        ),

        # Node(
        #     package='livox_ros_driver2',
        #     executable='livox_ros_driver2_node',
        #     namespace=car_namespace,
        #     name='livox_lidar',
        #     output='screen',
        #     parameters=[{
        #         'user_config_path':'/home/user/ros2_ws/src/livox_ros_driver2/config/MID360_config.json'
        #     }]
        # ),



        Node(
            package='my_camera_sensor',
            executable='camera_publisher',
            namespace=car_namespace,
            name='camera_publisher',
            output='screen'
        ),
        # Node(
        #     package='my_depth_sensor',
        #     executable='depth_publisher',
        #     namespace=car_namespace,
        #     name='depth_publisher',
        #     output='screen'
        # # ),
        Node(
            package='controller_receiver',
            executable='controller_receiver',
            namespace=car_namespace,
            name='controller_receiver',
            output='screen'
        ),

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

        Node(
            package='vesc_driver',
            executable='vesc_driver_node',
            namespace=car_namespace,
            name='vesc_driver_node',
            parameters=[{
                'port': "/dev/sensors/vesc",
                'baud': baud,
                'speed_max': speed_max,
                'duty_cycle_max': duty_cycle_max,
                'duty_cycle_min': duty_cycle_min,
                'servo_max': servo_max,
                'servo_min': servo_min,
                'brake_min': brake_min,
                'brake_max': brake_max,
                'enable_imu': enable_imu,
                'imu_rate': imu_rate
            }],
            output='screen'
        ),
    ])