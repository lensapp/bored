FROM node:16-alpine as build

RUN mkdir /app
WORKDIR /app

COPY . /app
RUN apk add --update python3 gcc g++ make && \
    yarn install --frozen-lockfile && \
    yarn dist && \
    yarn install --frozen-lockfile --prod

FROM node:16-alpine

RUN mkdir /app \
  && addgroup -S bored && adduser -S bored -G bored
WORKDIR /app

COPY package.json yarn.lock ./
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

USER bored
ENTRYPOINT [ "/usr/local/bin/node" ]
CMD ["/app/dist/index.js"]
