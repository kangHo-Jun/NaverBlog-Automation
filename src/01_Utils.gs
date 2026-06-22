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
