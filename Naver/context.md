# Naver 블로그 자동화 - 개발 컨텍스트

## 마지막 작업일
2026-06-05

## 완료 사항
- BlogConfig/ MD 파일 3개 생성 (template-tone.md, template-layout.md, template-section.md)
- loadTemplateConfig_() 신규 함수 추가
- clearTemplateCache() 신규 함수 추가
- createV7HTMLPrompt() 리팩토링 (MD 로딩 + 폴백)
- 올바른 스크립트 ID(1LjJcIC1...)에 clasp push 완료
- 잘못 푸시된 스크립트(11Oqwz80T8...) 롤백 완료

## 미완료 - 중단 지점
- [CONFIG_TEST_OK] 반영 테스트 미완료
- Claude API 호출 전 중단됨 (SEO 키워드 또는 API 키 없음 오류)

## 미설정 스크립트 속성 (재개 시 설정 필요)
- CLAUDE_API_KEY
- NAVER_CONFIG_FOLDER_ID
- GEMINI_API_KEY (선택)

## 스크립트 ID
- Naver 신규: 1LjJcIC1lhD9x9Koy1IFWNC-9Zc1ssvbJQkSSCUVmxOyv76AyHzjbBdUl
- Blogger 원본: 11Oqwz80T8dmsZoYbP4Xh7EsMQMDodK8BwIqQx5V2sltSiZlD4Ji4-et_

## 다음 재개 시 작업
1. 스크립트 속성 CLAUDE_API_KEY, NAVER_CONFIG_FOLDER_ID 설정
2. 재실행 → [CONFIG_TEST_OK] 로그 확인
3. 확인 후 [CONFIG_TEST_OK] 줄 삭제
