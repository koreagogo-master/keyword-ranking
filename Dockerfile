# 1. Node.js 18 버전 사용 (파이썬 아님!)
FROM node:18-slim

# 2. 필수 도구 및 구글 크롬 설치 (키워드 검색용)
# 아까 배웠던 최신 방식(deb 파일 직접 다운로드)으로 설치합니다.
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

# 4. 패키지 파일 복사 및 라이브러리 설치 (npm install)
COPY package.json package-lock.json* ./
RUN npm install

# 5. 소스 코드 복사
COPY . .

# 6. Next.js 빌드 (배포용 최적화)
RUN npm run build

# 7. 포트 설정 (Cloud Run은 8080 포트를 사용)
ENV PORT 8080
EXPOSE 8080

# 8. 서버 실행 (Next.js 실행 명령)
CMD ["npm", "start"]