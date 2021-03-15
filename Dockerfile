FROM node:14-alpine as build

RUN mkdir /app
WORKDIR /app

COPY . /app
RUN yarn install --frozen-lockfile && yarn dist

FROM node:14-alpine

RUN mkdir /app
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --prod
COPY --from=build /app/dist /app/dist

ENTRYPOINT [ "/usr/local/bin/node" ]
CMD ["/app/dist/index.js"]
