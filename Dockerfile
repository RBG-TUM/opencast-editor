FROM node:16-alpine3.14 as deps
COPY package.json /package.json
COPY package-lock.json /package-lock.json
RUN npm install


FROM node:16-alpine3.14 as builder
RUN apk add --update-cache git
WORKDIR /app
COPY --from=deps /node_modules node_modules
COPY package.json .
COPY package-lock.json .
COPY src/ src
COPY public/ public
COPY tsconfig.json .
COPY config-overrides.js .
COPY .git/ .git

RUN ls -la
RUN npm run build


FROM nginx:1.15-alpine
COPY --from=builder /app/build /usr/share/nginx/html
