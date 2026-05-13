import puppeteer from 'puppeteer';
import { PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS } from '@/app/lib/proxyConfig';

// 2. 브라우저 실행 함수 (공통 사용)
export async function launchProxyBrowser() {
  const isProduction = process.env.NODE_ENV === 'production';

  // 실행 경로 설정 (배포 vs 로컬)
  const executablePath = isProduction 
    ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable')
    : null;

  console.log(`🚀 브라우저 실행 시도 (환경: ${isProduction ? '배포(Server)' : '로컬(Local)'})`);

  // 실행 옵션 설정
  const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      `--proxy-server=http://${PROXY_HOST}:${PROXY_PORT}`, // 프록시 서버 주입
      '--disable-blink-features=AutomationControlled'
  ];

  // 브라우저 띄우기
  const browser = await puppeteer.launch({
    headless: true, 
    executablePath: executablePath as any,
    args: launchArgs,
    timeout: 30000 
  });

  return browser;
}

// 3. 페이지 설정 함수 (공통 사용 - 인증 및 모바일 위장)
export async function setupPage(page: any) {
  // 프록시 인증
  await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });

  // 모바일 위장 (아이폰 환경)
  await page.setViewport({ width: 390, height: 844 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
}