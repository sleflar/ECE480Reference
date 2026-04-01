import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Joy
from std_msgs.msg import Float64, String, Int32
from std_srvs.srv import SetBool
from rclpy.qos import QoSProfile, QoSReliabilityPolicy, QoSHistoryPolicy
import time
import enum


class ControlMode(enum.Enum):
    SLOWEST = 0
    SLOWER = 1
    SLOW = 2
    NORMAL = 3
    FAST = 4
    FULL = 5


# Global variable to set the amount of time the car will wait for a command before auto-braking
MAX_TIMEOUT = 0.5 


class ControllerReceiver(Node):
    def __init__(self):
        super().__init__('controller_receiver')

        # Auto braking parameters
        self.auto_brake_enabled = True
        self.front_distance = 0.0 
        self.obstacle_stop_distance = 0.2
        self.obstacle_too_close = False

        # Subscribe to playback status to automatically detect when replay starts/stops
        self.playback_status_subscriber = self.create_subscription(
            String,
            '/rosbag2_player/status',
            self.playback_status_callback,
            10
        )

        self.playing_recording = False
        self.controller_enabled = True  # New: Track if controller is enabled

        # Create service to enable/disable controller
        self.enable_service = self.create_service(
            SetBool,
            'joy_node/enable',
            self.enable_callback
        )

        # Subscribe to the controller_data topic
        self.subscription = self.create_subscription(
            Joy,
            '/joy',
            self.listener_callback,
            10
        )

        # Subscribe to set_speed_mode topic
        self.speed_mode_subscriber = self.create_subscription(
            Int32,
            'set_speed_mode',
            self.set_speed_mode_callback,
            10
        )

        self.bag_topic_namespace = '/car1_ns/'
        bag_suffix = '_bag'

        self.duty_cycle_subscriber = self.create_subscription(
            Float64,
            f'{self.bag_topic_namespace}commands/motor/duty_cycle{bag_suffix}',
            self.duty_cycle_loopback,
            10
        )

        self.steering_subscriber = self.create_subscription(
            Float64,
            f'{self.bag_topic_namespace}commands/servo/position{bag_suffix}',
            self.steering_loopback,
            10
        )

        self.brake_subscriber = self.create_subscription(
            Float64,
            f'{self.bag_topic_namespace}commands/motor/brake{bag_suffix}',
            self.brake_loopback,
            10
        )

        sensor_qos = QoSProfile(reliability=QoSReliabilityPolicy.BEST_EFFORT,
                                history=QoSHistoryPolicy.KEEP_LAST,
                                depth=1)

        self.depth_subscriber = self.create_subscription(
            Float64,
            f'{self.bag_topic_namespace}sensors/depth_sensor/distance',
            self.depth_callback,
            sensor_qos
        )

        # Publisher for duty cycle (used for forward and reverse)
        self.duty_cycle_publisher = self.create_publisher(Float64, 'commands/motor/duty_cycle', 10)

        # Publisher for steering angle
        self.steering_publisher = self.create_publisher(Float64, 'commands/servo/position', 10)

        # Publisher for braking
        self.brake_publisher = self.create_publisher(Float64, 'commands/motor/brake', 10)



        # Smoothing variables
        self.smoothed_steering = 0.0
        self.smoothed_throttle = 0.0
        self.smoothed_brake = 0.0
        self.smoothing_factor = 0.5

        self.current_mode = ControlMode.SLOWEST
        self.speed_multipliers = {
            ControlMode.SLOWEST: 0.05,
            ControlMode.SLOWER: 0.15,
            ControlMode.SLOW: 0.25,
            ControlMode.NORMAL: 0.45,
            ControlMode.FAST: 0.65,
            ControlMode.FULL: 0.95,
        }

        self.last_button_states = []

        # Set the max timeout time
        self.last_received_time = time.time()
        self.timeout_seconds = MAX_TIMEOUT

        # Track if we're actively receiving input
        self.is_actively_controlled = False

        # Create a timer to check for timeout
        self.timer = self.create_timer(MAX_TIMEOUT, self.check_timeout)
        self.get_logger().info("Controller Receiver Node Started")

    def enable_callback(self, request, response):
        """
        Service callback to enable or disable the controller.
        Similar to how playback status disables the controller.
        """
        self.controller_enabled = request.data
        
        if self.controller_enabled:
            response.success = True
            response.message = "Controller enabled"
            self.get_logger().info("Controller enabled via service")
        else:
            response.success = True
            response.message = "Controller disabled"
            self.get_logger().info("Controller disabled via service")
            
            # When disabled, stop the car
            duty_cycle = Float64()
            duty_cycle.data = 0.0
            self.duty_cycle_publisher.publish(duty_cycle)
        
        return response

    def enable_callback(self, request, response):
        """
        Service callback to enable or disable the controller.
        Similar to how playback status disables the controller.
        """
        self.controller_enabled = request.data
        
        if self.controller_enabled:
            response.success = True
            response.message = "Controller enabled"
            self.get_logger().info("Controller enabled via service")
        else:
            response.success = True
            response.message = "Controller disabled"
            self.get_logger().info("Controller disabled via service")
            
            # When disabled, stop the car
            duty_cycle = Float64()
            duty_cycle.data = 0.0
            self.duty_cycle_publisher.publish(duty_cycle)
        
        return response

    def playback_status_callback(self, msg):
        """
        Callback for playback status messages.
        Automatically enables/disables controller based on playback state.
        """
        status = msg.data
        
        if status == 'playing':
            if not self.playing_recording:
                self.playing_recording = True
        elif status in ['stopped', 'finished']:
            if self.playing_recording:
                self.playing_recording = False

    def increment_speed_mode(self):
        """Increment the speed mode"""
        current_value = self.current_mode.value
        
        next_value = current_value + 1 if current_value < ControlMode.FULL.value else ControlMode.FULL.value
        self.current_mode = ControlMode(next_value)

        self.get_logger().info(f"Speed mode set to: {self.current_mode.name}: speed multiplier {self.speed_multipliers[self.current_mode]}")

    def decrement_speed_mode(self):
        """Decrement the speed mode"""
        current_value = self.current_mode.value
        
        next_value = current_value - 1 if current_value > ControlMode.SLOWEST.value else ControlMode.SLOWEST.value
        self.current_mode = ControlMode(next_value)

        self.get_logger().info(f"Speed mode set to: {self.current_mode.name}: speed multiplier {self.speed_multipliers[self.current_mode]}")

    def set_speed_mode_callback(self, msg):
        """Callback to set speed mode directly from an index"""
        try:
            new_mode_index = msg.data
            if ControlMode.SLOWEST.value <= new_mode_index <= ControlMode.FULL.value:
                self.current_mode = ControlMode(new_mode_index)
                self.get_logger().info(f"Speed mode set to: {self.current_mode.name}: speed multiplier {self.speed_multipliers[self.current_mode]}")
            else:
                self.get_logger().warn(f"Invalid speed mode index received: {new_mode_index}")
        except ValueError:
            self.get_logger().error(f"Error setting speed mode: {msg.data}")

    def apply_smoothing(self, current_value, target_value):
        """Apply exponential smoothing to values"""
        return current_value + (target_value - current_value) * self.smoothing_factor

    def apply_emergency_brake(self):
        """Immediately stop the car."""
        duty_cycle = Float64()
        duty_cycle.data = 0.0
        self.duty_cycle_publisher.publish(duty_cycle)

        brake_msg = Float64()
        brake_msg.data = 20000.0
        self.brake_publisher.publish(brake_msg)

        self.is_actively_controlled = False


    def depth_callback(self, msg):
        """Receive front obstacle distance in meters."""
        self.front_distance = msg.data

        if self.front_distance <= 0.0:
            self.get_logger().warn("Invalid front distance reading (<= 0.0m); ignoring.") 
            return

        self.obstacle_too_close = self.front_distance < self.obstacle_stop_distance

        if self.obstacle_too_close:
            self.get_logger().info(f"{self.obstacle_stop_distance}, {self.front_distance}, {self.obstacle_too_close}")

    def listener_callback(self, msg):
        """Callback function for when a Joy message is received from the controller subscriber"""
        # Check if controller is disabled (similar to playing_recording check)
        if not self.controller_enabled:
            return
            
        if self.playing_recording:
            return

        self.last_received_time = time.time()

        # Extract raw values from Joy message
        # axes[0] = steering (-1 to 1)
        # axes[2] = brake (-1 to 1, where 1 is not pressed, -1 is fully pressed)
        # axes[5] = throttle (-1 to 1, where 1 is fully pressed, -1 is not pressed)
        
        raw_steering = msg.axes[0] if len(msg.axes) > 0 else 0.0
        raw_brake = msg.axes[2] if len(msg.axes) > 2 else 1.0  # Default full brake
        raw_throttle = msg.axes[5] if len(msg.axes) > 5 else 0.0  # Default not pressed


        steering_deadzone = 0.01
        if abs(raw_steering) < steering_deadzone:
            raw_steering = 0.0

        # Apply smoothing
        self.smoothed_steering = self.apply_smoothing(self.smoothed_steering, raw_steering)
        self.smoothed_throttle = self.apply_smoothing(self.smoothed_throttle, raw_throttle)
        self.smoothed_brake = self.apply_smoothing(self.smoothed_brake, raw_brake)

        # Convert steering from [-1, 1] to [0, 1] for servo
        steering_msg = Float64()
        steering_msg.data = (self.smoothed_steering + 1.0) / 2.0
        self.steering_publisher.publish(steering_msg)


        # Button logic to determine control mode
        buttons = msg.buttons
        if len(buttons) > 0:
            button_A = buttons[0] and self.last_button_states and not self.last_button_states[0]
            button_B = buttons[1] and self.last_button_states and not self.last_button_states[1]
            button_XY = buttons[2] and buttons[3] and self.last_button_states and not (self.last_button_states[2] or self.last_button_states[3])

            if button_A:
                self.increment_speed_mode()
            elif button_B:
                self.decrement_speed_mode()
            elif button_XY:
                self.auto_brake_enabled = not self.auto_brake_enabled
                self.get_logger().info(f"Auto brake enabled: {self.auto_brake_enabled}")

        self.last_button_states = buttons

        # Determine control mode based on smoothed values
        throttle_threshold = 0.05
        brake_threshold = 0.05

        # Convert throttle from [-1, 1] to [0, 1]
        # -1 = not pressed (0), 1 = fully pressed (1)
        throttle_normalized = (self.smoothed_throttle + 1.0) / 2.0
        
        # Convert brake from [-1, 1] to [0, 1]
        # 1 = not pressed (0), 1 = fully pressed (1)
        brake_normalized = (self.smoothed_brake + 1.0) / 2.0

        # Check if user is actively controlling (not at neutral position)
        self.is_actively_controlled = (
            abs(raw_steering) > 0.01 or 
            throttle_normalized > 0.01 or 
            brake_normalized > 0.01
        )
        if self.auto_brake_enabled:  
            if self.current_mode  == ControlMode.SLOWEST:
                self.obstacle_stop_distance = 0.6
            elif self.current_mode  == ControlMode.SLOWER:
                self.obstacle_stop_distance = 1.2
            elif self.current_mode  == ControlMode.SLOW: 
                self.obstacle_stop_distance = 2.4
            elif self.current_mode  == ControlMode.NORMAL:
                self.obstacle_stop_distance = 4.8
            elif self.current_mode  == ControlMode.FAST:
                self.obstacle_stop_distance = 9.6
            elif self.current_mode  == ControlMode.FULL:
                self.obstacle_stop_distance = -1.0 # Disable obstacle detection
        else:
            self.obstacle_stop_distance = -1.0 # Disable obstacle detection
        
        if brake_normalized > brake_threshold:
            # Reverse motion (left trigger or pulling back virtual joystick)
            duty_cycle = Float64()
            duty_cycle.data = -0.05 - brake_normalized * 0.05
            self.duty_cycle_publisher.publish(duty_cycle)

        elif throttle_normalized > throttle_threshold:
            # Forward motion
            if self.obstacle_too_close:
                # Apply emergency brake
                self.apply_emergency_brake()
                self.get_logger().warn(" *** Too Close! Applying brake *** ")
                return
            else:
                # Go forward
                duty_cycle = Float64()
                duty_cycle.data = 0.05 + throttle_normalized * self.speed_multipliers[self.current_mode]
                self.duty_cycle_publisher.publish(duty_cycle)

        else:
            # Neutral - apply light brake only if not actively controlled
            if not self.is_actively_controlled and not self.obstacle_too_close:
                brake_msg = Float64()
                brake_msg.data = 5000.0
                self.brake_publisher.publish(brake_msg)
            else:
                # User is holding at neutral, publish zero duty cycle
                duty_cycle = Float64()
                duty_cycle.data = 0.0
                self.duty_cycle_publisher.publish(duty_cycle)

    def check_timeout(self):
        """Checks if it has been over self.timeout_seconds time since the last command was received"""
        # Don't apply timeout brake if controller is disabled
        if not self.controller_enabled:
            return
            
        if time.time() - self.last_received_time > self.timeout_seconds:
            self.apply_emergency_brake()
            self.get_logger().warn("Connection lost: Applying brake")

    def duty_cycle_loopback(self, msg):
        self.duty_cycle_publisher.publish(msg)

    def steering_loopback(self, msg):
        self.steering_publisher.publish(msg)

    def brake_loopback(self, msg):
        self.brake_publisher.publish(msg)

def main(args=None): 
    rclpy.init(args=args)
    node = ControllerReceiver()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        node.get_logger().info("Shutting down due to keyboard interrupt")
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()