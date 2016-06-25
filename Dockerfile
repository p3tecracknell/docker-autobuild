FROM mhart/alpine-node:6.2.1

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN apk add --update git && rm -rf /var/cache/apk/*

COPY package.json /usr/src/app/
RUN npm install

ENV PORT 3000
EXPOSE 3000

COPY . /usr/src/app

CMD [ "npm", "start" ]
