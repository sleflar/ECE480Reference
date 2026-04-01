import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, QoSReliabilityPolicy, QoSHistoryPolicy
from geometry_msgs.msg import Point
from std_srvs.srv import Trigger
from serial import Serial
from pynmeagps import NMEAReader
import time

class GNSS_Publisher_Node(Node):
    def __init__(self):
        super().__init__('gps_reader_node')

        self.declare_parameter('serial_port', '/dev/sensors/gnss')
        self.declare_parameter('baudrate', 4800)
        self.declare_parameter('timeout', 3.0)

        serial_port = self.get_parameter('serial_port').get_parameter_value().string_value
        baudrate = self.get_parameter('baudrate').get_parameter_value().integer_value
        timeout = self.get_parameter('timeout').get_parameter_value().double_value

        sensor_qos = QoSProfile(reliability=QoSReliabilityPolicy.BEST_EFFORT,
                                history=QoSHistoryPolicy.KEEP_LAST,
                                depth=1)

        #New change: instead of string, it is now a tuple
        self.publisher_ = self.create_publisher(Point, "sensors/gnss", sensor_qos)

        self.network_service = self.create_service(Trigger, '/car1_ns/get_time', self.time_callback)

        self.get_logger().info(f"Connecting to {serial_port} at {baudrate} baud")

        self.x = 0.0
        self.y = 0.0
        self.z = 0.0
        self.z_prev = 0.0

        self.count = 0
        
        try:
            self.stream = Serial(serial_port, baudrate, timeout=timeout)
            self.nmr = NMEAReader(self.stream)
            self.timer = self.create_timer(0.5, self.read_gps_data)
        except Exception as e:
            self.get_logger().error(f"Failed to open serial port: {e}")
            self.destroy_node()

    def time_callback(self, request, response):
        """time callback process."""
        response.success = True
        response.message = str(int(time.time()*1000))
        return response

    def read_gps_data(self):
        try:
            raw, parsed = self.nmr.read()
            
            if raw and parsed:
                #Pull out lat/lon from parsed data
                if hasattr(parsed, 'lat') and hasattr(parsed, 'lon'):
                    #Continue if lat/lon are not empty strings or None
                    if parsed.lat and parsed.lon and str(parsed.lat).strip() and str(parsed.lon).strip():
                        try:
                            #Convert to float, handling potential string or object formats
                            self.x = float(parsed.lat)
                            self.y = float(parsed.lon)
                            self.z = float(parsed.alt) if hasattr(parsed, 'alt') and parsed.alt else self.z_prev
                            
                            gnss_point = Point()
                            gnss_point.x = self.x
                            gnss_point.y = self.y
                            gnss_point.z = self.z
                            
                            #This publishes the data as a point
                            self.publisher_.publish(gnss_point)

                            if self.count % 100 == 0:
                                info_message = f"GNSS Data - Lat: {gnss_point.x}, Lon: {gnss_point.y}"
                                if hasattr(parsed, 'alt'):
                                    info_message += f", Alt: {gnss_point.z}"

                                self.get_logger().info(info_message)

                            self.z_prev = self.z if self.z != 0.0 else self.z_prev
                            self.count += 1

                        except (ValueError, TypeError) as e:
                            self.get_logger().error(f"Error converting lat/lon to float: {e}, lat={parsed.lat}, lon={parsed.lon}")
        except Exception as e:
            self.get_logger().error(f"Error reading GPS data: {e}")

def main(args=None):
    rclpy.init(args=args)
    node = GNSS_Publisher_Node()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        node.get_logger().info('GPS Reader Node stopped.')
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
