export const LOCAL_KEY = "nursery-expenses-2026";
export const SHEET_ID = '1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA';
export const CLOUD_META = "nursery-cloud-meta"; // Firebase 설정 저장
export const GS_META = "nursery-gscript-meta"; // Apps Script 설정 저장

export const DEFAULT_BUDGET = {
  year: 2026,
  total: 6297000,
  items: [
    { key: "예배비", budget: 570000 },
    { key: "교육비", budget: 2200000 },
    { key: "교사교육비", budget: 356000 },
    { key: "행사비", budget: 1701000 },
    { key: "성경학교 및 수련회", budget: 940000 },
    { key: "운영행정비", budget: 530000 },
  ],
};

export const CATEGORY_ORDER = DEFAULT_BUDGET.items.map((i) => i.key);

export const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwfrn1_jfWmFhjr-D1cU8NAacEmR9vBsDS107gcXykMjtOgsrY9b7Op0vfPqskPx05D/exec";
export const DEFAULT_SCRIPT_TOKEN = "thank1234!!";

export const MEMBERS_SHEET_INDEX = 6; // 7번째 시트
export const ATTENDANCE_SHEET_GID = "348133938";
export const MEMBER_PHOTO_FOLDER_ID = "1gmhV08lX3V2I0PgO2fNKCiWc3x8nasQn";
export const FELLOWSHIP_SHEET_GID = "1416333507";
export const FELLOWSHIP_FOLDER_ID = "1ZkYWUsDxJGn-JK1sxyN7OZqipGdGNBl4";

// 출석 관련 추가 데이터 시트 GID
export const MEMORY_VERSES_GID = "526644461";  // 암송말씀
export const PRAYER_ORDER_GID = "1349823463";   // 기도
export const OFFERING_ORDER_GID = "1072884800"; // 헌금
export const CLEANING_ORDER_GID = "1639773171"; // 청소
