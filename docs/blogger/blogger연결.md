# Blogger API 연결 가이드

> 작성일: 2026-04-28  
> 환경: Google Apps Script + Blogger API v3

---

## 전체 흐름 요약

```
GCP 프로젝트 생성
    ↓
OAuth 동의 화면 구성
    ↓
Blogger API v3 활성화
    ↓
Apps Script에 GCP 프로젝트 연결
    ↓
appsscript.json OAuth 범위 추가
    ↓
UrlFetchApp으로 연결 테스트
    ↓
✅ 완료
```

---

## 1단계 - GCP 프로젝트 생성

1. [console.cloud.google.com](https://console.cloud.google.com) 접속
2. 상단 프로젝트 드롭다운 → **새 프로젝트** 클릭
3. 프로젝트 이름 입력 (예: `Blog Automation`)
4. **만들기** 클릭
5. 생성된 프로젝트의 **프로젝트 번호** 복사

> ⚠️ 기존 프로젝트 활용 가능 - Antigravity 프로젝트 번호: `122520894478`

---

## 2단계 - OAuth 동의 화면 구성

1. Cloud Console → **API 및 서비스** → **OAuth 동의 화면**
2. 앱 유형: **내부** 선택 → **만들기**
3. 필수 정보 입력:

| 항목 | 입력값 |
|------|--------|
| 앱 이름 | `Blog Automation` (영문, 띄어쓰기 사용) |
| 사용자 지원 이메일 | 본인 Gmail |
| 개발자 연락처 이메일 | 본인 Gmail |

4. 나머지 빈칸 → **저장 후 계속** 클릭
5. 범위 설정 건드리지 않고 → **저장 후 계속**
6. **테스트 사용자** → 본인 Gmail 추가

> ⚠️ 앱 이름에 하이픈(`-`) 사용 시 오류 발생 → 띄어쓰기 사용

---

## 3단계 - Blogger API v3 활성화

1. Cloud Console → **API 및 서비스** → **라이브러리**
2. 검색창에 `Blogger` 입력
3. **Blogger API** 클릭
4. **사용 설정** 클릭 → 상태: `사용 설정됨` 확인

---

## 4단계 - Apps Script에 GCP 프로젝트 연결

1. Apps Script 에디터 → 좌측 **프로젝트 설정** (톱니바퀴)
2. **GCP 프로젝트** 섹션 → **프로젝트 변경** 클릭
3. 프로젝트 번호 입력: `122520894478`
4. **프로젝트 설정** 클릭

> ⚠️ Apps Script 기본 GCP(기본값) 상태에서는 Blogger API 연결 불가

---

## 5단계 - appsscript.json 수정

### 파일 열기
1. Apps Script 에디터 → **프로젝트 설정** (톱니바퀴)
2. **"appsscript.json 매니페스트 파일을 편집기에 표시"** 체크
3. 편집기에서 `appsscript.json` 클릭

### 최종 내용 (전체 교체)

```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "AdSense",
        "version": "v2",
        "serviceId": "adsense"
      },
      {
        "userSymbol": "AdminDirectory",
        "version": "directory_v1",
        "serviceId": "admin"
      }
    ]
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/blogger",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

---

## 6단계 - 연결 테스트 코드

### 블로그 정보 확인

```javascript
function testBloggerAPI() {
  try {
    var blogId = '3911627335922911456';
    var url = 'https://www.googleapis.com/blogger/v3/blogs/' + blogId;
    
    var options = {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());
    
    Logger.log('✅ 연결 성공!');
    Logger.log('전체 응답: ' + JSON.stringify(result));
    
  } catch(e) {
    Logger.log('❌ 오류: ' + e.message);
  }
}
```

### 테스트 글 발행

```javascript
function testBloggerPost() {
  try {
    var blogId = '3911627335922911456';
    var url = 'https://www.googleapis.com/blogger/v3/blogs/' + blogId + '/posts';
    
    var post = {
      title: '테스트 글입니다',
      content: '<h2>자동 발행 테스트</h2><p>Apps Script에서 자동으로 발행한 글입니다.</p>'
    };
    
    var options = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(post),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());
    
    Logger.log('✅ 발행 성공!');
    Logger.log('글 제목: ' + result.title);
    Logger.log('글 URL: ' + result.url);
    
  } catch(e) {
    Logger.log('❌ 오류: ' + e.message);
  }
}
```

---

## 연결 완료 정보

| 항목 | 내용 |
|------|------|
| GCP 프로젝트 | Antigravity (`122520894478`) |
| 블로그 이름 | 건축자재 인사이드 |
| 블로그 ID | `3911627335922911456` |
| 블로그 URL | https://daesan-inside.blogspot.com/ |
| 언어 | 한국어 |

---

## 트러블슈팅

| 오류 | 원인 | 해결 |
|------|------|------|
| `Blogger is not defined` | 서비스 추가 안 됨 | UrlFetchApp 방식 사용 |
| `insufficient authentication scopes` | oauthScopes 미설정 | appsscript.json에 blogger 범위 추가 |
| `프로젝트가 존재하지 않음` | 잘못된 프로젝트 번호 | GCP 대시보드에서 정확한 번호 확인 |
| `앱 이름 오류` | 하이픈 사용 | 영문 띄어쓰기로 변경 |
| `액세스 차단됨` | 테스트 사용자 미등록 | OAuth 동의 화면에서 Gmail 추가 |
