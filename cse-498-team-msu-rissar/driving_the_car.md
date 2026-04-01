To start the car

First ssh into the car referenced in systems.md on feature/documentation

cd into `~/ros2_ws` and run `source install/setup.bash`
	if the source commands states the install location cannot be found, the workspaces needs to be built by running `colcon build`
	after running `colcon build` you can then run `source install/setup.bash`
After sourcing the setup bash we are ready to start the car. Run `ros2 launch start_car start_car_launch.py` 
This will start all resources required for the car to be driven including the rosbridge to facilitate communication between the front end and the back end.

Now on the laptop

run `cd ~/ros2_ws` and source the setup file by running `source install/setup.bash`
	if the source commands states the install location cannot be found, the workspaces needs to be built by running `colcon build`
	after running `colcon build` you can then run `source install/setup.bash`
After sourcing the setup.bash we need to start the joystick publisher.
The joystick publisher can be started by running `ros2 launch teleop_twist_joy teleop-launch.py`
	This will publish inputs from the controller as a ros topic for the car to listen to.


