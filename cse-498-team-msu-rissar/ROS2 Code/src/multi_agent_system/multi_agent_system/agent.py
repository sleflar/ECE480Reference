#!/usr/bin/env python3

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import json
import sys
import time


class MultiAgentAgent(Node):
    def __init__(self):
        super().__init__(f'agent')
        # Declare and get several parameters set from launch file
        self.declare_parameter('agent_name', 'agent1')

        agent_name = self.get_parameter('agent_name').value
        self.agent_name = agent_name

        self.declare_parameter('behavior', 'hello')
        behavior = self.get_parameter('behavior').value
        
        # Set up publishers and subscribers
        self.publisher = self.create_publisher(
            String,
            '/agent_hello',
            10
        )
        
        self.response_subscriber = self.create_subscription(
            String,
            '/coordinator_response',
            self.handle_coordinator_response,
            10
        )
        
        if behavior == 'hello':
            # Timer to send hello messages
            self.hello_timer = self.create_timer(5.0, self.send_hello)
            
            # Send first hello after 2 seconds
            self.create_timer(2.0, self.send_initial_hello)

        if behavior == 'goodbye':
            # Timer to send goodbye messages
            self.goodbye_timer = self.create_timer(5.0, self.send_goodbye)
            # Send first goodbye after 2 seconds
            self.create_timer(2.0, self.send_initial_goodbye)
        self.get_logger().info(f'Agent {agent_name} started')
    
    def send_initial_hello(self):
        # Send the first hello, then destroy this timer
        self.send_hello()
        self.destroy_timer(self.get_timer_by_callback(self.send_initial_hello))
    
    def send_hello(self):
        # Create hello message
        hello_data = {
            'name': self.agent_name,
            'message': f'Hello from {self.agent_name}',
            'timestamp': time.time(),
            'status': 'active'
        }
        
        hello_msg = String(data=json.dumps(hello_data))
        self.publisher.publish(hello_msg)
        
        #self.get_logger().info('Sent hello to coordinator')

    def send_initial_goodbye(self):
        # Send the first goodbye, then destroy this timer
        self.send_goodbye()
        self.destroy_timer(self.get_timer_by_callback(self.send_initial_goodbye))

    def send_goodbye(self):
        # Create goodbye message
        goodbye_data = {
            'name': self.agent_name,
            'message': f'Goodbye',
            'timestamp': time.time(),
            'status': 'active'
        }

        goodbye_msg = String(data=json.dumps(goodbye_data))
        self.publisher.publish(goodbye_msg)
    
    def handle_coordinator_response(self, msg):
        # Parse coordinator response
        try:
            data = json.loads(msg.data)
            to_agent = data.get('to', '')
            message = data.get('message', 'No message')
            
            # Check if message is for this agent
            if to_agent == self.agent_name:
                self.get_logger().info(f'Coordinator: {message}')
                
        except Exception as e:
            self.get_logger().error(f'Error parsing response: {e}')
    
    def get_timer_by_callback(self, callback):
        # Simple helper - returns None for now
        return None


def main(args=None):
    rclpy.init(args=args)
    
    agent = MultiAgentAgent()
    
    try:
        rclpy.spin(agent)
    except KeyboardInterrupt:
        pass
    finally:
        agent.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()