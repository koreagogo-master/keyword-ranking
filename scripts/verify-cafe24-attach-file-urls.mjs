/**
 * 카페24 전송 payload 규격(첨부 하위 키·board_no 위치)과 오류 진단 표시 자동 검증. (네트워크 호출 없음)
 *
 *   node scripts/verify-cafe24-attach-file-urls.mjs
 *
 * 확인하는 것
 *  1. attach_file_urls 항목이 공식 규격 `{ name, url }`로 만들어지고 직렬화되는지
 *  2. 전송 JSON이 `{ shop_no: 1, requests: [...] }`이고 requests[0]에 board_no가 없는지
 *     (board_no는 PATH 파라미터라 POST 경로에만 들어갑니다)
 *  3. 이미지가 없으면 attach_file_urls 키 자체가 없는지
 *  4. 첨부·board_no 말고 다른 payload 필드는 그대로인지
 *  5. 오류 봉투가 error(단수)든 errors(복수)든 code·message를 읽는지
 *  6. more_info의 요청값 반향이 필드 오류로 표시되지 않는지
 *  7. 기존 개인정보 마스킹이 유지되는지
 *
 * app/lib/cafe24의 reviewPayload·errorDetail·trialRegister는 순수 함수 모듈이라
 * 로컬 typescript로 임시 폴더에 컴파일해 그대로 불러올 수 있습니다.
 * 이 스크립트는 네트워크를 한 번도 쓰지 않으므로 카페24에도, 이미지 주소에도 요청이 나가지 않습니다.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cafe24Dir = path.join(repoRoot, 'app', 'lib', 'cafe24');
const tscBin = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

const outDir = mkdtempSync(path.join(tmpdir(), 'cafe24-attach-'));
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

/** 검증용 가짜 값. 실제 리뷰·작성자·이미지가 아닙니다. */
const SCHEME = 'ht' + 'tps://';
const IMAGE_HOST = 'example.com';
const IMAGE_URL = `${SCHEME}${IMAGE_HOST}/review/sample_01.jpg`;
const SECOND_IMAGE_URL = `${SCHEME}${IMAGE_HOST}/review/sample_02.png`;
const WRITER = '검증작성자';
const CONTENT = '검증용 리뷰 본문입니다.';
const NAVER_REVIEW_ID = '1234567890';
const CLIENT_IP = '8.8.8.8';

/** 검증에 쓰는 게시판번호. 기본 상품후기 게시판과 같은 값입니다. */
const BOARD_NO = 4;

/**
 * 공식 요청 본문 requests[] 필드 목록.
 * board_no는 PATH 파라미터라서 이 목록에 없습니다. (그래서 전송 payload에 있으면 규격 밖 키가 됩니다)
 */
const OFFICIAL_REQUEST_FIELDS = [
  'writer',
  'title',
  'content',
  'client_ip',
  'created_date',
  'rating',
  'product_no',
  'naverpay_review_id',
  'sales_channel',
  'input_channel',
  'attach_file_urls',
];

try {
  writeFileSync(path.join(outDir, 'package.json'), '{ "type": "module" }\n');

  execFileSync(
    process.execPath,
    [
      tscBin,
      path.join(cafe24Dir, 'reviewPayload.ts'),
      path.join(cafe24Dir, 'errorDetail.ts'),
      path.join(cafe24Dir, 'trialRegister.ts'),
      '--outDir',
      outDir,
      '--module',
      'esnext',
      '--moduleResolution',
      'bundler',
      '--target',
      'es2022',
      '--strict',
      '--skipLibCheck',
      '--removeComments',
    ],
    { stdio: 'inherit' }
  );

  /**
   * bundler 해석으로 컴파일하면 상대 import에 확장자가 없어 node ESM이 찾지 못합니다.
   * 임시 폴더의 산출물에만 `.js`를 붙여 그대로 불러올 수 있게 합니다.
   */
  for (const file of readdirSync(outDir).filter((name) => name.endsWith('.js'))) {
    const full = path.join(outDir, file);
    const rewritten = readFileSync(full, 'utf8').replace(
      /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
      (match, head, target, tail) => (target.endsWith('.js') ? match : `${head}${target}.js${tail}`)
    );
    writeFileSync(full, rewritten);
  }

  const load = async (name) => import(pathToFileURL(path.join(outDir, name)).href);

  const { buildArticleRequest, extractImageAttachments } = await load('reviewPayload.js');
  const {
    CAFE24_NO_FIELD_DETAIL_MESSAGE,
    extractCafe24ErrorCode,
    extractCafe24ErrorDetail,
    formatCafe24ErrorDetailForLog,
    redactCafe24ErrorDetail,
    sanitizeCafe24ErrorText,
  } = await load('errorDetail.js');
  const { buildTrialRegisterBody, parseCafe24Attachments } = await load('trialRegister.js');

  const source = (imageRaw) => ({
    naverReviewId: NAVER_REVIEW_ID,
    cafe24ProductNo: 69,
    productName: '검증용 상품명',
    content: CONTENT,
    rating: 5,
    writer: WRITER,
    registeredAt: '2026.07.01. 08:47:18',
    imageRaw,
  });

  const options = { boardNo: BOARD_NO, clientIp: CLIENT_IP, salesChannel: null };

  const withImage = buildArticleRequest(source(IMAGE_URL), options);
  const withoutImage = buildArticleRequest(source(''), options);

  assert.equal(withImage.ok, true, '이미지 리뷰 payload를 만들지 못했습니다.');
  assert.equal(withoutImage.ok, true, '이미지 없는 리뷰 payload를 만들지 못했습니다.');

  console.log('\n[1] 첨부 하위 키가 공식 규격 name인지');
  check('extractImageAttachments가 { name, url }만 만듭니다', () => {
    const { attachments } = extractImageAttachments(IMAGE_URL);
    assert.equal(attachments.length, 1);
    assert.deepEqual(Object.keys(attachments[0]).sort(), ['name', 'url']);
    assert.deepEqual(attachments[0], { name: 'sample_01.jpg', url: IMAGE_URL });
  });
  check('payload의 attach_file_urls 항목이 { name, url }입니다', () => {
    assert.deepEqual(withImage.article.attach_file_urls, [
      { name: 'sample_01.jpg', url: IMAGE_URL },
    ]);
  });
  check('여러 장도 모두 name 키를 씁니다', () => {
    const { attachments } = extractImageAttachments(`${IMAGE_URL} ${SECOND_IMAGE_URL}`);
    assert.equal(attachments.length, 2);
    for (const attachment of attachments) {
      assert.deepEqual(Object.keys(attachment).sort(), ['name', 'url']);
    }
  });
  check('파일명 생성 규칙은 그대로입니다 (확장자·안전문자·쿼리 유지)', () => {
    const { attachments } = extractImageAttachments(`${SCHEME}${IMAGE_HOST}/a/b%20c!.JPG?type=w800`);
    assert.equal(attachments.length, 1);
    // 안전하지 않은 문자는 _로 바뀌고 확장자는 유지되며, url의 쿼리는 그대로 남습니다.
    assert.equal(attachments[0].name, 'b_c_.JPG');
    assert.ok(attachments[0].url.endsWith('?type=w800'));
  });
  check('이미지가 아닌 주소는 그대로 제외합니다', () => {
    const result = extractImageAttachments(`${SCHEME}${IMAGE_HOST}/review/page`);
    assert.equal(result.attachments.length, 0);
    assert.ok(result.skippedReason);
  });

  console.log('\n[2] 실제 전송 JSON 구조 (최상위 · requests · board_no 위치)');

  /** 등록 라우트가 카페24로 보내는 것과 같은 형태. 시험 등록은 딱 한 건입니다. */
  const trialBody = { shop_no: 1, requests: [withImage.article] };
  const trialJson = JSON.stringify(trialBody);
  const requestJson = JSON.stringify(trialBody.requests[0]);

  /** POST 경로. 게시판번호는 본문이 아니라 이 PATH에 들어갑니다. */
  const postPath = `/api/v2/admin/boards/${BOARD_NO}/articles`;

  check('최상위 구조는 { shop_no: 1, requests: [...] }입니다', () => {
    assert.deepEqual(Object.keys(trialBody).sort(), ['requests', 'shop_no']);
    assert.equal(trialBody.shop_no, 1);
    assert.ok(Array.isArray(trialBody.requests));
  });
  check('시험 등록의 requests 길이는 1입니다', () => {
    assert.equal(trialBody.requests.length, 1);
    assert.equal(buildTrialRegisterBody(source(IMAGE_URL)).reviews.length, 1);
  });
  check('직렬화된 requests[0]에 board_no가 없습니다', () => {
    assert.ok(!('board_no' in trialBody.requests[0]), 'payload에 board_no 키가 있습니다.');
    assert.ok(!requestJson.includes('board_no'), '직렬화된 JSON에 board_no가 있습니다.');
    assert.ok(!JSON.stringify(withoutImage.article).includes('board_no'));
  });
  check('POST 경로에는 게시판번호 4가 들어갑니다', () => {
    assert.equal(postPath, '/api/v2/admin/boards/4/articles');
    assert.ok(postPath.includes(String(BOARD_NO)));
    assert.ok(/\/boards\/4\/articles$/.test(postPath));
  });
  check('전송 필드가 공식 요청 필드의 부분집합이고 규격 밖 키가 0개입니다', () => {
    for (const article of [withImage.article, withoutImage.article]) {
      const unknown = Object.keys(article).filter((key) => !OFFICIAL_REQUEST_FIELDS.includes(key));
      assert.deepEqual(unknown, [], `규격 밖 키가 있습니다: ${unknown.join(', ')}`);
    }
  });
  check('JSON 어디에도 하위 키 filename이 없습니다', () => {
    assert.ok(!trialJson.includes('filename'), 'JSON에 filename이 남아 있습니다.');
  });
  check('JSON에 name 키가 실제로 들어갑니다', () => {
    assert.ok(trialJson.includes('"attach_file_urls":[{"name":"sample_01.jpg"'));
  });
  check('첨부는 배열이고 항목은 정확히 { name, url }입니다', () => {
    assert.ok(Array.isArray(withImage.article.attach_file_urls));
    assert.equal(withImage.article.attach_file_urls.length, 1);
    for (const attachment of withImage.article.attach_file_urls) {
      assert.deepEqual(Object.keys(attachment).sort(), ['name', 'url']);
    }
    assert.deepEqual(withImage.article.attach_file_urls, [
      { name: 'sample_01.jpg', url: IMAGE_URL },
    ]);
  });
  check('카페24가 돌려준 name도 그대로 읽습니다', () => {
    assert.deepEqual(parseCafe24Attachments([{ name: 'sample_01.jpg', url: IMAGE_URL }]), [
      { name: 'sample_01.jpg', url: IMAGE_URL },
    ]);
  });

  console.log('\n[3] 이미지가 없으면 attach_file_urls 키 자체가 없는지');
  check('키가 아예 없습니다 (빈 배열도 아닙니다)', () => {
    assert.ok(!('attach_file_urls' in withoutImage.article));
    assert.ok(!JSON.stringify(withoutImage.article).includes('attach_file_urls'));
  });

  console.log('\n[4] 첨부·board_no 말고 다른 payload 필드는 그대로인지');
  check('첨부를 뺀 나머지가 완전히 같습니다', () => {
    const rest = { ...withImage.article };
    delete rest.attach_file_urls;
    assert.deepEqual(rest, withoutImage.article);
  });
  check('전송 키 목록이 공식 필드만으로 정확히 구성됩니다', () => {
    assert.deepEqual(Object.keys(withImage.article).sort(), [
      'attach_file_urls',
      'client_ip',
      'content',
      'created_date',
      'input_channel',
      'naverpay_review_id',
      'product_no',
      'rating',
      'title',
      'writer',
    ]);
  });
  check('게시판번호 선택·검증 기능은 그대로 동작합니다', () => {
    // 정수 게시판번호는 통과하고 (payload에는 담기지 않습니다)
    assert.equal(buildArticleRequest(source(IMAGE_URL), options).ok, true);

    // 쓸 수 없는 번호는 카페24를 호출하기 전에 여기서 막습니다.
    for (const boardNo of [0, -1, 1.5, Number.NaN]) {
      const built = buildArticleRequest(source(IMAGE_URL), { ...options, boardNo });
      assert.equal(built.ok, false, `게시판번호 ${boardNo}를 통과시켰습니다.`);
    }
  });
  check('나머지 필드 값이 규격대로입니다', () => {
    assert.equal(withImage.article.writer, WRITER);
    assert.equal(withImage.article.title, '검증용 상품명');
    assert.equal(withImage.article.client_ip, CLIENT_IP);
    assert.equal(withImage.article.input_channel, 'P');
    assert.equal(withImage.article.product_no, 69);
    assert.equal(withImage.article.naverpay_review_id, NAVER_REVIEW_ID);
    assert.equal(withImage.article.created_date, '2026-07-01T08:47:18+09:00');
    assert.equal(withImage.article.rating, 5);
    assert.ok(withImage.article.content.includes('스마트스토어에서 등록된 구매평'));
    // sales_channel은 운영자가 지정했을 때만 실립니다.
    assert.ok(!('sales_channel' in withImage.article));
  });

  console.log('\n[5] error(단수)와 errors(복수) 양쪽에서 code·message 읽기');
  check('error(단수) 봉투를 읽습니다', () => {
    const body = { error: { code: 422, message: 'Invalid IP address. (parameter.client_ip[0])' } };
    assert.equal(extractCafe24ErrorCode(body), '422');

    const detail = extractCafe24ErrorDetail(body, 422, extractCafe24ErrorCode(body));
    assert.equal(detail.code, '422');
    assert.equal(detail.message, 'Invalid IP address. (parameter.client_ip[0])');
  });
  check('errors(복수) 봉투를 읽습니다', () => {
    const body = { errors: { code: 422, message: 'An invalid request is entered.' } };
    assert.equal(extractCafe24ErrorCode(body), '422');

    const detail = extractCafe24ErrorDetail(body, 422, extractCafe24ErrorCode(body));
    assert.equal(detail.code, '422');
    assert.equal(detail.message, 'An invalid request is entered.');
  });
  check('호출부가 code를 못 찾아도 본문에서 다시 찾습니다', () => {
    const body = { errors: { code: 'invalid_request', message: 'x' } };
    assert.equal(extractCafe24ErrorDetail(body, 422, null).code, 'invalid_request');
  });

  console.log('\n[6] more_info 요청값 반향을 필드 오류로 표시하지 않는지');

  /** 실제로 받았던 422와 같은 형태. more_info가 우리가 보낸 요청을 그대로 되돌려 줍니다. */
  const echoBody = {
    errors: {
      code: 422,
      message: 'An invalid request is entered.',
      more_info: {
        board_no: 4,
        writer: WRITER,
        title: '검증용 상품명',
        content: CONTENT,
        client_ip: CLIENT_IP,
        input_channel: 'P',
        product_no: 69,
        naverpay_review_id: NAVER_REVIEW_ID,
        created_date: '2026-07-01T08:47:18+09:00',
        rating: 5,
        attach_file_urls: [{ name: 'sample_01.jpg', url: IMAGE_URL }],
      },
    },
  };

  const echoDetail = extractCafe24ErrorDetail(echoBody, 422, extractCafe24ErrorCode(echoBody));

  check('반향은 필드 오류 목록에 들어가지 않습니다', () => {
    assert.deepEqual(echoDetail.fields, []);
  });
  check('진짜 code와 message는 제자리에 들어갑니다', () => {
    assert.equal(echoDetail.code, '422');
    assert.equal(echoDetail.message, 'An invalid request is entered.');
  });
  check('사유가 없으면 규정된 안내 문구를 보여 줍니다', () => {
    assert.equal(
      CAFE24_NO_FIELD_DETAIL_MESSAGE,
      'Cafe24가 구체적인 필드 오류 사유를 제공하지 않았습니다.'
    );
    assert.ok(formatCafe24ErrorDetailForLog(echoDetail).includes(CAFE24_NO_FIELD_DETAIL_MESSAGE));
  });
  check('로그 한 줄에 보낸 값도 필드명 반향도 없습니다', () => {
    const redacted = redactCafe24ErrorDetail(echoDetail, [
      WRITER,
      CONTENT,
      NAVER_REVIEW_ID,
      CLIENT_IP,
      IMAGE_URL,
      'sample_01.jpg',
    ]);
    const line = formatCafe24ErrorDetailForLog(redacted);

    for (const leaked of [WRITER, CONTENT, NAVER_REVIEW_ID, CLIENT_IP, IMAGE_URL, IMAGE_HOST]) {
      assert.ok(!line.includes(leaked), `로그에 보낸 값이 있습니다: ${leaked}`);
    }
    for (const echoed of ['board_no', 'input_channel', 'product_no', 'naverpay_review_id']) {
      assert.ok(!line.includes(echoed), `로그에 요청값 반향이 있습니다: ${echoed}`);
    }
  });

  console.log('\n[7] 명시적인 field + message/reason만 필드 오류로 인정');
  check('{ field, message }는 인정합니다', () => {
    const body = { errors: { more_info: [{ field: 'writer', message: 'Too long.' }] } };
    assert.deepEqual(extractCafe24ErrorDetail(body, 422, null).fields, ['writer: Too long.']);
  });
  check('{ parameter, reason }도 인정하고 깊은 곳까지 찾습니다', () => {
    const body = {
      error: { more_info: { errors: [{ parameter: 'attach_file_urls', reason: 'Cannot read file.' }] } },
    };
    assert.deepEqual(extractCafe24ErrorDetail(body, 422, null).fields, [
      'attach_file_urls: Cannot read file.',
    ]);
  });
  check('사유 없이 이름만 있는 항목은 인정하지 않습니다', () => {
    const body = { errors: { more_info: { attach_file_urls: [{ name: 'sample_01.jpg', url: IMAGE_URL }] } } };
    assert.deepEqual(extractCafe24ErrorDetail(body, 422, null).fields, []);
  });
  check('문자열·숫자 말단값은 오류 사유로 쓰지 않습니다', () => {
    const body = { errors: { more_info: ['sample_01.jpg', 69, WRITER] } };
    assert.deepEqual(extractCafe24ErrorDetail(body, 422, null).fields, []);
  });

  console.log('\n[8] 기존 개인정보 마스킹 유지');
  check('주소·IP·긴 숫자는 계속 가려집니다', () => {
    assert.equal(sanitizeCafe24ErrorText(`see ${IMAGE_URL}`), 'see [url]');
    assert.equal(sanitizeCafe24ErrorText('from 203.0.113.9'), 'from [ip]');
    assert.equal(sanitizeCafe24ErrorText(`id ${NAVER_REVIEW_ID}`), 'id [number]');
  });
  check('필드 오류 사유에서도 보낸 값이 지워집니다', () => {
    const body = {
      errors: { more_info: [{ field: 'writer', message: `Value ${WRITER} is invalid.` }] },
    };
    const detail = extractCafe24ErrorDetail(body, 422, null);
    const redacted = redactCafe24ErrorDetail(detail, [WRITER]);

    assert.deepEqual(redacted.fields, ['writer: Value [redacted] is invalid.']);
    assert.ok(!formatCafe24ErrorDetailForLog(redacted).includes(WRITER));
  });

  console.log('\n[9] 소스 수준 확인 (요청 구조·상한·버전 헤더)');
  const payloadSource = readFileSync(path.join(cafe24Dir, 'reviewPayload.ts'), 'utf8');
  const errorDetailSource = readFileSync(path.join(cafe24Dir, 'errorDetail.ts'), 'utf8');
  const adminApiSource = readFileSync(path.join(cafe24Dir, 'adminApi.ts'), 'utf8');
  const registerSource = readFileSync(
    path.join(repoRoot, 'app/api/review-migration/cafe24/reviews/register/route.ts'),
    'utf8'
  );

  check('MAX_FIELD_ITEMS를 늘리지 않았습니다', () => {
    assert.ok(errorDetailSource.includes('const MAX_FIELD_ITEMS = 10;'));
  });
  check('등록 요청 구조는 그대로입니다', () => {
    assert.ok(registerSource.includes('body: { shop_no: 1, requests: articles }'));
    assert.ok(registerSource.includes('/api/v2/admin/boards/${boardNo}/articles'));
  });
  check('payload를 만드는 코드에 board_no 필드가 없습니다', () => {
    // 주석의 설명(공식 문서·PATH 파라미터 안내)만 남고 실제 필드 대입은 없어야 합니다.
    const assignments = payloadSource.match(/^\s*board_no\s*:/gm);
    assert.equal(assignments, null, 'reviewPayload.ts에 board_no 필드 대입이 남아 있습니다.');
  });
  check('게시판번호를 고르는 규칙은 그대로 씁니다', () => {
    assert.ok(registerSource.includes('const boardNo = resolveReviewBoardNo();'));
    assert.ok(payloadSource.includes('Number.isInteger(options.boardNo)'));
  });
  check('등록·중복·관리자 판정 로직은 그대로입니다', () => {
    assert.ok(registerSource.includes('const admin = await requireAdmin();'));
    assert.ok(registerSource.includes('if (!isSameOrigin(request))'));
    assert.ok(registerSource.includes('validateRegisterReviews(body, CAFE24_ARTICLES_PER_REQUEST)'));
    // 결과 불명확 코드는 결과 목록을 만드는 batchOutcome.ts에 있습니다. (문구는 그대로)
    assert.ok(
      readFileSync(path.join(cafe24Dir, 'batchOutcome.ts'), 'utf8').includes("'not_confirmed'")
    );
    assert.ok(payloadSource.includes('export const CAFE24_ARTICLES_PER_REQUEST = 10;'));
  });
  check('API 버전 헤더를 추가하지 않았습니다', () => {
    for (const s of [adminApiSource, payloadSource, registerSource]) {
      assert.ok(!s.includes('Cafe24-Api-Version'));
    }
  });
  check('컴파일 결과에 네트워크 호출이 없습니다', () => {
    const needles = ['fet' + 'ch(', 'XMLHttp' + 'Request', 'cafe24' + 'api.com'];
    for (const file of ['reviewPayload.js', 'errorDetail.js', 'trialRegister.js']) {
      const compiled = readFileSync(path.join(outDir, file), 'utf8');
      for (const needle of needles) {
        assert.ok(!compiled.includes(needle), `${file}에 네트워크 코드가 있습니다: ${needle}`);
      }
    }
  });
  check('이 스크립트 자체가 네트워크를 쓰지 않습니다', () => {
    const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    for (const needle of ['fet' + 'ch(', 'XMLHttp' + 'Request', 'cafe24' + 'api.com', 'pstatic' + '.net']) {
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

console.log('\n모든 검증 통과 (카페24 API 호출 없음 · 이미지 주소 호출 없음)');
