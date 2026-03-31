FROM node:22-alpine
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY ./package.json .
COPY ./package-lock.json .
RUN npm install

COPY ./ .

RUN npm run build

EXPOSE 3000
CMD ["node", "./build/app.js"]
