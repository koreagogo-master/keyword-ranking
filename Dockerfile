# 1. 파이썬 3.9 버전을 기반으로 시작 (Node.js 아님!)
FROM python:3.9-slim

# 2. 구글 크롬 브라우저 설치 (키워드 검색용 필수)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# 3. 작업 폴더 설정
WORKDIR /app

# 4. 내 컴퓨터의 파일들을 서버로 복사
COPY . .

# 5. 필요한 라이브러리 설치 (requirements.txt)
RUN pip install --no-cache-dir -r requirements.txt

# 6. 프로그램 실행 (app.py 실행)
# 주의: gunicorn을 사용하여 안정적으로 실행합니다.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app