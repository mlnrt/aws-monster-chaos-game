FROM public.ecr.aws/nginx/nginx:alpine-arm64v8
# NGINX configuration
ARG nginx_port
ARG nginx_health_check_path
ARG app_name
ARG app_path
ARG app_namespace
ARG app_port
COPY nginx.conf /etc/nginx/nginx.conf
RUN sed -i "s|<NGINX-PORT>|$nginx_port|g" /etc/nginx/nginx.conf
RUN sed -i "s|<NGINX-HEALTH-CHECK-PATH>|$nginx_health_check_path|g" /etc/nginx/nginx.conf
RUN sed -i "s|<APP-NAME>|$app_name|g" /etc/nginx/nginx.conf
RUN sed -i "s|<APP-PATH>|$app_path|g" /etc/nginx/nginx.conf
RUN sed -i "s|<APP-NAMESPACE>|$app_namespace|g" /etc/nginx/nginx.conf
RUN sed -i "s|<APP-PORT>|$app_port|g" /etc/nginx/nginx.conf