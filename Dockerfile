# 1. Node.js 18 버전 사용
FROM node:20-slim

# 2. 필수 도구 및 크롬 설치
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm google-chrome-stable_current_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

# 3. 작업 폴더 설정
WORKDIR /app

# 4. 패키지 설치
COPY package.json package-lock.json* ./
RUN npm install

# 5. 소스 복사 및 빌드
COPY . .
# (중요) Next.js가 텔레메트리(데이터 수집)를 끄도록 설정하여 빌드 속도 향상
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 6. 포트 및 호스트 설정 (여기가 핵심!)
# Next.js가 0.0.0.0 주소의 8080 포트를 바라보게 합니다.
ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

# 7. 서버 실행 명령 변경
# npm start 대신 npx next start를 사용하여 포트를 강제로 지정합니다.
CMD ["npx", "next", "start", "-p", "8080"]
# 강제 배포 시도 1