FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production

COPY . .

# Expose all service ports
EXPOSE 7000 7001 7002 7003 7004

# Run the startup script
CMD ["npm", "start"]
