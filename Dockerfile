# 1. 아키텍처 호환성을 위해 플랫폼을 명시합니다.
FROM --platform=linux/amd64 node:20

# 2. 크롬 실행에 필요한 모든 라이브러리를 빠짐없이 설치합니다.
RUN apt-get update && apt-get install -y \
    wget gnupg \
    libgconf-2-4 libxss1 libgbm1 \
    fonts-nanum \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 3. 환경 변수 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 4. 파일 복사
COPY . .

# [핵심] 기존 설정파일(package-lock)까지 지워서 충돌 방지
RUN rm -rf node_modules package-lock.json
RUN npm install
RUN npm install sharp

# 5. 빌드
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 6. 포트 설정 (환경변수 + 강제 실행)
ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

# [최종 해결책] 
# npm run start 대신, 직접 포트 번호를 8080으로 박아서 실행합니다.
CMD ["npx", "next", "start", "-p", "8080"]