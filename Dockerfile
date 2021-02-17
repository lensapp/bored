FROM node:14-alpine as build

RUN mkdir /app
WORKDIR /app

COPY . /app
RUN yarn install && yarn dist

FROM node:14-alpine

RUN mkdir /app
WORKDIR /app

COPY package.json yarn.lock ./
COPY --from=build /app/dist /app/dist

RUN yarn install --prod

ENTRYPOINT [ "/usr/local/bin/node" ]
CMD ["/app/dist/index.js"]
