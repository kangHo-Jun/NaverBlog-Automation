/**
 * HTML 태그 제거 함수
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

/**
 * 특정 HTML 태그 내의 텍스트 추출 (H2 등)
 */
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

/**
 * 문단 분할
 */
function splitParagraphs(text) {
  return String(text).split(/[\r\n]{2,}/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
}

/**
 * 문장 분할
 */
function splitSentences(text) {
  return String(text).split(/[.!?][\s]+|\n+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
}

/**
 * 상위 키워드 추출
 */
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

/**
 * 카테고리 자동 감지
 */
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

/**
 * 불릿 비율 계산
 */
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

/**
 * 존댓말 점수 계산
 */
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
