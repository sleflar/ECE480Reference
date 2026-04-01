# multi-stage dockerfile for react frontend
# build with --target development for dev or --target production for prod

FROM node:22-alpine AS base

LABEL maintainer="MSU RISSAR Team" \
      description="Docker image for RISSAR dashboard frontend"

WORKDIR /rissar-frontend

# copy package files for better layer caching
COPY package*.json ./

# ============================================
# development stage
# ============================================
FROM base AS development

# install all dependencies (including devdependencies)
RUN npm install

# copy application code
COPY . .

EXPOSE 5173

# run development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ============================================
# production stage
# ============================================
FROM base AS production

# install only production dependencies
RUN npm ci --only=production

# copy application code
COPY . .

# build the application
RUN npm run build

# install serve to run the production build
RUN npm install -g serve

EXPOSE 3000

# health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# serve the production build
CMD ["serve", "-s", "dist", "-l", "3000"]