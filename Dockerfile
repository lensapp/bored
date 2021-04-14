FROM node:14-alpine as build

RUN mkdir /app
WORKDIR /app

COPY . /app
RUN apk add --update python gcc g++ make && \
    yarn install --frozen-lockfile && \
    yarn dist && \
    yarn install --frozen-lockfile --prod

FROM node:14-alpine

RUN mkdir /app
WORKDIR /app

COPY package.json yarn.lock ./
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

ENTRYPOINT [ "/usr/local/bin/node" ]
CMD ["/app/dist/index.js"]
