FROM node:8
EXPOSE 8999

ADD node_modules node_modules
ADD dist app
ADD cert.pem cert.pem
ADD key.pem key.pem

CMD [ "node", "app/index.js" ]