import rclpy
from rclpy.node import Node
from sensor_msgs.msg import NavSatFix
from std_msgs.msg import String
from pynmeagps import NMEAReader
import io

# New imports for map caching
from gnss_data.map_cache_db import MapCache, coord_to_xy
from gnss_data.tile_downloader import save_tile_to_db, download_tile, download_grid


class GNSSSubscriber(Node):
    def __init__(self):
        super().__init__("gnss_subscriber")
        self.get_logger().info("GNSS Subscriber Node Started!")

        self.subscription = self.create_subscription(String, "sensors/gnss", self.process_gnss_data, 10)
        self.gnss_publisher = self.create_publisher(NavSatFix, "sensors/gnss/fix", 10)

        #Establishes map cache and set default zoom
        self.map_cache = MapCache()
        self.zoom_level = 14

        #To keep track of gnss_data
        self.lat = None
        self.long = None

    def process_gnss_data(self, msg):
        try:
            # Check if message is formatted string or raw NMEA
            if msg.data.startswith("Latitude:"):
                # Handle formatted string from publisher: "Latitude: 42.123, Longitude: -83.456"
                parts = msg.data.split(", ")
                lat_str = parts[0].replace("Latitude: ", "")
                lon_str = parts[1].replace("Longitude: ", "")
                
                nav_msg = NavSatFix()
                nav_msg.header.stamp = self.get_clock().now().to_msg()
                nav_msg.header.frame_id = "gps"
                nav_msg.latitude = float(lat_str)
                nav_msg.longitude = float(lon_str)
                nav_msg.altitude = 0.0

                self.gnss_publisher.publish(nav_msg)
                self.get_logger().info(f"lat: {nav_msg.latitude}, lon: {nav_msg.longitude}")

                #Download map tile
                x, y = coord_to_xy(nav_msg.latitude, nav_msg.longitude, self.zoom_level)
                save_tile_to_db(self.zoom_level, x, y, self.map_cache)
            else:
                # Handle raw NMEA sentence
                nmea_bytes = msg.data.encode("utf-8")
                parsed = NMEAReader.parse(nmea_bytes)

                if hasattr(parsed, "lat") and hasattr(parsed, "lon"):
                    nav_msg = NavSatFix()
                    nav_msg.header.stamp = self.get_clock().now().to_msg()
                    nav_msg.header.frame_id = "gps"
                    nav_msg.latitude = parsed.lat
                    nav_msg.longitude = parsed.lon
                    nav_msg.altitude = getattr(parsed, "alt", 0.0)

                    self.gnss_publisher.publish(nav_msg)
                    self.get_logger().info(f"lat: {nav_msg.latitude}, lon: {nav_msg.longitude}")

                    #Download map tile
                    x, y = coord_to_xy(nav_msg.latitude, nav_msg.longitude, self.zoom_level)
                    save_tile_to_db(self.zoom_level, x, y, self.map_cache)
                else:
                    self.get_logger().info("No GPS data detected.")

        except Exception as e:
            self.get_logger().warn(f"Error processing GNSS data: {e}")

def main(args=None):
    rclpy.init(args=args)
    node = GNSSSubscriber()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == "__main__":
    main()

