FROM alpine

WORKDIR /home

RUN apk add curl curl-dev jq

COPY miner.sh /home/miner.sh

CMD /bin/sh miner.sh
