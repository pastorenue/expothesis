# Build stage
FROM node:20-alpine as builder

WORKDIR /app

COPY package.json .
# We don't have package-lock.json yet as we didn't run npm install
# COPY package-lock.json .

RUN npm install

COPY . .

RUN npm run build

# Runtime stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config to handle client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
