FROM node:8

WORKDIR /home/node/app

RUN npm install http-proxy

COPY corsproxy.js /home/node/app/corsproxy.js

CMD node corsproxy.js
