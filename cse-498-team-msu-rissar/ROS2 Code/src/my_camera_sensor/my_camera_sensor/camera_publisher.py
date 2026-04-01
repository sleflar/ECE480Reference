#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, QoSReliabilityPolicy, QoSHistoryPolicy
import pyrealsense2 as rs
import numpy as np
from sensor_msgs.msg import CompressedImage
from cv_bridge import CvBridge
from std_srvs.srv import SetBool
from std_msgs.msg import Float64
import cv2

class CameraFeedPublisher(Node):
    def __init__(self):
        super().__init__('camera_publisher')
        sensor_qos = QoSProfile(reliability=QoSReliabilityPolicy.BEST_EFFORT,
                                history=QoSHistoryPolicy.KEEP_LAST,
                                depth=1)
        self.publisher = self.create_publisher(CompressedImage, 'sensors/camera_feed', sensor_qos)
        self.distance_pub = self.create_publisher(Float64, 'sensors/depth_sensor/distance', sensor_qos)
        self.frame_count = 0
        self.timer = self.create_timer(1/30, self.publish_frame)
        self.gray_mode = False
        self.low_res_mode = True
        self.color_service = self.create_service(SetBool, 'sensors/camera_feed/set_color', self.set_color)
        self.resolution_service = self.create_service(SetBool, 'sensors/camera_feed/set_resolution', self.set_resolution)
        
        # Setup RealSense instead of VideoCapture
        try:
            self.pipeline = rs.pipeline()
            config = rs.config()
            config.enable_stream(rs.stream.depth, 640, 360, rs.format.z16, 30)
            config.enable_stream(rs.stream.color, 640, 360, rs.format.bgr8, 30)
            profile = self.pipeline.start(config)
            device = profile.get_device()
            depth_sensor = device.first_depth_sensor()
            if depth_sensor.supports(rs.option.emitter_enabled):
                depth_sensor.set_option(rs.option.emitter_enabled, 1.0)
                self.get_logger().info("IR emitter (laser) ENABLED")
            else:
                self.get_logger().warn("Depth sensor does not support emitter_enabled option")
            self.depth_scale = float(depth_sensor.get_depth_scale())
            self.get_logger().info(f"Depth scale: {self.depth_scale} meters per unit")
            self.align = rs.align(rs.stream.color)
            self.get_logger().info("RealSense Camera Publisher Started")
        except Exception as e:
            self.get_logger().error(f"Failed to start RealSense: {e}")
            raise
        


        self.bridge = CvBridge()
    
    def publish_frame(self):

        try:
            frames = self.pipeline.wait_for_frames(timeout_ms=1000)
            aligned_frames = self.align.process(frames)
            depth_frame = aligned_frames.get_depth_frame()
            color_frame = aligned_frames.get_color_frame()
            
            if color_frame:
                frame = np.asanyarray(color_frame.get_data())
                
                if self.gray_mode:
                    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    gray_frame = cv2.resize(gray_frame, (160, 120))
                    compressed_msg = self.bridge.cv2_to_compressed_imgmsg(gray_frame, dst_format="jpeg")
                else:
                    if self.low_res_mode:
                        frame = cv2.resize(frame, (320, 240))
                    compressed_msg = self.bridge.cv2_to_compressed_imgmsg(frame, dst_format="jpeg")
                compressed_msg.header.stamp = self.get_clock().now().to_msg()
                compressed_msg.header.frame_id = 'camera_frame'
                
                self.publisher.publish(compressed_msg)

                self.frame_count += 1

                if self.frame_count % 100 == 0:
                    self.get_logger().info(f"Successfully published a total of {self.frame_count} frames.")
                elif self.frame_count == 1:
                    self.get_logger().info("Successfully published a frame.")

            if depth_frame:
                depth_image = np.asanyarray(depth_frame.get_data())
                distance_m = self.compute_front_distance(depth_image)

                if distance_m is not None:
                    dist_msg = Float64()
                    dist_msg.data = distance_m
                    self.distance_pub.publish(dist_msg)


        except Exception as e:
            self.get_logger().warn(f"Failed to get frame: {e}")
    
    def destroy_node(self):
        try:
            self.pipeline.stop()
        except:
            pass
        super().destroy_node()

    def compute_front_distance(self, depth_image: np.ndarray):
        if depth_image is None or depth_image.size == 0:
            return None

        h, w = depth_image.shape
        cx = w // 2
        cy = h // 3
        roi = 30  
        x1 = max(cx - roi, 0); x2 = min(cx + roi, w)
        y1 = max(cy - roi, 0); y2 = min(cy + roi, h)
        window = depth_image[y1:y2, x1:x2].astype(np.float64)
        valid = window[(window > 0) & (window < 10000)]

        if valid.size == 0:
            return None
        
        return float(np.median(valid) * self.depth_scale)
    
    def set_color(self, request, response):
        """Set color process."""
        self.get_logger().info('SET COLOR SERVICE CALLED')

        if request.data:
            self.gray_mode = False
            response.message = 'Set to color mode'
        else:
            self.gray_mode = True
            response.message = 'Set to gray mode'

        response.success = True
        return response

    def set_resolution(self, request, response):
        """Set low resolution process."""
        self.get_logger().info('SET LOW RESOLUTION CALLED')

        if request.data:
            self.low_res_mode = True
            response.message = 'Set to low res mode'
        else:
            self.low_res_mode = False
            response.message = 'Set to high res mode'

        response.success = True
        return response

def main(args=None):
    rclpy.init(args=args)
    
    try:
        node = CameraFeedPublisher()
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if rclpy.ok():
            rclpy.shutdown()

if __name__ == '__main__':
    main()
