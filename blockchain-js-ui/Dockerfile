FROM node:8
EXPOSE 8080

ADD dist app

RUN npm install -g http-server

CMD [ "http-server", "app", "-p", "8080" ]