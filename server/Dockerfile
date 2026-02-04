# Use official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose port (Cloud Run sets PORT env var, typically 8080)
EXPOSE 8080

# Start command
CMD [ "node", "index.js" ]
