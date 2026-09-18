/**
 * 카페24 등록용 client_ip 판별 자동 검증. (네트워크 호출 없음)
 *
 *   node scripts/verify-cafe24-client-ip.mjs
 *
 * app/lib/cafe24/clientIp.ts는 순수 함수 모듈이라 실제 카페24 API를 부르지 않고 검증할 수 있습니다.
 * 이 스크립트는 로컬 typescript로 그 파일만 임시 폴더에 컴파일해 불러오고,
 * 등록·최종 확인 라우트가 카페24 호출 전에 IP를 막는지는 소스 순서로 확인합니다.
 * fetch를 한 번도 쓰지 않으므로 카페24에 어떤 요청도 나가지 않습니다.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFile = path.join(repoRoot, 'app', 'lib', 'cafe24', 'clientIp.ts');
const tscBin = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

const outDir = mkdtempSync(path.join(tmpdir(), 'cafe24-client-ip-'));
let failures = 0;

function check(name, run) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`);
  }
}

try {
  // 컴파일 결과를 ESM으로 읽도록 표시합니다. (임시 폴더라 프로젝트 설정을 물려받지 않습니다)
  writeFileSync(path.join(outDir, 'package.json'), '{ "type": "module" }\n');

  execFileSync(
    process.execPath,
    [
      tscBin,
      sourceFile,
      '--outDir',
      outDir,
      // 프로젝트 tsconfig와 같은 설정으로 맞춥니다.
      '--module',
      'esnext',
      '--moduleResolution',
      'bundler',
      '--target',
      'es2022',
      '--strict',
      '--skipLibCheck',
      // 주석까지 지운 결과로 검사해야 "주석에만 있는 단어"에 속지 않습니다.
      '--removeComments',
    ],
    { stdio: 'inherit' }
  );

  const {
    isPublicIpv4,
    isStrictIpv4,
    normalizeIpv4,
    pickPublicIpv4,
    resolveCafe24ClientIp,
    cafe24ClientIpErrorBody,
    describeCafe24ClientIpSources,
    CAFE24_CLIENT_IP_ERROR_CODE,
    CAFE24_CLIENT_IP_ERROR_MESSAGE,
  } = await import(pathToFileURL(path.join(outDir, 'clientIp.js')).href);

  /** 검증용 공인 IPv4. 실제 사용자 IP가 아니라 공개 DNS 주소를 예시로 씁니다. */
  const PUBLIC_IP = '8.8.8.8';
  const OTHER_PUBLIC_IP = '1.1.1.1';

  const headers = (forwardedFor, realIp = null) => ({ forwardedFor, realIp });

  console.log('\n[1] 정상 공인 IPv4 통과');
  check('공인 IPv4를 그대로 씁니다', () => {
    assert.equal(normalizeIpv4(PUBLIC_IP), PUBLIC_IP);
    assert.equal(isPublicIpv4(PUBLIC_IP), true);
    assert.deepEqual(resolveCafe24ClientIp(headers(PUBLIC_IP), null), {
      ok: true,
      clientIp: PUBLIC_IP,
      source: 'x-forwarded-for',
    });
  });
  check('앞뒤 공백을 지웁니다', () => {
    assert.equal(normalizeIpv4(`   ${PUBLIC_IP}\t`), PUBLIC_IP);
  });
  check('x-real-ip도 씁니다', () => {
    assert.deepEqual(resolveCafe24ClientIp(headers(null, PUBLIC_IP), null), {
      ok: true,
      clientIp: PUBLIC_IP,
      source: 'x-real-ip',
    });
  });

  console.log('\n[2] 쉼표로 연결된 forwarded 값에서 첫 IPv4 선택');
  check('맨 앞 공인 IPv4를 고릅니다', () => {
    assert.equal(pickPublicIpv4(`${PUBLIC_IP}, ${OTHER_PUBLIC_IP}, 10.0.0.1`), PUBLIC_IP);
  });
  check('앞쪽 사설·IPv6는 건너뜁니다', () => {
    assert.equal(pickPublicIpv4(`::1, 10.0.0.1, ${OTHER_PUBLIC_IP}`), OTHER_PUBLIC_IP);
  });
  check('Cloud Run 형태(공인 IP + 내부 프록시)를 처리합니다', () => {
    assert.equal(pickPublicIpv4(`${PUBLIC_IP}, 169.254.1.1, 10.128.0.5`), PUBLIC_IP);
  });

  console.log('\n[3] IPv4-mapped IPv6 변환');
  check('::ffff:8.8.8.8 → 8.8.8.8', () => {
    assert.equal(normalizeIpv4(`::ffff:${PUBLIC_IP}`), PUBLIC_IP);
  });
  check('0:0:0:0:0:ffff:8.8.8.8 → 8.8.8.8', () => {
    assert.equal(normalizeIpv4(`0:0:0:0:0:ffff:${PUBLIC_IP}`), PUBLIC_IP);
  });
  check('[::ffff:8.8.8.8]:52000 → 8.8.8.8', () => {
    assert.equal(normalizeIpv4(`[::ffff:${PUBLIC_IP}]:52000`), PUBLIC_IP);
  });

  console.log('\n[4] 포트가 붙은 IPv4 정규화');
  check('8.8.8.8:443 → 8.8.8.8', () => {
    assert.equal(normalizeIpv4(`${PUBLIC_IP}:443`), PUBLIC_IP);
  });
  check('포트가 붙은 값도 헤더에서 인정합니다', () => {
    assert.equal(pickPublicIpv4(`${PUBLIC_IP}:51234, 10.0.0.1`), PUBLIC_IP);
  });

  console.log('\n[5] ::1과 일반 IPv6 거부');
  for (const value of ['::1', '[::1]', '2001:db8::1', 'fe80::1%eth0', '[2001:db8::1]:443', '::']) {
    check(`거부: ${value}`, () => {
      assert.equal(normalizeIpv4(value), null);
      assert.equal(pickPublicIpv4(value), null);
    });
  }

  console.log('\n[6] 127.0.0.1 및 사설·예약 IP 거부');
  for (const value of [
    '127.0.0.1',
    '0.0.0.0',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '169.254.10.20',
    '100.64.0.1',
    '198.18.0.1',
    '192.0.2.5',
    '198.51.100.5',
    '203.0.113.5',
    '224.0.0.1',
    '255.255.255.255',
  ]) {
    check(`거부: ${value}`, () => {
      // 형식은 IPv4지만 등록용 공인 IP로는 쓰지 않습니다.
      assert.equal(isStrictIpv4(value), true);
      assert.equal(isPublicIpv4(value), false);
      assert.equal(pickPublicIpv4(value), null);
    });
  }
  check('사설 IP만 있으면 등록을 막습니다', () => {
    const result = resolveCafe24ClientIp(headers('10.0.0.1, 192.168.0.5', '127.0.0.1'), null);
    assert.equal(result.ok, false);
    assert.equal(result.code, CAFE24_CLIENT_IP_ERROR_CODE);
  });

  console.log('\n[7] 빈 값과 잘못된 옥텟 거부');
  for (const value of ['', '   ', ',', '1.2.3', '1.2.3.4.5', '256.1.1.1', '1.2.3.300', '01.2.3.4', '1.2.3.-4', 'abc', 'localhost', null, undefined, 12345]) {
    check(`거부: ${JSON.stringify(value)}`, () => {
      assert.equal(normalizeIpv4(value), null);
    });
  }
  check('헤더가 아예 없으면 등록을 막습니다', () => {
    const result = resolveCafe24ClientIp(headers(null, null), null);
    assert.equal(result.ok, false);
    assert.equal(result.code, CAFE24_CLIENT_IP_ERROR_CODE);
  });

  console.log('\n[8] 환경변수 override 정상 처리');
  check('헤더가 없으면 CAFE24_REVIEW_CLIENT_IP를 씁니다', () => {
    assert.deepEqual(resolveCafe24ClientIp(headers(null, null), PUBLIC_IP), {
      ok: true,
      clientIp: PUBLIC_IP,
      source: 'env',
    });
  });
  check('환경변수도 같은 검사를 통과해야 합니다', () => {
    for (const bad of ['127.0.0.1', '::1', '192.168.0.1', 'not-an-ip', '']) {
      assert.equal(resolveCafe24ClientIp(headers(null, null), bad).ok, false);
    }
  });
  check('환경변수의 공백·포트도 정규화합니다', () => {
    assert.equal(resolveCafe24ClientIp(headers(null, null), ` ${PUBLIC_IP}:8080 `).clientIp, PUBLIC_IP);
  });
  check('헤더가 있으면 헤더를 먼저 씁니다', () => {
    const result = resolveCafe24ClientIp(headers(OTHER_PUBLIC_IP), PUBLIC_IP);
    assert.equal(result.source, 'x-forwarded-for');
    assert.equal(result.clientIp, OTHER_PUBLIC_IP);
  });

  console.log('\n[9] 실패 안내와 로그에 IP 값이 없는지');
  check('화면 문구가 규정된 문장으로 시작합니다', () => {
    assert.equal(CAFE24_CLIENT_IP_ERROR_MESSAGE, 'Cafe24 등록에 사용할 공인 IPv4를 확인할 수 없습니다.');
    assert.equal(cafe24ClientIpErrorBody(false).error, CAFE24_CLIENT_IP_ERROR_MESSAGE);
    assert.equal(cafe24ClientIpErrorBody(false).code, CAFE24_CLIENT_IP_ERROR_CODE);
  });
  check('로컬 환경에서는 .env.local 안내를 덧붙입니다', () => {
    const body = cafe24ClientIpErrorBody(true);
    assert.ok(body.error.startsWith(CAFE24_CLIENT_IP_ERROR_MESSAGE));
    assert.ok(body.error.includes('.env.local'));
    assert.ok(body.error.includes('CAFE24_REVIEW_CLIENT_IP'));
  });
  check('안내·로그에 IP 값이 들어가지 않습니다', () => {
    const log = describeCafe24ClientIpSources(headers(`${PUBLIC_IP}, 10.0.0.1`), PUBLIC_IP);
    assert.ok(!log.includes(PUBLIC_IP), '로그에 IP 값이 있습니다.');
    assert.ok(!log.includes('10.0.0.1'), '로그에 IP 값이 있습니다.');
    assert.ok(log.includes('x-forwarded-for: 있음'));

    for (const includeGuide of [true, false]) {
      assert.ok(!cafe24ClientIpErrorBody(includeGuide).error.includes(PUBLIC_IP));
    }
  });

  console.log('\n[10] 라우트가 카페24 호출 전에 막는지 (소스 순서 확인)');
  const registerSource = readFileSync(
    path.join(repoRoot, 'app/api/review-migration/cafe24/reviews/register/route.ts'),
    'utf8'
  );
  const precheckSource = readFileSync(
    path.join(repoRoot, 'app/api/review-migration/cafe24/reviews/register-precheck/route.ts'),
    'utf8'
  );

  check('register가 같은 판별 함수를 씁니다', () => {
    assert.ok(registerSource.includes('resolveCafe24ClientIp('));
    assert.ok(!registerSource.includes('resolveClientIp('), '옛 함수가 남아 있습니다.');
  });
  check('register가 POST 전에 차단합니다', () => {
    const guardAt = registerSource.indexOf('if (!clientIpResult.ok)');
    // import 문이 아니라 실제 호출 지점과 비교합니다.
    const postAt = registerSource.indexOf('await callCafe24Admin');
    assert.ok(guardAt > 0, 'IP 차단 코드가 없습니다.');
    assert.ok(postAt > 0, '카페24 호출 지점을 찾지 못했습니다.');
    assert.ok(guardAt < postAt, 'IP 차단이 카페24 호출보다 뒤에 있습니다.');
  });
  check('precheck가 같은 판별 함수로 미리 막습니다', () => {
    const guardAt = precheckSource.indexOf('resolveCafe24ClientIp(');
    const readAt = precheckSource.indexOf('fetchExistingReviewRecords(');
    assert.ok(guardAt > 0, 'precheck에 IP 검사가 없습니다.');
    assert.ok(guardAt < readAt, 'precheck의 IP 검사가 카페24 조회보다 뒤에 있습니다.');
  });
  check('127.0.0.1 대체가 코드에서 사라졌습니다', () => {
    const payloadSource = readFileSync(path.join(repoRoot, 'app/lib/cafe24/reviewPayload.ts'), 'utf8');
    assert.ok(!payloadSource.includes('FALLBACK_CLIENT_IP'));
    assert.ok(!payloadSource.includes("'127.0.0.1'"));
  });

  console.log('\n[11] 카페24 호출이 없다는 확인');

  /** 검사 문자열이 이 파일에 그대로 남지 않도록 쪼개서 만듭니다. */
  const networkNeedles = ['fet' + 'ch(', 'ht' + 'tp://', 'ht' + 'tps://', 'XMLHttp' + 'Request'];

  check('clientIp.ts 컴파일 결과에 네트워크·환경변수 접근이 없습니다', () => {
    // 주석을 지운 실제 코드로 확인합니다.
    const compiled = readFileSync(path.join(outDir, 'clientIp.js'), 'utf8');
    for (const needle of networkNeedles) {
      assert.ok(!compiled.includes(needle), `네트워크 코드가 있습니다: ${needle}`);
    }
    assert.ok(!compiled.includes('process.' + 'env'), '환경변수를 직접 읽습니다.');
    assert.ok(!compiled.includes('cafe24' + 'api.com'), '카페24 주소가 있습니다.');
  });
  check('이 스크립트 자체가 네트워크를 쓰지 않습니다', () => {
    const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    for (const needle of networkNeedles) {
      assert.ok(!self.includes(needle), `네트워크 코드가 있습니다: ${needle}`);
    }
  });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n실패 ${failures}건`);
  process.exit(1);
}

console.log('\n모든 검증 통과 (카페24 API 호출 없음)');
