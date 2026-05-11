# 프로젝트 기본 정보

- 새 시트 ID: `1ln-FEi1W0ZPKmVFmBUp6iuQ8dm6ijoGVFB6qqCFP1Q0`
- 새 Apps Script ID: `11Oqwz80T8dmsZoYbP4Xh7EsMQMDodK8BwIqQx5V2sltSiZlD4Ji4-et_`
- Blogger ID: `3911627335922911456`
- 블로그 URL: `https://daesan-inside.blogspot.com/`

# 완료된 기능

- 기존 글 생성 엔진 유지
  - Claude API 기반 글 생성
  - Gemini 전처리/보조 분석 포함
- `mapPhotosToPlaceholders()`
  - Drive 사진 파일을 본문 `[사진N]` 홀더에 매핑
  - 매핑 후 남은 `[사진 N: ...]` 형식 가이드 텍스트 전체 제거 (`/\[사진\s*\d+[^\]]*\]/g`)
- `convertToBloggerHTML()`
  - 본문 텍스트를 Blogger 게시용 HTML로 변환
  - img 태그 반응형 스타일 자동 적용: `width:100%; max-width:800px; height:auto; display:block; margin:1em auto`
- `publishToBlogger(title, htmlContent, labels, publishMode, scheduledTime)`
  - Blogger API v3로 글 발행
  - `publishMode === '자동'` → `status: LIVE` (공개)
  - `publishMode === '수동승인'` → `?isDraft=true` (임시저장)
  - `scheduledTime` 있으면 payload `published` 필드로 예약발행
- `updateControlSheetAfterPublish()`
  - 발행 결과를 L열에 URL 기록
- `runGenerateOnly()` / `runPublishOnly()` 2단계 분리 구조
  - 글 생성과 발행을 독립 실행 가능하게 분리
  - `runGenerateOnly()`: 전처리 + SEO 글 생성 + Drive 폴더 자동 생성(F열) + 사진 가이드(G열)
  - `runPublishOnly()`: 사진 매핑 → HTML 변환 → Blogger 발행 → L열 URL 기록
- 발행모드 분기
  - F열 `자동` → LIVE 공개 발행
  - F열 `수동승인` + H열 체크 → DRAFT 임시저장
  - F열 `수동승인` + H열 미체크 → G열 `승인대기` 기록 후 보류
- 예약발행 I열 연동
  - I열 비어있으면 즉시 발행
  - I열에 날짜시간 입력 시 ISO 8601 변환 후 `payload.published` 설정
- `dryRunPublish()`
  - 실제 API 호출 없이 예약발행 로직 검증용 드라이런 함수
- 중복 발행 방지
  - `getPublishControlRow_()`: L열 URL 있는 행 탐색 제외 (1차 차단)
  - `runPublishOnly()` 시작부: 발행 가능 행 없으면 즉시 종료 (2차 차단)
  - 발행 성공 후 `_final_seo.json` 자동 삭제 (3차 차단)
- 중복 함수 정리 완료
  - 중복 정의 7개 삭제
- 시트 구조 불일치 수정 완료
  - 템플릿 읽기 기준을 `H2`에서 `D2`로 변경

# 현재 시트1 구조

- `A2`: 강조키워드
- `B2`: 스타일번호
- `C2`: SEO키워드
- `D2`: 템플릿명
- `E2`: 최신반영여부

# 컨트롤 시트 열 구조 (F~L열)

| 열 | 항목 | 내용 |
|----|------|------|
| F열 | 발행모드 | `자동` / `수동승인` |
| G열 | 상태 | `대기중` / `승인대기` / `발행완료` |
| H열 | 승인 | ☐ 체크박스 (수동승인 시 체크 필요) |
| I열 | 예약시간 | 비어있으면 즉시, 날짜시간 입력 시 예약발행 |
| J열 | (예비) | - |
| K열 | 이미지폴더 | Drive 폴더 URL 자동 입력 (F열 기록) |
| L열 | Blogger URL | 발행 후 자동 입력 |

# 남은 작업

- ~~전체 파이프라인 통합 함수 개발~~ ✅ 완료
- ~~컨트롤 시트 발행 제어 연동~~ ✅ 완료
  - ~~수동승인~~ ✅ 완료
  - ~~자동발행~~ ✅ 완료
- ~~`사진 매핑 → HTML 변환 → Blogger 발행` end-to-end 테스트~~ ✅ 완료 (dryRunPublish 검증)
- ~~발행모드 분기 - 자동=공개, 수동승인=임시저장(DRAFT)~~ ✅ 완료
- ~~예약발행 - I열 시간 입력 시 예약 처리~~ ✅ 완료

# 참고

- 현재 로컬 `Blog` 프로젝트의 `clasp` 대상은 새 Apps Script ID로 맞춰져 있음
- `clasp push --force`는 완료됨
- `clasp run`은 Execution API 제약으로 직접 실행 검증에 사용 불가
- `runCompleteProcess()` 등 실제 실행은 Apps Script 편집기에서 직접 확인 필요
