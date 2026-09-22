/**
 * Google 상품평 피드 XML 생성기 자동 검증. (네트워크 호출 없음)
 *
 *   node scripts/verify-google-review-feed.mjs
 *
 * 확인하는 것
 *  1. XML이 잘 짜여 있고 요소 순서가 공식 스키마(2.4) sequence와 같은지
 *  2. review_id가 `cafe24-{boardNo}-{articleNo}`이고 중복이 없는지
 *  3. review_url·product_url 형식과 review_url type="singleton"
 *  4. SKU·브랜드·MPN이 확인된 상품에만 붙는지
 *  5. 스마트스토어 출처 문구가 본문에서 지워지는지
 *  6. `<br>`은 줄바꿈이 되고 나머지 태그는 지워지며 entity가 원문으로 돌아오는지
 *  7. XML 특수문자 다섯 개가 모두 escape 되는지
 *  8. 작성일이 한국시간 +09:00으로 변환되는지
 *  9. 평점이 1~5 정수일 때만 통과하고 min/max가 1·5인지
 * 10. 마스킹·빈 작성자 처리
 * 11. 구매 확인 표시가 근거 있는 리뷰에만 붙는지
 * 12. 이번 단계에서 제외하기로 한 항목(제목·리뷰 이미지)이 들어가지 않는지
 * 13. 필수값이 없는 리뷰가 사유별로 집계되는지
 * 14. 게시판을 끝까지 읽지 못하면 XML을 만들지 않는지 (소스 확인)
 * 15. 기존 카페24 업로드 기능 파일이 그대로인지 (소스 확인)
 *
 * app/lib/google-reviews의 두 모듈은 순수 함수라 로컬 typescript로 임시 폴더에 컴파일해
 * 그대로 불러올 수 있습니다. 이 스크립트는 네트워크를 한 번도 쓰지 않습니다.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const feedDir = path.join(repoRoot, 'app', 'lib', 'google-reviews');
const cafe24Dir = path.join(repoRoot, 'app', 'lib', 'cafe24');
const tscBin = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

const outDir = mkdtempSync(path.join(tmpdir(), 'google-review-feed-'));
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

/** 검증용 가짜 값입니다. 실제 고객 리뷰가 아닙니다. */
const IDENTITY = { mallId: 'tmgmall01', shopNo: 1, boardNo: 4 };

/** `상품리뷰`를 퍼센트 인코딩한 값 */
const BOARD_SEGMENT = '%EC%83%81%ED%92%88%EB%A6%AC%EB%B7%B0';
const ORIGIN = 'ht' + 'tps://commandomall.com';

const STAMP = '(2026-07-01 08:47 스마트스토어에서 등록된 구매평)';

/**
 * 아주 작은 XML 구조 검사기. 새 패키지를 설치하지 않으려고 직접 확인합니다.
 * 여는/닫는 태그 짝과, 텍스트에 escape 되지 않은 특수문자가 없는지만 봅니다.
 */
function assertWellFormed(xml) {
  const stack = [];
  const tagPattern = /<(\/?)([a-zA-Z_][\w.:-]*)([^>]*?)(\/?)>/g;

  let lastIndex = 0;
  let match;

  const assertTextIsEscaped = (text) => {
    assert.ok(!text.includes('<'), `텍스트에 escape 되지 않은 <가 있습니다: ${text.trim().slice(0, 40)}`);
    assert.ok(!text.includes('>'), `텍스트에 escape 되지 않은 >가 있습니다: ${text.trim().slice(0, 40)}`);
    for (const amp of text.match(/&[^\s;]*;?/g) ?? []) {
      assert.ok(
        /^&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);$/.test(amp),
        `텍스트에 escape 되지 않은 &가 있습니다: ${amp}`
      );
    }
  };

  // XML 선언과 주석은 구조 검사 대상에서 빼고, 주석 안에 --가 없는지만 확인합니다.
  const withoutProlog = xml.replace(/<\?xml[^?]*\?>/g, '');
  const body = withoutProlog.replace(/<!--([\s\S]*?)-->/g, (whole, inner) => {
    assert.ok(!inner.includes('--'), '주석 안에 --가 있습니다.');
    return '';
  });

  while ((match = tagPattern.exec(body)) !== null) {
    assertTextIsEscaped(body.slice(lastIndex, match.index));
    lastIndex = tagPattern.lastIndex;

    const [, closing, name, attributes, selfClosing] = match;

    if (selfClosing === '/') continue;

    if (closing === '/') {
      assert.equal(stack.pop(), name, `닫는 태그가 맞지 않습니다: </${name}>`);
      continue;
    }

    // 속성값도 escape 규칙을 따라야 합니다.
    for (const value of attributes.match(/="([^"]*)"/g) ?? []) {
      assertTextIsEscaped(value.slice(2, -1));
    }

    stack.push(name);
  }

  assertTextIsEscaped(body.slice(lastIndex));
  assert.deepEqual(stack, [], `닫히지 않은 태그가 있습니다: ${stack.join(', ')}`);
}

/** `<review>` 블록을 순서대로 잘라 냅니다. */
function splitReviews(xml) {
  return [...xml.matchAll(/<review>([\s\S]*?)<\/review>/g)].map((m) => m[1]);
}

/** 블록 안 요소 이름을 나온 순서대로 뽑습니다. (중첩 제외, 최상위만) */
function topLevelElementNames(block) {
  const names = [];
  let depth = 0;

  for (const [, closing, name, , selfClosing] of block.matchAll(
    /<(\/?)([a-zA-Z_][\w.:-]*)([^>]*?)(\/?)>/g
  )) {
    if (selfClosing === '/') {
      if (depth === 0) names.push(name);
      continue;
    }
    if (closing === '/') {
      depth -= 1;
      continue;
    }
    if (depth === 0) names.push(name);
    depth += 1;
  }

  return names;
}

function textOf(block, name) {
  const found = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block);
  return found === null ? null : found[1];
}

try {
  writeFileSync(path.join(outDir, 'package.json'), '{ "type": "module" }\n');

  execFileSync(
    process.execPath,
    [
      tscBin,
      path.join(feedDir, 'buildFeed.ts'),
      path.join(feedDir, 'productMap.ts'),
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
      (whole, head, target, tail) => (target.endsWith('.js') ? whole : `${head}${target}.js${tail}`)
    );
    writeFileSync(full, rewritten);
  }

  const load = async (name) => import(pathToFileURL(path.join(outDir, name)).href);

  const {
    buildGoogleReviewFeed,
    escapeXml,
    hasSmartstoreSourceStamp,
    toFeedReviewerName,
    toKstTimestamp,
    toPlainReviewText,
  } = await load('buildFeed.js');

  const { REVIEW_BOARD_URL_SEGMENT, buildProductPageUrl, buildReviewId, buildReviewPageUrl, buildSku } =
    await load('productMap.js');

  const review = (overrides) => ({
    articleNo: 101,
    productNo: 35,
    writerRaw: '김**',
    contentRaw: '좋아요',
    createdDateRaw: '2026-07-01T08:47:18+09:00',
    rating: 5,
    naverReviewId: '',
    hasSmartstoreSource: false,
    ...overrides,
  });

  /** 출처 문구가 붙은 본문. 실제 등록 기능이 만드는 형태와 같습니다. */
  const stampedContent = `좋아요<br />정말 좋아요<br /><br />${STAMP}`;

  const inputs = [
    // 1) 마스킹 작성자 · 출처 문구 · 브랜드가 확인된 상품
    review({
      articleNo: 101,
      productNo: 35,
      contentRaw: stampedContent,
      hasSmartstoreSource: hasSmartstoreSourceStamp(stampedContent),
    }),
    // 2) 빈 작성자 · 특수문자 · 네이버 리뷰글번호 있음 · 브랜드 미확인 상품
    review({
      articleNo: 102,
      productNo: 70,
      writerRaw: '   ',
      contentRaw: 'A &amp; B &lt;tag&gt; &quot;q&quot; &#39;s&#39; <b>굵게</b>',
      createdDateRaw: '2026-07-02 09:00:00',
      rating: 4,
      naverReviewId: '1234567890',
    }),
    // 3) 구매 근거가 없는 리뷰
    review({ articleNo: 103, productNo: 35, writerRaw: '홍길동', rating: 3 }),
    // 4) 같은 게시글번호 → review_id 중복
    review({ articleNo: 101, contentRaw: '중복 확인용' }),
    // 5) 평점 없음
    review({ articleNo: 104, rating: null }),
    // 6) 평점 범위 밖
    review({ articleNo: 105, rating: 7 }),
    // 7) 작성일 해석 불가
    review({ articleNo: 106, createdDateRaw: '알 수 없음' }),
    // 8) 출처 문구만 있고 고객이 쓴 글이 없음
    review({ articleNo: 107, contentRaw: STAMP, hasSmartstoreSource: true }),
    // 9) 상품번호 없음
    review({ articleNo: 108, productNo: 0 }),
    // 10) 게시글번호 없음
    review({ articleNo: 0 }),
  ];

  const feed = buildGoogleReviewFeed(inputs, { identity: IDENTITY, summaryComment: true });
  const blocks = splitReviews(feed.xml);
  const [first, second, third] = blocks;

  console.log('\n[1] XML 구조와 요소 순서');
  check('XML이 잘 짜여 있습니다', () => {
    assertWellFormed(feed.xml);
  });
  check('XML 선언과 스키마 위치가 2.4입니다', () => {
    assert.ok(feed.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
    assert.ok(feed.xml.includes('/schema/product/2.4/product_reviews.xsd'));
    assert.ok(feed.xml.includes('<version>2.4</version>'));
  });
  check('feed 바로 아래 순서가 version → publisher → reviews입니다', () => {
    const feedBody = /<feed[^>]*>([\s\S]*)<\/feed>/.exec(feed.xml)[1];
    assert.deepEqual(topLevelElementNames(feedBody), ['version', 'publisher', 'reviews']);
  });
  check('review 안 요소 순서가 공식 sequence와 같습니다', () => {
    assert.deepEqual(topLevelElementNames(first), [
      'review_id',
      'reviewer',
      'is_verified_purchase',
      'review_timestamp',
      'content',
      'review_url',
      'ratings',
      'products',
      'collection_method',
    ]);
  });
  check('구매 근거가 없으면 해당 요소만 빠지고 순서는 유지됩니다', () => {
    assert.deepEqual(topLevelElementNames(third), [
      'review_id',
      'reviewer',
      'review_timestamp',
      'content',
      'review_url',
      'ratings',
      'products',
    ]);
  });

  console.log('\n[2] review_id 형식과 중복');
  check('review_id는 cafe24-{boardNo}-{articleNo}입니다', () => {
    assert.equal(buildReviewId(4, 101), 'cafe24-4-101');
    assert.equal(textOf(first, 'review_id'), 'cafe24-4-101');
    assert.equal(textOf(second, 'review_id'), 'cafe24-4-102');
  });
  check('네이버 리뷰글번호가 있어도 게시글번호로만 만듭니다', () => {
    // 2번 리뷰에는 naverReviewId가 있지만 review_id에 쓰이지 않습니다.
    assert.ok(!feed.xml.includes('1234567890'));
  });
  check('XML 안 review_id가 모두 유일합니다', () => {
    const ids = blocks.map((block) => textOf(block, 'review_id'));
    assert.equal(new Set(ids).size, ids.length, `중복 review_id: ${ids.join(', ')}`);
  });
  check('중복 게시글번호는 제외 사유로 집계됩니다', () => {
    const duplicate = feed.exclusions.find((item) => item.reason === 'duplicate_review_id');
    assert.equal(duplicate?.count, 1);
  });

  console.log('\n[3] review_url · product_url');
  check('게시판 이름 구간이 퍼센트 인코딩된 상품리뷰입니다', () => {
    assert.equal(REVIEW_BOARD_URL_SEGMENT, BOARD_SEGMENT);
  });
  check('review_url 형식이 정확합니다', () => {
    assert.equal(buildReviewPageUrl(4, 101), `${ORIGIN}/article/${BOARD_SEGMENT}/4/101/`);
    assert.ok(first.includes(`<review_url type="singleton">${ORIGIN}/article/${BOARD_SEGMENT}/4/101/</review_url>`));
  });
  check('모든 review_url에 type="singleton"이 있습니다', () => {
    const urls = [...feed.xml.matchAll(/<review_url([^>]*)>/g)].map((m) => m[1]);
    assert.equal(urls.length, blocks.length);
    for (const attributes of urls) {
      assert.equal(attributes, ' type="singleton"');
    }
  });
  check('product_url 형식이 정확합니다', () => {
    assert.equal(buildProductPageUrl(35), `${ORIGIN}/product/detail.html?product_no=35`);
    assert.ok(first.includes(`<product_url>${ORIGIN}/product/detail.html?product_no=35</product_url>`));
    assert.ok(second.includes(`<product_url>${ORIGIN}/product/detail.html?product_no=70</product_url>`));
  });
  check('카페24 기본 도메인은 피드에 쓰이지 않습니다', () => {
    assert.ok(!feed.xml.includes('cafe24.com'));
  });

  console.log('\n[4] SKU · 브랜드 · MPN');
  check('SKU 형식은 cafe24_{mallId}_{shopNo}_{productNo}입니다', () => {
    assert.equal(buildSku(IDENTITY, 35), 'cafe24_tmgmall01_1_35');
    assert.ok(first.includes('<sku>cafe24_tmgmall01_1_35</sku>'));
    assert.ok(second.includes('<sku>cafe24_tmgmall01_1_70</sku>'));
  });
  check('상품 35에만 브랜드·MPN이 붙습니다', () => {
    assert.ok(first.includes('<brand>코만도빔</brand>'));
    assert.ok(first.includes('<mpn>commandobeam2</mpn>'));
  });
  check('확인되지 않은 상품에는 브랜드·MPN을 넣지 않습니다', () => {
    assert.ok(!second.includes('<brand>'));
    assert.ok(!second.includes('<mpn>'));
    assert.ok(second.includes('<sku>'));
  });
  check('product_ids 안 순서가 mpns → skus → brands입니다', () => {
    const ids = /<product_ids>([\s\S]*?)<\/product_ids>/.exec(first)[1];
    assert.deepEqual(topLevelElementNames(ids), ['mpns', 'skus', 'brands']);
  });

  console.log('\n[5] 스마트스토어 출처 문구 제거');
  check('출처 문구를 찾아냅니다', () => {
    assert.equal(hasSmartstoreSourceStamp(stampedContent), true);
    assert.equal(hasSmartstoreSourceStamp('좋아요'), false);
  });
  check('본문 끝 출처 문구가 지워집니다', () => {
    assert.equal(toPlainReviewText(stampedContent), '좋아요\n정말 좋아요');
    assert.equal(textOf(first, 'content'), '좋아요\n정말 좋아요');
  });
  check('XML 어디에도 출처 문구가 남지 않습니다', () => {
    assert.ok(!feed.xml.includes('스마트스토어에서 등록된 구매평'));
  });
  check('초까지 붙은 형식도 지웁니다', () => {
    assert.equal(toPlainReviewText(`잘 씁니다 (2026-07-01 08:47:18 스마트스토어에서 등록된 구매평)`), '잘 씁니다');
  });
  check('본문 가운데 있는 일반 괄호 문장은 건드리지 않습니다', () => {
    assert.equal(toPlainReviewText('(재구매) 좋아요'), '(재구매) 좋아요');
  });
  check('출처 문구만 있으면 본문 없음으로 처리합니다', () => {
    assert.equal(toPlainReviewText(STAMP), '');
    assert.equal(feed.exclusions.find((item) => item.reason === 'empty_content')?.count, 1);
  });

  console.log('\n[6] 태그 · 줄바꿈 · entity');
  check('<br> 계열은 모두 줄바꿈이 됩니다', () => {
    assert.equal(toPlainReviewText('가<br>나<br/>다<br />라<BR>마'), '가\n나\n다\n라\n마');
  });
  check('나머지 태그는 지워집니다', () => {
    assert.equal(toPlainReviewText('<b>굵게</b><span style="x">글</span>'), '굵게글');
  });
  check('entity가 원문으로 돌아옵니다', () => {
    assert.equal(toPlainReviewText('A &amp; B &lt;tag&gt; &#39;s&#39;'), "A & B <tag> 's'");
  });
  check('XML에 태그 잔해가 남지 않습니다', () => {
    assert.ok(!textOf(second, 'content').includes('&lt;b&gt;'));
    assert.ok(textOf(second, 'content').includes('굵게'));
  });

  console.log('\n[7] XML escape');
  check('특수문자 다섯 개를 모두 바꿉니다', () => {
    assert.equal(escapeXml(`& < > " '`), '&amp; &lt; &gt; &quot; &apos;');
  });
  check('escape 순서 때문에 &가 두 번 바뀌지 않습니다', () => {
    assert.equal(escapeXml('&lt;'), '&amp;lt;');
  });
  check('본문의 특수문자가 XML에서 escape 되어 있습니다', () => {
    assert.equal(textOf(second, 'content'), 'A &amp; B &lt;tag&gt; &quot;q&quot; &apos;s&apos; 굵게');
  });
  check('작성자에 넣은 특수문자도 escape 됩니다', () => {
    const escaped = buildGoogleReviewFeed([review({ writerRaw: 'A & B' })], { identity: IDENTITY });
    assert.ok(escaped.xml.includes('<name>A &amp; B</name>'));
    assertWellFormed(escaped.xml);
  });

  console.log('\n[8] 작성일 (한국시간 +09:00)');
  check('시간대가 붙은 값을 그대로 씁니다', () => {
    assert.equal(toKstTimestamp('2026-07-01T08:47:18+09:00'), '2026-07-01T08:47:18+09:00');
    assert.equal(textOf(first, 'review_timestamp'), '2026-07-01T08:47:18+09:00');
  });
  check('UTC 값은 한국시간으로 옮깁니다', () => {
    assert.equal(toKstTimestamp('2026-06-30T23:47:18Z'), '2026-07-01T08:47:18+09:00');
  });
  check('시간대가 없는 값은 적힌 시각을 한국시간으로 봅니다', () => {
    assert.equal(toKstTimestamp('2026-07-02 09:00:00'), '2026-07-02T09:00:00+09:00');
    assert.equal(textOf(second, 'review_timestamp'), '2026-07-02T09:00:00+09:00');
  });
  check('달력에 없는 날짜와 빈 값은 통과하지 못합니다', () => {
    for (const bad of ['2026-02-30', '알 수 없음', '', null, undefined]) {
      assert.equal(toKstTimestamp(bad), null, `통과하면 안 되는 값: ${String(bad)}`);
    }
  });
  check('모든 review_timestamp가 +09:00으로 끝납니다', () => {
    for (const block of blocks) {
      assert.ok(/\+09:00$/.test(textOf(block, 'review_timestamp')));
    }
  });

  console.log('\n[9] 평점');
  check('min=1 max=5로 나갑니다', () => {
    assert.ok(first.includes('<overall min="1" max="5">5</overall>'));
    assert.ok(second.includes('<overall min="1" max="5">4</overall>'));
  });
  check('평점 없음·범위 밖은 제외됩니다', () => {
    assert.equal(feed.exclusions.find((item) => item.reason === 'invalid_rating')?.count, 2);
  });
  check('소수 평점은 통과하지 못합니다', () => {
    const decimal = buildGoogleReviewFeed([review({ rating: 4.4 })], { identity: IDENTITY });
    assert.equal(decimal.includedCount, 0);
    assert.equal(decimal.exclusions[0].reason, 'invalid_rating');
  });

  console.log('\n[10] 작성자');
  check('마스킹된 이름은 보이는 그대로 쓰고 익명으로 표시합니다', () => {
    assert.deepEqual(toFeedReviewerName('김**'), { name: '김**', isAnonymous: true });
    assert.ok(first.includes('<name is_anonymous="true">김**</name>'));
  });
  check('비어 있으면 Anonymous로 처리합니다', () => {
    assert.deepEqual(toFeedReviewerName('   '), { name: 'Anonymous', isAnonymous: true });
    assert.ok(second.includes('<name is_anonymous="true">Anonymous</name>'));
  });
  check('일반 이름에는 is_anonymous를 붙이지 않습니다', () => {
    assert.deepEqual(toFeedReviewerName('홍길동'), { name: '홍길동', isAnonymous: false });
    assert.ok(third.includes('<name>홍길동</name>'));
  });

  console.log('\n[11] 구매 확인');
  check('네이버 리뷰글번호가 있으면 구매 확인으로 표시합니다', () => {
    assert.ok(second.includes('<is_verified_purchase>true</is_verified_purchase>'));
    assert.ok(second.includes('<collection_method>post_fulfillment</collection_method>'));
  });
  check('스마트스토어 출처 문구가 있어도 구매 확인으로 표시합니다', () => {
    assert.ok(first.includes('<is_verified_purchase>true</is_verified_purchase>'));
    assert.ok(first.includes('<collection_method>post_fulfillment</collection_method>'));
  });
  check('근거가 없으면 두 요소를 넣지 않습니다', () => {
    assert.ok(!third.includes('is_verified_purchase'));
    assert.ok(!third.includes('collection_method'));
  });
  check('구매 확인 건수를 세어 돌려줍니다', () => {
    assert.equal(feed.verifiedPurchaseCount, 2);
  });

  console.log('\n[12] 이번 단계에서 넣지 않기로 한 항목');
  check('리뷰 제목이 없습니다', () => {
    assert.ok(!feed.xml.includes('<title>'));
  });
  check('리뷰 이미지가 없습니다', () => {
    assert.ok(!feed.xml.includes('reviewer_image'));
  });
  check('전송·주문 식별값이 들어가지 않습니다', () => {
    assert.ok(!feed.xml.includes('transaction_id'));
    assert.ok(!feed.xml.includes('naverpay'));
  });

  console.log('\n[13] 제외 집계');
  check('포함·제외 건수가 입력 건수와 맞습니다', () => {
    assert.equal(feed.includedCount, blocks.length);
    assert.equal(feed.includedCount + feed.excludedCount, inputs.length);
    assert.equal(feed.includedCount, 3);
    assert.equal(feed.excludedCount, 7);
  });
  check('사유별 건수가 정확합니다', () => {
    const counts = Object.fromEntries(feed.exclusions.map((item) => [item.reason, item.count]));
    assert.deepEqual(counts, {
      invalid_article_no: 1,
      invalid_product_no: 1,
      invalid_rating: 2,
      invalid_timestamp: 1,
      empty_content: 1,
      duplicate_review_id: 1,
    });
  });
  check('사유마다 사람이 읽을 설명이 붙습니다', () => {
    for (const item of feed.exclusions) {
      assert.ok(item.label && item.label.length > 0, `설명이 없는 사유: ${item.reason}`);
    }
  });
  check('요약 주석이 XML 선언 다음에 들어갑니다', () => {
    assert.ok(feed.xml.includes('<!-- 게시판 4 · 포함 3건 · 제외 7건 · 구매확인 2건 -->'));
    assert.ok(feed.xml.indexOf('<!--') < feed.xml.indexOf('<feed'));
  });
  check('요약 주석을 끄면 들어가지 않습니다', () => {
    const quiet = buildGoogleReviewFeed(inputs, { identity: IDENTITY });
    assert.ok(!quiet.xml.includes('<!--'));
    assertWellFormed(quiet.xml);
  });
  check('리뷰가 하나도 없어도 XML은 잘 짜여 있습니다', () => {
    const empty = buildGoogleReviewFeed([], { identity: IDENTITY, summaryComment: true });
    assert.equal(empty.includedCount, 0);
    assert.ok(empty.xml.includes('<reviews>'));
    assertWellFormed(empty.xml);
  });

  console.log('\n[14] 부분 수집이면 XML을 만들지 않는지 (소스 확인)');
  const exportSource = readFileSync(path.join(cafe24Dir, 'reviewExport.ts'), 'utf8');
  const previewSource = readFileSync(
    path.join(repoRoot, 'app/api/review-migration/google-reviews/preview/route.ts'),
    'utf8'
  );

  check('상한에 닿으면 incomplete_scan으로 끊습니다', () => {
    assert.ok(exportSource.includes("kind: 'incomplete_scan'"));
    assert.ok(exportSource.includes('offset >= CAFE24_ARTICLES_MAX_COUNT'));
    // 상한에 닿은 뒤에도 ok: true로 빠져나가는 경로가 없어야 합니다.
    assert.ok(!exportSource.includes('truncated: true'));
  });
  check('미리보기 라우트가 incomplete_scan을 오류로 돌려줍니다', () => {
    assert.ok(previewSource.includes("collected.kind === 'incomplete_scan'"));
    assert.ok(previewSource.includes("'incomplete_scan',"));
    // 실패를 확인한 다음에만 XML을 만듭니다.
    assert.ok(previewSource.indexOf('if (!collected.ok)') < previewSource.indexOf('buildGoogleReviewFeed('));
  });
  check('미리보기는 관리자만 쓸 수 있고 XML로 응답합니다', () => {
    assert.ok(previewSource.includes('const admin = await requireAdmin();'));
    assert.ok(previewSource.includes("'Content-Type': 'application/xml; charset=utf-8'"));
    assert.ok(previewSource.includes('CAFE24_NO_STORE_HEADERS'));
  });
  check('미리보기 라우트에 쓰기 요청이 없습니다', () => {
    assert.ok(!previewSource.includes('POST'));
    assert.ok(!exportSource.includes("method: 'POST'"));
  });
  check('수집기는 로그에 본문·작성자를 남기지 않습니다', () => {
    for (const line of exportSource.split('\n').filter((l) => l.includes('console.'))) {
      for (const leaked of ['content', 'writer', 'naverReviewId', 'naverpay_review_id']) {
        assert.ok(!line.includes(leaked), `로그에 개인정보가 실릴 수 있습니다: ${line.trim()}`);
      }
    }
  });
  check('SKU의 mall_id는 환경변수 고정값만 씁니다', () => {
    assert.ok(previewSource.includes('const mallId = resolveMallId();'));
    assert.ok(!previewSource.includes('searchParams.get'));
  });

  console.log('\n[15] 기존 카페24 업로드 기능이 그대로인지 (소스 확인)');
  const protectedFiles = [
    'reviewPayload.ts',
    'registerRequest.ts',
    'registerRun.ts',
    'batchOutcome.ts',
    'reviews.ts',
    'duplicateCheck.ts',
    'reviewNormalize.ts',
    'adminApi.ts',
  ];

  check('보호 대상 파일이 새 기능을 불러오지 않습니다', () => {
    for (const file of protectedFiles) {
      const source = readFileSync(path.join(cafe24Dir, file), 'utf8');
      assert.ok(!source.includes('google-reviews'), `${file}이 새 모듈을 참조합니다.`);
      assert.ok(!source.includes('reviewExport'), `${file}이 새 모듈을 참조합니다.`);
    }
  });
  check('등록 라우트도 새 기능을 불러오지 않습니다', () => {
    const registerSource = readFileSync(
      path.join(repoRoot, 'app/api/review-migration/cafe24/reviews/register/route.ts'),
      'utf8'
    );
    assert.ok(!registerSource.includes('google-reviews'));
    assert.ok(!registerSource.includes('reviewExport'));
    assert.ok(registerSource.includes('body: { shop_no: 1, requests: articles }'));
  });
  check('등록 성공 판정·중복 방지 규칙이 그대로입니다', () => {
    const payload = readFileSync(path.join(cafe24Dir, 'reviewPayload.ts'), 'utf8');
    const outcome = readFileSync(path.join(cafe24Dir, 'batchOutcome.ts'), 'utf8');
    assert.ok(payload.includes('export const CAFE24_ARTICLES_PER_REQUEST = 10;'));
    assert.ok(outcome.includes("'not_confirmed'"));
  });
  check('중복 검사 수집기는 여전히 본문을 해시로만 남깁니다', () => {
    const reviews = readFileSync(path.join(cafe24Dir, 'reviews.ts'), 'utf8');
    assert.ok(reviews.includes('contentHash'));
    assert.ok(reviews.includes('export async function fetchExistingReviewRecords('));
  });
  check('새 수집기는 공통 호출기만 재사용합니다', () => {
    assert.ok(exportSource.includes("from './adminApi'"));
    assert.ok(!exportSource.includes("from './reviews'"));
    assert.ok(!exportSource.includes("from './reviewNormalize'"));
  });

  console.log('\n[16] 네트워크 사용 여부');
  check('컴파일 결과에 네트워크 호출이 없습니다', () => {
    const needles = ['fet' + 'ch(', 'XMLHttp' + 'Request', 'cafe24' + 'api.com'];
    for (const file of ['buildFeed.js', 'productMap.js']) {
      const compiled = readFileSync(path.join(outDir, file), 'utf8');
      for (const needle of needles) {
        assert.ok(!compiled.includes(needle), `${file}에 네트워크 코드가 있습니다: ${needle}`);
      }
    }
  });
  check('이 스크립트 자체가 네트워크를 쓰지 않습니다', () => {
    const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    for (const needle of ['fet' + 'ch(', 'XMLHttp' + 'Request', 'cafe24' + 'api.com']) {
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
