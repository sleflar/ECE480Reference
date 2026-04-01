from setuptools import find_packages, setup

package_name = 'imu_visualizer'

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
        'pyrealsense2',
        'matplotlib',
    ],
    zip_safe=True,
    maintainer='vu',
    maintainer_email='vu@todo.todo',
    description='TODO: Package description',
    license='TODO: License declaration',
    tests_require=['pytest'],
    entry_points={
    'console_scripts': [
        'imu_publisher = imu_visualizer.imu_publisher:main',
        'imu_subscriber = imu_visualizer.imu_subscriber:main',
        'imu_recorder = imu_visualizer.imu_recorder:main',
        'imu_replay = imu_visualizer.imu_replay:main',
    	],
    },

)
