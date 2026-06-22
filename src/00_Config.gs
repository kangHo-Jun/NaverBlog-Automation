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

// Unsplash 검색용 영문 변환 맵
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

// 컨트롤 시트 및 이미지 폴더
const CONTROL_SHEET_ID = '1ln-FEi1W0ZPKmVFmBUp6iuQ8dm6ijoGVFB6qqCFP1Q0';
const IMAGE_PARENT_FOLDER_ID = '1-QkVAQf8O5vSV4ndaXEHAD1soKmhQj5t';
