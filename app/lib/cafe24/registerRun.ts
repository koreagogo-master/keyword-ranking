/**
 * 등록 묶음을 순서대로 보내는 진행기 (순수 함수 모듈).
 *
 * 화면의 등록 버튼이 쓰는 반복문 그 자체입니다. 요청을 보내는 함수를 밖에서 받기 때문에
 * 이 파일에는 fetch도 카페24 주소도 없고, 가짜 send 함수만으로 진행 규칙을 그대로 검증할 수 있습니다.
 *
 * 진행 규칙
 *  - 묶음을 하나씩 순서대로 보냅니다. 병렬로 보내지 않습니다.
 *  - 한 묶음의 결과가 전부 설명됐으면(서버의 canContinue) 실패가 있어도 다음 묶음으로 넘어갑니다.
 *  - 실패한 리뷰는 목록에만 모읍니다. 같은 실행에서 다시 보내지 않습니다. (재시도 없음)
 *  - 결과를 설명할 수 없거나 요청 자체가 실패하면 그 자리에서 멈추고 남은 묶음을 보내지 않습니다.
 *  - 사용자가 누른 중단은 지금 묶음을 끝낸 뒤에 반영합니다.
 */

/** 이 모듈이 보는 결과 한 건 (등록 성공 판정은 서버가 이미 끝냈습니다) */
export interface RegisterRunItem {
  naverReviewId: string;
  registered: boolean;
  /** 등록되지 않은 것이 확실한 건인지. false·없음이면 결과 불명확입니다. */
  failureConfirmed?: boolean;
}

/** 이 모듈이 보는 묶음 응답 */
export interface RegisterRunBatch {
  results: readonly RegisterRunItem[];
  /** 서버가 판단한 "다음 묶음을 이어서 보내도 되는지" */
  canContinue: boolean;
}

/** 묶음 응답에 실려 온 결과 한 건의 실제 타입 */
export type RegisterRunItemOf<Data extends RegisterRunBatch> = Data['results'][number];

export type RegisterRunSendResult<Data, Detail> =
  | { kind: 'ok'; data: Data }
  | { kind: 'error'; message: string; devDetail: Detail };

/** 묶음 번호가 붙은 결과 한 건 */
export type RegisterRunEntry<Item> = Item & { batchNumber: number };

export interface RegisterRunProgress<Data extends RegisterRunBatch> {
  succeeded: RegisterRunEntry<RegisterRunItemOf<Data>>[];
  /** 등록되지 않은 것이 확실한 리뷰 */
  failed: RegisterRunEntry<RegisterRunItemOf<Data>>[];
  /** 성공도 실패도 확인하지 못한 리뷰 */
  unclear: RegisterRunEntry<RegisterRunItemOf<Data>>[];
  /** 실제로 보낸 리뷰 수 */
  processed: number;
  /** 보낸 묶음 수 */
  batchesSent: number;
}

export interface RegisterRunResult<Data extends RegisterRunBatch, Detail>
  extends RegisterRunProgress<Data> {
  /** 결과를 설명할 수 없거나 요청이 실패해 중간에 멈춘 경우 true */
  halted: boolean;
  /** 사용자가 누른 중단으로 멈춘 경우 true */
  stoppedByUser: boolean;
  /** 멈춘 이유 (화면에 그대로 보여 줄 문장). 끝까지 진행했으면 null */
  error: { message: string; devDetail: Detail | null } | null;
}

export interface RegisterRunOptions<
  Chunk extends readonly unknown[],
  Data extends RegisterRunBatch,
  Detail,
> {
  /** 최대 10건씩 나눈 묶음 (chunkForCafe24의 결과를 그대로 받습니다) */
  chunks: readonly Chunk[];
  /** 묶음 하나를 보내는 함수. batchStart는 지금까지 보낸 리뷰 수입니다. */
  send: (chunk: Chunk, batchStart: number) => Promise<RegisterRunSendResult<Data, Detail>>;
  /** 결과를 설명할 수 없을 때 화면에 보여 줄 문장 */
  stopMessage: (data: Data) => string;
  /** 사용자가 중단을 눌렀는지 (묶음 사이에서만 확인합니다) */
  shouldStop?: () => boolean;
  /** 묶음 응답을 그대로 넘겨 줍니다. (진단 요약 보관용) */
  onBatch?: (batchNumber: number, data: Data) => void;
  /** 묶음 하나가 끝날 때마다 진행 상황을 알려 줍니다. */
  onProgress?: (progress: RegisterRunProgress<Data>) => void;
}

/**
 * 묶음을 순서대로 보내고 결과를 성공·명시적 실패·결과 불명확으로 모읍니다.
 *
 * 실패한 리뷰를 다시 보내는 경로가 이 함수 안에 없습니다.
 * (chunks를 앞에서 뒤로 한 번만 훑고, 같은 묶음을 두 번 보내지 않습니다)
 */
export async function runCafe24RegisterBatches<
  Chunk extends readonly unknown[],
  Data extends RegisterRunBatch,
  Detail,
>(options: RegisterRunOptions<Chunk, Data, Detail>): Promise<RegisterRunResult<Data, Detail>> {
  const succeeded: RegisterRunEntry<RegisterRunItemOf<Data>>[] = [];
  const failed: RegisterRunEntry<RegisterRunItemOf<Data>>[] = [];
  const unclear: RegisterRunEntry<RegisterRunItemOf<Data>>[] = [];

  let processed = 0;
  let batchesSent = 0;
  let halted = false;
  let stoppedByUser = false;
  let error: { message: string; devDetail: Detail | null } | null = null;

  const progress = (): RegisterRunProgress<Data> => ({
    succeeded: [...succeeded],
    failed: [...failed],
    unclear: [...unclear],
    processed,
    batchesSent,
  });

  for (const [batchIndex, chunk] of options.chunks.entries()) {
    const batchNumber = batchIndex + 1;
    const outcome = await options.send(chunk, processed);

    // 요청 자체가 실패한 경우. 결과를 알 수 없으므로 다시 보내지 않고 즉시 멈춥니다.
    if (outcome.kind === 'error') {
      halted = true;
      error = { message: outcome.message, devDetail: outcome.devDetail };
      break;
    }

    batchesSent += 1;

    for (const item of outcome.data.results as readonly RegisterRunItemOf<Data>[]) {
      const entry: RegisterRunEntry<RegisterRunItemOf<Data>> = { ...item, batchNumber };

      if (item.registered) succeeded.push(entry);
      else if (item.failureConfirmed) failed.push(entry);
      else unclear.push(entry);
    }

    processed += chunk.length;

    options.onBatch?.(batchNumber, outcome.data);
    options.onProgress?.(progress());

    // 결과가 전부 설명되지 않으면 남은 묶음을 보내지 않습니다.
    if (!outcome.data.canContinue) {
      halted = true;
      error = { message: options.stopMessage(outcome.data), devDetail: null };
      break;
    }

    if (options.shouldStop?.()) {
      stoppedByUser = true;
      break;
    }
  }

  return { ...progress(), halted, stoppedByUser, error };
}
