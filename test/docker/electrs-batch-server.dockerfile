FROM node:8

WORKDIR /home/node/app

RUN npm install -g electrs-batch-server

CMD electrs-batch-server
