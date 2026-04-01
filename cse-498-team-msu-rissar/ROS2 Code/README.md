# How to run first time
docker compose up
to see logs and make sure things are successful

# How to run docker "laptop" after first successful time
docker compose up -d 
-d for detached mode so we can use terminal still

# How to connect to "laptop" when docker running
in CLI: docker compose exec ros2-laptop bash 
to use docker bash, this will put u in the linux instance

# How to stop docker safely
docker compose down

# How to delete container
docker rmi ros2-laptop-test
my laptops storage is a bit bad, using this can help but will delete everything u have on the instance

# Run ros2 bags on front end
 

 ## Install ros2 bridge
 
 sudo apt update
 sudo apt install ros-humble-rosbridge-server

 ## Run websocket
 ros2 launch rosbridge_server rosbridge_websocket_launch.xml

 ## locate replay folder then run bag
 ros2 bag play camera_bag_0.db3 --loop

 ## Make sure to run in separate terminals