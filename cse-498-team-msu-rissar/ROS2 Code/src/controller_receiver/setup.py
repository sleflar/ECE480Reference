from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'controller_receiver'

setup(
    name=package_name,
    version='0.0.1',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools', 'vesc_msgs'], 
    zip_safe=True,
    maintainer='Jacob Youngerman',
    maintainer_email='younge32@msu.edu',
    description='ROS 2 Controller Receiver Node',
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'controller_receiver = controller_receiver.controller_receiver:main',
        ],
    },
)
