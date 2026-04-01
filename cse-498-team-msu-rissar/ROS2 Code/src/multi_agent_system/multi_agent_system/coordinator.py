#!/usr/bin/env python3

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import json


class MultiAgentCoordinator(Node):
    def __init__(self):
        super().__init__('multi_agent_coordinator')
        
        # Track connected agents
        self.agents = {}
        
        # Set up communication
        self.hello_subscriber = self.create_subscription(
            String,
            '/agent_hello',
            self.handle_agent_hello,
            10
        )
        
        self.response_publisher = self.create_publisher(
            String,
            '/coordinator_response',
            10
        )
        
        self.get_logger().info('Coordinator started')
    
    def handle_agent_hello(self, msg):
        # Parse the incoming message
        try:
            data = json.loads(msg.data)
            agent_name = data.get('name', 'Unknown')
            message = data.get('message')
            
            # Add agent to our list
            self.agents[agent_name] = data
            
            #self.get_logger().info(f'Got hello from {agent_name}')
            
            # Send back a response
            response = {
                'to': agent_name,
                'message': f'{agent_name}: {message}!'
            }
            
            response_msg = String(data=json.dumps(response))
            self.response_publisher.publish(response_msg)
            
        except Exception as e:
            self.get_logger().error(f'Error parsing message: {e}')


def main(args=None):
    rclpy.init(args=args)
    coordinator = MultiAgentCoordinator()
    
    try:
        rclpy.spin(coordinator)
    except KeyboardInterrupt:
        pass
    finally:
        coordinator.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()