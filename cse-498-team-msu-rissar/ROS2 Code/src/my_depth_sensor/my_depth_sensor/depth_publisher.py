#!/usr/bin/env python3

# takes raw depth camera data and turns it into a colorized heatmap
# red = close, blue = far away - makes it easier to see what the depth camera sees

import rclpy
from rclpy.node import Node
import cv2
import numpy as np
from sensor_msgs.msg import Image, CompressedImage
from cv_bridge import CvBridge


class DepthHeatmapOnlyNode(Node):
    def __init__(self):
        super().__init__("depth_heatmap_only_node")

        # max distance is 5000 for heatmap
        self.declare_parameter("span", 5000.0)
        # listen for raw depth images from the camera
        self.depth_sub = self.create_subscription(Image, "/camera/camera/depth/image_rect_raw", self.depth_callback, 10)
        # publish the heatmap
        self.heatmap_pub = self.create_publisher(CompressedImage, "/camera/depth/heatmap/compressed", 10)

        # bridge to convert between opencv and ros image formats
        self.bridge = CvBridge()
        self.get_logger().info("Depth Heatmap Node Started")

    def depth_callback(self, msg):
        self.get_logger().info("Received a depth image")

        try:
            # convert ros image message to opencv format (16-bit unsigned)
            depth_image = self.bridge.imgmsg_to_cv2(msg, desired_encoding="16UC1")

            if depth_image is None:
                self.get_logger().error("Depth image conversion failed")
                return

            # turn the boring grayscale depth into a colorful heatmap
            heatmap = self.generate_heatmap(depth_image)
            if heatmap is None:
                self.get_logger().error("Heatmap generation failed")
                return

            # compress and send out this version
            heatmap_msg = self.bridge.cv2_to_compressed_imgmsg(heatmap, dst_format="jpeg")
            self.heatmap_pub.publish(heatmap_msg)
            self.get_logger().info("Published heatmap to /camera/depth/heatmap/compressed")

        except Exception as e:
            self.get_logger().error(f"Error processing depth image: {e}")

    def generate_heatmap(self, depth_image):
        # get the max distance we care about
        span = self.get_parameter("span").get_parameter_value().double_value

        # handle invalid depth values (zeros) by making them nan
        depth_float = np.where(depth_image == 0, np.nan, depth_image.astype(np.float32))
        # scale depth values to 0-255 range for colorization
        scaled = (depth_float / span) * 255.0
        scaled = np.clip(scaled, 0, 255)
        # convert back to uint8 and replace nans with black pixels
        normalized = np.nan_to_num(scaled, nan=0).astype(np.uint8)

        # flip the colors so close stuff is red and far stuff is blue
        normalized = 255 - normalized
        # apply the jet colormap (blue to red gradient)
        return cv2.applyColorMap(normalized, cv2.COLORMAP_JET)


def main(args=None):
    rclpy.init(args=args)
    node = DepthHeatmapOnlyNode()
    # keep running until someone hits ctrl+c
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()