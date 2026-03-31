FROM node:22-alpine AS app
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY ./package.json .
COPY ./package-lock.json .

RUN npm install

COPY ./ .

FROM app AS builder
WORKDIR /usr/src/app
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /usr/src/app/dist/ /usr/share/nginx/html/
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
