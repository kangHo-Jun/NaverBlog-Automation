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

