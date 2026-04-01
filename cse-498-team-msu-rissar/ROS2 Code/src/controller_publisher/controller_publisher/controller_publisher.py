import hid
import signal
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Vector3

VendorID = 0x046d
# The wheel can have two different product IDs depending on what mode it boots in
ProductIDs = [0xc294,
              0xc29a]

# hid output list indices for full boot
fullLSBIndex = 0
fullMSBIndex = 1
fullGasIndex = 5
fullBrakeIndex = 6

# hid output list indices for safety mode boot
safeLSBIndex = 4
safeMSBIndex = 5
safeGasIndex = 6
safeBrakeIndex = 7

class ControllerPublisher(Node):
    """
    ROS2 Node class that publishes data to the /controller_data topic.
    ---
    Attributes:
    publisher : self.create_publisher(Vector3, '/controller_data', 10)
 	timer : self.create_timer(0.01, self.timer_callback)
 	device : None
 	id : pid
 	data : self.device.read(64)
 	---
 	Member Functions:
 	__init__ (self) : Initialize the node
 	abs_steering_val (self) : Calculate the absolute steering wheel value
 	steering_deg (self)
 	pedal_data (self)
 	timer_callback (self)
 	cleanup (self)
    """
    def __init__(self):
        """ Initialize the node """
        super().__init__('controller_publisher')

        # Set publisher message type
        self.publisher = self.create_publisher(Vector3, '/controller_data', 10)
        self.timer = self.create_timer(0.01, self.timer_callback)
        self.device = None

        # Set the device to the currently active productID (Find the mode it booted in)
        for pid in ProductIDs:
            self.id = pid
            try:
                self.device = hid.device()
                self.device.open(VendorID, pid)
                break
            except Exception as e:
                self.get_logger().warn(f"Failed to open PID Logitech GT Drive Force: {e}")

        if self.device is None:
            self.get_logger().error("No hid device connected")

    def abs_steering_val(self):
        """ Calculate the absolute steering wheel value (0 is full left and 1024 is full right) """

        # If else block to do the bit shifting and math for both normal mode and safety mode
        if self.id == ProductIDs[1]:
            # Support safety mode
            lsb, msb = self.data[safeLSBIndex], self.data[safeMSBIndex]
            steering_abs_val = (msb << 8) | lsb
            steering_abs_val = (steering_abs_val / 65535.0) * 1024
            return steering_abs_val
        else:
            # Support for full boot mode
            lsb, msb = self.data[fullLSBIndex], self.data[fullMSBIndex]
            steering_abs_val = (msb << 8) | lsb
            return steering_abs_val

    def steering_deg(self):
        """ Normalize and calculate the steering angle in +-30 degrees """
        steering_abs_val = self.abs_steering_val()

        # If else block to get the steering value to be in [-1,1]
        if self.id == ProductIDs[1]:
            # Support safe mode
            normalized = (steering_abs_val - 128) / 128
        else:
            # Support for full boot
            normalized = (steering_abs_val - 512) / 512

        # Normalize the steering angle to +- 30 degrees since that is a typical range for car wheels
        return normalized * 30

    def pedal_data(self):
        """ Extract and normalize gas and brake data """
        if self.id == ProductIDs[1]:
            # Support safety mode
            gas, brake = self.data[safeGasIndex], self.data[safeBrakeIndex]
        else:
            # Support normal mode
            gas, brake = self.data[fullGasIndex], self.data[fullBrakeIndex]

        # Keep gas and break between 20 and 225 because sometimes the pedals have a "drift" and will change values
        # when not being moved.
        gas = max(20, min(gas, 225))
        brake = max(20, min(brake, 225))

        # Normalize to a 0-100 scale
        gas = 100 - ((gas - 20) / 205 * 100)
        brake = 100 - ((brake - 20) / 205 * 100)

        return [float(gas), float(brake)]

    def timer_callback(self):
        """ Callback function to read data from the controller and publish it """
        try:
            # Read the output list from the device
            self.data = self.device.read(64)
            if self.data:
                print(self.data)

                # Extract gas, brake, and steering data
                gas_brake = self.pedal_data()
                steering_angle = self.steering_deg()

                # Create a Vector3 message
                msg = Vector3()

                # Map gas, brake, and steering data to the Vector3 fields
                msg.x = gas_brake[0]           # Gas value (mapped to x)
                msg.y = gas_brake[1]           # Brake value (mapped to y)
                msg.z = float(steering_angle)  # Steering angle (mapped to z)

                # Publish the message
                self.publisher.publish(msg)
                self.get_logger().info(
                    f"Published: Gas={gas_brake[0]}, Brake={gas_brake[1]}, Steering={steering_angle}")

        except Exception as e:
            self.get_logger().error(f"Error in timer_callback: {e}")

    def cleanup(self):
        """ Function to properly close the hid device """
        if self.device:
            try:
                self.device.close()
                self.get_logger().info("hid device closed.")
            except Exception as e:
                self.get_logger().warn(f"Error closing hid device: {e}")


def main(args=None):
    """ Main to handle node initialization and proper node closure """
    rclpy.init(args=args)
    controller = ControllerPublisher()

    try:
        # Start the node
        rclpy.spin(controller)
    except KeyboardInterrupt:
        controller.get_logger().info("Shutting down due to keyboard interrupt")
    finally:
        # Disconnect from the hid device
        controller.cleanup()

        # Close the node if ROS2 did not automatically
        try:
            rclpy.shutdown()
        except Exception as e:
            pass


if __name__ == '__main__':
    main()