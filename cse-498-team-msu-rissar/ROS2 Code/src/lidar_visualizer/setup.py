from setuptools import find_packages, setup

package_name = 'lidar_visualizer'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=[
        'setuptools',
        'matplotlib',
        'rplidar'
    ],
    zip_safe=True,
    maintainer='vu',
    maintainer_email='vu@todo.todo',
    description='TODO: Package description',
    license='TODO: License declaration',
    tests_require=['pytest'],
    entry_points={
    'console_scripts': [
        'lidar_publisher = lidar_visualizer.lidar_publisher:main',
        'lidar_subscriber = lidar_visualizer.lidar_subscriber:main',
        'lidar_replay = lidar_visualizer.lidar_replay:main',
        'lidar_record = lidar_visualizer.lidar_record:main'
    ],
},
)
