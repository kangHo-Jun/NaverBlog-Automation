# context

## 프로젝트 정체성
- 프로젝트명: `NaverBlog-Automation`
- 목적: 건축자재 원본 자료를 읽어 네이버 블로그용 HTML 글을 자동 생성하고 Drive에 결과 파일을 저장
- 현재 주력 파이프라인: `runV7HTMLPipeline()`
- 코드 파일: `src/Code.gs`
- Apps Script ID: `1LjJcIC1lhD9x9Koy1IFWNC-9Zc1ssvbJQkSSCUVmxOyv76AyHzjbBdUl`

## 핵심 시스템 구조
```text
입력 파일 업로드
  → STEP_A_preprocessFiles()
  → STEP_B_geminiAnalysis()
  → processNextSEOFile_V7HTML()
    → createV7HTMLPrompt()
  → STEP_D2_SaveAsHTML()
  → 결과 HTML 저장
```

## 핵심 시트/폴더
- 컨트롤 시트 ID: `1ln-FEi1W0ZPKmVFmBUp6iuQ8dm6ijoGVFB6qqCFP1Q0`
- 시트1: 운영 입력/상태
- 시트2: 스타일 정의
- 시트3: 템플릿 정의

### Drive 폴더
- 입력: `1zhLKKQBOAxH1twa-oCdbKB_tS-w5z7A2`
- 처리완료 원본: `1LZoAigieMnmCaPtbCntkwFBVk878cot_`
- 스타일 분석: `1viEjA-r-o6srdtRHMU0t5gm7ucDpp6Cz`
- JSON 출력: `15AXwc1WiLraCJYlt4pXIjkb097By3z9k`
- 결과 출력: `182B3-CSkXS5DYRhX9SyH_3SDax3pzhuD`

## 브랜드 원칙
- 대산은 제조사가 아니라 유통/공급 포지션으로 표현
- 허용 표현:
  - `대산을 통해 공급되는`
  - `대산에서 취급하는`
  - `대산 공식 유통`
- 글 1편당 1~2회 수준으로만 자연 노출

## 콘텐츠 원칙
- 근거 없는 수치 생성 금지
- AI 티 방지 규칙 적용
- material-cautions Markdown 동적 주입
- CTA/FAQ/서명블록은 하단 고정

## 핵심 프롬프트 함수
- `createV7HTMLPrompt()`
  - system:
    - 브랜드 노출 원칙
    - AI 티 방지 원칙
    - 자재별 시공 주의사항
    - CTA/FAQ/서명블록 고정 구조
  - user:
    - SEO 키워드
    - 강조 키워드
    - Gemini 분석 요약
    - 템플릿/섹션 지시

## 현재 상태
- Blogger 전용 후처리 함수 상당수 제거 완료
- 구형 Docs/Blogger 경로 일부 보조 함수는 아직 남아 있을 수 있음
- 현재 운영 문서 기준의 권장 경로는 `runV7HTMLPipeline()`
- 메뉴 항목과 실제 권장 파이프라인이 완전히 일치하지 않을 수 있음

## 주요 결정사항
- 최종 산출은 Google Docs가 아니라 HTML 파일
- CTA는 FAQ 바로 앞
- FAQ는 CTA 다음
- 서명블록은 문서 맨 마지막
- JSON/결과 출력 폴더는 Naver 전용 폴더로 분리 완료
- `material-cautions_naver.md`는 Drive 파일 ID로 직접 로드

## 새 대화 시작 시 우선 확인할 것
1. `.clasp.json`의 `scriptId`가 Naver 프로젝트를 가리키는지
2. `CONFIG`의 5개 폴더 ID가 맞는지
3. 현재 메인 진입점이 `runV7HTMLPipeline()`인지
4. `createV7HTMLPrompt()`의 고정 요소 위치 지시가 유지되는지
5. `loadMaterialCautions_()`의 Drive 파일 ID가 유지되는지
