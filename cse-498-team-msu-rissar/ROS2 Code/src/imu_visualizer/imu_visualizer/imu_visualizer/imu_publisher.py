import rclpy
from rclpy.node import Node
import pyrealsense2 as rs
from sensor_msgs.msg import Imu

from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy

class IMUPublisher(Node):
    def __init__(self):
        super().__init__('imu_publisher')
        self.get_logger().info("IMU Publisher Node Started!")

        

        self.imu_publisher = self.create_publisher(Imu, "/imu/data_raw", 10)

        self.get_logger().info(f"line 17")

        self.pipeline = rs.pipeline()
        self.config = rs.config()
        # self.config.enable_stream(rs.stream.accel)
        # self.config.enable_stream(rs.stream.gyro)
        self.pipeline.start(self.config)

        self.get_logger().info(f"line 25")

        self.timer = self.create_timer(0.1, self.publish_imu_data)

    def publish_imu_data(self):

        self.get_logger().info(f"line 31")
        frames = self.pipeline.wait_for_frames()
    
        self.get_logger().info(f"line 34")
        accel_frame = frames.first_or_default(rs.stream.accel)
        gyro_frame = frames.first_or_default(rs.stream.gyro)
        
        self.get_logger().info(f"line 37")
        if not accel_frame or not gyro_frame:
            self.get_logger().warn("Missing IMU frames")
            return
        
        self.get_logger().info(f"line 43")
        accel = accel_frame.as_motion_frame().get_motion_data()
        gyro = gyro_frame.as_motion_frame().get_motion_data()

        self.get_logger().info(f"line 47")
        imu_msg = Imu()
        imu_msg.header.stamp = self.get_clock().now().to_msg()
        imu_msg.header.frame_id = "imu_link"
        self.get_logger().info(f"line 51")
        imu_msg.angular_velocity.x = gyro.x
        imu_msg.angular_velocity.y = gyro.y
        imu_msg.angular_velocity.z = gyro.z
        imu_msg.linear_acceleration.x = accel.x
        imu_msg.linear_acceleration.y = accel.y
        imu_msg.linear_acceleration.z = accel.z

        self.get_logger().info(f"line 59")
        self.imu_publisher.publish(imu_msg)

        self.get_logger().info(f"accel.x = {imu_msg.linear_acceleration.x}, accel.y = {imu_msg.linear_acceleration.y}, accel.z = {imu_msg.linear_acceleration.z}")


def main(args=None):
    rclpy.init(args=args)
    node = IMUPublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == "__main__":
    main()

