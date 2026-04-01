import rclpy
from rclpy.qos import QoSProfile, QoSReliabilityPolicy, QoSHistoryPolicy
from rclpy.node import Node
from sensor_msgs.msg import Imu

class IMUPublisher(Node):
    def __init__(self):
        super().__init__('imu_publisher')
        self.get_logger().info("IMU Publisher Node Started.")
        
        # QoS Profile for sensor (best effort, keep last)
        sensor_qos = QoSProfile(reliability=QoSReliabilityPolicy.BEST_EFFORT,
                                history=QoSHistoryPolicy.KEEP_LAST,
                                depth=1)

        # Subscriber
        self.subscriber = self.create_subscription(
            Imu,
            '/sensors/imu/raw',
            self.imu_callback,
            sensor_qos
        )
        
        # Publisher
        self.publisher = self.create_publisher(
            Imu,
            '/imu/data_raw',
            sensor_qos
        )
        self.count = 0

    def imu_callback(self, msg: Imu):
        self.count += 1
        
        msg.header.frame_id = 'imu_link'

        msg.header.stamp = self.get_clock().now().to_msg()

        self.publisher.publish(msg)

        self.get_logger().info(f"Published IMU #{self.count}")

        if self.count % 100 == 0:
            self.get_logger().info(
                f"Published IMU #{self.count} - "
                f"Accel: [{msg.linear_acceleration.x:.2f}, "
                f"{msg.linear_acceleration.y:.2f}, "
                f"{msg.linear_acceleration.z:.2f}]"
            )

def main(args=None):
    rclpy.init(args=args)
    node = IMUPublisher()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        rclpy.shutdown()
        node.destroy_node()

if __name__ == '__main__':
    main()