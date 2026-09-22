/**
 * 스냅샷 XML 프로세스 메모리 캐시 (서버 전용).
 *
 * 886KB짜리 xml 컬럼을 매 요청마다 Supabase에서 끌어오지 않기 위한 것입니다.
 * 피드 라우트는 먼저 메타(수 KB)만 읽어 sha256을 비교하고,
 * 값이 같으면 여기 들어 있는 XML을 그대로 돌려줍니다.
 *
 * 인스턴스마다 따로 존재하고 인스턴스가 사라지면 함께 사라집니다.
 * 정합성 판단은 전부 DB의 sha256이 하므로, 캐시가 비어 있어도 결과는 같고 조금 느릴 뿐입니다.
 * 그래서 캐시 만료 시간을 두지 않습니다. 해시가 달라지는 순간 자동으로 무효화됩니다.
 */

interface CachedSnapshot {
  snapshotId: string;
  sha256: string;
  xml: string;
}

let cached: CachedSnapshot | null = null;

/** 해시가 일치할 때만 XML을 돌려줍니다. 하나라도 다르면 null입니다. */
export function readCachedXml(snapshotId: string, sha256: string): string | null {
  if (!cached) return null;
  if (cached.snapshotId !== snapshotId) return null;
  if (cached.sha256 !== sha256) return null;

  return cached.xml;
}

export function writeCachedXml(snapshotId: string, sha256: string, xml: string): void {
  cached = { snapshotId, sha256, xml };
}

/** 테스트와 진단용. 캐시에 들어 있는 스냅샷 식별값만 알려 줍니다. (XML 본문은 돌려주지 않습니다) */
export function describeCachedSnapshot(): { snapshotId: string; byteSize: number } | null {
  if (!cached) return null;

  return { snapshotId: cached.snapshotId, byteSize: Buffer.byteLength(cached.xml, 'utf8') };
}

export function clearCachedXml(): void {
  cached = null;
}
