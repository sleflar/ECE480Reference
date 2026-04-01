# RISSAR

## Remote Interface for Small Scale Autonmous Racing

## Table of Contents

- [What is this?](#what-is-this)
- [Hardware and Network Information](#hardware-and-network-information)
- [How do I run this?](#how-do-i-run-this)
  - [Laptop setup](#laptop-setup)
  - [Jetson setup](#jetson-setup)
  - [Navio RPi setup](#navio-rpi-setup)

## What is this?

This is an interface for ROS1 and ROS2 remote controlled cars. This interface can display multiple sensor data and live feed footage from the car. You can also record and play back sensor and controller inputs to recreate or loop scenarios. This project aims to mitigate the potential risks of operating a full-scale autonomous race car by utilizing small-scale cars for testing and development. 

## Hardware and Network Information

For detailed hardware specifications, credentials, and network topology, see [HARDWARE.md](HARDWARE.md).

## How do I run this?

There are 2 portions of setup.

### Laptop setup

1. There's not too much to do on the laptop if you're not starting from scratch.
2. If you are starting from scratch, clone the repository to some where on your machine.
   1. run the following to start everything required to run the front end. `sh cse-498-team-msu-rissar/start-scripts/start_laptop.sh`
   2. This should use docker compose to bring up the required front end components.
3. You should now see a firefox window with the front end displayed.

### Jetson setup

1. If you're starting fresh, flash an SD card with a minimum size of 64 GB with the provided image file `Jetson-car.img.xz`
   1. This file needs to be uncompressed and can be done so through either `unxz` or applications like 7 Zip/WinRAR.
   2. Once this image is extracted, you should be left with `Jetson-car.img`. You can flash this using etcher, balena etcher for a graphical interface or using a command line utility like `dd`.
2. After the car is flashed, slot in the sd card into the car found on the Jetson board itself and power on the car. The ROS instance should automatically start as as service for the car. So no need to worry about starting it.
3. To start it manually, check if the service is already running by `systemctl status rissar.service`
   1. If it's not started or errored out, you can use a start script in the home directory. This is a linked shell script from the `cse-498-team-msu-rissar/start-scripts/start_car.sh`. You can run in this in any terminal on the car(either ssh or directly connected to the car through a display port and keyboard) `sh /home/user/cse-498-team-msu-rissar/start_scripts/start_car.sh`

#### Using the start_car Script

The `start_car.sh` script automates pulling code updates, building the ROS2 workspace, and launching the car. It's available both at the full path and as a symlink in the home directory.

**Basic Usage:**
```bash
# Start with default main branch (pulls, builds, and launches)
sh ~/start_car.sh

# Start with a specific branch (e.g., develop)
sh ~/start_car.sh develop

# Skip the build step (useful when no code changes were made)
sh ~/start_car.sh --no-build

# Use a specific branch without building
sh ~/start_car.sh develop --no-build
```

**What it does:**
1. Switches to and pulls the specified branch (defaults to `main`)
2. Builds the ROS2 workspace with `colcon build --symlink-install` (unless `--no-build` is specified)
3. Sources the workspace and launches `launch_car.launch.py`

#### Jetson Directory Structure

The Jetson's home directory (`/home/user`) is organized as follows:

**Key Directories:**
- **`cse-498-team-msu-rissar/`** - Main project repository containing all source code, configurations, and start scripts
- **`ros2_ws/`** - ROS2 workspace directory. The `src` folder within this workspace contains a symlink to the main project, allowing ROS2 to build and run the project packages
- **`f1tenth_system/`** - F1TENTH system files and configurations
- **`installLibrealsense/`** - Intel RealSense SDK installation files


### Navio RPi setup

1. If you're starting fresh, flash an SD card with a minimum size of 64 GB with the provided image file `navio-car.img.xz`
   1. This file needs to be uncompressed and can be done so through either `unxz` or applications like 7 Zip/WinRAR.
   2. Once this image is extracted, you should be left with `navio-car.img`. You can flash this using etcher, balena etcher for a graphical interface or using a command line utility like `dd`.
2. After the car is flashed, slot in the SD card into the Raspberry Pi.
3. Plug in the battery and flip the power switch. You should hear a fan kick on. If not, check the charge of the battery.
4. The ROS instance should automatically start as a service for the car. So no need to worry about starting it.
5. To check or start it manually, you can SSH into the car and check if the service is already running by `systemctl status rissar.service`
   1. If it's not started or errored out, you can use a start script in the home directory to manually start it.
