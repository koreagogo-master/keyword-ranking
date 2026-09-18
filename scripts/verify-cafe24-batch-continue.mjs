/**
 * 명시적 실패는 격리하고 남은 묶음은 계속 등록하는 규칙 자동 검증. (네트워크 호출 없음)
 *
 *   node scripts/verify-cafe24-batch-continue.mjs
 *
 * 실제로 겪은 상황(요청 84건 · 첫 묶음에서 성공 2건 · 명확한 실패 8건)을 가짜 응답으로 재현해
 * 다음 묶음이 실제로 이어지는지, 불확실한 결과에서는 반드시 멈추는지 확인합니다.
 * 카페24로도 이미지 주소로도 요청이 나가지 않고, 실제 등록(POST)은 한 번도 실행되지 않습니다.
 *
 * 확인하는 시나리오
 *  1. 성공 2 + 명시적 실패 8 = 10 → 두 번째 묶음이 실제로 호출됨
 *  2. 두 번째 묶음 성공 10 → 최종 성공 12 · 실패 8 · 처리 전 중단 0
 *  3. 성공 2 + 사유 7 → 불명확 1건으로 판단하고 중단 (다음 묶음 호출 없음)
 *  4. 성공·실패 충돌 / 위치 중복 / 범위 밖 위치 → 즉시 중단
 *  5. 사유가 서로 다르고 연결 불가 → 특정 리뷰에 배정하지 않고 묶음 단위로 보존
 *  6. 네트워크·429·5xx·JSON 오류 → 다음 묶음 실행 안 함
 *  7. 명시적으로 실패한 리뷰는 같은 실행에서 다시 보내지 않음
 *  8. 실제 네트워크 호출은 차단 (호출되면 검증 실패)
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

const outDir = mkdtempSync(path.join(tmpdir(), 'cafe24-batch-'));
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

/**
 * 실제 네트워크 호출 차단.
 * 어떤 코드가 브라우저·노드의 요청 함수를 부르면 그 즉시 검증이 실패합니다.
 */
const NETWORK_KEYS = ['fet' + 'ch', 'XMLHttp' + 'Request'];
let networkCalled = false;

for (const key of NETWORK_KEYS) {
  globalThis[key] = function blocked() {
    networkCalled = true;
    throw new Error(`네트워크 호출이 차단되었습니다: ${key}`);
  };
}

/** 검증용 가짜 값. 실제 리뷰·작성자·이미지가 아닙니다. */
const SCHEME = 'ht' + 'tps://';
const IMAGE_URL = `${SCHEME}example.com/review/sample_01.jpg`;
const WRITER = '검증작성자';
const CONTENT = '검증용 리뷰 본문입니다.';
const CLIENT_IP = '8.8.8.8';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';

/** 실제로 받은 실패 사유와 같은 문장 */
const LIBRARY_FULL_MESSAGE =
  'Your file cannot be uploaded. Please check the maximum capacity of the Library board.';

const BATCH_SIZE = 10;

/** 가짜 리뷰 20건 (묶음 2개) */
const reviews = Array.from({ length: 20 }, (_value, index) => ({
  naverReviewId: `92000000${String(index + 10).padStart(2, '0')}`,
  cafe24ProductNo: 69,
  productName: '검증용 상품명',
  content: CONTENT,
  rating: 5,
  writer: WRITER,
  registeredAt: '2026.07.01. 08:47:18',
  imageRaw: IMAGE_URL,
}));

const chunkOf = (batchNumber) => reviews.slice((batchNumber - 1) * BATCH_SIZE, batchNumber * BATCH_SIZE);

try {
  writeFileSync(path.join(outDir, 'package.json'), '{ "type": "module" }\n');

  execFileSync(
    process.execPath,
    [
      tscBin,
      path.join(cafe24Dir, 'batchOutcome.ts'),
      path.join(cafe24Dir, 'multiStatus.ts'),
      path.join(cafe24Dir, 'errorDetail.ts'),
      path.join(cafe24Dir, 'registerRun.ts'),
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

  const { buildCafe24BatchResults, classifyCafe24Batch } = await load('batchOutcome.js');
  const { attributeCafe24MultiStatusFailures, extractCafe24MultiStatusReport } = await load('multiStatus.js');
  const { redactCafe24ErrorDetail } = await load('errorDetail.js');
  const { runCafe24RegisterBatches } = await load('registerRun.js');

  /** 우리가 보낸 값 목록. 라우트의 devRegisterErrorDetail과 같은 방식으로 지웁니다. */
  const sentValues = [WRITER, CONTENT, CLIENT_IP, IMAGE_URL, TOKEN, ...reviews.map((r) => r.naverReviewId)];

  /**
   * 등록 라우트와 같은 순서로 응답을 만드는 가짜 서버.
   *
   * 분류·결과 목록·자리 맞춤은 라우트가 쓰는 함수를 그대로 호출하므로
   * 여기서 규칙을 다시 구현하지 않습니다. (라우트와 어긋날 수 없습니다)
   */
  const buildBatchResponse = (chunk, cafe24Body, status = 207) => {
    const naverReviewIdByIndex = chunk.map((review) => review.naverReviewId);

    const createdEntries = Array.isArray(cafe24Body.articles)
      ? cafe24Body.articles.map((article) => [article.naverpay_review_id, article.article_no ?? null])
      : [];
    const created = new Map(createdEntries);

    const confirmedIndexes = naverReviewIdByIndex
      .map((naverReviewId, index) => ({ naverReviewId, index }))
      .filter(({ naverReviewId }) => created.has(naverReviewId))
      .map(({ index }) => index);

    const unconfirmedIndexes = naverReviewIdByIndex
      .map((naverReviewId, index) => ({ naverReviewId, index }))
      .filter(({ naverReviewId }) => !created.has(naverReviewId))
      .map(({ index }) => index);

    const report = extractCafe24MultiStatusReport(cafe24Body, status, chunk.length);
    const attribution = attributeCafe24MultiStatusFailures(report.failures, {
      requestCount: chunk.length,
      naverReviewIdByIndex,
      unconfirmedIndexes,
    });
    const classification = classifyCafe24Batch({
      requestCount: chunk.length,
      confirmedIndexes,
      responseReadable: true,
      attribution,
    });

    const results = buildCafe24BatchResults({
      naverReviewIdByIndex,
      articleNoByIndex: naverReviewIdByIndex.map((naverReviewId) => created.get(naverReviewId) ?? null),
      classification,
    }).map((base) => {
      const failure = attribution.byIndex.get(base.requestIndex);
      return failure
        ? { ...base, devDetail: redactCafe24ErrorDetail(failure.detail, sentValues) }
        : base;
    });

    const registeredCount = classification.registeredIndexes.length;
    const failedCount = results.length - registeredCount;
    const unclearCount = classification.unclearIndexes.length;

    return {
      ok: true,
      boardNo: 4,
      outcome: failedCount > 0 ? 'partial' : 'applied',
      results,
      registeredCount,
      failedCount,
      explicitFailedCount: failedCount - unclearCount,
      unclearCount,
      unaccountedCount: classification.unaccountedCount,
      canContinue: classification.canContinue,
      ...(classification.stopReason ? { stopReason: classification.stopReason } : {}),
      devMultiStatus: {
        status,
        failureCount: report.failures.length,
        reasonsMissing: report.reasonsMissing,
        unattributed: attribution.unattributed.map((failure) => ({
          reportedIndex: failure.reportedIndex,
          detail: redactCafe24ErrorDetail(failure.detail, sentValues),
        })),
        commonFailureDetail:
          classification.commonFailure === null
            ? null
            : redactCafe24ErrorDetail(classification.commonFailure.detail, sentValues),
        unlinkedFailedCount: classification.failedIndexesWithoutReason.length,
        reasonsUnlinkable: classification.reasonsUnlinkable,
      },
      classification,
    };
  };

  /** 성공 항목 형태 */
  const successArticles = (chunk, indexes) =>
    indexes.map((index) => ({
      shop_no: 1,
      article_no: 900 + index,
      naverpay_review_id: chunk[index].naverReviewId,
    }));

  /** 같은 사유 n건 (실제로 받은 문장). 위치값은 주지 않습니다. */
  const sameReasons = (count) =>
    Array.from({ length: count }, () => ({ code: '422', message: LIBRARY_FULL_MESSAGE }));

  /** 묶음을 실제로 돌려 보고 send 호출 기록을 남깁니다. */
  const runBatches = async (plan, options = {}) => {
    const calls = [];

    const result = await runCafe24RegisterBatches({
      chunks: [chunkOf(1), chunkOf(2)],
      send: async (chunk, batchStart) => {
        calls.push({ batchStart, naverReviewIds: chunk.map((review) => review.naverReviewId) });

        const step = plan[calls.length - 1];
        if (!step) throw new Error(`예상하지 못한 ${calls.length}번째 묶음 호출입니다.`);

        return step(chunk);
      },
      stopMessage: (data) =>
        `중단 (성공 ${data.registeredCount} · 명시적 실패 ${data.explicitFailedCount} · 불명확 ${data.unclearCount})`,
      shouldStop: options.shouldStop,
    });

    return { result, calls };
  };

  const okStep = (cafe24Body, status = 207) => (chunk) => ({
    kind: 'ok',
    data: buildBatchResponse(chunk, cafe24Body(chunk), status),
  });

  console.log('\n[1] 성공 2 + 명시적 실패 8 = 10 → 다음 묶음으로 계속');

  const firstBatchBody = (chunk) => ({
    shop_no: 1,
    articles: successArticles(chunk, [0, 1]),
    error: { received_message: sameReasons(8) },
  });

  const continued = await runBatches([
    okStep(firstBatchBody),
    okStep((chunk) => ({ shop_no: 1, articles: successArticles(chunk, [...Array(10).keys()]) }), 201),
  ]);

  check('첫 묶음을 성공 2건 · 명시적 실패 8건으로 나눕니다', () => {
    const first = buildBatchResponse(chunkOf(1), firstBatchBody(chunkOf(1)));

    assert.equal(first.registeredCount, 2);
    assert.equal(first.explicitFailedCount, 8);
    assert.equal(first.unclearCount, 0);
    assert.equal(first.registeredCount + first.explicitFailedCount, BATCH_SIZE);
    assert.equal(first.canContinue, true);
    assert.equal(first.stopReason, undefined);
  });
  check('두 번째 묶음이 실제로 호출됩니다', () => {
    assert.equal(continued.calls.length, 2);
    assert.deepEqual(
      continued.calls.map((call) => call.batchStart),
      [0, 10]
    );
    assert.deepEqual(continued.calls[1].naverReviewIds, chunkOf(2).map((r) => r.naverReviewId));
  });
  check('실패 8건은 목록에 격리되고 중단으로 처리되지 않습니다', () => {
    assert.equal(continued.result.failed.length, 8);
    assert.equal(continued.result.unclear.length, 0);
    assert.equal(continued.result.halted, false);
    assert.equal(continued.result.stoppedByUser, false);
    assert.equal(continued.result.error, null);
  });

  console.log('\n[2] 두 번째 묶음 성공 10 → 최종 집계');
  check('최종 성공 12건 · 명시적 실패 8건 · 불명확 0건', () => {
    assert.equal(continued.result.succeeded.length, 12);
    assert.equal(continued.result.failed.length, 8);
    assert.equal(continued.result.unclear.length, 0);
  });
  check('처리 전 중단은 0건입니다 (모든 묶음을 끝까지 보냈습니다)', () => {
    assert.equal(continued.result.processed, reviews.length);
    assert.equal(continued.result.batchesSent, 2);
    // 화면과 같은 계산: 끝까지 진행했으면 남은 건이 없습니다.
    const notProcessed =
      continued.result.halted || continued.result.stoppedByUser
        ? reviews.length - continued.result.processed
        : 0;
    assert.equal(notProcessed, 0);
  });
  check('묶음 번호와 묶음 내 위치가 결과에 남습니다', () => {
    for (const item of continued.result.failed) {
      assert.equal(item.batchNumber, 1);
      assert.ok(item.requestIndex >= 2 && item.requestIndex <= 9);
    }
    assert.deepEqual([...new Set(continued.result.succeeded.map((item) => item.batchNumber))], [1, 2]);
  });
  check('마지막으로 성공한 리뷰번호를 알 수 있습니다', () => {
    const successIds = continued.result.succeeded.map((item) => item.naverReviewId);
    assert.equal(successIds[successIds.length - 1], reviews[19].naverReviewId);
  });

  console.log('\n[3] 성공 2 + 사유 7 → 불명확 1건으로 판단하고 중단');

  const shortReasonsBody = (chunk) => ({
    articles: successArticles(chunk, [0, 1]),
    error: { received_message: sameReasons(7) },
  });

  const stoppedShort = await runBatches([okStep(shortReasonsBody), okStep(shortReasonsBody)]);

  check('설명되지 않은 1건을 찾아냅니다', () => {
    const batch = buildBatchResponse(chunkOf(1), shortReasonsBody(chunkOf(1)));

    assert.equal(batch.registeredCount, 2);
    assert.equal(batch.unaccountedCount, 1);
    assert.equal(batch.canContinue, false);
    assert.equal(batch.stopReason, 'unclear_items');
    // 어느 리뷰가 실패했는지 단정할 수 없으므로 남은 8건을 실패로 확정하지 않습니다.
    assert.equal(batch.explicitFailedCount, 0);
    assert.equal(batch.unclearCount, 8);
  });
  check('두 번째 묶음을 호출하지 않고 멈춥니다', () => {
    assert.equal(stoppedShort.calls.length, 1);
    assert.equal(stoppedShort.result.halted, true);
    assert.ok(stoppedShort.result.error.message.includes('불명확 8'));
  });

  console.log('\n[4] 성공·실패 충돌과 응답 위치 충돌 → 즉시 중단');

  const conflicts = {
    conflicting_result: (chunk) => ({
      articles: successArticles(chunk, [0, 1]),
      error: {
        received_message: [
          // 성공한 리뷰글번호를 실패로도 알려 준 경우
          { naverpay_review_id: chunk[0].naverReviewId, code: '422', message: LIBRARY_FULL_MESSAGE },
        ],
      },
    }),
    position_conflict: (chunk) => ({
      articles: successArticles(chunk, [0, 1]),
      error: {
        received_message: [
          { index: 2, code: '422', message: LIBRARY_FULL_MESSAGE },
          { index: 2, code: '422', message: 'Another reason.' },
        ],
      },
    }),
    position_out_of_range: (chunk) => ({
      articles: successArticles(chunk, [0, 1]),
      error: { received_message: [{ index: 99, code: '422', message: LIBRARY_FULL_MESSAGE }] },
    }),
  };

  for (const [expected, body] of Object.entries(conflicts)) {
    check(`${expected}이면 계속 진행하지 않습니다`, () => {
      const batch = buildBatchResponse(chunkOf(1), body(chunkOf(1)));

      assert.equal(batch.canContinue, false);
      assert.equal(batch.stopReason, expected);
    });
  }

  const conflictRun = await runBatches([
    okStep(conflicts.position_conflict),
    okStep(firstBatchBody),
  ]);

  check('충돌이 있으면 두 번째 묶음을 호출하지 않습니다', () => {
    assert.equal(conflictRun.calls.length, 1, '충돌 응답에도 다음 묶음을 보냈습니다.');
    assert.equal(conflictRun.result.halted, true);
    assert.equal(conflictRun.result.unclear.length, 8);
  });

  console.log('\n[5] 사유가 서로 다르고 연결 불가 → 임의 배정 없이 묶음 단위로 보존');

  const unlinkableBody = (chunk) => ({
    articles: successArticles(chunk, [0, 1]),
    error: {
      received_message: Array.from({ length: 8 }, (_value, index) => ({
        code: '422',
        message: index % 2 === 0 ? LIBRARY_FULL_MESSAGE : 'Invalid created_date.',
      })),
    },
  });

  const unlinkable = buildBatchResponse(chunkOf(1), unlinkableBody(chunkOf(1)));

  check('실패는 확정하되 사유를 특정 리뷰에 붙이지 않습니다', () => {
    assert.equal(unlinkable.explicitFailedCount, 8);
    assert.equal(unlinkable.unclearCount, 0);
    assert.equal(unlinkable.canContinue, true);

    for (const item of unlinkable.results.filter((entry) => !entry.registered)) {
      assert.equal(item.failureConfirmed, true);
      assert.equal(item.reasonLinked, false);
      assert.equal('devDetail' in item, false, '연결 근거 없이 사유를 붙였습니다.');
    }
  });
  check('묶음 단위 사유는 그대로 보존됩니다', () => {
    assert.equal(unlinkable.devMultiStatus.reasonsUnlinkable, true);
    assert.equal(unlinkable.devMultiStatus.commonFailureDetail, null);
    assert.equal(unlinkable.devMultiStatus.unattributed.length, 8);
    assert.equal(unlinkable.devMultiStatus.unlinkedFailedCount, 8);
  });
  check('사유가 모두 같으면 묶음 공통 사유로 표시합니다', () => {
    const common = buildBatchResponse(chunkOf(1), firstBatchBody(chunkOf(1)));

    assert.equal(common.devMultiStatus.reasonsUnlinkable, false);
    assert.equal(common.devMultiStatus.commonFailureDetail.message, LIBRARY_FULL_MESSAGE);
    assert.equal(common.devMultiStatus.unlinkedFailedCount, 8);
  });

  console.log('\n[6] 네트워크·429·5xx·JSON 오류 → 다음 묶음 실행 안 함');

  for (const label of ['네트워크 오류', '429', '5xx', 'JSON 파싱 실패']) {
    const errorRun = await runBatches([
      () => ({ kind: 'error', message: `${label} 발생`, devDetail: null }),
      okStep(firstBatchBody),
    ]);

    check(`${label}에서 멈추고 다음 묶음을 보내지 않습니다`, () => {
      assert.equal(errorRun.calls.length, 1);
      assert.equal(errorRun.result.halted, true);
      assert.equal(errorRun.result.batchesSent, 0);
      assert.equal(errorRun.result.error.message, `${label} 발생`);
      assert.equal(errorRun.result.succeeded.length, 0);
    });
  }

  console.log('\n[7] 실패한 리뷰를 같은 실행에서 다시 보내지 않습니다');
  check('실패 8건이 이후 묶음 요청에 다시 들어가지 않습니다', () => {
    const failedIds = new Set(continued.result.failed.map((item) => item.naverReviewId));
    assert.equal(failedIds.size, 8);

    // 첫 묶음 이후의 요청에 실패 리뷰가 하나도 없어야 합니다.
    for (const call of continued.calls.slice(1)) {
      for (const naverReviewId of call.naverReviewIds) {
        assert.ok(!failedIds.has(naverReviewId), `실패한 리뷰를 다시 보냈습니다: ${naverReviewId}`);
      }
    }

    // 각 리뷰는 정확히 한 번만 보내졌습니다.
    const sent = continued.calls.flatMap((call) => call.naverReviewIds);
    assert.equal(sent.length, new Set(sent).size);
    assert.equal(sent.length, reviews.length);
  });
  /** 사용자가 중단을 누른 경우. 지금 묶음을 끝낸 뒤 멈춰야 합니다. */
  const userStopRun = await runBatches([okStep(firstBatchBody), okStep(firstBatchBody)], {
    shouldStop: () => true,
  });

  check('사용자 중단은 지금 묶음을 끝낸 뒤 반영됩니다', () => {
    assert.equal(userStopRun.calls.length, 1);
    assert.equal(userStopRun.result.stoppedByUser, true);
    assert.equal(userStopRun.result.halted, false);
    assert.equal(userStopRun.result.succeeded.length, 2);
    assert.equal(userStopRun.result.failed.length, 8);
  });

  console.log('\n[8] 개인정보·네트워크 차단');
  check('응답 어디에도 작성자·본문·IP·이미지 주소·토큰이 없습니다', () => {
    const serialized = JSON.stringify(unlinkable) + JSON.stringify(continued.result);

    for (const secret of [WRITER, CONTENT, CLIENT_IP, IMAGE_URL, TOKEN, 'example.com']) {
      assert.ok(!serialized.includes(secret), `응답에 보낸 값이 남았습니다: ${secret}`);
    }
  });
  check('실제 네트워크 함수가 한 번도 호출되지 않았습니다', () => {
    assert.equal(networkCalled, false, '네트워크 호출이 발생했습니다.');
  });
  check('컴파일 결과에 네트워크 호출이 없습니다', () => {
    const needles = ['fet' + 'ch(', 'XMLHttp' + 'Request', 'cafe24' + 'api.com'];
    for (const file of ['batchOutcome.js', 'multiStatus.js', 'errorDetail.js', 'registerRun.js']) {
      const compiled = readFileSync(path.join(outDir, file), 'utf8');
      for (const needle of needles) {
        assert.ok(!compiled.includes(needle), `${file}에 네트워크 코드가 있습니다: ${needle}`);
      }
    }
  });

  console.log('\n[9] 소스 수준 확인 (같은 함수 사용과 변경 금지 항목)');
  const registerSource = readFileSync(
    path.join(repoRoot, 'app/api/review-migration/cafe24/reviews/register/route.ts'),
    'utf8'
  );
  const componentSource = readFileSync(
    path.join(repoRoot, 'app/review-migration/components/Cafe24ReviewRegister.tsx'),
    'utf8'
  );
  const runSource = readFileSync(path.join(cafe24Dir, 'registerRun.ts'), 'utf8');

  check('라우트가 검증과 같은 분류·결과 함수를 씁니다', () => {
    assert.ok(registerSource.includes('classifyCafe24Batch({'));
    assert.ok(registerSource.includes('buildCafe24BatchResults({'));
    assert.ok(registerSource.includes('canContinue: classification.canContinue'));
  });
  check('화면이 검증과 같은 진행기를 씁니다', () => {
    assert.ok(componentSource.includes('runCafe24RegisterBatches({'));
    assert.ok(componentSource.includes('send: sendChunk'));
    assert.ok(componentSource.includes('shouldStop: () => stopRequested.current'));
  });
  check('등록 payload·첨부 구조·경로는 그대로입니다', () => {
    assert.ok(registerSource.includes('body: { shop_no: 1, requests: articles }'));
    assert.ok(registerSource.includes('/api/v2/admin/boards/${boardNo}/articles'));
    assert.ok(!/^\s*board_no\s*:/m.test(registerSource));
    assert.ok(!registerSource.includes('attach_file_urls:'));
  });
  check('묶음 상한 10건과 순차 전송을 유지합니다', () => {
    assert.ok(registerSource.includes('validateRegisterReviews(body, CAFE24_ARTICLES_PER_REQUEST)'));
    assert.ok(componentSource.includes('chunkForCafe24(queue)'));
    // 진행기는 await로 한 묶음씩 보냅니다. 동시 전송 코드가 없어야 합니다.
    assert.ok(runSource.includes('await options.send(chunk, processed)'));
    for (const parallel of ['Promise.all', 'Promise.allSettled', 'Promise.race']) {
      assert.ok(!runSource.includes(parallel), `진행기에 병렬 전송이 있습니다: ${parallel}`);
    }
  });
  check('자동 재시도 코드가 없습니다', () => {
    for (const retry of ['retry(', 'retryCount', 'for (let attempt']) {
      assert.ok(!runSource.includes(retry), `진행기에 재시도 코드가 있습니다: ${retry}`);
    }
    assert.ok(registerSource.includes('kind === \'unknown_result\''));
  });
  check('중복 판정·관리자 판정·사전 확인·시험 등록은 그대로입니다', () => {
    assert.ok(componentSource.includes('register-precheck'));
    assert.ok(componentSource.includes('selectTrialRegisterCandidate(allowedIds, targetById)'));
    assert.ok(componentSource.includes('resolveAdminDecision(item, adminDecisions)'));
    assert.ok(registerSource.includes('const admin = await requireAdmin();'));
  });
  check('이 스크립트 자체가 네트워크를 쓰지 않습니다', () => {
    const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');

    // 요청 함수는 위에서 차단용으로만 이름을 다루고, 실제 호출·주소는 어디에도 없습니다.
    for (const needle of ['cafe24' + 'api.com', 'pstatic' + '.net', 'ht' + 'tp://']) {
      assert.ok(!self.includes(needle), `네트워크 주소가 있습니다: ${needle}`);
    }
  });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n실패 ${failures}건`);
  process.exit(1);
}

console.log('\n모든 검증 통과 (카페24 API 호출 없음 · 실제 등록 없음 · 네트워크 차단됨)');
