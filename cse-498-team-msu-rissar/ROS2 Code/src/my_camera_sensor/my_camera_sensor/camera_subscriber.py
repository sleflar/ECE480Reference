import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, QoSReliabilityPolicy, QoSHistoryPolicy
import cv2
from sensor_msgs.msg import CompressedImage 
from cv_bridge import CvBridge

#Basic subscriber for the camera, very similar to other subscribers in this project
class CameraFeedSubscriber(Node):
    #This just sets up the subscriber
    def __init__(self):
        super().__init__('camera_subscriber')

        sensor_qos = QoSProfile(reliability=QoSReliabilityPolicy.BEST_EFFORT,
                                history=QoSHistoryPolicy.KEEP_LAST,
                                depth=1)

        self.subscription = self.create_subscription(
            CompressedImage,
            'sensors/camera_feed', 
            self.listener_callback,
            sensor_qos)
        
        self.bridge = CvBridge()
        
        self.frame_count = 0

        self.get_logger().info("Camera Subscriber Started")

    #Listener function to print what is heard from publisher
    def listener_callback(self, msg):
        self.frame_count += 1

        frame = self.bridge.compressed_imgmsg_to_cv2(msg, desired_encoding="bgr8")
        if self.frame_count % 100 == 0:
            self.get_logger().info(f"Successfully received a total of {self.frame_count} frames.")
        elif self.frame_count == 1:
            self.get_logger().info("Successfully received a frame.")        

    # Destrutor
    def destroy_node(self):
        super().destroy_node()

def main(args=None):
    rclpy.init(args=args)
    node = CameraFeedSubscriber()
    
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        node.get_logger().info("Shutting down camera subscriber")
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
