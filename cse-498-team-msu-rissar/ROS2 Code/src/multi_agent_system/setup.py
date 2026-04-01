from setuptools import setup, find_packages
import os
from glob import glob

package_name = 'multi_agent_system'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'), glob('launch/*.py')),
        (os.path.join('share', package_name, 'config'), glob('config/*.yaml')),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Christian Wilkins',
    maintainer_email='wilki385@msu.edu',
    description='A simple multi-agent control system for ROS2',
    license='MIT',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'coordinator = multi_agent_system.coordinator:main',
            'agent = multi_agent_system.agent:main',
            'demo = multi_agent_system.demo:main',
        ],
    },
)