# 1. 파이썬 3.9 버전을 기반으로 시작
FROM python:3.9-slim

# 2. 필수 도구 설치 및 구글 크롬 설치 (최신 방식)
# apt-key 대신 설치 파일(.deb)을 직접 다운로드하여 설치합니다.
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    curl \
    gnupg \
    && wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm google-chrome-stable_current_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

# 3. 작업 폴더 설정
WORKDIR /app

# 4. 내 컴퓨터의 파일들을 서버로 복사
COPY . .

# 5. 필요한 라이브러리 설치 (requirements.txt)
RUN pip install --no-cache-dir -r requirements.txt

# 6. 프로그램 실행 (app.py 실행)
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app