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
      throw new Error('시트2을 찾을 수 없습니다.');
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
    missing.push('F열 발행방법 (자동 또는 수동승인)');
  }

  if (missing.length > 0) {
    return {
      ok: false,
      rowIndex: rowIndex || 2,
      message: '필수 설정 누락: ' + missing.join(', ')
    };
  }

  return {
    ok: true,
    rowIndex: rowIndex || 2,
    message: '설정 확인 완료'
  };
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
