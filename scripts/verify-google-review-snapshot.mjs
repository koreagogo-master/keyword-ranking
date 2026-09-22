/**
 * Google 상품평 피드 스냅샷 자동 검증. (네트워크 호출 없음)
 *
 *   node scripts/verify-google-review-snapshot.mjs
 *
 * 확인하는 것
 *  1. 스냅샷 검증이 거부 사유 8가지를 각각 정확히 잡아내는지
 *  2. force가 suspicious_shrink 하나만 건너뛰고 나머지는 그대로 막는지
 *  3. 정상 XML이 통과하고 byteSize가 맞게 나오는지
 *  4. ETag 생성과 If-None-Match 비교 (W/ 접두, 쉼표 목록, `*`)
 *  5. If-Modified-Since 초 단위 비교
 *  6. If-None-Match가 If-Modified-Since보다 우선하는지
 *  7. 설정값 기본값·범위 밖 되돌리기
 *  8. 메모리 캐시가 해시·id가 모두 같을 때만 값을 돌려주는지
 *  9. 피드 라우트가 실시간 수집으로 폴백하지 않는지 (소스 확인)
 * 10. 예약·수동 진입점의 인증과 force 규칙 (소스 확인)
 * 11. 저장소가 최신 정상 스냅샷을 삭제하지 않는지 (소스 확인)
 * 12. 기존 카페24 업로드 기능과 피드 생성기 파일이 그대로인지 (소스 확인)
 *
 * app/lib/google-reviews의 순수 모듈은 로컬 typescript로 임시 폴더에 컴파일해
 * 그대로 불러올 수 있습니다. 이 스크립트는 네트워크를 한 번도 쓰지 않습니다.
 * 인증 검증에는 가짜 값만 쓰고, 어떤 인증정보도 화면에 찍지 않습니다.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const feedDir = path.join(repoRoot, 'app', 'lib', 'google-reviews');
const tscBin = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

const outDir = mkdtempSync(path.join(tmpdir(), 'google-review-snapshot-'));
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

function readSource(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

// ──────────────────────────────────────────────────────────────
// 순수 모듈 컴파일
// ──────────────────────────────────────────────────────────────
//
// snapshotValidate·feedHttp·snapshotConfig·snapshotCache는 네트워크·DB를 쓰지 않습니다.
// buildFeed는 정상 XML 표본을 만들기 위해 함께 컴파일합니다.

const PURE_MODULES = [
  'snapshotValidate.ts',
  'feedHttp.ts',
  'snapshotConfig.ts',
  'snapshotCache.ts',
  'buildFeed.ts',
  'productMap.ts',
];

writeFileSync(path.join(outDir, 'package.json'), '{ "type": "module" }\n');

execFileSync(
  process.execPath,
  [
    tscBin,
    ...PURE_MODULES.map((name) => path.join(feedDir, name)),
    '--outDir',
    outDir,
    '--module',
    'es2022',
    '--target',
    'es2022',
    '--moduleResolution',
    'bundler',
    '--skipLibCheck',
  ],
  { stdio: 'inherit' }
);

/**
 * bundler 해석으로 컴파일하면 상대 import에 확장자가 없어 node ESM이 찾지 못합니다.
 * 임시 폴더의 산출물에만 `.js`를 붙여 그대로 불러올 수 있게 합니다.
 * (verify-google-review-feed.mjs와 같은 방식입니다)
 */
for (const file of readdirSync(outDir).filter((name) => name.endsWith('.js'))) {
  const full = path.join(outDir, file);
  const rewritten = readFileSync(full, 'utf8').replace(
    /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
    (whole, head, target, tail) => (target.endsWith('.js') ? whole : `${head}${target}.js${tail}`)
  );
  writeFileSync(full, rewritten);
}

async function load(name) {
  return import(pathToFileURL(path.join(outDir, name)).href);
}

const { validateSnapshotXml, SNAPSHOT_REJECT_LABELS, MIN_SNAPSHOT_BYTES } =
  await load('snapshotValidate.js');
const {
  buildFeedETag,
  matchesIfNoneMatch,
  isNotModifiedSince,
  evaluateConditionalRequest,
  toHttpDate,
} = await load('feedHttp.js');
const {
  resolveMinRetainRatio,
  resolveMaxAgeHours,
  resolveFailedRetentionDays,
  snapshotAgeHours,
  DEFAULT_MIN_RETAIN_RATIO,
  DEFAULT_MAX_AGE_HOURS,
  DEFAULT_FAILED_RETENTION_DAYS,
} = await load('snapshotConfig.js');
const { readCachedXml, writeCachedXml, clearCachedXml } = await load('snapshotCache.js');
const { buildGoogleReviewFeed } = await load('buildFeed.js');

// ──────────────────────────────────────────────────────────────
// 표본 XML (검증용 가짜 값입니다. 실제 고객 리뷰가 아닙니다)
// ──────────────────────────────────────────────────────────────

const IDENTITY = { mallId: 'tmgmall01', shopNo: 1, boardNo: 4 };

function sampleReview(articleNo) {
  return {
    articleNo,
    productNo: 35,
    writerRaw: '홍*동',
    contentRaw: '검증용 표본 문장입니다.',
    createdDateRaw: '2026-07-01 08:47:18',
    rating: 5,
    naverReviewId: '',
    hasSmartstoreSource: false,
  };
}

function buildSampleXml(count) {
  const reviews = [];
  for (let i = 1; i <= count; i += 1) reviews.push(sampleReview(i));

  return buildGoogleReviewFeed(reviews, { identity: IDENTITY, summaryComment: false });
}

/** MIN_SNAPSHOT_BYTES(1KB)를 넘기려면 리뷰가 몇 건 필요합니다. */
const SAMPLE = buildSampleXml(12);

const baseInput = {
  xml: SAMPLE.xml,
  includedCount: SAMPLE.includedCount,
  previousReviewCount: null,
  minRetainRatio: 0.9,
  force: false,
};

function expectReject(input, reason) {
  const result = validateSnapshotXml(input);
  assert.equal(result.ok, false, `통과하면 안 되는 입력이 통과했습니다 (${reason})`);
  assert.equal(result.reason, reason);
  assert.equal(result.label, SNAPSHOT_REJECT_LABELS[reason]);
}

console.log('\n[1] 스냅샷 검증');

check('정상 XML은 통과하고 byteSize를 돌려준다', () => {
  const result = validateSnapshotXml(baseInput);
  assert.equal(result.ok, true);
  assert.equal(result.byteSize, Buffer.byteLength(SAMPLE.xml, 'utf8'));
  assert.ok(result.byteSize > MIN_SNAPSHOT_BYTES);
});

check('empty_feed — 리뷰 0건은 거부한다', () => {
  const empty = buildSampleXml(0);
  expectReject({ ...baseInput, xml: empty.xml, includedCount: 0 }, 'empty_feed');
});

check('bad_prolog — XML 선언이 없으면 거부한다', () => {
  expectReject({ ...baseInput, xml: SAMPLE.xml.replace('<?xml version="1.0" encoding="UTF-8"?>\n', '') }, 'bad_prolog');
});

check('bad_terminator — 중간에 끊긴 XML은 거부한다', () => {
  expectReject({ ...baseInput, xml: SAMPLE.xml.slice(0, Math.floor(SAMPLE.xml.length / 2)) }, 'bad_terminator');
});

check('missing_reviews_element — reviews 요소가 없으면 거부한다', () => {
  const broken = SAMPLE.xml.replace('<reviews>', '<items>').replace('</reviews>', '</items>');
  expectReject({ ...baseInput, xml: broken }, 'missing_reviews_element');
});

check('review_count_mismatch — 집계와 XML의 리뷰 수가 다르면 거부한다', () => {
  expectReject({ ...baseInput, includedCount: SAMPLE.includedCount + 1 }, 'review_count_mismatch');
});

check('unexpected_comment — 운영 피드에 진단 주석이 있으면 거부한다', () => {
  const withComment = buildSampleXml(12);
  const commented = buildGoogleReviewFeed(
    Array.from({ length: 12 }, (_, i) => sampleReview(i + 1)),
    { identity: IDENTITY, summaryComment: true }
  );
  assert.ok(commented.xml.includes('<!--'), '표본에 주석이 들어가야 합니다');
  expectReject({ ...baseInput, xml: commented.xml, includedCount: withComment.includedCount }, 'unexpected_comment');
});

check('suspicious_size — 1KB 미만은 거부한다', () => {
  /**
   * 구조 검사는 모두 통과하지만 크기만 미달인 XML입니다.
   * 생성기가 만든 XML은 리뷰 1건이라도 1KB를 넘으므로 여기서는 직접 만듭니다.
   */
  const tiny = '<?xml version="1.0" encoding="UTF-8"?>\n<feed>\n  <reviews>\n    <review></review>\n  </reviews>\n</feed>\n';
  assert.ok(Buffer.byteLength(tiny, 'utf8') < MIN_SNAPSHOT_BYTES);
  expectReject({ ...baseInput, xml: tiny, includedCount: 1 }, 'suspicious_size');
});

check('생성기가 만든 리뷰 1건짜리 피드는 크기 검사에 걸리지 않는다', () => {
  // 크기 하한이 정상적인 소규모 피드를 막아 버리면 안 됩니다.
  const single = buildSampleXml(1);
  assert.ok(
    Buffer.byteLength(single.xml, 'utf8') > MIN_SNAPSHOT_BYTES,
    '리뷰 1건짜리 정상 피드가 크기 하한보다 작습니다'
  );
  const result = validateSnapshotXml({
    ...baseInput,
    xml: single.xml,
    includedCount: single.includedCount,
  });
  assert.equal(result.ok, true);
});

check('suspicious_shrink — 직전 대비 리뷰가 크게 줄면 거부한다', () => {
  expectReject({ ...baseInput, previousReviewCount: 100, minRetainRatio: 0.9 }, 'suspicious_shrink');
});

check('급감 기준 안쪽이면 통과한다', () => {
  const result = validateSnapshotXml({ ...baseInput, previousReviewCount: 13, minRetainRatio: 0.9 });
  assert.equal(result.ok, true);
});

check('직전 스냅샷이 없으면 급감 검사를 하지 않는다', () => {
  const result = validateSnapshotXml({ ...baseInput, previousReviewCount: null });
  assert.equal(result.ok, true);
});

console.log('\n[2] force 규칙');

check('force는 suspicious_shrink를 건너뛴다', () => {
  const result = validateSnapshotXml({ ...baseInput, previousReviewCount: 100, force: true });
  assert.equal(result.ok, true);
});

check('force여도 empty_feed는 막는다', () => {
  const empty = buildSampleXml(0);
  expectReject({ ...baseInput, xml: empty.xml, includedCount: 0, force: true }, 'empty_feed');
});

check('force여도 review_count_mismatch는 막는다', () => {
  expectReject({ ...baseInput, includedCount: SAMPLE.includedCount + 1, force: true }, 'review_count_mismatch');
});

check('force여도 bad_terminator는 막는다', () => {
  expectReject({ ...baseInput, xml: SAMPLE.xml.slice(0, 500), force: true }, 'bad_terminator');
});

console.log('\n[3] ETag와 조건부 요청');

const SHA = 'a'.repeat(64);
const ETAG = buildFeedETag(SHA);

check('ETag는 따옴표로 감싼 sha256이다', () => {
  assert.equal(ETAG, `"${SHA}"`);
});

check('같은 ETag는 일치로 본다', () => {
  assert.equal(matchesIfNoneMatch(ETAG, ETAG), true);
});

check('W/ 접두가 붙어도 일치로 본다 (약한 비교)', () => {
  assert.equal(matchesIfNoneMatch(`W/${ETAG}`, ETAG), true);
});

check('쉼표로 이어진 목록에서 찾아낸다', () => {
  assert.equal(matchesIfNoneMatch(`"other", ${ETAG}, "another"`, ETAG), true);
});

check('* 는 항상 일치로 본다', () => {
  assert.equal(matchesIfNoneMatch('*', ETAG), true);
});

check('다른 ETag는 일치하지 않는다', () => {
  assert.equal(matchesIfNoneMatch(`"${'b'.repeat(64)}"`, ETAG), false);
});

const GENERATED_AT = '2026-09-22T02:30:45.123Z';

check('Last-Modified는 HTTP-date로 바뀐다', () => {
  assert.equal(toHttpDate(GENERATED_AT), new Date(Date.parse(GENERATED_AT)).toUTCString());
});

check('해석할 수 없는 시각은 null이다', () => {
  assert.equal(toHttpDate('not-a-date'), null);
});

check('If-Modified-Since는 초 단위로 비교한다 (밀리초 때문에 200이 되지 않는다)', () => {
  // 생성 시각의 밀리초를 버린 값이 HTTP-date로 나갑니다. 그 값을 그대로 돌려받으면 304여야 합니다.
  const httpDate = toHttpDate(GENERATED_AT);
  assert.equal(isNotModifiedSince(httpDate, GENERATED_AT), true);
});

check('생성 시각이 더 최신이면 변경된 것으로 본다', () => {
  assert.equal(isNotModifiedSince('Mon, 21 Sep 2026 00:00:00 GMT', GENERATED_AT), false);
});

console.log('\n[4] If-None-Match 우선');

check('ETag가 일치하면 304', () => {
  const result = evaluateConditionalRequest({
    ifNoneMatch: ETAG,
    ifModifiedSince: null,
    etag: ETAG,
    generatedAt: GENERATED_AT,
  });
  assert.equal(result, 'not_modified');
});

check('ETag가 다르면 If-Modified-Since가 304 조건이어도 본문을 보낸다', () => {
  const result = evaluateConditionalRequest({
    ifNoneMatch: `"${'c'.repeat(64)}"`,
    // 이 값만 보면 304여야 하지만, If-None-Match가 있으므로 평가하지 않습니다.
    ifModifiedSince: toHttpDate(GENERATED_AT),
    etag: ETAG,
    generatedAt: GENERATED_AT,
  });
  assert.equal(result, 'send_body');
});

check('If-None-Match가 없을 때만 If-Modified-Since를 본다', () => {
  const result = evaluateConditionalRequest({
    ifNoneMatch: null,
    ifModifiedSince: toHttpDate(GENERATED_AT),
    etag: ETAG,
    generatedAt: GENERATED_AT,
  });
  assert.equal(result, 'not_modified');
});

check('조건부 헤더가 없으면 본문을 보낸다', () => {
  const result = evaluateConditionalRequest({
    ifNoneMatch: null,
    ifModifiedSince: null,
    etag: ETAG,
    generatedAt: GENERATED_AT,
  });
  assert.equal(result, 'send_body');
});

check('빈 문자열 헤더는 없는 것으로 본다', () => {
  const result = evaluateConditionalRequest({
    ifNoneMatch: '   ',
    ifModifiedSince: null,
    etag: ETAG,
    generatedAt: GENERATED_AT,
  });
  assert.equal(result, 'send_body');
});

console.log('\n[5] 설정값');

function withEnv(name, value, run) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;

  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

check('설정하지 않으면 기본값을 쓴다', () => {
  withEnv('GOOGLE_REVIEW_FEED_MIN_RETAIN_RATIO', undefined, () => {
    assert.equal(resolveMinRetainRatio(), DEFAULT_MIN_RETAIN_RATIO);
  });
  withEnv('GOOGLE_REVIEW_FEED_MAX_AGE_HOURS', undefined, () => {
    assert.equal(resolveMaxAgeHours(), DEFAULT_MAX_AGE_HOURS);
  });
  withEnv('GOOGLE_REVIEW_FEED_FAILED_RETENTION_DAYS', undefined, () => {
    assert.equal(resolveFailedRetentionDays(), DEFAULT_FAILED_RETENTION_DAYS);
  });
});

check('올바른 값은 그대로 쓴다', () => {
  withEnv('GOOGLE_REVIEW_FEED_MIN_RETAIN_RATIO', '0.5', () => {
    assert.equal(resolveMinRetainRatio(), 0.5);
  });
  withEnv('GOOGLE_REVIEW_FEED_FAILED_RETENTION_DAYS', '7', () => {
    assert.equal(resolveFailedRetentionDays(), 7);
  });
});

check('범위 밖·해석 불가는 기본값으로 되돌린다', () => {
  for (const bad of ['-1', '2', 'abc', '']) {
    withEnv('GOOGLE_REVIEW_FEED_MIN_RETAIN_RATIO', bad, () => {
      assert.equal(resolveMinRetainRatio(), DEFAULT_MIN_RETAIN_RATIO);
    });
  }
  withEnv('GOOGLE_REVIEW_FEED_FAILED_RETENTION_DAYS', '0', () => {
    assert.equal(resolveFailedRetentionDays(), DEFAULT_FAILED_RETENTION_DAYS);
  });
});

check('스냅샷 나이를 시간 단위로 계산한다', () => {
  const now = Date.parse('2026-09-22T12:00:00.000Z');
  assert.equal(snapshotAgeHours('2026-09-22T09:00:00.000Z', now), 3);
  assert.equal(snapshotAgeHours('not-a-date', now), null);
});

console.log('\n[6] 메모리 캐시');

check('id와 해시가 모두 같을 때만 값을 돌려준다', () => {
  clearCachedXml();
  assert.equal(readCachedXml('id-1', SHA), null);

  writeCachedXml('id-1', SHA, '<feed/>');
  assert.equal(readCachedXml('id-1', SHA), '<feed/>');

  // 새 스냅샷이 저장되면 id가 달라지므로 캐시를 쓰지 않습니다.
  assert.equal(readCachedXml('id-2', SHA), null);
  // 같은 id인데 내용이 바뀌는 경우도 해시로 걸러집니다.
  assert.equal(readCachedXml('id-1', 'd'.repeat(64)), null);

  clearCachedXml();
  assert.equal(readCachedXml('id-1', SHA), null);
});

console.log('\n[7] 피드 라우트 (소스 확인)');

const feedRoute = readSource(path.join('app', 'google-product-reviews.xml', 'route.ts'));

check('실시간 수집(loadGoogleReviewFeed)으로 폴백하지 않는다', () => {
  assert.ok(
    !feedRoute.includes('loadGoogleReviewFeed'),
    '피드 라우트는 카페24를 직접 부르면 안 됩니다'
  );
});

check('스냅샷 저장소와 캐시를 쓴다', () => {
  assert.ok(feedRoute.includes('readLatestReadyMeta'));
  assert.ok(feedRoute.includes('readSnapshotXml'));
  assert.ok(feedRoute.includes('readCachedXml'));
});

check('Basic 인증이 그대로 남아 있다', () => {
  assert.ok(feedRoute.includes('resolveFeedCredentials'));
  assert.ok(feedRoute.includes('verifyFeedBasicAuth'));
  assert.ok(feedRoute.includes('FEED_AUTH_CHALLENGE'));
  // 인증정보 미설정 503, 인증 실패 401이 그대로여야 합니다.
  assert.ok(feedRoute.includes("textResponse('Feed is not configured.', 503)"));
  assert.ok(feedRoute.includes("textResponse('Authentication required.', 401"));
});

check('no-store가 아니라 no-cache를 쓴다 (304를 쓰기 위해)', () => {
  assert.ok(feedRoute.includes("'Cache-Control': 'private, no-cache, must-revalidate'"));
  assert.ok(!feedRoute.includes("'Cache-Control': 'private, no-store'"));
});

check('ETag·Last-Modified·304를 돌려준다', () => {
  assert.ok(feedRoute.includes('buildFeedETag'));
  assert.ok(feedRoute.includes('evaluateConditionalRequest'));
  assert.ok(feedRoute.includes('status: 304'));
});

check('스냅샷이 없으면 Retry-After와 함께 503을 돌려준다', () => {
  assert.ok(feedRoute.includes("'Retry-After'"));
  assert.ok(feedRoute.includes("textResponse('Review feed is not ready yet.', 503"));
});

check('나이를 이유로 제공을 거부하지 않는다', () => {
  // 오래된 스냅샷은 경고 로그만 남기고 그대로 내보냅니다.
  const staleBlock = feedRoute.slice(feedRoute.indexOf('ageHours > maxAgeHours'));
  assert.ok(!staleBlock.slice(0, 400).includes('return textResponse'));
});

console.log('\n[8] 갱신 진입점 (소스 확인)');

const scheduledRoute = readSource(
  path.join('app', 'api', 'google-reviews', 'snapshot', 'refresh', 'route.ts')
);
const manualRoute = readSource(
  path.join('app', 'api', 'review-migration', 'google-reviews', 'snapshot', 'refresh', 'route.ts')
);
const statusRoute = readSource(
  path.join('app', 'api', 'review-migration', 'google-reviews', 'snapshot', 'status', 'route.ts')
);

check('예약 진입점은 POST만 제공한다', () => {
  assert.ok(scheduledRoute.includes('export async function POST'));
  assert.ok(!scheduledRoute.includes('export async function GET'));
});

check('예약 진입점은 토큰을 확인하고 force를 쓰지 않는다', () => {
  assert.ok(scheduledRoute.includes('verifyRefreshToken'));
  assert.ok(scheduledRoute.includes("source: 'scheduled'"));
  assert.ok(scheduledRoute.includes('force: false'));
});

check('관리자 진입점은 출처와 관리자 권한을 모두 확인한다', () => {
  assert.ok(manualRoute.includes('isSameOrigin'));
  assert.ok(manualRoute.includes('requireAdmin'));
  assert.ok(manualRoute.includes('export async function POST'));
  assert.ok(!manualRoute.includes('export async function GET'));
});

check('상태 라우트는 관리자만 볼 수 있고 xml을 읽지 않는다', () => {
  assert.ok(statusRoute.includes('requireAdmin'));
  assert.ok(!statusRoute.includes('readSnapshotXml'));
});

console.log('\n[9] 저장소 (소스 확인)');

const store = readSource(path.join('app', 'lib', 'google-reviews', 'snapshotStore.ts'));

check('메타 조회 컬럼에 xml이 들어 있지 않다', () => {
  const metaBlock = store.slice(store.indexOf('const META_COLUMNS'), store.indexOf('const RUN_COLUMNS'));
  assert.ok(!/'xml'/.test(metaBlock), 'META_COLUMNS에 xml이 들어가면 안 됩니다');
});

check('갱신은 UPDATE가 아니라 INSERT다', () => {
  assert.ok(store.includes('.insert({'));
  // 스냅샷 테이블을 UPDATE 하는 코드가 없어야 합니다. (잠금 테이블만 UPDATE 합니다)
  const snapshotBlock = store.slice(0, store.indexOf('// 갱신 잠금'));
  assert.ok(!snapshotBlock.includes('.update('), '스냅샷 행을 수정하면 안 됩니다');
});

check('정리는 최신 5개를 반드시 남긴다', () => {
  assert.ok(store.includes('SNAPSHOT_KEEP_READY_COUNT = 5'));
  assert.ok(store.includes('.range(SNAPSHOT_KEEP_READY_COUNT'));
});

check('실패 기록은 보존 기간이 지난 것만 지운다', () => {
  assert.ok(store.includes(".eq('status', 'failed')"));
  assert.ok(store.includes(".lt('generated_at', cutoff)"));
});

check('잠금 해제는 같은 lock_owner일 때만 한다', () => {
  const releaseBlock = store.slice(store.indexOf('export async function releaseSnapshotLock'));
  assert.ok(releaseBlock.includes(".eq('lock_owner', owner)"));
});

check('잠금 획득은 비었거나 기간이 지난 것만 가져간다', () => {
  const acquireBlock = store.slice(
    store.indexOf('export async function acquireSnapshotLock'),
    store.indexOf('export async function releaseSnapshotLock')
  );
  assert.ok(acquireBlock.includes('locked_until.is.null'));
  assert.ok(acquireBlock.includes('locked_until.lt.'));
  assert.ok(acquireBlock.includes('lock_owner: owner'));
});

console.log('\n[10] 갱신기 (소스 확인)');

const refresh = readSource(path.join('app', 'lib', 'google-reviews', 'refreshSnapshot.ts'));

check('검증을 통과한 뒤에만 저장한다', () => {
  const validateAt = refresh.indexOf('validateSnapshotXml(');
  const insertAt = refresh.indexOf('insertReadySnapshot(');
  assert.ok(validateAt > 0 && insertAt > validateAt, '검증이 저장보다 앞서야 합니다');
});

check('수집·검증 실패 시 실패 기록만 남기고 저장하지 않는다', () => {
  const collectBlock = refresh.slice(refresh.indexOf('if (!loaded.ok)'), refresh.indexOf('// 2.'));
  assert.ok(collectBlock.includes('recordFailure'));
  assert.ok(!collectBlock.includes('insertReadySnapshot'));
});

check('운영 피드용이라 진단 주석을 넣지 않는다', () => {
  assert.ok(refresh.includes('summaryComment: false'));
});

check('잠금을 얻지 못하면 카페24를 부르지 않는다', () => {
  const lockBlock = refresh.slice(refresh.indexOf('if (!lock.acquired)'), refresh.indexOf('try {'));
  assert.ok(lockBlock.includes("kind: 'locked'"));
  assert.ok(!lockBlock.includes('loadGoogleReviewFeed'));
});

check('잠금은 finally에서 해제한다', () => {
  // 줄바꿈 표기(CRLF/LF)에 기대지 않도록 위치 관계로만 확인합니다.
  const finallyAt = refresh.indexOf('} finally {');
  const releaseAt = refresh.indexOf('releaseSnapshotLock(lock.owner)');

  assert.ok(finallyAt > 0, 'finally 블록이 없습니다');
  assert.ok(releaseAt > finallyAt, '잠금 해제가 finally 안에 있어야 합니다');
});

console.log('\n[11] 업로드 완료 후 갱신 (소스 확인)');

const registerUi = readSource(
  path.join('app', 'review-migration', 'components', 'Cafe24ReviewRegister.tsx')
);

check('keepalive로 보내고 await 하지 않는다', () => {
  const block = registerUi.slice(registerUi.indexOf('function requestFeedSnapshotRefresh'));
  assert.ok(block.includes('keepalive: true'));
  assert.ok(block.includes('void fetch('));
  assert.ok(block.includes('.catch(() => {})'));
});

check('모든 묶음이 성공했을 때만 갱신을 요청한다', () => {
  assert.ok(registerUi.includes('!run.halted'));
  assert.ok(registerUi.includes('!run.stoppedByUser'));
  assert.ok(registerUi.includes('run.unclear.length === 0'));
  assert.ok(registerUi.includes('run.processed === queue.length'));
  assert.ok(registerUi.includes('run.succeeded.length > 0'));
});

check("화면 문구는 '완료'가 아니라 '요청됨'이다", () => {
  assert.ok(registerUi.includes('갱신 요청됨'));
  assert.ok(!registerUi.includes('피드 갱신 완료'));
});

console.log('\n[12] 기존 파일 무변경 (소스 확인)');

/**
 * 스냅샷 작업이 건드리면 안 되는 파일들입니다.
 * 피드 생성 규칙과 업로드 동작이 이번 변경으로 달라지지 않았는지 확인합니다.
 */
const UNCHANGED_FILES = [
  ['app/lib/google-reviews/buildFeed.ts', 'buildGoogleReviewFeed'],
  ['app/lib/google-reviews/productMap.ts', 'buildReviewId'],
  ['app/lib/google-reviews/feedSource.ts', 'loadGoogleReviewFeed'],
  ['app/lib/google-reviews/feedAuth.ts', 'verifyFeedBasicAuth'],
  ['app/lib/cafe24/reviewExport.ts', 'fetchReviewExportRecords'],
  ['app/lib/cafe24/registerRun.ts', 'runCafe24RegisterBatches'],
  ['app/lib/cafe24/reviewPayload.ts', 'buildArticleRequest'],
  ['app/lib/cafe24/registerRequest.ts', 'validateRegisterReviews'],
  ['app/lib/cafe24/batchOutcome.ts', 'classifyCafe24Batch'],
  ['app/api/review-migration/cafe24/reviews/register/route.ts', 'CAFE24_ARTICLES_PER_REQUEST'],
];

for (const [relativePath, marker] of UNCHANGED_FILES) {
  check(`${relativePath} 가 그대로 있다`, () => {
    const source = readSource(relativePath);
    assert.ok(source.includes(marker), `${marker} 를 찾지 못했습니다`);
    // 스냅샷 모듈이 이 파일들 안으로 새어 들어가지 않았는지 확인합니다.
    assert.ok(!source.includes('snapshotStore'), '스냅샷 저장소를 직접 부르면 안 됩니다');
    assert.ok(!source.includes('refreshSnapshot'), '갱신기를 직접 부르면 안 됩니다');
  });
}

check('관리자 미리보기는 여전히 실시간 수집을 쓴다', () => {
  const preview = readSource(
    path.join('app', 'api', 'review-migration', 'google-reviews', 'preview', 'route.ts')
  );
  assert.ok(preview.includes('loadGoogleReviewFeed'));
  assert.ok(preview.includes('summaryComment: true'));
});

rmSync(outDir, { recursive: true, force: true });

console.log('');
if (failures > 0) {
  console.error(`${failures}건 실패`);
  process.exit(1);
}
console.log('모두 통과');
