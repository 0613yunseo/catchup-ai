# Supabase 설정 (분석 기록 저장)

CatchUp AI의 로그인과 클라우드 분석 기록은 Supabase를 사용합니다. **이 설정을 하지 않아도 분석·리포트 보기는 그대로 동작합니다.** 환경변수가 없으면 로그인/기록 메뉴가 숨겨집니다.

> 이 저장소의 코드는 아래 SQL을 **원격 DB에 적용하지 않습니다.** 직접 한 번 실행해야 합니다.

## 1. 테이블과 보안 정책 만들기 (필수)

`supabase/migrations/20261106000000_create_analysis_reports.sql` 을 원격 DB에 적용합니다. 방법은 둘 중 하나입니다.

**A. SQL Editor (CLI 불필요)**

1. Supabase 대시보드 → 프로젝트 → **SQL Editor** → New query
2. 위 파일 내용을 전부 붙여넣고 **Run**
3. 같은 방식으로 `supabase/verify_rls.sql` 을 실행해 결과가 각 쿼리 위의 "기대" 주석과 같은지 확인

**B. Supabase CLI**

```bash
supabase login
supabase link --project-ref <프로젝트 ref>
supabase db push
```

한 번만 실행하세요. 같은 SQL을 다시 실행하면 `already exists` 오류가 납니다(데이터는 바뀌지 않음).

### 이 SQL이 하는 일

- `analysis_reports` 테이블 생성. `user_id`는 `auth.users`에 연결되며 기본값이 `auth.uid()` 입니다.
- RLS 활성화. 정책은 `authenticated` 역할의 **자기 행 SELECT / INSERT / DELETE** 3개뿐이며 UPDATE는 정책이 없어 거부됩니다.
- 권한(GRANT): `anon`·`public` 권한을 모두 회수하고 `authenticated`에 `select, insert, delete`만 부여합니다.
- 인덱스 `(user_id, created_at desc)`, 그리고 같은 사용자의 같은 리포트를 두 번 저장하지 못하게 하는 `unique (user_id, content_hash)`.
- 앱은 `service_role`/secret 키를 쓰지 않습니다. 모든 접근이 로그인한 사용자의 세션으로 이루어지므로 RLS가 항상 적용됩니다.

## 2. Auth 설정 (필수)

Supabase 대시보드 → **Authentication**:

1. **Sign In / Providers → Email** 이 켜져 있는지 확인합니다. (비밀번호는 사용하지 않아도 됩니다.)
2. **URL Configuration**
   - **Site URL**: 배포 주소 (예: `https://catchup-ai-liart.vercel.app`)
   - **Redirect URLs**에 추가: `https://catchup-ai-liart.vercel.app/auth/confirm` 와 로컬 개발용 `http://localhost:3000/auth/confirm`
3. 기본 이메일 발송은 시간당 발송 수 제한이 작습니다. 많은 사용자가 쓸 때는 **SMTP를 직접 연결**하세요.

### 로그인 방식 (이메일 링크 / 코드)

앱은 `signInWithOtp`로 메일을 보냅니다. 기본 템플릿의 링크(PKCE)는 **링크를 요청한 같은 브라우저**에서 열어야 동작합니다. 다음을 하면 더 안정적입니다.

- **다른 기기·메일 앱 내장 브라우저에서도 열리게 하려면**: Authentication → Emails → **Magic Link** 템플릿의 링크 주소를 아래로 바꿉니다. 앱이 보낸 `emailRedirectTo`(`.../auth/confirm?next=...`)에 인증 토큰을 덧붙이는 형태입니다. (이 템플릿으로 실제 메일 로그인을 끝까지 시험해 보지는 못했으니 적용 후 한 번 확인하세요.)

  ```
  {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email
  ```

- **메일에 숫자 코드도 넣으려면**: 같은 템플릿에 `{{ .Token }}` 을 추가합니다. 로그인 화면의 코드 입력란에 넣으면 같은 브라우저가 아니어도 로그인됩니다.

## 3. 환경변수

로컬: `.env.local` (git에 커밋되지 않음) / 배포: Vercel → Project → Settings → Environment Variables

| 이름 | 값 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (publishable/anon 키. **secret·service_role 키는 넣지 마세요** — 앱이 거부합니다.) |

Vercel에 추가한 뒤에는 환경변수가 빌드에 포함되므로 **재배포**가 필요합니다. (`NEXT_PUBLIC_*` 값은 빌드 시점에 번들에 들어갑니다.)

## 4. 적용 후 확인

1. `verify_rls.sql` 결과가 기대와 같은지 확인합니다.
2. 앱에서 로그인 → 리포트에서 "클라우드에 저장" → `/history`에 나타나는지 확인합니다.
3. 다른 이메일 계정으로 로그인해 첫 계정의 기록이 보이지 않는지 확인합니다.

## 운영상 한계

- 사용자당 저장 기록은 최대 100개, 리포트 1건은 약 900KB까지입니다.
- 저장된 리포트에는 문서의 인용문과 코드 스니펫이 포함됩니다. 원본 PDF·DOCX·TXT 파일은 저장하지 않습니다.
- 계정을 지우면(`auth.users` 삭제) 그 사용자의 기록도 함께 삭제됩니다(`on delete cascade`).
