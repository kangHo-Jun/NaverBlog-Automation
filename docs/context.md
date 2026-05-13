# 프로젝트 기본 정보

- 프로젝트명: Blogger 건축자재 콘텐츠 자동화 시스템
- 컨트롤 시트 ID: `1ln-FEi1W0ZPKmVFmBUp6iuQ8dm6ijoGVFB6qqCFP1Q0`
- Apps Script ID: `11Oqwz80T8dmsZoYbP4Xh7EsMQMDodK8BwIqQx5V2sltSiZlD4Ji4-et_`
- Blogger ID: `3911627335922911456`
- 블로그 URL: `https://daesan-inside.blogspot.com/`
- GCP 프로젝트: Antigravity (`122520894478`)

# 완료된 기능

- 글 생성 파이프라인
  - `runGenerateOnly()`
  - 입력 파일 전처리 → Claude SEO 글 생성 → `_final_seo.json` 저장
- 발행 파이프라인
  - `runPublishOnly()`
  - 이미지 준비 → 사진 매핑 → Blogger HTML 변환 → Blogger 발행
- 발행모드 분기
  - `자동` = LIVE 공개 발행
  - `수동승인` = DRAFT 임시저장
- 예약발행 I열 연동
  - I열 시간 입력 시 ISO 8601 변환 후 `payload.published` 반영
- 3중 중복 발행 방지
  - L열 URL 존재 행 스킵
  - 발행 대상 행 없음 즉시 종료
  - 발행 후 동일 산출물 재사용 방지 로직 유지
- Unsplash 이미지 자동삽입
  - M열 `자동생성` 모드
  - Unsplash 검색 → Drive 저장 → 기존 사진 매핑 로직 재사용
- Gemini 이미지 생성 연동 테스트 완료
  - `generateImageWithGemini_()`
  - `testGeminiImageGen()`
  - M열 `이미지생성` 분기 코드 반영 완료
- 프롬프트 개선
  - AI 금지패턴 추가
  - 오프닝 후킹 강제
  - 인간적 문체 지시 추가
- 사진 설명 영어 자동 생성
  - 사진 플레이스홀더 설명 영어 강제
  - `photo_guides` 영문 생성
- MHTML 파일 지원
  - 확장자 허용: `.mhtml`, `.mht`
  - 현재는 HTML 유사 처리 방식으로 동작

# 현재 브랜치 상태

- `main`
  - v1 Unsplash 자동삽입 완료 기준선
- `v2_imagen`
  - Gemini 이미지 생성 연동 개발 진행 브랜치
- 태그
  - `v1_unsplash`
  - `0511_프롬프트개선전`

# 남은 작업

- `runPublishOnly()` 의 M열=`이미지생성` 분기 실운영 검증 및 안정화
  - 코드 반영은 완료됐고, Apps Script 편집기 실실행 검증이 남아 있음
- `imagen_prompts` → `generateImageWithGemini_()` 연동 실사용 검증
  - `_final_seo.json`의 prompt1/prompt2 생성과 발행 흐름 결합 점검 필요
- 이미지 품질 개선
  - Gemini 이미지 프롬프트 튜닝
  - 기술 일러스트/인포그래픽 스타일 일관성 개선
- 블로그 스타일 프롬프트 추가 개선
  - 본문 문체, CTA, 사진 배치, 실제 게시 스타일 미세 조정

# 컨트롤 시트 구조

| 열 | 항목 | 입력/자동 | 설명 |
|----|------|-----------|------|
| A | 강조키워드 | 입력 | 글에서 강조할 핵심 문구 |
| B | 스타일번호 | 입력 | 시트2 스타일 번호 |
| C | SEO키워드 | 입력 | 쉼표 구분 SEO 키워드 |
| D | 템플릿명 | 입력 | 시트3 템플릿명 |
| E | 최신반영여부 | 입력 | `y` 또는 `n` |
| F | 발행모드 | 입력 | `자동` / `수동승인` |
| G | 상태 | 자동 | `대기중` / `승인대기` / `발행완료` 등 |
| H | 승인 | 입력 | 수동승인 모드 체크박스 |
| I | 발행시간 | 입력 | 비우면 즉시, 입력 시 예약발행 |
| J | 이미지폴더 | 자동 | Drive 이미지 폴더 URL |
| K | 이미지목록 | 자동 | 사진 가이드 목록 |
| L | Blogger URL | 자동 | 발행 완료 URL |
| M | 이미지소스 | 입력 | 비움=`직접업로드`, `자동생성`=Unsplash, `이미지생성`=Gemini |

# 기술적 제약 사항

- `clasp run` 사용 불가
  - Execution API 제약으로 원격 함수 실행 검증이 막혀 있음
  - 실제 테스트는 Apps Script 편집기에서 직접 실행 필요
- GCP 프로젝트
  - Antigravity (`122520894478`)
- 필수 API 활성화
  - Blogger API
  - Drive API
- API 키는 모두 Properties Service 관리
  - `CLAUDE_API_KEY`
  - `GEMINI_API_KEY`
  - `UNSPLASH_ACCESS_KEY`

# 주요 폴더 ID

- INPUT: `1J_wn9JIilhkyfOBvxkEB1C5B0f5LzNj8`
- JSON 출력: `1wr_0xqWOqStu7AFw3NP9RktXA-f7AR0o`
- 이미지 상위폴더: `1-QkVAQf8O5vSV4ndaXEHAD1soKmhQj5t`
- 테스트 이미지 폴더: `1wpVU90Cg7DZ1G8syZK4V1CxH0PuVV5oT`

# 이미지 호스팅 방식 결정 사항 (반드시 참고)

문제:

- Drive URL (`lh3.googleusercontent.com`, `drive.google.com/uc?export=view`) 은 Blogger 본문에서 렌더링 실패
- 목록 페이지 썸네일은 보이지만 본문 펼치면 깨짐

확정된 방향:

| 모드 | 이미지 소스 | 호스팅 방식 |
|------|------------|------------|
| `자동생성` (v1) | Unsplash | Unsplash CDN URL 직접 삽입 (Drive 저장 불필요) |
| `이미지생성` (v2) | Gemini 생성 | Google Cloud Storage (GCS) 공개 호스팅 후 URL 삽입 |

v1 수정 시 반드시 적용:

- Drive 저장 로직 제거
- Unsplash 원본 URL을 그대로 본문 img 태그에 삽입

v2 수정 시 반드시 적용:

- Gemini base64 이미지 → Google Cloud Storage (GCS) 업로드 → 공개 URL 반환 → 본문 삽입
- Drive 저장 불필요
- GCP 프로젝트: Antigravity (`122520894478`) 활용
- 버킷명: 추후 결정

## Drive 이미지가 Blogger 본문에서 깨지는 원인

Google Drive는 파일 저장소이며, Blogger 본문 렌더링용 공개 CDN 이미지 호스팅 용도로 안정적이지 않다.

문제 현상:

- 목록 썸네일은 보이지만 본문 이미지가 깨짐
- `<img src>` 로 직접 삽입 시 렌더링 실패 발생
- `lh3.googleusercontent.com` URL도 세션/권한/리디렉션 상태에 따라 불안정

원인:

- Drive URL은 실제 CDN 직링크 구조가 아님
- 권한 체크 및 redirect 구조 포함
- hotlink 정책 영향 가능성 존재
- Blogger 본문 렌더러와 호환성 불안정

결론:

- Drive = 저장소
- Blogger = 공개 이미지 CDN URL 필요

따라서 현재 정책 유지:

- Unsplash → 원본 CDN URL 직접 사용
- Gemini 생성 이미지 → GCS 공개 URL 사용
- Drive 저장은 백업 용도로만 허용 가능

# 실행 메모

- `runGenerateOnly()`
  - 최신 입력 파일 기준 `_final_seo.json` 생성
  - 현재 `imagen_prompts` 후처리 저장 포함
- `runPublishOnly()`
  - M열 값에 따라 직접업로드 / Unsplash / Gemini 이미지 생성 분기
- 실제 실행 검증
  - Apps Script 편집기에서 직접 수행
  - `clasp push --force`로만 코드 반영 가능
