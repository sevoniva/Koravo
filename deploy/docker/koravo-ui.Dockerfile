FROM node:22-alpine AS build
WORKDIR /workspace
COPY .npmrc ./
COPY koravo-ui/package*.json ./
RUN npm ci --no-audit --no-fund
COPY koravo-ui ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /workspace/dist /usr/share/nginx/html
COPY deploy/docker/koravo-ui.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
