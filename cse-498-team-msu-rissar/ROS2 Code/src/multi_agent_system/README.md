# multi agent demo
simple ROS2 multi-agent system with coordinator and agents.

## setup
once you're in the docker bash (if u dont know how to do this, refer to README in ros2 code folder):

run these two:
colcon build

verify package is installed:
ros2 pkg list | grep multi_agent_system
ros2 pkg executables multi_agent_system


## running demo

i used tmux cause its easier to visualize. if u want four seperate instances go ahead but u will need to "docker compose exec ros2-laptop bash" all of them to get into the linux instance.

run:
tmux new-session -d -s demo

create 4 panes:
tmux split-window -h
tmux split-window -v
tmux select-pane -t 0
tmux split-window -v

create command for each page:
tmux send-keys -t 0 'ros2 run multi_agent_system coordinator' Enter
tmux send-keys -t 1 'ros2 run multi_agent_system agent agent1' Enter
tmux send-keys -t 2 'ros2 run multi_agent_system agent agent2' Enter
tmux send-keys -t 3 'ros2 run multi_agent_system demo' Enter

see everything:
tmux attach-session -t demo

or manually do it:
Terminal 1: `ros2 run multi_agent_system coordinator`
Terminal 2: `ros2 run multi_agent_system agent agent1`
Terminal 3: `ros2 run multi_agent_system agent agent2`
Terminal 4: `ros2 run multi_agent_system demo`