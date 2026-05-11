# SEO 블로그 자동화 시스템 (Google Apps Script)

## 📋 프로젝트 개요

**프로젝트명**: SEO Blog Automation System  
**버전**: v1.0  
**플랫폼**: Google Apps Script  
**주요 기능**: HTML/TXT 파일을 Claude AI로 SEO 최적화된 Google Docs 블로그 포스트로 자동 변환

---

## 🎯 핵심 목표

1. **자동화**: HTML 및 유튜브 자막(TXT) 파일을 블로그 포스트로 자동 변환
2. **SEO 최적화**: Claude AI를 활용한 키워드 중심 콘텐츠 재구성
3. **스타일 커스터마이징**: 템플릿 및 스타일 파라미터 기반 글쓰기 톤 조절
4. **효율성**: 메모리 기반 처리로 중간 파일 최소화

---

## 🏗️ 시스템 아키텍처

### 처리 파이프라인
```
입력 파일 (HTML/TXT)
    ↓
전처리 (본문 추출, 키워드 분석)
    ↓
스타일 & 템플릿 로드 (Google Sheets)
    ↓
Claude AI 프롬프트 생성
    ↓
SEO 콘텐츠 생성 (Claude API)
    ↓
Google Docs 생성 (Apple + 네이버 스타일)
    ↓
원본 파일 정리
```

### 폴더 구조
| 폴더 | 용도 | 파일 타입 |
|------|------|----------|
| 메인 입력 | 처리할 원본 파일 | HTML, TXT |
| 스타일 분석 | HTML 스타일 분석 전용 | HTML |
| JSON 출력 | 중간 처리 데이터 | JSON |
| Docs 출력 | 최종 블로그 문서 | Google Docs |

---

## 🔧 기술 스택

- **언어**: JavaScript (Google Apps Script)
- **AI**: Claude Sonnet 4.5 (Anthropic API)
- **플랫폼**: Google Drive, Google Docs, Google Sheets
- **처리 방식**: 비동기 파이프라인, 메모리 최적화

---

## 📊 주요 모듈

### 1. 전처리 모듈
- HTML 본문 추출 및 태그 제거
- 유튜브 자막 정제 (구어체 → 문어체)
- 키워드 추출 및 문단 분석
- 5만자 제한 최적화

### 2. 스타일 & 템플릿 시스템
- **시트2**: 7가지 스타일 파라미터 (글톤, 문장스타일, 개인터치 등)
- **시트3**: 콘텐츠 구조 템플릿 (제품소개형, 유튜브스크립트형 등)
- **스프레드시트 설정**: A2(강조 키워드), B2(스타일 번호), C2(SEO 키워드), H2(템플릿)

### 3. Claude AI 통합
- 완전 재구성형 프롬프트 (벤치마킹 70% + 강조 키워드 30%)
- 25-40자 클릭 유도 제목 자동 생성
- 템플릿별 사진 플레이스홀더 12개 자동 생성
- API 속도 제한 및 에러 핸들링

### 4. Google Docs 스타일링
- **Apple 스타일**: 미니멀 타이포그래피, 절제된 색상
- **네이버 블로그 스타일**: 친근한 요약 박스, 이모지 하이라이트
- SEO 키워드 자동 볼드 처리

---

## 🚀 주요 함수

### 통합 처리
- `runCompleteProcess()`: 전처리 → SEO → Docs 생성 (1개 파일)
- `runCompleteProcessInMemory()`: JSON 저장 없이 메모리에서만 처리
- `processNextSEOFile()`: 다음 파일 1개만 SEO 처리
- `STEP_D1_Simple_SEO_Docs()`: SEO 파일 → Google Docs 변환

### 유틸리티
- `checkSystemStatusUpdated()`: 시스템 상태 확인
- `testStyleSheetSystem()`: 설정 테스트
- `deleteProcessedSourceFiles()`: 처리 완료 파일 삭제
- `resetAllProcessedFiles()`: 전체 초기화

---

## ⚙️ 설정 방법

1. **API 키 설정**: `STEP5_configOnce_setAnthropicKey(KEY)` 실행
2. **스프레드시트 설정**:
   - A2: 강조 키워드 (쉼표 구분, 최대 5개)
   - B2: 스타일 번호 (1-5)
   - C2: SEO 키워드 (쉼표 구분)
   - H2: 템플릿 선택
3. **폴더 ID 확인**: `CONFIG` 객체의 폴더 ID가 올바른지 확인

---

## 📝 사용 워크플로우

1. HTML 또는 TXT 파일을 메인 입력 폴더에 업로드
2. 스프레드시트에서 설정 (A2, B2, C2, H2)
3. `runCompleteProcess()` 함수 실행
4. Google Docs 출력 폴더에서 결과 확인

---

## ⚠️ 주의사항

### 보안
- **하드코딩된 API 키 제거 필수** (라인 17-21)
- PropertiesService만 사용하여 API 키 관리

### 성능
- Claude API 속도 제한: 5분당 1개 파일 권장
- 대용량 파일: 5만자 자동 제한

### 에러 처리
- API 429 에러 시 5분 대기 후 재시도
- 파일 삭제 권한 확인 필요

---

## 🔄 버전 관리

- **현재 버전**: v1.0
- **최종 수정일**: 2026-01-19
- **주요 변경사항**: 초기 버전 생성

---

## 📞 문의 및 지원

- **개발자**: ssup.pi
- **프로젝트 경로**: `/Users/ssup.pi/Documents/Antigravity_Project/Blog`
