FROM node:22-alpine

WORKDIR /home/node/app

COPY --chown=node:node package*.json ./

RUN NODE_ENV="production" npm ci --omit=dev

# Directories and files excluded via .dockerignore
COPY --chown=node:node . .

# environment settings
ENV NODE_ENV="production"

EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["npm", "start"]
