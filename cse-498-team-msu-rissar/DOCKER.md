# docker setup guide

## overview

this repository uses multi-stage dockerfiles for all components:
- **flask backend**: python api server
- **react frontend**: web dashboard
- **ros2 workspace**: ros2 humble with custom packages

## quick start

### development mode
```bash
# start all services in development mode
docker-compose up

# start specific service
docker-compose up flask-backend
docker-compose up react-frontend
docker-compose up ros2-workspace

# rebuild after changes
docker-compose up --build
```

### production mode
```bash
# start all services in production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# view logs
docker-compose logs -f

# stop all services
docker-compose down
```

## service details

### flask backend
- **dev port**: 8080
- **dev server**: flask development server with hot reload
- **prod server**: gunicorn with 1 worker, 8 threads
- **health check**: `/health` endpoint

### react frontend
- **dev port**: 5173 (vite dev server)
- **prod port**: 3000 (served via `serve`)
- **hot reload**: enabled in development mode

### ros2 workspace
- **base image**: ros:humble
- **user**: rissar (uid: 1000)
- **network**: host mode (required for ros2 discovery)
- **privileged**: yes (required for hardware access)

## building individual images

### backend
```bash
# development
docker build --target development -t rissar-backend:dev "./Local Website"

# production
docker build --target production -t rissar-backend:prod "./Local Website"
```

### frontend
```bash
# development
docker build --target development -t rissar-frontend:dev "./Local Website/rissar-frontend"

# production
docker build --target production -t rissar-frontend:prod "./Local Website/rissar-frontend"
```

### ros2
```bash
# development
docker build --target development --build-arg USERNAME=rissar -t rissar-ros2:dev "./ROS2 Code"

# production
docker build --target production --build-arg USERNAME=rissar -t rissar-ros2:prod "./ROS2 Code"
```

## common commands

```bash
# view running containers
docker-compose ps

# access container shell
docker-compose exec flask-backend bash
docker-compose exec react-frontend sh
docker-compose exec ros2-workspace bash

# view logs
docker-compose logs -f flask-backend
docker-compose logs -f react-frontend
docker-compose logs -f ros2-workspace

# restart service
docker-compose restart flask-backend

# stop all services
docker-compose down

# remove volumes
docker-compose down -v

# rebuild specific service
docker-compose build flask-backend
```

## ros2 specific commands

```bash
# enter ros2 container
docker-compose exec ros2-workspace bash

# inside container - build workspace
cd ~/ros2_ws
colcon build

# source workspace
source install/setup.bash

# list nodes
ros2 node list

# run a node
ros2 run <package_name> <node_name>
```

## troubleshooting

### port already in use
```bash
# find process using port
lsof -i :8080
lsof -i :5173

# kill process
kill -9 <PID>
```

### permission issues
```bash
# fix ownership of ros2 directories
sudo chown -R $USER:$USER "./ROS2 Code/build" "./ROS2 Code/install" "./ROS2 Code/log"
```

### container won't start
```bash
# view detailed logs
docker-compose logs <service-name>

# rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### ros2 nodes not discovering each other
- ensure `network_mode: host` is set for ros2 service
- check `ROS_DOMAIN_ID` matches across all nodes
- verify firewall rules allow multicast traffic

## architecture improvements

the docker setup has been standardized with:

1. **multi-stage builds**: single dockerfile per component with dev/prod targets
2. **consistent base images**: modern, secure base images
3. **non-root users**: all containers run as non-root user (rissar, uid 1000)
4. **health checks**: all services have health checks configured
5. **optimized layers**: proper layer caching and cleanup
6. **security**: no hardcoded passwords, proper permissions
7. **.dockerignore**: excludes unnecessary files from build context

## migration notes

### old dockerfiles (deprecated)
- `Local Website/Dockerfile-dev` → use `--target development`
- `ROS2 Code/Dockerfile-dev` → use `--target development`

### old docker-compose (deprecated)
- `Local Website/docker-compose.yml` → use root `docker-compose.yml`

these files are now ignored by git and should be removed.