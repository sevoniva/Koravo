FROM nginx:1.27-alpine
COPY koravo-ui/dist /usr/share/nginx/html
COPY deploy/docker/koravo-ui.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
