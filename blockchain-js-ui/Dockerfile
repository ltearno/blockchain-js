FROM node:8
EXPOSE 8080

RUN npm install -g http-server

ADD dist app

CMD [ "http-server", "app", "-p", "8080" ]
