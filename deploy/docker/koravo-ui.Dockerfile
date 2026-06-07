FROM node:22-alpine AS build
WORKDIR /workspace
COPY koravo-ui/package*.json ./
RUN npm install
COPY koravo-ui ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 80
