# 1. 아키텍처 호환성을 위해 플랫폼을 명시합니다.
FROM --platform=linux/amd64 node:20

# 2. 크롬 실행에 필요한 라이브러리 설치
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

# ★★★ [추가] cloudbuild.yaml에서 던져주는 변수를 받기 위한 설정 ★★★
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NAVER_AD_CUSTOMER_ID
ARG NAVER_AD_ACCESS_LICENSE
ARG NAVER_AD_SECRET_KEY
ARG NAVER_SEARCH_CLIENT_ID
ARG NAVER_SEARCH_CLIENT_SECRET
ARG GOOGLE_ADS_DEVELOPER_TOKEN
ARG GOOGLE_ADS_CLIENT_ID
ARG GOOGLE_ADS_CLIENT_SECRET
ARG GOOGLE_ADS_REFRESH_TOKEN
ARG GOOGLE_ADS_CUSTOMER_ID
ARG GOOGLE_ADS_LOGIN_CUSTOMER_ID

# 전달받은 ARG 값을 빌드 환경의 실제 ENV(환경 변수)로 등록합니다.
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NAVER_AD_CUSTOMER_ID=$NAVER_AD_CUSTOMER_ID
ENV NAVER_AD_ACCESS_LICENSE=$NAVER_AD_ACCESS_LICENSE
ENV NAVER_AD_SECRET_KEY=$NAVER_AD_SECRET_KEY
ENV NAVER_SEARCH_CLIENT_ID=$NAVER_SEARCH_CLIENT_ID
ENV NAVER_SEARCH_CLIENT_SECRET=$NAVER_SEARCH_CLIENT_SECRET
ENV GOOGLE_ADS_DEVELOPER_TOKEN=$GOOGLE_ADS_DEVELOPER_TOKEN
ENV GOOGLE_ADS_CLIENT_ID=$GOOGLE_ADS_CLIENT_ID
ENV GOOGLE_ADS_CLIENT_SECRET=$GOOGLE_ADS_CLIENT_SECRET
ENV GOOGLE_ADS_REFRESH_TOKEN=$GOOGLE_ADS_REFRESH_TOKEN
ENV GOOGLE_ADS_CUSTOMER_ID=$GOOGLE_ADS_CUSTOMER_ID
ENV GOOGLE_ADS_LOGIN_CUSTOMER_ID=$GOOGLE_ADS_LOGIN_CUSTOMER_ID

# Puppeteer 및 시스템 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NEXT_TELEMETRY_DISABLED 1

# 4. 파일 복사 및 설치
COPY . .
RUN rm -rf node_modules package-lock.json
RUN npm install
RUN npm install sharp

# 5. 빌드 (이제 위에서 설정한 ENV 값들을 사용해서 빌드됩니다)
RUN npm run build

# 6. 실행 설정
ENV PORT 8080
ENV HOSTNAME "0.0.0.0"
EXPOSE 8080

CMD ["npx", "next", "start", "-p", "8080"]