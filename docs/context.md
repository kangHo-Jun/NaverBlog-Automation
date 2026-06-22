# 프로젝트 기본 정보

- 프로젝트명: SEO 블로그 자동화 시스템 (Google Docs 출력)
- 컨트롤 시트 ID: `1ln-FEi1W0ZPKmVFmBUp6iuQ8dm6ijoGVFB6qqCFP1Q0`
- Apps Script ID: `11Oqwz80T8dmsZoYbP4Xh7EsMQMDodK8BwIqQx5V2sltSiZlD4Ji4-et_`
- 출력 플랫폼: Google Docs → 네이버 블로그 수동 복사
- AI: Claude Sonnet (`CLAUDE_API_KEY`)

# 완료된 기능

- 글 생성 파이프라인
  - `runCompleteProcessInMemory()`: 전처리 → Claude SEO 글 생성 → Google Docs 저장 (메모리 기반)
  - `processNextSEOFile_V7HTML()`: V7 HTML 형식 글 생성
  - `STEP_D2_SaveAsHTML()`: SEO 파일 → HTML 저장
- Google Docs 스타일 출력
  - Apple 미니멀 스타일: 절제된 색상, Noto Sans, 1.8 line-spacing
  - 네이버 블로그 스타일: 이모지 하이라이트, 요약 박스, 친근한 마무리 멘트
  - `addNaverStyleHighlight()`: 네이버 스타일 하이라이트 자동 적용
- 스타일 파라미터 시스템
  - 시트2 기반 7가지 스타일 파라미터
    - 글톤, 문장스타일, 개인터치, 시각풍부도, 내러티브플로우, 전문성레벨, 평균문장길이
  - 코드 수정 없이 스프레드시트에서 스타일 조정 가능
- 콘텐츠 구조 템플릿
  - `getSelectedTemplate()`: 제품소개형, 유튜브스크립트형 등 선택
- 전처리
  - HTML 본문 추출 및 태그 제거 (`analyzeHtml()`)
  - TXT(유튜브 자막) 구어체 → 문어체 정제 (`analyzeTxtScript()`)
  - PDF OCR 텍스트 추출
  - 5만자 자동 제한
- SEO 최적화
  - 25-40자 클릭 유도 제목 자동 생성
  - 강조키워드 볼드 자동 처리
- 파일 관리
  - 처리 완료 파일 이력 관리 (`recordProcessedFile()`, `isFileProcessed()`)
  - `resetForNewPost()`: 작업 초기화
  - `deleteProcessedSourceFiles()`: 처리 완료 원본 삭제

# 컨트롤 시트 구조

| 셀 | 항목 | 입력 |
|----|------|------|
| A2 | 강조키워드 | 쉼표 구분, 최대 5개 |
| B2 | 스타일 번호 | 시트2 기준 (1-5) |
| C2 | SEO 키워드 | 쉼표 구분 |
| H2 | 템플릿 | 콘텐츠 구조 선택 |

# 기술적 제약 사항

- `clasp run` 사용 불가 (Execution API 제약)
  - 실제 테스트는 Apps Script 편집기에서 직접 실행 필요
- Claude API 속도 제한: 5분당 1개 파일 권장
- 대용량 파일: 5만자 자동 제한
- API 키는 모두 Properties Service 관리
  - `CLAUDE_API_KEY`
  - `GEMINI_API_KEY` (스타일 분석 선택 사용 — `STEP_B_geminiAnalysis()`)

# 주요 폴더 ID

- INPUT: `1J_wn9JIilhkyfOBvxkEB1C5B0f5LzNj8`
- JSON 출력: `1wr_0xqWOqStu7AFw3NP9RktXA-f7AR0o`
- Docs 출력: `1u5ZSrhZPLjS4q5jTUdRP-zEdDDNaCY8W`
- 처리 완료 원본 보관: `1KIex4c3z-g3Kvlf3DoTX-ziUDl_R8-a1`
- 스타일 분석 전용: `1viEjA-r-o6srdtRHMU0t5gm7ucDpp6Cz`

# 실행 메모

- `runCompleteProcessInMemory()`: 전체 파이프라인 (메모리 기반, 파일 I/O 최소화)
- `processNextSEOFile_V7HTML(geminiContext)`: V7 HTML 글 생성 (Gemini 컨텍스트 선택 활용)
- `STEP_B_geminiAnalysis()`: Gemini 스타일 분석 (선택)
- `STEP_D2_SaveAsHTML()`: SEO 결과 → HTML 저장
- `clasp push --force`로만 코드 반영 가능
