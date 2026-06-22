function crawlNaver_ByKeywords_FromSheet() {
  var CFG = {
    SHEET_ID: PropertiesService.getScriptProperties().getProperty('CRAWL_SHEET_ID') || '1hlP8hwb6PcUFyyPulXDH7cfGY4nkK9EcMXyjWIMaGCo',
    INPUT_SHEET: '시트1',
    OUTPUT_SHEET: '시트2',
    MAX_POSTS: 30,
    MAX_PAGES: 100,
    REQUIRE_ALL: false,
    UA_PC: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    UA_MOB: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
    HEADERS: { 'Accept-Language': 'ko-KR,ko;q=0.9' }
  };

  var ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var inSheet = ss.getSheetByName(CFG.INPUT_SHEET) || ss.getActiveSheet();
  var outSheet = ss.getSheetByName(CFG.OUTPUT_SHEET) || ss.insertSheet(CFG.OUTPUT_SHEET);

  var BLOG_ID = (inSheet.getRange('B2').getDisplayValue() || '').trim();
  var C2 = (inSheet.getRange('C2').getDisplayValue() || '').trim();
  var D2 = (inSheet.getRange('D2').getDisplayValue() || '').trim();
  var kwList = []
    .concat(C2 ? C2.split(',') : [])
    .concat(D2 ? D2.split(',') : [])
    .map(function(s) { return s.trim(); })
    .filter(Boolean);

  if (!BLOG_ID) throw new Error('B2(BLOG_ID)가 비어 있습니다. 예: gundalin923');
  if (!kwList.length) throw new Error('C2/D2 키워드를 입력하세요. 예: 다루끼,각재');

  outSheet.clear();
  outSheet.getRange(1, 1, 1, 3).setValues([['url', 'title', 'body']]);

  // logNo 수집
  var logNos = [];
  for (var page = 1; page <= CFG.MAX_PAGES; page++) {
    var listUrl = 'https://blog.naver.com/PostList.naver?blogId=' + encodeURIComponent(BLOG_ID) + '&categoryNo=0&currentPage=' + page;
    var html = crawl_fetchTxt_(listUrl, { 'User-Agent': CFG.UA_PC, 'Referer': 'https://blog.naver.com/' + BLOG_ID }, CFG.HEADERS);
    if (!html) break;
    crawl_pushAll_(logNos, html, new RegExp('/' + BLOG_ID + '/(\\d{6,})', 'g'), 1);
    crawl_pushAll_(logNos, html, /PostView\.(?:naver|nhn)\?[^"']*logNo=(\d{6,})/gi, 1);
    crawl_pushAll_(logNos, html, /data-log-no=["'](\d{6,})["']/gi, 1);
    crawl_pushAll_(logNos, html, /["']logNo["']\s*:\s*["'](\d{6,})["']/gi, 1);
    var uniq = Array.from ? Array.from(new Set(logNos)) : crawl_uniq_(logNos);
    logNos.length = 0;
    for (var i = 0; i < uniq.length; i++) logNos.push(uniq[i]);
    if (logNos.length >= CFG.MAX_POSTS * 3) break;
    if (html.toLowerCase().indexOf('logno') === -1) break;
    Utilities.sleep(200);
  }

  if (!logNos.length) {
    Logger.log('logNo 0건. BLOG_ID 확인: ' + BLOG_ID);
    return;
  }

  // 상세 + 키워드 필터
  var rows = [];
  var seen = {};
  for (var li = 0; li < logNos.length; li++) {
    if (rows.length >= CFG.MAX_POSTS) break;
    var logNo = logNos[li];
    try {
      var pcUrl = 'https://blog.naver.com/' + BLOG_ID + '/' + logNo;
      var deck = crawl_fetchTxt_(pcUrl, { 'User-Agent': CFG.UA_PC, 'Referer': 'https://blog.naver.com/' + BLOG_ID }, CFG.HEADERS);
      if (!deck) continue;

      var iSrc = crawl_getIframe_(deck);
      var postUrl = iSrc ? (iSrc.indexOf('http') === 0 ? iSrc : 'https://blog.naver.com' + iSrc)
                         : 'https://m.blog.naver.com/' + BLOG_ID + '/' + logNo;
      var postHtml = crawl_fetchTxt_(postUrl, { 'User-Agent': CFG.UA_PC, 'Referer': pcUrl }, CFG.HEADERS)
                  || crawl_fetchTxt_(postUrl, { 'User-Agent': CFG.UA_MOB, 'Referer': pcUrl }, CFG.HEADERS);
      if (!postHtml) continue;

      var title = crawl_getTitle_(postHtml);
      if (!title || seen[title]) continue;

      var body = crawl_grabBalanced_(postHtml, /<div[^>]+class=["'][^"']*se-main-container[^"']*["'][^>]*>/i)
              || crawl_joinAllBalanced_(postHtml, /<div[^>]+class=["'][^"']*se_component_wrap[^"']*["'][^>]*>/ig)
              || crawl_grabBalanced_(postHtml, /<div[^>]+id=["']postViewArea["'][^>]*>/i)
              || crawl_grabBalanced_(postHtml, /<article[^>]*>/i);
      if (!body) continue;

      var text = crawl_toText_(body);
      var haystack = (title + '\n' + text).toLowerCase().replace(/\s+/g, '');
      var kws = kwList.map(function(k) { return k.toLowerCase().replace(/\s+/g, ''); });
      var ok = CFG.REQUIRE_ALL
        ? kws.every(function(k) { return k && haystack.indexOf(k) !== -1; })
        : kws.some(function(k) { return k && haystack.indexOf(k) !== -1; });
      if (!ok) continue;

      rows.push([pcUrl, title, text]);
      seen[title] = true;
      Utilities.sleep(300);
    } catch (e) {
      Logger.log('상세 오류 logNo=' + logNo + ' :: ' + e);
    }
  }

  if (rows.length) outSheet.getRange(2, 1, rows.length, 3).setValues(rows);
  Logger.log('완료: ' + rows.length + '건 저장 → ' + CFG.OUTPUT_SHEET);
}

// ── 내부 헬퍼 (crawl_ 접두사로 충돌 방지) ─────────────────────────────────

function crawl_fetchTxt_(url, uaHeaders, commonHeaders) {
  try {
    var headers = {};
    for (var k in commonHeaders) headers[k] = commonHeaders[k];
    for (var k in uaHeaders) headers[k] = uaHeaders[k];
    var r = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, followRedirects: true, headers: headers });
    return r.getResponseCode() === 200 ? r.getContentText() : '';
  } catch (e) {
    Logger.log('fetch 실패 ' + url + ' :: ' + e);
    return '';
  }
}

function crawl_pushAll_(bucket, s, re, idx) {
  var m;
  while ((m = re.exec(s)) !== null) bucket.push(m[idx]);
}

function crawl_uniq_(arr) {
  var seen = {}, out = [];
  for (var i = 0; i < arr.length; i++) {
    if (!seen[arr[i]]) { seen[arr[i]] = true; out.push(arr[i]); }
  }
  return out;
}

function crawl_getIframe_(h) {
  var m = h.match(/<iframe[^>]+id=["']mainFrame["'][^>]+src=["']([^"']+)["']/i);
  if (m && m[1]) return m[1];
  m = h.match(/<iframe[^>]+src=["']([^"']*PostView\.(?:naver|nhn)\?[^"']+)["']/i);
  return m && m[1] ? m[1] : '';
}

function crawl_getTitle_(h) {
  var m = h.match(/<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i);
  if (m && m[1]) return crawl_decode_(m[1]).trim();
  m = h.match(/<title>([\s\S]*?)<\/title>/i);
  if (m && m[1]) return crawl_decode_(m[1]).trim().replace(/\s*:\s*네이버 블로그\s*$/i, '');
  return '';
}

function crawl_grabBalanced_(h, startRe) {
  var s = startRe.exec(h);
  if (!s) return '';
  var i0 = s.index;
  var open = /<div\b[^>]*>/ig, close = /<\/div>/ig;
  open.lastIndex = i0; close.lastIndex = i0;
  var depth = 0, started = false, o, c;
  while (true) {
    o = open.exec(h); c = close.exec(h);
    if (!started) { if (!o) return ''; started = true; depth = 1; continue; }
    if (!c) return '';
    if (o && o.index < c.index) depth++;
    else { depth--; if (depth === 0) return h.substring(i0, close.lastIndex); }
  }
}

function crawl_joinAllBalanced_(h, reG) {
  var out = [], re = reG, m;
  while ((m = re.exec(h)) !== null) {
    var tag = m[0];
    var blk = crawl_grabBalanced_(h.slice(m.index), new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    if (blk) out.push(blk);
    re.lastIndex = m.index + (blk ? blk.length : tag.length);
  }
  return out.length ? out.join('\n') : '';
}

function crawl_toText_(x) {
  return crawl_decode_(
    x.replace(/<(br|BR)\s*\/?>/g, '\n')
     .replace(/<\/(p|div|section|li|h[1-6]|tr|td|blockquote|article|figure|figcaption)>/gi, '\n')
     .replace(/<script[\s\S]*?<\/script>/gi, '')
     .replace(/<style[\s\S]*?<\/style>/gi, '')
     .replace(/<img[\s\S]*?>/gi, '')
     .replace(/<video[\s\S]*?<\/video>/gi, '')
     .replace(/<[^>]+>/g, ''))
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function crawl_decode_(s) {
  if (!s) return '';
  var map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
  s = s.replace(/&(amp|lt|gt|quot|#39);/g, function(m) { return map[m] || m; });
  s = s.replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 10)); });
  s = s.replace(/&#x([0-9a-fA-F]+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 16)); });
  return s;
}


// ═══════════════════════════════════════════════════════════════════════
//  크롤러 시트 버튼 설치 & 이벤트
// ═══════════════════════════════════════════════════════════════════════

/**
 * 시트1에 입력 레이블 + 체크박스 버튼(실행/초기화) 설치
 * 메뉴 > ⚙️ 크롤러 시트 버튼 설치 로 실행
 */
function setupCrawlerSheet_() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('CRAWL_SHEET_ID')
              || '1hlP8hwb6PcUFyyPulXDH7cfGY4nkK9EcMXyjWIMaGCo';
  var ss = SpreadsheetApp.openById(sheetId);
  var s = ss.getSheetByName('시트1') || ss.getActiveSheet();

  // ── 행 1: 헤더 ──────────────────────────────────────────────────────
  s.getRange('A1:F1').merge()
    .setValue('🔍 네이버 블로그 크롤러')
    .setBackground('#1a73e8').setFontColor('#ffffff')
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  s.setRowHeight(1, 38);

  // ── 행 2: 입력 레이블 ──────────────────────────────────────────────
  s.getRange('A2').setValue('블로그 ID').setFontWeight('bold').setBackground('#f1f3f4');
  s.getRange('B2').setBackground('#ffffff')
    .setBorder(true,true,true,true,null,null,'#dadce0', SpreadsheetApp.BorderStyle.SOLID)
    .setNote('예: gundalin923');

  s.getRange('C2').setValue('키워드').setFontWeight('bold').setBackground('#f1f3f4');
  s.getRange('D2').setBackground('#ffffff')
    .setBorder(true,true,true,true,null,null,'#dadce0', SpreadsheetApp.BorderStyle.SOLID)
    .setNote('쉼표로 여러 키워드 구분 가능. 예: 다루끼,각재');

  // ── 행 3: 체크박스 버튼 ────────────────────────────────────────────
  // 실행 버튼
  s.getRange('A3').insertCheckboxes().setValue(false);
  s.getRange('B3').setValue('▶ 크롤링 실행')
    .setBackground('#34a853').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(true,true,true,true,null,null,'#1e8e3e', SpreadsheetApp.BorderStyle.SOLID);

  // 초기화 버튼
  s.getRange('C3').insertCheckboxes().setValue(false);
  s.getRange('D3').setValue('🗑️ 결과 초기화')
    .setBackground('#ea4335').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(true,true,true,true,null,null,'#c5221f', SpreadsheetApp.BorderStyle.SOLID);

  // ── 열 너비 ────────────────────────────────────────────────────────
  s.setColumnWidth(1, 32);
  s.setColumnWidth(2, 160);
  s.setColumnWidth(3, 32);
  s.setColumnWidth(4, 160);
  s.setRowHeight(3, 32);

  // ── 시트2 헤더 보장 ────────────────────────────────────────────────
  var out = ss.getSheetByName('시트2') || ss.insertSheet('시트2');
  if (out.getLastRow() === 0) {
    out.getRange(1,1,1,3).setValues([['url','title','body']]);
  }

  SpreadsheetApp.getUi().alert(
    '버튼 설치 완료!\n\n'
    + 'B2: 블로그 ID 입력\n'
    + 'D2: 키워드 입력\n'
    + 'A3 체크박스: 크롤링 실행\n'
    + 'C3 체크박스: 결과 초기화'
  );
}

/** 시트2 결과 행 전체 삭제 (헤더 유지) */
function clearCrawlOutput_() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('CRAWL_SHEET_ID')
              || '1hlP8hwb6PcUFyyPulXDH7cfGY4nkK9EcMXyjWIMaGCo';
  var ss = SpreadsheetApp.openById(sheetId);
  var out = ss.getSheetByName('시트2');
  if (!out) { Logger.log('시트2 없음'); return; }
  var last = out.getLastRow();
  if (last > 1) out.deleteRows(2, last - 1);
  Logger.log('✅ 결과 시트 초기화 완료');
}

