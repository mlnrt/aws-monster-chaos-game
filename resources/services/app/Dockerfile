# Dockerfile implementing Node best practices -> 
# https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/
# and
# https://github.com/silvestriluca/zombie-drivers-node-aws/blob/develop/services/gateway/Dockerfile

# --------------> The build image
FROM public.ecr.aws/docker/library/node:18.9.0 AS build
# Install dumb-init (5. Properly handle events to safely terminate a Node.js Docker web application)
RUN apt-get -y update
# Set env variable to production
ENV NODE_ENV production
# Create app directory
WORKDIR /usr/src/app
# Install app dependencies
COPY --chown=node:node package*.json ./
# Install dependencies
RUN npm ci --only=production

# --------------> The production image
FROM public.ecr.aws/docker/library/node:18.9.0-alpine
ARG app_path
ARG app_port
ARG app_health_check_path
# Install dumb-init
RUN apk add --update dumb-init curl
# Set env variable to production
ENV NODE_ENV production
# Sets limited user (node)
USER node
# Create app directory
WORKDIR /usr/src/app
# Copy libraires/node modules
COPY --chown=node:node --from=build /usr/src/app/node_modules /usr/src/app/node_modules
# Bundle app source
COPY --chown=node:node . /usr/src/app
RUN sed -i "s|<APP-PATH>|$app_path|g" /usr/src/app/index.html
RUN sed -i "s|<APP-PATH>|$app_path|g" /usr/src/app/server.js
RUN sed -i "s|<APP-HEALTH-CHECK-PATH>|$app_health_check_path|g" /usr/src/app/server.js
# Open ports
EXPOSE 3000
# Set env variables
ENV PORT=$app_port
ENV HOST=0.0.0.0
# Starts service

CMD [ "dumb-init", "node", "server.js" ]
