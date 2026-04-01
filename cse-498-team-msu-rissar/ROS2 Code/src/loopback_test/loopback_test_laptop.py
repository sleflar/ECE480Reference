import rclpy
from rclpy.node import Node
from std_msgs.msg import String

#here's the idea
#this node has a publisher, and a subscriber; it'll publish a ping, and subscribe for a pong
#then it just measures the time diff between the two
#this is then sent to ??? for the website

class LoopbackTestLaptop(Node):
    def __init__(self):
        super().__init__('loopbacktest_laptop')

        self.publisher = self.create_publisher(String, 'loopback_ping', 10)
        self.subscriber = self.create_subscription(String, 'loopback_pong', self.get_pong, 10)
        self.website_relay = self.create_publisher(String, 'loopback_logging', 10)

        self.timer = self.create_timer(0.01, self.do_ping)

    def do_ping(self):
        nanos = self.get_clock().now().nanoseconds 
        msg = String()
        msg.data = str(nanos)
        self.publisher.publish(msg)
    
    def get_pong(self, msg):
        #compare time in message w/ time now
        new_nanos = self.get_clock().now().nanoseconds
        old_nanos = int(msg.data)
        diff = new_nanos - old_nanos
        is_bad_connection = diff > 100000000 #100 ms

        logstr = "publishing: " + str(is_bad_connection)
        # self.get_logger().info(logstr)
        website_msg = String()
        website_msg.data = logstr
        self.website_relay.publish(website_msg)


def main(args=None):
    rclpy.init(args=args)
    loopbackLaptop = LoopbackTestLaptop()
    rclpy.spin(loopbackLaptop)

    loopbackLaptop.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()