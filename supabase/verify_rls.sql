-- migration 적용 후 Supabase SQL Editor에서 실행해 권한과 RLS 설정을 확인하는 읽기 전용 점검 쿼리.
-- 데이터를 바꾸지 않는다. 각 쿼리 위의 "기대 결과"와 비교하세요.

-- 1) RLS가 켜져 있는가?  기대: rls_enabled = true
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where oid = 'public.analysis_reports'::regclass;

-- 2) 정책 목록.  기대: select / insert / delete 각 1개, roles = {authenticated}, update 정책 없음
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'analysis_reports'
order by cmd;

-- 3) 테이블 권한.  기대: grantee가 authenticated뿐이고 privilege_type은 SELECT, INSERT, DELETE만.
--    anon이나 PUBLIC 행이 있으면 안 됩니다.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'analysis_reports'
order by grantee, privilege_type;

-- 4) 역할별 권한 확인.  기대: anon 전부 false / authenticated는 select, insert, delete만 true
select r.role,
       has_table_privilege(r.role, 'public.analysis_reports', 'select') as can_select,
       has_table_privilege(r.role, 'public.analysis_reports', 'insert') as can_insert,
       has_table_privilege(r.role, 'public.analysis_reports', 'update') as can_update,
       has_table_privilege(r.role, 'public.analysis_reports', 'delete') as can_delete
from (values ('anon'), ('authenticated')) as r(role);

-- 5) 인덱스.  기대: 기본키, (user_id, content_hash) 유일, (user_id, created_at desc)
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'analysis_reports'
order by indexname;
