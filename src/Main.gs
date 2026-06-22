

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
      .addSeparator()
      .addItem('🗑️ 템플릿 캐시 초기화', 'clearTemplateCache')
      .addSeparator()
      .addItem('🔍 네이버 블로그 크롤링', 'crawlNaver_ByKeywords_FromSheet')
      .addItem('⚙️ 크롤러 시트 버튼 설치', 'setupCrawlerSheet_')
      .addToUi();
  } catch (error) {
    Logger.log('⚠️ onOpen UI 생성 스킵: ' + error.message);
  }
}




/**
 * =======================================================================
 * [3] HTML 분석 및 전처리 함수들
 * =======================================================================
 */

/**
 * 향상된 HTML 태그 제거 (더 깔끔하게)
 */


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
 * 체크박스 클릭 감지 → 실행/초기화 트리거
 * 시트1 A3 체크 → crawlNaver_ByKeywords_FromSheet()
 * 시트1 C3 체크 → clearCrawlOutput_()
 *
 * 주의: Simple trigger는 openById 불가 → 설치형 트리거 필요 시
 *       onEditInstallable_() 을 트리거 등록하여 사용
 */
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  if (sheet.getName() !== '시트1') return;
  var cell = range.getA1Notation();

  if (cell === 'A3' && e.value === 'TRUE') {
    range.setValue(false);
    // B2(블로그ID), D2(키워드) → 기존 crawlNaver 함수가 읽는 B2/C2/D2에 복사
    var blogId = sheet.getRange('B2').getValue();
    var keyword = sheet.getRange('D2').getValue();
    sheet.getRange('B2').setValue(blogId);
    sheet.getRange('C2').setValue(keyword);
    crawlNaver_ByKeywords_FromSheet();
  }

  if (cell === 'C3' && e.value === 'TRUE') {
    range.setValue(false);
    clearCrawlOutput_();
    SpreadsheetApp.getUi().alert('결과 시트(시트2)가 초기화되었습니다.');
  }
}

function runV7HTMLPipeline() {
  Logger.log("🚀 === v7 HTML 전체 파이프라인 실행 ===");
  
  try {
    var jsonFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var fileIterator = jsonFolder.getFiles();
    var filesToDelete = [];
    
    while (fileIterator.hasNext()) {
      var file = fileIterator.next();
      var fileName = file.getName();
      if (fileName.indexOf('_preprocess.json') !== -1 || fileName.indexOf('_final_seo.json') !== -1) {
        filesToDelete.push(file);
      }
    }
    
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
    Logger.log("1️⃣ 파일 전처리");
    STEP_A_preprocessFiles();
    Utilities.sleep(2000);
    
    var geminiContext = STEP_B_geminiAnalysis();
    Utilities.sleep(2000);
    
    Logger.log("3️⃣ v7 HTML SEO 처리");
    processNextSEOFile_V7HTML(geminiContext);
    Utilities.sleep(2000);
    
    Logger.log("4️⃣ HTML 파일 저장");
    STEP_D2_SaveAsHTML();
    
    Logger.log("🎯 v7 HTML 파이프라인 완료!");
    toast_('v7 HTML 파이프라인 완료!');
    
  } catch (error) {
    Logger.log("❌ 파이프라인 오류: " + error.message);
    Logger.log("스택: " + error.stack);
  }
}
