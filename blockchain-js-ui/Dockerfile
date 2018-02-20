FROM node:8
EXPOSE 443

ADD dist app
ADD cert.pem cert.pem
ADD key.pem key.pem

RUN npm install -g http-server

CMD [ "http-server", "app", "-p", "443", "--ssl" ]