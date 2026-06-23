<!-- 주의: ## PROMPT_TEXT 섹션은 반드시 파일 최하단에 위치해야 합니다.
     이 섹션 아래에 새로운 ## 헤더를 추가하면 프롬프트에 오염됩니다. -->

# V7 HTML 템플릿 — 레이아웃 & 컴포넌트

Apps Script의 `loadTemplateConfig_()` 가 `## PROMPT_TEXT` 이하를 추출해 시스템 프롬프트에 주입합니다.
이 파일을 Google Drive에 업로드하면 Code.gs 수정 없이 HTML 구조/CSS를 바꿀 수 있습니다.

## 수정 가이드

| 수정 항목 | 변경 위치 |
|---------|--------|
| 글자 크기 | 제목 `font-size:28px` / 섹션제목 `font-size:22px` / 본문 `font-size:17px` |
| 행간 | `line-height:1.9` → 1.6~2.2 권장 |
| 최대 너비 | `max-width:720px` (네이버 블로그 기준) |
| 박스 배경색 | 사진박스/TIP박스 `#f0f0f0` 교체 |
| 본문 색상 | `color:#222` → 더 진하게 `#111`, 연하게 `#333` |
| 비교테이블 헤더 | `background-color:#222` 교체 |
| 마무리 정렬 | `text-align:center` → `left` 가능 |

- 파일 저장 후 반드시 Google Drive에 재업로드 필요
- 변경사항은 CacheService 만료(6시간) 후 또는 `clearTemplateCache()` 실행 후 반영

---

## PROMPT_TEXT
[출력 형식 - 고정 표준 템플릿]
<table style="width:100%;max-width:720px;margin:0 auto;border-collapse:collapse;font-family:'Noto Sans KR',sans-serif;font-size:17px;line-height:1.9;color:#222;">

1. 제목: <tr><td style="font-size:28px;font-weight:bold;padding:20px 0 8px 0;">제목</td></tr>
2. 부제목: <tr><td style="color:#777;padding-bottom:30px;">부제목</td></tr>
3. 섹션제목: <tr><td style="font-size:22px;font-weight:bold;padding:40px 0 15px 0;">01. 섹션명</td></tr>
4. 일반문단: <tr><td>본문 내용</td></tr>
5. 특징목록: <tr><td>✓ 특징 항목</td></tr>
6. 사진박스: <tr><td><table style="width:100%;background-color:#f0f0f0;border-collapse:collapse;"><tr><td style="padding:25px;text-align:center;color:#888;">📷 사진 N: 설명</td></tr></table></td></tr>
7. TIP박스: <tr><td style="padding:20px 0;"><table style="width:100%;background-color:#f0f0f0;border-collapse:collapse;"><tr><td style="padding:18px 20px;">💡 <b>TIP</b><br>내용</td></tr></table></td></tr>
8. 비교테이블: 별도 <table> 중첩 (헤더:#222배경 흰글씨, 짝수행:#f9f9f9배경)
9. 마무리: <tr><td style="padding:30px 0;text-align:center;"><b>마무리 질문</b><br>핵심메시지<br>CTA</td></tr>

</table>
