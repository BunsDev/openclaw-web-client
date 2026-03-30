FROM node:19-alpine3.16
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY ./package.json .
COPY ./package-lock.json .
RUN npm install

COPY ./ .

RUN npm run build

EXPOSE 3000
CMD sh -c 'node ./build/app.js'
