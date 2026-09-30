FROM node:22-alpine
WORKDIR /app
COPY docker/minio-init.mjs ./s3-init.mjs
CMD ["node", "s3-init.mjs"]
