FROM node:slim

WORKDIR /app

ADD . /app

RUN npm ci

EXPOSE 3030 3031
