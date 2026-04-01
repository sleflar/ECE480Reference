# multi-stage dockerfile for ros2 humble
# build with --target development for dev or --target production for prod

FROM ros:humble AS base

LABEL maintainer="MSU RISSAR Team" \
      description="Docker image for ROS2 Humble workspace"

ENV DEBIAN_FRONTEND=noninteractive
ENV ROS_DOMAIN_ID=7
ENV ROS_LOCALHOST_ONLY=0
ENV RMW_IMPLEMENTATION=rmw_fastrtps_cpp

# install common dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    python3-colcon-common-extensions \
    python3-rosdep \
    build-essential \
    git \
    vim \
    wget \
    tmux \
    sudo \
    curl \
    iputils-ping \
    libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

# install ros2 humble packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ros-humble-cv-bridge \
    ros-humble-sensor-msgs \
    ros-humble-std-msgs \
    ros-humble-rclpy \
    ros-humble-rosbridge-suite \
    ros-humble-rosbridge-server \
    ros-humble-rosapi \
    ros-humble-rosapi-msgs \
    ros-humble-rmw-cyclonedds-cpp \
    ros-humble-rmw-fastrtps-cpp \
    ros-humble-serial-driver \
    ros-humble-asio-cmake-module \
    python3-numpy \
    python3-opencv \
    python3-ament-package \
    && rm -rf /var/lib/apt/lists/*

# install Python dependencies for ROS2 packages
RUN pip3 install --no-cache-dir \
    pynmeagps \
    pyserial \
    requests \
    pyrealsense2 \
    matplotlib \
    pyvesc \
    pythoncrc \
    hidapi \
    rplidar-roboticia \
    'numpy<2'

# Reinstall opencv-python to ensure compatibility with NumPy 1.x
RUN pip3 install --no-cache-dir --force-reinstall opencv-python

# create user with consistent uid
ARG USERNAME=rissar
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && echo "$USERNAME:password" | chpasswd \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# setup ros2 workspace structure
RUN mkdir -p /home/$USERNAME/ros2_humble /home/$USERNAME/ros2_ws
RUN ln -s /opt/ros/humble /home/$USERNAME/ros2_humble/install

# create backward compatibility symlink for legacy /home/vu references
RUN if [ "$USERNAME" != "vu" ]; then \
        ln -s /home/$USERNAME /home/vu; \
    fi

WORKDIR /home/$USERNAME/ros2_ws

# copy source code
COPY --chown=$USERNAME:$USERNAME src/ src/

# setup bashrc
RUN echo "source /home/$USERNAME/ros2_humble/install/setup.bash" >> /home/$USERNAME/.bashrc && \
    echo "cd /home/$USERNAME/ros2_ws" >> /home/$USERNAME/.bashrc && \
    echo "if [ -f install/setup.bash ]; then source install/setup.bash; fi" >> /home/$USERNAME/.bashrc && \
    echo "export ROS_DOMAIN_ID=7" >> /home/$USERNAME/.bashrc && \
    echo "export ROS_LOCALHOST_ONLY=0" >> /home/$USERNAME/.bashrc && \
    echo "export RMW_IMPLEMENTATION=rmw_fastrtps_cpp" >> /home/$USERNAME/.bashrc && \
    echo "export ROS_DISCOVERY_SERVER=192.168.8.201:11811" >> /home/$USERNAME/.bashrc && \
    echo "export FASTRTPS_DEFAULT_PROFILES_FILE=/home/$USERNAME/ros2_ws/fastdds_discovery.xml" >> /home/$USERNAME/.bashrc



ARG USERNAME=rissar

USER $USERNAME

WORKDIR /home/rissar

# ============================================
# development stage
# ============================================
FROM base AS development

# ensure worksapce has correct permissions
USER root 

RUN chown -R $USERNAME:$USERNAME /home/$USERNAME/ros2_ws

USER $USERNAME

# health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ros2 node list > /dev/null 2>&1 || exit 1

CMD ["/bin/bash"]

# ============================================
# production stage
# ============================================
FROM base AS production

ARG USERNAME=rissar

USER $USERNAME

# build the ros2 workspace
RUN --mount=type=cache,target=/home/$USERNAME/.cache/ccache \
    . /opt/ros/humble/setup.sh && \
    colcon build --symlink-install

# update bashrc to source the built workspace
RUN echo "source /opt/ros/humble/setup.bash" >> /home/$USERNAME/.bashrc
RUN echo "source /home/$USERNAME/ros2_ws/install/setup.bash" >> /home/$USERNAME/.bashrc

# health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ros2 node list > /dev/null 2>&1 || exit 1

CMD ["/bin/bash"]
