/***** 최종 통합 SEO 블로그 자동화 시스템 - HTML + TXT 지원 버전 *****/

/**
 * =======================================================================
 * [1] 상수 및 설정
 * =======================================================================
 */

// 🔑 Script Properties Key Names (상수)
const PROP_KEYS = {
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  PPLX_API_KEY: 'PPLX_API_KEY',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  GEMINI_API_KEY: 'GEMINI_API_KEY'
};

// **⚠️주의: 보안에 취약하므로 아래에 직접 입력한 키는 사용 후 반드시 삭제하세요.**
// Perplexity AI 키를 여기에 직접 입력합니다.
const HARDCODED_PPLX_KEY = "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";
// OpenAI 키를 여기에 직접 입력합니다.
const HARDCODED_OPENAI_KEY = "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";
// Claude(Anthropic) 키를 여기에 직접 입력합니다.
const HARDCODED_ANTHROPIC_KEY = "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";

// Spreadsheet 기본 설정
const SHEET_NAME_MAIN = '시트1';
const SHEET_NAME_STYLE = '시트2'; // 스타일 분석 데이터 저장용

// Claude(Anthropic) 기본 설정
const CLAUDE_DEFAULTS = {
  ENDPOINT: 'https://api.anthropic.com/v1/messages',
  MODEL: 'claude-sonnet-4-5-20250929',
  MAX_TOKENS: 8000,
  TEMPERATURE: 0.3,
  VERSION: '2023-06-01'
};

// 🗂️ 폴더 분리 설정
const CONFIG = {
  INPUT_FOLDER_ID: '1J_wn9JIilhkyfOBvxkEB1C5B0f5LzNj8',      // 업로드 파일 폴더 (메인 처리용)
  STYLE_ANALYSIS_FOLDER_ID: '1viEjA-r-o6srdtRHMU0t5gm7ucDpp6Cz', // 스타일 분석 전용 폴더 (신규)
  JSON_OUTPUT_FOLDER_ID: '1wr_0xqWOqStu7AFw3NP9RktXA-f7AR0o',  // JSON 파일 다운로드 폴더
  DOCS_OUTPUT_FOLDER_ID: '1u5ZSrhZPLjS4q5jTUdRP-zEdDDNaCY8W'   // 구글독스 파일 다운로드 폴더
};

// 🏠 Blogger 설정
const BLOG_ID = '3911627335922911456';


/**
 * =======================================================================
 * [2] 공통 유틸리티 함수 (먼저 정의)
 * =======================================================================
 */

/**
 * 스프레드시트에 토스트 알림을 표시합니다.
 */
function toast_(msg) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, '블로그 자동화', 5);
  } catch (e) {
    Logger.log('토스트 알림: ' + msg);
  }
}

/**
 * 저장된 Anthropic API 키를 가져옵니다.
 */
function getAnthropicKey_() {
  var key = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.ANTHROPIC_API_KEY);
  if (!key && HARDCODED_ANTHROPIC_KEY) return HARDCODED_ANTHROPIC_KEY;
  return key || '';
}

/**
 * 저장된 Gemini API 키를 가져옵니다.
 */
function getGeminiKey_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_KEYS.GEMINI_API_KEY) || '';
}

/**
 * 이미 처리된 파일인지 확인
 */
function isAlreadyProcessed(baseName, outputFolder, suffix) {
  var targetFileName = baseName + suffix;
  var files = outputFolder.getFilesByName(targetFileName);
  return files.hasNext();
}

/**
 * 구글독스 파일 존재 여부 확인
 */
function isDocumentExists(folder, docTitle) {
  var files = folder.getFilesByName(docTitle);
  return files.hasNext();
}

/**
 * =======================================================================
 * [3] HTML 분석 및 전처리 함수들
 * =======================================================================
 */

/**
 * 향상된 HTML 태그 제거 (더 깔끔하게)
 */
function stripTags(s) {
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 특정 태그 추출 (H2 등)
function extractTags(html, tagName) {
  var re = new RegExp('<' + tagName + '[^>]*>([\\s\\S]*?)<\\/' + tagName + '>', 'gi');
  var items = [];
  var m;
  while ((m = re.exec(html)) !== null) {
    var t = stripTags(m[1]).trim();
    if (t) items.push(t);
  }
  return items;
}

// 문단 분할
function splitParagraphs(text) {
  return String(text).split(/[\r\n]{2,}/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
}

// 문장 분할
function splitSentences(text) {
  return String(text).split(/[.!?][\s]+|\n+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
}

// 상위 키워드 추출
function getTopKeywords(text, topN) {
  var t = String(text).toLowerCase();
  var words = t.replace(/[^가-힣a-zA-Z0-9\s]/g, " ").split(/\s+/).filter(function(w) { return w.length > 0; });
  var stop = {
    "의": true, "이": true, "가": true, "을": true, "를": true, "은": true, "는": true, "와": true, "과": true, "에": true,
    "the": true, "a": true, "an": true, "and": true, "or": true, "but": true, "for": true, "to": true, "of": true, "in": true,
    "nbsp": true, "br": true, "div": true, "span": true, "img": true, "alt": true, "src": true
  };
  var freq = {};
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (stop[w]) continue;
    if (w.length <= 1) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  var entries = [];
  for (var word in freq) {
    entries.push([word, freq[word]]);
  }
  entries.sort(function(a, b) { return b[1] - a[1]; });
  return entries.slice(0, topN).map(function(entry) { return entry[0]; });
}

// 불릿 비율 계산
function calcBulletRatio(html) {
  var text = stripTags(html);
  var lines = text.split(/\n+/);
  if (!lines.length) return 0;
  var bulletLike = 0;
  for (var i = 0; i < lines.length; i++) {
    if (/^\s*[-–—\*•▪︎]/.test(lines[i]) || /^\s*\d+\./.test(lines[i])) {
      bulletLike++;
    }
  }
  return Math.round((bulletLike / lines.length) * 100) / 100;
}

// 존댓말 점수 계산
function calcHonorificScore(text) {
  var t = String(text);
  var matches = t.match(/요|입니다|습니다|드립니다|해드리|도와드리|주세요/g) || [];
  var sentences = splitSentences(t);
  return Math.round((matches.length / Math.max(1, sentences.length)) * 100) / 100;
}

/**
 * 본문 영역 추출 함수
 */
function extractMainContent(html) {
  // 일반적인 본문 영역 패턴들
  var contentPatterns = [
    // 네이버 블로그
    /<div[^>]*class[^>]*se-main-container[^>]*>[\s\S]*?<\/div>/i,
    /<div[^>]*class[^>]*post[^>]*>[\s\S]*?<\/div>/i,
    /<div[^>]*class[^>]*entry[^>]*>[\s\S]*?<\/div>/i,
    
    // 일반 블로그/사이트
    /<article[\s\S]*?<\/article>/i,
    /<main[\s\S]*?<\/main>/i,
    /<div[^>]*class[^>]*content[^>]*>[\s\S]*?<\/div>/i,
    /<div[^>]*id[^>]*content[^>]*>[\s\S]*?<\/div>/i,
    
    // 뉴스 사이트
    /<div[^>]*class[^>]*article[^>]*>[\s\S]*?<\/div>/i,
    /<section[^>]*class[^>]*article[^>]*>[\s\S]*?<\/section>/i
  ];
  
  // 패턴 매칭으로 본문 추출 시도
  for (var i = 0; i < contentPatterns.length; i++) {
    var match = html.match(contentPatterns[i]);
    if (match && match[0].length > 500) { // 최소 길이 확인
      Logger.log('✅ 본문 영역 추출 성공 (패턴 ' + (i + 1) + ')');
      return match[0];
    }
  }
  
  // 패턴 매칭 실패 시 body 태그 내용 추출
  var bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  if (bodyMatch) {
    Logger.log('📄 body 태그 내용 사용');
    return bodyMatch[0];
  }
  
  // 최후의 수단: 전체 HTML (이미 정리된 상태)
  Logger.log('⚠️ 전체 HTML 사용 (본문 추출 실패)');
  return html;
}

/**
 * 최적화된 HTML 분석 함수 - 본문만 추출하여 크기 최소화
 */
function analyzeHtml(html) {
  // 1. 불필요한 요소들 사전 제거
  var cleanHtml = html
    // 스크립트, 스타일 완전 제거
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    
    // 광고 관련 제거
    .replace(/<div[^>]*class[^>]*ad[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*id[^>]*ad[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    
    // 댓글, 사이드바 등 제거
    .replace(/<div[^>]*class[^>]*comment[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*class[^>]*sidebar[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    
    // 이미지 태그 간소화 (alt 텍스트만 보존)
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, "[이미지: $1]")
    .replace(/<img[^>]*>/gi, "[이미지]")
    
    // 링크 간소화 (텍스트만 보존)
    .replace(/<a[^>]*href[^>]*>(.*?)<\/a>/gi, "$1");

  // 2. 본문 영역 추출 시도
  var mainContent = extractMainContent(cleanHtml);
  
  // 3. 최종 텍스트 추출 및 크기 제한
  var fulltext = stripTags(mainContent)
    .replace(/\s+/g, " ")
    .trim();
  
  // 텍스트 크기 제한 (5만자)
  if (fulltext.length > 50000) {
    Logger.log('⚠️ 텍스트가 너무 깁니다. 5만자로 제한합니다. (원본: ' + fulltext.length + '자)');
    fulltext = fulltext.substring(0, 50000) + "...";
  }
  
  var content_outline = extractTags(mainContent, "h2");
  var paragraphs = splitParagraphs(fulltext).filter(function(p) { return p.length >= 50; }); // 최소 길이 줄임
  var reference_snippets = paragraphs.slice(0, 3);
  var keywords_top = getTopKeywords(fulltext, 5);
  var sentences = splitSentences(fulltext);
  var avg_sentence_len = sentences.length ? Math.round(sentences.join(" ").length / sentences.length) : 0;
  var bullet_ratio = calcBulletRatio(mainContent);
  var h2_count = content_outline.length;
  var honorific_score = calcHonorificScore(fulltext);

  return {
    file_type: 'html',
    style_hints: {
      h2_count: h2_count,
      avg_sentence_len: avg_sentence_len,
      bullet_ratio: bullet_ratio,
      honorific_score: honorific_score
    },
    content_outline: content_outline,
    reference_snippets: reference_snippets,
    keywords_top: keywords_top,
    fulltext: fulltext // 크기 제한된 본문만
  };
}

/**
 * =======================================================================
 * [3-B] TXT 분석 및 전처리 함수들 (신규)
 * =======================================================================
 */

/**
 * 유튜브 스크립트 TXT 파일 정제 함수
 */
function cleanYoutubeScript(text) {
  // 1. 자막 특수문자 제거
  text = text
    .replace(/\[음악\]/g, '')
    .replace(/\[박수\]/g, '')
    .replace(/\[웃음\]/g, '')
    .replace(/\[Korean \(auto-generated\)\]/g, '')
    .replace(/\[GetSubs\.cc\]/g, '')
    .replace(/\[\w+\s*\(auto-generated\)\]/g, '')
    .replace(/\[.*?\]/g, ''); // 나머지 대괄호 제거
  
  // 2. 여러 공백을 하나로
  text = text.replace(/\s+/g, ' ').trim();
  
  // 3. 짧은 문장들을 합치기
  var lines = text.split('\n').map(function(line) { return line.trim(); }).filter(function(line) { return line.length > 0; });
  
  var mergedLines = [];
  var currentParagraph = '';
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    
    // 현재 줄을 문단에 추가
    if (currentParagraph.length > 0) {
      // 이전 문장이 문장 종결 부호로 끝나면 띄어쓰기 추가
      if (/[.!?요다]$/.test(currentParagraph)) {
        currentParagraph += ' ' + line;
      } else {
        // 아니면 그냥 붙이기
        currentParagraph += ' ' + line;
      }
    } else {
      currentParagraph = line;
    }
    
    // 문단이 충분히 길어지면 (100자 이상) 다음으로
    if (currentParagraph.length >= 100 && /[.!?요다]$/.test(currentParagraph)) {
      mergedLines.push(currentParagraph);
      currentParagraph = '';
    }
  }
  
  // 남은 문단 추가
  if (currentParagraph.length > 0) {
    mergedLines.push(currentParagraph);
  }
  
  return mergedLines.join('\n\n');
}

/**
 * TXT 파일 분석 함수 (유튜브 스크립트 특화)
 */
function analyzeTxtScript(text) {
  Logger.log('📝 TXT 파일 분석 시작 (유튜브 스크립트)');
  
  // 1. 스크립트 정제
  var cleanedText = cleanYoutubeScript(text);
  
  // 텍스트 크기 제한 (5만자)
  if (cleanedText.length > 50000) {
    Logger.log('⚠️ 텍스트가 너무 깁니다. 5만자로 제한합니다. (원본: ' + cleanedText.length + '자)');
    cleanedText = cleanedText.substring(0, 50000) + "...";
  }
  
  // 2. 문단 분할
  var paragraphs = splitParagraphs(cleanedText).filter(function(p) { return p.length >= 30; });
  var reference_snippets = paragraphs.slice(0, 5); // TXT는 조금 더 많이
  
  // 3. 키워드 추출
  var keywords_top = getTopKeywords(cleanedText, 8); // TXT는 키워드 더 많이
  
  Logger.log('✅ TXT 분석 완료 - 문단: ' + paragraphs.length + '개, 키워드: ' + keywords_top.length + '개');
  
  return {
    file_type: 'txt',
    style_hints: {
      h2_count: 0,           // TXT는 스타일 분석 안 함
      avg_sentence_len: 0,
      bullet_ratio: 0,
      honorific_score: 0
    },
    content_outline: [],     // TXT는 H2 태그 없음
    reference_snippets: reference_snippets,
    keywords_top: keywords_top,
    fulltext: cleanedText
  };
}

/**
 * =======================================================================
 * [3-C] 통합 전처리 함수 (HTML + TXT)
 * =======================================================================
 */

/**
 * 처리 가능한 새로운 파일들만 필터링 (HTML + TXT, 최신 파일 1개만)
 */
function getNewFilesToProcess() {
  var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
  var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
  
  var newFiles = [];
  var files = inputFolder.getFiles();
  
  while (files.hasNext()) {
    var f = files.next();
    var name = f.getName();
    
    // HTML 또는 TXT 파일, PDF 파일 처리
    if (!/\.(html?|mhtml|mht|txt|pdf)$/i.test(name)) continue;
    
    var baseName = name.replace(/\.[^.]+$/, '');
    
    // 이미 전처리된 파일인지 확인
    if (!isAlreadyProcessed(baseName, jsonOutputFolder, '_preprocess.json')) {
      newFiles.push({
        file: f,
        name: name,
        baseName: baseName,
        lastModified: f.getLastUpdated().getTime()
      });
    } else {
      Logger.log('⚠️ 이미 처리됨 - 스킵: ' + name);
    }
  }
  
  if (newFiles.length === 0) {
    return [];
  }
  
  // 업로드 시간(수정 시간) 순으로 정렬 (최신 것부터)
  newFiles.sort(function(a, b) {
    return b.lastModified - a.lastModified;
  });
  
  // 가장 최신 파일 1개만 반환
  Logger.log('📋 최신 업로드 파일 1개만 전처리: ' + newFiles[0].name);
  return [newFiles[0]];
}

/**
 * Drive 기본 폴더 접근 테스트
 * 프로젝트 권한과 DriveApp 폴더 조회가 정상인지 가장 단순하게 확인할 때 사용
 */
function testDriveOnly() {
  var folder = DriveApp.getFolderById('1J_wn9JIilhkyfOBvxkEB1C5B0f5LzNj8');
  Logger.log('✅ 폴더명: ' + folder.getName());
}

/**
 * 입력/출력 폴더 접근 테스트
 * getNewFilesToProcess() 오류가 폴더 ID 또는 권한 문제인지 빠르게 확인할 때 사용
 */
function testFolderAccess() {
  try {
    Logger.log("🔍 === 폴더 접근 테스트 ===");
    Logger.log("INPUT_FOLDER_ID: " + CONFIG.INPUT_FOLDER_ID);
    Logger.log("JSON_OUTPUT_FOLDER_ID: " + CONFIG.JSON_OUTPUT_FOLDER_ID);
    
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    Logger.log("✅ 입력 폴더 접근 성공: " + inputFolder.getName());
    
    var jsonFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    Logger.log("✅ JSON 폴더 접근 성공: " + jsonFolder.getName());
    
    var fileCount = 0;
    var files = inputFolder.getFiles();
    while (files.hasNext() && fileCount < 5) {
      var file = files.next();
      fileCount++;
      Logger.log("  - 파일 " + fileCount + ": " + file.getName());
    }
    
    Logger.log("✅ 폴더 접근 테스트 완료");
    return true;
  } catch (error) {
    Logger.log("❌ testFolderAccess 오류: " + error.message);
    return false;
  }
}

// 테스트 1: Drive 기본 권한 확인
function dbg01_DriveBasic() {
  Logger.log('=== Drive 기본 테스트 ===');
  Logger.log('DriveApp 객체: ' + (DriveApp ? '존재' : '없음'));
  try {
    var files = DriveApp.getFiles();
    Logger.log('getFiles(): ' + files.hasNext());
  } catch (e) {
    Logger.log('getFiles() 오류: ' + e.message);
  }

  try {
    var folders = DriveApp.getFolders();
    Logger.log('getFolders(): ' + folders.hasNext());
  } catch (e) {
    Logger.log('getFolders() 오류: ' + e.message);
  }
}

// 테스트 2: Drive 폴더 접근 방식 비교
function dbg02_FolderAccess() {
  Logger.log('=== 폴더 접근 방식 비교 ===');

  // 방식 1: getFolderById
  try {
    var f1 = DriveApp.getFolderById('1J_wn9JIilhkyfOBvxkEB1C5B0f5LzNj8');
    Logger.log('getFolderById: ✅ ' + f1.getName());
  } catch (e) {
    Logger.log('getFolderById: ❌ ' + e.message);
  }

  // 방식 2: getRootFolder
  try {
    var root = DriveApp.getRootFolder();
    Logger.log('getRootFolder: ✅ ' + root.getName());
  } catch (e) {
    Logger.log('getRootFolder: ❌ ' + e.message);
  }

  // 방식 3: URL로 접근
  try {
    var f3 = DriveApp.getFileById('1J_wn9JIilhkyfOBvxkEB1C5B0f5LzNj8');
    Logger.log('getFileById: ✅ ' + f3.getName());
  } catch (e) {
    Logger.log('getFileById: ❌ ' + e.message);
  }
}

// 테스트 3: 실행 계정 확인
function dbg03_AccountCheck() {
  Logger.log('=== 실행 계정 확인 ===');
  Logger.log('실행 계정: ' + Session.getActiveUser().getEmail());
  Logger.log('유효 계정: ' + Session.getEffectiveUser().getEmail());
  Logger.log('TimeZone: ' + Session.getScriptTimeZone());
}

// 테스트 4: OAuth 스코프 확인
function dbg04_OAuthScope() {
  Logger.log('=== OAuth 스코프 확인 ===');
  try {
    var token = ScriptApp.getOAuthToken();
    Logger.log('OAuth 토큰: ' + (token ? '존재 (' + token.substring(0, 20) + '...)' : '없음'));
  } catch (e) {
    Logger.log('OAuth 오류: ' + e.message);
  }
}

/**
 * 통합 전처리 함수 (HTML + TXT 자동 구분)
 */
function preprocessFilesToJson() {
  var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
  var newFiles = getNewFilesToProcess();
  
  Logger.log('📊 처리할 새로운 파일: ' + newFiles.length + '개');
  
  if (newFiles.length === 0) {
    Logger.log('✅ 처리할 새로운 파일이 없습니다.');
    return;
  }
  
  var count = 0;
  for (var i = 0; i < newFiles.length; i++) {
    var fileInfo = newFiles[i];
    var f = fileInfo.file;
    var name = fileInfo.name;
    var baseName = fileInfo.baseName;
    
    Logger.log('🔄 처리 중: ' + name);
    
    var content;
    var analyzed;
    
    // 파일 확장자로 타입 판별
    if (/\.pdf$/i.test(name)) {
      // PDF 파일 처리 (Drive API를 통한 OCR 텍스트 추출)
      Logger.log('📄 PDF 파일로 인식, 텍스트 추출 중: ' + name);
      try {
        var blob = f.getBlob();
        var resource = { 
          title: blob.getName(), 
          mimeType: blob.getContentType() 
        };
        // 임시 구글 독스로 변환하여 텍스트 추출 (OCR)
        var tempDoc = Drive.Files.insert(resource, blob, { ocr: true });
        var document = DocumentApp.openById(tempDoc.id);
        content = document.getBody().getText();
        
        // 사용이 끝난 임시 문서 삭제
        Drive.Files.remove(tempDoc.id);
        
        if (!content) {
          Logger.log('⚠️ PDF 텍스트 추출 실패 또는 빈 문서: ' + name);
          continue;
        }
        
        analyzed = analyzeTxtScript(content);
      } catch (e) {
        Logger.log('❌ PDF 텍스트 추출 오류: ' + e.message + ' (고급 서비스에서 Drive API가 활성화되어 있는지 확인하세요)');
        continue;
      }
    } else {
      // 일반 파일 처리 (HTML, TXT)
      content = f.getBlob().getDataAsString('UTF-8');
      if (!content) {
        Logger.log('⚠️ 파일 내용이 비어있음: ' + name);
        continue;
      }
      
      if (/\.txt$/i.test(name)) {
        // TXT 파일 처리
        Logger.log('📝 TXT 파일로 인식: ' + name);
        analyzed = analyzeTxtScript(content);
      } else {
        // HTML 파일 처리
        Logger.log('🌐 HTML 파일로 인식: ' + name);
        analyzed = analyzeHtml(content);
      }
    }
    
    var outName = baseName + '_preprocess.json';
    
    // JSON 출력 폴더에 저장
    var json = JSON.stringify(analyzed, null, 2);
    var blob = Utilities.newBlob(json, 'application/json', outName);
    jsonOutputFolder.createFile(blob);
    
    count++;
    Logger.log('✅ ' + outName + ' 생성 완료 (타입: ' + analyzed.file_type + ')');
  }
  
  Logger.log('🎯 전처리 완료: ' + count + '개 파일 새로 처리됨');
}

/**
 * =======================================================================
 * [4] 키워드 및 설정 함수들
 * =======================================================================
 */

/**
 * I2 셀에서 Gemini 검색 활성화 여부(Y/N) 읽기 (미입력 시 'Y'로 간주)
 */
function getSearchOptionFromI2() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME_MAIN);
    var searchOption = sheet.getRange('E2').getValue();
    if (!searchOption) {
      return 'Y';
    }
    return searchOption.toString().toUpperCase() === 'N' ? 'N' : 'Y';
  } catch (e) {
    return 'Y';
  }
}

/**
 * C열에서 직접 SEO 키워드 읽기
 */
function getSEOKeywordsFromC2() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME_MAIN);
    
    // C2 셀에서 직접 읽기
    var seoKeywordsRaw = sheet.getRange('C2').getValue();
    Logger.log('📋 C2 원본 값: "' + seoKeywordsRaw + '"');
    
    if (!seoKeywordsRaw) {
      Logger.log("⚠️ C2가 비어있습니다.");
      return [];
    }
    
    // 쉼표로 분할
    var keywords = String(seoKeywordsRaw)
      .split(',')
      .map(function(k) { return k.trim(); })
      .filter(function(k) { return k.length > 0; });
    
    Logger.log('🔑 추출된 키워드 (' + keywords.length + '개): [' + keywords.join(' | ') + ']');
    return keywords;
    
  } catch (error) {
    Logger.log('❌ 키워드 읽기 오류: ' + error.message);
    return [];
  }
}

/**
 * A2 셀에서 강조 키워드 읽기 (최대 5개, 쉼표 구분)
 */
function getHighlightKeywordsFromA2() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME_MAIN);
    
    // A2 셀에서 직접 읽기
    var highlightKeywordsRaw = sheet.getRange('A2').getValue();
    Logger.log('📋 A2 원본 값: "' + highlightKeywordsRaw + '"');
    
    if (!highlightKeywordsRaw) {
      Logger.log("⚠️ A2가 비어있습니다.");
      return [];
    }
    
    // 쉼표로 분할 (최대 5개)
    var keywords = String(highlightKeywordsRaw)
      .split(',')
      .map(function(k) { return k.trim(); })
      .filter(function(k) { return k.length > 0; })
      .slice(0, 5); // 최대 5개로 제한
    
    Logger.log('💎 추출된 강조 키워드 (' + keywords.length + '개): [' + keywords.join(' | ') + ']');
    return keywords;
    
  } catch (error) {
    Logger.log('❌ 강조 키워드 읽기 오류: ' + error.message);
    return [];
  }
}

/**
 * 가중치 읽기
 * 현재 시트1에는 가중치 입력 영역이 없으므로 기본값을 사용합니다.
 */
function getWeightsFromSheet() {
  var weights = {
    benchStyleWeight: 0.7,
    claudeStyleWeight: 0.3,
    benchContentsWeight: 0.7,
    myContentsWeight: 0.3
  };
  
  Logger.log('📊 가중치: 시트 입력 없음, 기본값 사용 ' + JSON.stringify(weights));
  return weights;
}

/**
 * =======================================================================
 * [5] 스타일 및 템플릿 관리
 * =======================================================================
 */

/**
 * 시트2 초기화 및 기본 스타일 데이터 생성
 */
function initializeStyleSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME_STYLE);
    
    // 시트2가 없으면 생성
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME_STYLE);
      Logger.log('✅ 시트2 생성 완료');
    }
    
    // 헤더 설정
    var headers = ['번호', '글톤', '문장스타일', '개인터치', '시각풍부도', '내러티브플로우', '전문성레벨', '평균문장길이', '스타일특징'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 헤더 스타일링
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    
    // 기본 스타일 데이터 확인 및 추가
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { // 헤더만 있으면 기본 데이터 추가
      var defaultStyles = [
        [1, 7.0, 8.0, 6.0, 3.0, 5.0, 6.0, 45, '친절하고 정보전달 위주'], // 친근한 블로그 스타일
        [2, 5.0, 5.0, 8.0, 6.0, 7.0, 7.0, 60, '전문적이고 심도깊은 분석'], // 전문가 리뷰 스타일
        [3, 8.0, 6.0, 7.0, 4.0, 6.0, 5.0, 40, '가볍고 경쾌한 문체'], // 캐주얼 스타일
        [4, 4.0, 7.0, 5.0, 2.0, 4.0, 8.0, 55, '공식 문서 형식의 건조한 문체'], // 전문 기술 스타일
        [5, 6.0, 9.0, 9.0, 5.0, 8.0, 6.0, 35, '개인적 감상과 체험 강조']  // 개인 경험담 스타일
      ];
      
      sheet.getRange(2, 1, defaultStyles.length, defaultStyles[0].length).setValues(defaultStyles);
      Logger.log('✅ 기본 스타일 데이터 5개 추가 완료');
    }
    
    Logger.log('🎯 시트2 초기화 완료');
    toast_('스타일 시트 초기화 완료');
    
  } catch (error) {
    Logger.log('❌ 시트2 초기화 오류: ' + error.message);
  }
}

/**
 * B2 셀에서 스타일 번호를 읽어 시트2에서 스타일 데이터 가져오기
 */
function getStyleDataFromSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var mainSheet = ss.getSheetByName(SHEET_NAME_MAIN);
    var styleSheet = ss.getSheetByName(SHEET_NAME_STYLE);
    
    if (!styleSheet) {
      Logger.log('❌ 시트2를 찾을 수 없습니다. initializeStyleSheet()를 먼저 실행하세요.');
      return null;
    }
    
    // B2에서 스타일 번호 읽기
    var styleNumber = mainSheet.getRange('B2').getValue();
    Logger.log('📋 B2에서 읽은 스타일 번호: ' + styleNumber);
    
    if (!styleNumber || isNaN(styleNumber)) {
      Logger.log('⚠️ B2에 올바른 스타일 번호가 없습니다. 기본 스타일(1번) 사용');
      styleNumber = 1;
    }
    
    // 시트2에서 해당 번호의 스타일 데이터 찾기
    var data = styleSheet.getDataRange().getValues();
    var styleData = null;
    
    for (var i = 1; i < data.length; i++) { // 헤더 제외
      if (data[i][0] === styleNumber) { // A열(번호) 비교
        styleData = {
          number: data[i][0],
          writing_tone: data[i][1],
          sentence_style: data[i][2],
          personal_touch: data[i][3],
          visual_richness: data[i][4],
          narrative_flow: data[i][5],
          expertise_level: data[i][6],
          avg_sentence_len: data[i][7],
          style_features: data[i][8] || ''
        };
        break;
      }
    }
    
    if (!styleData) {
      Logger.log('❌ 스타일 번호 ' + styleNumber + '를 찾을 수 없습니다. 기본 스타일 사용');
      // 기본 스타일 데이터 반환
      styleData = {
        number: 1,
        writing_tone: 7.0,
        sentence_style: 8.0,
        personal_touch: 6.0,
        visual_richness: 3.0,
        narrative_flow: 5.0,
        expertise_level: 6.0,
        avg_sentence_len: 45,
        style_features: '기본 블로그 스타일'
      };
    }
    
    Logger.log('📊 사용할 스타일 데이터: ' + JSON.stringify(styleData));
    return styleData;
    
  } catch (error) {
    Logger.log('❌ 스타일 데이터 읽기 오류: ' + error.message);
    return null;
  }
}

/**
 * D2 셀에서 선택된 템플릿 정보 가져오기
 */
function getSelectedTemplate() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var mainSheet = ss.getSheetByName(SHEET_NAME_MAIN);
    var templateSheet = ss.getSheetByName('시트3');
    
    if (!templateSheet) {
      Logger.log('❌ 시트3(템플릿 시트)를 찾을 수 없습니다.');
      return null;
    }
    
    // D2에서 선택된 템플릿명 읽기
    var selectedTemplateName = mainSheet.getRange('D2').getValue();
    Logger.log('📋 D2에서 선택된 템플릿: "' + selectedTemplateName + '"');
    
    if (!selectedTemplateName) {
      Logger.log('⚠️ D2에 템플릿이 선택되지 않았습니다. 기본 템플릿(제품소개형) 사용');
      selectedTemplateName = '제품소개형';
    }
    
    // 시트3에서 해당 템플릿 데이터 찾기
    var data = templateSheet.getDataRange().getValues();
    var templateData = null;
    
    for (var i = 1; i < data.length; i++) { // 헤더 제외
      if (data[i][1] === selectedTemplateName) { // B열(template_name) 비교
        templateData = {
          id: data[i][0],
          name: data[i][1],
          writing_style: data[i][2],
          content_structure: data[i][3],
          key_focus_areas: data[i][4],
          photo_guide_type: data[i][5],
          tone_description: data[i][6],
          cta_style: data[i][7],
          seo_strategy: data[i][8],
          sample_prompt: data[i][9]
        };
        break;
      }
    }
    
    if (!templateData) {
      Logger.log('❌ 템플릿 "' + selectedTemplateName + '"를 찾을 수 없습니다. 기본 템플릿 사용');
      // 기본 템플릿 데이터 반환
      templateData = {
        id: 1,
        name: '제품소개형',
        writing_style: '전문적이면서 친근한',
        content_structure: '특징-장점-적용사례-결론',
        key_focus_areas: '기능,디자인,가격,차별점',
        photo_guide_type: '제품외관,상세컷,적용사례,설치모습',
        tone_description: '신뢰할 수 있는 전문가 톤',
        cta_style: '상담 및 견적 문의 유도',
        seo_strategy: '제품명+특징 키워드 중심',
        sample_prompt: '이 건축자재의 독특한 특징과 장점을 강조하여 고객이 선택하고 싶어지는 매력적인 제품 소개 글을 작성하세요.'
      };
    }
    
    Logger.log('📊 사용할 템플릿 데이터: ' + JSON.stringify(templateData));
    return templateData;
    
  } catch (error) {
    Logger.log('❌ 템플릿 데이터 읽기 오류: ' + error.message);
    return null;
  }
}

/**
 * 실행 1회에 필요한 시트 설정을 한 번에 읽어 캐시 객체로 반환
 * Sheets read 호출 수를 줄이기 위한 통합 로더
 */
function loadRunSettings() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var mainSheet = ss.getSheetByName(SHEET_NAME_MAIN);
    var styleSheet = ss.getSheetByName(SHEET_NAME_STYLE);
    var templateSheet = ss.getSheetByName('시트3');
    
    if (!mainSheet) {
      throw new Error('시트1을 찾을 수 없습니다.');
    }
    
    if (!styleSheet) {
      throw new Error('시트2를 찾을 수 없습니다.');
    }
    
    if (!templateSheet) {
      throw new Error('시트3을 찾을 수 없습니다.');
    }
    
    var mainValues = mainSheet.getRange('A2:E2').getValues()[0];
    var highlightKeywordsRaw = mainValues[0];
    var styleNumber = mainValues[1];
    var seoKeywordsRaw = mainValues[2];
    var selectedTemplateName = mainValues[3];
    
    var seoKeywords = String(seoKeywordsRaw || '')
      .split(',')
      .map(function(k) { return k.trim(); })
      .filter(function(k) { return k.length > 0; });
    
    var highlightKeywords = String(highlightKeywordsRaw || '')
      .split(',')
      .map(function(k) { return k.trim(); })
      .filter(function(k) { return k.length > 0; })
      .slice(0, 5);
    
    if (!styleNumber || isNaN(styleNumber)) {
      styleNumber = 1;
    }
    
    if (!selectedTemplateName) {
      selectedTemplateName = '제품소개형';
    }
    
    var styleData = null;
    var styleRows = styleSheet.getDataRange().getValues();
    for (var i = 1; i < styleRows.length; i++) {
      if (styleRows[i][0] === styleNumber) {
        styleData = {
          number: styleRows[i][0],
          writing_tone: styleRows[i][1],
          sentence_style: styleRows[i][2],
          personal_touch: styleRows[i][3],
          visual_richness: styleRows[i][4],
          narrative_flow: styleRows[i][5],
          expertise_level: styleRows[i][6],
          avg_sentence_len: styleRows[i][7],
          style_features: styleRows[i][8] || ''
        };
        break;
      }
    }
    
    if (!styleData) {
      styleData = {
        number: 1,
        writing_tone: 7.0,
        sentence_style: 8.0,
        personal_touch: 6.0,
        visual_richness: 3.0,
        narrative_flow: 5.0,
        expertise_level: 6.0,
        avg_sentence_len: 45,
        style_features: '기본 블로그 스타일'
      };
    }
    
    var templateData = null;
    var templateRows = templateSheet.getDataRange().getValues();
    for (var j = 1; j < templateRows.length; j++) {
      if (templateRows[j][1] === selectedTemplateName) {
        templateData = {
          id: templateRows[j][0],
          name: templateRows[j][1],
          writing_style: templateRows[j][2],
          content_structure: templateRows[j][3],
          key_focus_areas: templateRows[j][4],
          photo_guide_type: templateRows[j][5],
          tone_description: templateRows[j][6],
          cta_style: templateRows[j][7],
          seo_strategy: templateRows[j][8],
          sample_prompt: templateRows[j][9]
        };
        break;
      }
    }
    
    if (!templateData) {
      templateData = {
        id: 1,
        name: '제품소개형',
        writing_style: '전문적이면서 친근한',
        content_structure: '특징-장점-적용사례-결론',
        key_focus_areas: '기능,디자인,가격,차별점',
        photo_guide_type: '제품외관,상세컷,적용사례,설치모습',
        tone_description: '신뢰할 수 있는 전문가 톤',
        cta_style: '상담 및 견적 문의 유도',
        seo_strategy: '제품명+특징 키워드 중심',
        sample_prompt: '이 건축자재의 독특한 특징과 장점을 강조하여 고객이 선택하고 싶어지는 매력적인 제품 소개 글을 작성하세요.'
      };
    }
    
    return {
      seoKeywords: seoKeywords,
      highlightKeywords: highlightKeywords,
      weights: getWeightsFromSheet(),
      styleData: styleData,
      templateData: templateData
    };
  } catch (error) {
    Logger.log('❌ 실행 설정 읽기 오류: ' + error.message);
    return null;
  }
}

/**
 * 스타일 데이터를 바탕으로 스타일 설명 생성
 */
function generateStyleDescription(styleData) {
  var description = '적용할 스타일 특성 (스타일 번호: ' + styleData.number + '):\n';
  
  // 글톤 설명
  if (styleData.writing_tone >= 8) {
    description += '- 매우 전문적이고 격식있는 톤으로 작성\n';
  } else if (styleData.writing_tone >= 6) {
    description += '- 전문적이면서도 접근하기 쉬운 톤으로 작성\n';
  } else {
    description += '- 친근하고 캐주얼한 톤으로 작성\n';
  }
  
  // 문장 스타일 설명
  if (styleData.sentence_style >= 8) {
    description += '- 상세하고 구체적인 설명 위주의 긴 문장 사용\n';
  } else if (styleData.sentence_style >= 6) {
    description += '- 적당한 길이의 문장으로 명확하게 설명\n';
  } else {
    description += '- 간결하고 명료한 짧은 문장 위주\n';
  }
  
  // 개인 터치 설명
  if (styleData.personal_touch >= 8) {
    description += '- 개인적인 경험과 주관적 의견을 많이 포함\n';
  } else if (styleData.personal_touch >= 6) {
    description += '- 개인적 경험을 적절히 섞어 설명\n';
  } else {
    description += '- 객관적이고 사실 중심의 서술\n';
  }
  
  // 시각 풍부도 설명
  if (styleData.visual_richness >= 6) {
    description += '- 불릿 포인트, 번호 목록 등을 적극 활용\n';
  } else {
    description += '- 연속적인 문단 형태로 자연스럽게 서술\n';
  }
  
  // 내러티브 플로우 설명
  if (styleData.narrative_flow >= 7) {
    description += '- 스토리텔링 형식으로 연결성 있게 서술\n';
  } else {
    description += '- 논리적 순서로 단계별 설명\n';
  }
  
  // 전문성 레벨 설명
  if (styleData.expertise_level >= 8) {
    description += '- 전문 용어와 기술적 세부사항 포함\n';
  } else if (styleData.expertise_level >= 6) {
    description += '- 전문 지식을 쉽게 풀어서 설명\n';
  } else {
    description += '- 초보자도 이해하기 쉬운 용어 사용\n';
  }
  
  // 평균 문장 길이 가이드
  description += '- 평균 문장 길이: 약 ' + Math.round(styleData.avg_sentence_len) + '자 내외로 조절\n';
  
  return description;
}

/**
 * =======================================================================
 * [6] 사진 가이드 생성 함수들
 * =======================================================================
 */

/**
 * 템플릿별 특화 사진 가이드 생성
 */
function generateTemplatePhotoGuide(contentOutline, seoKeywords, photoGuideType) {
  var photoGuides = [];
  var photoIndex = 1;
  
  // 템플릿별 사진 유형 분석
  var photoTypes = String(photoGuideType || '').split(',');
  
  // 기본 사진 추가
  if (photoTypes.indexOf('제품외관') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 제품 전체 외관 및 패키징]");
    photoIndex++;
  }
  
  if (photoTypes.indexOf('나란히비교') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 제품 간 나란히 비교 모습]");
    photoIndex++;
  }
  
  if (photoTypes.indexOf('도구준비') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 필요한 도구 및 준비물]");
    photoIndex++;
  }
  
  if (photoTypes.indexOf('트렌드사례') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 최신 트렌드 적용 사례]");
    photoIndex++;
  }
  
  if (photoTypes.indexOf('문제상황') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 문제가 발생한 상황]");
    photoIndex++;
  }
  
  // 콘텐츠 아웃라인 기반 사진 추가
  for (var i = 0; i < contentOutline.length && photoIndex <= 10; i++) {
    var section = contentOutline[i];
    var photoDesc = section.replace(/[^가-힣a-zA-Z0-9\s]/g, '') + " 관련 상세 모습";
    photoGuides.push("[사진 " + photoIndex + ": " + photoDesc + "]");
    photoIndex++;
  }
  
  // SEO 키워드 관련 사진 추가
  for (var j = 0; j < seoKeywords.length && photoIndex <= 12; j++) {
    var keyword = seoKeywords[j];
    if (keyword.length > 2) {
      photoGuides.push("[사진 " + photoIndex + ": " + keyword + " 특징을 보여주는 사진]");
      photoIndex++;
    }
  }
  
  return photoGuides.slice(0, 12); // 최대 12개로 제한
}

/**
 * =======================================================================
 * [7] 프롬프트 생성 함수들
 * =======================================================================
 */

/**
 * [교체 1] 완전 재구성형 Claude 프롬프트 생성 - 제목 생성 기능 추가
 * 
 * 기존 함수: createReconstructedPromptWithTemplate()
 * 위치: [7] 프롬프트 생성 함수들
 */
function createReconstructedPromptWithTemplate(preprocessData, weights, seoKeywords, highlightKeywords, templateData, styleData) {
  // 전처리 데이터에서 콘텐츠 추출
  var contentOutline = preprocessData.content_outline || [];
  var referenceSnippets = preprocessData.reference_snippets || [];
  var fulltext = preprocessData.fulltext || "";
  var fileType = preprocessData.file_type || 'html';
  
  // 템플릿 데이터 적용
  var templateInfo = templateData || {};
  
  // 스타일 데이터를 바탕으로 스타일 설명 생성
  var styleDescription = generateStyleDescription(styleData);
  
  // 템플릿별 사진 가이드 생성
  var photoGuides = generateTemplatePhotoGuide(contentOutline, seoKeywords, templateInfo.photo_guide_type);
  
  // 파일 타입별 시스템 프롬프트 조정
  var fileTypeNote = '';
  if (fileType === 'txt') {
    fileTypeNote = '\n\n**중요: 이 콘텐츠는 유튜브 영상 스크립트입니다.**\n' +
                   '- 구어체를 자연스러운 블로그 문어체로 전환하세요\n' +
                   '- 영상의 흐름을 유지하되, 읽기 좋은 글 구조로 재구성하세요\n' +
                   '- "안녕하세요", "오늘은" 같은 영상 인사말은 적절히 변형하세요\n';
  }
  
  var system = '너는 ' + (templateInfo.name || '전문') + ' 콘텐츠 전문 작가다. 주어진 벤치마킹 자료를 참고하여 완전히 새로운 관점과 구조로 글을 재창조한다.' + fileTypeNote + '\n\n' +
               '재창조 원칙:\n' +
               '- 벤치마킹 자료: ' + (weights.benchContentsWeight * 100) + '% 정도만 참고용으로 활용\n' +
               '- 강조 키워드: ' + (weights.myContentsWeight * 100) + '% 비중으로 핵심 주제화\n' +
               '- 완전 새로운 스토리와 구조로 재구성\n' +
               '- SEO 키워드를 자연스럽게 배치\n\n' +
               '템플릿 가이드라인:\n' +
               '- 콘텐츠 유형: ' + (templateInfo.name || '일반형') + '\n' +
               '- 글쓰기 스타일: ' + (templateInfo.writing_style || '전문적') + '\n' +
               '- 구조: ' + (templateInfo.content_structure || '도입-본문-결론') + '\n' +
               '- 강조 영역: ' + (templateInfo.key_focus_areas || '품질,기능') + '\n' +
               '- 어조: ' + (templateInfo.tone_description || '전문가 톤') + '\n\n' +
               '스타일 가이드라인:\n' + styleDescription + '\n' +
               '사진 삽입 원칙:\n' +
               '- 템플릿 특화 사진: ' + (templateInfo.photo_guide_type || '일반 사진') + '\n' +
               '- [사진 X: 구체적인 설명] 형태로 정확히 표기\n' +
               '- 전체 글에 최소 8-12개의 사진 플레이스홀더 포함\n\n' +
               '**제목 생성 원칙 (매우 중요):**\n' +
               '- 글 맨 앞에 # 제목을 반드시 포함하세요\n' +
               '- 제목 길이: 25-40자 (한글 기준)\n' +
               '- 제목 스타일: 정보 제공형 + 숫자 활용 (예: "2025년 꼭 알아야 할 도어 트렌드 BEST 3")\n' +
               '- 클릭을 유도하되 과장하지 않고 실용적으로\n' +
               '- SEO 키워드를 자연스럽게 포함\n' +
               '- 제목 바로 아래 두 번째 줄에 부제목 추가 (제목과 어울리는 한 줄 설명)\n\n' +
               '행동 유도:\n' +
               '- CTA 스타일: ' + (templateInfo.cta_style || '문의 유도') + '\n' +
               '- SEO 전략: ' + (templateInfo.seo_strategy || '키워드 중심');

  var highlightKeywordsList = "";
  if (highlightKeywords.length > 0) {
    for (var i = 0; i < highlightKeywords.length; i++) {
      highlightKeywordsList += (i + 1) + ". " + highlightKeywords[i] + "\n";
    }
  } else {
    highlightKeywordsList = "지정된 강조 키워드 없음";
  }

  var seoKeywordsList = "";
  if (seoKeywords.length > 0) {
    for (var j = 0; j < seoKeywords.length; j++) {
      seoKeywordsList += (j + 1) + ". " + seoKeywords[j] + "\n";
    }
  } else {
    seoKeywordsList = "지정된 SEO 키워드 없음";
  }

  var outlineList = "";
  if (contentOutline.length > 0) {
    for (var k = 0; k < contentOutline.length; k++) {
      outlineList += (k + 1) + ". " + contentOutline[k] + "\n";
    }
  } else {
    outlineList = "(구조 정보 없음 - 콘텐츠 기반으로 적절히 구성)\n";
  }

  var referenceContent = referenceSnippets.slice(0, 3).join('\n\n');
  
  var photoGuideText = photoGuides.join('\n');

  var user = '다음 정보를 바탕으로 완전히 새로운 관점과 구조의 ' + (templateInfo.name || '전문') + ' 글을 작성해 주세요:\n\n' +
             '## 🎯 강조 키워드 (핵심 주제로 삼아야 할 내용 - ' + (weights.myContentsWeight * 100) + '% 비중)\n' +
             highlightKeywordsList + '\n' +
             '## 🔍 SEO 키워드 (자연스럽게 포함)\n' +
             seoKeywordsList + '\n' +
             '## 📚 벤치마킹 참고 자료 (구조와 아이디어 참고용 - ' + (weights.benchContentsWeight * 100) + '% 비중)\n' +
             '목차 구조:\n' + outlineList + '\n' +
             '주요 내용:\n' + referenceContent + '\n\n' +
             '## 📸 사진 삽입 가이드 (' + (templateInfo.name || '일반형') + ' 특화)\n' +
             '다음 사진들을 적절한 위치에 배치하세요:\n' +
             photoGuideText + '\n\n' +
             '## 🚀 템플릿 적용 지침\n' +
             (templateInfo.sample_prompt || '전문적인 글을 작성하세요.') + '\n\n' +
             '## ✅ 작성 요구사항\n' +
             '1. **매력적인 제목**: 글 맨 앞에 # 형태로 25-40자의 클릭 유도 제목 작성\n' +
             '   예시: # 2025년 꼭 알아야 할 도어 트렌드 BEST 3\n' +
             '2. **부제목 추가**: 제목 바로 아래 줄에 한 줄 설명 추가\n' +
             '   예시: 히든도어부터 펫도어까지, 전문가가 알려드립니다\n' +
             '3. **완전 재구성**: 벤치마킹 자료는 참고만, 완전히 새로운 스토리로 작성\n' +
             '4. **강조 키워드 중심**: 위의 강조 키워드가 글의 핵심 메시지가 되도록\n' +
             '5. **템플릿 구조**: ' + (templateInfo.content_structure || '도입-본문-결론') + ' 형태로 구성\n' +
             '6. **SEO 최적화**: SEO 키워드들을 자연스럽게 배치 (특히 제목에 포함)\n' +
             '7. **사진 플레이스홀더**: 각 섹션에 관련성 높은 사진 반드시 포함\n' +
             '8. **차별화된 관점**: 강조 키워드를 중심으로 한 독특한 시각 제시\n' +
             '9. **행동 유도**: ' + (templateInfo.cta_style || '문의 유도') + ' 방식으로 마무리\n\n' +
             '## 🚫 절대 금지사항\n' +
             '- 파일명을 제목으로 사용하지 마세요\n' +
             '- "[Korean (auto-generated)]" 같은 메타 정보 포함 금지\n' +
             '- 벤치마킹 자료의 단순 복사나 패러프레이즈\n' +
             '- 강조 키워드 누락 또는 부차적 처리\n' +
             '- 템플릿 가이드라인 무시\n' +
             '- 사진 플레이스홀더 누락\n\n' +
             '**출력 형식:**\n' +
             '# [매력적인 제목 25-40자]\n' +
             '[한 줄 부제목]\n\n' +
             '## [첫 번째 섹션 제목]\n' +
             '[내용]...\n\n' +
             '완전히 새로운 ' + (templateInfo.name || '전문') + ' 글만 출력하고, 별도의 설명은 포함하지 마세요.';

  return {
    system: system,
    user: user,
    styleData: styleData,
    templateData: templateData,
    highlightKeywords: highlightKeywords,
    photoGuides: photoGuides
  };
}

/**
 * =======================================================================
 * [8] SEO 처리 및 파이프라인 함수들
 * =======================================================================
 */

/**
 * 업로드 시간 순으로 정렬된 전처리 파일들 가져오기 (한 개만)
 */
function getNextPreprocessFileToSEO() {
  var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
  
  var availableFiles = [];
  var files = jsonOutputFolder.getFiles();
  
  // 전처리 파일들 수집
  while (files.hasNext()) {
    var f = files.next();
    var name = f.getName();
    
    if (!/\_preprocess\.json$/i.test(name)) continue;
    
    var baseName = name.replace(/\_preprocess\.json$/i, "");
    
    // 이미 SEO 처리된 파일인지 확인
    if (!isAlreadyProcessed(baseName, jsonOutputFolder, '_final_seo.json')) {
      availableFiles.push({
        file: f,
        name: name,
        baseName: baseName,
        lastModified: f.getLastUpdated().getTime()
      });
    }
  }
  
  if (availableFiles.length === 0) {
    return null;
  }
  
  // 업로드 시간(수정 시간) 순으로 정렬 (오래된 것부터)
  availableFiles.sort(function(a, b) {
    return a.lastModified - b.lastModified;
  });
  
  Logger.log('📋 처리 대기 파일들 (오래된 순):');
  for (var i = 0; i < availableFiles.length; i++) {
    var fileInfo = availableFiles[i];
    var date = new Date(fileInfo.lastModified);
    Logger.log('  ' + (i + 1) + '. ' + fileInfo.baseName + ' (' + date.toLocaleString() + ')');
  }
  
  // 첫 번째(가장 오래된) 파일 반환
  return {
    file: availableFiles[0],
    totalRemaining: availableFiles.length
  };
}

/**
 * 수정된 SEO 처리 함수 (완전 재구성 적용)
 */
function processNextSEOFile() {
  try {
    Logger.log("🔄 === 다음 파일 하나만 SEO 처리 (완전 재구성형) ===");
    
    var nextFileInfo = getNextPreprocessFileToSEO();
    
    if (!nextFileInfo) {
      Logger.log('✅ 처리할 새로운 파일이 없습니다.');
      toast_('모든 파일 처리 완료!');
      return;
    }
    
    var fileInfo = nextFileInfo.file;
    var baseName = fileInfo.baseName;
    var remaining = nextFileInfo.totalRemaining - 1;
    
    Logger.log('🔄 처리 중: ' + baseName);
    Logger.log('📊 남은 파일: ' + remaining + '개');
    
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var settings = loadRunSettings();
    var apiKey = getAnthropicKey_();
    
    if (!settings) {
      Logger.log("❌ 실행 설정을 가져올 수 없습니다.");
      return;
    }
    
    var seoKeywords = settings.seoKeywords;
    var highlightKeywords = settings.highlightKeywords;
    var weights = settings.weights;
    var templateData = settings.templateData;
    var styleData = settings.styleData;
    
    if (seoKeywords.length === 0 || !apiKey) {
      Logger.log("❌ SEO 키워드 또는 API 키가 없습니다.");
      return;
    }

    if (!templateData) {
      Logger.log("❌ 템플릿 데이터를 가져올 수 없습니다.");
      return;
    }
    
    // 파일 로드
    var preprocessFiles = jsonOutputFolder.getFilesByName(baseName + "_preprocess.json");
    
    if (!preprocessFiles.hasNext()) {
      Logger.log("❌ 필요한 파일을 찾을 수 없습니다: " + baseName);
      return;
    }
    
    var preprocessData = JSON.parse(preprocessFiles.next().getBlob().getDataAsString());
    
    // 파일 타입 확인
    var fileType = preprocessData.file_type || 'html';
    Logger.log('📄 파일 타입: ' + fileType.toUpperCase());
    
    var prompt = createReconstructedPromptWithTemplate(preprocessData, weights, seoKeywords, highlightKeywords, templateData, styleData);
    
    if (!prompt) {
      Logger.log("❌ 프롬프트 생성 실패");
      return;
    }
    
    Logger.log('🎯 SEO 키워드: ' + seoKeywords.join(', '));
    Logger.log('💎 강조 키워드: ' + highlightKeywords.join(', '));
    Logger.log('📊 템플릿: ' + templateData.name);
    Logger.log('📊 스타일: ' + styleData.number + '번');
    Logger.log('📸 사진 가이드: ' + prompt.photoGuides.length + '개 생성됨');
    
    var payload = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      temperature: 0.3,
      system: prompt.system,
      messages: [{
        role: 'user',
        content: prompt.user
      }]
    };

    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var responseCode = response.getResponseCode();
    var responseText = response.getContentText('UTF-8');

    if (responseCode === 429) {
      Logger.log('❌ 여전히 속도 제한입니다. 5분 후에 다시 시도하세요.');
      Logger.log('💡 또는 Claude API 사용량을 업그레이드하세요.');
      return;
    }

    if (responseCode < 200 || responseCode >= 300) {
      Logger.log('❌ Claude API 오류 ' + responseCode + ': ' + responseText);
      return;
    }

    var jsonResponse = JSON.parse(responseText);
    var finalContent = jsonResponse.content[0].text;
    
    var now = new Date();
    var hours = now.getHours().toString();
    var minutes = now.getMinutes().toString();
    if (hours.length === 1) hours = "0" + hours;
    if (minutes.length === 1) minutes = "0" + minutes;
    var timeStamp = hours + "_" + minutes;
    
    var finalJson = {
      generated_at: new Date().toISOString(),
      baseName: baseName,
      timeStamp: timeStamp,
      file_type: fileType,
      seo_keywords: seoKeywords,
      highlight_keywords: highlightKeywords,
      template_data: templateData,
      style_data: styleData,
      weights: weights,
      photo_guides: prompt.photoGuides,
      content: finalContent,
      model: payload.model
    };

    var finalFileName = baseName + "_final_seo.json";
    var finalBlob = Utilities.newBlob(
      JSON.stringify(finalJson, null, 2),
      'application/json',
      finalFileName
    );
    jsonOutputFolder.createFile(finalBlob);

    Logger.log('✅ 완전 재구성 SEO 글 생성 완료: ' + finalFileName);
    Logger.log('📊 남은 파일: ' + remaining + '개');
    
    if (remaining > 0) {
      Logger.log('💡 다음 파일을 처리하려면 5분 후에 processNextSEOFile() 함수를 다시 실행하세요.');
    } else {
      Logger.log('🎉 모든 SEO 파일 처리 완료! 이제 STEP_D1_Simple_SEO_Docs()를 실행하세요.');
    }
    
    toast_('완전 재구성 처리 완료: ' + baseName + ' (남은: ' + remaining + '개)');
    
  } catch (error) {
    Logger.log('❌ SEO 처리 오류: ' + error.message);
  }
}

/**
 * HTML 파일 전처리 실행
 */
function STEP_A_preprocessFiles() {
  Logger.log("🔄 === 파일 전처리 시작 (HTML + TXT) ===");
  
  try {
    preprocessFilesToJson();
    Logger.log("✅ 전처리 완료!");
    toast_("전처리 완료!");
  } catch (error) {
    Logger.log("❌ 전처리 실행 오류: " + error.message);
  }
}

/**
 * 수정된 전체 파이프라인 (무조건 단일 처리)
 */
function runFullPipelineOneByOne() {
  Logger.log("🚀 === 전체 파이프라인 실행 (무조건 단일 처리) ===");
  
  try {
    // A단계: 파일 전처리 (HTML + TXT)
    Logger.log("1️⃣ A단계: 파일 전처리 (HTML + TXT)");
    STEP_A_preprocessFiles();
    
    Utilities.sleep(2000);
    
    // B단계: 스타일 분석 단계 제거 (시트2 사용)
    Logger.log("2️⃣ B단계: 스타일 분석 스킵 (시트2 사용)");
    
    // C단계: SEO 최적화 글 생성 (단일 처리)
    Logger.log("3️⃣ C단계: SEO 최적화 글 생성 (단일 처리)");
    processNextSEOFile();
    
    Logger.log("🎯 파이프라인 1차 완료!");
    Logger.log("💡 남은 파일이 있으면 5분 후에 processNextSEOFile()을 반복 실행하세요.");
    Logger.log("💡 모든 SEO 처리 완료 후 STEP_D1_Simple_SEO_Docs()를 실행하세요.");
    
  } catch (error) {
    Logger.log("❌ 파이프라인 오류: " + error.message);
  }
}

/**
 * =======================================================================
 * [9] 구글독스 생성 관련 함수들
 * =======================================================================
 */

/**
 * 처리 가능한 새로운 SEO 파일들만 필터링 (구글독스용)
 */
function getNewSEOFilesToDocs() {
  var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
  var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
  
  var newFiles = [];
  var files = jsonOutputFolder.getFiles();
  
  while (files.hasNext()) {
    var f = files.next();
    var name = f.getName();
    
    // SEO 파일만 확인
    if (!/\_final_seo\.json$/i.test(name)) continue;
    
    var baseName = name.replace(/\_final_seo\.json$/i, "");
    
    // 이미 구글독스가 생성된 파일인지 확인 (다양한 가능한 독스 제목으로 확인)
    var possibleDocNames = [
      baseName + '_최종본',
      baseName + '_SEO최적화_최종본'
    ];
    
    var alreadyExists = false;
    for (var i = 0; i < possibleDocNames.length; i++) {
      if (isDocumentExists(docsOutputFolder, possibleDocNames[i])) {
        alreadyExists = true;
        break;
      }
    }
    
    if (!alreadyExists) {
      newFiles.push({
        file: f,
        name: name,
        baseName: baseName
      });
    } else {
      Logger.log('⚠️ 이미 구글독스 생성됨 - 스킵: ' + name);
    }
  }
  
  return newFiles;
}
/**
 * [교체 2] 부제목 추출 함수 개선
 * 
 * 기존 함수: extractSubtitle()
 * 위치: [9] 구글독스 생성 관련 함수들
 */
function extractSubtitle(content, seoKeywords) {
  var lines = content.split('\n').filter(function(line) { return line.trim().length > 0; });
  
  // Claude가 생성한 부제목 찾기 (제목 바로 다음 줄)
  if (lines.length > 1) {
    var firstLine = lines[0].trim();
    var secondLine = lines[1].trim();
    
    // 첫 줄이 # 제목이고, 두 번째 줄이 ## 헤딩이 아니면 부제목으로 간주
    if (firstLine.indexOf('# ') === 0 && secondLine.indexOf('##') !== 0) {
      // 부제목이 적절한 길이인지 확인 (10-100자)
      if (secondLine.length >= 10 && secondLine.length <= 100) {
        Logger.log('📝 Claude가 생성한 부제목 사용: "' + secondLine + '"');
        return secondLine;
      }
    }
  }
  
  // Claude가 부제목을 생성하지 않은 경우, 첫 번째 문단에서 추출
  for (var i = 1; i < Math.min(lines.length, 5); i++) {
    var line = lines[i].trim();
    if (line.length > 10 && line.length < 100 && !line.startsWith('#') && !line.includes('[사진')) {
      Logger.log('📝 첫 문단에서 부제목 추출: "' + line + '"');
      return line;
    }
  }
  
  // 키워드 기반 부제목 생성 (최후의 수단)
  if (seoKeywords.length > 0) {
    var fallbackSubtitle = seoKeywords.slice(0, 3).join(' · ') + '로 만드는 특별한 공간';
    Logger.log('📝 키워드 기반 부제목 생성: "' + fallbackSubtitle + '"');
    return fallbackSubtitle;
  }
  
  return null;
}



/**
 * Apple 스타일 구분선 추가
 */
function addAppleSeparator(docBody) {
  var separator = docBody.appendParagraph('___');
  separator.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  separator.editAsText().setForegroundColor('#d2d2d7'); // Apple 라이트 그레이
  separator.setSpacingBefore(24);
  separator.setSpacingAfter(24);
}

/**
 * 네이버 블로그 스타일 친근한 요약 박스
 */
function addFriendlySummaryBox(docBody, seoKeywords) {
  var summaryTitle = docBody.appendParagraph('이 글에서 알아볼 내용');
  var summaryTitleStyle = {};
  summaryTitleStyle[DocumentApp.Attribute.FONT_SIZE] = 16;
  summaryTitleStyle[DocumentApp.Attribute.BOLD] = true;
  summaryTitleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
  summaryTitle.setAttributes(summaryTitleStyle);
  summaryTitle.setSpacingBefore(16);
  summaryTitle.setSpacingAfter(8);
  
  var benefits = [
    '• 친환경 건축자재 트렌드와 핵심 정보',
    '• 실제 시공 사례와 전문가 노하우',
    '• 합리적인 가격 정책과 품질 보증 시스템'
  ];
  
  for (var i = 0; i < benefits.length; i++) {
    var benefit = docBody.appendParagraph(benefits[i]);
    var benefitStyle = {};
    benefitStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
    benefitStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#424245';
    benefitStyle[DocumentApp.Attribute.LINE_SPACING] = 1.6;
    benefit.setAttributes(benefitStyle);
    benefit.setSpacingAfter(4);
    benefit.setIndentFirstLine(0);
    benefit.setIndentStart(18);
  }
  
  addAppleSeparator(docBody);
}

/**
 * 하이라이트 인트로 텍스트 생성
 */
function getHighlightIntro(text) {
  var lowerText = text.toLowerCase();
  
  if (lowerText.includes('비용') || lowerText.includes('가격')) {
    return '💰 비용 정보';
  } else if (lowerText.includes('팁') || lowerText.includes('노하우')) {
    return '💡 전문가 팁';
  } else if (lowerText.includes('결과') || lowerText.includes('성과')) {
    return '📊 주요 성과';
  } else if (lowerText.includes('주의') || lowerText.includes('중요')) {
    return '⚠️ 주의사항';
  } else {
    return '🔍 핵심 포인트';
  }
}

/**
 * 친근한 사진 플레이스홀더
 */
function addFriendlyPhotoPlaceholder(docBody, text) {
  var photoText = text.replace(/^\[사진\s*\d*:?\s*/, '').replace(/\]$/, '');
  var photoPlaceholder = docBody.appendParagraph('*[' + photoText + ']*');
  
  var photoStyle = {};
  photoStyle[DocumentApp.Attribute.FONT_SIZE] = 13;
  photoStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#86868b';
  photoStyle[DocumentApp.Attribute.ITALIC] = true;
  photoPlaceholder.setAttributes(photoStyle);
  photoPlaceholder.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  photoPlaceholder.setSpacingBefore(12);
  photoPlaceholder.setSpacingAfter(12);
}

/**
 * 키워드 자연스럽게 강조 (Apple 스타일 - 절제된 강조)
 */
function highlightKeywordsNaturally(paragraph, keywords) {
  var text = paragraph.getText();
  var textElement = paragraph.editAsText();
  
  for (var i = 0; i < keywords.length; i++) {
    var keyword = keywords[i];
    var startIndex = 0;
    
    while (true) {
      var index = text.indexOf(keyword, startIndex);
      if (index === -1) break;
      
      // Apple 스타일 - 굵게만 하고 색상은 자제
      textElement.setBold(index, index + keyword.length - 1, true);
      startIndex = index + keyword.length;
    }
  }
}

/**
 * 핵심 포인트 감지 함수
 */
function isKeyPoint(text) {
  var keyIndicators = [
    '중요한', '핵심', '포인트', '비용', '가격', '만원', '원',
    '결과', '성과', '효과', '향상', '개선', '절약',
    '주의', '팁', '비결', '노하우', '경험',
    '%', '배', '시간', '년', '개월'
  ];
  
  for (var i = 0; i < keyIndicators.length; i++) {
    if (text.includes(keyIndicators[i])) {
      return true;
    }
  }
  
  var numbers = text.match(/\d+/g);
  return numbers && numbers.length >= 2;
}

/**
 * 친근한 마무리 (네이버 블로그 스타일)
 */
function addFriendlyClosing(docBody) {
  var closing = docBody.appendParagraph('도움이 되셨나요? 궁금한 점이 있으시면 언제든 문의해주세요! 😊');
  var closingStyle = {};
  closingStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
  closingStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#86868b';
  closingStyle[DocumentApp.Attribute.ITALIC] = true;
  closing.setAttributes(closingStyle);
  closing.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  closing.setSpacingBefore(24);
}

/**
 * SEO 최적화된 Google Docs 생성 - Apple + 네이버 블로그 스타일
 */
function STEP_D1_Simple_SEO_Docs() {
  try {
    Logger.log("📄 === SEO 최적화 Google Docs 생성 (Apple + 네이버 스타일) ===");
    
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    var newFiles = getNewSEOFilesToDocs();
    
    Logger.log('📊 처리할 새로운 SEO 파일: ' + newFiles.length + '개');
    
    if (newFiles.length === 0) {
      Logger.log('✅ 구글독스 생성할 새로운 파일이 없습니다.');
      return;
    }
    
    var createdDocs = [];
    var count = 0;
    
    for (var i = 0; i < newFiles.length; i++) {
      var fileInfo = newFiles[i];
      var f = fileInfo.file;
      var baseName = fileInfo.baseName;
      
      Logger.log('🔄 구글독스 생성 중: ' + baseName);
      
      try {
        var finalData = JSON.parse(f.getBlob().getDataAsString());
        var content = finalData.content;
        var seoKeywords = finalData.seo_keywords;
        var fileType = finalData.file_type || 'html';
        
        if (!content) {
          Logger.log("❌ 콘텐츠가 비어있습니다: " + baseName);
          continue;
        }
        
        Logger.log('📄 파일 타입: ' + fileType.toUpperCase());
        
        var docTitle = baseName + "_최종본";
        
        // 제목 추출
        var lines = content.split('\n').map(function(line) { return line.trim(); }).filter(function(line) { return line.length > 0; });
        var titleExtracted = false;
        var mainTitle = "";
        
        if (lines.length > 0) {
          var firstLine = lines[0];
          if (firstLine.indexOf('# ') === 0) {
            mainTitle = firstLine.substring(2).trim();
            if (mainTitle.length > 5 && mainTitle.length < 150) {
              docTitle = mainTitle;
              titleExtracted = true;
              Logger.log('📝 추출된 제목 사용: "' + docTitle + '"');
              // ✨ 여기에 3줄 추가
          validateAndLogTitle(docTitle, baseName, fileType);
            }
          }
        }
        
        if (!titleExtracted) {
          mainTitle = docTitle;
          Logger.log('📝 기본 제목 사용: "' + docTitle + '"');
        }
        
        var doc = DocumentApp.create(docTitle);
        
        try {
          var docFile = DriveApp.getFileById(doc.getId());
          docFile.moveTo(docsOutputFolder);
          Logger.log('📁 파일이 정상적으로 이동됨: ' + docsOutputFolder.getName());
        } catch (moveError) {
          Logger.log('⚠️ 파일 이동 실패: ' + moveError.message);
        }
        
        var docBody = doc.getBody();
        docBody.clear();
        
        // 문서 기본 스타일 설정 (Apple 스타일 - 미니멀)
        var documentStyle = {};
        documentStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
        documentStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
        documentStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;
        documentStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#000000'; // 검은색 기본
        docBody.setAttributes(documentStyle);
        
        // 메인 제목 (Apple 스타일 - 심플하고 우아함)
        var titleParagraph = docBody.appendParagraph(mainTitle);
        var titleStyle = {};
        titleStyle[DocumentApp.Attribute.FONT_SIZE] = 28;
        titleStyle[DocumentApp.Attribute.BOLD] = true;
        titleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f'; // Apple 다크 그레이
        titleStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
        titleParagraph.setAttributes(titleStyle);
        titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
        titleParagraph.setSpacingAfter(12);
        
        // 부제목 생성 (첫 번째 문단에서 추출)
        var subtitle = extractSubtitle(content, seoKeywords);
        if (subtitle) {
          var subtitleParagraph = docBody.appendParagraph(subtitle);
          var subtitleStyle = {};
          subtitleStyle[DocumentApp.Attribute.FONT_SIZE] = 16;
          subtitleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#86868b'; // Apple 라이트 그레이
          subtitleStyle[DocumentApp.Attribute.ITALIC] = true;
          subtitleParagraph.setAttributes(subtitleStyle);
          subtitleParagraph.setSpacingAfter(24);
        }
        
        // 첫 번째 구분선 (Apple 스타일 - 얇고 우아함)
        addAppleSeparator(docBody);
        
        // 콘텐츠 처리
        var paragraphs = content.split(/\n\n+/);
        var isFirstContent = true;
        var sectionCount = 0;
        
        for (var j = 0; j < paragraphs.length; j++) {
          var text = paragraphs[j].trim();
          if (!text) continue;
          
          // 메인 제목 스킵
          if (text.indexOf('# ') === 0 && isFirstContent) {
            isFirstContent = false;
            
            // 네이버 블로그 스타일 - 친근한 요약 박스 추가
            addFriendlySummaryBox(docBody, seoKeywords);
            continue;
          }
          
          // H2 헤딩 처리 (Apple + 네이버 스타일)
          if (text.indexOf('## ') === 0) {
            sectionCount++;
            var headingText = text.substring(3).trim();
            
            var heading = docBody.appendParagraph(headingText);
            var headingStyle = {};
            headingStyle[DocumentApp.Attribute.FONT_SIZE] = 20;
            headingStyle[DocumentApp.Attribute.BOLD] = true;
            headingStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
            headingStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
            heading.setAttributes(headingStyle);
            heading.setSpacingBefore(32);
            heading.setSpacingAfter(16);
            
          }
          // H3 헤딩 처리 (서브 섹션)
          else if (text.indexOf('### ') === 0) {
            var h3Text = text.substring(4).trim();
            
            var h3Heading = docBody.appendParagraph(h3Text);
            var h3Style = {};
            h3Style[DocumentApp.Attribute.FONT_SIZE] = 16;
            h3Style[DocumentApp.Attribute.BOLD] = true;
            h3Style[DocumentApp.Attribute.FOREGROUND_COLOR] = '#424245';
            h3Style[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
            h3Heading.setAttributes(h3Style);
            h3Heading.setSpacingBefore(20);
            h3Heading.setSpacingAfter(8);
          }
          // 사진 플레이스홀더 처리 (네이버 스타일 - 친근함)
          else if (text.includes('[사진') && text.includes(']')) {
            addFriendlyPhotoPlaceholder(docBody, text);
          }
          // 일반 문단 처리
          else {
            // 핵심 포인트 감지 (네이버 블로그 스타일)
            if (isKeyPoint(text)) {
              addNaverStyleHighlight(docBody, text);
            } else {
              // Apple 스타일 - 깔끔한 일반 문단
              var paragraph = docBody.appendParagraph(text);
              var paragraphStyle = {};
              paragraphStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
              paragraphStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
              paragraphStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
              paragraphStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;
              paragraph.setAttributes(paragraphStyle);
              paragraph.setSpacingAfter(16);
              
              // 키워드 자연스럽게 강조
              highlightKeywordsNaturally(paragraph, seoKeywords);
            }
          }
        }
        
        // 마지막 구분선과 마무리 (Apple + 네이버 조화)
        addAppleSeparator(docBody);
        addFriendlyClosing(docBody);

        createdDocs.push({
          title: docTitle,
          url: doc.getUrl(),
          baseName: baseName,
          fileType: fileType
        });
        
        Logger.log('✅ Apple + 네이버 스타일 Google Docs 생성 완료: ' + docTitle);
        Logger.log('🔗 문서 URL: ' + doc.getUrl());
        count++;
        
      } catch (error) {
        Logger.log('❌ ' + baseName + ' 구글독스 생성 오류: ' + error.message);
        continue;
      }
    }
    
    Logger.log('🎯 구글독스 생성 완료: ' + count + '개 파일 새로 처리됨');
    Logger.log('📁 저장 위치: 폴더 ID ' + CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    if (createdDocs.length > 0) {
      Logger.log('\n📄 생성된 문서들:');
      for (var k = 0; k < createdDocs.length; k++) {
        Logger.log('  - ' + createdDocs[k].title + ' [' + createdDocs[k].fileType.toUpperCase() + ']: ' + createdDocs[k].url);
      }
    }
    
    return createdDocs;
    
  } catch (error) {
    Logger.log('❌ Google Docs 생성 오류: ' + error.message);
  }
}

/**
 * 최근 처리된 SEO 파일만 Google Docs 생성
 * @param {Date} startTime - 처리 시작 시간
 */
function STEP_D1_Simple_SEO_Docs_RecentOnly(startTime) {
  try {
    Logger.log("📄 === SEO 최적화 Google Docs 생성 (최근 파일만) ===");
    
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    
    var newFiles = [];
    var files = jsonOutputFolder.getFiles();
    
    while (files.hasNext()) {
      var f = files.next();
      var name = f.getName();
      
      // SEO 파일만 확인
      if (!/\_final\_seo\.json$/i.test(name)) continue;
      
      // ✨ 시작 시간 이후에 생성/수정된 파일만
      if (f.getLastUpdated() < startTime) {
        Logger.log('⏭️ 과거 파일 스킵: ' + name);
        continue;
      }
      
      var baseName = name.replace(/\_final\_seo\.json$/i, "");
      
      // 이미 구글독스가 생성된 파일인지 확인
      var possibleDocNames = [
        baseName + '_최종본',
        baseName + '_SEO최적화_최종본'
      ];
      
      var alreadyExists = false;
      for (var i = 0; i < possibleDocNames.length; i++) {
        if (isDocumentExists(docsOutputFolder, possibleDocNames[i])) {
          alreadyExists = true;
          break;
        }
      }
      
      if (!alreadyExists) {
        newFiles.push({
          file: f,
          name: name,
          baseName: baseName
        });
      }
    }
    
    Logger.log('📊 처리할 새로운 SEO 파일 (최근 생성): ' + newFiles.length + '개');
    
    if (newFiles.length === 0) {
      Logger.log('✅ 구글독스 생성할 새로운 파일이 없습니다.');
      return [];
    }
    
    // 여기부터는 기존 STEP_D1_Simple_SEO_Docs()와 동일
    var createdDocs = [];
    var count = 0;
    
    for (var i = 0; i < newFiles.length; i++) {
      var fileInfo = newFiles[i];
      var f = fileInfo.file;
      var baseName = fileInfo.baseName;
      
      Logger.log('🔄 구글독스 생성 중: ' + baseName);
      
      try {
        var finalData = JSON.parse(f.getBlob().getDataAsString());
        var content = finalData.content;
        var seoKeywords = finalData.seo_keywords;
        var fileType = finalData.file_type || 'html';
        
        if (!content) {
          Logger.log("❌ 콘텐츠가 비어있습니다: " + baseName);
          continue;
        }
        
        Logger.log('📄 파일 타입: ' + fileType.toUpperCase());
        
        var docTitle = baseName + "_최종본";
        
        // 제목 추출
        var lines = content.split('\n').map(function(line) { return line.trim(); }).filter(function(line) { return line.length > 0; });
        var titleExtracted = false;
        var mainTitle = "";
        
        if (lines.length > 0) {
          var firstLine = lines[0];
          if (firstLine.indexOf('# ') === 0) {
            mainTitle = firstLine.substring(2).trim();
            if (mainTitle.length > 5 && mainTitle.length < 150) {
              docTitle = mainTitle;
              titleExtracted = true;
              Logger.log('📝 추출된 제목 사용: "' + docTitle + '"');
              validateAndLogTitle(docTitle, baseName, fileType);
            }
          }
        }
        
        if (!titleExtracted) {
          mainTitle = docTitle;
          Logger.log('📝 기본 제목 사용: "' + docTitle + '"');
        }
        
        var doc = DocumentApp.create(docTitle);
        
        try {
          var docFile = DriveApp.getFileById(doc.getId());
          docFile.moveTo(docsOutputFolder);
          Logger.log('📁 파일이 정상적으로 이동됨: ' + docsOutputFolder.getName());
        } catch (moveError) {
          Logger.log('⚠️ 파일 이동 실패: ' + moveError.message);
        }
        
        var docBody = doc.getBody();
        docBody.clear();
        
        // 문서 기본 스타일 설정
        var documentStyle = {};
        documentStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
        documentStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
        documentStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;
        documentStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#000000';
        docBody.setAttributes(documentStyle);
        
        // 메인 제목
        var titleParagraph = docBody.appendParagraph(mainTitle);
        var titleStyle = {};
        titleStyle[DocumentApp.Attribute.FONT_SIZE] = 28;
        titleStyle[DocumentApp.Attribute.BOLD] = true;
        titleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
        titleStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
        titleParagraph.setAttributes(titleStyle);
        titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
        titleParagraph.setSpacingAfter(12);
        
        // 부제목
        var subtitle = extractSubtitle(content, seoKeywords);
        if (subtitle) {
          var subtitleParagraph = docBody.appendParagraph(subtitle);
          var subtitleStyle = {};
          subtitleStyle[DocumentApp.Attribute.FONT_SIZE] = 16;
          subtitleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#86868b';
          subtitleStyle[DocumentApp.Attribute.ITALIC] = true;
          subtitleParagraph.setAttributes(subtitleStyle);
          subtitleParagraph.setSpacingAfter(24);
        }
        
        addAppleSeparator(docBody);
        
        // 콘텐츠 처리
        var paragraphs = content.split(/\n\n+/);
        var isFirstContent = true;
        
        for (var j = 0; j < paragraphs.length; j++) {
          var text = paragraphs[j].trim();
          if (!text) continue;
          
          if (text.indexOf('# ') === 0 && isFirstContent) {
            isFirstContent = false;
            addFriendlySummaryBox(docBody, seoKeywords);
            continue;
          }
          
          if (text.indexOf('## ') === 0) {
            var headingText = text.substring(3).trim();
            var heading = docBody.appendParagraph(headingText);
            var headingStyle = {};
            headingStyle[DocumentApp.Attribute.FONT_SIZE] = 20;
            headingStyle[DocumentApp.Attribute.BOLD] = true;
            headingStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
            headingStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
            heading.setAttributes(headingStyle);
            heading.setSpacingBefore(32);
            heading.setSpacingAfter(16);
          }
          else if (text.indexOf('### ') === 0) {
            var h3Text = text.substring(4).trim();
            var h3Heading = docBody.appendParagraph(h3Text);
            var h3Style = {};
            h3Style[DocumentApp.Attribute.FONT_SIZE] = 16;
            h3Style[DocumentApp.Attribute.BOLD] = true;
            h3Style[DocumentApp.Attribute.FOREGROUND_COLOR] = '#424245';
            h3Style[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
            h3Heading.setAttributes(h3Style);
            h3Heading.setSpacingBefore(20);
            h3Heading.setSpacingAfter(8);
          }
          else if (text.includes('[사진') && text.includes(']')) {
            addFriendlyPhotoPlaceholder(docBody, text);
          }
          else {
            if (isKeyPoint(text)) {
              addNaverStyleHighlight(docBody, text);
            } else {
              var paragraph = docBody.appendParagraph(text);
              var paragraphStyle = {};
              paragraphStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
              paragraphStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
              paragraphStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
              paragraphStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;
              paragraph.setAttributes(paragraphStyle);
              paragraph.setSpacingAfter(16);
              highlightKeywordsNaturally(paragraph, seoKeywords);
            }
          }
        }
        
        addAppleSeparator(docBody);
        addFriendlyClosing(docBody);

        createdDocs.push({
          title: docTitle,
          url: doc.getUrl(),
          baseName: baseName,
          fileType: fileType
        });
        
        Logger.log('✅ Google Docs 생성 완료: ' + docTitle);
        Logger.log('🔗 문서 URL: ' + doc.getUrl());
        count++;
        
      } catch (error) {
        Logger.log('❌ ' + baseName + ' 구글독스 생성 오류: ' + error.message);
        continue;
      }
    }
    
    Logger.log('🎯 구글독스 생성 완료: ' + count + '개 파일 새로 처리됨');
    
    if (createdDocs.length > 0) {
      Logger.log('\n📄 생성된 문서들:');
      for (var k = 0; k < createdDocs.length; k++) {
        Logger.log('  - ' + createdDocs[k].title + ' [' + createdDocs[k].fileType.toUpperCase() + ']: ' + createdDocs[k].url);
      }
    }
    
    return createdDocs;
    
  } catch (error) {
    Logger.log('❌ Google Docs 생성 오류: ' + error.message);
    return [];
  }
}

/**
 * =======================================================================
 * [10] 통합 실행 함수
 * =======================================================================
 */

const CONTROL_SHEET_ID = '1ln-FEi1W0ZPKmVFmBUp6iuQ8dm6ijoGVFB6qqCFP1Q0';
const IMAGE_PARENT_FOLDER_ID = '1-QkVAQf8O5vSV4ndaXEHAD1soKmhQj5t';

function getRecentGeneratedSeoFile_(startTime) {
  try {
    var recentSeoFolderId = '1wr_0xqWOqStu7AFw3NP9RktXA-f7AR0o';
    Logger.log('🔎 getRecentGeneratedSeoFile_ 탐색 시작');
    Logger.log('📁 탐색 폴더 ID: ' + recentSeoFolderId);
    Logger.log('🧩 파일명 패턴: /\\_final\\_seo\\.json$/i');
    Logger.log('🕒 startTime: ' + (startTime ? startTime.toISOString() : 'undefined'));

    Logger.log('1) 폴더 객체 조회 시도');
    var jsonOutputFolder = DriveApp.getFolderById(recentSeoFolderId);
    Logger.log('✅ 폴더 접근 성공: ' + jsonOutputFolder.getName());

    Logger.log('2) 파일 iterator 생성 시도');
    var files = jsonOutputFolder.getFiles();
    var candidates = [];
    var scannedCount = 0;
    var matchedPatternCount = 0;

    Logger.log('3) 파일 순회 시작');
    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      var updatedAt = file.getLastUpdated().getTime();
      scannedCount++;

      Logger.log('   - 검사 파일 #' + scannedCount + ': ' + name + ' / updatedAt=' + new Date(updatedAt).toISOString());

      if (!/\_final\_seo\.json$/i.test(name)) {
        Logger.log('     ⏭️ 패턴 불일치로 스킵');
        continue;
      }

      matchedPatternCount++;

      if (!startTime) {
        Logger.log('     ⚠️ startTime이 없어 시간 비교를 건너뜁니다.');
      } else if (updatedAt < startTime.getTime()) {
        Logger.log('     ⏭️ startTime 이전 파일이라 스킵');
        continue;
      }

      candidates.push({
        file: file,
        name: name,
        updatedAt: updatedAt
      });
      Logger.log('     ✅ 후보 파일 추가');
    }

    Logger.log('📊 파일 순회 완료: 전체 ' + scannedCount + '개, 패턴 일치 ' + matchedPatternCount + '개, 최종 후보 ' + candidates.length + '개');

    if (candidates.length === 0) {
      Logger.log('⚠️ 후보 파일이 없어 null 반환');
      return null;
    }

    Logger.log('4) 후보 파일 최신순 정렬');
    candidates.sort(function(a, b) {
      return b.updatedAt - a.updatedAt;
    });

    Logger.log('✅ 최종 선택 파일: ' + candidates[0].name + ' / ' + new Date(candidates[0].updatedAt).toISOString());
    return candidates[0].file;
  } catch (error) {
    Logger.log('❌ getRecentGeneratedSeoFile_ 오류 발생');
    Logger.log('   메시지: ' + error.message);
    Logger.log('   스택: ' + error.stack);
    throw error;
  }
}

function getLatestGeneratedSeoFile_() {
  try {
    Logger.log('🔎 getLatestGeneratedSeoFile_ 탐색 시작');
    Logger.log('📁 CONFIG.JSON_OUTPUT_FOLDER_ID: ' + CONFIG.JSON_OUTPUT_FOLDER_ID);
    Logger.log('1) DriveApp.getFolderById 호출 시도');
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    Logger.log('✅ 폴더 접근 성공: ' + jsonOutputFolder.getName());

    Logger.log('2) Folder.getFiles 호출 시도');
    var files = jsonOutputFolder.getFiles();
    var candidates = [];
    var scannedCount = 0;

    Logger.log('3) 파일 순회 시작');
    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      var updatedAt = file.getLastUpdated().getTime();
      scannedCount++;

      Logger.log('   - 검사 파일 #' + scannedCount + ': ' + name + ' / updatedAt=' + new Date(updatedAt).toISOString());

      if (!/\_final\_seo\.json$/i.test(name)) {
        Logger.log('     ⏭️ _final_seo.json 패턴 불일치');
        continue;
      }

      candidates.push({
        file: file,
        name: name,
        updatedAt: updatedAt
      });
      Logger.log('     ✅ 후보 추가');
    }

    Logger.log('📊 후보 파일 수: ' + candidates.length + '개');

    if (candidates.length === 0) {
      Logger.log('⚠️ 후보 파일이 없어 null 반환');
      return null;
    }

    Logger.log('4) 최신순 정렬');
    candidates.sort(function(a, b) {
      return b.updatedAt - a.updatedAt;
    });

    Logger.log('✅ 최종 선택 파일: ' + candidates[0].name + ' / ' + new Date(candidates[0].updatedAt).toISOString());
    return candidates[0].file;
  } catch (error) {
    Logger.log('❌ getLatestGeneratedSeoFile_ 오류 발생');
    Logger.log('   메시지: ' + error.message);
    Logger.log('   스택: ' + error.stack);
    throw error;
  }
}

function extractTitleFromContent_(content, fallbackTitle) {
  var lines = String(content || '')
    .split('\n')
    .map(function(line) { return line.trim(); })
    .filter(function(line) { return line.length > 0; });

  if (lines.length > 0 && lines[0].indexOf('# ') === 0) {
    var extractedTitle = lines[0].substring(2).trim();
    if (extractedTitle) {
      return extractedTitle;
    }
  }

  return fallbackTitle || '제목 없음';
}

function getPublishControlRow_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();

  for (var i = 0; i < values.length; i++) {
    var publishMode = String(values[i][5] || '').trim();
    if (publishMode !== '자동' && publishMode !== '수동승인') continue;
    var bloggerUrl = String(values[i][11] || '').trim();
    if (bloggerUrl) continue; // L열 URL 있으면 이미 발행완료 → 스킵
    return {
      rowIndex: i + 2,
      values: values[i]
    };
  }

  return null;
}

function updatePublishStatus_(sheet, rowIndex, status) {
  if (!sheet || !rowIndex) return;
  sheet.getRange(rowIndex, 7).setValue(status);
}

function getImageFolderIdFromControlRow_(controlRow) {
  if (!controlRow || !controlRow.values) {
    return '';
  }

  var folderRef = String(controlRow.values[9] || '').trim();
  if (!folderRef) {
    return '';
  }

  var urlMatch = folderRef.match(/[-\w]{25,}/);
  return urlMatch ? urlMatch[0] : folderRef;
}

function sanitizeFolderName_(title) {
  return String(title || '제목없음')
    .replace(/[\\\/:\*\?"<>\|#\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80) || '제목없음';
}

function createImageFolderForPost_(title) {
  var parentFolder = DriveApp.getFolderById(IMAGE_PARENT_FOLDER_ID);
  var datePrefix = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
  var folderName = datePrefix + '_' + sanitizeFolderName_(title);
  var existingFolders = parentFolder.getFoldersByName(folderName);

  if (existingFolders.hasNext()) {
    return existingFolders.next();
  }

  return parentFolder.createFolder(folderName);
}

function buildPhotoGuideText_(finalData) {
  var photoGuides = finalData && finalData.photo_guides ? finalData.photo_guides : [];
  return photoGuides.join('\n');
}

function updateControlSheetImageMeta_(sheet, rowIndex, folderUrl, photoGuideText) {
  if (!sheet || !rowIndex) return;
  sheet.getRange(rowIndex, 10).setValue(folderUrl || '');
  sheet.getRange(rowIndex, 11).setValue(photoGuideText || '');
}

/**
 * 완전 통합 처리 함수 - 전처리 → SEO → 사진 매핑 → HTML 변환 → Blogger 발행
 */
function runGenerateOnly() {
  try {
    Logger.log("🚀 === 1단계: 글 생성 전용 실행 ===");
    runFullPipelineOneByOne();

    var generatedFile = getLatestGeneratedSeoFile_();
    if (generatedFile) {
      Logger.log('📄 runGenerateOnly 생성 파일명: ' + generatedFile.getName());
      Logger.log('📁 runGenerateOnly 저장 폴더 ID: ' + CONFIG.JSON_OUTPUT_FOLDER_ID);
    } else {
      Logger.log('⚠️ runGenerateOnly 완료 후 생성된 _final_seo.json 파일을 찾지 못했습니다.');
      Logger.log('📁 확인 대상 폴더 ID: ' + CONFIG.JSON_OUTPUT_FOLDER_ID);
    }

    Logger.log('✅ 발행 준비 완료. runPublishOnly() 실행하세요');
    toast_('발행 준비 완료. runPublishOnly() 실행하세요');

    return {
      success: true,
      status: 'generated'
    };
  } catch (error) {
    Logger.log("❌ 글 생성 전용 실행 오류: " + error.message);
    toast_("글 생성 중 오류 발생: " + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

function runPublishOnly() {
  try {
    Logger.log("🚀 === 2단계: 발행 전용 실행 ===");
    var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
    var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);

    if (!sheet) {
      throw new Error('시트1을 찾을 수 없습니다. Sheet ID를 확인하세요.');
    }

    var controlRow = getPublishControlRow_(sheet);
    if (!controlRow) {
      Logger.log('⛔ 발행 가능한 행 없음 (F열 미설정 또는 L열 URL 이미 존재 — 중복 발행 차단)');
      toast_('발행할 행이 없습니다. 이미 발행 완료되었거나 F열 설정을 확인하세요.');
      return { success: false, status: 'no_target' };
    }

    var publishMode = String(controlRow.values[5] || '').trim();
    var isApproved = controlRow.values[7] === true;
    var scheduleRaw = controlRow.values[8];
    var existingImageFolderId = getImageFolderIdFromControlRow_(controlRow);

    // I열 예약시간 파싱 → ISO 8601 변환
    var scheduledTime = null;
    if (scheduleRaw) {
      var scheduleDate = (scheduleRaw instanceof Date) ? scheduleRaw : new Date(scheduleRaw);
      if (!isNaN(scheduleDate.getTime())) {
        scheduledTime = scheduleDate.toISOString();
      }
    }

    Logger.log('📋 발행 제어 행: ' + controlRow.rowIndex + '행');
    Logger.log('📢 발행 모드: ' + publishMode);
    Logger.log('☑️ 승인 체크: ' + (isApproved ? 'true' : 'false'));
    Logger.log('🖼️ 기존 이미지 폴더 ID: ' + (existingImageFolderId || '없음'));
    Logger.log('🕐 I열 원본값: ' + (scheduleRaw ? String(scheduleRaw) : '비어있음'));
    Logger.log('🕐 계산된 예약시간 (ISO 8601): ' + (scheduledTime || '즉시 발행'));

    Logger.log("1️⃣ 최신 SEO 결과 조회");
    var seoFile;
    try {
      seoFile = getLatestGeneratedSeoFile_();
      Logger.log('✅ 최신 SEO 결과 조회 성공');
    } catch (e) {
      Logger.log('❌ 최신 SEO 결과 조회 단계 오류');
      Logger.log('   message: ' + e.message);
      Logger.log('   stack: ' + e.stack);
      throw e;
    }

    if (!seoFile) {
      throw new Error('_final_seo.json 파일을 찾지 못했습니다. runGenerateOnly()를 먼저 실행하세요.');
    }

    var finalData = JSON.parse(seoFile.getBlob().getDataAsString());
    var title = extractTitleFromContent_(finalData.content, finalData.baseName);
    var imageFolder = existingImageFolderId
      ? DriveApp.getFolderById(existingImageFolderId)
      : createImageFolderForPost_(title);
    var photoGuideText = buildPhotoGuideText_(finalData);
    var mappedContent;
    var htmlContent;
    var labels;
    var postUrl;

    Logger.log("2️⃣ 이미지 폴더 생성 및 시트 기록");
    updateControlSheetImageMeta_(sheet, controlRow.rowIndex, imageFolder.getUrl(), photoGuideText);

    Logger.log("3️⃣ 사진 매핑");
    mappedContent = mapPhotosToPlaceholders(finalData.content, imageFolder.getId());

    Logger.log("4️⃣ Blogger HTML 변환");
    htmlContent = convertToBloggerHTML(mappedContent, title);
    labels = (finalData.seo_keywords || [])
      .filter(function(l) { return typeof l === 'string' && l.trim() !== ''; })
      .map(function(l) { return l.trim().substring(0, 50); });

    if (publishMode === '수동승인' && !isApproved) {
      updatePublishStatus_(sheet, controlRow.rowIndex, '승인대기');
      Logger.log('⏸️ 수동승인 모드이며 H열 체크박스가 해제되어 있어 발행을 보류합니다.');
      toast_('수동승인 대기 상태입니다. H열 체크 후 다시 실행하세요.');
      return {
        success: true,
        mode: publishMode,
        approved: false,
        title: title,
        status: '승인대기'
      };
    }

    Logger.log("5️⃣ Blogger 발행");
    postUrl = publishToBlogger(title, htmlContent, labels, publishMode, scheduledTime);

    Logger.log("6️⃣ 시트 기록 업데이트");
    updateControlSheetAfterPublish(title, postUrl, controlRow.rowIndex);

    Logger.log("7️⃣ 발행 완료 JSON 파일 삭제");
    try {
      seoFile.setTrashed(true);
      Logger.log('🗑️ _final_seo.json 삭제 완료: ' + seoFile.getName());
    } catch (e) {
      Logger.log('⚠️ JSON 파일 삭제 실패 (무시): ' + e.message);
    }

    Logger.log("🎉 발행 전용 처리 완료!");
    Logger.log('📝 제목: ' + title);
    Logger.log('🔗 Blogger URL: ' + postUrl);
    toast_('Blogger 발행 완료!');

    return {
      success: true,
      mode: publishMode,
      approved: true,
      title: title,
      postUrl: postUrl,
      rowIndex: controlRow.rowIndex
    };
  } catch (error) {
    Logger.log("❌ 완전 통합 처리 오류: " + error.message);
    Logger.log("❌ 완전 통합 처리 스택: " + error.stack);
    toast_("통합 처리 중 오류 발생: " + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 완전 통합 처리 함수 - 생성 → 발행 순차 실행
 */
function runCompleteProcess() {
  try {
    Logger.log("🚀 === 완전 통합 처리 시작 (생성 → 발행) ===");

    var generateResult = runGenerateOnly();
    if (!generateResult || !generateResult.success) {
      return generateResult;
    }

    Utilities.sleep(2000);

    return runPublishOnly();
  } catch (error) {
    Logger.log("❌ 완전 통합 처리 오류: " + error.message);
    toast_("통합 처리 중 오류 발생: " + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * =======================================================================
 * [11] 시스템 상태 확인 및 유틸리티
 * =======================================================================
 */

/**
 * 시스템 상태 확인 (업데이트된 버전)
 */
function checkSystemStatusUpdated() {
  Logger.log("🔍 === 시스템 상태 확인 (HTML + TXT 지원 버전) ===");
  
  try {
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    var styleAnalysisFolder = DriveApp.getFolderById(CONFIG.STYLE_ANALYSIS_FOLDER_ID);
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    Logger.log("📁 입력 폴더 접근: 성공 (" + inputFolder.getName() + ")");
    Logger.log("📁 스타일 분석 폴더 접근: 성공 (" + styleAnalysisFolder.getName() + ")");
    Logger.log("📁 JSON 출력 폴더 접근: 성공 (" + jsonOutputFolder.getName() + ")");
    Logger.log("📁 독스 출력 폴더 접근: 성공 (" + docsOutputFolder.getName() + ")");
    
    // 파일 현황 확인
    var htmlCount = 0;
    var txtCount = 0;
    var styleHtmlCount = 0;
    var preprocessCount = 0;
    var seoCount = 0;
    var docsCount = 0;
    
    // 입력 폴더의 HTML/TXT 파일
    var inputFiles = inputFolder.getFiles();
    while (inputFiles.hasNext()) {
      var f = inputFiles.next();
      var name = f.getName();
      if (/\.html?$/i.test(name)) htmlCount++;
      if (/\.txt$/i.test(name)) txtCount++;
    }
    
    // 스타일 분석 폴더의 HTML 파일
    var styleFiles = styleAnalysisFolder.getFiles();
    while (styleFiles.hasNext()) {
      var f = styleFiles.next();
      var name = f.getName();
      if (/\.html?$/i.test(name)) styleHtmlCount++;
    }
    
    // JSON 출력 폴더의 처리 파일들
    var jsonFiles = jsonOutputFolder.getFiles();
    while (jsonFiles.hasNext()) {
      var f = jsonFiles.next();
      var name = f.getName();
      if (/\_preprocess\.json$/i.test(name)) preprocessCount++;
      if (/\_final_seo\.json$/i.test(name)) seoCount++;
    }
    
    // 독스 출력 폴더의 문서들
    var docsFiles = docsOutputFolder.getFiles();
    while (docsFiles.hasNext()) {
      var f = docsFiles.next();
      docsCount++;
    }
    
    Logger.log("📊 파일 현황:");
    Logger.log("  📂 입력 폴더 - HTML 파일: " + htmlCount + "개");
    Logger.log("  📂 입력 폴더 - TXT 파일: " + txtCount + "개");
    Logger.log("  📂 스타일 분석 폴더 - HTML 파일: " + styleHtmlCount + "개");
    Logger.log("  📂 JSON 폴더 - 전처리 파일: " + preprocessCount + "개");
    Logger.log("  📂 JSON 폴더 - SEO 파일: " + seoCount + "개");
    Logger.log("  📂 독스 폴더 - 구글독스: " + docsCount + "개");
    
    // 처리 대기 중인 파일 확인
    var nextFileInfo = getNextPreprocessFileToSEO();
    var pendingCount = nextFileInfo ? nextFileInfo.totalRemaining : 0;
    
    Logger.log("\n🆕 처리 대기 중인 파일:");
    Logger.log("  🔄 SEO 처리 대기: " + pendingCount + "개");
    
    if (nextFileInfo) {
      Logger.log("  📋 다음 처리할 파일: " + nextFileInfo.file.baseName);
    }
    
    // SEO 키워드 및 스타일 확인
    var keywords = getSEOKeywordsFromC2();
    var highlightKeywords = getHighlightKeywordsFromA2();
    var styleData = getStyleDataFromSheet();
    var templateData = getSelectedTemplate();
    var apiKey = getAnthropicKey_();
    
    Logger.log("\n🔑 SEO 키워드: " + keywords.length + "개 (" + keywords.join(', ') + ")");
    Logger.log("💎 강조 키워드: " + highlightKeywords.length + "개 (" + highlightKeywords.join(', ') + ")");
    Logger.log("📊 스타일 번호: " + (styleData ? styleData.number : '없음'));
    Logger.log("📄 템플릿: " + (templateData ? templateData.name : '없음'));
    Logger.log("🔐 Anthropic API 키: " + (apiKey ? '설정됨' : '미설정'));
    
    Logger.log("✅ 시스템 상태 확인 완료");
    
    // 권장 실행 방법
    Logger.log("\n💡 권장 실행 방법:");
    if (pendingCount > 0) {
      Logger.log("  🔄 runCompleteProcess() - 통합 처리 (1개 파일 완전 처리)");
      Logger.log("  🔄 processNextSEOFile() - 다음 파일 하나만 처리");
    } else if (seoCount > docsCount) {
      Logger.log("  📄 STEP_D1_Simple_SEO_Docs() - 구글독스 생성");
    } else {
      Logger.log("  ✅ 모든 처리 완료! 새 HTML/TXT 파일을 추가하세요.");
    }
    
    Logger.log("\n📁 폴더 구조:");
    Logger.log("  📥 메인 입력: " + CONFIG.INPUT_FOLDER_ID + " (HTML/TXT 처리용)");
    Logger.log("  📥 스타일 분석: " + CONFIG.STYLE_ANALYSIS_FOLDER_ID + " (HTML 분석용)");
    Logger.log("  📄 JSON 출력: " + CONFIG.JSON_OUTPUT_FOLDER_ID + " (중간 파일들)");
    Logger.log("  📋 독스 출력: " + CONFIG.DOCS_OUTPUT_FOLDER_ID + " (최종 문서)");
    
    return {
      htmlCount: htmlCount,
      txtCount: txtCount,
      styleHtmlCount: styleHtmlCount,
      preprocessCount: preprocessCount,
      seoCount: seoCount,
      docsCount: docsCount,
      pendingCount: pendingCount,
      keywordCount: keywords.length,
      highlightKeywordCount: highlightKeywords.length,
      hasStyleData: !!styleData,
      hasTemplateData: !!templateData,
      hasApiKey: !!apiKey
    };
    
  } catch (error) {
    Logger.log("❌ 시스템 상태 확인 오류: " + error.message);
    return null;
  }
}

// 이 함수 실행
function resetShotsiFile() {
  var baseName = '샷시 원탑을 자부하는 범대표가 알려주는 #샷시 종결 영상 ※절대클릭※ LX 창호의 모든것!! [Korean (auto-generated)] [GetSubs.cc]';
  
  Logger.log('🔄 샷시 파일 재처리 준비');
  
  var jsonFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
  var docsFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
  
  // 1. JSON 파일들 삭제
  var jsonFiles = [
    baseName + '_preprocess.json',
    baseName + '_final_seo.json'
  ];
  
  for (var i = 0; i < jsonFiles.length; i++) {
    var files = jsonFolder.getFilesByName(jsonFiles[i]);
    if (files.hasNext()) {
      files.next().setTrashed(true);
      Logger.log('🗑️ 삭제: ' + jsonFiles[i]);
    }
  }
  
  // 2. Google Docs 삭제
  var docNames = [
    'LX창호 10년 보증의 비밀, 원데이시공으로 완성하는 경관 아름다운 우리집'
  ];
  
  for (var j = 0; j < docNames.length; j++) {
    var docs = docsFolder.getFilesByName(docNames[j]);
    if (docs.hasNext()) {
      docs.next().setTrashed(true);
      Logger.log('🗑️ 삭제: ' + docNames[j]);
    }
  }
  
  Logger.log('✅ 재처리 준비 완료!');
  Logger.log('💡 이제 runCompleteProcess()를 실행하세요.');
}

/**
 * 처리 완료된 원본 파일 삭제
 * @param {Array} createdDocs - 생성된 Docs 정보 배열
 */
/**
 * 스타일 시트 시스템 테스트
 */
function testStyleSheetSystem() {
  Logger.log("🧪 === 스타일 시트 시스템 테스트 ===");
  
  try {
    // 1. 시트2 초기화 테스트
    Logger.log("1️⃣ 시트2 초기화 테스트");
    initializeStyleSheet();
    
    // 2. B2 셀 읽기 테스트
    Logger.log("2️⃣ B2 셀에서 스타일 번호 읽기 테스트");
    var styleData = getStyleDataFromSheet();
    
    if (styleData) {
      Logger.log("✅ 스타일 데이터 읽기 성공!");
      Logger.log("📊 스타일 번호: " + styleData.number);
      Logger.log("📊 글톤: " + styleData.writing_tone);
      Logger.log("📊 문장스타일: " + styleData.sentence_style);
    } else {
      Logger.log("❌ 스타일 데이터 읽기 실패");
    }
    
    // 3. 키워드 테스트
    Logger.log("3️⃣ SEO 키워드 읽기 테스트");
    var keywords = getSEOKeywordsFromC2();
    Logger.log("🔑 키워드: [" + keywords.join(' | ') + "]");
    
    // 4. 강조 키워드 테스트
    Logger.log("4️⃣ 강조 키워드 읽기 테스트");
    var highlightKeywords = getHighlightKeywordsFromA2();
    Logger.log("💎 강조 키워드: [" + highlightKeywords.join(' | ') + "]");
    
    // 5. 템플릿 테스트
    Logger.log("5️⃣ 템플릿 읽기 테스트");
    var templateData = getSelectedTemplate();
    if (templateData) {
      Logger.log("✅ 템플릿 데이터 읽기 성공!");
      Logger.log("📄 템플릿: " + templateData.name);
    }
    
    if (styleData && keywords.length > 0 && templateData) {
      Logger.log("🎉 스타일 시트 시스템 테스트 성공!");
      Logger.log("💡 이제 runCompleteProcess()를 실행하세요.");
    } else {
      Logger.log("⚠️ 설정을 확인하세요:");
      if (!styleData) Logger.log("   - B2 셀에 스타일 번호 입력 (예: 1, 2, 3...)");
      if (keywords.length === 0) Logger.log("   - C2 셀에 SEO 키워드 입력");
      if (!templateData) Logger.log("   - D2 셀에 템플릿 선택");
    }
    
  } catch (error) {
    Logger.log("❌ 테스트 오류: " + error.message);
  }
}

/**
 * 모든 처리 결과 초기화 (테스트용)
 */
function resetAllProcessedFiles() {
  try {
    Logger.log("🔄 === 전체 처리 결과 초기화 시작 ===");
    
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    var deletedCount = 0;
    
    // JSON 폴더의 처리 파일들 삭제
    var jsonFiles = jsonOutputFolder.getFiles();
    while (jsonFiles.hasNext()) {
      var f = jsonFiles.next();
      var name = f.getName();
      
      if (/\_preprocess\.json$/i.test(name) ||
          /\_style_analysis\.json$/i.test(name) ||
          /\_final_seo\.json$/i.test(name) ||
          /\_research\.json$/i.test(name)) {
        f.setTrashed(true);
        deletedCount++;
        Logger.log('🗑️ 삭제: ' + name);
      }
    }
    
    // 구글독스 폴더의 문서들 삭제
    var docsFiles = docsOutputFolder.getFiles();
    while (docsFiles.hasNext()) {
      var f = docsFiles.next();
      f.setTrashed(true);
      deletedCount++;
      Logger.log('🗑️ 삭제: ' + f.getName());
    }
    
    Logger.log('✅ 초기화 완료: ' + deletedCount + '개 파일 삭제됨');
    Logger.log('💡 이제 다시 파이프라인을 실행할 수 있습니다.');
    toast_('초기화 완료! ' + deletedCount + '개 파일 삭제');
    
  } catch (error) {
    Logger.log('❌ 초기화 오류: ' + error.message);
  }
}

/**
 * =======================================================================
 * [12] API 키 설정 및 사용 가이드
 * =======================================================================
 */

/**
 * Anthropic API 키를 스크립트 속성에 저장합니다.
 */
function STEP5_configOnce_setAnthropicKey(KEY) {
  PropertiesService.getScriptProperties().setProperty(PROP_KEYS.ANTHROPIC_API_KEY, KEY);
  toast_('Anthropic API 키 저장 완료');
  Logger.log('✅ Anthropic API 키 저장 완료');
}

/**
 * Gemini API 키를 스크립트 속성에 저장합니다.
 */
function STEP5_configOnce_setGeminiKey(KEY) {
  if (!KEY || KEY.toString().trim() === '') {
    Logger.log('❌ 오류: Gemini API 키 값이 입력되지 않았습니다.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty(PROP_KEYS.GEMINI_API_KEY, KEY);
  toast_('Gemini API 키 저장 완료');
  Logger.log('✅ Gemini API 키 저장 완료');
}

/**
 * 통합 시스템 사용 가이드
 */
function showUsageGuide() {
  Logger.log("📖 === 통합 SEO 자동화 시스템 사용 가이드 (HTML + TXT 지원) ===");
  Logger.log("");
  Logger.log("🎯 주요 함수:");
  Logger.log("  🆕 runCompleteProcess() - 통합 처리 (1개 파일 완전 처리)");
  Logger.log("  🔄 processNextSEOFile() - 다음 파일 1개만 SEO 처리");
  Logger.log("  📄 STEP_D1_Simple_SEO_Docs() - 구글독스 생성");
  Logger.log("");
  Logger.log("📁 폴더 구조:");
  Logger.log("  📥 메인 입력: " + CONFIG.INPUT_FOLDER_ID + " (HTML/TXT 처리용)");
  Logger.log("  📥 스타일 분석: " + CONFIG.STYLE_ANALYSIS_FOLDER_ID + " (HTML 분석용)");
  Logger.log("  📄 JSON 출력: " + CONFIG.JSON_OUTPUT_FOLDER_ID);
  Logger.log("  📋 독스 출력: " + CONFIG.DOCS_OUTPUT_FOLDER_ID);
  Logger.log("");
  Logger.log("⚙️ 설정:");
  Logger.log("  📊 A2 셀: 강조 키워드 (최대 5개, 쉼표 구분)");
  Logger.log("  📊 B2 셀: 스타일 번호 (1-5)");
  Logger.log("  🔑 C2 셀: SEO 키워드 (쉼표 구분)");
  Logger.log("  📈 가중치: 시트 입력 없음, 코드 기본값 사용");
  Logger.log("  📄 D2 셀: 템플릿 선택 (예: 유튜브스크립트형)");
  Logger.log("");
  Logger.log("🔧 유틸리티:");
  Logger.log("  🔍 checkSystemStatusUpdated() - 상태 확인");
  Logger.log("  🧪 testStyleSheetSystem() - 설정 테스트");
  Logger.log("  🗑️ resetAllProcessedFiles() - 전체 초기화");
  Logger.log("");
  Logger.log("💡 권장 워크플로우:");
  Logger.log("  1. HTML 또는 TXT 파일을 메인 입력 폴더에 업로드");
  Logger.log("  2. 스프레드시트에서 설정 (A2, B2, C2, D2)");
  Logger.log("  3. runCompleteProcess() 실행 (1개 파일 완전 처리)");
  Logger.log("  4. 필요시 반복 실행으로 모든 파일 처리");
  Logger.log("");
  Logger.log("📝 파일 타입별 차이:");
  Logger.log("  🌐 HTML: 스타일 분석 O, 원본 구조 활용");
  Logger.log("  📝 TXT: 스타일 분석 X, 구어체→문어체 변환");
  Logger.log("");
}

/**
 * 테스트: C2에서 키워드 읽기 확인
 */
function testC2Reading() {
  Logger.log("🧪 === C2 키워드 읽기 테스트 ===");
  
  var keywords = getSEOKeywordsFromC2();
  var highlightKeywords = getHighlightKeywordsFromA2();
  var weights = getWeightsFromSheet();
  
  Logger.log('🔑 SEO 키워드: [' + keywords.join(' | ') + ']');
  Logger.log('💎 강조 키워드: [' + highlightKeywords.join(' | ') + ']');
  Logger.log('📊 가중치: ' + JSON.stringify(weights));
  
  if (keywords.length > 0) {
    Logger.log("✅ 키워드 읽기 성공!");
    return true;
  } else {
    Logger.log("❌ 키워드 읽기 실패");
    return false;
  }
}

/**
 * TXT 파일 처리 테스트
 */
function testTxtProcessing() {
  Logger.log("🧪 === TXT 파일 처리 테스트 ===");
  
  try {
    // 샘플 텍스트 (유튜브 자막 형식)
    var sampleText = "이게 집에 들어가 도어 맞아요 이게\n\n" +
                     "국내에서 영입만 가능한 도어\n\n" +
                     "[음악]\n\n" +
                     "안녕하세요 이성 PD 김현 연구원입니다";
    
    Logger.log("📝 원본 텍스트:\n" + sampleText);
    
    var cleaned = cleanYoutubeScript(sampleText);
    Logger.log("\n🧹 정제된 텍스트:\n" + cleaned);
    
    var analyzed = analyzeTxtScript(sampleText);
    Logger.log("\n📊 분석 결과:");
    Logger.log("  - 파일 타입: " + analyzed.file_type);
    Logger.log("  - 문단 수: " + analyzed.reference_snippets.length);
    Logger.log("  - 키워드: " + analyzed.keywords_top.join(', '));
    
    Logger.log("✅ TXT 처리 테스트 완료!");
    
  } catch (error) {
    Logger.log("❌ 테스트 오류: " + error.message);
  }
}

/**
 * [추가] 제목 검증 및 로깅 함수
 * 
 * 새로운 함수 - STEP_D1_Simple_SEO_Docs() 내부에서 사용
 */
function validateAndLogTitle(docTitle, baseName, fileType) {
  // 원본 파일명이 그대로 제목으로 사용되었는지 체크
  var hasOriginalFilename = docTitle.includes('[Korean') || 
                            docTitle.includes('[GetSubs') || 
                            docTitle.includes('(auto-generated)') ||
                            docTitle === baseName + '_최종본';
  
  if (hasOriginalFilename) {
    Logger.log('⚠️ 경고: 파일명이 제목으로 사용됨 - Claude가 제목을 생성하지 않았을 수 있습니다');
    Logger.log('💡 제안: 프롬프트를 확인하거나 다시 생성해보세요');
  } else {
    Logger.log('✅ 매력적인 제목 생성 확인: "' + docTitle + '"');
  }
  
  // 제목 길이 체크
  var titleLength = docTitle.length;
  if (titleLength < 15) {
    Logger.log('⚠️ 제목이 너무 짧습니다 (' + titleLength + '자)');
  } else if (titleLength > 50) {
    Logger.log('⚠️ 제목이 너무 깁니다 (' + titleLength + '자) - 40자 이내 권장');
  } else {
    Logger.log('✅ 제목 길이 적절 (' + titleLength + '자)');
  }
  
  return !hasOriginalFilename;
}

/**
 * =======================================================================
 * 특정 파일 재처리 함수 (기존 코드에 추가)
 * =======================================================================
 */

/**
 * 특정 baseName의 SEO 파일과 Google Docs 삭제 후 재처리
 * 
 * @param {string} baseName - 파일의 기본 이름 (확장자 제외)
 * 예: "지금 알아야 하는 3가지 트렌디한 도어 추천!(feat.도어명가) [Korean (auto-generated)] [GetSubs.cc]"
 */
function reprocessSpecificFile(baseName) {
  try {
    Logger.log('🔄 === 특정 파일 재처리 시작: ' + baseName + ' ===');
    
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    var deletedCount = 0;
    
    // 1. SEO JSON 파일 삭제
    var seoFileName = baseName + '_final_seo.json';
    var seoFiles = jsonOutputFolder.getFilesByName(seoFileName);
    if (seoFiles.hasNext()) {
      seoFiles.next().setTrashed(true);
      deletedCount++;
      Logger.log('🗑️ SEO 파일 삭제: ' + seoFileName);
    }
    
    // 2. Google Docs 삭제 (여러 가능한 제목)
    var possibleDocTitles = [
      baseName + '_최종본',
      baseName + '_SEO최적화_최종본'
    ];
    
    for (var i = 0; i < possibleDocTitles.length; i++) {
      var docFiles = docsOutputFolder.getFilesByName(possibleDocTitles[i]);
      if (docFiles.hasNext()) {
        docFiles.next().setTrashed(true);
        deletedCount++;
        Logger.log('🗑️ Google Docs 삭제: ' + possibleDocTitles[i]);
      }
    }
    
    if (deletedCount === 0) {
      Logger.log('⚠️ 삭제할 파일을 찾지 못했습니다.');
      Logger.log('💡 baseName을 정확히 확인해주세요: "' + baseName + '"');
      return false;
    }
    
    Logger.log('✅ 삭제 완료: ' + deletedCount + '개 파일');
    Logger.log('💡 이제 processNextSEOFile()을 실행하여 재처리하세요.');
    toast_('파일 삭제 완료! processNextSEOFile() 실행 가능');
    
    return true;
    
  } catch (error) {
    Logger.log('❌ 재처리 오류: ' + error.message);
    return false;
  }
}

/**
 * 간편 재처리 함수 - 삭제 후 바로 재생성
 * 
 * @param {string} baseName - 파일의 기본 이름
 */
function quickReprocess(baseName) {
  try {
    Logger.log('🚀 === 간편 재처리: ' + baseName + ' ===');
    
    // 1단계: 기존 파일 삭제
    var deleted = reprocessSpecificFile(baseName);
    
    if (!deleted) {
      Logger.log('❌ 삭제 실패 - 재처리 중단');
      return;
    }
    
    // 2초 대기
    Utilities.sleep(2000);
    
    // 2단계: SEO 재생성
    Logger.log('🔄 SEO 파일 재생성 중...');
    processNextSEOFile();
    
    // 2초 대기
    Utilities.sleep(2000);
    
    // 3단계: Google Docs 생성
    Logger.log('📄 Google Docs 생성 중...');
    var createdDocs = STEP_D1_Simple_SEO_Docs();
    
    if (createdDocs && createdDocs.length > 0) {
      Logger.log('🎉 재처리 완료!');
      Logger.log('📄 새 문서: ' + createdDocs[0].url);
      toast_('재처리 완료! 새 제목으로 문서 생성됨');
    } else {
      Logger.log('⚠️ 문서 생성 안 됨 - 로그 확인 필요');
    }
    
  } catch (error) {
    Logger.log('❌ 간편 재처리 오류: ' + error.message);
  }
}

/**
 * 파일명에서 baseName 추출 도우미 함수
 * 
 * Google Drive 파일 이름을 입력하면 baseName 반환
 */
function extractBaseName(fileName) {
  // 확장자 제거
  var baseName = fileName.replace(/\.(txt|html?|mhtml|mht)$/i, '');
  
  // _preprocess, _final_seo, _최종본 등 제거
  baseName = baseName
    .replace(/_preprocess$/i, '')
    .replace(/_final_seo$/i, '')
    .replace(/_최종본$/i, '')
    .replace(/_SEO최적화_최종본$/i, '');
  
  Logger.log('📋 추출된 baseName: "' + baseName + '"');
  return baseName;
}

/**
 * =======================================================================
 * 사용 예시
 * =======================================================================
 */

/**
 * 예시 1: 특정 파일만 재처리
 */
function example_reprocessTxtFile() {
  // 방법 1: baseName을 직접 입력
  var baseName = '지금 알아야 하는 3가지 트렌디한 도어 추천!(feat.도어명가) [Korean (auto-generated)] [GetSubs.cc]';
  quickReprocess(baseName);
}

/**
 * 예시 2: 파일명에서 baseName 추출 후 재처리
 */
function example_reprocessFromFileName() {
  // Google Drive에 보이는 파일명 (확장자 포함)
  var fileName = '지금 알아야 하는 3가지 트렌디한 도어 추천!(feat.도어명가) [Korean (auto-generated)] [GetSubs.cc].txt';
  
  // baseName 추출
  var baseName = extractBaseName(fileName);
  
  // 재처리
  quickReprocess(baseName);
}

/**
 * 예시 3: 대화형으로 baseName 확인
 */
function example_checkBaseName() {
  // 현재 처리 대기 중인 파일 확인
  var nextFile = getNextPreprocessFileToSEO();
  
  if (nextFile) {
    Logger.log('📋 다음 처리할 파일의 baseName:');
    Logger.log('   "' + nextFile.file.baseName + '"');
  } else {
    Logger.log('⚠️ 처리 대기 중인 파일이 없습니다.');
  }
}

/**
 * =======================================================================
 * 즉시 실행 함수 (귀하의 경우)
 * =======================================================================
 */

/**
 * 문제의 TXT 파일 즉시 재처리
 * 
 * 이 함수를 바로 실행하세요!
 */
function FIX_reprocessTxtFileNow() {
  var baseName = '지금 알아야 하는 3가지 트렌디한 도어 추천!(feat.도어명가) [Korean (auto-generated)] [GetSubs.cc]';
  
  Logger.log('🔧 === 즉시 재처리 시작 ===');
  Logger.log('📁 대상 파일: ' + baseName);
  Logger.log('');
  
  quickReprocess(baseName);
}

/**
 * 삭제 테스트 함수 - 특정 파일 삭제 테스트
 */
function testFileDelete() {
  Logger.log("🧪 === 파일 삭제 테스트 ===");
  
  try {
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    var files = inputFolder.getFiles();
    
    if (!files.hasNext()) {
      Logger.log('❌ 폴더에 파일이 없습니다.');
      return;
    }
    
    var file = files.next();
    var fileName = file.getName();
    var fileId = file.getId();
    
    Logger.log('📁 테스트 파일: ' + fileName);
    Logger.log('🆔 파일 ID: ' + fileId);
    
    // 권한 확인
    Logger.log('');
    Logger.log('🔐 권한 확인:');
    Logger.log('  소유자: ' + file.getOwner().getEmail());
    Logger.log('  편집 가능: ' + (file.isShareableByEditors() ? '예' : '아니오'));
    
    // 삭제 권한 확인
    var canDelete = false;
    try {
      file.setTrashed(false); // 이미 삭제되지 않았으면 아무 일도 안 함
      canDelete = true;
      Logger.log('  삭제 권한: ✓ 있음');
    } catch (e) {
      Logger.log('  삭제 권한: ✗ 없음 (' + e.message + ')');
    }
    
    if (!canDelete) {
      Logger.log('');
      Logger.log('❌ 파일 삭제 권한이 없습니다.');
      Logger.log('💡 해결 방법:');
      Logger.log('  1. 파일 소유자에게 편집 권한 요청');
      Logger.log('  2. 또는 파일을 직접 업로드한 계정으로 스크립트 실행');
      return;
    }
    
    Logger.log('');
    Logger.log('✅ 파일 삭제 권한 확인 완료');
    Logger.log('💡 실제 파일 삭제는 runCompleteProcessInMemory() 실행 시 자동 수행됩니다.');
    
  } catch (error) {
    Logger.log('❌ 테스트 오류: ' + error.message);
  }
}

/**
 * 모든 파일 연속 처리 (메모리 기반)
 * 
 * 주의: Claude API 속도 제한으로 인해 한 번에 1개씩만 처리하고 중단됩니다.
 * 여러 파일을 처리하려면 5분 간격으로 반복 실행하세요.
 */
function processAllFilesInMemory() {
  Logger.log("🚀 === 모든 파일 연속 처리 (메모리 기반) ===");
  
  var processedCount = 0;
  var maxFiles = 10; // 최대 10개까지만 (안전장치)
  
  for (var i = 0; i < maxFiles; i++) {
    var result = runCompleteProcessInMemory();
    
    if (!result) {
      Logger.log('✅ 모든 파일 처리 완료!');
      break;
    }
    
    if (!result.success) {
      Logger.log('❌ 처리 중 오류 발생 - 중단');
      break;
    }
    
    processedCount++;
    
    // API 속도 제한 고려 - 1개 처리 후 중단
    Logger.log('💡 API 속도 제한으로 1개만 처리 후 중단');
    Logger.log('💡 다음 파일을 처리하려면 5분 후에 다시 실행하세요.');
    break;
  }
  
  Logger.log('');
  Logger.log('📊 총 처리된 파일: ' + processedCount + '개');
  toast_('총 ' + processedCount + '개 파일 처리 완료!');
}

/**
 * 시스템 상태 확인 (메모리 기반 버전)
 */
function checkSystemStatusMemory() {
  Logger.log("🔍 === 시스템 상태 확인 (메모리 기반) ===");
  
  try {
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    var htmlCount = 0;
    var txtCount = 0;
    var docsCount = 0;
    var pendingCount = 0;
    
    // 입력 파일 카운트
    var inputFiles = inputFolder.getFiles();
    while (inputFiles.hasNext()) {
      var f = inputFiles.next();
      var name = f.getName();
      if (/\.html?$/i.test(name)) htmlCount++;
      if (/\.txt$/i.test(name)) txtCount++;
    }
    
    // 완성된 문서 카운트
    var docsFiles = docsOutputFolder.getFiles();
    while (docsFiles.hasNext()) {
      docsFiles.next();
      docsCount++;
    }
    
    // 처리 대기 파일
    var nextFile = getNextUnprocessedFile();
    if (nextFile) {
      // 전체 대기 파일 수 계산
      var allFiles = inputFolder.getFiles();
      while (allFiles.hasNext()) {
        var f = allFiles.next();
        var name = f.getName();
        if (/\.(html?|mhtml|mht|txt)$/i.test(name)) {
          pendingCount++;
        }
      }
      pendingCount = pendingCount - docsCount; // 대략적인 계산
    }
    
    Logger.log("📊 파일 현황:");
    Logger.log("  📂 입력 폴더 - HTML: " + htmlCount + "개");
    Logger.log("  📂 입력 폴더 - TXT: " + txtCount + "개");
    Logger.log("  📋 완성된 문서: " + docsCount + "개");
    Logger.log("  🔄 처리 대기: " + pendingCount + "개");
    
    if (nextFile) {
      Logger.log("  📄 다음 처리: " + nextFile.name);
    }
    
    // 설정 확인
    var keywords = getSEOKeywordsFromC2();
    var highlightKeywords = getHighlightKeywordsFromA2();
    var styleData = getStyleDataFromSheet();
    var templateData = getSelectedTemplate();
    var apiKey = getAnthropicKey_();
    
    Logger.log("\n🔑 설정 상태:");
    Logger.log("  SEO 키워드: " + (keywords.length > 0 ? "✓ " + keywords.length + "개" : "✗ 미설정"));
    Logger.log("  강조 키워드: " + (highlightKeywords.length > 0 ? "✓ " + highlightKeywords.length + "개" : "✗ 미설정"));
    Logger.log("  스타일: " + (styleData ? "✓ " + styleData.number + "번" : "✗ 미설정"));
    Logger.log("  템플릿: " + (templateData ? "✓ " + templateData.name : "✗ 미설정"));
    Logger.log("  API 키: " + (apiKey ? "✓ 설정됨" : "✗ 미설정"));
    
    Logger.log("\n💡 권장 실행 방법:");
    if (pendingCount > 0) {
      Logger.log("  🚀 runCompleteProcessInMemory() - 1개 파일 완전 처리 (JSON 없이)");
      Logger.log("  🔁 processAllFilesInMemory() - 연속 처리 (권장하지 않음)");
    } else {
      Logger.log("  ✅ 모든 파일 처리 완료!");
    }
    
    Logger.log("\n📝 참고:");
    Logger.log("  - JSON 파일 저장 없이 메모리에서만 처리");
    Logger.log("  - Google Docs 생성 후 즉시 원본 파일 삭제");
    Logger.log("  - Claude API 속도 제한: 5분당 1개 권장");
    
    return {
      htmlCount: htmlCount,
      txtCount: txtCount,
      docsCount: docsCount,
      pendingCount: pendingCount,
      hasNextFile: !!nextFile
    };
    
  } catch (error) {
    Logger.log("❌ 상태 확인 오류: " + error.message);
    return null;
  }
}

/**
 * =======================================================================
 * [14] 처리 완료 파일 일괄 삭제
 * =======================================================================
 */

/**
 * 입력 폴더 상태 자세히 확인
 */
function debugInputFolder() {
  Logger.log("🔍 === 입력 폴더 상태 확인 ===");
  
  try {
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    
    Logger.log("📁 폴더 이름: " + inputFolder.getName());
    Logger.log("📁 폴더 ID: " + CONFIG.INPUT_FOLDER_ID);
    Logger.log("");
    
    // 모든 파일 확인 (확장자 필터 없이)
    var allFiles = inputFolder.getFiles();
    var fileCount = 0;
    var htmlCount = 0;
    var txtCount = 0;
    var otherCount = 0;
    
    Logger.log("📄 폴더 내 모든 파일:");
    
    while (allFiles.hasNext()) {
      var file = allFiles.next();
      var name = file.getName();
      var id = file.getId();
      var isTrashed = file.isTrashed();
      
      fileCount++;
      
      if (/\.txt$/i.test(name)) {
        txtCount++;
        Logger.log("  📝 [TXT] " + name);
      } else if (/\.(html?|mhtml|mht)$/i.test(name)) {
        htmlCount++;
        Logger.log("  🌐 [HTML] " + name);
      } else {
        otherCount++;
        Logger.log("  📄 [기타] " + name);
      }
      
      Logger.log("      ID: " + id);
      Logger.log("      휴지통: " + (isTrashed ? "예" : "아니오"));
      Logger.log("");
    }
    
    Logger.log("📊 요약:");
    Logger.log("  전체 파일: " + fileCount + "개");
    Logger.log("  TXT: " + txtCount + "개");
    Logger.log("  HTML: " + htmlCount + "개");
    Logger.log("  기타: " + otherCount + "개");
    
    if (fileCount === 0) {
      Logger.log("");
      Logger.log("⚠️ 파일이 없습니다!");
      Logger.log("💡 확인사항:");
      Logger.log("  1. 폴더 ID가 올바른가요?");
      Logger.log("  2. 파일을 업로드했나요?");
      Logger.log("  3. 파일이 휴지통에 있나요?");
    }
    
    return {
      total: fileCount,
      txt: txtCount,
      html: htmlCount,
      other: otherCount
    };
    
  } catch (error) {
    Logger.log("❌ 오류: " + error.message);
    return null;
  }
}

/**
 * 특정 파일 ID로 파일 찾기
 */
function findFileById() {
  var fileId = "10EKTkYs-uNb74rZaMt8Pnkjy0PN0_KGD"; // 샷시 파일 ID
  
  Logger.log("🔍 === 파일 ID로 검색 ===");
  Logger.log("🆔 파일 ID: " + fileId);
  
  try {
    var file = DriveApp.getFileById(fileId);
    
    Logger.log("✅ 파일 발견!");
    Logger.log("  이름: " + file.getName());
    Logger.log("  휴지통: " + (file.isTrashed() ? "예" : "아니오"));
    Logger.log("  소유자: " + file.getOwner().getEmail());
    
    // 파일이 속한 폴더들 확인
    var parents = file.getParents();
    Logger.log("");
    Logger.log("📁 파일이 속한 폴더:");
    
    var folderCount = 0;
    while (parents.hasNext()) {
      var parent = parents.next();
      folderCount++;
      Logger.log("  " + folderCount + ". " + parent.getName() + " (ID: " + parent.getId() + ")");
    }
    
    if (folderCount === 0) {
      Logger.log("  ⚠️ 파일이 어떤 폴더에도 속하지 않음 (루트에 있음)");
    }
    
    return file;
    
  } catch (error) {
    Logger.log("❌ 파일을 찾을 수 없습니다: " + error.message);
    return null;
  }
}

/**
 * 휴지통 파일 복구
 */
function restoreFileFromTrash() {
  var fileId = "10EKTkYs-uNb74rZaMt8Pnkjy0PN0_KGD";
  
  Logger.log("🔄 === 파일 복구 시도 ===");
  
  try {
    var file = DriveApp.getFileById(fileId);
    
    if (file.isTrashed()) {
      Logger.log("📦 파일이 휴지통에 있습니다: " + file.getName());
      Logger.log("🔄 복구 중...");
      
      file.setTrashed(false);
      
      Logger.log("✅ 복구 완료!");
      Logger.log("💡 이제 deleteProcessedSourceFiles()를 실행하세요.");
      
      return true;
    } else {
      Logger.log("✅ 파일이 이미 활성 상태입니다: " + file.getName());
      return false;
    }
    
  } catch (error) {
    Logger.log("❌ 오류: " + error.message);
    return false;
  }
}

/**
 * 처리되지 않은 새 파일 찾기 (정규식 수정 버전)
 */
function getNextUnprocessedFile() {
  var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
  var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
  
  var files = inputFolder.getFiles();
  var candidates = [];
  
  while (files.hasNext()) {
    var f = files.next();
    var name = f.getName();
    
    // ✨ 수정: "의 사본" 포함한 파일도 인식
    // HTML 또는 TXT 파일만 처리 (사본 파일 포함)
    var isTxt = /\.txt(의 사본)?$/i.test(name);
    var isHtml = /\.(html?|mhtml|mht)(의 사본)?$/i.test(name);
    
    if (!isTxt && !isHtml) continue;
    
    // baseName 추출 (확장자와 "의 사본" 제거)
    var baseName = name
      .replace(/의 사본$/, '')  // "의 사본" 제거
      .replace(/\.[^.]+$/, '');  // 확장자 제거
    
    var fileType = isTxt ? 'txt' : 'html';
    
    // 이미 Google Docs가 생성되었는지 확인
    var alreadyProcessed = false;
    
    // 가능한 문서 제목들
    var possibleDocNames = [
      baseName + '_최종본',
      baseName + '_SEO최적화_최종본'
    ];
    
    for (var i = 0; i < possibleDocNames.length; i++) {
      if (isDocumentExists(docsOutputFolder, possibleDocNames[i])) {
        alreadyProcessed = true;
        break;
      }
    }
    
    // 제목 기반 확인 (더 정확하지만 느림)
    if (!alreadyProcessed) {
      var docsFiles = docsOutputFolder.getFiles();
      while (docsFiles.hasNext()) {
        var docFile = docsFiles.next();
        var docName = docFile.getName();
        
        // baseName의 주요 단어가 포함되어 있으면 이미 처리된 것으로 간주
        var keyWords = baseName.split(/[\s\[\]\(\)]+/).filter(function(w) {
          return w.length > 2;
        }).slice(0, 5);
        
        var matchCount = 0;
        for (var k = 0; k < keyWords.length; k++) {
          if (docName.indexOf(keyWords[k]) !== -1) {
            matchCount++;
          }
        }
        
        // 50% 이상 일치하면 이미 처리된 것으로 간주
        if (matchCount >= Math.ceil(keyWords.length / 2)) {
          alreadyProcessed = true;
          Logger.log('⚠️ 이미 처리됨 (제목 유사): ' + name + ' → ' + docName);
          break;
        }
      }
    }
    
    if (!alreadyProcessed) {
      candidates.push({
        file: f,
        name: name,
        baseName: baseName,
        fileType: fileType,
        lastModified: f.getLastUpdated().getTime()
      });
    } else {
      Logger.log('⚠️ 이미 처리됨 - 스킵: ' + name);
    }
  }
  
  if (candidates.length === 0) {
    return null;
  }
  
  // 가장 오래된 파일 반환 (FIFO)
  candidates.sort(function(a, b) {
    return a.lastModified - b.lastModified;
  });
  
  Logger.log('📋 처리 대기 파일: ' + candidates.length + '개');
  Logger.log('📄 다음 처리: ' + candidates[0].name);
  
  return candidates[0];
}

/**
 * 출력 폴더(Google Docs) 상태 확인
 */
function debugOutputFolder() {
  Logger.log("🔍 === 출력 폴더 상태 확인 ===");
  
  try {
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    Logger.log("📁 폴더 이름: " + docsOutputFolder.getName());
    Logger.log("📁 폴더 ID: " + CONFIG.DOCS_OUTPUT_FOLDER_ID);
    Logger.log("");
    
    var files = docsOutputFolder.getFiles();
    var fileCount = 0;
    
    Logger.log("📄 폴더 내 모든 문서:");
    
    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      var id = file.getId();
      var url = file.getUrl();
      var created = file.getDateCreated();
      
      fileCount++;
      
      Logger.log("  " + fileCount + ". " + name);
      Logger.log("      ID: " + id);
      Logger.log("      생성일: " + created.toLocaleString());
      Logger.log("      URL: " + url);
      Logger.log("");
    }
    
    Logger.log("📊 총 " + fileCount + "개 문서");
    
    if (fileCount === 0) {
      Logger.log("");
      Logger.log("⚠️ 문서가 없습니다!");
      Logger.log("💡 runCompleteProcessInMemory()를 먼저 실행하세요.");
    }
    
    return fileCount;
    
  } catch (error) {
    Logger.log("❌ 오류: " + error.message);
    return 0;
  }
}

/**
 * 입력 파일과 출력 문서 매칭 테스트
 */
function testFileMatching() {
  Logger.log("🧪 === 파일 매칭 테스트 ===");
  
  try {
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    // 1. 입력 파일 정보
    var inputFiles = inputFolder.getFiles();
    var inputFile = null;
    
    while (inputFiles.hasNext()) {
      var f = inputFiles.next();
      var name = f.getName();
      
      if (/\.txt/i.test(name)) {
        inputFile = f;
        break;
      }
    }
    
    if (!inputFile) {
      Logger.log("❌ 입력 파일을 찾을 수 없습니다.");
      return;
    }
    
    var inputName = inputFile.getName();
    var baseName = inputName
      .replace(/의 사본$/, '')
      .replace(/\.[^.]+$/, '');
    
    Logger.log("📄 입력 파일: " + inputName);
    Logger.log("📝 baseName: " + baseName);
    Logger.log("");
    
    // 2. baseName에서 주요 키워드 추출
    var keyWords = baseName.split(/[\s\[\]\(\)]+/).filter(function(w) {
      return w.length > 2 && w !== 'Korean' && w !== 'auto' && w !== 'generated' && w !== 'GetSubs' && w !== 'cc';
    }).slice(0, 5);
    
    Logger.log("🔑 추출된 주요 키워드 (" + keyWords.length + "개):");
    for (var i = 0; i < keyWords.length; i++) {
      Logger.log("  " + (i + 1) + ". " + keyWords[i]);
    }
    Logger.log("");
    
    // 3. 출력 문서들과 매칭 테스트
    var docsFiles = docsOutputFolder.getFiles();
    var docCount = 0;
    
    Logger.log("📋 출력 폴더의 문서들과 매칭:");
    
    while (docsFiles.hasNext()) {
      var docFile = docsFiles.next();
      var docName = docFile.getName();
      docCount++;
      
      // 매칭 점수 계산
      var matchCount = 0;
      for (var k = 0; k < keyWords.length; k++) {
        if (docName.indexOf(keyWords[k]) !== -1) {
          matchCount++;
        }
      }
      
      var matchPercent = Math.round((matchCount / keyWords.length) * 100);
      var threshold = Math.ceil(keyWords.length / 2);
      var isMatch = matchCount >= threshold;
      
      Logger.log("  " + docCount + ". " + docName);
      Logger.log("      매칭: " + matchCount + "/" + keyWords.length + " (" + matchPercent + "%)");
      Logger.log("      결과: " + (isMatch ? "✅ 매칭됨" : "❌ 매칭 안 됨"));
      Logger.log("");
    }
    
    if (docCount === 0) {
      Logger.log("  ⚠️ 출력 폴더에 문서가 없습니다.");
      Logger.log("  💡 runCompleteProcessInMemory()를 먼저 실행하세요.");
    }
    
  } catch (error) {
    Logger.log("❌ 오류: " + error.message);
  }
}

/**
 * =======================================================================
 * [15] 처리 이력 관리 (Properties Service 사용)
 * =======================================================================
 */

/**
 * 처리 완료 기록 저장
 */
function recordProcessedFile(fileId, fileName, docUrl) {
  try {
    var props = PropertiesService.getScriptProperties();
    
    // 처리 이력 저장 (키: 파일 ID, 값: 문서 URL + 파일명 + 타임스탬프)
    var record = {
      fileName: fileName,
      docUrl: docUrl,
      processedAt: new Date().toISOString()
    };
    
    props.setProperty('processed_' + fileId, JSON.stringify(record));
    
    Logger.log('📝 처리 이력 저장: ' + fileId);
    
  } catch (error) {
    Logger.log('⚠️ 처리 이력 저장 실패: ' + error.message);
  }
}

/**
 * 파일이 처리되었는지 확인
 */
function isFileProcessed(fileId) {
  try {
    var props = PropertiesService.getScriptProperties();
    var record = props.getProperty('processed_' + fileId);
    
    if (record) {
      var data = JSON.parse(record);
      Logger.log('✅ 처리 완료 파일: ' + data.fileName);
      Logger.log('   문서: ' + data.docUrl);
      Logger.log('   처리일: ' + data.processedAt);
      return true;
    }
    
    return false;
    
  } catch (error) {
    Logger.log('⚠️ 처리 이력 확인 실패: ' + error.message);
    return false;
  }
}

/**
 * 모든 처리 이력 보기
 */
function viewAllProcessedFiles() {
  Logger.log("📋 === 모든 처리 이력 ===");
  
  try {
    var props = PropertiesService.getScriptProperties();
    var allProps = props.getProperties();
    var count = 0;
    
    for (var key in allProps) {
      if (key.indexOf('processed_') === 0) {
        count++;
        var fileId = key.replace('processed_', '');
        var data = JSON.parse(allProps[key]);
        
        Logger.log("");
        Logger.log(count + ". 파일: " + data.fileName);
        Logger.log("   ID: " + fileId);
        Logger.log("   문서: " + data.docUrl);
        Logger.log("   처리일: " + data.processedAt);
      }
    }
    
    if (count === 0) {
      Logger.log("⚠️ 처리 이력이 없습니다.");
    } else {
      Logger.log("");
      Logger.log("📊 총 " + count + "개 파일 처리됨");
    }
    
    return count;
    
  } catch (error) {
    Logger.log("❌ 오류: " + error.message);
    return 0;
  }
}

/**
 * 처리 이력 초기화
 */
function clearProcessedHistory() {
  Logger.log("🗑️ === 처리 이력 초기화 ===");
  
  try {
    var props = PropertiesService.getScriptProperties();
    var allProps = props.getProperties();
    var count = 0;
    
    for (var key in allProps) {
      if (key.indexOf('processed_') === 0) {
        props.deleteProperty(key);
        count++;
      }
    }
    
    Logger.log("✅ " + count + "개 이력 삭제됨");
    toast_("처리 이력 초기화 완료");
    
  } catch (error) {
    Logger.log("❌ 오류: " + error.message);
  }
}

/**
 * 메모리 기반 처리 (이력 저장 버전) ✨
 */
function runCompleteProcessInMemory() {
  try {
    Logger.log("🚀 === 메모리 기반 통합 처리 (JSON 파일 생략) ===");
    
    var startTime = new Date();
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    // 1. 처리할 새 파일 찾기
    var newFile = getNextUnprocessedFile();
    
    if (!newFile) {
      Logger.log('✅ 처리할 새로운 파일이 없습니다.');
      toast_('모든 파일 처리 완료!');
      return;
    }
    
    var file = newFile.file;
    var fileId = file.getId();
    var name = newFile.name;
    var baseName = newFile.baseName;
    var fileType = newFile.fileType;
    
    // ✨ 처리 이력 확인
    if (isFileProcessed(fileId)) {
      Logger.log('⚠️ 이미 처리된 파일입니다: ' + name);
      Logger.log('💡 deleteProcessedSourceFiles()로 삭제하세요.');
      return;
    }
    
    Logger.log('🔄 처리 중: ' + name);
    Logger.log('📄 파일 타입: ' + fileType.toUpperCase());
    
    // 파일 내용 읽기
    Logger.log('📖 파일 내용 읽기...');
    var content = file.getBlob().getDataAsString('UTF-8');
    
    if (!content) {
      Logger.log('⚠️ 파일 내용이 비어있음: ' + name);
      return;
    }
    
    // 2. 메모리에서 전처리
    Logger.log('📊 1단계: 전처리 분석 (메모리)');
    
    var preprocessData;
    if (fileType === 'txt') {
      preprocessData = analyzeTxtScript(content);
    } else {
      preprocessData = analyzeHtml(content);
    }
    
    Logger.log('✅ 전처리 완료 (메모리)');
    
    // 3. 설정 가져오기
    var settings = loadRunSettings();
    var apiKey = getAnthropicKey_();
    
    if (!settings) {
      Logger.log("❌ 실행 설정을 가져올 수 없습니다.");
      return;
    }
    
    var seoKeywords = settings.seoKeywords;
    var highlightKeywords = settings.highlightKeywords;
    var weights = settings.weights;
    var templateData = settings.templateData;
    var styleData = settings.styleData;
    
    if (seoKeywords.length === 0 || !apiKey || !templateData || !styleData) {
      Logger.log("❌ 필수 설정이 누락되었습니다.");
      return;
    }
    
    // 4. 메모리에서 SEO 처리
    Logger.log('🎯 2단계: SEO 최적화 처리 (메모리)');
    
    var prompt = createReconstructedPromptWithTemplate(
      preprocessData, 
      weights, 
      seoKeywords, 
      highlightKeywords, 
      templateData, 
      styleData
    );
    
    if (!prompt) {
      Logger.log("❌ 프롬프트 생성 실패");
      return;
    }
    
    // Claude API 호출
    var payload = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      temperature: 0.3,
      system: prompt.system,
      messages: [{
        role: 'user',
        content: prompt.user
      }]
    };
    
    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    var responseCode = response.getResponseCode();
    
    if (responseCode === 429) {
      Logger.log('❌ API 속도 제한. 5분 후에 다시 시도하세요.');
      toast_('API 속도 제한 - 5분 후 재시도');
      return;
    }
    
    if (responseCode < 200 || responseCode >= 300) {
      Logger.log('❌ Claude API 오류 ' + responseCode);
      return;
    }
    
    var jsonResponse = JSON.parse(response.getContentText('UTF-8'));
    var finalContent = jsonResponse.content[0].text;
    
    Logger.log('✅ SEO 처리 완료 (메모리)');
    
    // 5. Google Docs 생성
    Logger.log('📄 3단계: Google Docs 생성');
    
    var docTitle = baseName + "_최종본";
    
    // 제목 추출
    var lines = finalContent.split('\n').map(function(line) { 
      return line.trim(); 
    }).filter(function(line) { 
      return line.length > 0; 
    });
    
    var mainTitle = "";
    
    if (lines.length > 0) {
      var firstLine = lines[0];
      if (firstLine.indexOf('# ') === 0) {
        mainTitle = firstLine.substring(2).trim();
        if (mainTitle.length > 5 && mainTitle.length < 150) {
          docTitle = mainTitle;
          validateAndLogTitle(docTitle, baseName, fileType);
        }
      }
    }
    
    if (!mainTitle) {
      mainTitle = docTitle;
    }
    
    // 문서 생성
    var doc = DocumentApp.create(docTitle);
    
    try {
      var docFile = DriveApp.getFileById(doc.getId());
      docFile.moveTo(docsOutputFolder);
    } catch (moveError) {
      Logger.log('⚠️ 파일 이동 실패: ' + moveError.message);
    }
    
    var docBody = doc.getBody();
    docBody.clear();
    
    // 문서 스타일 설정 (동일한 코드 생략)
    var documentStyle = {};
    documentStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
    documentStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
    documentStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;
    documentStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#000000';
    docBody.setAttributes(documentStyle);
    
    var titleParagraph = docBody.appendParagraph(mainTitle);
    var titleStyle = {};
    titleStyle[DocumentApp.Attribute.FONT_SIZE] = 28;
    titleStyle[DocumentApp.Attribute.BOLD] = true;
    titleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
    titleParagraph.setAttributes(titleStyle);
    titleParagraph.setSpacingAfter(12);
    
    var subtitle = extractSubtitle(finalContent, seoKeywords);
    if (subtitle) {
      var subtitleParagraph = docBody.appendParagraph(subtitle);
      var subtitleStyle = {};
      subtitleStyle[DocumentApp.Attribute.FONT_SIZE] = 16;
      subtitleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#86868b';
      subtitleStyle[DocumentApp.Attribute.ITALIC] = true;
      subtitleParagraph.setAttributes(subtitleStyle);
      subtitleParagraph.setSpacingAfter(24);
    }
    
    addAppleSeparator(docBody);
    
    // 콘텐츠 처리 (동일한 코드 생략 - 이전과 동일)
    var paragraphs = finalContent.split(/\n\n+/);
    var isFirstContent = true;
    
    for (var j = 0; j < paragraphs.length; j++) {
      var text = paragraphs[j].trim();
      if (!text) continue;
      
      if (text.indexOf('# ') === 0 && isFirstContent) {
        isFirstContent = false;
        addFriendlySummaryBox(docBody, seoKeywords);
        continue;
      }
      
      if (text.indexOf('## ') === 0) {
        var headingText = text.substring(3).trim();
        var heading = docBody.appendParagraph(headingText);
        var headingStyle = {};
        headingStyle[DocumentApp.Attribute.FONT_SIZE] = 20;
        headingStyle[DocumentApp.Attribute.BOLD] = true;
        headingStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
        heading.setAttributes(headingStyle);
        heading.setSpacingBefore(32);
        heading.setSpacingAfter(16);
      }
      else if (text.indexOf('### ') === 0) {
        var h3Text = text.substring(4).trim();
        var h3Heading = docBody.appendParagraph(h3Text);
        var h3Style = {};
        h3Style[DocumentApp.Attribute.FONT_SIZE] = 16;
        h3Style[DocumentApp.Attribute.BOLD] = true;
        h3Style[DocumentApp.Attribute.FOREGROUND_COLOR] = '#424245';
        h3Heading.setAttributes(h3Style);
        h3Heading.setSpacingBefore(20);
        h3Heading.setSpacingAfter(8);
      }
      else if (text.includes('[사진') && text.includes(']')) {
        addFriendlyPhotoPlaceholder(docBody, text);
      }
      else {
        if (isKeyPoint(text)) {
          addNaverStyleHighlight(docBody, text);
        } else {
          var paragraph = docBody.appendParagraph(text);
          var paragraphStyle = {};
          paragraphStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
          paragraphStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
          paragraphStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;
          paragraph.setAttributes(paragraphStyle);
          paragraph.setSpacingAfter(16);
          highlightKeywordsNaturally(paragraph, seoKeywords);
        }
      }
    }
    
    addAppleSeparator(docBody);
    addFriendlyClosing(docBody);
    
    var docUrl = doc.getUrl();
    
    Logger.log('✅ Google Docs 생성 완료: ' + docTitle);
    Logger.log('🔗 문서 URL: ' + docUrl);
    
    // ✨✨✨ 6. 처리 이력 저장 ✨✨✨
    recordProcessedFile(fileId, name, docUrl);
    
    // 완료
    var processingTime = (new Date().getTime() - startTime.getTime()) / 1000;
    Logger.log('');
    Logger.log('🎉 통합 처리 완료!');
    Logger.log('⏱️ 처리 시간: ' + Math.round(processingTime) + '초');
    Logger.log('📄 생성된 문서: ' + docTitle);
    Logger.log('🔗 URL: ' + docUrl);
    Logger.log('');
    Logger.log('💡 원본 파일 삭제: deleteProcessedSourceFiles() 실행');
    
    toast_('처리 완료! 원본 삭제는 별도 실행');
    
    return {
      success: true,
      docTitle: docTitle,
      docUrl: docUrl,
      fileId: fileId,
      sourceFile: name
    };
    
  } catch (error) {
    Logger.log('❌ 처리 오류: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 처리 완료된 원본 파일만 삭제 (이력 기반) ✨
 */
function deleteProcessedSourceFiles() {
  try {
    Logger.log("🗑️ === 처리 완료 파일 삭제 (이력 기반) ===");
    
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    var props = PropertiesService.getScriptProperties();
    
    var deletedFiles = [];
    var notDeletedFiles = [];
    
    // 1. 모든 입력 파일 확인
    var inputFiles = inputFolder.getFiles();
    var candidates = [];
    
    while (inputFiles.hasNext()) {
      var file = inputFiles.next();
      var name = file.getName();
      var fileId = file.getId();
      
      var isTxt = /\.txt(의 사본)?$/i.test(name);
      var isHtml = /\.(html?|mhtml|mht)(의 사본)?$/i.test(name);
      
      if (!isTxt && !isHtml) continue;
      
      candidates.push({
        file: file,
        name: name,
        fileId: fileId
      });
    }
    
    Logger.log('📊 입력 폴더 파일: ' + candidates.length + '개');
    
    if (candidates.length === 0) {
      Logger.log('✅ 삭제할 파일이 없습니다.');
      toast_('삭제할 파일 없음');
      return;
    }
    
    // 2. 각 파일의 처리 이력 확인
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      var fileId = candidate.fileId;
      var name = candidate.name;
      var file = candidate.file;
      
      Logger.log('');
      Logger.log('🔍 확인 중: ' + name);
      
      // ✨ 처리 이력 확인
      if (isFileProcessed(fileId)) {
        // 삭제 시도
        try {
          file.setTrashed(true);
          deletedFiles.push(name);
          Logger.log('  ✅ 삭제 완료');
        } catch (deleteError) {
          notDeletedFiles.push({
            name: name,
            error: deleteError.message
          });
          Logger.log('  ❌ 삭제 실패: ' + deleteError.message);
        }
      } else {
        Logger.log('  ⚠️ 아직 처리 안 됨 - 유지');
      }
    }
    
    // 3. 결과 요약
    Logger.log('');
    Logger.log('📊 삭제 결과:');
    Logger.log('  ✅ 삭제 성공: ' + deletedFiles.length + '개');
    Logger.log('  ❌ 삭제 실패: ' + notDeletedFiles.length + '개');
    Logger.log('  ⚠️ 처리 대기: ' + (candidates.length - deletedFiles.length - notDeletedFiles.length) + '개');
    
    if (deletedFiles.length > 0) {
      Logger.log('');
      Logger.log('✅ 삭제된 파일:');
      for (var d = 0; d < deletedFiles.length; d++) {
        Logger.log('  - ' + deletedFiles[d]);
      }
    }
    
    toast_('삭제 완료: ' + deletedFiles.length + '개');
    
    return {
      deleted: deletedFiles,
      notDeleted: notDeletedFiles
    };
    
  } catch (error) {
    Logger.log('❌ 삭제 오류: ' + error.message);
    return null;
  }
}

/**
 * =======================================================================
 * [16] 올인원 처리 함수
 * =======================================================================
 */

/**
 * 문서 생성 + 즉시 원본 파일 삭제 (한 번에 완료)
 */
function processAndDeleteFile() {
  try {
    Logger.log("🚀 === 올인원 처리: 생성 → 삭제 ===");
    
    var startTime = new Date();
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    // 1. 처리할 새 파일 찾기
    var newFile = getNextUnprocessedFile();
    
    if (!newFile) {
      Logger.log('✅ 처리할 새로운 파일이 없습니다.');
      toast_('모든 파일 처리 완료!');
      return null;
    }
    
    var file = newFile.file;
    var fileId = file.getId();
    var name = newFile.name;
    var baseName = newFile.baseName;
    var fileType = newFile.fileType;
    
    // 처리 이력 확인
    if (isFileProcessed(fileId)) {
      Logger.log('⚠️ 이미 처리된 파일입니다: ' + name);
      return null;
    }
    
    Logger.log('🔄 처리 중: ' + name);
    Logger.log('📄 파일 타입: ' + fileType.toUpperCase());
    
    // 2. 파일 내용 읽기
    Logger.log('📖 파일 내용 읽기...');
    var content = file.getBlob().getDataAsString('UTF-8');
    
    if (!content) {
      Logger.log('⚠️ 파일 내용이 비어있음: ' + name);
      return null;
    }
    
    // 3. 전처리
    Logger.log('📊 1단계: 전처리 분석 (메모리)');
    
    var preprocessData;
    if (fileType === 'txt') {
      preprocessData = analyzeTxtScript(content);
    } else {
      preprocessData = analyzeHtml(content);
    }
    
    Logger.log('✅ 전처리 완료');
    
    // 4. 설정 가져오기
    var settings = loadRunSettings();
    var apiKey = getAnthropicKey_();
    
    if (!settings) {
      Logger.log("❌ 실행 설정을 가져올 수 없습니다.");
      return null;
    }
    
    var seoKeywords = settings.seoKeywords;
    var highlightKeywords = settings.highlightKeywords;
    var weights = settings.weights;
    var templateData = settings.templateData;
    var styleData = settings.styleData;
    
    if (seoKeywords.length === 0 || !apiKey || !templateData || !styleData) {
      Logger.log("❌ 필수 설정이 누락되었습니다.");
      return null;
    }
    
    // 5. SEO 처리
    Logger.log('🎯 2단계: SEO 최적화 처리');
    
    var prompt = createReconstructedPromptWithTemplate(
      preprocessData, 
      weights, 
      seoKeywords, 
      highlightKeywords, 
      templateData, 
      styleData
    );
    
    if (!prompt) {
      Logger.log("❌ 프롬프트 생성 실패");
      return null;
    }
    
    // Claude API 호출
    var payload = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      temperature: 0.3,
      system: prompt.system,
      messages: [{
        role: 'user',
        content: prompt.user
      }]
    };
    
    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    var responseCode = response.getResponseCode();
    
    if (responseCode === 429) {
      Logger.log('❌ API 속도 제한. 5분 후에 다시 시도하세요.');
      toast_('API 속도 제한 - 5분 후 재시도');
      return null;
    }
    
    if (responseCode < 200 || responseCode >= 300) {
      Logger.log('❌ Claude API 오류 ' + responseCode);
      return null;
    }
    
    var jsonResponse = JSON.parse(response.getContentText('UTF-8'));
    var finalContent = jsonResponse.content[0].text;
    
    Logger.log('✅ SEO 처리 완료');
    
    // 6. Google Docs 생성
    Logger.log('📄 3단계: Google Docs 생성');
    
    var docTitle = baseName + "_최종본";
    
    // 제목 추출
    var lines = finalContent.split('\n').map(function(line) { 
      return line.trim(); 
    }).filter(function(line) { 
      return line.length > 0; 
    });
    
    var mainTitle = "";
    
    if (lines.length > 0) {
      var firstLine = lines[0];
      if (firstLine.indexOf('# ') === 0) {
        mainTitle = firstLine.substring(2).trim();
        if (mainTitle.length > 5 && mainTitle.length < 150) {
          docTitle = mainTitle;
          validateAndLogTitle(docTitle, baseName, fileType);
        }
      }
    }
    
    if (!mainTitle) {
      mainTitle = docTitle;
    }
    
    // 문서 생성
    var doc = DocumentApp.create(docTitle);
    
    try {
      var docFile = DriveApp.getFileById(doc.getId());
      docFile.moveTo(docsOutputFolder);
    } catch (moveError) {
      Logger.log('⚠️ 파일 이동 실패: ' + moveError.message);
    }
    
    var docBody = doc.getBody();
    docBody.clear();
    
    // 문서 스타일 설정
    var documentStyle = {};
    documentStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
    documentStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
    documentStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;
    documentStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#000000';
    docBody.setAttributes(documentStyle);
    
    var titleParagraph = docBody.appendParagraph(mainTitle);
    var titleStyle = {};
    titleStyle[DocumentApp.Attribute.FONT_SIZE] = 28;
    titleStyle[DocumentApp.Attribute.BOLD] = true;
    titleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
    titleParagraph.setAttributes(titleStyle);
    titleParagraph.setSpacingAfter(12);
    
    var subtitle = extractSubtitle(finalContent, seoKeywords);
    if (subtitle) {
      var subtitleParagraph = docBody.appendParagraph(subtitle);
      var subtitleStyle = {};
      subtitleStyle[DocumentApp.Attribute.FONT_SIZE] = 16;
      subtitleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#86868b';
      subtitleStyle[DocumentApp.Attribute.ITALIC] = true;
      subtitleParagraph.setAttributes(subtitleStyle);
      subtitleParagraph.setSpacingAfter(24);
    }
    
    addAppleSeparator(docBody);
    
    // 콘텐츠 처리
    var paragraphs = finalContent.split(/\n\n+/);
    var isFirstContent = true;
    
    for (var j = 0; j < paragraphs.length; j++) {
      var text = paragraphs[j].trim();
      if (!text) continue;
      
      if (text.indexOf('# ') === 0 && isFirstContent) {
        isFirstContent = false;
        addFriendlySummaryBox(docBody, seoKeywords);
        continue;
      }
      
      if (text.indexOf('## ') === 0) {
        var headingText = text.substring(3).trim();
        var heading = docBody.appendParagraph(headingText);
        var headingStyle = {};
        headingStyle[DocumentApp.Attribute.FONT_SIZE] = 20;
        headingStyle[DocumentApp.Attribute.BOLD] = true;
        headingStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
        heading.setAttributes(headingStyle);
        heading.setSpacingBefore(32);
        heading.setSpacingAfter(16);
      }
      else if (text.indexOf('### ') === 0) {
        var h3Text = text.substring(4).trim();
        var h3Heading = docBody.appendParagraph(h3Text);
        var h3Style = {};
        h3Style[DocumentApp.Attribute.FONT_SIZE] = 16;
        h3Style[DocumentApp.Attribute.BOLD] = true;
        h3Style[DocumentApp.Attribute.FOREGROUND_COLOR] = '#424245';
        h3Heading.setAttributes(h3Style);
        h3Heading.setSpacingBefore(20);
        h3Heading.setSpacingAfter(8);
      }
      else if (text.includes('[사진') && text.includes(']')) {
        addFriendlyPhotoPlaceholder(docBody, text);
      }
      else {
        if (isKeyPoint(text)) {
          addNaverStyleHighlight(docBody, text);
        } else {
          var paragraph = docBody.appendParagraph(text);
          var paragraphStyle = {};
          paragraphStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
          paragraphStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
          paragraphStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;
          paragraph.setAttributes(paragraphStyle);
          paragraph.setSpacingAfter(16);
          highlightKeywordsNaturally(paragraph, seoKeywords);
        }
      }
    }
    
    addAppleSeparator(docBody);
    addFriendlyClosing(docBody);
    
    var docUrl = doc.getUrl();
    
    Logger.log('✅ Google Docs 생성 완료: ' + docTitle);
    Logger.log('🔗 문서 URL: ' + docUrl);
    
    // 7. 처리 이력 저장
    recordProcessedFile(fileId, name, docUrl);
    
    // 8. 원본 파일 즉시 삭제
    Logger.log('');
    Logger.log('🗑️ 4단계: 원본 파일 삭제');
    
    var deleteSuccess = false;
    
    try {
      file.setTrashed(true);
      deleteSuccess = true;
      Logger.log('✅ 원본 파일 삭제 완료: ' + name);
    } catch (deleteError) {
      Logger.log('❌ 삭제 실패: ' + deleteError.message);
      Logger.log('💡 나중에 deleteProcessedSourceFiles()로 삭제하세요.');
    }
    
    // 완료
    var processingTime = (new Date().getTime() - startTime.getTime()) / 1000;
    Logger.log('');
    Logger.log('🎉 올인원 처리 완료!');
    Logger.log('⏱️ 처리 시간: ' + Math.round(processingTime) + '초');
    Logger.log('📄 생성된 문서: ' + docTitle);
    Logger.log('🔗 URL: ' + docUrl);
    Logger.log('🗑️ 원본 파일: ' + (deleteSuccess ? '삭제됨' : '수동 삭제 필요'));
    
    toast_('완료! ' + docTitle);
    
    return {
      success: true,
      docTitle: docTitle,
      docUrl: docUrl,
      sourceFile: name,
      deleted: deleteSuccess,
      processingTime: processingTime
    };
    
  } catch (error) {
    Logger.log('❌ 처리 오류: ' + error.message);
    Logger.log('스택: ' + error.stack);
    toast_('오류 발생: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 모든 파일 연속 처리 (올인원)
 */
function processAllFiles() {
  Logger.log("🚀 === 모든 파일 연속 처리 (올인원) ===");
  
  var processedCount = 0;
  var maxFiles = 10; // 최대 10개
  
  for (var i = 0; i < maxFiles; i++) {
    Logger.log('');
    Logger.log('═══════════════════════════════════');
    Logger.log('📋 파일 ' + (i + 1) + '/' + maxFiles);
    Logger.log('═══════════════════════════════════');
    
    var result = processAndDeleteFile();
    
    if (!result) {
      Logger.log('✅ 더 이상 처리할 파일 없음');
      break;
    }
    
    if (!result.success) {
      Logger.log('❌ 처리 중 오류 발생 - 중단');
      break;
    }
    
    processedCount++;
    
    // API 속도 제한 고려 - 1개 처리 후 중단
    Logger.log('');
    Logger.log('💡 API 속도 제한으로 1개만 처리 후 중단');
    Logger.log('💡 다음 파일을 처리하려면 5분 후에 다시 실행하세요.');
    break;
  }
  
  Logger.log('');
  Logger.log('📊 총 처리: ' + processedCount + '개 파일');
  toast_('처리 완료: ' + processedCount + '개');
  
  return processedCount;
}

/**
 * 하이라이트 타입 자동 감지 (아이콘 결정)
 */
function detectHighlightType(text) {
  var lowerText = text.toLowerCase();
  
  // 비용 관련
  if (lowerText.indexOf('비용') !== -1 || 
      lowerText.indexOf('가격') !== -1 || 
      lowerText.indexOf('만원') !== -1 ||
      lowerText.indexOf('원') !== -1) {
    return { intro: '💰 비용 정보' };
  }
  
  // 팁/노하우
  if (lowerText.indexOf('팁') !== -1 || 
      lowerText.indexOf('노하우') !== -1 || 
      lowerText.indexOf('비결') !== -1) {
    return { intro: '💡 전문가 팁' };
  }
  
  // 결과/성과
  if (lowerText.indexOf('결과') !== -1 || 
      lowerText.indexOf('성과') !== -1 || 
      lowerText.indexOf('효과') !== -1) {
    return { intro: '📊 주요 성과' };
  }
  
  // 주의사항
  if (lowerText.indexOf('주의') !== -1 || 
      lowerText.indexOf('조심') !== -1 || 
      lowerText.indexOf('경고') !== -1) {
    return { intro: '⚠️ 주의사항' };
  }
  
  // 기본값
  return { intro: '🔍 핵심 포인트' };
}

/**
 * 하이라이트 박스 - 배경색 제거 버전 (아이콘만 유지)
 */
function addNaverStyleHighlight(body, text) {
  var detectedType = detectHighlightType(text);
  var intro = detectedType.intro;
  
  // 아이콘 문단 (💡, 💰, 📊 등)
  var introParagraph = body.appendParagraph(intro);
  var introStyle = {};
  introStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
  introStyle[DocumentApp.Attribute.BOLD] = true;
  introStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#007aff';
  introParagraph.setAttributes(introStyle);
  introParagraph.setSpacingAfter(8);
  
  // 본문 문단 (배경색 제거)
  var contentParagraph = body.appendParagraph(text);
  var contentStyle = {};
  contentStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
  contentStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1d1d1f';
  contentStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
  contentStyle[DocumentApp.Attribute.LINE_SPACING] = 1.8;
  contentParagraph.setAttributes(contentStyle);
  contentParagraph.setSpacingAfter(24);
}

/**
 * =======================================================================
 * [NEW] v7 HTML 테이블 레이아웃 전용 함수들
 * =======================================================================
 */

/**
 * [신규] v7 테이블 레이아웃 HTML 프롬프트 생성 - 토큰 압축 버전
 */
function createV7HTMLPrompt(preprocessData, seoKeywords, highlightKeywords, templateData, styleData, geminiContext) {
  var fulltext = preprocessData.fulltext || "";
  var contentOutline = preprocessData.content_outline || [];
  
  // 1. 시트2 스타일 지침 생성
  var styleInstructions = '';
  if (styleData) {
    styleInstructions = '[시트2 스타일]\n' +
      '- 글톤: ' + (styleData.writing_tone || '') + '\n' +
      '- 문장스타일: ' + (styleData.sentence_style || '') + '\n' +
      '- 개인터치: ' + (styleData.personal_touch || '') + '\n' +
      '- 시각풍부도: ' + (styleData.visual_richness || '') + '\n' +
      '- 내러티브플로우: ' + (styleData.narrative_flow || '') + '\n' +
      '- 전문성레벨: ' + (styleData.expertise_level || '') + '\n' +
      '- 평균문장길이: ' + (styleData.avg_sentence_len || '') + '자 내외\n';
  }

  // 2. 시트3 템플릿 구조 지침 생성
  var templateInstructions = '';
  if (templateData) {
    templateInstructions = '[시트3 구조전략]\n' +
      '- 본문 구조: ' + templateData.content_structure + '\n' +
      '- 핵심 강조사항: ' + templateData.key_focus_areas + '\n' +
      '- SEO 운영전략: ' + templateData.seo_strategy + '\n' +
      '- 사진 구성 가이드: ' + templateData.photo_guide_type + '\n';
  }

  var sectionCount = 6;
  var templateName = templateData && templateData.name ? templateData.name : '제품소개형';
  if (templateName.indexOf('시공가이드') !== -1 || templateName.indexOf('트렌드분석') !== -1) {
    sectionCount = 7;
  }

  // 압축된 시스템 프롬프트
  var system = '[역할]\n' +
    '당신은 건축자재 전문 회사의 블로그 담당 직원입니다.\n' +
    '제품 홍보가 목적이며 회사 입장에서 글을 씁니다.\n\n' +
    '[시점 원칙]\n' +
    '- 1인칭 개인 시점 절대 금지 ("제가", "저는", "저도")\n' +
    '- 반드시 회사 시점 사용 ("저희 제품", "저희 회사", "현장에서 확인된")\n' +
    '- 개인 경험담은 회사/제품 중심으로 재해석\n\n' +
    '[수치/사례 원칙]\n' +
    '- 수치, 통계, 사례는 반드시 제공된 데이터 기반만 사용\n' +
    '- 근거 없는 수치 임의 생성 절대 금지\n' +
    '- 데이터 없으면 수치 생략\n\n' +
    styleInstructions + '\n' +
    templateInstructions + '\n' +
    '[출력 형식 - 고정 표준 템플릿]\n' +
    '<table style="width:100%;max-width:720px;margin:0 auto;border-collapse:collapse;font-family:\'Noto Sans KR\',sans-serif;font-size:17px;line-height:1.9;color:#222;">\n\n' +
    '1. 제목: <tr><td style="font-size:28px;font-weight:bold;padding:20px 0 8px 0;">제목</td></tr>\n' +
    '2. 부제목: <tr><td style="color:#777;padding-bottom:30px;">부제목</td></tr>\n' +
    '3. 섹션제목: <tr><td style="font-size:22px;font-weight:bold;padding:40px 0 15px 0;">01. 섹션명</td></tr>\n' +
    '4. 일반문단: <tr><td>본문 내용</td></tr>\n' +
    '5. 특징목록: <tr><td>✓ 특징 항목</td></tr>\n' +
    '6. 사진박스: <tr><td><table style="width:100%;background-color:#f0f0f0;border-collapse:collapse;"><tr><td style="padding:25px;text-align:center;color:#888;">📷 사진 N: 설명</td></tr></table></td></tr>\n' +
    '7. TIP박스: <tr><td style="padding:20px 0;"><table style="width:100%;background-color:#f0f0f0;border-collapse:collapse;"><tr><td style="padding:18px 20px;">💡 <b>TIP</b><br>내용</td></tr></table></td></tr>\n' +
    '8. 비교테이블: 별도 <table> 중첩 (헤더:#222배경 흰글씨, 짝수행:#f9f9f9배경)\n' +
    '9. 마무리: <tr><td style="padding:30px 0;text-align:center;"><b>마무리 질문</b><br>핵심메시지<br>CTA</td></tr>\n\n' +
    '</table>\n\n' +
    '[작성 원칙]\n' +
    '- 섹션별 사진 2개씩 배열\n' +
    '- SEO 키워드 자연스럽게 배치\n' +
    '- HTML 코드만 출력, 설명 절대 금지';

  var geminiStr = '없음';
  if (geminiContext) {
    geminiStr = '- 요약: ' + (geminiContext.summary || '') + '\n' +
                '- 구조: ' + (geminiContext.outline ? geminiContext.outline.join(', ') : '') + '\n' +
                '- 팩트: ' + (geminiContext.key_facts || '') + '\n' +
                '- SEO보완: ' + (geminiContext.seo_addition || '');
  }

  // 압축된 사용자 프롬프트
  var user = '[SEO 키워드]\n' + (seoKeywords.length > 0 ? seoKeywords.join(', ') : '없음') + '\n\n' +
    '[강조 키워드]\n' + (highlightKeywords.length > 0 ? highlightKeywords.join(', ') : '없음') + '\n\n' +
    '[통합 컨텍스트]\n' + geminiStr + '\n\n' +
    '[작성 지시]\n' +
    '- 제목: 25-40자, 숫자/구체성 포함 클릭 유도형\n' +
    '- 형절: ' + sectionCount + '개 섹션 고정 (' + templateName + ' 기준)\n' +
    '- 내용 구조: ' + (templateData && templateData.content_structure ? templateData.content_structure : '자유구성') + '\n' +
    '- 02섹션 부근: 반드시 경쟁사 대비 차별화 포인트 포함 (key_facts/seo_addition 활용)\n' +
    '- 비교테이블 1개 이상 포함\n' +
    '- HTML만 출력';

  return {
    system: system,
    user: user
  };
}

/**
 * [신규] HTML 파일 저장 함수 - Google Docs 대신 HTML 파일 생성
 */
function STEP_D2_SaveAsHTML() {
  try {
    Logger.log("📄 === HTML 파일 생성 (v7 테이블 레이아웃) ===");
    
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var docsOutputFolder = DriveApp.getFolderById(CONFIG.DOCS_OUTPUT_FOLDER_ID);
    
    var newFiles = getNewSEOFilesToDocs();
    
    Logger.log('📊 처리할 새로운 SEO 파일: ' + newFiles.length + '개');
    
    if (newFiles.length === 0) {
      Logger.log('✅ HTML 생성할 새로운 파일이 없습니다.');
      return;
    }
    
    var createdFiles = [];
    
    for (var i = 0; i < newFiles.length; i++) {
      var fileInfo = newFiles[i];
      var baseName = fileInfo.baseName;
      
      Logger.log('🔄 HTML 생성 중: ' + baseName);
      
      try {
        var finalData = JSON.parse(fileInfo.file.getBlob().getDataAsString());
        var content = finalData.content;
        
        if (!content) {
          Logger.log("❌ 콘텐츠가 비어있습니다: " + baseName);
          continue;
        }
        
        // HTML 파일 생성
        var timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'MMdd_HHmm');
        var htmlFileName = baseName + "_최종본_" + timestamp + ".html";
        var htmlBlob = Utilities.newBlob(content, 'application/octet-stream', htmlFileName);
        var htmlFile = docsOutputFolder.createFile(htmlBlob);
        
        createdFiles.push({
          name: htmlFileName,
          url: htmlFile.getUrl(),
          baseName: baseName
        });
        
        Logger.log('✅ HTML 파일 생성 완료: ' + htmlFileName);
        Logger.log('🔗 구글 드라이브 URL: ' + htmlFile.getUrl());
        Logger.log('📍 로컬 경로: ~/Desktop/결과/자동동기화/' + htmlFileName);
        
      } catch (error) {
        Logger.log('❌ ' + baseName + ' HTML 생성 오류: ' + error.message);
      }
    }
    
    Logger.log('🎯 HTML 생성 완료: ' + createdFiles.length + '개 파일');
    toast_('HTML 생성 완료 (' + createdFiles.length + '개) - 바탕화면 [결과] 폴더를 확인하세요!');
    
    return createdFiles;
    
  } catch (error) {
    Logger.log('❌ HTML 생성 오류: ' + error.message);
  }
}

/**
 * [신규] v7 HTML 전용 SEO 처리 함수 - 토큰 압축 버전
 */
function processNextSEOFile_V7HTML(geminiContext) {
  try {
    Logger.log("🔄 === v7 HTML 테이블 레이아웃 SEO 처리 ===");
    
    var nextFileInfo = getNextPreprocessFileToSEO();
    
    if (!nextFileInfo) {
      Logger.log('✅ 처리할 새로운 파일이 없습니다.');
      toast_('모든 파일 처리 완료!');
      return;
    }
    
    var fileInfo = nextFileInfo.file;
    var baseName = fileInfo.baseName;
    var remaining = nextFileInfo.totalRemaining - 1;
    
    Logger.log('🔄 처리 중: ' + baseName);
    
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var seoKeywords = getSEOKeywordsFromC2();
    var highlightKeywords = getHighlightKeywordsFromA2();
    var templateData = getSelectedTemplate();
    var styleData = getStyleDataFromSheet();
    var apiKey = getAnthropicKey_();
    
    if (seoKeywords.length === 0 || !apiKey) {
      Logger.log("❌ SEO 키워드 또는 API 키가 없습니다.");
      return;
    }
    
    // 시트2(스타일) 및 시트3(템플릿) 필드 출력 로그
    Logger.log('📊 [시트2 Style] 글톤:' + styleData.writing_tone + ', 문장스타일:' + styleData.sentence_style + ', 개인터치:' + styleData.personal_touch + ', 시각풍부도:' + styleData.visual_richness + ', 내러티브플로우:' + styleData.narrative_flow + ', 스타일특징:' + styleData.style_features + ', 전문성레벨:' + styleData.expertise_level + ', 평균문장길이:' + styleData.avg_sentence_len);
    Logger.log('📊 [시트3 Template] 구조:' + templateData.content_structure + ', 핵심사항:' + templateData.key_focus_areas + ', SEO전략:' + templateData.seo_strategy + ', 사진구성:' + templateData.photo_guide_type);
    
    // 파일 로드
    var preprocessFiles = jsonOutputFolder.getFilesByName(baseName + "_preprocess.json");
    if (!preprocessFiles.hasNext()) {
      Logger.log("❌ 전처리 파일을 찾을 수 없습니다: " + baseName);
      return;
    }
    
    var preprocessData = JSON.parse(preprocessFiles.next().getBlob().getDataAsString());
    
    // v7 압축 프롬프트 생성
    var prompt = createV7HTMLPrompt(preprocessData, seoKeywords, highlightKeywords, templateData, styleData, geminiContext);
    
    Logger.log('🎯 SEO 키워드: ' + seoKeywords.join(', '));
    Logger.log('💎 강조 키워드: ' + highlightKeywords.join(', '));
    Logger.log('📊 프롬프트 크기: 시스템 ' + prompt.system.length + '자, 사용자 ' + prompt.user.length + '자');
    
    var payload = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      temperature: 0.3,
      system: prompt.system,
      messages: [{
        role: 'user',
        content: prompt.user
      }]
    };

    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var responseCode = response.getResponseCode();
    var responseText = response.getContentText('UTF-8');

    if (responseCode < 200 || responseCode >= 300) {
      Logger.log('❌ Claude API 오류 ' + responseCode + ': ' + responseText);
      return;
    }

    var jsonResponse = JSON.parse(responseText);
    var finalContent = jsonResponse.content[0].text;
    
    // HTML 코드만 추출 (마크다운 코드블록 제거)
    finalContent = finalContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    
    var finalJson = {
      generated_at: new Date().toISOString(),
      baseName: baseName,
      file_type: 'html_v7',
      seo_keywords: seoKeywords,
      highlight_keywords: highlightKeywords,
      template_data: templateData,
      content: finalContent,
      model: payload.model
    };

    var finalFileName = baseName + "_final_seo.json";
    var finalBlob = Utilities.newBlob(
      JSON.stringify(finalJson, null, 2),
      'application/json',
      finalFileName
    );
    jsonOutputFolder.createFile(finalBlob);

    Logger.log('✅ v7 HTML SEO 처리 완료: ' + finalFileName);
    Logger.log('📊 남은 파일: ' + remaining + '개');
    
    toast_('v7 HTML 처리 완료: ' + baseName + ' (남은: ' + remaining + '개)');
    
  } catch (error) {
    Logger.log('❌ v7 SEO 처리 오류: ' + error.message);
  }
}

/**
 * 2단계: Gemini 1.5 Flash 분석 (통합 컨텍스트 생성)
 */
function STEP_B_geminiAnalysis() {
  Logger.log("2️⃣ === Gemini 1.5 Flash 분석 ===");
  try {
    var nextFileInfo = getNextPreprocessFileToSEO();
    if (!nextFileInfo) {
      Logger.log('✅ Gemini 분석을 진행할 파일이 없습니다.');
      return null;
    }
    
    var fileInfo = nextFileInfo.file;
    var preprocessData = JSON.parse(fileInfo.file.getBlob().getDataAsString());
    var fulltext = preprocessData.fulltext || "";
    var seoKeywords = getSEOKeywordsFromC2();
    var searchOption = getSearchOptionFromI2();
    var apiKey = getGeminiKey_();
    
    if (!apiKey) {
      Logger.log("❌ Gemini API 키가 설정되지 않았습니다.");
      return null;
    }
    
    var promptText = "당신은 전문 콘텐츠 분석가입니다.\n\n[원본 글]\n" + fulltext + "\n\n[SEO 키워드]\n" + seoKeywords.join(', ') + "\n\n다음 항목을 추출하여 JSON 형식으로만 반환하세요:\n1. 'summary': 참고글 핵심 요약 (300자 내외)\n2. 'outline': 구조 아웃라인 (5개 이내, 문자열 배열 형식)\n3. 'key_facts': 핵심 수치 및 팩트 (200자 내외)\n4. 'seo_addition': SEO 키워드 기반 최신 보완 정보 (300자 내외)\n\nMarkdown 예시 없이 순수 JSON 객체만 반환할 것.\n\n※ 개인 경험담/전문가 개인 시점은 반드시 회사/제품 중심 시점으로 변환할 것\n예) '제가 경험해보니' -> '현장에서 검증된' / '저는 추천합니다' -> '저희 제품은'";
    
    var payload = {
      contents: [{
        parts: [{ text: promptText }]
      }],
      generationConfig: {
        temperature: 0.3
      }
    };

    if (searchOption === 'Y') {
      Logger.log("🔍 구글 검색 그라운딩 활성화 (JSON 모드 제한, 자체 파싱)");
      payload.tools = [{
        googleSearch: {}
      }];
    } else {
      Logger.log("🧠 분리된 분석 (검색 미사용, JSON 모드 활성화)");
      payload.generationConfig.responseMimeType = "application/json";
    }
    
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.log("❌ Gemini 오류: " + response.getContentText());
      return null;
    }
    
    var responseData = JSON.parse(response.getContentText());
    var geminiText = responseData.candidates[0].content.parts[0].text;
    geminiText = geminiText.replace(/```json\n?/g, "").replace(/\n?```/g, "");
    
    var geminiContext = JSON.parse(geminiText);
    Logger.log("✅ Gemini 분석 완료");
    return geminiContext;
  } catch (e) {
    Logger.log("❌ Gemini 연동 오류: " + e.message);
    return null;
  }
}

/**
 * [신규] v7 HTML 전체 파이프라인 - 전처리부터 HTML 저장까지
 */
function runV7HTMLPipeline() {
  Logger.log("🚀 === v7 HTML 전체 파이프라인 실행 ===");
  
  // JSON 폴더 내 이전 처리 파일 삭제 (_preprocess.json, _final_seo.json)
  try {
    var jsonFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var fileIterator = jsonFolder.getFiles();
    var filesToDelete = [];
    
    // 1. 삭제 대상 파일을 배열에 먼저 수집
    while (fileIterator.hasNext()) {
      var file = fileIterator.next();
      var fileName = file.getName();
      if (fileName.indexOf('_preprocess.json') !== -1 || fileName.indexOf('_final_seo.json') !== -1) {
        filesToDelete.push(file);
      }
    }
    
    // 2. 배열 순회하며 삭제
    var deleteCount = 0;
    for (var i = 0; i < filesToDelete.length; i++) {
      filesToDelete[i].setTrashed(true);
      deleteCount++;
    }
    Logger.log("🗑️ 기존 JSON 파일 삭제 완료: " + deleteCount + "개");
  } catch (e) {
    Logger.log("⚠️ JSON 파일 삭제 중 오류 발생: " + e.message);
  }
  
  try {
    // 1단계: 파일 전처리
    Logger.log("1️⃣ 파일 전처리");
    STEP_A_preprocessFiles();
    
    Utilities.sleep(2000);
    
    // 2단계: Gemini 1.5 Flash 분석
    var geminiContext = STEP_B_geminiAnalysis();
    
    Utilities.sleep(2000);
    
    // 3단계: v7 HTML SEO 처리
    Logger.log("3️⃣ v7 HTML SEO 처리");
    processNextSEOFile_V7HTML(geminiContext);
    
    Utilities.sleep(2000);
    
    // 4단계: HTML 파일 저장
    Logger.log("4️⃣ HTML 파일 저장");
    STEP_D2_SaveAsHTML();
    
    Logger.log("🎯 v7 HTML 파이프라인 완료!");
    toast_('v7 HTML 파이프라인 완료!');
    
  } catch (error) {
    Logger.log("❌ 파이프라인 오류: " + error.message);
    Logger.log("스택: " + error.stack);
  }
}

/**
 * [임시] Gemini API 키 설정 유틸리티 (사용 후 삭제 권장)
 * 주의: "AIza여기에실제키입력" 부분을 실제 발급받은 API 키로 교체 후 한 번만 실행하세요.
 */
function tempSetGeminiKey() {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', 'AIzaSyClek8NG2vhVfvbA8M5Wm1pQnei9XDN7gU');
  Logger.log('완료: GEMINI_API_KEY가 PropertiesService에 등록되었습니다.');
}

/**
 * =======================================================================
 * [NEW] [지시 #002] 사진 매핑 모듈
 * =======================================================================
 */

/**
 * Google Drive 폴더에 업로드된 사진을 글 본문의 [사진N] 홀더에 자동 연결합니다.
 * 
 * @param {string} docContent - [사진1], [사진2] 등의 홀더가 포함된 글 본문 텍스트
 * @param {string} imageFolderId - 사진(01.jpg, 02.jpg 등)이 저장된 Google Drive 폴더 ID
 * @return {string} 사진 URL로 교체된 본문 텍스트
 */
function mapPhotosToPlaceholders(docContent, imageFolderId) {
  if (!docContent) return "";
  if (!imageFolderId) {
    Logger.log("❌ 오류: imageFolderId가 제공되지 않았습니다.");
    return docContent;
  }

  try {
    // 1. Drive 폴더 접근
    var folder = DriveApp.getFolderById(imageFolderId);
    var files = folder.getFiles();
    var photoFiles = [];

    // 2. 파일 수집 (숫자로 시작하는 파일 필터링)
    while (files.hasNext()) {
      var file = files.next();
      var fileName = file.getName();
      if (/^\d+/.test(fileName)) {
        photoFiles.push(file);
      }
    }

    // 3. 파일 이름 번호 순 정렬 (01, 02, 03...)
    photoFiles.sort(function(a, b) {
      var numA = parseInt(a.getName().match(/^\d+/)[0], 10);
      var numB = parseInt(b.getName().match(/^\d+/)[0], 10);
      return numA - numB;
    });

    if (photoFiles.length === 0) {
      Logger.log("⚠️ 경고: 폴더에 매핑할 사진 파일이 없습니다. (01.jpg 형식이 필요합니다)");
      return docContent;
    }

    // 4. 본문 내 홀더 추출 및 교체
    var resultBody = docContent;
    var mappedCount = 0;
    var unmappedHolders = [];
    
    // [사진N] 형태의 모든 홀더 탐색
    var placeholderMatches = docContent.match(/\[사진\s*\d+(?:\s*:[^\]]*)?\]/g) || [];
    // 중복 제거된 고유 홀더 목록 (V8 엔진 기준)
    var uniqueHolders = Array.from(new Set(placeholderMatches)).sort(function(a, b) {
      var numA = parseInt(a.match(/\d+/)[0]);
      var numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

    uniqueHolders.forEach(function(holder) {
      var photoNum = parseInt(holder.match(/\d+/)[0], 10);
      var fileIndex = photoNum - 1; // 1번 사진은 index 0

      if (fileIndex >= 0 && fileIndex < photoFiles.length) {
        var file = photoFiles[fileIndex];
        
        // 파일을 링크가 있는 모든 사용자에게 공개 (보기 권한)
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          // 직링크 URL 생성 (Google Drive 고유 ID 활용)
          var photoUrl = "https://drive.google.com/uc?id=" + file.getId() + "&export=view";
          
          // 본문 내 모든 해당 홀더 교체
          var escapedHolder = holder.replace(/[\[\]]/g, "\\$&"); // [ ] 특수문자 탈출 처리
          var regex = new RegExp(escapedHolder, "g");
          resultBody = resultBody.replace(regex, photoUrl);
          mappedCount++;
        } catch (shareError) {
          Logger.log("❌ 권한 설정 실패: " + file.getName() + " (" + shareError.message + ")");
          unmappedHolders.push(holder);
        }
      } else {
        unmappedHolders.push(holder);
      }
    });

    // 5. 남은 [사진 N: ...] 텍스트 전체 제거 (매핑 여부 관계없이)
    var beforeClean = resultBody;
    resultBody = resultBody.replace(/\[사진\s*\d+[^\]]*\]/g, '');
    var removedCount = (beforeClean.match(/\[사진\s*\d+[^\]]*\]/g) || []).length;

    // 6. 처리 로그 출력
    Logger.log("✅ 사진 매핑 완료: 총 " + mappedCount + "개 교체됨");
    if (removedCount > 0) {
      Logger.log("🗑️ 사진 가이드 텍스트 제거: " + removedCount + "개 ([사진 N: ...] 형식)");
    }
    if (unmappedHolders.length > 0) {
      Logger.log("⚠️ 미매핑 홀더 (" + unmappedHolders.length + "개): " + unmappedHolders.join(", "));
    }

    return resultBody;

  } catch (error) {
    Logger.log("❌ 오류 발생 (mapPhotosToPlaceholders): " + error.message);
    return docContent; // 실패 시 원본 본문 반환
  }
}

/**
 * mapPhotosToPlaceholders 함수 테스트를 위한 더미 데이터 실행 함수
 */
function testMapPhotosToPlaceholders() {
  var dummyContent = "안녕하세요. 제품 리뷰입니다.\n\n[사진1]\n이 제품의 디자인은 위와 같습니다.\n\n[사진2]\n성능 테스트 결과입니다.\n\n[사진3]\n구성품 목록입니다.";
  
  // 테스트를 위해 실제 Google Drive 폴더 ID를 아래에 입력하세요.
  var testFolderId = "1zhLKKQBOAxH1twa-oCdbKB_tS-w5z7A2"; 
  
  if (testFolderId === "PASTE_YOUR_FOLDER_ID_HERE") {
    Logger.log("💡 테스트 안내: testMapPhotosToPlaceholders() 내 testFolderId를 실제 폴더 ID로 수정 후 실행하세요.");
    return;
  }

  Logger.log("🧪 사진 매핑 테스트 시작...");
  var result = mapPhotosToPlaceholders(dummyContent, testFolderId);
  Logger.log("📝 결과 본문 (미리보기 500자):\n" + result.substring(0, 500));
}

/**
 * =======================================================================
 * [NEW] [지시 #003] Blogger HTML 변환 모듈
 * =======================================================================
 */

/**
 * 사진 매핑이 완료된 본문 텍스트를 Blogger 발행용 HTML로 변환합니다.
 * 
 * @param {string} docContent - 사진 매핑(URL 치환)이 완료된 글 본문
 * @param {string} title - 글 제목
 * @return {string} Blogger 에디터용 HTML 코드
 */
function convertToBloggerHTML(docContent, title) {
  if (!docContent) return "";
  
  // HTML 특수문자 이스케이프 함수
  var escapeHtml = function(text) {
    if (!text) return "";
    return text.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  var html = "";
  var tagCount = { h1: 0, h2: 0, p: 0, img: 0, strong: 0 };
  
  // 1. 제목 (H1) - 이스케이프 적용
  html += "<h1 style=\"font-size: 2em; margin-bottom: 0.5em;\">" + escapeHtml(title) + "</h1>\n";
  tagCount.h1++;
  
  // 2. 본문 처리
  var lines = docContent.split('\n');
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    
    // 소제목 (##) -> H2 (내용물만 이스케이프)
    if (line.indexOf('## ') === 0) {
      var h2Text = escapeHtml(line.substring(3).trim());
      html += "<h2 style=\"font-size: 1.5em; margin-top: 1.5em; margin-bottom: 0.5em; color: #333;\">" + h2Text + "</h2>\n";
      tagCount.h2++;
    }
    // 소제목 (###) -> H3
    else if (line.indexOf('### ') === 0) {
      var h3Text = escapeHtml(line.substring(4).trim());
      html += "<h3 style=\"font-size: 1.2em; margin-top: 1.2em; margin-bottom: 0.5em; color: #666;\">" + h3Text + "</h3>\n";
    }
    // 이미지 URL 처리 (Drive URL 패턴 감지) - length 제한 제거
    else if (line.indexOf('https://drive.google.com/uc') !== -1) {
      // 줄에 URL이 포함된 경우 (전체 URL 블록으로 처리)
      // URL 자체의 &는 앰퍼샌드로 인코딩하지 않고 원본 유지 (Blogger 호환성)
      html += "<div style=\"margin: 1em 0;\">\n";
      html += "  <img src=\"" + line + "\" style=\"width: 100%; max-width: 800px; height: auto; display: block; margin: 1em auto;\" />\n";
      html += "</div>\n";
      tagCount.img++;
    }
    // 일반 문단 처리
    else {
      // 1) 텍스트 이스케이프 먼저 수행
      var processedText = escapeHtml(line);
      
      // 2) 강조 텍스트 (**강조**) -> <strong> (태그는 이스케이프 이후 삽입)
      processedText = processedText.replace(/\*\*(.*?)\*\*/g, function(match, p1) {
        tagCount.strong++;
        return "<strong>" + p1 + "</strong>";
      });
      
      html += "<p style=\"line-height: 1.8; margin-bottom: 1.2em; color: #222;\">" + processedText + "</p>\n";
      tagCount.p++;
    }
  }
  
  // 로그 기록
  Logger.log("✅ Blogger HTML 변환 완료 (보안 이스케이프 적용)");
  Logger.log("📊 태그 통계: " + JSON.stringify(tagCount));
  
  return html;
}

/**
 * convertToBloggerHTML 함수 테스트
 */
function testConvertToBloggerHTML() {
  var testTitle = "2026년 건축 트렌드: 친환경 창호의 진화";
  var testContent = "## 1. 개요\n" +
    "올해 가장 주목받는 기술은 **단열 성능**입니다.\n\n" +
    "https://drive.google.com/uc?id=1zhLKKQBOAxH1twa-oCdbKB_tS-w5z7A2&export=view\n\n" +
    "## 2. 주요 특징\n" +
    "**고효율 유리**를 사용하여 에너지를 절약합니다.\n" +
    "### 2.1 세부 사항\n" +
    "프레임의 두께가 얇아지면서 시야가 넓어졌습니다.";
    
  Logger.log("🧪 Blogger HTML 변환 테스트 시작...");
  var resultHtml = convertToBloggerHTML(testContent, testTitle);
  Logger.log("📝 변환된 HTML 결과:\n" + resultHtml);
}

/**
 * =======================================================================
 * [NEW] [지시 #004] Blogger API 발행 모듈
 * =======================================================================
 */

/**
 * 변환된 HTML을 Blogger API v3로 발행하고 결과를 시트에 기록합니다.
 * 
 * @param {string} title - 글 제목
 * @param {string} htmlContent - Blogger용 HTML 본문
 * @param {string[]} labels - 태그 목록 (배열)
 * @return {string} 발행된 글 URL
 */
function publishToBlogger(title, htmlContent, labels, publishMode, scheduledTime) {
  var isDraft = (publishMode === '수동승인');
  var apiUrl = 'https://www.googleapis.com/blogger/v3/blogs/' + BLOG_ID + '/posts/' + (isDraft ? '?isDraft=true' : '');

  try {
    labels = (labels || [])
      .filter(function(l) { return typeof l === 'string' && l.trim() !== ''; })
      .map(function(l) { return l.trim().substring(0, 200); });

    // 1. Blogger API v3 POST 페이로드 구성
    var payload = {
      kind: 'blogger#post',
      blog: { id: BLOG_ID },
      title: title,
      content: htmlContent,
      labels: labels
    };

    // 예약시간이 있으면 published 필드 추가
    if (scheduledTime) {
      payload.published = scheduledTime;
    }

    Logger.log('📢 발행 상태: ' + (isDraft ? 'DRAFT (임시저장)' : 'LIVE (공개)'));
    Logger.log('📢 예약발행: ' + (scheduledTime ? scheduledTime : '즉시 발행'));

    Logger.log('📦 Blogger payload 로그 시작');
    Logger.log('   title: ' + title);
    Logger.log('   content(앞 200자): ' + String(htmlContent || '').substring(0, 200));
    Logger.log('   labels: ' + JSON.stringify(labels || []));
    Logger.log('   payload 전체: ' + JSON.stringify(payload));
    Logger.log('📦 Blogger payload 로그 종료');
    
    // 2. UrlFetchApp 호출 (OAuth 인증 포함)
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    Logger.log('🚀 Blogger API 호출 중 (Blog ID: ' + BLOG_ID + ')...');
    var response = UrlFetchApp.fetch(apiUrl, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    if (responseCode !== 200) {
      Logger.log('❌ Blogger 발행 실패 (응답 코드: ' + responseCode + ')');
      Logger.log('📋 Blogger API 상세 오류 로그 시작');
      Logger.log('   응답 코드: ' + responseCode);
      Logger.log('   응답 전체 내용: ' + responseText);
      Logger.log('📋 Blogger API 상세 오류 로그 종료');
      throw new Error('Blogger API 호출 실패: ' + responseText);
    }
    
    var result = JSON.parse(responseText);
    var postUrl = result.url;

    Logger.log('✅ Blogger 발행 성공!');
    Logger.log('🔗 URL: ' + postUrl);
    Logger.log('📅 API 응답 published: ' + (result.published || '없음'));

    return postUrl;
    
  } catch (error) {
    Logger.log('❌ publishToBlogger 실행 오류: ' + error.message);
    throw error;
  }
}

/**
 * 예약발행 로직 드라이런 - 실제 API 호출 없이 payload 로그만 출력
 */
function dryRunPublish() {
  var scenarios = [
    { label: '시나리오 1 - I열 비움', scheduleRaw: '' },
    { label: '시나리오 2 - I열 = 2026-05-10 10:00', scheduleRaw: '2026-05-10 10:00' }
  ];

  scenarios.forEach(function(scenario) {
    Logger.log('===== ' + scenario.label + ' =====');

    var scheduleRaw = scenario.scheduleRaw;
    var scheduledTime = null;

    if (scheduleRaw) {
      var scheduleDate = (scheduleRaw instanceof Date) ? scheduleRaw : new Date(scheduleRaw);
      if (!isNaN(scheduleDate.getTime())) {
        scheduledTime = scheduleDate.toISOString();
      }
    }

    Logger.log('🕐 I열 원본값: ' + (scheduleRaw ? String(scheduleRaw) : '비어있음'));

    if (!scheduledTime) {
      Logger.log('📅 예약시간: 즉시 발행');
    } else {
      Logger.log('📅 ISO 8601 변환: ' + scheduledTime);
    }

    var payload = {
      kind: 'blogger#post',
      blog: { id: BLOG_ID },
      title: '[드라이런] 테스트 제목',
      content: '<p>테스트</p>',
      labels: ['테스트']
    };
    if (scheduledTime) {
      payload.published = scheduledTime;
    }

    Logger.log('📦 payload.published: ' + (payload.published || '없음 (즉시 발행)'));
    Logger.log('📦 payload 전체: ' + JSON.stringify(payload));
  });

  Logger.log('✅ 드라이런 완료 - API 호출 없음');
}

/**
 * 발행 성공 후 컨트롤 시트의 상태와 URL을 업데이트합니다.
 */
function updateControlSheetAfterPublish(title, postUrl, rowIndex) {
  try {
    var ss = SpreadsheetApp.openById(CONTROL_SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME_MAIN);
    if (!sheet) return;

    if (!rowIndex) {
      var data = sheet.getDataRange().getValues();
      rowIndex = -1;

      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === title) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) rowIndex = 2;
    }

    sheet.getRange(rowIndex, 7).setValue('발행완료');
    sheet.getRange(rowIndex, 9).setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'));
    sheet.getRange(rowIndex, 12).setValue(postUrl);
    
    Logger.log('📊 컨트롤 시트 업데이트 완료 (행: ' + rowIndex + ', 상태: G열, 발행시간: I열, URL: L열)');
    toast_('Blogger 발행 완료 및 시트 업데이트');

  } catch (e) {
    Logger.log('⚠️ 시트 업데이트 중 오류 발생: ' + e.message);
  }
}

/**
 * publishToBlogger 함수 테스트
 */
function testPublishToBlogger() {
  var testTitle = "테스트 발행";
  var testHtml = "<h1>테스트</h1><p>자동 발행 테스트입니다.</p>";
  var testLabels = ["테스트", "자동화"];
  var url = publishToBlogger(testTitle, testHtml, testLabels);
  Logger.log("발행 URL: " + url);
}
