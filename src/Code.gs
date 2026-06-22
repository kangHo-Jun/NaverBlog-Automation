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
  CLAUDE_API_KEY: 'CLAUDE_API_KEY',
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  UNSPLASH_ACCESS_KEY: 'UNSPLASH_ACCESS_KEY',
  GITHUB_TOKEN: 'GITHUB_TOKEN'
};

const EXECUTION_FLAGS = {
  GENERATE_RUNNING: 'GENERATE_RUNNING',
  RUN_ALL_AUTO_RUNNING: 'RUN_ALL_AUTO_RUNNING',
  PUBLISH_RUNNING: 'PUBLISH_RUNNING',
  OPENAI_IMAGE_RUNNING: 'OPENAI_IMAGE_RUNNING'
};

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
  PROCESSED_SOURCE_FOLDER_ID: '1KIex4c3z-g3Kvlf3DoTX-ziUDl_R8-a1', // 글 생성 완료 원본 보관 폴더
  STYLE_ANALYSIS_FOLDER_ID: '1viEjA-r-o6srdtRHMU0t5gm7ucDpp6Cz', // 스타일 분석 전용 폴더 (신규)
  JSON_OUTPUT_FOLDER_ID: '1wr_0xqWOqStu7AFw3NP9RktXA-f7AR0o',  // JSON 파일 다운로드 폴더
  DOCS_OUTPUT_FOLDER_ID: '1u5ZSrhZPLjS4q5jTUdRP-zEdDDNaCY8W'   // 구글독스 파일 다운로드 폴더
};

// 🏠 Blogger 설정
const BLOG_ID = '3911627335922911456';

var CATEGORY_MAP = {
  '석고보드': ['석고', 'gypsum', 'drywall', '천연석고', '방수석고'],
  '목자재': ['목재', '합판', '목문', '도어', 'wood', 'lumber', 'mdf'],
  '단열재': ['단열', '보온', 'insulation', '우레탄', '압출법'],
  '기타': []
};

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏗️ 대산 블로그')
      .addItem('📸 자동생성 모드로 설정', 'setModeAuto_')
      .addItem('📁 직접업로드 모드로 설정', 'setModeManual_')
      .addSeparator()
      .addItem('🚀 전체실행 — 자동생성 (글+이미지+발행)', 'runAll_Auto')
      .addSeparator()
      .addItem('① 글 생성', 'runGenerateOnly')
      .addItem('② 이미지 생성 (OpenAI)', 'generateOpenAIImage')
      .addItem('② 사진 업로드 폴더 열기', 'openUploadFolder_')
      .addItem('③ 발행', 'runPublishOnly')
      .addSeparator()
      .addItem('🔄 초기화 (새 글 시작)', 'resetForNewPost')
      .addToUi();
  } catch (error) {
    Logger.log('⚠️ onOpen UI 생성 스킵: ' + error.message);
  }
}


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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function acquireExecutionFlag_(flagKey, label) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(flagKey)) {
    Logger.log('⛔ 이미 실행 중: ' + label);
    return false;
  }
  props.setProperty(flagKey, new Date().toISOString());
  Logger.log('🔒 실행 잠금 설정: ' + label);
  return true;
}

function releaseExecutionFlag_(flagKey, label) {
  try {
    PropertiesService.getScriptProperties().deleteProperty(flagKey);
    Logger.log('🔓 실행 잠금 해제: ' + label);
  } catch (error) {
    Logger.log('⚠️ 실행 잠금 해제 실패 (' + label + '): ' + error.message);
  }
}

function hasPendingInputOrPreprocess_() {
  var newFiles = getNewFilesToProcess();
  if (newFiles.length > 0) {
    return true;
  }
  return !!getNextPreprocessFileToSEO();
}

/**
 * 저장된 Claude API 키를 가져옵니다.
 */
function getClaudeKey_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_KEYS.CLAUDE_API_KEY) || '';
}

/**
 * 저장된 Gemini API 키를 가져옵니다.
 */
function getGeminiKey_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_KEYS.GEMINI_API_KEY) || '';
}

/**
 * 저장된 Unsplash API 키를 가져옵니다.
 */
function getUnsplashKey_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_KEYS.UNSPLASH_ACCESS_KEY) || '';
}

/**
 * 저장된 GitHub 토큰을 가져옵니다.
 */
function getGithubToken_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_KEYS.GITHUB_TOKEN) || '';
}

function moveSourceFileToProcessedFolder_(fileId) {
  if (!fileId) {
    Logger.log('⚠️ source_file_id가 없어 원본 파일 이동을 건너뜁니다.');
    return false;
  }

  try {
    var sourceFile = DriveApp.getFileById(fileId);
    var targetFolder = DriveApp.getFolderById(CONFIG.PROCESSED_SOURCE_FOLDER_ID);
    sourceFile.moveTo(targetFolder);
    Logger.log('📦 원본 파일 이동 완료: ' + sourceFile.getName() + ' → ' + targetFolder.getName());
    return true;
  } catch (error) {
    Logger.log('⚠️ 원본 파일 이동 실패: ' + error.message);
    return false;
  }
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

function detectCategory_(seoKeywords, highlightKeywords, title) {
  var sourceText = []
    .concat(seoKeywords || [])
    .concat(highlightKeywords || [])
    .concat([title || ''])
    .join(' ')
    .toLowerCase();

  for (var category in CATEGORY_MAP) {
    if (category === '기타') continue;

    var keywords = CATEGORY_MAP[category] || [];
    for (var i = 0; i < keywords.length; i++) {
      if (sourceText.indexOf(String(keywords[i] || '').toLowerCase()) !== -1) {
        Logger.log('📂 카테고리 자동 감지: ' + category + ' / 키워드=' + keywords[i]);
        return category;
      }
    }
  }

  Logger.log('📂 카테고리 자동 감지 실패 → 기타');
  return '기타';
}

function getRelatedBloggerPostsByCategory_(category, currentTitle, maxResults) {
  var normalizedCategory = String(category || '').trim();
  var normalizedTitle = String(currentTitle || '').trim();
  var limit = maxResults || 3;

  if (!normalizedCategory) {
    Logger.log('⚠️ 관련 글 조회 스킵: 카테고리가 비어 있습니다.');
    return [];
  }

  try {
    var apiUrl = 'https://www.googleapis.com/blogger/v3/blogs/' + BLOG_ID +
      '/posts?status=LIVE&fetchBodies=false&labels=' + encodeURIComponent(normalizedCategory) +
      '&maxResults=' + encodeURIComponent(String(limit + 3));
    Logger.log('🔍 관련 글 조회: category=' + normalizedCategory);
    Logger.log('🔍 요청 URL: ' + apiUrl);

    var response = UrlFetchApp.fetch(apiUrl, {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    Logger.log('📡 관련 글 조회 응답 코드: ' + responseCode + ' / 카테고리=' + normalizedCategory);
    if (responseCode < 200 || responseCode >= 300) {
      Logger.log('⚠️ 관련 글 조회 실패: ' + responseText.substring(0, 200));
      return [];
    }

    var responseData = JSON.parse(responseText);
    var items = responseData.items || [];
    Logger.log('🔍 API items 수: ' + items.length);
    var relatedPosts = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var itemTitle = String(item.title || '').trim();
      var itemUrl = String(item.url || '').trim();

      if (!itemTitle || !itemUrl) continue;
      if (itemTitle === normalizedTitle) continue;

      relatedPosts.push({
        title: itemTitle,
        url: itemUrl
      });

      if (relatedPosts.length >= limit) break;
    }

    if (relatedPosts.length === 0) {
      Logger.log('⚠️ 카테고리 관련 글 없음 → 최근 글로 폴백');
      relatedPosts = getRecentLivePosts_(normalizedTitle, limit);
    }

    Logger.log('🔗 최종 관련 글: ' + relatedPosts.length + '개');
    return relatedPosts;
  } catch (error) {
    Logger.log('⚠️ getRelatedBloggerPostsByCategory_ 오류: ' + error.message);
    return [];
  }
}

function getRecentLivePosts_(currentTitle, limit) {
  var normalizedTitle = String(currentTitle || '').trim();
  var maxCount = limit || 3;

  try {
    var apiUrl = 'https://www.googleapis.com/blogger/v3/blogs/' + BLOG_ID +
      '/posts?status=LIVE&fetchBodies=false&maxResults=' + encodeURIComponent(String(maxCount + 3));
    Logger.log('🔍 최근 LIVE 글 폴백 요청 URL: ' + apiUrl);

    var response = UrlFetchApp.fetch(apiUrl, {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    Logger.log('📡 최근 LIVE 글 조회 응답 코드: ' + responseCode);
    if (responseCode < 200 || responseCode >= 300) {
      Logger.log('⚠️ 최근 LIVE 글 조회 실패: ' + responseText.substring(0, 200));
      return [];
    }

    var responseData = JSON.parse(responseText);
    var items = responseData.items || [];
    var recentPosts = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var itemTitle = String(item.title || '').trim();
      var itemUrl = String(item.url || '').trim();

      if (!itemTitle || !itemUrl) continue;
      if (itemTitle === normalizedTitle) continue;

      recentPosts.push({
        title: itemTitle,
        url: itemUrl
      });

      if (recentPosts.length >= maxCount) break;
    }

    Logger.log('🔗 최근 LIVE 글 폴백 결과: ' + recentPosts.length + '개');
    return recentPosts;
  } catch (error) {
    Logger.log('⚠️ getRecentLivePosts_ 오류: ' + error.message);
    return [];
  }
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

    analyzed.source_file_id = f.getId();
    analyzed.source_file_name = name;
    
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
  var genericOutlineScenes = [
    '건식 벽체 시공 작업 사진',
    '실내 벽체 마감 디테일 사진',
    '천연 석고보드 질감 상세 사진',
    '거실 리모델링 진행 사진',
    '실내 벽체 수평 측정 사진',
    '실내 자재 샘플 비교 사진'
  ];
  var genericKeywordScenes = [
    '실내 공기질 문제 상황 사진',
    '친환경 건축자재 질감 확대 사진',
    '리모델링 공구 및 자재 준비 사진',
    '실내 벽체 전후 비교 사진',
    '먼지 적은 시공 환경 사진',
    '건강한 실내 공간 분위기 사진'
  ];
  
  // 템플릿별 사진 유형 분석
  var photoTypes = String(photoGuideType || '').split(',');
  
  // 기본 사진 추가
  if (photoTypes.indexOf('제품외관') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 천연 석고보드 질감 상세 사진]");
    photoIndex++;
  }
  
  if (photoTypes.indexOf('나란히비교') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 벽체 리모델링 전후 비교 사진]");
    photoIndex++;
  }
  
  if (photoTypes.indexOf('도구준비') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 시공 도구 및 자재 준비 사진]");
    photoIndex++;
  }
  
  if (photoTypes.indexOf('트렌드사례') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 최신 인테리어 적용 사례 사진]");
    photoIndex++;
  }
  
  if (photoTypes.indexOf('문제상황') !== -1) {
    photoGuides.push("[사진 " + photoIndex + ": 실내 공기질 문제 상황 사진]");
    photoIndex++;
  }
  
  // 콘텐츠 아웃라인 기반 사진 추가
  for (var i = 0; i < contentOutline.length && photoIndex <= 10; i++) {
    var outlineScene = genericOutlineScenes[i % genericOutlineScenes.length];
    photoGuides.push("[사진 " + photoIndex + ": " + outlineScene + "]");
    photoIndex++;
  }
  
  // SEO 키워드 관련 사진 추가
  for (var j = 0; j < seoKeywords.length && photoIndex <= 12; j++) {
    var keyword = seoKeywords[j];
    if (keyword.length > 2) {
      var keywordScene = genericKeywordScenes[j % genericKeywordScenes.length];
      photoGuides.push("[사진 " + photoIndex + ": " + keywordScene + "]");
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
               '- [사진 X: 한글 설명] 형태로 정확히 표기\n' +
               '- 사진 플레이스홀더 설명은 반드시 한글로 작성하라\n' +
               '- 예) [사진1: 슬림 창호 프레임 상세 사진]\n' +
               '- 예) [사진2: 거실 창호 적용 전경 사진]\n' +
               '- 예) [사진3: 창호 교체 전후 비교 사진]\n' +
               '- 전체 글에 최소 8-12개의 사진 플레이스홀더 포함\n\n' +
               '오프닝 원칙 (매우 중요):\n' +
               '- 첫 문단은 반드시 아래 중 하나로 시작하라:\n' +
               '- 독자의 고통을 찌르는 질문\n' +
               '  예) "창호 바꾸고 나서 \'왜 이걸 진작에 안 했지?\' 하신 분 계세요?"\n' +
               '- 충격적인 숫자나 사실\n' +
               '  예) "7mm. 이 차이 때문에 수억짜리 조망이 반토막 납니다."\n' +
               '- 공감 유발 상황 묘사\n' +
               '  예) "새벽에 베란다 나갈 때마다 발에 걸리는 그 돌출 부분..."\n' +
               '- 절대 배경 설명이나 주제 소개로 시작하지 마라\n\n' +
               '검색 스니펫 최적화 원칙 (매우 중요):\n' +
               '- 첫 문단은 검색 결과 설명문으로 잘려도 이해되게 작성하라\n' +
               '- 첫 문단 길이는 120~160자 내외를 목표로 하라\n' +
               '- 첫 문단 안에 핵심 SEO 키워드 1개 이상을 자연스럽게 포함하라\n' +
               '- 첫 문단 안에 글의 주제, 핵심 이점, 적용 대상이 드러나야 한다\n' +
               '- 첫 문단은 문장형 요약으로 작성하고, 질문만 던지고 끝내지 마라\n' +
               '- 첫 문단에 인용문, 대사, CTA, 과도한 감탄 표현을 넣지 마라\n' +
               '- 첫 문단 다음 문단부터 사례, 인용문, 감정 표현을 확장하라\n\n' +
               'FAQ 생성 원칙 (매우 중요):\n' +
               '- 글 마지막 부분에 FAQ 2~3개를 반드시 생성하라\n' +
               '- FAQ는 본문 핵심 내용만 기반으로 만들어라\n' +
               '- 전문 용어를 피하고 누구나 바로 이해 가능한 표현을 사용하라\n' +
               '- 각 답변은 1~2문장으로 짧고 명확하게 작성하라\n' +
               '- FAQ는 반드시 아래 형식을 지켜라:\n' +
               '- Q. 질문 내용\n' +
               '- A. 답변 내용\n' +
               '- 각 질문 바로 아래에 해당 답변 1개만 배치하라\n' +
               '- FAQ는 관련 글 섹션보다 앞에 오도록 글 말미에 배치하라\n\n' +
               '인간적 문체 원칙:\n' +
               '- 짧은 문장(10자 이하)과 긴 문장(40자 이상) 혼합\n' +
               '- 독자에게 직접 말하는 2인칭 사용 "여러분", "~하셨나요?"\n' +
               '- 전문가 경험담 1인칭 삽입 "제가 현장에서 보면..."\n' +
               '- 반전 표현 사용 "그런데 말입니다", "사실은..."\n' +
               '- 구어체 자연 삽입 "솔직히", "딱 잘라 말하면"\n\n' +
               '**제목 생성 원칙 (매우 중요):**\n' +
               '- 글 맨 앞에 # 제목을 반드시 포함하세요\n' +
               '- 제목 길이: 25-40자 (한글 기준)\n' +
               '- 제목 스타일: 정보 제공형 + 숫자 활용 (예: "2025년 꼭 알아야 할 도어 트렌드 BEST 3")\n' +
               '- 클릭을 유도하되 과장하지 않고 실용적으로\n' +
               '- SEO 키워드를 자연스럽게 포함\n' +
               '- 제목 바로 아래 두 번째 줄에 부제목 추가 (제목과 어울리는 한 줄 설명)\n\n' +
               '절대 금지 표현:\n' +
               '- "~에 대해 알아보겠습니다"\n' +
               '- "~의 중요성은 두말할 필요가 없습니다"\n' +
               '- "결론적으로", "이처럼", "따라서"로 문단 시작\n' +
               '- 모든 소제목을 명사형으로 끝내기\n' +
               '- 숫자 나열 구조 남용 (3가지, 5가지 등)\n\n' +
               '건축자재 약어 해석 규칙 (매우 중요):\n' +
               '- 건축자재 약어를 임의로 해석하거나 확장하지 마라\n' +
               '- 소스 원문에 풀네임이 없으면 약어 그대로 사용하라\n' +
               '- 본문에 없는 자재명 풀네임을 모델 지식으로 보완하지 마라\n' +
               '- 자재명 오류 방지를 위해 아래 예시를 반드시 참고하라:\n' +
               '- PF = Phenolic Foam (Polyurethane Foam 아님)\n' +
               '- PIR = Polyisocyanurate\n' +
               '- XPS = Extruded Polystyrene\n' +
               '- EPS = Expanded Polystyrene\n\n' +
               '[가격 표현 규칙]\n' +
               '- 제공 자료에 없는 원 단위 가격 생성 금지\n' +
               '- 가격 비교는 "상대적으로 낮음/중간/높음", "초기 비용은 높을 수 있음"으로 표현\n' +
               '- % 차이는 제공 자료에 명시된 경우에만 사용\n\n' +
               '[용어 현지화 규칙]\n' +
               '- 영어 참고글 직역 금지\n' +
               '- 국내 건축자재 현장 용어로 변환\n' +
               '- LVB, LVL, MDF, OSB, KS, E0, T, mm, MPa 약어는 그대로 유지\n\n' +
               '[비교표 출력 규칙]\n' +
               '- 두 개 이상 자재/성능/용도 비교 시 반드시 Markdown 테이블 출력\n' +
               '- 헤더 행, 구분선 행, 본문 행 모두 포함\n' +
               '- 테이블 앞뒤 불필요한 빈 줄 금지\n' +
               '- 최소 4개 이상 비교 항목\n' +
               '- 제공 자료 없는 수치 임의 생성 금지\n' +
               '- 수치 근거 없으면 "상대적으로 낮음/높음/조건 확인 필요"로 표현\n\n' +
               '[SEO 키워드 자연어 규칙]\n' +
               '- 지역명+자재명 키워드는 자연어로 풀어써라\n' +
               '- 예: "안양 석고보드" → "안양에서 석고보드를 찾는 경우"\n' +
               '- title, meta_description, tags는 원문 사용 가능\n' +
               '- 본문에서는 자연어 변형 우선\n' +
               '- SEO 키워드를 고유명사처럼 반복하지 마라\n\n' +
               '이미지 전략 및 프롬프트 생성 규칙 (매우 중요):\n' +
               '- 본문 생성 완료 후 반드시 content_type, visual_strategy, imagen_prompts, image2_table_data, fact_safety_check를 JSON으로 함께 출력하라\n' +
               '- 1단계: 아래 9개 유형 중 primary와 secondary를 각각 1개씩 판단하라\n' +
               '  자재비교: 두 자재 이상 구조/성능 비교\n' +
               '  시공실수: 실수/오류/주의 언급\n' +
               '  성능설명: 수치/원리/성능 중심\n' +
               '  구매가이드: 선택기준/추천 중심\n' +
               '  대산브랜딩: 대산 유통/견적/AI 중심\n' +
               '  현장문제해결: 현장 하자/문제 원인 분석\n' +
               '  규격수치설명: 두께/규격/등급 수치 중심\n' +
               '  비용물류판단: 비용/발주/납기/물류 중심\n' +
               '  기준규정설명: 방화/인증/KS/법규 중심\n' +
               '- content_type.reason에는 위 판단 근거를 1문장으로 적어라\n' +
               '- 2단계: primary와 secondary를 바탕으로 visual_strategy를 먼저 설계하라\n' +
               '- visual_strategy.image1과 image2에는 반드시 role, goal, must_include, avoid를 채워라\n' +
               '- role은 이미지의 기능, goal은 독자 교육 목표를 간결히 적어라\n' +
               '- must_include와 avoid는 각각 2개 이상 구체 요소를 적어라\n' +
               '- image1 역할 결정 규칙:\n' +
               '  1. content_type.primary 기준 image1_role_map 값을 그대로 사용한다\n' +
               '  2. Claude가 image1.role을 임의로 창작하거나 변경하지 못한다\n' +
               '  3. secondary_type은 소재/현장조건/비교항목 보강에만 사용한다\n' +
               '- image1_role_map:\n' +
               '  자재비교 -> 재료 구조/적층 차이 단면도 (side by side 레이아웃 필수, 결 방향 표현 유지)\n' +
               '  시공실수 -> 잘못된 시공 흐름도\n' +
               '  성능설명 -> 성능 원리 구조도\n' +
               '  구매가이드 -> 자재 선택 결정 흐름도\n' +
               '  대산브랜딩 -> 기존 유통 vs 대산 유통 구조 비교\n' +
               '  현장문제해결 -> 문제 발생 원인 구조도\n' +
               '  규격수치설명 -> 규격 치수 표시도\n' +
               '  비용물류판단 -> 자재 선택에 따른 비용 구조도\n' +
               '  기준규정설명 -> 기준/인증 적용 범위 구조도\n' +
               '- image2 역할 결정 규칙:\n' +
               '  1. content_type.primary를 먼저 판정하라\n' +
               '  2. image2.role은 반드시 아래 image2_role_map 값을 그대로 사용하라\n' +
               '  3. secondary_type은 image2의 소재/현장맥락/비교항목 보강에만 사용하라\n' +
               '  4. image2.role을 "적용 사례", "시공 장면", "건축물 사례"로 바꾸지 마라\n' +
               '  5. image2는 반드시 표/매트릭스/체크리스트/비교표/흐름도 중 하나여야 한다\n' +
               '  6. image2 프롬프트에는 반드시 selection guide / decision matrix / checklist / comparison table / criteria 중 하나를 포함하라\n' +
               '- image2_role_map:\n' +
               '  자재비교 -> 용도별/현장별 선택 기준표\n' +
               '  시공실수 -> 올바른 시공 순서/체크리스트\n' +
               '  성능설명 -> 조건별(온도/습도/하중) 수치 비교\n' +
               '  구매가이드 -> 현장 유형별 추천 매트릭스\n' +
               '  대산브랜딩 -> AI 견적/즉시 발주/물류 흐름도\n' +
               '  현장문제해결 -> 해결 전/후 비교 또는 점검 포인트\n' +
               '  규격수치설명 -> 수치별 적용 기준 비교표\n' +
               '  비용물류판단 -> 발주/납품/현장 손실 비교표\n' +
               '  기준규정설명 -> 현장별 요구 기준 체크표\n' +
               '- image1 추가 규칙:\n' +
               '  자재비교 유형이면 image1 프롬프트에 반드시 "side by side" 레이아웃을 명시하라\n' +
               '  자재비교 유형이면 각 자재별 결 방향 표현을 유지하라 (예: mixed / parallel / perpendicular grain direction)\n' +
               '- 이미지 내 텍스트 언어 규칙:\n' +
               '  공통 원칙:\n' +
               '  "minimal English labels only" 표현은 사용하지 마라\n' +
               '  허용:\n' +
               '  짧은 한글 라벨: 자재명, 부위명, 조건명, 비교기준, 적합도\n' +
               '  예) 일반합판, 방수석고, 습기환경, 긴스팬, 권장, 주의, 적합\n' +
               '  기술 약어 영문 유지: LVB, LVL, KS, MPa, mm, T, E0\n' +
               '  금지:\n' +
               '  긴 한글 문장\n' +
               '  법규 단정 표현\n' +
               '  구조 계산 단정\n' +
               '  가격/성능 보장 문구\n' +
               '  브랜드 독점 표현\n' +
               '  이미지 유형별 언어 선택 기준:\n' +
               '  선택기준표, 매트릭스, 체크리스트, 비교표, 수치비교표 -> 후처리용 프롬프트\n' +
               '  단면도, 구조도, 원리도, 흐름도 -> 한글 라벨 허용 프롬프트\n' +
               '  image2가 선택기준표/매트릭스/체크리스트/비교표/수치비교표 유형이면 프롬프트 끝 문장을 반드시 아래로 교체하라:\n' +
               '  "Create clean table structure with simple icons, checkmarks (✓), triangles (△), and X marks only. No readable text, no Korean, no English labels. Use blank header areas and placeholder blocks where labels will be added later. Flat technical illustration, clean white background, no people, no brand names."\n' +
               '  image1 또는 단면도/구조도/원리도/흐름도 유형이면 프롬프트 끝 문장을 반드시 아래로 유지하라:\n' +
               '  "Short readable Korean technical labels only, keep standard abbreviations in English/symbols (LVB, LVL, KS, mm, MPa), no long Korean sentences."\n' +
               '  단면도/구조도: Korean labels + English abbreviations\n' +
               '  선택기준표/매트릭스/체크리스트: 후처리용 무문자 구조 프롬프트\n' +
               '  흐름도/원리도: minimal text, icons and arrows preferred, short Korean labels only\n' +
               '  수치비교표: 후처리용 무문자 구조 프롬프트 + 숫자 영역 placeholder\n' +
               '  법규/인증 설명: 한글 최소화, 단정 표현 절대 금지\n' +
               '  보조 표현 적극 사용:\n' +
               '  ◎ 권장 / △ 조건부 / × 비권장\n' +
               '  화살표로 흐름 표현\n' +
               '  체크마크로 적합도 표시\n' +
               '  아이콘으로 조건 구분 (습기, 하중, 비용 등)\n' +
               '- 3단계: visual_strategy를 기반으로 imagen_prompts를 생성하라\n' +
               '- imagen_prompts는 [{image_no: 1, prompt: "..."}, {image_no: 2, prompt: "..."}] 형식으로 출력하라\n' +
               '- 각 prompt는 "현장에서 왜 이 판단이 중요한지"를 시각화해야 한다\n' +
               '- 각 prompt는 Technical illustration, flat design, clean white background, no text, no people 스타일을 유지하라\n' +
               '- 이미지 내 텍스트는 최소화하고 짧은 라벨만 허용하라\n' +
               '- 회사명, 브랜드명, 지역명은 절대 포함하지 마라\n' +
               '- 기준규정설명 유형이 primary 또는 secondary에 포함되면 반드시 "법적 확정 표현 금지. 참고용 구조로만 표현." 규칙을 반영하라\n\n' +
               'image2 표 데이터 생성 규칙:\n' +
               '- image2_table_data는 image2 SVG 직접 생성용 정확한 데이터다\n' +
               '- type은 반드시 "svg_table"로 출력하라\n' +
               '- title, columns, rows, legend, note를 모두 채워라\n' +
               '- columns는 비교 대상 열 이름 배열이다\n' +
               '- rows는 [{"criteria":"기준명","values":["◎","○","△"]}] 형식이다\n' +
               '- rows는 최소 4개 이상 생성하라\n' +
               '- values 길이는 반드시 columns 길이와 같아야 한다\n' +
               '- legend는 표에 실제 사용한 기호만 포함하라\n' +
               '- note는 조건부 판단 문장 1개로 작성하라\n' +
               '- 제공 자료에 없는 가격, 수명, 확률, 성능 수치를 image2_table_data에 넣지 마라\n\n' +
               '자동 검수 규칙:\n' +
               '- fact_safety_check를 반드시 함께 출력하라\n' +
               '- contains_exact_price, contains_unsourced_percent, contains_unsourced_lifespan, contains_awkward_seo_phrase, comparison_sections_use_tables를 모두 boolean으로 채워라\n' +
               '- comparison_sections_use_tables는 자재/성능/용도 비교 섹션이 Markdown 테이블을 사용했는지 기준으로 판단하라\n\n' +
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
             '7. **사진 플레이스홀더**: 각 섹션에 관련성 높은 사진 반드시 포함하고 설명은 한글로 작성\n' +
             '8. **차별화된 관점**: 강조 키워드를 중심으로 한 독특한 시각 제시\n' +
             '9. **행동 유도**: ' + (templateInfo.cta_style || '문의 유도') + ' 방식으로 마무리\n' +
             '10. **FAQ 추가**: 글 마지막 부분에 Q. / A. 형식 FAQ 2~3개를 반드시 포함\n' +
             '11. **가격 표현 제한**: 근거 없는 원 단위 가격 금지, 가격은 상대 표현 우선\n' +
             '12. **현장 용어 우선**: 영어 참고 표현을 국내 현장 용어로 바꾸되 약어는 유지\n' +
             '13. **비교표 강제**: 두 개 이상 자재/성능/용도 비교 시 Markdown 테이블을 반드시 포함\n' +
             '14. **SEO 자연어화**: 지역명+자재명 키워드는 본문에서 자연어 문장으로 풀어쓸 것\n\n' +
             '## 🚫 절대 금지사항\n' +
             '- 파일명을 제목으로 사용하지 마세요\n' +
             '- "[Korean (auto-generated)]" 같은 메타 정보 포함 금지\n' +
             '- 벤치마킹 자료의 단순 복사나 패러프레이즈\n' +
             '- 강조 키워드 누락 또는 부차적 처리\n' +
             '- 템플릿 가이드라인 무시\n' +
             '- "~에 대해 알아보겠습니다" 같은 AI식 서두 사용\n' +
             '- "~의 중요성은 두말할 필요가 없습니다" 같은 상투 표현 사용\n' +
             '- "결론적으로", "이처럼", "따라서"로 문단 시작\n' +
             '- 모든 소제목을 명사형으로 끝내기\n' +
             '- 숫자 나열 구조 남용 (3가지, 5가지 등)\n' +
             '- 사진 플레이스홀더 누락\n\n' +
             '**출력 형식:**\n' +
             '반드시 JSON 객체 하나만 출력하세요. 마크다운 코드블록 금지.\n' +
             '{\n' +
             '  "content": "# [매력적인 제목 25-40자]\\n[한 줄 부제목]\\n\\n## [첫 번째 섹션 제목]\\n[내용]...\\n\\nQ. [질문]\\nA. [답변]",\n' +
             '  "content_type": {\n' +
             '    "primary": "자재비교",\n' +
             '    "secondary": "시공실수",\n' +
             '    "reason": "판단 근거 1문장"\n' +
             '  },\n' +
             '  "visual_strategy": {\n' +
             '    "image1": {\n' +
             '      "role": "역할",\n' +
             '      "goal": "교육 목표",\n' +
             '      "must_include": ["요소1", "요소2"],\n' +
             '      "avoid": ["금지요소1", "금지요소2"]\n' +
             '    },\n' +
             '    "image2": {\n' +
             '      "role": "역할",\n' +
             '      "goal": "교육 목표",\n' +
             '      "must_include": ["요소1", "요소2"],\n' +
             '      "avoid": ["금지요소1", "금지요소2"]\n' +
             '    }\n' +
             '  },\n' +
             '  "imagen_prompts": [\n' +
             '    {"image_no": 1, "prompt": "이미지1 영어 프롬프트"},\n' +
             '    {"image_no": 2, "prompt": "이미지2 영어 프롬프트"}\n' +
             '  ],\n' +
             '  "image2_table_data": {\n' +
             '    "type": "svg_table",\n' +
             '    "title": "표 제목",\n' +
             '    "columns": ["열1", "열2", "열3"],\n' +
             '    "rows": [\n' +
             '      {"criteria": "기준명", "values": ["◎", "○", "△"]}\n' +
             '    ],\n' +
             '    "legend": {"◎": "권장", "○": "적합", "△": "조건부"},\n' +
             '    "note": "실제 선택은 제품 등급, 하중 조건, 현장 환경에 따라 달라질 수 있음"\n' +
             '  },\n' +
             '  "fact_safety_check": {\n' +
             '    "contains_exact_price": false,\n' +
             '    "contains_unsourced_percent": false,\n' +
             '    "contains_unsourced_lifespan": false,\n' +
             '    "contains_awkward_seo_phrase": false,\n' +
             '    "comparison_sections_use_tables": true\n' +
             '  }\n' +
             '}\n' +
             '설명 문장 없이 JSON만 출력하세요.';

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
  Logger.log('🔎 getNextPreprocessFileToSEO 탐색 폴더 ID: ' + CONFIG.JSON_OUTPUT_FOLDER_ID);
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

function getImage2RoleMap_() {
  return {
    '자재비교': '용도별/현장별 선택 기준표',
    '시공실수': '올바른 시공 순서/체크리스트',
    '성능설명': '조건별(온도/습도/하중) 수치 비교',
    '구매가이드': '현장 유형별 추천 매트릭스',
    '대산브랜딩': 'AI 견적/즉시 발주/물류 흐름도',
    '현장문제해결': '해결 전/후 비교 또는 점검 포인트',
    '규격수치설명': '수치별 적용 기준 비교표',
    '비용물류판단': '발주/납품/현장 손실 비교표',
    '기준규정설명': '현장별 요구 기준 체크표'
  };
}

function getImage1RoleMap_() {
  return {
    '자재비교': '재료 구조/적층 차이 단면도',
    '시공실수': '잘못된 시공 흐름도',
    '성능설명': '성능 원리 구조도',
    '구매가이드': '자재 선택 결정 흐름도',
    '대산브랜딩': '기존 유통 vs 대산 유통 구조 비교',
    '현장문제해결': '문제 발생 원인 구조도',
    '규격수치설명': '규격 치수 표시도',
    '비용물류판단': '자재 선택에 따른 비용 구조도',
    '기준규정설명': '기준/인증 적용 범위 구조도'
  };
}

function callClaudeJsonPayload_(apiKey, payload) {
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
    return {
      ok: false,
      type: 'rate_limit',
      message: 'Claude API 속도 제한',
      responseCode: responseCode,
      responseText: responseText
    };
  }

  if (responseCode < 200 || responseCode >= 300) {
    return {
      ok: false,
      type: 'http_error',
      message: 'Claude API 오류 ' + responseCode,
      responseCode: responseCode,
      responseText: responseText
    };
  }

  var jsonResponse = JSON.parse(responseText);
  var rawResponseText = jsonResponse.content[0].text;
  var cleanResponseText = rawResponseText.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();

  try {
    return {
      ok: true,
      rawResponseText: rawResponseText,
      generatedPayload: JSON.parse(cleanResponseText)
    };
  } catch (parseError) {
    return {
      ok: false,
      type: 'parse_error',
      message: parseError.message,
      rawResponseText: rawResponseText
    };
  }
}

function getImagenPromptByNo_(imagenPrompts, imageNo) {
  var prompts = Array.isArray(imagenPrompts) ? imagenPrompts : [];
  for (var i = 0; i < prompts.length; i++) {
    var item = prompts[i] || {};
    if (Number(item.image_no) === Number(imageNo)) {
      return item;
    }
  }
  return null;
}

function getSvgImage2Type_(primaryType) {
  var checklistTypes = {
    '시공실수': true,
    '기준규정설명': true
  };
  var matrixTypes = {
    '자재비교': true,
    '구매가이드': true
  };
  var compareTypes = {
    '성능설명': true,
    '규격수치설명': true,
    '비용물류판단': true,
    '현장문제해결': true,
    '대산브랜딩': true
  };

  if (checklistTypes[primaryType]) return 'checklist';
  if (matrixTypes[primaryType]) return 'matrix';
  if (compareTypes[primaryType]) return 'compare';
  return 'matrix';
}

function buildSvgText_(x, y, text, options) {
  var opts = options || {};
  var fill = opts.fill || '#1a1a1a';
  var size = opts.size || 18;
  var weight = opts.weight || '400';
  var anchor = opts.anchor || 'middle';
  return '<text x="' + x + '" y="' + y + '" fill="' + fill + '" font-size="' + size + '" font-weight="' + weight + '" text-anchor="' + anchor + '" font-family="\'Noto Sans KR\', sans-serif">' +
    escapeHtml(String(text || '')) +
    '</text>';
}

function getMatrixSymbol_(rowIndex, colIndex) {
  var symbols = ['✓', '△', '×'];
  return symbols[(rowIndex + colIndex) % symbols.length];
}

function getMatrixSymbolColor_(symbol) {
  if (symbol === '✓') return '#2c5f8a';
  if (symbol === '△') return '#f5a623';
  return '#e74c3c';
}

function buildSvgTableText_(x, y, width, text, options) {
  var value = String(text || '');
  var maxChars = Math.max(4, Math.floor((width || 120) / 11));
  if (value.length > maxChars) {
    value = value.substring(0, maxChars - 3) + '...';
  }
  return buildSvgText_(x, y, value, options);
}

function generateSvgTableFromData_(visualStrategy, tableData) {
  var image2 = (visualStrategy || {}).image2 || {};
  var normalizedColumns = [];
  var normalizedRows = [];
  var legendKeys = [];
  var legend = tableData.legend || {};
  var headerColor = '#2c5f8a';
  var borderColor = '#cccccc';
  var evenRow = '#f0f4f8';
  var oddRow = '#ffffff';
  var width = 800;
  var marginX = 40;
  var tableWidth = 720;
  var criteriaWidth = 220;
  var parts = [];
  var i;

  for (i = 0; i < tableData.columns.length; i++) {
    var columnName = String(tableData.columns[i] || '').trim();
    if (columnName) normalizedColumns.push(columnName);
  }

  for (i = 0; i < (tableData.rows || []).length; i++) {
    var row = tableData.rows[i] || {};
    var criteria = String(row.criteria || '').trim();
    var values = Array.isArray(row.values) ? row.values : [];
    if (!criteria || values.length !== normalizedColumns.length) continue;
    normalizedRows.push({
      criteria: criteria,
      values: values.map(function(value) {
        return String(value || '').trim() || '-';
      })
    });
  }

  for (var legendKey in legend) {
    if (legend.hasOwnProperty(legendKey)) legendKeys.push(legendKey);
  }

  var rowHeight = 52;
  var headerHeight = 52;
  var titleHeight = 44;
  var noteHeight = 46;
  var legendHeight = legendKeys.length > 0 ? 42 : 0;
  var height = 24 + titleHeight + headerHeight + (normalizedRows.length * rowHeight) + legendHeight + noteHeight + 34;
  var valueWidth = normalizedColumns.length > 0 ? (tableWidth - criteriaWidth) / normalizedColumns.length : tableWidth - criteriaWidth;
  var y = 24;

  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">');
  parts.push('<rect width="100%" height="100%" fill="#ffffff"/>');
  parts.push('<rect x="' + marginX + '" y="' + y + '" width="' + tableWidth + '" height="' + titleHeight + '" rx="8" fill="' + headerColor + '"/>');
  parts.push(buildSvgText_(400, y + 29, tableData.title || image2.role || '선택 기준표', { fill: '#ffffff', size: 22, weight: '700' }));
  y += titleHeight;

  parts.push('<rect x="' + marginX + '" y="' + y + '" width="' + tableWidth + '" height="' + headerHeight + '" fill="' + headerColor + '"/>');
  parts.push('<rect x="' + marginX + '" y="' + y + '" width="' + criteriaWidth + '" height="' + headerHeight + '" fill="' + headerColor + '" stroke="' + borderColor + '"/>');
  parts.push(buildSvgText_(marginX + criteriaWidth / 2, y + 33, '기준', { fill: '#ffffff', size: 18, weight: '700' }));

  for (i = 0; i < normalizedColumns.length; i++) {
    var cellX = marginX + criteriaWidth + (i * valueWidth);
    parts.push('<rect x="' + cellX + '" y="' + y + '" width="' + valueWidth + '" height="' + headerHeight + '" fill="' + headerColor + '" stroke="' + borderColor + '"/>');
    parts.push(buildSvgTableText_(cellX + valueWidth / 2, y + 33, valueWidth, normalizedColumns[i], { fill: '#ffffff', size: 17, weight: '700' }));
  }
  y += headerHeight;

  for (i = 0; i < normalizedRows.length; i++) {
    var fillColor = i % 2 === 0 ? oddRow : evenRow;
    var rowY = y + (i * rowHeight);
    parts.push('<rect x="' + marginX + '" y="' + rowY + '" width="' + tableWidth + '" height="' + rowHeight + '" fill="' + fillColor + '" stroke="' + borderColor + '"/>');
    parts.push('<rect x="' + marginX + '" y="' + rowY + '" width="' + criteriaWidth + '" height="' + rowHeight + '" fill="' + fillColor + '" stroke="' + borderColor + '"/>');
    parts.push(buildSvgTableText_(marginX + 16, rowY + 32, criteriaWidth - 24, normalizedRows[i].criteria, { anchor: 'start', size: 16, weight: '500' }));

    for (var vc = 0; vc < normalizedColumns.length; vc++) {
      var valueX = marginX + criteriaWidth + (vc * valueWidth);
      var cellValue = normalizedRows[i].values[vc];
      parts.push('<rect x="' + valueX + '" y="' + rowY + '" width="' + valueWidth + '" height="' + rowHeight + '" fill="' + fillColor + '" stroke="' + borderColor + '"/>');
      parts.push(buildSvgTableText_(valueX + valueWidth / 2, rowY + 34, valueWidth, cellValue, {
        fill: getMatrixSymbolColor_(cellValue),
        size: cellValue.length <= 2 ? 24 : 15,
        weight: '700'
      }));
    }
  }
  y += normalizedRows.length * rowHeight;

  if (legendKeys.length > 0) {
    parts.push('<rect x="' + marginX + '" y="' + y + '" width="' + tableWidth + '" height="' + legendHeight + '" fill="#ffffff" stroke="' + borderColor + '"/>');
    var legendText = [];
    for (i = 0; i < legendKeys.length; i++) {
      legendText.push(legendKeys[i] + ' ' + String(legend[legendKeys[i]] || '').trim());
    }
    parts.push(buildSvgText_(marginX + 14, y + 27, legendText.join('   '), { anchor: 'start', size: 16, weight: '500' }));
    y += legendHeight;
  }

  parts.push('<rect x="' + marginX + '" y="' + y + '" width="' + tableWidth + '" height="' + noteHeight + '" fill="#f7f9fc" stroke="' + borderColor + '"/>');
  parts.push(buildSvgTableText_(marginX + 14, y + 28, tableWidth - 28, tableData.note || '실제 선택은 현장 조건 확인이 필요합니다.', {
    anchor: 'start',
    size: 14,
    fill: '#4c5a67',
    weight: '400'
  }));
  parts.push('</svg>');
  return parts.join('');
}

function generateImage2AsSvg_(visualStrategy, primaryType, tableData) {
  if (tableData && Array.isArray(tableData.columns) && Array.isArray(tableData.rows) && tableData.columns.length > 0 && tableData.rows.length > 0) {
    return generateSvgTableFromData_(visualStrategy, tableData);
  }

  var strategy = visualStrategy || {};
  var image2 = strategy.image2 || {};
  var mustInclude = Array.isArray(image2.must_include) ? image2.must_include : [];
  var rows = mustInclude.length > 0 ? mustInclude.slice(0, 8) : ['조건1', '조건2', '조건3'];
  var svgType = getSvgImage2Type_(primaryType);
  var width = 800;
  var height = 600;
  var headerColor = '#2c5f8a';
  var borderColor = '#cccccc';
  var evenRow = '#f0f4f8';
  var oddRow = '#ffffff';
  var y = 70;
  var parts = [];
  var i;

  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">');
  parts.push('<rect width="100%" height="100%" fill="#ffffff"/>');
  parts.push('<rect x="40" y="24" width="720" height="44" rx="8" fill="' + headerColor + '"/>');
  parts.push(buildSvgText_(400, 53, image2.role || '비교표', { fill: '#ffffff', size: 22, weight: '700' }));

  if (svgType === 'matrix') {
    var matrixCols = ['조건', 'LVB', 'LVL', '합판'];
    var matrixX = [40, 260, 420, 580];
    var matrixWidths = [220, 160, 160, 180];
    parts.push('<rect x="40" y="' + y + '" width="720" height="52" fill="' + headerColor + '"/>');
    for (i = 0; i < matrixCols.length; i++) {
      parts.push('<rect x="' + matrixX[i] + '" y="' + y + '" width="' + matrixWidths[i] + '" height="52" fill="' + headerColor + '" stroke="' + borderColor + '"/>');
      parts.push(buildSvgText_(matrixX[i] + matrixWidths[i] / 2, y + 33, matrixCols[i], { fill: '#ffffff', size: 18, weight: '700' }));
    }
    y += 52;
    for (i = 0; i < rows.length; i++) {
      var fillColor = i % 2 === 0 ? oddRow : evenRow;
      parts.push('<rect x="40" y="' + y + '" width="720" height="56" fill="' + fillColor + '" stroke="' + borderColor + '"/>');
      parts.push('<rect x="40" y="' + y + '" width="220" height="56" fill="' + fillColor + '" stroke="' + borderColor + '"/>');
      parts.push(buildSvgText_(58, y + 34, rows[i], { anchor: 'start', size: 17, weight: '500' }));
      for (var mc = 1; mc < matrixCols.length; mc++) {
        var symbol = getMatrixSymbol_(i, mc);
        parts.push('<rect x="' + matrixX[mc] + '" y="' + y + '" width="' + matrixWidths[mc] + '" height="56" fill="' + fillColor + '" stroke="' + borderColor + '"/>');
        parts.push(buildSvgText_(matrixX[mc] + matrixWidths[mc] / 2, y + 36, symbol, { fill: getMatrixSymbolColor_(symbol), size: 26, weight: '700' }));
      }
      y += 56;
    }
  } else if (svgType === 'checklist') {
    parts.push('<rect x="40" y="' + y + '" width="560" height="52" fill="' + headerColor + '"/>');
    parts.push('<rect x="600" y="' + y + '" width="160" height="52" fill="' + headerColor + '"/>');
    parts.push(buildSvgText_(320, y + 33, '항목', { fill: '#ffffff', size: 18, weight: '700' }));
    parts.push(buildSvgText_(680, y + 33, '판단', { fill: '#ffffff', size: 18, weight: '700' }));
    y += 52;
    for (i = 0; i < rows.length; i++) {
      var checkFill = i % 2 === 0 ? oddRow : evenRow;
      var checkSymbol = getMatrixSymbol_(i, 0);
      parts.push('<rect x="40" y="' + y + '" width="560" height="60" fill="' + checkFill + '" stroke="' + borderColor + '"/>');
      parts.push('<rect x="600" y="' + y + '" width="160" height="60" fill="' + checkFill + '" stroke="' + borderColor + '"/>');
      parts.push(buildSvgText_(58, y + 36, rows[i], { anchor: 'start', size: 18, weight: '500' }));
      parts.push(buildSvgText_(680, y + 38, checkSymbol, { fill: getMatrixSymbolColor_(checkSymbol), size: 28, weight: '700' }));
      y += 60;
    }
  } else {
    var compareCols = ['항목', '기준A', '기준B', '판단'];
    var compareX = [40, 290, 460, 610];
    var compareWidths = [250, 170, 150, 150];
    parts.push('<rect x="40" y="' + y + '" width="720" height="52" fill="' + headerColor + '"/>');
    for (i = 0; i < compareCols.length; i++) {
      parts.push('<rect x="' + compareX[i] + '" y="' + y + '" width="' + compareWidths[i] + '" height="52" fill="' + headerColor + '" stroke="' + borderColor + '"/>');
      parts.push(buildSvgText_(compareX[i] + compareWidths[i] / 2, y + 33, compareCols[i], { fill: '#ffffff', size: 18, weight: '700' }));
    }
    y += 52;
    for (i = 0; i < rows.length; i++) {
      var compareFill = i % 2 === 0 ? oddRow : evenRow;
      var compareSymbol = getMatrixSymbol_(i, 1);
      parts.push('<rect x="40" y="' + y + '" width="720" height="56" fill="' + compareFill + '" stroke="' + borderColor + '"/>');
      parts.push('<rect x="40" y="' + y + '" width="250" height="56" fill="' + compareFill + '" stroke="' + borderColor + '"/>');
      parts.push('<rect x="290" y="' + y + '" width="170" height="56" fill="' + compareFill + '" stroke="' + borderColor + '"/>');
      parts.push('<rect x="460" y="' + y + '" width="150" height="56" fill="' + compareFill + '" stroke="' + borderColor + '"/>');
      parts.push('<rect x="610" y="' + y + '" width="150" height="56" fill="' + compareFill + '" stroke="' + borderColor + '"/>');
      parts.push(buildSvgText_(56, y + 34, rows[i], { anchor: 'start', size: 17, weight: '500' }));
      parts.push(buildSvgText_(375, y + 34, '■ ■ ■', { size: 16, fill: '#8c98a4' }));
      parts.push(buildSvgText_(535, y + 34, '■ ■', { size: 16, fill: '#8c98a4' }));
      parts.push(buildSvgText_(685, y + 36, compareSymbol, { fill: getMatrixSymbolColor_(compareSymbol), size: 26, weight: '700' }));
      y += 56;
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

function validateImage1PromptPayload_(generatedPayload) {
  var payload = generatedPayload || {};
  var contentType = payload.content_type || {};
  var primaryType = String(contentType.primary || '').trim();
  var visualStrategy = payload.visual_strategy || {};
  var image1 = visualStrategy.image1 || {};
  var image1Role = String(image1.role || '').trim();
  var image1PromptObj = getImagenPromptByNo_(payload.imagen_prompts, 1) || {};
  var image1Prompt = String(image1PromptObj.prompt || '').toLowerCase();
  var image1RoleMap = getImage1RoleMap_();
  var expectedRole = String(image1RoleMap[primaryType] || '').trim();
  var badKeywords = ['construction site', 'installation scene', 'building exterior'];
  var structureKeywords = ['cross-section', 'sectional', 'cutaway', 'diagram', 'flowchart', 'structure', 'layer', 'layered', 'schematic'];
  var hasStructureConcept = false;
  var hasBadOnlyConcept = false;
  var i;

  if (!primaryType) {
    return { ok: false, message: 'content_type.primary 누락' };
  }

  if (!expectedRole) {
    return { ok: false, message: 'image1 role map 미정의 유형: ' + primaryType };
  }

  if (!(image1Role.indexOf(expectedRole) !== -1 || expectedRole.indexOf(image1Role) !== -1)) {
    return { ok: false, message: 'image1.role 불일치: expected=' + expectedRole + ', actual=' + image1Role };
  }

  for (i = 0; i < structureKeywords.length; i++) {
    if (image1Prompt.indexOf(structureKeywords[i]) !== -1) {
      hasStructureConcept = true;
      break;
    }
  }

  for (i = 0; i < badKeywords.length; i++) {
    if (image1Prompt.indexOf(badKeywords[i]) !== -1 && !hasStructureConcept) {
      hasBadOnlyConcept = true;
      break;
    }
  }

  if (primaryType === '자재비교') {
    if (image1Prompt.indexOf('side by side') === -1) {
      return { ok: false, message: '자재비교인데 image1에 side by side 없음' };
    }
    if (image1Prompt.indexOf('grain direction') === -1) {
      return { ok: false, message: '자재비교인데 image1에 grain direction 표현 없음' };
    }
  }

  if (hasBadOnlyConcept) {
    return { ok: false, message: 'image1 prompt가 현장 장면 위주이고 구조 개념이 없음' };
  }

  return { ok: true };
}

function validateImage2PromptPayload_(generatedPayload) {
  var payload = generatedPayload || {};
  var contentType = payload.content_type || {};
  var primaryType = String(contentType.primary || '').trim();
  var visualStrategy = payload.visual_strategy || {};
  var image2 = visualStrategy.image2 || {};
  var image2Role = String(image2.role || '').trim();
  var image2MustInclude = Array.isArray(image2.must_include) ? image2.must_include : [];
  var image2PromptObj = getImagenPromptByNo_(payload.imagen_prompts, 2) || {};
  var image2Prompt = String(image2PromptObj.prompt || '').toLowerCase();
  var image2RoleMap = getImage2RoleMap_();
  var expectedRole = String(image2RoleMap[primaryType] || '').trim();
  var validKeywords = ['selection guide', 'decision matrix', 'checklist', 'comparison table', 'criteria', 'matrix', 'guide'];
  var badKeywords = ['적용 사례', '시공 장면', '건축물 사례', 'installation', 'construction site', 'building frame'];
  var hasValidKeyword = false;
  var isBadRole = false;
  var i;

  if (!primaryType) {
    return { ok: false, message: 'content_type.primary 누락' };
  }

  if (!expectedRole) {
    return { ok: false, message: 'image2 role map 미정의 유형: ' + primaryType };
  }

  if (!(image2Role.indexOf(expectedRole) !== -1 || expectedRole.indexOf(image2Role) !== -1)) {
    return { ok: false, message: 'image2.role 불일치: expected=' + expectedRole + ', actual=' + image2Role };
  }

  for (i = 0; i < validKeywords.length; i++) {
    if (image2Prompt.indexOf(validKeywords[i]) !== -1) {
      hasValidKeyword = true;
      break;
    }
  }

  for (i = 0; i < badKeywords.length; i++) {
    if (image2Prompt.indexOf(String(badKeywords[i]).toLowerCase()) !== -1 && !hasValidKeyword) {
      isBadRole = true;
      break;
    }
  }

  if (primaryType === '자재비교' && image2Prompt.indexOf('selection guide') === -1) {
    return { ok: false, message: '자재비교인데 image2에 selection guide 없음' };
  }

  if (!hasValidKeyword || isBadRole) {
    return { ok: false, message: 'image2 prompt 키워드 규칙 위반' };
  }

  if (image2MustInclude.length < 3) {
    return { ok: false, message: 'image2.must_include 비교 기준 3개 미만' };
  }

  var image2TableData = payload.image2_table_data || {};
  if (!Array.isArray(image2TableData.columns) || image2TableData.columns.length === 0) {
    return { ok: false, message: 'image2_table_data.columns 누락' };
  }
  if (!Array.isArray(image2TableData.rows) || image2TableData.rows.length < 4) {
    return { ok: false, message: 'image2_table_data.rows 4개 미만' };
  }

  return { ok: true };
}

function regenerateImagePromptPayload_(apiKey, payload, reason) {
  var retryPayload = JSON.parse(JSON.stringify(payload));
  var originalUserContent = String(retryPayload.messages[0].content || '');

  retryPayload.messages[0].content = originalUserContent +
    '\n\n[재생성 보정 지시]\n' +
    '직전 응답의 이미지 전략이 아래 이유로 검증 실패했다: ' + reason + '\n' +
    '- image1.role은 반드시 image1_role_map의 primary 기준값과 정확히 일치시켜라\n' +
    '- image1이 construction site / installation scene / building exterior 위주로 흐르지 않게 하고, 단면도/흐름도/구조도 개념을 유지하라\n' +
    '- primary가 자재비교라면 image1 프롬프트에는 반드시 "side by side"를 넣어라\n' +
    '- primary가 자재비교라면 image1 프롬프트에는 각 자재의 결 방향 표현을 유지하라\n' +
    '- image2.role은 반드시 image2_role_map의 primary 기준값과 정확히 일치시켜라\n' +
    '- image2는 적용 사례/시공 장면/건축물 사례가 아니라 비교표, 체크리스트, 매트릭스, 흐름도여야 한다\n' +
    '- image2 프롬프트에는 selection guide / decision matrix / checklist / comparison table / criteria 중 하나를 반드시 포함하라\n' +
    '- image2.must_include는 3개 이상의 비교 기준을 포함하라\n' +
    '- image2_table_data는 반드시 유지하고, columns/rows/legend/note를 모두 채워라\n' +
    '- 설명 없이 JSON만 다시 출력하라';

  Logger.log('🔁 image2 검증 실패 재생성 시도: ' + reason);
  return callClaudeJsonPayload_(apiKey, retryPayload);
}

function debugPreprocessFiles() {
  Logger.log('🔍 === preprocess 파일 디버그 ===');
  Logger.log('📁 탐색 폴더 ID: ' + CONFIG.JSON_OUTPUT_FOLDER_ID);

  try {
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var files = jsonOutputFolder.getFiles();
    var preprocessFiles = [];

    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();

      if (!/\_preprocess\.json$/i.test(name)) continue;

      preprocessFiles.push({
        name: name,
        updatedAt: file.getLastUpdated().getTime()
      });
    }

    if (preprocessFiles.length === 0) {
      Logger.log('⚠️ _preprocess.json 파일이 없습니다.');
      return [];
    }

    preprocessFiles.sort(function(a, b) {
      return a.updatedAt - b.updatedAt;
    });

    Logger.log('📋 _preprocess.json 파일 목록: ' + preprocessFiles.length + '개');
    for (var i = 0; i < preprocessFiles.length; i++) {
      var item = preprocessFiles[i];
      Logger.log('  ' + (i + 1) + '. ' + item.name + ' (' + new Date(item.updatedAt).toLocaleString() + ')');
    }

    return preprocessFiles;
  } catch (error) {
    Logger.log('❌ debugPreprocessFiles 오류: ' + error.message);
    Logger.log('❌ debugPreprocessFiles 스택: ' + error.stack);
    return [];
  }
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
    var apiKey = getClaudeKey_();
    
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

    var claudeResult = callClaudeJsonPayload_(apiKey, payload);

    if (!claudeResult.ok && claudeResult.type === 'rate_limit') {
      Logger.log('❌ 여전히 속도 제한입니다. 5분 후에 다시 시도하세요.');
      Logger.log('💡 또는 Claude API 사용량을 업그레이드하세요.');
      return;
    }

    if (!claudeResult.ok && claudeResult.type === 'http_error') {
      Logger.log('❌ ' + claudeResult.message + ': ' + claudeResult.responseText);
      return;
    }

    if (!claudeResult.ok && claudeResult.type === 'parse_error') {
      Logger.log('❌ Claude 응답 JSON 파싱 실패: ' + claudeResult.message);
      Logger.log('🧪 Claude 원본 응답(앞 500자): ' + String(claudeResult.rawResponseText || '').substring(0, 500));
      markGenerateErrorStatus_('Claude JSON 파싱 실패');
      return;
    }

    var rawResponseText = claudeResult.rawResponseText;
    var generatedPayload = claudeResult.generatedPayload;
    var finalContent = String(generatedPayload.content || '').trim();

    if (!finalContent) {
      Logger.log('❌ Claude 응답 JSON에 content가 없습니다.');
      Logger.log('🧪 Claude 원본 응답(앞 500자): ' + rawResponseText.substring(0, 500));
      markGenerateErrorStatus_('Claude JSON content 누락');
      throw new Error('Claude 응답 JSON에 content가 없습니다.');
    }

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
      source_file_id: preprocessData.source_file_id || '',
      source_file_name: preprocessData.source_file_name || '',
      file_type: fileType,
      seo_keywords: seoKeywords,
      highlight_keywords: highlightKeywords,
      template_data: templateData,
      style_data: styleData,
      weights: weights,
      photo_guides: prompt.photoGuides,
      content: finalContent,
      content_type: generatedPayload.content_type || {},
      visual_strategy: generatedPayload.visual_strategy || {},
      imagen_prompts: Array.isArray(generatedPayload.imagen_prompts) ? generatedPayload.imagen_prompts : [],
      image2_table_data: generatedPayload.image2_table_data || {},
      fact_safety_check: generatedPayload.fact_safety_check || {},
      model: payload.model
    };

    var finalFileName = baseName + "_final_seo.json";
    var finalBlob = Utilities.newBlob(
      JSON.stringify(finalJson, null, 2),
      'application/json',
      finalFileName
    );
    var savedFinalFile = jsonOutputFolder.createFile(finalBlob);

    var image1Validation = validateImage1PromptPayload_(generatedPayload);
    var image2Validation = validateImage2PromptPayload_(generatedPayload);
    var retryReason = '';
    if (!image1Validation.ok) retryReason += 'image1: ' + image1Validation.message;
    if (!image2Validation.ok) retryReason += (retryReason ? ' / ' : '') + 'image2: ' + image2Validation.message;

    if (retryReason) {
      Logger.log('⚠️ 이미지 프롬프트 검증 실패 → 재생성 필요: ' + retryReason);
      Logger.log('💾 검증 실패 전 _final_seo.json 선저장 완료: ' + finalFileName);
      markGenerateRetryStatus_(retryReason);

      var retryResult = regenerateImagePromptPayload_(apiKey, payload, retryReason);
      if (!retryResult.ok && retryResult.type === 'rate_limit') {
        Logger.log('❌ 이미지 프롬프트 재생성 중 Claude 속도 제한');
        return;
      }
      if (!retryResult.ok && retryResult.type === 'http_error') {
        Logger.log('❌ 이미지 프롬프트 재생성 Claude API 오류: ' + retryResult.responseText);
        return;
      }
      if (!retryResult.ok && retryResult.type === 'parse_error') {
        Logger.log('❌ 이미지 프롬프트 재생성 JSON 파싱 실패: ' + retryResult.message);
        Logger.log('🧪 Claude 재생성 원본 응답(앞 500자): ' + String(retryResult.rawResponseText || '').substring(0, 500));
        markGenerateErrorStatus_('이미지 프롬프트 재생성 JSON 파싱 실패');
        return;
      }

      rawResponseText = retryResult.rawResponseText;
      generatedPayload = retryResult.generatedPayload;
      finalContent = String(generatedPayload.content || '').trim();
      if (!finalContent) {
        Logger.log('❌ 이미지 프롬프트 재생성 응답 JSON에 content가 없습니다.');
        Logger.log('🧪 Claude 재생성 원본 응답(앞 500자): ' + String(rawResponseText || '').substring(0, 500));
        markGenerateErrorStatus_('이미지 프롬프트 재생성 content 누락');
        return;
      }

      image1Validation = validateImage1PromptPayload_(generatedPayload);
      image2Validation = validateImage2PromptPayload_(generatedPayload);
      retryReason = '';
      if (!image1Validation.ok) retryReason += 'image1: ' + image1Validation.message;
      if (!image2Validation.ok) retryReason += (retryReason ? ' / ' : '') + 'image2: ' + image2Validation.message;
      if (retryReason) {
        Logger.log('⚠️ 이미지 프롬프트 재생성 후에도 검증 실패: ' + retryReason);
        markGenerateRetryStatus_(retryReason);
        return;
      }

      finalJson.content = finalContent;
      finalJson.content_type = generatedPayload.content_type || {};
      finalJson.visual_strategy = generatedPayload.visual_strategy || {};
      finalJson.imagen_prompts = Array.isArray(generatedPayload.imagen_prompts) ? generatedPayload.imagen_prompts : [];
      finalJson.image2_table_data = generatedPayload.image2_table_data || {};
      finalJson.fact_safety_check = generatedPayload.fact_safety_check || {};
      savedFinalFile.setContent(JSON.stringify(finalJson, null, 2));
      Logger.log('✅ 재생성 결과로 _final_seo.json 업데이트 완료: ' + finalFileName);
      Logger.log('✅ 이미지 프롬프트 재생성 후 검증 통과');
    }

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

function getGeneratedSeoFileById_(fileId) {
  if (!fileId) return null;
  try {
    return DriveApp.getFileById(fileId);
  } catch (error) {
    Logger.log('⚠️ getGeneratedSeoFileById_ 실패: ' + error.message);
    return null;
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

  var values = sheet.getRange(2, 1, lastRow - 1, 17).getValues();

  for (var i = 0; i < values.length; i++) {
    var publishMode = String(values[i][5] || '').trim();
    if (publishMode !== '자동' && publishMode !== '수동승인') continue;
    var bloggerUrl = String(values[i][8] || '').trim();
    if (bloggerUrl) continue; // I열 URL 있으면 이미 발행완료 → 스킵
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

function markGenerateErrorStatus_(message) {
  try {
    var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
    var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);
    if (!sheet) return;

    var targetRow = getPublishControlRow_(sheet);
    var rowIndex = targetRow && targetRow.rowIndex ? targetRow.rowIndex : 2;
    sheet.getRange(rowIndex, 7).setValue('오류');
    Logger.log('📛 생성 오류 상태 기록 완료 (행: ' + rowIndex + ', 메시지: ' + String(message || '').substring(0, 100) + ')');
  } catch (error) {
    Logger.log('⚠️ 생성 오류 상태 기록 실패: ' + error.message);
  }
}

function markGenerateRetryStatus_(message) {
  try {
    var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
    var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);
    if (!sheet) return;

    var targetRow = getPublishControlRow_(sheet);
    var rowIndex = targetRow && targetRow.rowIndex ? targetRow.rowIndex : 2;
    sheet.getRange(rowIndex, 7).setValue('이미지재생성');
    Logger.log('🔁 이미지재생성 상태 기록 완료 (행: ' + rowIndex + ', 메시지: ' + String(message || '').substring(0, 120) + ')');
  } catch (error) {
    Logger.log('⚠️ 이미지재생성 상태 기록 실패: ' + error.message);
  }
}

function ensurePublishControlHeaders_(sheet) {
  if (!sheet) return;

  var imageSourceHeader = String(sheet.getRange(1, 10).getValue() || '').trim();
  if (imageSourceHeader !== '이미지소스') {
    sheet.getRange(1, 10).setValue('이미지소스');
    Logger.log('🧩 시트1 J1 헤더를 "이미지소스"로 설정했습니다.');
  }
  sheet.getRange('J2:J').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['자동생성', '직접업로드'], true)
      .setAllowInvalid(false)
      .build()
  );

  if (String(sheet.getRange(1, 12).getValue() || '').trim()) {
    sheet.getRange(1, 12).clearContent();
  }

  var image1OpenAiHeader = String(sheet.getRange(1, 13).getValue() || '').trim();
  if (image1OpenAiHeader !== 'image1_url') {
    sheet.getRange(1, 13).setValue('image1_url');
    Logger.log('🧩 시트1 M1 헤더를 "image1_url"로 설정했습니다.');
  }

  if (String(sheet.getRange(1, 14).getValue() || '').trim()) {
    sheet.getRange(1, 14).clearContent();
  }

  var uploadFolderUrlHeader = String(sheet.getRange(1, 15).getValue() || '').trim();
  if (uploadFolderUrlHeader !== '업로드폴더URL') {
    sheet.getRange(1, 15).setValue('업로드폴더URL');
    Logger.log('🧩 시트1 O1 헤더를 "업로드폴더URL"로 설정했습니다.');
  }

  var requiredPhotoCountHeader = String(sheet.getRange(1, 16).getValue() || '').trim();
  if (requiredPhotoCountHeader !== '필요사진수') {
    sheet.getRange(1, 16).setValue('필요사진수');
    Logger.log('🧩 시트1 P1 헤더를 "필요사진수"로 설정했습니다.');
  }

  var fileGuideHeader = String(sheet.getRange(1, 17).getValue() || '').trim();
  if (fileGuideHeader !== '파일명가이드') {
    sheet.getRange(1, 17).setValue('파일명가이드');
    Logger.log('🧩 시트1 Q1 헤더를 "파일명가이드"로 설정했습니다.');
  }

  var image2SvgHeader = String(sheet.getRange(1, 18).getValue() || '').trim();
  if (image2SvgHeader !== 'image2_svg_url') {
    sheet.getRange(1, 18).setValue('image2_svg_url');
    Logger.log('🧩 시트1 R1 헤더를 "image2_svg_url"로 설정했습니다.');
  }
}

function getHeaderColumnIndex_(sheet, headerName) {
  if (!sheet || !headerName) return 0;
  var lastColumn = Math.max(sheet.getLastColumn(), 18);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim() === headerName) {
      return i + 1;
    }
  }
  return 0;
}

function writeToControlSheet_(headerName, value, rowIndex) {
  var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);
  if (!sheet) {
    throw new Error('시트1을 찾을 수 없습니다.');
  }

  ensurePublishControlHeaders_(sheet);
  var targetRowIndex = rowIndex || (getPublishControlRow_(sheet) || {}).rowIndex || 2;
  var columnIndex = getHeaderColumnIndex_(sheet, headerName);
  if (!columnIndex) {
    throw new Error('헤더를 찾지 못했습니다: ' + headerName);
  }

  sheet.getRange(targetRowIndex, columnIndex).setValue(value);
}

function buildDriveFolderUrl_(folderId) {
  return 'https://drive.google.com/drive/folders/' + folderId;
}

function applyImageModeHeaderStyles_(sheet, mode) {
  if (!sheet) return;

  var navy = '#2c5f8a';
  var green = '#2d7a4f';
  var gray = '#cccccc';
  var white = '#ffffff';
  var autoCols = [13, 18];
  var manualCols = [15, 16, 17];
  var activeAutoColor = mode === '자동생성' ? navy : gray;
  var activeManualColor = mode === '직접업로드' ? green : gray;
  var i;

  for (i = 0; i < autoCols.length; i++) {
    sheet.getRange(1, autoCols[i]).setBackground(activeAutoColor).setFontColor(white);
  }
  for (i = 0; i < manualCols.length; i++) {
    sheet.getRange(1, manualCols[i]).setBackground(activeManualColor).setFontColor(white);
  }
}

function countNumberedImageFiles_(imageFolder) {
  if (!imageFolder) return 0;

  var files = imageFolder.getFiles();
  var count = 0;
  while (files.hasNext()) {
    var file = files.next();
    if (/^\d+/.test(String(file.getName() || ''))) {
      count++;
    }
  }
  return count;
}

function getManualImageFileSummary_(imageFolder) {
  var summary = {
    validCount: 0,
    invalidCount: 0,
    invalidNames: [],
    totalCount: 0
  };

  if (!imageFolder) return summary;

  var files = imageFolder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var fileName = String(file.getName() || '').trim();
    if (!fileName) continue;

    summary.totalCount++;
    if (/^\d+/.test(fileName)) {
      summary.validCount++;
    } else {
      summary.invalidCount++;
      summary.invalidNames.push(fileName);
    }
  }

  return summary;
}

function extractDriveFolderIdFromUrl_(folderUrl) {
  var match = String(folderUrl || '').match(/\/folders\/([^\/\?\#]+)/);
  return match ? match[1] : '';
}

function storeAutoGeneratedImageUrls_(sheet, rowIndex, image1Url, svgUrl) {
  if (!sheet || !rowIndex) return;
  if (image1Url) {
    sheet.getRange(rowIndex, 13).setValue(image1Url);
  }
  if (svgUrl) {
    sheet.getRange(rowIndex, 18).setValue(svgUrl);
  }
}

function getImageSourceFromControlRow_(controlRow) {
  if (!controlRow || !controlRow.values) {
    return '';
  }

  var imageSource = String(controlRow.values[9] || '').trim();
  if (imageSource === '자동생성') return '자동생성';
  if (imageSource === '직접업로드') return '직접업로드';
  return '';
}

function getControlRowValues_(sheet, rowIndex) {
  if (!sheet) return null;
  var targetRow = rowIndex || 2;
  return {
    rowIndex: targetRow,
    values: sheet.getRange(targetRow, 1, 1, 18).getValues()[0]
  };
}

function validateRequiredControlSettings_(sheet, rowIndex) {
  var controlRow = getControlRowValues_(sheet, rowIndex || 2);
  if (!controlRow || !controlRow.values) {
    return {
      ok: false,
      rowIndex: rowIndex || 2,
      message: '시트 설정값을 읽을 수 없습니다.'
    };
  }

  var values = controlRow.values;
  var missing = [];
  if (!String(values[0] || '').trim()) missing.push('A열 강조키워드');
  if (!String(values[2] || '').trim()) missing.push('C열 검색최적화키워드');

  var publishMode = String(values[5] || '').trim();
  if (publishMode !== '자동' && publishMode !== '수동승인') {
    missing.push('F열 발행모드');
  }

  var imageSource = String(values[9] || '').trim();
  if (imageSource !== '자동생성' && imageSource !== '직접업로드') {
    missing.push('J열 이미지소스');
  }

  return {
    ok: missing.length === 0,
    rowIndex: controlRow.rowIndex,
    message: missing.length === 0
      ? ''
      : '다음 설정값을 확인하세요.\n- ' + missing.join('\n- ')
  };
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

function setImageSourceMode_(mode, message) {
  var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);
  if (!sheet) {
    throw new Error('시트1을 찾을 수 없습니다.');
  }

  ensurePublishControlHeaders_(sheet);
  sheet.getRange(2, 10).setValue(mode);
  applyImageModeHeaderStyles_(sheet, mode);
  SpreadsheetApp.getUi().alert(message);
}

function setModeAuto_() {
  setImageSourceMode_('자동생성', '자동생성 모드: OpenAI image1 + SVG image2 자동 생성');
}

function setModeManual_() {
  setImageSourceMode_('직접업로드', '직접업로드 모드: Drive 폴더에 사진을 직접 업로드하세요');
}

function processAutoImage_(finalData, imageFolder) {
  var controlRow = getPublishControlRow_(SpreadsheetApp.openById(CONTROL_SHEET_ID).getSheetByName(SHEET_NAME_MAIN));
  var storedOpenAiUrl = String((controlRow && controlRow.values ? controlRow.values[12] : '') || '').trim();
  var imagenPrompts = Array.isArray(finalData.imagen_prompts) ? finalData.imagen_prompts : [];
  var prompt1 = '';
  var primaryType = String(((finalData.content_type || {}).primary) || '').trim();
  var title = extractTitleFromContent_(finalData.content, finalData.baseName);
  var generatedImage1;
  var generatedImage2;

  for (var ip = 0; ip < imagenPrompts.length; ip++) {
    var item = imagenPrompts[ip] || {};
    var imageNo = Number(item.image_no);
    var promptText = String(item.prompt || item.text || '').trim();
    if (imageNo === 1 && promptText) prompt1 = promptText;
  }

  Logger.log('🧾 imagen_prompts.prompt1: ' + (prompt1 || '없음'));
  Logger.log('🧾 image2 SVG primaryType: ' + (primaryType || '없음'));

  if (!prompt1) {
    throw new Error('final_seo.json의 image1 prompt가 비어 있습니다. runGenerateOnly()를 다시 실행하세요.');
  }

  if (!storedOpenAiUrl) {
    throw new Error('M열 image1_url이 비어 있습니다. 메뉴에서 "🤖 OpenAI 이미지 생성"을 먼저 실행하세요.');
  }
  generatedImage1 = {
    fileName: 'image1_openai.png',
    mimeType: 'image/png',
    publicUrl: storedOpenAiUrl,
    responseCode: 200
  };
  Logger.log('✅ 저장된 image1 OpenAI URL 사용: ' + storedOpenAiUrl);

  var image2Svg = generateImage2AsSvg_(finalData.visual_strategy, primaryType, finalData.image2_table_data);
  var image2FileName = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss') + '_' +
    String(title || 'image').substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '_') + '_02.svg';
  var image2Blob = Utilities.newBlob(image2Svg, 'image/svg+xml', image2FileName);
  var image2Url = uploadBlobToGitHub_(image2Blob, image2FileName);
  generatedImage2 = {
    fileName: image2FileName,
    mimeType: 'image/svg+xml',
    publicUrl: image2Url,
    responseCode: 200
  };

  if (!generatedImage1 || !generatedImage2) {
    throw new Error('image1/image2 생성 실패: 2장의 이미지가 모두 생성되지 않았습니다.');
  }

  Logger.log('✅ image1 OpenAI + image2 SVG 생성 완료');
  Logger.log('🔗 01 URL: ' + generatedImage1.publicUrl);
  Logger.log('🔗 02.svg URL: ' + generatedImage2.publicUrl);

  return {
    mappedContent: mapGeneratedImageUrlsToPlaceholders_(finalData.content, [generatedImage1, generatedImage2]),
    generatedImages: [generatedImage1, generatedImage2]
  };
}

function processUnsplashImage_(finalData, imageFolder) {
  var title = extractTitleFromContent_(finalData.content, finalData.baseName);
  var placeholders = extractPhotoPlaceholders_(finalData.content);
  var downloadedPhotos = downloadUnsplashPhotosToFolder_(finalData.content, finalData, title, imageFolder);

  Logger.log('🧾 Unsplash 저장 결과 수: ' + downloadedPhotos.length);
  if (placeholders.length > 0 && downloadedPhotos.length === 0) {
    throw new Error('Unsplash 이미지 저장 0건: 플레이스홀더는 존재하지만 Drive 저장에 실패했습니다. 로그의 검색어/응답 코드를 확인하세요.');
  }

  return {
    mappedContent: mapPhotosToPlaceholders(finalData.content, imageFolder.getId(), finalData, title),
    downloadedPhotos: downloadedPhotos
  };
}

function processManualImage_(finalData, imageFolder) {
  var title = extractTitleFromContent_(finalData.content, finalData.baseName);
  return {
    mappedContent: mapManualPhotosToPlaceholders_(finalData.content, imageFolder.getId(), finalData, title)
  };
}

/**
 * 완전 통합 처리 함수 - 전처리 → SEO → 사진 매핑 → HTML 변환 → Blogger 발행
 */
function runGenerateOnly() {
  var startTime = new Date().getTime();
  var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);
  var statusRowIndex = 2;
  if (sheet) {
    ensurePublishControlHeaders_(sheet);
    var statusControlRow = getPublishControlRow_(sheet);
    statusRowIndex = statusControlRow && statusControlRow.rowIndex ? statusControlRow.rowIndex : 2;
  }
  if (!acquireExecutionFlag_(EXECUTION_FLAGS.GENERATE_RUNNING, 'runGenerateOnly')) {
    updatePublishStatus_(sheet, statusRowIndex, '대기중');
    toast_('글 생성이 이미 실행 중입니다. 잠시 후 다시 시도하세요.');
    return {
      success: false,
      status: 'already_running'
    };
  }

  try {
    Logger.log("🚀 === 1단계: 글 생성 전용 실행 ===");
    var settingsValidation = validateRequiredControlSettings_(sheet, statusRowIndex);
    if (!settingsValidation.ok) {
      updatePublishStatus_(sheet, statusRowIndex, '오류');
      SpreadsheetApp.getUi().alert(
        '⚠️ 시트 설정값 확인 필요\n\n' + settingsValidation.message
      );
      return {
        success: false,
        status: 'invalid_settings',
        error: settingsValidation.message
      };
    }

    updatePublishStatus_(sheet, statusRowIndex, '글생성중');
    if (!hasPendingInputOrPreprocess_()) {
      updatePublishStatus_(sheet, statusRowIndex, '대기중');
      toast_('입력 폴더에 처리할 파일이 없습니다. 새 HTML, TXT, PDF 파일을 먼저 업로드하세요.');
      return {
        success: false,
        status: 'no_input'
      };
    }

    runFullPipelineOneByOne();

    var generatedFile = getLatestGeneratedSeoFile_();
    if (!generatedFile) {
      Logger.log('⚠️ runGenerateOnly 완료 후 생성된 _final_seo.json 파일을 찾지 못했습니다.');
      Logger.log('📁 확인 대상 폴더 ID: ' + CONFIG.JSON_OUTPUT_FOLDER_ID);
      toast_('글 생성 실패: SEO 결과 파일이 생성되지 않았습니다. 키워드/API 키를 확인하세요.');
      return {
        success: false,
        status: 'generate_failed',
        error: '_final_seo.json not found'
      };
    }

    Logger.log('📄 runGenerateOnly 생성 파일명: ' + generatedFile.getName());
    Logger.log('📁 runGenerateOnly 저장 폴더 ID: ' + CONFIG.JSON_OUTPUT_FOLDER_ID);
    var generatedJson = JSON.parse(generatedFile.getBlob().getDataAsString());
    Logger.log('🖼️ 저장된 imagen_prompts 수: ' + ((generatedJson.imagen_prompts || []).length));
    Logger.log('🧾 image2_table_data 생성 여부: ' + !!(generatedJson.image2_table_data && generatedJson.image2_table_data.columns && generatedJson.image2_table_data.rows));
    Logger.log('🧾 fact_safety_check 생성 여부: ' + !!generatedJson.fact_safety_check);

    try {
      var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
      var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);
      if (sheet) {
        ensurePublishControlHeaders_(sheet);
        var controlRow = getPublishControlRow_(sheet);
        var rowIndex = controlRow && controlRow.rowIndex ? controlRow.rowIndex : 2;
        var imageSource = getImageSourceFromControlRow_(controlRow);
        var imagenPrompts = Array.isArray(generatedJson.imagen_prompts) ? generatedJson.imagen_prompts : [];
        var prompt1 = '';
        for (var ip = 0; ip < imagenPrompts.length; ip++) {
          var item = imagenPrompts[ip] || {};
          if (Number(item.image_no) === 1) {
            prompt1 = String(item.prompt || item.text || '').trim();
            break;
          }
        }

        if (imageSource === '자동생성') {
          if (prompt1) {
            var title = extractTitleFromContent_(generatedJson.content, generatedJson.baseName);
            var primaryType = String(((generatedJson.content_type || {}).primary) || '').trim();
            var image2Svg = generateImage2AsSvg_(generatedJson.visual_strategy, primaryType, generatedJson.image2_table_data);
            var image2FileName = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss') + '_' +
              String(title || 'image').substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '_') + '_02.svg';
            var image2Blob = Utilities.newBlob(image2Svg, 'image/svg+xml', image2FileName);
            var image2SvgUrl = uploadBlobToGitHub_(image2Blob, image2FileName);

            storeAutoGeneratedImageUrls_(
              sheet,
              rowIndex,
              image2SvgUrl || ''
            );
            Logger.log('🖼️ image2 SVG 후보 URL: ' + (image2SvgUrl || '없음'));
          } else {
            Logger.log('⚠️ runGenerateOnly: image1 prompt가 없어 R열 SVG URL 저장을 건너뜁니다.');
          }
        } else if (imageSource === '직접업로드') {
          var manualTitle = extractTitleFromContent_(generatedJson.content, generatedJson.baseName);
          var manualImageFolder = createImageFolderForPost_(manualTitle);
          var folderUrl = buildDriveFolderUrl_(manualImageFolder.getId());
          var placeholders = extractPhotoPlaceholders_(generatedJson.content);
          var requiredCount = placeholders.length;
          var photoGuides = Array.isArray(generatedJson.photo_guides) ? generatedJson.photo_guides : [];
          var fileGuide = photoGuides.map(function(guide, i) {
            var desc = String(guide || '')
              .replace(/\[사진\s*\d+:\s*/, '')
              .replace(/\]$/, '')
              .trim();
            return (i + 1).toString().padStart(2, '0') + '.jpg → ' + desc;
          }).join('\n');

          writeToControlSheet_('업로드폴더URL', folderUrl, rowIndex);
          writeToControlSheet_('필요사진수', requiredCount, rowIndex);
          writeToControlSheet_('파일명가이드', fileGuide, rowIndex);
          Logger.log('🗂️ 직접업로드 안내 기록 완료: ' + folderUrl);
        }
      }
    } catch (imagePrepError) {
      Logger.log('⚠️ runGenerateOnly image1 후보 생성 실패: ' + imagePrepError.message);
    }

    moveSourceFileToProcessedFolder_(generatedJson.source_file_id);

    updatePublishStatus_(sheet, statusRowIndex, '발행준비');
    Logger.log('✅ 발행 준비 완료. runPublishOnly() 실행하세요');
    toast_('발행 준비 완료. runPublishOnly() 실행하세요');
    Logger.log('⏱️ runGenerateOnly 소요시간: ' + ((new Date().getTime() - startTime) / 1000).toFixed(1) + '초');

    return {
      success: true,
      status: 'generated',
      seoFileId: generatedFile.getId(),
      seoFileName: generatedFile.getName()
    };
  } catch (error) {
    Logger.log("❌ 글 생성 전용 실행 오류: " + error.message);
    updatePublishStatus_(sheet, statusRowIndex, '오류');
    toast_("글 생성 중 오류 발생: " + error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    releaseExecutionFlag_(EXECUTION_FLAGS.GENERATE_RUNNING, 'runGenerateOnly');
  }
}

function generateOpenAIImageOnly_(seoFileId) {
  var startTime = new Date().getTime();
  var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);
  var statusRowIndex = 2;
  if (sheet) {
    ensurePublishControlHeaders_(sheet);
    var statusControlRow = getPublishControlRow_(sheet);
    statusRowIndex = statusControlRow && statusControlRow.rowIndex ? statusControlRow.rowIndex : 2;
  }
  if (!acquireExecutionFlag_(EXECUTION_FLAGS.OPENAI_IMAGE_RUNNING, 'generateOpenAIImageOnly_')) {
    updatePublishStatus_(sheet, statusRowIndex, '발행준비');
    SpreadsheetApp.getActiveSpreadsheet().toast('⚠️ OpenAI 이미지 생성이 이미 실행 중입니다.', '대산 블로그', 5);
    return {
      success: false,
      status: 'already_running'
    };
  }

  try {
    Logger.log('🤖 === OpenAI 이미지 단독 생성 시작 ===');
    updatePublishStatus_(sheet, statusRowIndex, '이미지생성중');

    var seoFile = getGeneratedSeoFileById_(seoFileId) || getLatestGeneratedSeoFile_();
    if (!seoFile) {
      throw new Error('_final_seo.json 파일을 찾지 못했습니다. runGenerateOnly()를 먼저 실행하세요.');
    }

    var finalData = JSON.parse(seoFile.getBlob().getDataAsString());
    var imagenPrompts = Array.isArray(finalData.imagen_prompts) ? finalData.imagen_prompts : [];
    var prompt1 = '';
    for (var i = 0; i < imagenPrompts.length; i++) {
      var item = imagenPrompts[i] || {};
      if (Number(item.image_no) === 1) {
        prompt1 = String(item.prompt || item.text || '').trim();
        break;
      }
    }

    if (!prompt1) {
      throw new Error('final_seo.json의 image1 prompt가 비어 있습니다. runGenerateOnly()를 다시 실행하세요.');
    }

    var title = extractTitleFromContent_(finalData.content, finalData.baseName);
    var imageFolder = createImageFolderForPost_(title);
    var openAiFileName = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss') + '_' +
      String(title || 'image').substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '_') + '_01_openai.png';
    var openAiImage1 = generateImageWithOpenAI_(prompt1, imageFolder.getId(), openAiFileName);

    if (!openAiImage1 || !openAiImage1.publicUrl) {
      throw new Error('OpenAI image1 생성 또는 업로드에 실패했습니다.');
    }

    if (!sheet) {
      throw new Error('시트1을 찾을 수 없습니다.');
    }
    ensurePublishControlHeaders_(sheet);
    var controlRow = getPublishControlRow_(sheet);
    var rowIndex = controlRow && controlRow.rowIndex ? controlRow.rowIndex : 2;
    writeToControlSheet_('image1_url', openAiImage1.publicUrl, rowIndex);

    updatePublishStatus_(sheet, rowIndex, '이미지생성완료');
    Logger.log('🖼️ image1 OpenAI URL 저장 완료: ' + openAiImage1.publicUrl);
    Logger.log('⏱️ generateOpenAIImageOnly_ 소요시간: ' + ((new Date().getTime() - startTime) / 1000).toFixed(1) + '초');
    SpreadsheetApp.getActiveSpreadsheet().toast('✅ OpenAI 이미지 생성 완료. M열 URL을 확인하세요.', '대산 블로그', 5);

    return {
      success: true,
      image1Url: openAiImage1.publicUrl
    };
  } catch (error) {
    Logger.log('❌ OpenAI 이미지 생성 오류: ' + error.message);
    updatePublishStatus_(sheet, statusRowIndex, '오류');
    SpreadsheetApp.getUi().alert('❌ OpenAI 이미지 생성 오류\n\n' + error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    releaseExecutionFlag_(EXECUTION_FLAGS.OPENAI_IMAGE_RUNNING, 'generateOpenAIImageOnly_');
  }
}

function generateOpenAIImage() {
  generateOpenAIImageOnly_();
}

function openUploadFolder_() {
  var sheet = SpreadsheetApp.openById(CONTROL_SHEET_ID).getSheets()[0];
  var folderUrl = sheet.getRange('O2').getValue();

  if (!folderUrl) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '⚠️ 업로드 폴더가 없습니다. 먼저 ① 글 생성을 실행하세요.', '대산 블로그', 5);
    return;
  }

  var folderId = extractDriveFolderIdFromUrl_(folderUrl);
  if (!folderId) {
    SpreadsheetApp.getUi().alert(
      '⚠️ 업로드 폴더 URL 형식이 올바르지 않습니다.\n\n' +
      String(folderUrl)
    );
    return;
  }

  try {
    var folder = DriveApp.getFolderById(folderId);
    folder.getName();
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '⚠️ 업로드 폴더에 접근할 수 없습니다.\n\n' +
      '폴더가 삭제되었거나 권한이 없을 수 있습니다.\n' +
      '먼저 ① 글 생성을 다시 실행해 새 폴더를 준비하세요.\n\n' +
      String(folderUrl)
    );
    return;
  }

  SpreadsheetApp.getUi().alert(
    '📁 사진 업로드 폴더\n\n' +
    folderUrl + '\n\n' +
    '위 링크를 복사하여 브라우저에서 열고\n' +
    'Q열 파일명 가이드를 참고하여 사진을 업로드하세요.'
  );
}

function runPublishOnly(seoFileId) {
  var startTime = new Date().getTime();
  if (!acquireExecutionFlag_(EXECUTION_FLAGS.PUBLISH_RUNNING, 'runPublishOnly')) {
    toast_('발행이 이미 실행 중입니다. 잠시 후 다시 시도하세요.');
    return {
      success: false,
      status: 'already_running'
    };
  }

  try {
    Logger.log("🚀 === 2단계: 발행 전용 실행 ===");
    var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
    var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);

    if (!sheet) {
      throw new Error('시트1을 찾을 수 없습니다. Sheet ID를 확인하세요.');
    }

    ensurePublishControlHeaders_(sheet);

    var controlRow = getPublishControlRow_(sheet);
    if (!controlRow) {
      var publishSettingsValidation = validateRequiredControlSettings_(sheet, 2);
      if (!publishSettingsValidation.ok) {
        updatePublishStatus_(sheet, publishSettingsValidation.rowIndex, '오류');
        SpreadsheetApp.getUi().alert(
          '⚠️ 발행 전 시트 설정값 확인 필요\n\n' + publishSettingsValidation.message
        );
        return {
          success: false,
          status: 'invalid_settings',
          error: publishSettingsValidation.message
        };
      }
      Logger.log('⛔ 발행 가능한 행 없음 (F열 미설정 또는 I열 URL 이미 존재 — 중복 발행 차단)');
      toast_('발행할 행이 없습니다. 이미 발행 완료되었거나 F열 설정을 확인하세요.');
      return { success: false, status: 'no_target' };
    }
    updatePublishStatus_(sheet, controlRow.rowIndex, '발행중');

    var publishMode = String(controlRow.values[5] || '').trim();
    var scheduleRaw = controlRow.values[7];
    var imageSource = getImageSourceFromControlRow_(controlRow);
    // H열 예약시간 파싱 → ISO 8601 변환
    var scheduledTime = null;
    if (scheduleRaw) {
      var scheduleDate = (scheduleRaw instanceof Date) ? scheduleRaw : new Date(scheduleRaw);
      if (!isNaN(scheduleDate.getTime())) {
        scheduledTime = scheduleDate.toISOString();
      }
    }

    Logger.log('📋 발행 제어 행: ' + controlRow.rowIndex + '행');
    Logger.log('📢 발행 모드: ' + publishMode);
    Logger.log('🖼️ 이미지 소스: ' + imageSource);
    Logger.log('🕐 H열 원본값: ' + (scheduleRaw ? String(scheduleRaw) : '비어있음'));
    Logger.log('🕐 계산된 예약시간 (ISO 8601): ' + (scheduledTime || '즉시 발행'));

    Logger.log("1️⃣ 최신 SEO 결과 조회");
    var seoFile;
    try {
      seoFile = getGeneratedSeoFileById_(seoFileId) || getLatestGeneratedSeoFile_();
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
    var placeholders = extractPhotoPlaceholders_(finalData.content);
    var imageFolder = createImageFolderForPost_(title);
    var mappedContent;
    var htmlContent;
    var labels;
    var category;
    var relatedPosts;
    var postUrl;
    var imageResult = null;

    Logger.log('🧾 finalData.photo_guides 수: ' + ((finalData.photo_guides || []).length));
    Logger.log('🧾 본문 플레이스홀더 수: ' + placeholders.length);
    if (placeholders.length > 0) {
      Logger.log('🧾 본문 플레이스홀더 목록: ' + placeholders.join(' | '));
    } else {
      Logger.log('⚠️ 본문에 [사진N: ...] 플레이스홀더가 없습니다.');
    }

    Logger.log("2️⃣ 이미지 폴더 생성 및 시트 기록");
    var imageStepStart = new Date().getTime();
    if (imageSource === '자동생성') {
      Logger.log('🎨 자동생성 모드: OpenAI image1 + SVG image2 처리');
      imageResult = processAutoImage_(finalData, imageFolder);
    } else {
      Logger.log('🖼️ 직접업로드 모드: 임시 이미지 폴더를 생성합니다.');
      var fileSummary = getManualImageFileSummary_(imageFolder);
      var uploadedCount = fileSummary.validCount;
      var requiredCount = extractPhotoPlaceholders_(finalData.content).length;
      var folderUrl = buildDriveFolderUrl_(imageFolder.getId());
      writeToControlSheet_('업로드폴더URL', folderUrl, controlRow.rowIndex);
      writeToControlSheet_('필요사진수', requiredCount, controlRow.rowIndex);

      if (fileSummary.invalidCount > 0) {
        SpreadsheetApp.getUi().alert(
          '⚠️ 파일명 규칙 확인 필요\n\n' +
          '숫자로 시작하지 않는 파일은 사용되지 않습니다.\n' +
          '예: 01.jpg, 02.png\n\n' +
          '확인된 파일:\n' +
          fileSummary.invalidNames.slice(0, 10).join('\n') +
          (fileSummary.invalidCount > 10 ? '\n...' : '') +
          '\n\n' +
          '파일명을 수정한 뒤 다시 발행하세요.\n' +
          folderUrl
        );
        return;
      }

      if (uploadedCount < requiredCount) {
        SpreadsheetApp.getUi().alert(
          '⚠️ 사진 부족\n\n' +
          '필요: ' + requiredCount + '장\n' +
          '업로드됨(유효 파일): ' + uploadedCount + '장\n' +
          '총 업로드 파일: ' + fileSummary.totalCount + '장\n\n' +
          '폴더에 사진 추가 후 다시 발행하세요.\n' +
          folderUrl
        );
        return;
      }

      imageResult = processManualImage_(finalData, imageFolder);
    }
    Logger.log('⏱️ runPublishOnly 2단계 이미지 처리 소요시간: ' + ((new Date().getTime() - imageStepStart) / 1000).toFixed(1) + '초');

    Logger.log("3️⃣ 사진 매핑");
    mappedContent = imageResult && imageResult.mappedContent ? imageResult.mappedContent : finalData.content;

    labels = (finalData.seo_keywords || [])
      .filter(function(l) { return typeof l === 'string' && l.trim() !== ''; })
      .map(function(l) { return l.trim().substring(0, 50); });
    category = detectCategory_(labels, finalData.highlight_keywords || [], title);
    relatedPosts = getRelatedBloggerPostsByCategory_(category, title, 3);
    Logger.log('🔗 runPublishOnly 관련 글 후보 수: ' + ((relatedPosts || []).length));
    if (relatedPosts && relatedPosts.length > 0) {
      Logger.log('🔗 runPublishOnly 관련 글 제목: ' + relatedPosts.map(function(post) {
        return String(post.title || '').trim();
      }).join(' | '));
    }
    Logger.log("4️⃣ Blogger HTML 변환");
    var htmlStepStart = new Date().getTime();
    htmlContent = convertToBloggerHTML(mappedContent, title, labels, relatedPosts);
    Logger.log('⏱️ runPublishOnly 4단계 HTML 변환 소요시간: ' + ((new Date().getTime() - htmlStepStart) / 1000).toFixed(1) + '초');

    Logger.log("5️⃣ Blogger 발행");
    var publishStepStart = new Date().getTime();
    postUrl = publishToBlogger(title, htmlContent, labels, publishMode, scheduledTime, finalData.highlight_keywords || []);
    Logger.log('⏱️ runPublishOnly 5단계 Blogger 발행 소요시간: ' + ((new Date().getTime() - publishStepStart) / 1000).toFixed(1) + '초');

    Logger.log("6-1️⃣ 발행 이미지 URL 검증");
    var verifyStepStart = new Date().getTime();
    var imageUrlsToVerify = extractImageUrlsFromHtml_(htmlContent);
    var imageVerification = verifyPublishedImageUrls_(imageUrlsToVerify);
    Logger.log('⏱️ runPublishOnly 6-1단계 이미지 URL 검증 소요시간: ' + ((new Date().getTime() - verifyStepStart) / 1000).toFixed(1) + '초');
    if (!imageVerification.success) {
      Logger.log('⚠️ 발행 후 이미지 URL 검증 실패: ' + imageVerification.failed.map(function(item) {
        return (item.responseCode || 'ERR') + ' ' + (item.url || '');
      }).join(' | '));
    }

    Logger.log("6-2️⃣ Blogger 게시 HTML 이미지 렌더링 검증");
    var postVerifyStepStart = new Date().getTime();
    var postRenderVerification = verifyBloggerPostImageRendering_(postUrl, imageUrlsToVerify);
    Logger.log('⏱️ runPublishOnly 6-2단계 Blogger 게시 HTML 검증 소요시간: ' + ((new Date().getTime() - postVerifyStepStart) / 1000).toFixed(1) + '초');
    if (!postRenderVerification.success) {
      Logger.log('⚠️ Blogger 게시 HTML 이미지 검증 실패: ' + JSON.stringify({
        responseCode: postRenderVerification.responseCode,
        renderedCount: postRenderVerification.renderedCount,
        expectedCount: postRenderVerification.expectedCount,
        missing: postRenderVerification.missing
      }));
    }

    Logger.log("6️⃣ 시트 기록 업데이트");
    var sheetStepStart = new Date().getTime();
    var finalStatus = (imageVerification.success && postRenderVerification.success) ? '발행완료' : '발행완료(검증주의)';
    updateControlSheetAfterPublish(title, postUrl, controlRow.rowIndex, finalStatus);
    Logger.log('⏱️ runPublishOnly 6단계 시트 업데이트 소요시간: ' + ((new Date().getTime() - sheetStepStart) / 1000).toFixed(1) + '초');
    if (finalStatus !== '발행완료') {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '⚠️ 발행은 완료됐지만 이미지 검증에서 경고가 발생했습니다. 실행 로그를 확인하세요.',
        '대산 블로그',
        8
      );
    }

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
    Logger.log('⏱️ runPublishOnly 전체 소요시간: ' + ((new Date().getTime() - startTime) / 1000).toFixed(1) + '초');
    toast_('Blogger 발행 완료!');

    return {
      success: true,
      mode: publishMode,
      title: title,
      postUrl: postUrl,
      rowIndex: controlRow.rowIndex,
      imageVerification: imageVerification,
      postRenderVerification: postRenderVerification
    };
  } catch (error) {
    Logger.log("❌ 완전 통합 처리 오류: " + error.message);
    Logger.log("❌ 완전 통합 처리 스택: " + error.stack);
    try {
      var errorSheet = SpreadsheetApp.openById(CONTROL_SHEET_ID).getSheetByName(SHEET_NAME_MAIN);
      var errorControlRow = errorSheet ? getPublishControlRow_(errorSheet) : null;
      updatePublishStatus_(errorSheet, errorControlRow && errorControlRow.rowIndex ? errorControlRow.rowIndex : 2, '오류');
    } catch (statusError) {
      Logger.log('⚠️ 발행 오류 상태 기록 실패: ' + statusError.message);
    }
    toast_("통합 처리 중 오류 발생: " + error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    releaseExecutionFlag_(EXECUTION_FLAGS.PUBLISH_RUNNING, 'runPublishOnly');
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

function runAll_Auto() {
  var startTime = new Date().getTime();
  if (!acquireExecutionFlag_(EXECUTION_FLAGS.RUN_ALL_AUTO_RUNNING, 'runAll_Auto')) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '⚠️ 전체실행이 이미 실행 중입니다. 잠시 후 다시 시도하세요.', '대산 블로그', 5);
    return { success: false, status: 'already_running' };
  }

  try {
    var spreadsheet = SpreadsheetApp.openById(CONTROL_SHEET_ID);
    var sheet = spreadsheet.getSheetByName(SHEET_NAME_MAIN);
    if (!sheet) {
      throw new Error('시트1을 찾을 수 없습니다.');
    }

    ensurePublishControlHeaders_(sheet);
    var settingsValidation = validateRequiredControlSettings_(sheet, 2);
    if (!settingsValidation.ok) {
      updatePublishStatus_(sheet, settingsValidation.rowIndex, '오류');
      SpreadsheetApp.getUi().alert(
        '⚠️ 전체실행 전 시트 설정값 확인 필요\n\n' + settingsValidation.message
      );
      return { success: false, status: 'invalid_settings', error: settingsValidation.message };
    }

    var controlRow = getControlRowValues_(sheet, 2);
    var imageSource = getImageSourceFromControlRow_(controlRow);
    if (imageSource !== '자동생성') {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '⚠️ 자동생성 모드가 아닙니다. 모드를 먼저 선택하세요.', '대산 블로그', 5);
      return { success: false, status: 'wrong_mode' };
    }

    if (!hasPendingInputOrPreprocess_()) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '⚠️ 입력 폴더에 처리할 파일이 없습니다. 새 HTML, TXT, PDF 파일을 먼저 업로드하세요.', '대산 블로그', 5);
      return { success: false, status: 'no_input' };
    }

    SpreadsheetApp.getActiveSpreadsheet().toast('1/3 글 생성 중...', '대산 블로그', 30);
    var step1Start = new Date().getTime();
    var generateResult = runGenerateOnly();
    Logger.log('⏱️ runAll_Auto 1/3 글 생성 소요시간: ' + ((new Date().getTime() - step1Start) / 1000).toFixed(1) + '초');
    if (!generateResult || !generateResult.success) {
      return generateResult || { success: false, status: 'generate_failed' };
    }

    SpreadsheetApp.getActiveSpreadsheet().toast('2/3 이미지 생성 중...', '대산 블로그', 60);
    var step2Start = new Date().getTime();
    var imageResult = generateOpenAIImageOnly_(generateResult.seoFileId);
    Logger.log('⏱️ runAll_Auto 2/3 이미지 생성 소요시간: ' + ((new Date().getTime() - step2Start) / 1000).toFixed(1) + '초');
    if (!imageResult || !imageResult.success) {
      return imageResult || { success: false, status: 'image_failed' };
    }

    SpreadsheetApp.getActiveSpreadsheet().toast('3/3 발행 중...', '대산 블로그', 30);
    var step3Start = new Date().getTime();
    var publishResult = runPublishOnly(generateResult.seoFileId);
    Logger.log('⏱️ runAll_Auto 3/3 발행 소요시간: ' + ((new Date().getTime() - step3Start) / 1000).toFixed(1) + '초');
    if (!publishResult || !publishResult.success) {
      return publishResult || { success: false, status: 'publish_failed' };
    }

    Logger.log('⏱️ runAll_Auto 전체 소요시간: ' + ((new Date().getTime() - startTime) / 1000).toFixed(1) + '초');
    SpreadsheetApp.getActiveSpreadsheet().toast('✅ 전체 완료!', '대산 블로그', 5);
    return {
      success: true,
      generate: generateResult,
      image: imageResult,
      publish: publishResult
    };
  } finally {
    releaseExecutionFlag_(EXECUTION_FLAGS.RUN_ALL_AUTO_RUNNING, 'runAll_Auto');
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
    var apiKey = getClaudeKey_();
    
    Logger.log("\n🔑 SEO 키워드: " + keywords.length + "개 (" + keywords.join(', ') + ")");
    Logger.log("💎 강조 키워드: " + highlightKeywords.length + "개 (" + highlightKeywords.join(', ') + ")");
    Logger.log("📊 스타일 번호: " + (styleData ? styleData.number : '없음'));
    Logger.log("📄 템플릿: " + (templateData ? templateData.name : '없음'));
    Logger.log("🔐 Claude API 키: " + (apiKey ? '설정됨' : '미설정'));
    
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
 * Claude API 키를 스크립트 속성에 저장합니다.
 */
function STEP5_configOnce_setAnthropicKey(KEY) {
  PropertiesService.getScriptProperties().setProperty(PROP_KEYS.CLAUDE_API_KEY, KEY);
  toast_('Claude API 키 저장 완료');
  Logger.log('✅ Claude API 키 저장 완료');
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
 * Unsplash API 키를 스크립트 속성에 저장합니다.
 */
function STEP5_configOnce_setUnsplashKey(KEY) {
  if (!KEY || KEY.toString().trim() === '') {
    Logger.log('❌ 오류: Unsplash API 키 값이 입력되지 않았습니다.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty(PROP_KEYS.UNSPLASH_ACCESS_KEY, KEY);
  toast_('Unsplash API 키 저장 완료');
  Logger.log('✅ Unsplash API 키 저장 완료');
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
    var apiKey = getClaudeKey_();
    
    Logger.log("\n🔑 설정 상태:");
    Logger.log("  SEO 키워드: " + (keywords.length > 0 ? "✓ " + keywords.length + "개" : "✗ 미설정"));
    Logger.log("  강조 키워드: " + (highlightKeywords.length > 0 ? "✓ " + highlightKeywords.length + "개" : "✗ 미설정"));
    Logger.log("  스타일: " + (styleData ? "✓ " + styleData.number + "번" : "✗ 미설정"));
    Logger.log("  템플릿: " + (templateData ? "✓ " + templateData.name : "✗ 미설정"));
    Logger.log("  Claude API 키: " + (apiKey ? "✓ 설정됨" : "✗ 미설정"));
    
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

function resetForNewPost() {
  var sheet = SpreadsheetApp.openById(CONTROL_SHEET_ID).getSheets()[0];
  
  // 기존 초기화
  sheet.getRange('G2').clearContent();
  sheet.getRange('H2').clearContent();
  sheet.getRange('I2').clearContent();
  
  // 이미지 관련 열 초기화 (모드 무관 전체)
  sheet.getRange('M2').clearContent(); // image1_url
  sheet.getRange('O2').clearContent(); // 업로드폴더URL
  sheet.getRange('P2').clearContent(); // 필요사진수
  sheet.getRange('Q2').clearContent(); // 파일명가이드
  sheet.getRange('R2').clearContent(); // image2_svg_url

  // Properties 초기화
  var props = PropertiesService.getScriptProperties();
  var allProps = props.getProperties();
  var deletedCount = 0;
  for (var key in allProps) {
    if (key.indexOf('processed_') === 0) {
      props.deleteProperty(key);
      deletedCount++;
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    '초기화 완료! 모드를 확인하고 새 파일을 업로드한 뒤 다시 실행하세요.', '대산 블로그', 5);
  Logger.log('✅ 초기화 완료 (처리이력 삭제: ' + deletedCount + '개)');
}

/**
 * baseName 기준으로 특정 파일의 처리 이력만 삭제
 */
function clearProcessedRecordByBaseName(baseName) {
  Logger.log("🧹 === 특정 파일 처리 이력 삭제 ===");
  Logger.log("📁 대상 baseName: " + baseName);

  try {
    if (!baseName || String(baseName).trim() === '') {
      Logger.log("❌ baseName이 비어 있습니다.");
      return false;
    }

    var normalizedBaseName = String(baseName).trim();
    var inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    var files = inputFolder.getFiles();
    var matchedFileId = '';
    var matchedFileName = '';

    while (files.hasNext()) {
      var file = files.next();
      var fileName = file.getName();

      if (!/\.(html?|mhtml|mht|txt|pdf)(의 사본)?$/i.test(fileName)) continue;

      var currentBaseName = fileName
        .replace(/의 사본$/i, '')
        .replace(/\.[^.]+$/, '');

      if (currentBaseName === normalizedBaseName) {
        matchedFileId = file.getId();
        matchedFileName = fileName;
        break;
      }
    }

    if (!matchedFileId) {
      Logger.log("⚠️ 입력 폴더에서 baseName과 일치하는 파일을 찾지 못했습니다.");
      return false;
    }

    var propertyKey = 'processed_' + matchedFileId;
    var props = PropertiesService.getScriptProperties();
    var existingRecord = props.getProperty(propertyKey);

    Logger.log("🆔 매칭 파일 ID: " + matchedFileId);
    Logger.log("📄 매칭 파일명: " + matchedFileName);
    Logger.log("🔑 삭제 대상 속성 키: " + propertyKey);

    if (!existingRecord) {
      Logger.log("⚠️ 삭제할 처리 이력이 없습니다.");
      return false;
    }

    props.deleteProperty(propertyKey);
    Logger.log("✅ 처리 이력 삭제 완료: " + matchedFileName);
    toast_("특정 파일 처리 이력 삭제 완료");
    return true;

  } catch (error) {
    Logger.log("❌ clearProcessedRecordByBaseName 오류: " + error.message);
    Logger.log("❌ clearProcessedRecordByBaseName 스택: " + error.stack);
    return false;
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
    var apiKey = getClaudeKey_();
    
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
    var apiKey = getClaudeKey_();
    
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
    var apiKey = getClaudeKey_();
    
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

function getNextImagenFileName_(folder) {
  var files = folder.getFiles();
  var maxNumber = 0;

  while (files.hasNext()) {
    var file = files.next();
    var match = file.getName().match(/^(\d+)\.png$/i);
    if (!match) continue;
    var number = parseInt(match[1], 10);
    if (number > maxNumber) maxNumber = number;
  }

  return ('0' + (maxNumber + 1)).slice(-2) + '.png';
}

function generateImageWithOpenAI_(prompt, folderId, fileName) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OPENAI_API_KEY);
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    }

    var resolvedFileName = String(fileName || ('openai_' + new Date().getTime() + '.png')).trim();
    var payload = {
      model: 'gpt-image-2',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'low'
    };

    Logger.log('🎨 === OpenAI 이미지 생성 시작 ===');
    Logger.log('🖼️ 저장 파일명: ' + resolvedFileName);
    Logger.log('📝 OpenAI 프롬프트(앞 200자): ' + String(prompt || '').substring(0, 200));

    var response = null;
    var responseCode = 0;
    var responseText = '';
    var maxRetries = 3;
    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      response = UrlFetchApp.fetch('https://api.openai.com/v1/images/generations', {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      responseCode = response.getResponseCode();
      responseText = response.getContentText();
      Logger.log('📡 OpenAI 이미지 응답 코드: ' + responseCode + ' (시도 ' + attempt + '/' + maxRetries + ')');
      Logger.log('📝 OpenAI 이미지 응답(앞 200자): ' + responseText.substring(0, 200));

      if (responseCode >= 200 && responseCode < 300) {
        break;
      }

      if ((responseCode === 429 || responseCode === 502 || responseCode === 503) && attempt < maxRetries) {
        Logger.log('🔁 OpenAI 이미지 재시도 대기: ' + responseCode);
        Utilities.sleep(2000 * attempt);
        continue;
      }
      break;
    }

    if (responseCode < 200 || responseCode >= 300) {
      throw new Error('OpenAI 이미지 생성 실패: ' + responseText);
    }

    var responseJson = JSON.parse(response.getContentText());
    var imageBlob;

    if (responseJson.data && responseJson.data[0].b64_json) {
      var b64Data = responseJson.data[0].b64_json;
      imageBlob = Utilities.newBlob(
        Utilities.base64Decode(b64Data),
        'image/png',
        resolvedFileName
      );
      Logger.log('🧾 OpenAI 응답 형식: b64_json');
    } else if (responseJson.data && responseJson.data[0].url) {
      var imageUrl = responseJson.data[0].url;
      Logger.log('🧾 OpenAI 응답 형식: url');
      Logger.log('🔗 OpenAI 원본 이미지 URL: ' + imageUrl);
      imageBlob = UrlFetchApp.fetch(imageUrl).getBlob();
    } else {
      throw new Error('OpenAI 응답에 이미지 데이터가 없습니다.');
    }

    var base64Data = Utilities.base64Encode(imageBlob.getBytes());

    var publicUrl = uploadImageToGitHub_(base64Data, resolvedFileName);
    Logger.log('✅ OpenAI 이미지 GitHub 업로드 성공: ' + resolvedFileName);
    Logger.log('🔗 OpenAI 이미지 URL: ' + publicUrl);

    return {
      fileName: resolvedFileName,
      mimeType: 'image/png',
      publicUrl: publicUrl,
      responseCode: responseCode
    };
  } catch (error) {
    Logger.log('❌ generateImageWithOpenAI_ 오류: ' + error.message);
    Logger.log('❌ generateImageWithOpenAI_ 스택: ' + error.stack);
    return null;
  }
}

function uploadImageToGitHub_(base64Data, fileName) {
  var githubToken = getGithubToken_();
  var resolvedFileName = String(fileName || ('image_' + new Date().getTime() + '.png')).trim();
  var normalizedBase64 = String(base64Data || '').trim();
  var dataUriMatch = normalizedBase64.match(/^data:([^;]+);base64,(.+)$/);
  var apiUrl = 'https://api.github.com/repos/kangHo-Jun/Blog/contents/images/' + encodeURIComponent(resolvedFileName);

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN이 설정되지 않았습니다. Properties Service에 저장하세요.');
  }

  if (!normalizedBase64) {
    throw new Error('업로드할 base64 이미지 데이터가 비어 있습니다.');
  }

  if (dataUriMatch) {
    normalizedBase64 = dataUriMatch[2] || '';
  }

  if (!normalizedBase64) {
    throw new Error('정규화 후 base64 이미지 데이터가 비어 있습니다.');
  }

  var existingResponse = UrlFetchApp.fetch(apiUrl, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + githubToken,
      Accept: 'application/vnd.github+json'
    },
    muteHttpExceptions: true
  });
  var existingCode = existingResponse.getResponseCode();
  var existingText = existingResponse.getContentText();
  var payload = {
    message: 'Add blog image ' + resolvedFileName,
    content: normalizedBase64
  };

  if (existingCode === 200) {
    var existingData = JSON.parse(existingText);
    if (existingData && existingData.sha) {
      payload.sha = existingData.sha;
    }
  } else if (existingCode !== 404) {
    if (existingCode === 401 || existingCode === 403) {
      throw new Error('GitHub 토큰 권한 또는 만료 문제: ' + existingText);
    }
    throw new Error('GitHub 기존 파일 확인 실패: ' + existingText);
  }

  var response = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      Authorization: 'Bearer ' + githubToken,
      Accept: 'application/vnd.github+json'
    },
    muteHttpExceptions: true
  });
  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();

  Logger.log('📡 GitHub 업로드 응답 코드: ' + responseCode);
  Logger.log('📝 GitHub 업로드 응답(앞 200자): ' + responseText.substring(0, 200));

  if (responseCode < 200 || responseCode >= 300) {
    if (responseCode === 401 || responseCode === 403) {
      throw new Error('GitHub 업로드 실패: 토큰 권한 또는 만료 문제 - ' + responseText);
    }
    if (responseCode === 413 || responseCode === 422) {
      throw new Error('GitHub 업로드 실패: 파일 크기 또는 요청 데이터 문제 - ' + responseText);
    }
    throw new Error('GitHub 업로드 실패: ' + responseText);
  }

  return 'https://raw.githubusercontent.com/kangHo-Jun/Blog/main/images/' + encodeURIComponent(resolvedFileName);
}

function uploadBlobToGitHub_(blob, fileName) {
  if (!blob) {
    throw new Error('업로드할 Blob이 비어 있습니다.');
  }
  var base64Data = Utilities.base64Encode(blob.getBytes());
  return uploadImageToGitHub_(base64Data, fileName);
}

function verifyImageUrlRenders_(url) {
  if (!url) {
    return {
      success: false,
      error: 'URL이 비어 있습니다.'
    };
  }

  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true
    });
    var responseCode = response.getResponseCode();
    var headers = response.getAllHeaders();
    var contentType = String((headers['Content-Type'] || headers['content-type'] || '')).toLowerCase();

    Logger.log('🧪 이미지 URL 검증 코드: ' + responseCode + ' / ' + url);
    Logger.log('🧪 이미지 URL 검증 content-type: ' + contentType);

    return {
      success: responseCode >= 200 && responseCode < 300 && contentType.indexOf('image/') === 0,
      responseCode: responseCode,
      contentType: contentType,
      url: url
    };
  } catch (error) {
    Logger.log('❌ 이미지 URL 검증 오류: ' + error.message);
    return {
      success: false,
      error: error.message,
      url: url
    };
  }
}

function extractImageUrlsFromHtml_(html) {
  var urls = [];
  var seen = {};
  var regex = /<img[^>]+src="([^"]+)"/gi;
  var match;

  while ((match = regex.exec(String(html || '')))) {
    var url = String(match[1] || '').trim();
    if (!url || seen[url]) continue;
    seen[url] = true;
    urls.push(url);
  }

  return urls;
}

function verifyPublishedImageUrls_(imageUrls) {
  var urls = Array.isArray(imageUrls) ? imageUrls : [];
  var results = [];
  var failed = [];

  for (var i = 0; i < urls.length; i++) {
    var result = verifyImageUrlRenders_(urls[i]);
    results.push(result);
    if (!result.success) {
      failed.push(result);
    }
  }

  Logger.log('🧪 이미지 URL 검증 대상 수: ' + urls.length);
  Logger.log('🧪 이미지 URL 검증 실패 수: ' + failed.length);

  return {
    total: urls.length,
    failedCount: failed.length,
    success: failed.length === 0,
    results: results,
    failed: failed
  };
}

function verifyBloggerPostImageRendering_(postUrl, expectedImageUrls) {
  if (!postUrl) {
    return {
      success: false,
      error: '게시 URL이 비어 있습니다.'
    };
  }

  try {
    var response = UrlFetchApp.fetch(postUrl, {
      method: 'get',
      muteHttpExceptions: true
    });
    var responseCode = response.getResponseCode();
    var html = response.getContentText() || '';
    var renderedImageUrls = extractImageUrlsFromHtml_(html);
    var expected = Array.isArray(expectedImageUrls) ? expectedImageUrls : [];
    var missing = [];

    for (var i = 0; i < expected.length; i++) {
      if (renderedImageUrls.indexOf(expected[i]) === -1) {
        missing.push(expected[i]);
      }
    }

    Logger.log('🧪 Blogger 게시 HTML 검증 코드: ' + responseCode + ' / ' + postUrl);
    Logger.log('🧪 Blogger 게시 HTML img 수: ' + renderedImageUrls.length);
    if (missing.length > 0) {
      Logger.log('⚠️ Blogger 게시 HTML 누락 이미지 수: ' + missing.length);
    }

    return {
      success: responseCode >= 200 && responseCode < 300 && renderedImageUrls.length > 0 && missing.length === 0,
      responseCode: responseCode,
      postUrl: postUrl,
      renderedCount: renderedImageUrls.length,
      expectedCount: expected.length,
      missing: missing,
      renderedImageUrls: renderedImageUrls
    };
  } catch (error) {
    Logger.log('❌ Blogger 게시 HTML 검증 오류: ' + error.message);
    return {
      success: false,
      error: error.message,
      postUrl: postUrl
    };
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
 * [임시] Gemini API 키 설정 유틸리티
 * 하드코딩 키는 사용하지 않습니다. KEY를 직접 전달해서 실행하세요.
 */
function tempSetGeminiKey(KEY) {
  if (!KEY || KEY.toString().trim() === '') {
    Logger.log('❌ 오류: Gemini API 키 값이 입력되지 않았습니다.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', KEY);
  Logger.log('완료: GEMINI_API_KEY가 PropertiesService에 등록되었습니다.');
}

/**
 * Gemini API 연결 간단 테스트
 */
function testGeminiAPI() {
  try {
    Logger.log("🧪 === Gemini API 테스트 시작 ===");

    var apiKey = getGeminiKey_();
    if (!apiKey) {
      Logger.log("❌ Gemini API 키가 설정되지 않았습니다.");
      return {
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      };
    }

    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    var payload = {
      contents: [{
        parts: [{
          text: "안녕하세요. 연결 테스트입니다. 20자 이내로 '정상 연결'이라고만 답하세요."
        }]
      }],
      generationConfig: {
        temperature: 0
      }
    };

    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    Logger.log("📡 응답 코드: " + responseCode);
    Logger.log("📝 응답 내용 (앞 100자): " + responseText.substring(0, 100));

    if (responseCode !== 200) {
      Logger.log("❌ Gemini API 오류 전체: " + responseText);
      return {
        success: false,
        responseCode: responseCode,
        responsePreview: responseText.substring(0, 100),
        error: responseText
      };
    }

    Logger.log("✅ Gemini API 테스트 성공");
    return {
      success: true,
      responseCode: responseCode,
      responsePreview: responseText.substring(0, 100)
    };
  } catch (error) {
    Logger.log("❌ testGeminiAPI 실행 오류: " + error.message);
    Logger.log("❌ testGeminiAPI 스택: " + error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Claude API 연결 간단 테스트
 */
function testClaudeAPI() {
  try {
    Logger.log("🧪 === Claude API 테스트 시작 ===");

    var apiKey = getClaudeKey_();
    if (!apiKey) {
      Logger.log("❌ Claude API 키가 설정되지 않았습니다.");
      return {
        success: false,
        error: 'Claude API 키가 설정되지 않았습니다.'
      };
    }

    var payload = {
      model: CLAUDE_DEFAULTS.MODEL,
      max_tokens: 64,
      temperature: 0,
      messages: [{
        role: 'user',
        content: '안녕하세요. 연결 테스트입니다. 20자 이내로 정상 연결이라고만 답하세요.'
      }]
    };

    var response = UrlFetchApp.fetch(CLAUDE_DEFAULTS.ENDPOINT, {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_DEFAULTS.VERSION
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    Logger.log("📡 응답 코드: " + responseCode);
    Logger.log("📝 응답 내용 (앞 100자): " + responseText.substring(0, 100));

    if (responseCode < 200 || responseCode >= 300) {
      Logger.log("❌ Claude API 테스트 실패");
      Logger.log("❌ Claude API 오류 전체: " + responseText);
      return {
        success: false,
        responseCode: responseCode,
        responsePreview: responseText.substring(0, 100),
        error: responseText
      };
    }

    Logger.log("✅ Claude API 테스트 성공");
    return {
      success: true,
      responseCode: responseCode,
      responsePreview: responseText.substring(0, 100)
    };
  } catch (error) {
    Logger.log("❌ testClaudeAPI 실행 오류: " + error.message);
    Logger.log("❌ testClaudeAPI 스택: " + error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
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
 * @param {Object=} finalData - SEO 결과 데이터
 * @param {string=} title - 글 제목
 * @return {string} 사진 URL로 교체된 본문 텍스트
 */
function mapPhotosToPlaceholders(docContent, imageFolderId, finalData, title) {
  if (!docContent) return "";

  try {
    if (!imageFolderId) {
      Logger.log("⚠️ imageFolderId가 없어 Unsplash 자동 검색으로 전환합니다.");
      return mapUnsplashPhotosToPlaceholders_(docContent, finalData, title);
    }

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
      Logger.log("⚠️ 경고: 폴더에 매핑할 사진 파일이 없습니다. Unsplash 자동 검색으로 전환합니다.");
      return mapUnsplashPhotosToPlaceholders_(docContent, finalData, title);
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
        var photoDescription = extractPhotoDescriptionFromHolder_(holder);
        
        // 파일을 링크가 있는 모든 사용자에게 공개 (보기 권한)
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          // 직링크 URL 생성 (Google Drive 고유 ID 활용)
          var photoUrl = "https://lh3.googleusercontent.com/d/" + file.getId();
          
          // 본문 내 모든 해당 홀더 교체
          var escapedHolder = holder.replace(/[\[\]]/g, "\\$&"); // [ ] 특수문자 탈출 처리
          var regex = new RegExp(escapedHolder, "g");
          resultBody = resultBody.replace(regex, buildBloggerImageToken_(photoUrl, photoDescription));
          mappedCount++;
        } catch (shareError) {
          Logger.log("❌ 권한 설정 실패: " + file.getName() + " (" + shareError.message + ")");
          unmappedHolders.push(holder);
        }
      } else {
        var fallbackResult = searchUnsplashPhoto_(buildUnsplashKeywordFromHolder_(holder, finalData, title));
        if (fallbackResult.imageUrl) {
          var fallbackDescription = extractPhotoDescriptionFromHolder_(holder);
          var escapedHolder = holder.replace(/[\[\]]/g, "\\$&");
          var regex = new RegExp(escapedHolder, "g");
          resultBody = resultBody.replace(regex, buildBloggerImageToken_(fallbackResult.imageUrl, fallbackDescription));
          mappedCount++;
          Logger.log("🧠 폴더 사진 부족 → Unsplash 대체 적용: " + fallbackResult.creditText);
        } else {
          unmappedHolders.push(holder);
        }
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
    Logger.log("❌ mapPhotosToPlaceholders 스택: " + error.stack);
    return docContent; // 실패 시 원본 본문 반환
  }
}

function mapManualPhotosToPlaceholders_(docContent, imageFolderId, finalData, title) {
  if (!docContent) return "";

  try {
    if (!imageFolderId) {
      Logger.log("⚠️ 직접업로드 매핑 실패: imageFolderId가 없습니다.");
      return docContent.replace(/\[사진\s*\d+[^\]]*\]/g, '');
    }

    var folder = DriveApp.getFolderById(imageFolderId);
    var files = folder.getFiles();
    var photoFiles = [];

    while (files.hasNext()) {
      var file = files.next();
      var fileName = file.getName();
      if (/^\d+/.test(fileName)) {
        photoFiles.push(file);
      }
    }

    photoFiles.sort(function(a, b) {
      var numA = parseInt(a.getName().match(/^\d+/)[0], 10);
      var numB = parseInt(b.getName().match(/^\d+/)[0], 10);
      return numA - numB;
    });

    var resultBody = docContent;
    var mappedCount = 0;
    var unmappedHolders = [];
    var placeholderMatches = docContent.match(/\[사진\s*\d+(?:\s*:[^\]]*)?\]/g) || [];
    var uniqueHolders = Array.from(new Set(placeholderMatches)).sort(function(a, b) {
      var numA = parseInt(a.match(/\d+/)[0], 10);
      var numB = parseInt(b.match(/\d+/)[0], 10);
      return numA - numB;
    });

    uniqueHolders.forEach(function(holder) {
      var photoNum = parseInt(holder.match(/\d+/)[0], 10);
      var fileIndex = photoNum - 1;

      if (fileIndex >= 0 && fileIndex < photoFiles.length) {
        var file = photoFiles[fileIndex];
        var photoDescription = extractPhotoDescriptionFromHolder_(holder);

        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          var photoUrl = "https://lh3.googleusercontent.com/d/" + file.getId();
          var escapedHolder = holder.replace(/[\[\]]/g, "\\$&");
          var regex = new RegExp(escapedHolder, "g");
          resultBody = resultBody.replace(regex, buildBloggerImageToken_(photoUrl, photoDescription));
          mappedCount++;
        } catch (shareError) {
          Logger.log("❌ 직접업로드 권한 설정 실패: " + file.getName() + " (" + shareError.message + ")");
          unmappedHolders.push(holder);
        }
      } else {
        unmappedHolders.push(holder);
      }
    });

    var beforeClean = resultBody;
    resultBody = resultBody.replace(/\[사진\s*\d+[^\]]*\]/g, '');
    var removedCount = (beforeClean.match(/\[사진\s*\d+[^\]]*\]/g) || []).length;

    Logger.log("✅ 직접업로드 사진 매핑 완료: 총 " + mappedCount + "개 교체됨");
    if (removedCount > 0) {
      Logger.log("🗑️ 직접업로드 플레이스홀더 제거: " + removedCount + "개");
    }
    if (unmappedHolders.length > 0) {
      Logger.log("⚠️ 직접업로드 미매핑 홀더 (" + unmappedHolders.length + "개): " + unmappedHolders.join(", "));
    }

    return resultBody;
  } catch (error) {
    Logger.log("❌ 오류 발생 (mapManualPhotosToPlaceholders_): " + error.message);
    Logger.log("❌ mapManualPhotosToPlaceholders_ 스택: " + error.stack);
    return docContent.replace(/\[사진\s*\d+[^\]]*\]/g, '');
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

function extractPhotoDescriptionFromHolder_(holder) {
  var descriptionMatch = String(holder || '').match(/:\s*([^\]]+)/);
  return descriptionMatch ? descriptionMatch[1].trim() : '관련 이미지';
}

function buildBloggerImageToken_(url, description) {
  return '[[IMG::' + encodeURIComponent(String(url || '')) + '::' + encodeURIComponent(String(description || '관련 이미지')) + ']]';
}

function parseBloggerImageToken_(line) {
  var match = String(line || '').match(/^\[\[IMG::(.+?)::(.+?)\]\]$/);
  if (!match) return null;

  return {
    url: decodeURIComponent(match[1]),
    description: decodeURIComponent(match[2])
  };
}

function mapGeneratedImageUrlsToPlaceholders_(docContent, generatedImages) {
  if (!docContent) return '';

  var resultBody = docContent;
  var mappedCount = 0;
  var placeholderMatches = docContent.match(/\[사진\s*\d+(?:\s*:[^\]]*)?\]/g) || [];
  var uniqueHolders = Array.from(new Set(placeholderMatches)).sort(function(a, b) {
    var numA = parseInt(a.match(/\d+/)[0], 10);
    var numB = parseInt(b.match(/\d+/)[0], 10);
    return numA - numB;
  });

  for (var i = 0; i < uniqueHolders.length; i++) {
    var holder = uniqueHolders[i];
    var imageIndex = parseInt(holder.match(/\d+/)[0], 10) - 1;
    var generated = generatedImages && generatedImages[imageIndex];
    var publicUrl = generated && generated.publicUrl ? generated.publicUrl : '';
    var photoDescription = extractPhotoDescriptionFromHolder_(holder);

    if (!publicUrl) {
      continue;
    }

    var escapedHolder = holder.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp(escapedHolder, "g");
    resultBody = resultBody.replace(regex, buildBloggerImageToken_(publicUrl, photoDescription));
    mappedCount++;
  }

  resultBody = resultBody.replace(/\[사진\s*\d+[^\]]*\]/g, '');
  Logger.log('✅ 생성 이미지 URL 매핑 완료: 총 ' + mappedCount + '개 교체됨');
  return resultBody;
}

var BUILDING_KEYWORD_MAP = {
  'gypsum': 'drywall installation gypsum board',
  'insulation': 'building insulation material',
  'window': 'modern window frame interior',
  'air': 'indoor air quality healthy home',
  'eco': 'eco friendly building material',
  'construction': 'home renovation construction worker',
  'wall': 'interior wall construction',
  'renovation': 'home renovation interior',
  'material': 'construction building material',
  'indoor': 'healthy indoor living space'
};

function extractEnglishPlaceholderKeyword_(holder) {
  var descriptionMatch = String(holder || '').match(/:\s*([^\]]+)/);
  var description = descriptionMatch ? descriptionMatch[1].trim() : '';

  return description
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildUnsplashKeywordFromHolder_(holder, finalData, title) {
  var englishKeyword = extractEnglishPlaceholderKeyword_(holder);

  for (var key in BUILDING_KEYWORD_MAP) {
    if (englishKeyword.indexOf(key) !== -1) {
      Logger.log('🧭 키워드 매핑 적용: ' + englishKeyword + ' -> ' + BUILDING_KEYWORD_MAP[key]);
      return BUILDING_KEYWORD_MAP[key];
    }
  }

  Logger.log('🧭 키워드 원문 사용: ' + englishKeyword);
  return englishKeyword;
}

function searchUnsplashPhoto_(keyword) {
  var accessKey = getUnsplashKey_();
  if (!accessKey) {
    throw new Error('UNSPLASH_ACCESS_KEY가 설정되지 않았습니다. 자동생성 사용 전에 Properties Service에 키를 저장하세요.');
  }

  var apiUrl = 'https://api.unsplash.com/search/photos?query=' +
    encodeURIComponent(keyword) +
    '&page=1&per_page=1&orientation=landscape&content_filter=high';

  Logger.log('🔎 Unsplash 검색어: ' + keyword);
  var response = UrlFetchApp.fetch(apiUrl, {
    method: 'get',
    headers: {
      Authorization: 'Client-ID ' + accessKey,
      'Accept-Version': 'v1'
    },
    muteHttpExceptions: true
  });

  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();
  Logger.log('📡 Unsplash 응답 코드: ' + responseCode);
  Logger.log('📝 Unsplash 응답 미리보기(앞 120자): ' + responseText.substring(0, 120));

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('Unsplash API 호출 실패: ' + responseText);
  }

  var responseData = JSON.parse(responseText);
  var photo = responseData && responseData.results && responseData.results.length > 0
    ? responseData.results[0]
    : null;
  var imageUrl = photo && photo.urls ? (photo.urls.regular || photo.urls.full || photo.urls.small || '') : '';
  var photographer = photo && photo.user && photo.user.name ? photo.user.name : '';
  var creditText = photographer ? ('Photo by ' + photographer + ' on Unsplash') : 'Unsplash 출처 정보 없음';

  return {
    responseCode: responseCode,
    imageUrl: imageUrl,
    creditText: creditText,
    raw: photo
  };
}

function extractPhotoPlaceholders_(docContent) {
  var placeholderMatches = String(docContent || '').match(/\[사진\s*\d+(?:\s*:[^\]]*)?\]/g) || [];
  return Array.from(new Set(placeholderMatches)).sort(function(a, b) {
    var numA = parseInt(a.match(/\d+/)[0], 10);
    var numB = parseInt(b.match(/\d+/)[0], 10);
    return numA - numB;
  });
}

function clearAutoGeneratedImageFiles_(folder) {
  if (!folder) return;

  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (/^\d+\.(jpg|jpeg|png)$/i.test(file.getName())) {
      file.setTrashed(true);
    }
  }
}

function downloadUnsplashPhotosToFolder_(docContent, finalData, title, folder) {
  if (!folder) {
    throw new Error('Unsplash 저장 대상 Drive 폴더가 없습니다.');
  }

  var placeholders = extractPhotoPlaceholders_(docContent);
  var downloaded = [];
  var queryCache = {};

  Logger.log('🧠 Unsplash Drive 저장 시작');
  Logger.log('📁 대상 폴더: ' + folder.getName() + ' (' + folder.getId() + ')');
  Logger.log('📋 다운로드 대상 플레이스홀더 수: ' + placeholders.length);

  clearAutoGeneratedImageFiles_(folder);

  for (var i = 0; i < placeholders.length; i++) {
    var holder = placeholders[i];
    var query = buildUnsplashKeywordFromHolder_(holder, finalData, title);
    Logger.log('🔽 다운로드 시도: ' + holder + ' / query=' + query);
    var searchResult = queryCache[query];

    if (searchResult === undefined) {
      searchResult = query ? searchUnsplashPhoto_(query) : { imageUrl: '', creditText: '' };
      queryCache[query] = searchResult;
    }

    if (!searchResult.imageUrl) {
      Logger.log('⚠️ Unsplash 이미지 검색 실패: ' + holder);
      continue;
    }

    var imageResponse = UrlFetchApp.fetch(searchResult.imageUrl, {
      method: 'get',
      muteHttpExceptions: true
    });
    var imageCode = imageResponse.getResponseCode();
    Logger.log('📡 이미지 다운로드 응답 코드: ' + imageCode + ' / ' + holder);

    if (imageCode < 200 || imageCode >= 300) {
      Logger.log('❌ Unsplash 이미지 다운로드 실패 (' + imageCode + '): ' + holder);
      continue;
    }

    var imageNumber = parseInt(holder.match(/\d+/)[0], 10);
    var fileName = ('0' + imageNumber).slice(-2) + '.jpg';
    var imageBlob = imageResponse.getBlob().setName(fileName);
    var savedFile = folder.createFile(imageBlob);
    savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    downloaded.push({
      placeholder: holder,
      fileName: fileName,
      fileId: savedFile.getId(),
      creditText: searchResult.creditText
    });

    Logger.log('💾 Unsplash 이미지 저장 완료: ' + fileName + ' / ' + searchResult.creditText);
  }

  Logger.log('✅ Unsplash Drive 저장 완료: ' + downloaded.length + '개');
  return downloaded;
}

function mapUnsplashPhotosToPlaceholders_(docContent, finalData, title) {
  if (!docContent) return '';

  try {
    var resultBody = docContent;
    var mappedCount = 0;
    var unmappedHolders = [];
    var queryCache = {};
    var placeholderMatches = docContent.match(/\[사진\s*\d+(?:\s*:[^\]]*)?\]/g) || [];
    var uniqueHolders = Array.from(new Set(placeholderMatches)).sort(function(a, b) {
      var numA = parseInt(a.match(/\d+/)[0], 10);
      var numB = parseInt(b.match(/\d+/)[0], 10);
      return numA - numB;
    });

    for (var i = 0; i < uniqueHolders.length; i++) {
      var holder = uniqueHolders[i];
      var query = buildUnsplashKeywordFromHolder_(holder, finalData, title);
      var searchResult = queryCache[query];

      if (searchResult === undefined) {
        searchResult = query ? searchUnsplashPhoto_(query) : { imageUrl: '', creditText: '' };
        queryCache[query] = searchResult;
      }

      if (searchResult.imageUrl) {
        var photoDescription = extractPhotoDescriptionFromHolder_(holder);
        var escapedHolder = holder.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp(escapedHolder, "g");
        resultBody = resultBody.replace(regex, buildBloggerImageToken_(searchResult.imageUrl, photoDescription));
        mappedCount++;
        Logger.log("🖼️ Unsplash 적용: " + searchResult.creditText);
      } else {
        unmappedHolders.push(holder);
      }
    }

    var beforeClean = resultBody;
    resultBody = resultBody.replace(/\[사진\s*\d+[^\]]*\]/g, '');
    var removedCount = (beforeClean.match(/\[사진\s*\d+[^\]]*\]/g) || []).length;

    Logger.log("✅ Unsplash 사진 매핑 완료: 총 " + mappedCount + "개 교체됨");
    if (removedCount > 0) {
      Logger.log("🗑️ Unsplash 사진 가이드 텍스트 제거: " + removedCount + "개");
    }
    if (unmappedHolders.length > 0) {
      Logger.log("⚠️ Unsplash 미매핑 홀더 (" + unmappedHolders.length + "개): " + unmappedHolders.join(", "));
    }

    return resultBody;
  } catch (error) {
    Logger.log("❌ 오류 발생 (mapUnsplashPhotosToPlaceholders_): " + error.message);
    Logger.log("❌ Unsplash 사진 매핑 스택: " + error.stack);
    return docContent;
  }
}

function testUnsplashAPI() {
  try {
    Logger.log("🧪 Unsplash API 테스트 시작");
    var result = searchUnsplashPhoto_('window frame');
    Logger.log("📡 응답 코드: " + result.responseCode);
    Logger.log("🖼️ 이미지 URL: " + (result.imageUrl || '없음'));
    Logger.log("📝 출처: " + result.creditText);
    Logger.log(result.imageUrl ? "✅ Unsplash API 테스트 성공" : "⚠️ Unsplash 검색 결과 없음");
    return result;
  } catch (error) {
    Logger.log("❌ testUnsplashAPI 실행 오류: " + error.message);
    Logger.log("❌ testUnsplashAPI 스택: " + error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

function testUnsplashDownload() {
  var testFolderId = '1wpVU90Cg7DZ1G8syZK4V1CxH0PuVV5oT';

  try {
    Logger.log('🧪 Unsplash 다운로드 테스트 시작');
    Logger.log('🔎 테스트 키워드: natural gypsum board');
    Logger.log('📁 저장 대상 폴더 ID: ' + testFolderId);

    var searchResult = searchUnsplashPhoto_('natural gypsum board');
    Logger.log('📡 Unsplash 응답 코드: ' + searchResult.responseCode);
    Logger.log('🖼️ 이미지 URL: ' + (searchResult.imageUrl || '없음'));
    Logger.log('📝 출처: ' + searchResult.creditText);

    if (!searchResult.imageUrl) {
      Logger.log('❌ 테스트 중단: 검색 결과 이미지 URL이 없습니다.');
      return {
        success: false,
        responseCode: searchResult.responseCode,
        imageUrl: '',
        error: '검색 결과 없음'
      };
    }

    Logger.log('🔽 이미지 다운로드 시도');
    var imageResponse = UrlFetchApp.fetch(searchResult.imageUrl, {
      method: 'get',
      muteHttpExceptions: true
    });
    var imageCode = imageResponse.getResponseCode();
    Logger.log('📡 이미지 다운로드 응답 코드: ' + imageCode);

    if (imageCode < 200 || imageCode >= 300) {
      Logger.log('❌ 이미지 다운로드 실패');
      return {
        success: false,
        responseCode: searchResult.responseCode,
        imageUrl: searchResult.imageUrl,
        downloadCode: imageCode,
        error: imageResponse.getContentText()
      };
    }

    var folder = DriveApp.getFolderById(testFolderId);
    var existingFiles = folder.getFilesByName('test_01.jpg');
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }

    Logger.log('💾 Drive 저장 시도: test_01.jpg');
    var savedFile = folder.createFile(imageResponse.getBlob().setName('test_01.jpg'));
    savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('✅ Drive 저장 성공: test_01.jpg / ' + savedFile.getId());
    Logger.log('🔗 Drive URL: ' + savedFile.getUrl());

    return {
      success: true,
      responseCode: searchResult.responseCode,
      imageUrl: searchResult.imageUrl,
      downloadCode: imageCode,
      fileId: savedFile.getId(),
      fileUrl: savedFile.getUrl()
    };
  } catch (error) {
    Logger.log('❌ testUnsplashDownload 오류: ' + error.message);
    Logger.log('❌ testUnsplashDownload 스택: ' + error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

function testGitHubImageUpload() {
  var sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=';
  var fileName = 'test_' + new Date().getTime() + '.png';

  try {
    Logger.log('🧪 GitHub 이미지 업로드 테스트 시작');
    Logger.log('📄 파일명: ' + fileName);

    var publicUrl = uploadImageToGitHub_(sampleBase64, fileName);

    Logger.log('✅ GitHub 이미지 업로드 테스트 성공');
    Logger.log('📡 응답 코드: 200~299 확인');
    Logger.log('🔗 공개 URL: ' + publicUrl);
    Logger.log('📁 GitHub 저장소 확인 경로: kangHo-Jun/Blog/images/' + fileName);

    return {
      success: true,
      fileName: fileName,
      publicUrl: publicUrl
    };
  } catch (error) {
    Logger.log('❌ testGitHubImageUpload 오류: ' + error.message);
    Logger.log('❌ testGitHubImageUpload 스택: ' + error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

function testImageGenOnly() {
  var baseName = "What's the Difference Between LVL, LVB and Normal Plywood_ - ACEALL WOOD";
  var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
  var finalSeoName = baseName + '_final_seo.json';
  var preprocessName = baseName + '_preprocess.json';
  var finalData = null;
  var title = baseName;
  var imageFolder = null;
  var openAiImage1 = null;
  var generatedImage2 = null;
  var prompt1 = '';
  var primaryType = '';

  try {
    Logger.log('🧪 === testImageGenOnly 시작 ===');
    Logger.log('📄 대상 baseName: ' + baseName);

    var finalSeoFiles = jsonOutputFolder.getFilesByName(finalSeoName);
    if (finalSeoFiles.hasNext()) {
      finalData = JSON.parse(finalSeoFiles.next().getBlob().getDataAsString());
      title = extractTitleFromContent_(finalData.content, finalData.baseName || baseName);
      Logger.log('✅ 기존 _final_seo.json 사용: ' + finalSeoName);
    } else {
      Logger.log('ℹ️ 기존 _final_seo.json 없음. _preprocess.json 기반으로 imagen_prompts만 생성합니다.');

      var preprocessFiles = jsonOutputFolder.getFilesByName(preprocessName);
      if (!preprocessFiles.hasNext()) {
        Logger.log('❌ _preprocess.json 파일을 찾지 못했습니다: ' + preprocessName);
        return {
          success: false,
          error: '_preprocess.json not found'
        };
      }

      var settings = loadRunSettings();
      var apiKey = getClaudeKey_();
      if (!settings || !apiKey) {
        Logger.log('❌ 실행 설정 또는 Claude API 키가 없습니다.');
        return {
          success: false,
          error: 'missing settings or Claude API key'
        };
      }

      var preprocessData = JSON.parse(preprocessFiles.next().getBlob().getDataAsString());
      var prompt = createReconstructedPromptWithTemplate(
        preprocessData,
        settings.weights,
        settings.seoKeywords,
        settings.highlightKeywords,
        settings.templateData,
        settings.styleData
      );

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

      var claudeResult = callClaudeJsonPayload_(apiKey, payload);
      if (!claudeResult.ok) {
        Logger.log('❌ Claude imagen_prompts 생성 실패: ' + (claudeResult.message || 'unknown error'));
        if (claudeResult.rawResponseText) {
          Logger.log('🧪 Claude 원본 응답(앞 500자): ' + String(claudeResult.rawResponseText).substring(0, 500));
        }
        if (claudeResult.responseText) {
          Logger.log('🧪 Claude 응답 본문(앞 500자): ' + String(claudeResult.responseText).substring(0, 500));
        }
        return {
          success: false,
          error: claudeResult.message || 'Claude call failed'
        };
      }

      finalData = {
        baseName: baseName,
        content: String((claudeResult.generatedPayload || {}).content || '').trim(),
        content_type: (claudeResult.generatedPayload || {}).content_type || {},
        visual_strategy: (claudeResult.generatedPayload || {}).visual_strategy || {},
        imagen_prompts: Array.isArray((claudeResult.generatedPayload || {}).imagen_prompts) ? claudeResult.generatedPayload.imagen_prompts : []
      };
      title = extractTitleFromContent_(finalData.content, baseName);
      Logger.log('✅ Claude로 imagen_prompts 생성 완료 (_final_seo.json 미저장)');
    }

    var imagenPrompts = Array.isArray(finalData.imagen_prompts) ? finalData.imagen_prompts : [];
    primaryType = String(((finalData.content_type || {}).primary) || '').trim();
    for (var i = 0; i < imagenPrompts.length; i++) {
      var item = imagenPrompts[i] || {};
      var imageNo = Number(item.image_no);
      var promptText = String(item.prompt || item.text || '').trim();
      if (imageNo === 1 && promptText) prompt1 = promptText;
    }

    if (!prompt1) {
      Logger.log('❌ image1 prompt가 비어 있습니다.');
      Logger.log('🧾 imagen_prompts 원본: ' + JSON.stringify(imagenPrompts));
      return {
        success: false,
        error: 'missing image1 prompt'
      };
    }

    Logger.log('🧾 image1 prompt(앞 300자): ' + prompt1.substring(0, 300));
    Logger.log('🧾 image2 SVG primaryType: ' + (primaryType || '없음'));

    imageFolder = createImageFolderForPost_(title);
    Logger.log('📁 테스트 이미지 폴더 ID: ' + imageFolder.getId());

    var openAiFileName = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss') + '_' +
      String(title || 'image').substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '_') + '_01_openai.png';
    openAiImage1 = generateImageWithOpenAI_(prompt1, imageFolder.getId(), openAiFileName);
    var image2Svg = generateImage2AsSvg_(finalData.visual_strategy, primaryType, finalData.image2_table_data);
    var image2FileName = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss') + '_' +
      String(title || 'image').substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '_') + '_02.svg';
    var image2Blob = Utilities.newBlob(image2Svg, 'image/svg+xml', image2FileName);
    var image2Url = uploadBlobToGitHub_(image2Blob, image2FileName);
    generatedImage2 = {
      fileName: image2FileName,
      mimeType: 'image/svg+xml',
      publicUrl: image2Url,
      responseCode: 200
    };

    if (!openAiImage1 || !openAiImage1.publicUrl) {
      Logger.log('❌ image1 OpenAI 생성 또는 GitHub 업로드 실패');
      return {
        success: false,
        error: 'image1 openai generation failed'
      };
    }

    if (!generatedImage2 || !generatedImage2.publicUrl) {
      Logger.log('❌ 이미지2 생성 또는 GitHub 업로드 실패');
      return {
        success: false,
        error: 'image2 generation failed'
      };
    }

    Logger.log('🖼️ image1 OpenAI: ' + openAiImage1.publicUrl);
    Logger.log('🖼️ image2 SVG: ' + generatedImage2.publicUrl);
    Logger.log('🧾 image2 SVG(앞 500자): ' + image2Svg.substring(0, 500));

    return {
      success: true,
      baseName: baseName,
      title: title,
      image1: openAiImage1.publicUrl,
      image2: generatedImage2.publicUrl,
      prompt1: prompt1,
      image2Svg: image2Svg
    };
  } catch (error) {
    Logger.log('❌ testImageGenOnly 오류: ' + error.message);
    Logger.log('❌ testImageGenOnly 스택: ' + error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

function loadFixedImageGenTestData_() {
  var baseName = "What's the Difference Between LVL, LVB and Normal Plywood_ - ACEALL WOOD";
  var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
  var finalSeoName = baseName + '_final_seo.json';
  var finalSeoFiles = jsonOutputFolder.getFilesByName(finalSeoName);

  if (!finalSeoFiles.hasNext()) {
    throw new Error('_final_seo.json 파일을 찾지 못했습니다: ' + finalSeoName);
  }

  var finalData = JSON.parse(finalSeoFiles.next().getBlob().getDataAsString());
  var title = extractTitleFromContent_(finalData.content, finalData.baseName || baseName);
  var imagenPrompts = Array.isArray(finalData.imagen_prompts) ? finalData.imagen_prompts : [];
  var prompt1 = '';

  for (var i = 0; i < imagenPrompts.length; i++) {
    var item = imagenPrompts[i] || {};
    var imageNo = Number(item.image_no);
    var promptText = String(item.prompt || item.text || '').trim();
    if (imageNo === 1 && promptText) {
      prompt1 = promptText;
      break;
    }
  }

  if (!prompt1) {
    throw new Error('image1 prompt가 비어 있습니다.');
  }

  return {
    baseName: baseName,
    finalData: finalData,
    title: title,
    prompt1: prompt1,
    primaryType: String(((finalData.content_type || {}).primary) || '').trim()
  };
}

function testImageGenOnly_OpenAI() {
  try {
    Logger.log('🧪 === testImageGenOnly_OpenAI 시작 ===');
    var testData = loadFixedImageGenTestData_();
    var imageFolder = createImageFolderForPost_(testData.title);
    Logger.log('📁 테스트 이미지 폴더 ID: ' + imageFolder.getId());
    Logger.log('🧾 image1 prompt(앞 300자): ' + testData.prompt1.substring(0, 300));

    var openAiFileName = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss') + '_' +
      String(testData.title || 'image').substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '_') + '_01_openai.png';
    var openAiImage1 = generateImageWithOpenAI_(testData.prompt1, imageFolder.getId(), openAiFileName);
    if (!openAiImage1 || !openAiImage1.publicUrl) {
      Logger.log('❌ OpenAI image1 생성 실패');
      return {
        success: false,
        error: 'openai image1 generation failed'
      };
    }

    Logger.log('🖼️ image1 OpenAI: ' + openAiImage1.publicUrl);
    return {
      success: true,
      image1: openAiImage1.publicUrl,
      prompt1: testData.prompt1
    };
  } catch (error) {
    Logger.log('❌ testImageGenOnly_OpenAI 오류: ' + error.message);
    Logger.log('❌ testImageGenOnly_OpenAI 스택: ' + error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

function testImageGenOnly_SVG() {
  try {
    Logger.log('🧪 === testImageGenOnly_SVG 시작 ===');
    var testData = loadFixedImageGenTestData_();
    var image2Svg = generateImage2AsSvg_(testData.finalData.visual_strategy, testData.primaryType, testData.finalData.image2_table_data);
    var image2FileName = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss') + '_' +
      String(testData.title || 'image').substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '_') + '_02.svg';
    var image2Blob = Utilities.newBlob(image2Svg, 'image/svg+xml', image2FileName);
    var image2Url = uploadBlobToGitHub_(image2Blob, image2FileName);

    Logger.log('🖼️ image2 SVG: ' + image2Url);
    Logger.log('🧾 image2 SVG(앞 500자): ' + image2Svg.substring(0, 500));
    return {
      success: true,
      image2SvgUrl: image2Url,
      image2Svg: image2Svg
    };
  } catch (error) {
    Logger.log('❌ testImageGenOnly_SVG 오류: ' + error.message);
    Logger.log('❌ testImageGenOnly_SVG 스택: ' + error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
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
 * @param {string[]=} seoKeywords - SEO 키워드 목록
 * @param {{title:string,url:string}[]=} relatedPosts - 관련 글 목록
 * @return {string} Blogger 에디터용 HTML 코드
 */
function isMarkdownTableSeparatorLine_(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(String(line || '').trim());
}

function splitMarkdownTableRow_(line) {
  var normalized = String(line || '').trim();
  if (normalized.charAt(0) === '|') normalized = normalized.substring(1);
  if (normalized.charAt(normalized.length - 1) === '|') normalized = normalized.substring(0, normalized.length - 1);
  return normalized.split('|').map(function(cell) {
    return String(cell || '').trim();
  });
}

function convertMarkdownTableToHtml_(text) {
  var tableText = String(text || '').trim();
  if (!tableText) return '';

  var lines = tableText.split('\n').map(function(line) {
    return String(line || '').trim();
  }).filter(function(line) {
    return line !== '';
  });

  if (lines.length < 3 || !isMarkdownTableSeparatorLine_(lines[1])) {
    return '';
  }

  var headers = splitMarkdownTableRow_(lines[0]);
  var htmlParts = [];
  htmlParts.push('<table style="border-collapse:collapse; width:100%; margin:20px 0;">');
  htmlParts.push('<thead><tr>');
  for (var h = 0; h < headers.length; h++) {
    htmlParts.push('<th style="background:#2c5f8a; color:white; padding:10px; text-align:center;">' + escapeHtml(headers[h]) + '</th>');
  }
  htmlParts.push('</tr></thead>');
  htmlParts.push('<tbody>');

  for (var i = 2; i < lines.length; i++) {
    var rowCells = splitMarkdownTableRow_(lines[i]);
    if (rowCells.length === 1 && rowCells[0] === '') continue;
    htmlParts.push('<tr' + ((i - 2) % 2 === 1 ? ' style="background:#f0f4f8;"' : '') + '>');
    for (var c = 0; c < headers.length; c++) {
      var cellValue = c < rowCells.length ? rowCells[c] : '';
      htmlParts.push('<td style="border:1px solid #cccccc; padding:8px; text-align:center;">' + escapeHtml(String(cellValue || '').trim()) + '</td>');
    }
    htmlParts.push('</tr>');
  }

  htmlParts.push('</tbody>');
  htmlParts.push('</table>');
  return htmlParts.join('');
}

function convertToBloggerHTML(docContent, title, seoKeywords, relatedPosts) {
  if (!docContent) return "";
  
  // HTML 특수문자 이스케이프 함수
  var escapeHtml = function(text) {
    if (!text) return "";
    return text.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  var renderInlineText = function(text, localTagCount) {
    var processedText = escapeHtml(text);
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, function(match, p1) {
      if (localTagCount) localTagCount.strong++;
      return "<strong>" + p1 + "</strong>";
    });
    return processedText;
  };

  var isRawImageUrl = function(line) {
    return line.indexOf('https://drive.google.com/uc') !== -1 ||
      line.indexOf('https://raw.githubusercontent.com/') !== -1 ||
      line.indexOf('https://lh3.googleusercontent.com/') !== -1 ||
      line.indexOf('https://images.unsplash.com/') !== -1;
  };

  var buildImageHtml = function(url, description) {
    var safeDescription = escapeHtml(description || '관련 이미지');
    return "<div style=\"width:100%; margin:2em 0;\">\n" +
      "  <img src=\"" + url + "\" alt=\"" + safeDescription + "\" style=\"width:100%; height:auto; display:block; border-radius:8px;\">\n" +
      "  <p style=\"text-align:center; color:#888; font-size:0.85em; margin-top:0.5em;\">▲ " + safeDescription + " (출처: (주)대산 기술팀)</p>\n" +
      "</div>\n";
  };

  var buildCtaHtml = function(materialName) {
    var safeMaterialName = escapeHtml(materialName || '건축자재');
    return "<div style=\"background:#1a3a5c; color:white; padding:2em; margin:2em 0; border-radius:8px; text-align:center;\">\n" +
      "  <p style=\"font-size:1.2em; font-weight:500; margin:0 0 0.5em; color:white;\">지금 바로 견적 받아보세요</p>\n" +
      "  <p style=\"font-size:0.9em; margin:0 0 1.2em; color:rgba(255,255,255,0.85); line-height:1.7;\">" + safeMaterialName + " 비용이 궁금하신가요?<br>대산 실시간 견적 시스템으로 30초 안에 확인하세요</p>\n" +
      "  <a href=\"https://daesan.ai\" style=\"display:inline-block; background:white; color:#1a3a5c; padding:0.7em 2em; border-radius:8px; font-weight:500; font-size:0.9em; text-decoration:none;\">견적 받기 →</a>\n" +
      "</div>\n";
  };

  var buildSignatureHtml = function() {
    return "<div style=\"border-top:1px solid #ddd; margin-top:3em; padding-top:1.5em; color:#666; font-size:0.9em; line-height:1.8;\">\n" +
      "  <p style=\"margin:0.3em 0;\">이 글은 <strong>(주)대산 기술팀</strong>이 직접 작성했습니다.</p>\n" +
      "  <p style=\"margin:0.3em 0;\">30년 건축자재 전문 노하우를 바탕으로 정확한 정보만을 제공합니다.</p>\n" +
      "  <p style=\"margin:0.3em 0;\">공식 사이트: <a href=\"https://daesan.ai\" style=\"color:#2c5f8a; text-decoration:none;\">daesan.ai</a></p>\n" +
      "</div>\n";
  };

  var buildRelatedPostsHtml = function(posts) {
    if (!posts || posts.length === 0) return "";

    var htmlParts = [];
    htmlParts.push("<div style=\"margin-top:2.5em; padding:1.5em; background:#f7f9fc; border:1px solid #d9e3ee; border-radius:8px;\">");
    htmlParts.push("  <h2 style=\"font-size:1.3em; font-weight:500; margin:0 0 0.8em; color:#1a1a1a;\">관련 글</h2>");
    htmlParts.push("  <ul style=\"margin:0; padding-left:1.2em; color:#2c5f8a;\">");
    for (var rp = 0; rp < posts.length; rp++) {
      var post = posts[rp];
      htmlParts.push("    <li style=\"margin:0.45em 0;\"><a href=\"" + escapeHtml(post.url) + "\" style=\"color:#2c5f8a; text-decoration:none; line-height:1.7;\">" + escapeHtml(post.title) + "</a></li>");
    }
    htmlParts.push("  </ul>");
    htmlParts.push("</div>\n");
    return htmlParts.join("\n");
  };

  var buildFaqHtml = function(faqItems) {
    if (!faqItems || faqItems.length === 0) return "";

    var htmlParts = [];
    htmlParts.push("<div style=\"margin-top:2.5em;\">");
    htmlParts.push("  <h2 style=\"font-size:1.3em; font-weight:500; margin:0 0 0.8em; color:#1a1a1a;\">자주 묻는 질문</h2>");
    htmlParts.push("  <div itemscope itemtype=\"https://schema.org/FAQPage\">");
    for (var fq = 0; fq < faqItems.length; fq++) {
      var item = faqItems[fq];
      htmlParts.push("    <div itemscope itemprop=\"mainEntity\" itemtype=\"https://schema.org/Question\" style=\"margin:0 0 1.1em; padding:1rem 1.2rem; background:#f7f9fc; border:1px solid #d9e3ee; border-radius:8px;\">");
      htmlParts.push("      <h3 itemprop=\"name\" style=\"font-size:1.05em; margin:0 0 0.55em; color:#2c5f8a; font-weight:500;\">Q. " + escapeHtml(item.question) + "</h3>");
      htmlParts.push("      <div itemscope itemprop=\"acceptedAnswer\" itemtype=\"https://schema.org/Answer\">");
      htmlParts.push("        <p itemprop=\"text\" style=\"margin:0; color:#333; line-height:1.8;\">A. " + escapeHtml(item.answer) + "</p>");
      htmlParts.push("      </div>");
      htmlParts.push("    </div>");
    }
    htmlParts.push("  </div>");
    htmlParts.push("</div>\n");
    return htmlParts.join("\n");
  };

  var html = "";
  var tagCount = { h1: 0, h2: 0, p: 0, img: 0, strong: 0, div: 0 };
  
  // 1. 제목 (H1) - 이스케이프 적용
  html += "<h1 style=\"font-size: 2em; margin-bottom: 0.5em;\">" + escapeHtml(title) + "</h1>\n";
  tagCount.h1++;
  
  // 2. 본문 처리
  var lines = docContent.split('\n');
  var totalH2 = 0;
  for (var h2Scan = 0; h2Scan < lines.length; h2Scan++) {
    if (String(lines[h2Scan] || '').trim().indexOf('## ') === 0) totalH2++;
  }

  var ctaInsertIndex = totalH2 > 0 ? Math.ceil(totalH2 / 2) : 0;
  var insertedCta = false;
  var renderedH2 = 0;
  var ctaKeyword = seoKeywords && seoKeywords.length > 0 ? seoKeywords[0] : '건축자재';
  var faqItems = [];
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    // 본문 첫 줄의 마크다운 제목은 이미 H1으로 출력했으므로 제거
    if (line.indexOf('# ') === 0) {
      var markdownTitle = line.substring(2).trim();
      if (!markdownTitle || markdownTitle === String(title || '').trim()) {
        continue;
      }
    }

    if (line.charAt(0) === '|' && i + 1 < lines.length && isMarkdownTableSeparatorLine_(String(lines[i + 1] || '').trim())) {
      var tableLines = [line];
      var tableIndex = i + 1;
      while (tableIndex < lines.length) {
        var tableLine = String(lines[tableIndex] || '').trim();
        if (!tableLine || tableLine.charAt(0) !== '|') break;
        tableLines.push(tableLine);
        tableIndex++;
      }

      var tableHtml = convertMarkdownTableToHtml_(tableLines.join('\n'));
      if (tableHtml) {
        html += tableHtml + "\n";
        tagCount.div++;
        i = tableIndex - 1;
        continue;
      }
    }
    
    // 소제목 (##) -> H2 (내용물만 이스케이프)
    if (line.indexOf('## ') === 0) {
      if (!insertedCta && ctaInsertIndex > 0 && renderedH2 === ctaInsertIndex) {
        html += buildCtaHtml(ctaKeyword);
        tagCount.div++;
        insertedCta = true;
      }
      var h2Text = escapeHtml(line.substring(3).trim());
      html += "<h2 style=\"font-size:1.5em; font-weight:500; margin-top:2em; padding-top:1em; border-top:3px solid #2c5f8a; color:#1a1a1a;\">" + h2Text + "</h2>\n";
      tagCount.h2++;
      renderedH2++;
    }
    // 소제목 (###) -> H3
    else if (line.indexOf('### ') === 0) {
      var h3Text = escapeHtml(line.substring(4).trim());
      html += "<h3 style=\"font-size:1.2em; margin-top:1.2em; margin-bottom:0.5em; color:#2c5f8a; font-weight:500;\">" + h3Text + "</h3>\n";
    }
    else if (parseBloggerImageToken_(line)) {
      var tokenData = parseBloggerImageToken_(line);
      html += buildImageHtml(tokenData.url, tokenData.description);
      tagCount.img++;
      tagCount.div++;
    }
    else if (isRawImageUrl(line)) {
      html += buildImageHtml(line, '관련 이미지');
      tagCount.img++;
      tagCount.div++;
    }
    else if (/^\*\*[^*]+:\*\*/.test(line)) {
      var highlightLines = [];
      while (i < lines.length && /^\*\*[^*]+:\*\*/.test(String(lines[i] || '').trim())) {
        highlightLines.push(String(lines[i] || '').trim());
        i++;
      }
      i--;

      html += "<div style=\"background:#f0f6ff; border-left:4px solid #2c5f8a; padding:1rem 1.5rem; margin:1.5rem 0; border-radius:0 8px 8px 0;\">\n";
      for (var hl = 0; hl < highlightLines.length; hl++) {
        html += "  <p style=\"line-height:1.8; margin:0 0 0.8em; color:#1a1a1a;\">" + renderInlineText(highlightLines[hl], tagCount) + "</p>\n";
      }
      html += "</div>\n";
      tagCount.div++;
    }
    else if (/%/.test(line)) {
      var metricLines = [];
      var metricIndex = i;
      while (metricIndex < lines.length && /\d+(?:\.\d+)?%/.test(String(lines[metricIndex] || '').trim())) {
        metricLines.push(String(lines[metricIndex] || '').trim());
        metricIndex++;
      }

      if (metricLines.length >= 3) {
        html += "<div style=\"display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:1.5rem 0;\">\n";
        for (var ml = 0; ml < metricLines.length; ml++) {
          var metricLine = metricLines[ml];
          var metricMatch = metricLine.match(/(\d+(?:\.\d+)?%)/);
          var metricValue = metricMatch ? metricMatch[1] : '';
          var metricLabel = metricLine.replace(metricValue, '').replace(/^[-•\s]+/, '').trim() || '핵심 지표';
          html += "  <div style=\"background:#f5f7fa; border-radius:8px; padding:1rem; text-align:center;\">\n";
          html += "    <p style=\"font-size:1.5em; font-weight:500; color:#2c5f8a; margin:0 0 4px;\">" + escapeHtml(metricValue) + "</p>\n";
          html += "    <p style=\"font-size:0.8em; color:#888; margin:0;\">" + escapeHtml(metricLabel) + "</p>\n";
          html += "  </div>\n";
        }
        html += "</div>\n";
        tagCount.div++;
        i = metricIndex - 1;
      } else {
        html += "<p style=\"line-height:1.8; margin-bottom:1.2em; color:#222;\">" + renderInlineText(line, tagCount) + "</p>\n";
        tagCount.p++;
      }
    }
    else if (/^".+"$/.test(line)) {
      html += "<div style=\"border-left:3px solid #2c5f8a; padding:1rem 1.5rem; margin:1.5rem 0; font-style:italic; color:#555; font-size:1em; line-height:1.8;\">\n";
      html += escapeHtml(line) + "\n";
      html += "<p style=\"font-size:0.85em; color:#888; margin-top:0.5em; font-style:normal;\">— (주)대산 기술팀</p>\n";
      html += "</div>\n";
      tagCount.div++;
    }
    else if (/^Q\.\s+/.test(line)) {
      var answerLine = '';
      var nextLine = i + 1 < lines.length ? String(lines[i + 1] || '').trim() : '';
      if (/^A\.\s+/.test(nextLine)) {
        answerLine = nextLine.replace(/^A\.\s+/, '').trim();
        i++;
      }

      faqItems.push({
        question: line.replace(/^Q\.\s+/, '').trim(),
        answer: answerLine || '자세한 내용은 본문을 참고하세요.'
      });
    }
    // 일반 문단 처리
    else {
      var processedText = renderInlineText(line, tagCount);
      html += "<p style=\"line-height:1.8; margin-bottom:1.2em; color:#222;\">" + processedText + "</p>\n";
      tagCount.p++;
    }
  }

  if (!insertedCta && totalH2 === 0) {
    html += buildCtaHtml(ctaKeyword);
    tagCount.div++;
  }

  if (faqItems.length > 0) {
    html += buildFaqHtml(faqItems.slice(0, 3));
    tagCount.div++;
  }

  if (relatedPosts && relatedPosts.length > 0) {
    Logger.log('🔗 HTML 관련 글 블록 삽입: ' + relatedPosts.length + '개');
    html += buildRelatedPostsHtml(relatedPosts);
    tagCount.div++;
  } else {
    Logger.log('⚠️ HTML 관련 글 블록 삽입 스킵: relatedPosts 비어 있음');
  }

  html += buildSignatureHtml();
  tagCount.div++;
  
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
    "[[IMG::https%3A%2F%2Flh3.googleusercontent.com%2Fd%2F1zhLKKQBOAxH1twa-oCdbKB_tS-w5z7A2::%EC%B0%BD%ED%98%B8%20%EB%8B%A8%EB%A9%B4%20%EC%98%88%EC%8B%9C]]\n\n" +
    "## 2. 주요 특징\n" +
    "**VOC 감소:** 실내 공기질 개선 효과를 기대할 수 있습니다.\n" +
    "**단열 성능:** 계절별 냉난방 부담을 줄입니다.\n\n" +
    "82% VOC 감소\n" +
    "65% 단열 향상\n" +
    "38% 유지보수 감소\n\n" +
    "\"현장에서는 작은 자재 차이가 최종 만족도를 크게 바꿉니다.\"\n" +
    "### 2.1 세부 사항\n" +
    "프레임의 두께가 얇아지면서 시야가 넓어졌습니다.";
    
  Logger.log("🧪 Blogger HTML 변환 테스트 시작...");
  var resultHtml = convertToBloggerHTML(testContent, testTitle, ['친환경 창호']);
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
function publishToBlogger(title, htmlContent, labels, publishMode, scheduledTime, highlightKeywords) {
  var isDraft = (publishMode !== '자동');
  var apiUrl = 'https://www.googleapis.com/blogger/v3/blogs/' + BLOG_ID + '/posts/' + (isDraft ? '?isDraft=true' : '');

  try {
    labels = (labels || [])
      .filter(function(l) { return typeof l === 'string' && l.trim() !== ''; })
      .map(function(l) { return l.trim().substring(0, 200); });
    var category = detectCategory_(labels, highlightKeywords || [], title);
    if (labels.indexOf(category) === -1) {
      labels.push(category);
    }

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
    { label: '시나리오 1 - H열 비움', scheduleRaw: '' },
    { label: '시나리오 2 - H열 = 2026-05-10 10:00', scheduleRaw: '2026-05-10 10:00' }
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

    Logger.log('🕐 H열 원본값: ' + (scheduleRaw ? String(scheduleRaw) : '비어있음'));

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
function updateControlSheetAfterPublish(title, postUrl, rowIndex, status) {
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

    sheet.getRange(rowIndex, 7).setValue(status || '발행완료');
    sheet.getRange(rowIndex, 9).setValue(postUrl);
    
    Logger.log('📊 컨트롤 시트 업데이트 완료 (행: ' + rowIndex + ', 상태: ' + (status || '발행완료') + ', URL: I열)');
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
