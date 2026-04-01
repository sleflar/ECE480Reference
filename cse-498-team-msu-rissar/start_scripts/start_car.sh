#!/bin/bash

# Color codes
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
BRANCH="main"
NO_BUILD=false

for arg in "$@"; do
    case $arg in
        --no-build)
            NO_BUILD=true
            shift
            ;;
        *)
            BRANCH="$arg"
            shift
            ;;
    esac
done

echo -e "${CYAN}[INFO]${NC} Pulling from branch: $BRANCH..."
cd ~/cse-498-team-msu-rissar
git switch "$BRANCH" && git pull

if [ "$NO_BUILD" = false ]; then
    echo -e "${CYAN}[INFO]${NC} Building ros2_ws..."
    cd ~/ros2_ws
    colcon build --symlink-install
else
    echo -e "${CYAN}[INFO]${NC} Skipping build (--no-build flag set)..."
    cd ~/ros2_ws
fi

echo -e "${CYAN}[INFO]${NC} Launching launch_car.launch.py..."
. install/setup.bash
ros2 launch launch_pkg launch_car.launch.py
