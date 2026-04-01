#!/usr/bin/env python3
"""
Test script to verify rosbridge WebSocket connection
Publishes test data that can be viewed in the frontend
"""

import rclpy
from rclpy.node import Node
from std_msgs.msg import Float32, String
import math


class RosbridgeTestPublisher(Node):
    """Test node that publishes data to verify rosbridge connection"""

    def __init__(self):
        super().__init__('rosbridge_test_publisher')
        
        # Create publishers for test topics
        self.speed_pub = self.create_publisher(Float32, '/vehicle/speed', 10)
        self.steering_pub = self.create_publisher(Float32, '/vehicle/steering_angle', 10)
        self.status_pub = self.create_publisher(String, '/vehicle/status', 10)
        
        # Create timers
        self.speed_timer = self.create_timer(0.1, self.publish_speed)
        self.steering_timer = self.create_timer(0.05, self.publish_steering)
        self.status_timer = self.create_timer(1.0, self.publish_status)
        
        self.counter = 0
        self.get_logger().info('Rosbridge test publisher started')
        self.get_logger().info('Publishing test data to:')
        self.get_logger().info('  - /vehicle/speed (Float32)')
        self.get_logger().info('  - /vehicle/steering_angle (Float32)')
        self.get_logger().info('  - /vehicle/status (String)')

    def publish_speed(self):
        """Publish simulated speed data (sine wave)"""
        msg = Float32()
        # Simulate speed between 0 and 30 m/s
        msg.data = 15.0 + 15.0 * math.sin(self.counter * 0.01)
        self.speed_pub.publish(msg)

    def publish_steering(self):
        """Publish simulated steering angle data"""
        msg = Float32()
        # Simulate steering angle between -30 and 30 degrees
        msg.data = 30.0 * math.sin(self.counter * 0.02)
        self.steering_pub.publish(msg)

    def publish_status(self):
        """Publish status messages"""
        msg = String()
        states = ['Connected', 'Ready', 'Running', 'Testing']
        msg.data = f'{states[self.counter % len(states)]} - Counter: {self.counter}'
        self.status_pub.publish(msg)
        self.get_logger().info(f'Status: {msg.data}')
        self.counter += 1


def main(args=None):
    rclpy.init(args=args)
    node = RosbridgeTestPublisher()
    
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
