FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json playwright.config.ts ./
COPY src ./src
COPY profiles ./profiles

RUN npm run build

ENV NODE_ENV=production
ENV TTD_HEADLESS=true
ENV TTD_BROWSER_PROFILE=/var/data/browser-profile
ENV TTD_SCREENSHOTS=/var/data/screenshots

RUN mkdir -p /var/data/browser-profile /var/data/screenshots

EXPOSE 10000

CMD ["node", "dist/index.js"]
