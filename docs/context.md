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
  - `자동` = DRAFT 임시저장
  - `수동승인` = DRAFT 임시저장
  - 기본 발행 상태 = DRAFT
- 예약발행 H열 연동
  - H열 시간 입력 시 ISO 8601 변환 후 `payload.published` 반영
- 3중 중복 발행 방지
  - I열 URL 존재 행 스킵
  - 발행 대상 행 없음 즉시 종료
  - 발행 후 동일 산출물 재사용 방지 로직 유지
- 카테고리 자동 분류
  - `석고보드` / `목자재` / `단열재` / `기타`
  - SEO 키워드 + 강조키워드 + 제목 기준 자동 라벨 추가
- Unsplash 이미지 자동삽입
  - J열 `자동생성` 모드
  - Unsplash 검색 → 원본 CDN URL 직접 삽입
- Gemini 이미지 생성 연동
  - `generateImageWithGemini_()`
  - `testGeminiImageGen()`
  - 모델: `gemini-3-pro-image-preview`
  - J열 `이미지생성` 분기 코드 반영 완료
  - GitHub 업로드 파일명 고유화 완료
  - 파일명 규칙: `yyyyMMdd_HHmmss_{title앞10자정리}_01.png`
- 이미지 프롬프트 개선
  - 비교형 템플릿 + 단면 구조형 템플릿 적용
- 프롬프트 개선
  - AI 금지패턴 추가
  - 오프닝 후킹 강제
  - 인간적 문체 지시 추가
- 블로그 디자인 개선
  - H2 구분선
  - 이미지 풀와이드 + 캡션
  - 하이라이트 박스
  - 수치 카드
  - 인용구 박스
  - CTA 섹션
  - 회사 서명
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

- `runPublishOnly()` 의 J열=`이미지생성` 분기 실운영 검증 및 안정화
  - 코드 반영은 완료됐고, Apps Script 편집기 실실행 검증이 남아 있음
- `imagen_prompts` → `generateImageWithGemini_()` 연동 실사용 검증
  - `_final_seo.json`의 prompt1/prompt2 생성과 발행 흐름 결합 점검 필요
- H열(승인) 삭제 후 잔여 운영 흐름 점검
  - 열 구조 및 관련 코드 수정 반영 이후 실사용 검증 진행 중
- `resetForNewPost()` / `onOpen()` / `runCompleteProcess()` 운영 검증
  - 메뉴 표시, 초기화 범위, 생성→발행 연결 흐름 점검 진행 중
- 사용자 가이드 작성 예정
- 이미지 품질 개선
  - Gemini 이미지 프롬프트 튜닝
  - 기술 일러스트/인포그래픽 스타일 일관성 개선
- 블로그 스타일 프롬프트 추가 개선
  - 본문 문체, CTA, 사진 배치, 실제 게시 스타일 미세 조정

# 컨트롤 시트 구조

| 열 | 항목 | 입력/자동 |
|----|------|----------|
| A | 강조키워드 | 입력 |
| B | 스타일 | 입력 |
| C | 검색최적화 키워드 | 입력 |
| D | 템플릿 | 입력 |
| E | 최신반영여부 | 입력 |
| F | 발행모드 | 입력 |
| G | 상태 | 자동 |
| H | 발행시간 | 입력 |
| I | Blogger URL | 자동 |
| J | 이미지소스 | 입력 |

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
  - `GITHUB_TOKEN`
  - `UNSPLASH_ACCESS_KEY` (v1 Unsplash 모드 사용 시)

# 카테고리 체계

- `석고보드`
- `목자재`
- `단열재`
- `기타`

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
| `이미지생성` (v2) | Gemini 생성 | GitHub Raw URL로 공개 호스팅 후 URL 삽입 |

v1 수정 시 반드시 적용:

- Drive 저장 로직 제거
- Unsplash 원본 URL을 그대로 본문 img 태그에 삽입

v2 수정 시 반드시 적용:

- Gemini base64 이미지 → GitHub Contents API 업로드 → GitHub Raw URL 반환 → 본문 삽입
- Drive 저장 불필요
- 저장소: `kangHo-Jun/Blog`
- 이미지 폴더: `/images/`

# 이미지 관련 주의사항

- GitHub 이미지 파일명 고유화 완료
  - 타임스탬프 + 제목 일부 + 순번 기반 파일명 사용
- 파일명 중복 시 기존 블로그 이미지 덮어쓰기 발생 가능
  - 반드시 고유 파일명 사용
- 기존 이미지 복구 경로
  - `https://github.com/kangHo-Jun/Blog/commits/main/images/`

# 실행 메모

- `runGenerateOnly()`
  - 최신 입력 파일 기준 `_final_seo.json` 생성
  - 현재 `imagen_prompts` 후처리 저장 포함
- `runPublishOnly()`
  - J열 값에 따라 직접업로드 / Unsplash / Gemini 이미지 생성 분기
- 실제 실행 검증
  - Apps Script 편집기에서 직접 수행
  - `clasp push --force`로만 코드 반영 가능
