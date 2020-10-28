FROM node:8

WORKDIR /home/node/app

RUN npm install -g ethereum-scraper

CMD sleep 10 && ethereum-scraper
