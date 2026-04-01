from setuptools import find_packages, setup

package_name = 'recorder_node'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='rissar',
    maintainer_email='rissar@todo.todo',
    description='TODO: Package description',
    license='TODO: License declaration',
    extras_require={
        'test': [
            'pytest',
        ],
    },
    entry_points={
        'console_scripts': [
            'bag_recorder_node=recorder_node.bag_recorder_node:main',
            'bag_player_node=recorder_node.bag_player_node:main',
        ],
    },
)
