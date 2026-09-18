/**
 * 카페24 207(Multi-Status) 개별 실패 사유 진단 자동 검증. (네트워크 호출 없음)
 *
 *   node scripts/verify-cafe24-multi-status.mjs
 *
 * 실제로 받은 응답과 같은 상황(요청 10건 · 성공 6건 · 실패 4건)을 가짜 207 본문으로 만들어
 * 개별 실패 사유가 끝까지 보존되는지 확인합니다. 실제 POST는 하지 않습니다.
 *
 * 확인하는 것
 *  1. 207 본문에서 성공 항목과 실패 항목을 분리해 읽는지
 *  2. 실패 항목마다 index·리뷰글번호·code·message·parameter/field/reason을 뽑는지
 *  3. 위치값의 시작이 0인지 1인지 대조로 확정하고, 애매하면 특정하지 않는지
 *  4. 사유를 주지 않았으면 만들어 내지 않고 규정된 문구를 쓰는지
 *  5. 요청값 반향·개인정보가 사유에 남지 않는지 (기존 masking 재사용)
 *  6. 라우트·화면이 이 값을 실제로 표시하고, 등록·중단 정책은 그대로인지
 *
 * app/lib/cafe24의 multiStatus·errorDetail은 순수 함수 모듈이라 임시 폴더에 컴파일해 그대로 불러옵니다.
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

const outDir = mkdtempSync(path.join(tmpdir(), 'cafe24-207-'));
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
const IMAGE_URL = `${SCHEME}example.com/review/sample_01.jpg`;
const WRITER = '검증작성자';
const CONTENT = '검증용 리뷰 본문입니다.';
const CLIENT_IP = '8.8.8.8';

/** 한 묶음 10건의 가짜 리뷰글번호. 앞 6건 성공 · 뒤 4건 실패 상황을 만듭니다. */
const REVIEW_IDS = [
  '9100000001',
  '9100000002',
  '9100000003',
  '9100000004',
  '9100000005',
  '9100000006',
  '9100000007',
  '9100000008',
  '9100000009',
  '9100000010',
];

const SUCCESS_COUNT = 6;
const SUCCESS_IDS = REVIEW_IDS.slice(0, SUCCESS_COUNT);
const FAILED_IDS = REVIEW_IDS.slice(SUCCESS_COUNT);
const FAILED_INDEXES = [6, 7, 8, 9];

/** 카페24가 돌려주는 성공 항목 형태 */
const successArticles = SUCCESS_IDS.map((naverpay_review_id, index) => ({
  shop_no: 1,
  article_no: 900 + index,
  naverpay_review_id,
}));

/** 실제 등록 라우트가 만드는 것과 같은 조회 문맥 (성공 6건 확인 · 실패 4건 미확인) */
const context = {
  requestCount: REVIEW_IDS.length,
  naverReviewIdByIndex: REVIEW_IDS,
  unconfirmedIndexes: FAILED_INDEXES,
};

try {
  writeFileSync(path.join(outDir, 'package.json'), '{ "type": "module" }\n');

  execFileSync(
    process.execPath,
    [
      tscBin,
      path.join(cafe24Dir, 'multiStatus.ts'),
      path.join(cafe24Dir, 'errorDetail.ts'),
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

  for (const file of readdirSync(outDir).filter((name) => name.endsWith('.js'))) {
    const full = path.join(outDir, file);
    const rewritten = readFileSync(full, 'utf8').replace(
      /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
      (match, head, target, tail) => (target.endsWith('.js') ? match : `${head}${target}.js${tail}`)
    );
    writeFileSync(full, rewritten);
  }

  const load = async (name) => import(pathToFileURL(path.join(outDir, name)).href);

  const {
    CAFE24_MULTI_STATUS,
    CAFE24_NO_MULTI_STATUS_REASON,
    attributeCafe24MultiStatusFailures,
    extractCafe24MultiStatusReport,
  } = await load('multiStatus.js');
  const { CAFE24_NO_FIELD_DETAIL_MESSAGE, formatCafe24ErrorDetailForLog, redactCafe24ErrorDetail } =
    await load('errorDetail.js');

  /** 실제 라우트와 같은 순서로 읽고 → 자리를 맞추는 도우미 */
  const diagnose = (body, status = CAFE24_MULTI_STATUS, ctx = context) => {
    const report = extractCafe24MultiStatusReport(body, status, ctx.requestCount);
    return { report, attribution: attributeCafe24MultiStatusFailures(report.failures, ctx) };
  };

  /** 자리를 맞춘 결과를 `리뷰글번호 → 사유` 형태로 바꿉니다. */
  const reasonByReviewId = (attribution) => {
    const out = {};
    for (const [index, failure] of attribution.byIndex) {
      out[REVIEW_IDS[index]] = failure.detail;
    }
    return out;
  };

  console.log('\n[1] 0부터 시작하는 위치값을 준 207 응답');

  /** 실제로 받은 상황과 같은 형태. 카페24가 실패 항목만 따로 담아 준 경우입니다. */
  const zeroBasedBody = {
    shop_no: 1,
    articles: successArticles,
    error: {
      received_message: [
        { index: 6, code: '422', message: 'Duplicate naverpay_review_id.' },
        { index: 7, code: '422', message: 'Invalid product_no.' },
        { index: 8, code: '422', message: 'Invalid created_date.' },
        { index: 9, code: '422', message: 'Invalid attach_file_urls.' },
      ],
    },
  };

  const zeroBased = diagnose(zeroBasedBody);

  check('성공 항목과 실패 항목을 분리해서 셉니다', () => {
    assert.equal(zeroBased.report.isMultiStatus, true);
    assert.equal(zeroBased.report.successCount, SUCCESS_COUNT);
    assert.equal(zeroBased.report.failures.length, FAILED_IDS.length);
    assert.equal(zeroBased.report.reasonsMissing, false);
  });
  check('위치값의 시작을 0으로 확정합니다', () => {
    assert.equal(zeroBased.attribution.indexBase, 0);
    assert.equal(zeroBased.attribution.unattributed.length, 0);
  });
  check('실패 4건이 실제 실패한 리뷰글번호에 붙습니다', () => {
    assert.deepEqual([...zeroBased.attribution.byIndex.keys()].sort((a, b) => a - b), FAILED_INDEXES);
    assert.deepEqual(Object.keys(reasonByReviewId(zeroBased.attribution)).sort(), [...FAILED_IDS].sort());
  });
  check('건별로 index·code·message를 그대로 뽑습니다', () => {
    const first = zeroBased.attribution.byIndex.get(6);
    assert.equal(first.reportedIndex, 6);
    assert.equal(first.detail.status, 207);
    assert.equal(first.detail.code, '422');
    assert.equal(first.detail.message, 'Duplicate naverpay_review_id.');

    assert.equal(zeroBased.attribution.byIndex.get(9).detail.message, 'Invalid attach_file_urls.');
  });
  check('성공한 6건에는 실패 사유가 붙지 않습니다', () => {
    for (const index of [0, 1, 2, 3, 4, 5]) {
      assert.equal(zeroBased.attribution.byIndex.has(index), false);
    }
  });
  check('터미널 한 줄에 status·code·message가 모두 남습니다', () => {
    const line = formatCafe24ErrorDetailForLog(zeroBased.attribution.byIndex.get(7).detail);
    assert.ok(line.includes('status: 207'));
    assert.ok(line.includes('code: 422'));
    assert.ok(line.includes('Invalid product_no.'));
  });

  console.log('\n[2] 1부터 시작하는 위치값도 대조로 확정');
  const oneBased = diagnose({
    articles: successArticles,
    errors: [
      { seq: 7, code: 'invalid_request', message: 'Invalid request.' },
      { seq: 8, code: 'invalid_request', message: 'Invalid request.' },
      { seq: 9, code: 'invalid_request', message: 'Invalid request.' },
      { seq: 10, code: 'invalid_request', message: 'Invalid request.' },
    ],
  });

  check('시작값 1로 확정하고 같은 4건에 붙입니다', () => {
    assert.equal(oneBased.attribution.indexBase, 1);
    assert.deepEqual([...oneBased.attribution.byIndex.keys()].sort((a, b) => a - b), FAILED_INDEXES);
    assert.equal(oneBased.attribution.unattributed.length, 0);
  });

  console.log('\n[3] 어느 건인지 애매하면 특정하지 않습니다');

  /** 위치값 7·8은 0부터로 봐도, 1부터로 봐도 실패한 자리에 들어맞아 단정할 수 없습니다. */
  const ambiguous = diagnose({
    articles: successArticles,
    error: {
      received_message: [
        { index: 7, code: '422', message: 'Invalid product_no.' },
        { index: 8, code: '422', message: 'Invalid created_date.' },
      ],
    },
  });

  check('0부터·1부터 모두 들어맞으면 위치를 정하지 않습니다', () => {
    assert.equal(ambiguous.attribution.indexBase, null);
    assert.equal(ambiguous.attribution.byIndex.size, 0);
    assert.equal(ambiguous.attribution.unattributed.length, 2);
  });
  check('특정하지 못한 사유도 버리지 않고 그대로 남깁니다', () => {
    assert.deepEqual(
      ambiguous.attribution.unattributed.map((failure) => failure.detail.message),
      ['Invalid product_no.', 'Invalid created_date.']
    );
    assert.deepEqual(
      ambiguous.attribution.unattributed.map((failure) => failure.reportedIndex),
      [7, 8]
    );
  });
  check('등록이 확인된 자리로 계산된 사유는 붙이지 않습니다', () => {
    const conflicting = diagnose({
      articles: successArticles,
      error: { received_message: [{ index: 0, code: '422', message: 'Invalid writer.' }] },
    });

    assert.equal(conflicting.attribution.byIndex.size, 0);
    assert.equal(conflicting.attribution.unattributed.length, 1);
  });

  console.log('\n[4] 리뷰글번호를 직접 준 응답은 그 값으로 맞춥니다');
  const byReviewId = diagnose({
    articles: successArticles,
    errors: [
      { naverpay_review_id: FAILED_IDS[2], code: '422', message: 'Invalid created_date.' },
      { naverpay_review_id: FAILED_IDS[0], code: '422', message: 'Duplicate naverpay_review_id.' },
    ],
  });

  check('위치값이 없어도 리뷰글번호로 자리를 찾습니다', () => {
    assert.equal(byReviewId.attribution.unattributed.length, 0);
    assert.equal(byReviewId.attribution.byIndex.get(8).detail.message, 'Invalid created_date.');
    assert.equal(byReviewId.attribution.byIndex.get(6).detail.message, 'Duplicate naverpay_review_id.');
  });

  console.log('\n[5] 요청 수와 길이가 같은 배열은 자리로 맞춥니다');
  const alignedEntries = REVIEW_IDS.map((_id, index) =>
    FAILED_INDEXES.includes(index) ? { code: '422', message: 'Invalid request.' } : null
  );

  const aligned = diagnose({ articles: successArticles, errors: alignedEntries });

  check('빈 자리는 건너뛰고 실패한 자리만 읽습니다', () => {
    assert.equal(aligned.report.failures.length, FAILED_IDS.length);
    assert.deepEqual([...aligned.attribution.byIndex.keys()].sort((a, b) => a - b), FAILED_INDEXES);
    assert.equal(aligned.attribution.unattributed.length, 0);
  });

  console.log('\n[6] parameter/field/reason도 그대로 뽑습니다');
  const withFields = diagnose({
    articles: successArticles,
    error: {
      received_message: [
        {
          index: 6,
          code: '422',
          message: 'An invalid request is entered.',
          more_info: [
            { parameter: 'client_ip', reason: 'Invalid IP address.' },
            { field: 'created_date', message: 'Invalid date format.' },
          ],
        },
      ],
    },
  });

  check('필드별 사유가 목록으로 들어옵니다', () => {
    const detail = withFields.attribution.byIndex.get(6).detail;
    assert.deepEqual(detail.fields, [
      'client_ip: Invalid IP address.',
      'created_date: Invalid date format.',
    ]);
    assert.equal(detail.message, 'An invalid request is entered.');
  });
  check('필드 사유가 터미널 한 줄에도 남습니다', () => {
    const line = formatCafe24ErrorDetailForLog(withFields.attribution.byIndex.get(6).detail);
    assert.ok(line.includes('client_ip: Invalid IP address.'));
    assert.ok(!line.includes(CAFE24_NO_FIELD_DETAIL_MESSAGE));
  });

  console.log('\n[7] 사유를 주지 않았으면 만들어 내지 않습니다');
  check('실패 목록이 없는 207은 사유 없음으로 알려 줍니다', () => {
    const noReason = diagnose({ shop_no: 1, articles: successArticles });

    assert.equal(noReason.report.isMultiStatus, true);
    assert.equal(noReason.report.failures.length, 0);
    assert.equal(noReason.report.reasonsMissing, true);
    assert.equal(noReason.attribution.byIndex.size, 0);
  });
  check('빈 껍데기 항목은 사유로 세지 않습니다', () => {
    const emptyEntries = diagnose({
      articles: successArticles,
      error: { received_message: [{}, { index: 7 }, null, ''] },
    });

    assert.equal(emptyEntries.report.failures.length, 0);
    assert.equal(emptyEntries.report.reasonsMissing, true);
  });
  check('규정된 문구를 그대로 씁니다', () => {
    assert.equal(CAFE24_NO_MULTI_STATUS_REASON, 'Cafe24 207 응답에 개별 실패 사유가 없습니다.');
    assert.equal(CAFE24_MULTI_STATUS, 207);
  });

  console.log('\n[8] 개인정보·요청값이 사유에 남지 않습니다');

  /** 카페24가 우리가 보낸 요청을 그대로 되돌려 준 경우 (실제로 겪은 형태) */
  const echoBody = {
    articles: successArticles,
    error: {
      received_message: [
        {
          index: 6,
          code: '422',
          message: `Invalid value for writer ${WRITER} from ${CLIENT_IP} (${IMAGE_URL})`,
          more_info: {
            writer: WRITER,
            content: CONTENT,
            client_ip: CLIENT_IP,
            naverpay_review_id: FAILED_IDS[0],
            attach_file_urls: [{ name: 'sample_01.jpg', url: IMAGE_URL }],
          },
        },
      ],
    },
  };

  const echo = diagnose(echoBody);

  check('요청값 반향은 필드 사유로 올라오지 않습니다', () => {
    assert.deepEqual(echo.attribution.byIndex.get(6).detail.fields, []);
  });
  check('사유 문장의 주소·IP·이름이 지워집니다', () => {
    const raw = echo.attribution.byIndex.get(6).detail;
    const redacted = redactCafe24ErrorDetail(raw, [
      WRITER,
      CONTENT,
      CLIENT_IP,
      IMAGE_URL,
      'sample_01.jpg',
      ...FAILED_IDS,
    ]);
    const line = formatCafe24ErrorDetailForLog(redacted);

    for (const leaked of [WRITER, CONTENT, CLIENT_IP, IMAGE_URL, 'example.com', FAILED_IDS[0]]) {
      assert.ok(!line.includes(leaked), `사유에 보낸 값이 남았습니다: ${leaked}`);
    }
    // 사람이 읽을 문장 구조는 남아 있어야 진단에 쓸 수 있습니다.
    assert.ok(line.includes('Invalid value for writer'));
  });
  check('리뷰글번호는 masking 전에도 사유 문장에 들어가지 않습니다', () => {
    const detail = echo.attribution.byIndex.get(6).detail;
    // sanitizeCafe24ErrorText가 긴 숫자를 이미 [number]로 바꿉니다.
    assert.ok(!detail.message.includes(FAILED_IDS[0]));
    assert.ok(detail.message.includes('[ip]'));
    assert.ok(detail.message.includes('[url]'));
  });

  console.log('\n[9] 소스 수준 확인 (라우트·화면 표시와 정책 유지)');
  const registerSource = readFileSync(
    path.join(repoRoot, 'app/api/review-migration/cafe24/reviews/register/route.ts'),
    'utf8'
  );
  const componentSource = readFileSync(
    path.join(repoRoot, 'app/review-migration/components/Cafe24ReviewRegister.tsx'),
    'utf8'
  );
  const adminApiSource = readFileSync(path.join(cafe24Dir, 'adminApi.ts'), 'utf8');
  const multiStatusSource = readFileSync(path.join(cafe24Dir, 'multiStatus.ts'), 'utf8');
  const batchOutcomeSource = readFileSync(path.join(cafe24Dir, 'batchOutcome.ts'), 'utf8');
  const registerRunSource = readFileSync(path.join(cafe24Dir, 'registerRun.ts'), 'utf8');

  check('라우트가 207 본문을 읽어 자리를 맞춥니다', () => {
    assert.ok(
      registerSource.includes(
        'extractCafe24MultiStatusReport(response.data, response.status, articles.length)'
      )
    );
    assert.ok(registerSource.includes('attributeCafe24MultiStatusFailures(multiStatus.failures, {'));
  });
  check('라우트가 개발 환경 터미널에 개별 사유를 남깁니다', () => {
    assert.ok(registerSource.includes('logMultiStatusFailures('));
    assert.ok(registerSource.includes('formatCafe24ErrorDetailForLog(detail)'));
    assert.ok(registerSource.includes('if (!isCafe24DebugEnabled()) return;'));
  });
  check('사유는 보낸 값을 지운 뒤에만 남기고 내려보냅니다', () => {
    assert.ok(registerSource.includes('devRegisterErrorDetail(failure.detail, validated.reviews, articles)'));
    assert.ok(!registerSource.includes('JSON.stringify(response.data)'));
    assert.ok(!registerSource.includes('console.error(response.data'));
  });
  check('화면이 건별 사유와 특정 불가 사유를 모두 보여 줍니다', () => {
    assert.ok(componentSource.includes('item.devDetail'));
    assert.ok(componentSource.includes('CAFE24_NO_MULTI_STATUS_REASON'));
    // 특정하지 못한 사유는 묶음별 진단 요약에 그대로 남습니다.
    assert.ok(componentSource.includes('info.unattributed.map('));
    assert.ok(componentSource.includes('batchDiagnostics.map('));
  });
  check('등록 payload와 경로는 그대로입니다', () => {
    assert.ok(registerSource.includes('body: { shop_no: 1, requests: articles }'));
    assert.ok(registerSource.includes('/api/v2/admin/boards/${boardNo}/articles'));
    assert.ok(!/^\s*board_no\s*:/m.test(registerSource));
  });
  check('등록 성공 판정과 실패 코드는 그대로입니다', () => {
    assert.ok(registerSource.includes('const created = readCreatedArticles(response.data);'));
    // 결과 불명확 코드는 결과 목록을 만드는 batchOutcome.ts로 옮겼습니다. (문구는 그대로)
    assert.ok(batchOutcomeSource.includes("code: failureConfirmed ? 'cafe24_rejected' : 'not_confirmed'"));
    assert.ok(registerSource.includes("outcome: failedCount > 0 ? 'partial' : 'applied'"));
  });
  check('재시도·중단 정책은 그대로입니다', () => {
    /**
     * 결과가 전부 설명된 묶음에서만 다음 묶음으로 넘어갑니다.
     * 실패한 리뷰를 같은 실행에서 다시 보내는 경로는 없습니다.
     */
    assert.ok(registerRunSource.includes('if (!outcome.data.canContinue) {'));
    assert.ok(componentSource.includes('runCafe24RegisterBatches({'));
    for (const retry of ['retry(', 'retryCount', 'for (let attempt']) {
      assert.ok(!registerRunSource.includes(retry), `진행기에 재시도 코드가 있습니다: ${retry}`);
    }
    assert.ok(registerSource.includes("kind === 'unknown_result'"));
    assert.ok(adminApiSource.includes("kind: 'unknown_result'"));
  });
  check('207은 여전히 성공 응답으로 다룹니다 (거절 경로를 새로 만들지 않았습니다)', () => {
    assert.ok(adminApiSource.includes('if (!response.ok) {'));
    assert.ok(!adminApiSource.includes('207'));
  });
  check('컴파일 결과에 네트워크 호출이 없습니다', () => {
    const needles = ['fet' + 'ch(', 'XMLHttp' + 'Request', 'cafe24' + 'api.com'];
    for (const file of ['multiStatus.js', 'errorDetail.js']) {
      const compiled = readFileSync(path.join(outDir, file), 'utf8');
      for (const needle of needles) {
        assert.ok(!compiled.includes(needle), `${file}에 네트워크 코드가 있습니다: ${needle}`);
      }
    }
    assert.ok(!multiStatusSource.includes('process.env'));
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

console.log('\n모든 검증 통과 (카페24 API 호출 없음 · 실제 등록 없음)');
