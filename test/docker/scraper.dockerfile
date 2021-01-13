FROM node:8

WORKDIR /home/node/app

RUN npm install -g ethereum-scraper

COPY scraper.sh /home/scraper.sh

CMD /bin/sh /home/scraper.sh
