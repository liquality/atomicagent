FROM alpine

WORKDIR /home

RUN apk add curl curl-dev

COPY mine.sh /home/mine.sh

CMD /bin/sh mine.sh
