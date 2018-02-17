FROM node:8
EXPOSE 80

ADD dist app

RUN npm install -g http-server

CMD [ "http-server", "-p", "80", "app" ]