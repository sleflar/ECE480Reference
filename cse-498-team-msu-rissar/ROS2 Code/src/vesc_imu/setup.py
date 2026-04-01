from setuptools import find_packages, setup

package_name = 'vesc_imu'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        (
            'share/ament_index/resource_index/packages',
            ['resource/' + package_name]
        ),
        (
            'share/' + package_name,
            ['package.xml']
        ),
    ],
    install_requires=[
        'setuptools',
        'pyvesc',
        'pythoncrc',
    ],
    zip_safe=True,
    maintainer='younge32',
    maintainer_email='younge32@todo.todo',
    description='TODO: Package description',
    license='TODO: License declaration',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'imu_publisher = vesc_imu.imu_publisher:main',
            'imu_subscriber = vesc_imu.imu_subscriber:main',
            'imu_recorder = vesc_imu.imu_recorder:main',
            'imu_replay = vesc_imu.imu_replay:main',
        ],
    },
)

