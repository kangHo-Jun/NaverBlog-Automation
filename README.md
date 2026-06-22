# 네이버 블로그 SEO 자동화 시스템 (Google Docs 포맷팅)

HTML/MHTML 문서, 유튜브 자막(TXT), PDF OCR 등 다양한 원본 소스 파일을 전처리한 뒤, Claude AI를 통해 네이버 블로그 포맷과 Apple 미니멀리즘 스타일이 적용된 SEO 최적화 Google Docs를 자동으로 작성하는 시스템입니다.

## 📁 주요 폴더 구조
- `src/Code.gs` & `appsscript.json`: Google Apps Script 메인 소스코드 (Clasp 연동)
- `docs/`: 프로젝트 아키텍처 및 의사결정 이력(ADR)
- `examples/`: 스타일별 생성 결과물 예시 모음
- `콘텐츠/`: 석고보드 및 목자재 기획 보고서

## ⚙️ 시스템 정보
- **Clasp Script ID**: `1LjJcIC1lhD9x9Koy1IFWNC-9Zc1ssvbJQkSSCUVmxOyv76AyHzjbBdUl`
- **컨트롤 시트 ID**: `1ln-FEi1W0ZPKmVFmBUp6iuQ8dm6ijoGVFB6qqCFP1Q0`
- **출력 방식**: Google Docs 생성 후 네이버 블로그에 수동 복사-붙여넣기 발행용

## 🚀 주요 함수 설명
1. `runCompleteProcessInMemory()`: 중간 파일 I/O를 배제하고 메모리 내에서 전처리부터 Claude API 호출, Google Docs 생성까지 논스톱으로 처리하는 메인 함수.
2. `STEP_B_geminiAnalysis()`: Gemini API를 이용해 원본 스타일 분석 후 템플릿 제안을 받는 모듈.
3. `resetForNewPost()`: 새로운 글 작성을 위해 기존 캐시 및 임시 플래그 상태를 리셋하는 초기화 함수.
