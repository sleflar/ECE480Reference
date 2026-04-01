import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, QoSReliabilityPolicy, QoSHistoryPolicy
from sensor_msgs.msg import LaserScan
from rplidar import RPLidar
import numpy as np
import serial.tools.list_ports

class LidarPublisher(Node):
    def __init__(self):
        super().__init__('lidar_publisher')
        sensor_qos = QoSProfile(reliability=QoSReliabilityPolicy.BEST_EFFORT,
                                history=QoSHistoryPolicy.KEEP_LAST,
                                depth=1)
        self.publisher_ = self.create_publisher(LaserScan, 'scan', sensor_qos)

        self.declare_parameter('serial_port', '')
        self.declare_parameter('baudrate', 115200)
        self.declare_parameter('timeout', 1.0)
        
        serial_port = self.get_parameter('serial_port').get_parameter_value().string_value
        baudrate = self.get_parameter('baudrate').get_parameter_value().integer_value
        timeout = self.get_parameter('timeout').get_parameter_value().double_value
        
        if not serial_port:
            serial_port = self.find_lidar_port(baudrate, timeout)
            if not serial_port:
                self.get_logger().error("Could not find lidar on any available port")
                return
        
        self.get_logger().info(f"Connecting to {serial_port} at {baudrate} baud")
        
        try:
            self.lidar = RPLidar(serial_port, baudrate=baudrate, timeout=timeout)
            info = self.lidar.get_info()
            self.get_logger().info(f"Lidar info: {info}")
            self.lidar.start_motor()
        except Exception as e:
            self.get_logger().error(f"Failed to open serial port: {e}")
            return
    
    def find_lidar_port(self, baudrate, timeout):
        ports = serial.tools.list_ports.comports()
        self.get_logger().info(f"Scanning {len(ports)} available serial ports for lidar")
        
        for port in ports:
            try:
                self.get_logger().info(f"Trying {port.device}")
                test_lidar = RPLidar(port.device, baudrate=baudrate, timeout=timeout)
                info = test_lidar.get_info()
                test_lidar.stop()
                test_lidar.disconnect()
                self.get_logger().info(f"Found lidar on {port.device}")
                return port.device
            except Exception as e:
                try:
                    test_lidar.disconnect()
                except:
                    pass
                continue
        return None

    def publish_scan(self):
        try:
            for scan_data in self.lidar.iter_scans(max_buf_meas=500):
                msg = LaserScan()
                msg.header.stamp = self.get_clock().now().to_msg()
                msg.header.frame_id = "lidar_frame"
                
                # Set FIXED scan parameters
                msg.angle_min = 0.0
                msg.angle_max = 2.0 * np.pi
                msg.angle_increment = np.radians(1.0)  # 1 degree per bin
                msg.time_increment = 0.0
                msg.scan_time = 0.1  # ~10Hz scan rate for RPLidar A series
                msg.range_min = 0.15
                msg.range_max = 12.0  # A1/A2: 12m, adjust if you have A3
                
                # Create 360 bins (one per degree)
                num_bins = 360
                ranges = [float('inf')] * num_bins
                intensities = [0.0] * num_bins
                
                # Fill bins with scan data
                # scan_data format: [(quality, angle, distance), ...]
                for quality, angle, distance in scan_data:
                    if distance > 0:  # Valid measurement
                        # Convert angle to bin index (angle is in degrees)
                        bin_index = int(angle) % 360
                        ranges[bin_index] = distance / 1000.0  # Convert mm to meters
                        intensities[bin_index] = float(quality)  # Quality, not angle!
                
                msg.ranges = ranges
                msg.intensities = intensities
                
                self.publisher_.publish(msg)
                
                # Log how many valid points we got
                valid_points = len([r for r in ranges if r != float('inf')])
                self.get_logger().info(f"Published scan: {valid_points}/360 valid points", 
                                      throttle_duration_sec=1.0)
            
        except Exception as e:
            self.get_logger().error(f"Error while sending Lidar data: {e}")

    def destroy_node(self):
        if hasattr(self, 'lidar'):
            try:
                self.lidar.stop()
                self.lidar.stop_motor()
                self.lidar.disconnect()
            except:
                pass
        super().destroy_node()

def main(args=None):
    rclpy.init(args=args)
    node = LidarPublisher()
    try:
        node.publish_scan()
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()