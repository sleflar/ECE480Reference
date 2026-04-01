#!/bin/bash

# Color codes
CYAN='\033[0;36m'
NC='\033[0m' # No Color

BRANCH=${1:-main}

echo -e "${CYAN}[INFO]${NC} Pulling $BRANCH..."
cd ~/cse-498-team-msu-rissar

git switch "$BRANCH" && git pull

echo -e "${CYAN}[INFO]${NC} Starting docker containers and building any changes..."
docker compose up -d --build

echo -e "${CYAN}[INFO]${NC} Starting the dashboard..."
nohup firefox laptop:5173 >/dev/null 2>&1 &

echo -e "${CYAN}[INFO]${NC} Starting ROS2 nodes..."
docker compose exec ros2-workspace bash -c "source ~/ros2_ws/install/setup.bash && ros2 launch launch_pkg launch_laptop.launch.py"