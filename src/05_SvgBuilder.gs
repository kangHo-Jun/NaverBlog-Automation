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
