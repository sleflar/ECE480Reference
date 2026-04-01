#!/usr/bin/env python3

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import json


class MultiAgentDemo(Node):
    def __init__(self):
        super().__init__('multi_agent_demo')
        
        # Subscribe to communication topics to monitor
        self.hello_subscriber = self.create_subscription(
            String,
            '/agent_hello',
            self.monitor_hello,
            10
        )
        
        self.response_subscriber = self.create_subscription(
            String,
            '/coordinator_response',
            self.monitor_response,
            10
        )
        
        self.get_logger().info('Demo monitor started - watching communication')
    
    def monitor_hello(self, msg):
        # Parse agent hello message
        try:
            data = json.loads(msg.data)
            agent_name = data.get('name', 'Unknown')
            self.get_logger().info(f'Agent {agent_name} said hello')
        except:
            self.get_logger().info(f'Got hello: {msg.data}')
    
    def monitor_response(self, msg):
        # Parse coordinator response
        try:
            data = json.loads(msg.data)
            to_agent = data.get('to', 'Unknown')
            self.get_logger().info(f'Coordinator responded to {to_agent}')
        except:
            self.get_logger().info(f'Got response: {msg.data}')


def main(args=None):
    rclpy.init(args=args)
    demo = MultiAgentDemo()
    
    try:
        rclpy.spin(demo)
    except KeyboardInterrupt:
        pass
    finally:
        demo.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()