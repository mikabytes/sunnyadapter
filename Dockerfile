FROM node:23.6.0

RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    xvfb \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY ./index.js /app/
COPY ./battery.js /app/
COPY ./package.json /app/
COPY ./package-lock.json /app/
COPY ./IsSame.js /app/

WORKDIR /app

RUN npm i

CMD xvfb-run --auto-servernum --server-args='-screen 0 1280x800x24' node index.js
