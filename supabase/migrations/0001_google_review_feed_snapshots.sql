-- Google 상품평 피드 스냅샷 저장소
--
-- 적용 방법: Supabase 대시보드 > SQL Editor에 붙여넣어 수동으로 실행합니다.
-- 이 프로젝트에는 마이그레이션 자동 실행 도구가 없습니다. 이 파일은 적용한 SQL의 기록입니다.
--
-- 두 테이블 모두 RLS를 켜고 정책을 만들지 않습니다.
-- 기존 cafe24_oauth_tokens와 같은 방식으로 service role 키로만 접근합니다.

-- ──────────────────────────────────────────────────────────────
-- 1. 스냅샷 (append-only)
-- ──────────────────────────────────────────────────────────────
--
-- 갱신은 UPDATE가 아니라 INSERT입니다.
-- 성공한 실행만 status='ready'로 들어가고, 피드는 그중 가장 최신 행을 읽습니다.
-- 실패한 실행은 status='failed'로 기록만 남기므로 피드 조회 대상이 되지 않습니다.
-- 따라서 갱신이 실패해도 직전 정상 스냅샷이 그대로 계속 제공됩니다.

create table if not exists public.google_review_feed_snapshots (
  id                      uuid primary key default gen_random_uuid(),
  status                  text not null check (status in ('ready', 'failed')),
  mall_id                 text not null,
  board_no                integer not null,

  -- status='ready'일 때만 채웁니다. 886KB 내외의 XML 전문이 들어갑니다.
  -- text 컬럼은 TOAST로 자동 압축 저장되며 상한은 1GB입니다.
  xml                     text,
  byte_size               integer,
  -- XML 본문의 SHA-256 hex. ETag와 메모리 캐시 무효화에 씁니다.
  sha256                  text,

  review_count            integer,
  excluded_count          integer,
  verified_purchase_count integer,
  scanned_article_count   integer,
  candidate_count         integer,

  -- [{ reason, label, count }] 형태. 고정 라벨과 건수만 들어가며
  -- 리뷰 본문·작성자는 어떤 경우에도 저장하지 않습니다.
  exclusions              jsonb,

  source                  text not null check (source in ('scheduled', 'after_upload', 'manual')),
  -- 실패 사유. 짧은 고정 코드만 넣고 카페24 응답 원문은 넣지 않습니다.
  error_kind              text,

  generated_at            timestamptz not null default now(),
  -- 수동 갱신을 실행한 관리자. 예약 갱신은 null입니다.
  created_by              uuid
);

-- 제공 가능한 스냅샷은 XML·해시·리뷰 수가 반드시 모두 있어야 합니다.
-- 애플리케이션 검증이 뚫려도 빈 스냅샷이 저장되지 않게 하는 마지막 방어선입니다.
--
-- byte_size와 review_count는 nullable이라 is not null을 반드시 함께 씁니다.
-- CHECK는 결과가 NULL이면 통과로 처리하므로, `byte_size > 0`만 쓰면
-- byte_size가 NULL인 ready 행이 그대로 들어옵니다. 그러면 피드가 크기도 건수도 모르는
-- 스냅샷을 제공하게 되므로, 비교 연산 앞에 NULL 여부를 명시해 막습니다.
alter table public.google_review_feed_snapshots
  drop constraint if exists google_review_feed_snapshots_ready_complete;

alter table public.google_review_feed_snapshots
  add constraint google_review_feed_snapshots_ready_complete
  check (
    status <> 'ready'
    or (
      xml is not null
      and sha256 is not null
      and byte_size is not null
      and byte_size > 0
      and review_count is not null
      and review_count > 0
    )
  );

-- 실패 기록에는 XML을 남기지 않습니다.
alter table public.google_review_feed_snapshots
  drop constraint if exists google_review_feed_snapshots_failed_has_no_xml;

alter table public.google_review_feed_snapshots
  add constraint google_review_feed_snapshots_failed_has_no_xml
  check (status <> 'failed' or xml is null);

-- 피드가 매 요청마다 쓰는 조회: status='ready' 중 generated_at 최신 1건
create index if not exists google_review_feed_snapshots_ready_idx
  on public.google_review_feed_snapshots (generated_at desc)
  where status = 'ready';

-- 보존 기간이 지난 실패 기록 정리용
create index if not exists google_review_feed_snapshots_failed_idx
  on public.google_review_feed_snapshots (generated_at)
  where status = 'failed';

alter table public.google_review_feed_snapshots enable row level security;

-- ──────────────────────────────────────────────────────────────
-- 2. 갱신 잠금 (단일 행)
-- ──────────────────────────────────────────────────────────────
--
-- Cloud Run 인스턴스가 여러 개일 때 예약 갱신과 업로드 후 갱신이 겹치면
-- 카페24에 초당 2회 제한을 넘겨 429를 맞습니다. 그걸 막는 잠금입니다.
--
-- lock_owner를 함께 기록해, 잠금을 실제로 획득한 실행만 해제할 수 있게 합니다.
-- TTL(locked_until)이 지나면 다른 실행이 가져갈 수 있으므로
-- 프로세스가 죽어도 잠금이 영구히 남지 않습니다.

create table if not exists public.google_review_feed_locks (
  id           text primary key default 'snapshot',
  locked_until timestamptz,
  lock_owner   uuid,
  updated_at   timestamptz not null default now()
);

alter table public.google_review_feed_locks enable row level security;

insert into public.google_review_feed_locks (id, locked_until, lock_owner)
values ('snapshot', null, null)
on conflict (id) do nothing;
