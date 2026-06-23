# V7 HTML 템플릿 — 섹션 수 & 구조 설정

## 섹션 수 규칙

| 템플릿명 | 섹션 수 |
|---------|--------|
| 기본 (제품소개형 등) | 6 |
| 시공가이드 | 7 |
| 트렌드분석 | 7 |

## 섹션 수 추가/변경 방법

Apps Script `createV7HTMLPrompt()` 내부의 `sectionCount` 분기 로직을 수정합니다.

현재 로직:
```javascript
var sectionCount = 6;
if (templateName.indexOf('시공가이드') !== -1 || templateName.indexOf('트렌드분석') !== -1) {
  sectionCount = 7;
}
```

새 템플릿을 7섹션으로 추가하려면 조건을 확장합니다:
```javascript
if (
  templateName.indexOf('시공가이드') !== -1 ||
  templateName.indexOf('트렌드분석') !== -1 ||
  templateName.indexOf('새템플릿명') !== -1
) {
  sectionCount = 7;
}
```

## 시트3 템플릿과의 연계

섹션 수는 시트3에서 선택한 템플릿명으로 자동 결정됩니다.
시트3에 새 템플릿 추가 후 이 파일의 표도 업데이트하세요.

## 수정 가이드

- **섹션 수만 바꾸기**: 시트3에서 템플릿 이름에 `시공가이드` 또는 `트렌드분석` 포함 여부로 제어 가능
- **고정 섹션 수**: 8섹션 이상 필요 시 Code.gs의 `sectionCount` 로직 직접 수정 필요
