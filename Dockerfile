FROM node:20-bookworm-slim
WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 8000
CMD ["npm", "start"]
