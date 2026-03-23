FROM node:20-bullseye AS builder

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

RUN npm ci

COPY . .

RUN npm run build --workspace frontend


FROM node:20-bullseye AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 python3-pip make g++ sqlite3 \
  && rm -rf /var/lib/apt/lists/*

# OpenCV + NumPy for backend/scripts/crop_perspective.py (4-point crop in extract-from-images & crop routes)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip3 install --upgrade pip setuptools wheel \
  && pip3 install --no-cache-dir -r backend/requirements.txt \
  && rm -rf /root/.cache/pip

ENV PORT=8097
ENV DB_PATH=/data/recipe-library.db
ENV STATIC_DIR=/app/public
ENV NODE_ENV=production

COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

RUN npm ci --omit=dev --workspace backend

COPY backend ./backend
COPY --from=builder /app/frontend/dist ./public
COPY docker/entrypoint.js /app/entrypoint.js

EXPOSE 8097
CMD ["node", "/app/entrypoint.js"]
