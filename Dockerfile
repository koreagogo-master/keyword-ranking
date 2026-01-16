# 1. Node.js 20 버전 (Next.js 15 필수)
FROM node:20-slim

# 2. Puppeteer(크롬) 필수 설치
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 3. 작업 폴더
WORKDIR /app

# 4. 파일 복사 및 설치
COPY package.json ./
# Puppeteer 다운로드 방지
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
RUN npm install

# 5. 소스 복사 및 빌드
COPY . .
RUN npm run build

# 6. 실행 설정 (여기가 제일 중요합니다!)
ENV NODE_ENV=production
ENV PORT=8080
# [핵심] 0.0.0.0 설정이 파일 안에 있어야 확실하게 적용됩니다.
ENV HOSTNAME="0.0.0.0"

# 7. 실행 (standalone 모드)
CMD ["node", ".next/standalone/server.js"]