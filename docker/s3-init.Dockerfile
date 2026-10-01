FROM node:22-alpine
WORKDIR /app
COPY docker/s3-init.mjs ./s3-init.mjs
CMD ["node", "s3-init.mjs"]
