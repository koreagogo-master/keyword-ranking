import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXY_HOST = process.env.PROXY_HOST;
const PROXY_PORT = process.env.PROXY_PORT;
const PROXY_USER = process.env.PROXY_USER;
const PROXY_PASS = process.env.PROXY_PASS;

if (!PROXY_HOST || !PROXY_PORT || !PROXY_USER || !PROXY_PASS) {
  throw new Error(
    '[proxyConfig] 프록시 환경변수가 설정되지 않았습니다. ' +
    '.env.local에 PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS 를 추가하세요.'
  );
}

export const PROXY_URL = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;

export const proxyAgent = new HttpsProxyAgent(PROXY_URL);

export { PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS };
