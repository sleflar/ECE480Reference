from setuptools import find_packages, setup

package_name = 'gnss_data'

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
        'pynmeagps',
        'pyserial',
        'requests',
    ],
    zip_safe=True,
    maintainer='vu',
    maintainer_email='vu@todo.todo',
    description='TODO: Package description',
    license='TODO: License declaration',
    tests_require=['pytest'],
    entry_points={
    'console_scripts': [
        'gnss_publisher = gnss_data.gnss_publisher:main',
        'gnss_subscriber = gnss_data.gnss_subscriber:main',
    	],
    },

)
