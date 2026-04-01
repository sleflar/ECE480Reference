from setuptools import setup
from glob import glob
import os

package_name = 'start_laptop'

setup(
    name=package_name,
    version='0.0.0',
    packages=[package_name],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Jacob Youngerman',
    maintainer_email='younge32@msu.edu',
    description='Start all laptop nodes',
    license='TODO: License declaration',
    data_files=[
        # Install package.xml to share directory
        ('share/' + package_name, ['package.xml']),
        # Install launch files to share/<package>/launch directory
        ('share/' + package_name + '/launch', glob(os.path.join('launch', '*.py'))),
        # Install ament resource index marker so colcon/ament can find this package
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
    ],
    entry_points={
        'console_scripts': [],
    },
)
