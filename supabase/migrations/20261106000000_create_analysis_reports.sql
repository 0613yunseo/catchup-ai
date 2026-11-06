-- CatchUp AI: 로그인한 사용자의 분석 리포트 저장소
--
-- 설계
--  * 모든 접근은 로그인한 사용자(authenticated)의 JWT로만 이루어진다. service_role / secret 키는 쓰지 않는다.
--  * RLS가 사용자별 분리를 강제한다: 자신의 행(user_id = auth.uid())만 조회·추가·삭제할 수 있다.
--  * 수정(UPDATE)은 허용하지 않는다. 저장된 리포트는 불변이다.
--  * anon 역할에는 아무 권한도 주지 않는다.
--  * 같은 사용자가 같은 내용의 리포트를 두 번 저장하지 못한다(content_hash 유일).
--  * 원본 PDF·DOCX·TXT는 저장하지 않는다. report_data에는 최종 리포트 JSON만 들어간다.

create table public.analysis_reports (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_name      text not null check (char_length(project_name) between 1 and 200),
  mode              text not null check (mode in ('single', 'diff')),
  repo_url          text not null check (char_length(repo_url) between 1 and 300),
  -- 목록 화면용 요약. report_data를 읽지 않고도 목록을 만들 수 있다.
  requirement_count integer not null check (requirement_count >= 0),
  status_counts     jsonb not null default '{}'::jsonb,
  -- 같은 리포트의 중복 저장 방지. 서버가 리포트 JSON의 SHA-256 해시를 계산해 넣는다.
  content_hash      text not null check (char_length(content_hash) = 64),
  report_data       jsonb not null check (pg_column_size(report_data) <= 1048576),
  created_at        timestamptz not null default now(),
  constraint analysis_reports_user_hash_key unique (user_id, content_hash)
);

comment on table public.analysis_reports is
  'CatchUp AI 분석 리포트. 로그인한 사용자 본인만 접근한다(RLS). 원본 문서 파일은 저장하지 않는다.';

-- 목록(최신순) 조회와 사용자별 필터에 쓰는 인덱스
create index analysis_reports_user_created_idx
  on public.analysis_reports (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 권한(GRANT): 기본 권한을 모두 걷어내고 필요한 것만 authenticated에 준다.
-- Supabase는 public 스키마의 새 테이블에 anon/authenticated/service_role 권한을 기본으로 부여하므로 명시적으로 회수한다.
-- ---------------------------------------------------------------------------
revoke all on table public.analysis_reports from public;
revoke all on table public.analysis_reports from anon;
revoke all on table public.analysis_reports from authenticated;

grant select, insert, delete on table public.analysis_reports to authenticated;
-- UPDATE, TRUNCATE, REFERENCES, TRIGGER는 주지 않는다.

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.analysis_reports enable row level security;

create policy "analysis_reports_select_own"
  on public.analysis_reports
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "analysis_reports_insert_own"
  on public.analysis_reports
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "analysis_reports_delete_own"
  on public.analysis_reports
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- UPDATE 정책은 만들지 않는다: RLS가 켜진 테이블에서 정책이 없는 명령은 모두 거부된다.
