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

CMD ["sh", "-lc", "printf '%s' \"$ER_AUTHORITY_KEYPAIR_B64\" | base64 -d > /tmp/er-authority-keypair.json && chmod 600 /tmp/er-authority-keypair.json && export ER_AUTHORITY_KEYPAIR_PATH=/tmp/er-authority-keypair.json && node dist/index.js"]
