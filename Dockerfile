FROM node:8
EXPOSE 9091

ADD node_modules node_modules
ADD target app

CMD [ "node", "app/blockchain-node.js" ]