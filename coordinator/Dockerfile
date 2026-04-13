FROM node:20-bookworm-slim

WORKDIR /app

COPY sdk ./sdk
COPY coordinator ./coordinator

WORKDIR /app/sdk
RUN npm install
RUN npm run build

WORKDIR /app/coordinator
RUN npm install
RUN npm run build

CMD ["node", "dist/index.js"]
