from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'controller_publisher'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'msg'), glob('msg/*.msg')),
    ],
    install_requires=['setuptools',
                      'rclpy',
                      'hidapi',
                      'geometry_msgs'],
    zip_safe=True,
    maintainer='Jacob Youngerman',
    maintainer_email='younge32@msu.edu',
    description='Package containing the controller publisher node',
    license='TODO: License declaration',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'control_publish = controller_publisher.controller_publisher:main',
        ],
    },
)                