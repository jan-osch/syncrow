FROM node:wheezy

RUN npm install -g debug
ENV DEBUG syncrow:*


RUN mkdir /workdir
ADD ./.syncrow.json /workdir/.syncrow.json

ENV PATH /app/bin:$PATH
EXPOSE 2510

VOLUME /app

WORKDIR /workdir
ENTRYPOINT ["syncrow"]
