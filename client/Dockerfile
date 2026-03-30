FROM node:22-alpine as app
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY ./package.json .
COPY ./package-lock.json .

RUN npm install

COPY ./ .

FROM app as builder
WORKDIR /usr/src/app
RUN npm run build

FROM nginx:1.23.3-alpine
COPY --from=builder /usr/src/app/build/ /usr/share/nginx/html/
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
