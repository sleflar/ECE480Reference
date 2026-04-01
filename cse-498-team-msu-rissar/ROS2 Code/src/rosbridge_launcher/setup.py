from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'rosbridge_launcher'

setup(
    name=package_name,
    version='1.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'), glob(os.path.join('launch', '*launch.[pxy][yma]*'))),
        (os.path.join('share', package_name, 'config'), glob(os.path.join('config', '*.yaml'))),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Christian Wilkins',
    maintainer_email='wilki385@msu.edu',
    description='Launch configuration for rosbridge WebSocket server for RISSAR project',
    license='MIT',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'rosbridge_test_publisher = rosbridge_launcher.rosbridge_launcher:main',
        ],
    },
)
