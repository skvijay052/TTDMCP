FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json playwright.config.ts ./
COPY src ./src
COPY profiles ./profiles

RUN npm run build

RUN apt-get update \
  && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify nginx gettext-base \
  && rm -rf /var/lib/apt/lists/*

COPY docker/start.sh /usr/local/bin/start-ttdmcp
COPY docker/nginx.conf.template /etc/nginx/nginx.conf.template
RUN chmod +x /usr/local/bin/start-ttdmcp

ENV NODE_ENV=production
ENV TTD_HEADLESS=false
ENV TTD_BROWSER_PROFILE=/var/data/browser-profile
ENV TTD_SCREENSHOTS=/var/data/screenshots
ENV MCP_PORT=10001
ENV BROWSER_ACCESS_TOKEN=

RUN mkdir -p /var/data/browser-profile /var/data/screenshots

EXPOSE 10000

CMD ["start-ttdmcp"]
