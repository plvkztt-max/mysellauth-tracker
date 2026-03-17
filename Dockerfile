FROM node:20-alpine

WORKDIR /app

COPY project/package*.json ./

RUN npm install

COPY project/ ./

COPY public/ ./public/

EXPOSE 3000

CMD ["npm", "start"]