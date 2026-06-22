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
 * 완전 재구성형 Claude 프롬프트 생성
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
               '- 숫자 나열 구조 남용 (3가지, 5가지 등)\n' +
               '- 사진 플레이스홀더 누락\n\n' +
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
               '  자재비교 유형이면 image1 프롬프트에 반드시 "side by side"를 명시하라\n' +
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
 * Claude JSON API 호출 함수
 */
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
    return { ok: false, type: 'rate_limit', message: 'Claude API 할당량 초과' };
  }

  if (responseCode !== 200) {
    return { ok: false, type: 'http_error', message: 'Claude HTTP 에러 ' + responseCode, responseText: responseText };
  }

  try {
    var resultObj = JSON.parse(responseText);
    var contentText = resultObj.content[0].text;
    
    // Markdown 코드블록 제거
    contentText = contentText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    
    return {
      ok: true,
      generatedPayload: JSON.parse(contentText),
      rawResponseText: contentText
    };
  } catch (parseError) {
    return { ok: false, type: 'parse_error', message: parseError.message, rawResponseText: responseText };
  }
}

/**
 * 부제목 추출 함수
 */
function extractSubtitle(content, seoKeywords) {
  var lines = content.split('\n').filter(function(line) { return line.trim().length > 0; });
  
  if (lines.length > 1) {
    var firstLine = lines[0].trim();
    var secondLine = lines[1].trim();
    
    if (firstLine.indexOf('# ') === 0 && secondLine.indexOf('##') !== 0) {
      if (secondLine.length >= 10 && secondLine.length <= 100) {
        Logger.log('📝 Claude가 생성한 부제목 사용: "' + secondLine + '"');
        return secondLine;
      }
    }
  }
  
  for (var i = 1; i < Math.min(lines.length, 5); i++) {
    var line = lines[i].trim();
    if (line.length > 10 && line.length < 100 && !line.startsWith('#') && !line.includes('[사진')) {
      Logger.log('📝 첫 문단에서 부제목 추출: "' + line + '"');
      return line;
    }
  }
  
  if (seoKeywords.length > 0) {
    var fallbackSubtitle = seoKeywords.slice(0, 3).join(' · ') + '로 만드는 특별한 공간';
    Logger.log('📝 키워드 기반 부제목 생성: "' + fallbackSubtitle + '"');
    return fallbackSubtitle;
  }
  
  return null;
}

/**
 * 제목 검증 및 로깅 함수
 */
function validateAndLogTitle(docTitle, baseName, fileType) {
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
 * 이미지 타입별 역할 맵 반환 (내부 유틸)
 */
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

function getImagenPromptByNo_(prompts, no) {
  if (!Array.isArray(prompts)) return null;
  for (var i = 0; i < prompts.length; i++) {
    if (prompts[i] && prompts[i].image_no === no) {
      return prompts[i];
    }
  }
  return null;
}

/**
 * Image1 생성 프롬프트 정합성 검증
 */
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

/**
 * Image2 생성 프롬프트 정합성 검증
 */
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

/**
 * 검증 실패 시 이미지 프롬프트 재생성 요청 함수
 */
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

/**
 * 다음 파일 하나만 SEO 처리 (완전 재구성형)
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
        
        Logger.log('✅ Apple + 네이버 스타일 Google Docs 생성 완료: ' + docTitle);
        Logger.log('🔗 문서 URL: ' + doc.getUrl());
        count++;
        
      } catch (error) {
        Logger.log('❌ ' + baseName + ' 구글독스 생성 오류: ' + error.message);
        continue;
      }
    }
    
    Logger.log('🎯 구글독스 생성 완료: ' + count + '개 파일 새로 처리됨');
    
    return createdDocs;
    
  } catch (error) {
    Logger.log('❌ Google Docs 생성 오류: ' + error.message);
  }
}

/**
 * 최근 처리된 SEO 파일만 Google Docs 생성
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
      
      if (!/\_final\_seo\.json$/i.test(name)) continue;
      
      if (f.getLastUpdated() < startTime) {
        Logger.log('⏭️ 과거 파일 스킵: ' + name);
        continue;
      }
      
      var baseName = name.replace(/\_final\_seo\.json$/i, "");
      
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
        titleStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Noto Sans';
        titleParagraph.setAttributes(titleStyle);
        titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
        titleParagraph.setSpacingAfter(12);
        
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
    
    return createdDocs;
    
  } catch (error) {
    Logger.log('❌ Google Docs 생성 오류: ' + error.message);
    return [];
  }
}

/**
 * 최근 생성된 SEO 파일 조회
 */
function getRecentGeneratedSeoFile_(startTime) {
  try {
    var recentSeoFolderId = '1wr_0xqWOqStu7AFw3NP9RktXA-f7AR0o';
    Logger.log('🔎 getRecentGeneratedSeoFile_ 탐색 시작');
    var jsonOutputFolder = DriveApp.getFolderById(recentSeoFolderId);
    var files = jsonOutputFolder.getFiles();
    var candidates = [];

    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      var updatedAt = file.getLastUpdated().getTime();

      if (!/\_final\_seo\.json$/i.test(name)) continue;

      if (startTime && updatedAt < startTime.getTime()) continue;

      candidates.push({
        file: file,
        name: name,
        updatedAt: updatedAt
      });
    }

    if (candidates.length === 0) return null;

    candidates.sort(function(a, b) {
      return b.updatedAt - a.updatedAt;
    });

    return candidates[0].file;
  } catch (error) {
    Logger.log('❌ getRecentGeneratedSeoFile_ 오류: ' + error.message);
    throw error;
  }
}

/**
 * 가장 최신 생성된 SEO 파일 조회
 */
function getLatestGeneratedSeoFile_() {
  try {
    Logger.log('🔎 getLatestGeneratedSeoFile_ 탐색 시작');
    var jsonOutputFolder = DriveApp.getFolderById(CONFIG.JSON_OUTPUT_FOLDER_ID);
    var files = jsonOutputFolder.getFiles();
    var candidates = [];

    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      var updatedAt = file.getLastUpdated().getTime();

      if (!/\_final\_seo\.json$/i.test(name)) continue;

      candidates.push({
        file: file,
        name: name,
        updatedAt: updatedAt
      });
    }

    if (candidates.length === 0) return null;

    candidates.sort(function(a, b) {
      return b.updatedAt - a.updatedAt;
    });

    return candidates[0].file;
  } catch (error) {
    Logger.log('❌ getLatestGeneratedSeoFile_ 오류: ' + error.message);
    throw error;
  }
}

/**
 * ID로 SEO 파일 조회
 */
function getGeneratedSeoFileById_(fileId) {
  if (!fileId) return null;
  try {
    return DriveApp.getFileById(fileId);
  } catch (error) {
    Logger.log('⚠️ getGeneratedSeoFileById_ 실패: ' + error.message);
    return null;
  }
}

/**
 * 컨텐츠에서 제목 추출
 */
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

/**
 * 하이라이트 박스 - 배경색 제거 버전 (아이콘만 유지)
 */
function addNaverStyleHighlight(body, text) {
  var detectedType = detectHighlightType(text);
  var intro = detectedType.intro;
  
  var introParagraph = body.appendParagraph(intro);
  var introStyle = {};
  introStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
  introStyle[DocumentApp.Attribute.BOLD] = true;
  introStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#007aff';
  introParagraph.setAttributes(introStyle);
  introParagraph.setSpacingAfter(8);
  
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
 * 하이라이트 타입 감지 유틸 (내부 전용)
 */
function detectHighlightType(text) {
  var lowerText = text.toLowerCase();
  if (lowerText.includes('비용') || lowerText.includes('가격')) {
    return { intro: '💰 비용 정보' };
  } else if (lowerText.includes('팁') || lowerText.includes('노하우')) {
    return { intro: '💡 전문가 팁' };
  } else if (lowerText.includes('결과') || lowerText.includes('성과')) {
    return { intro: '📊 주요 성과' };
  } else if (lowerText.includes('주의') || lowerText.includes('중요')) {
    return { intro: '⚠️ 주의사항' };
  } else {
    return { intro: '🔍 핵심 포인트' };
  }
}

/**
 * Drive에 업로드된 MD 파일에서 ## PROMPT_TEXT 이하 텍스트를 추출해 반환
 */
function loadTemplateConfig_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('naver_v7_template_config');
  if (cached) {
    return JSON.parse(cached);
  }

  var config = { tone: null, layout: null };

  try {
    var folderId = PropertiesService.getScriptProperties().getProperty('NAVER_CONFIG_FOLDER_ID');
    if (!folderId) {
      Logger.log('⚠️ NAVER_CONFIG_FOLDER_ID 미설정 — 하드코딩 기본값 사용');
      return config;
    }

    var folder = DriveApp.getFolderById(folderId);
    var fileMap = { tone: 'template-tone.md', layout: 'template-layout.md' };

    for (var key in fileMap) {
      var iter = folder.getFilesByName(fileMap[key]);
      if (iter.hasNext()) {
        var text = iter.next().getBlob().getDataAsString('UTF-8');
        var marker = '## PROMPT_TEXT\n';
        var idx = text.indexOf(marker);
        config[key] = idx !== -1 ? text.slice(idx + marker.length).trim() : null;
      }
    }

    cache.put('naver_v7_template_config', JSON.stringify(config), 21600);
    Logger.log('✅ 템플릿 설정 Drive 로드 완료');
  } catch (e) {
    Logger.log('⚠️ 템플릿 설정 로드 실패: ' + e.message + ' — 기본값 사용');
  }

  return config;
}

/** Drive MD 변경 후 즉시 반영하기 위해 캐시를 초기화합니다. */
function clearTemplateCache() {
  CacheService.getScriptCache().remove('naver_v7_template_config');
  Logger.log('✅ 템플릿 캐시 초기화 완료');
  toast_('템플릿 캐시 초기화 완료 — 다음 글 생성 시 Drive에서 재로드됩니다.');
}

/**
 * v7 테이블 레이아웃 HTML 프롬프트 생성 - 토큰 압축 버전
 */
function createV7HTMLPrompt(preprocessData, seoKeywords, highlightKeywords, templateData, styleData, geminiContext) {
  var fulltext = preprocessData.fulltext || "";
  var contentOutline = preprocessData.content_outline || [];
  
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

  var tmplConfig = loadTemplateConfig_();

  var defaultTone = '[역할]\n' +
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
    '[작성 원칙]\n' +
    '- 섹션별 사진 2개씩 배열\n' +
    '- SEO 키워드 자연스럽게 배치\n' +
    '- HTML 코드만 출력, 설명 절대 금지';

  var defaultLayout = '[출력 형식 - 고정 표준 템플릿]\n' +
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
    '</table>';

  var toneSection = tmplConfig.tone || defaultTone;
  var layoutSection = tmplConfig.layout || defaultLayout;

  var system = toneSection + '\n\n' +
    styleInstructions + '\n' +
    templateInstructions + '\n' +
    layoutSection;

  var geminiStr = '없음';
  if (geminiContext) {
    geminiStr = '- 요약: ' + (geminiContext.summary || '') + '\n' +
                '- 구조: ' + (geminiContext.outline ? geminiContext.outline.join(', ') : '') + '\n' +
                '- 팩트: ' + (geminiContext.key_facts || '') + '\n' +
                '- SEO보완: ' + (geminiContext.seo_addition || '');
  }

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
