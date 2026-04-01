function getSheetOrThrow(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet not found: ${name}`);
  }
  return sheet;
}


//function buildFeatureStats() {

//function simulatePlannerROI() {


/* function runAll() {
  buildFeatureStats();
  simulatePlannerROI();
}
*/





/*

// getRowsWithOne()의 리턴값 예시
[
  {
    "rowIndex": 2,                     // 실제 시트의 2행
    "rowData": [1, "아이폰", 1000000]    // 2행의 전체 데이터 (A, B, C열)
  },
  {
    "rowIndex": 4,                     // 실제 시트의 4행
    "rowData": ["1", "맥북", 2500000]   // 4행의 전체 데이터 (A, B, C열)
  }
]



*/

/**
 * A열의 값이 1 또는 '1'인 행을 찾아 데이터와 행 인덱스를 반환하는 함수
 * @return {Array<Object>} [{rowData: Array, rowIndex: Number}, ...]
 */
function getRowsWithOne() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  const rows = [];
  
  for (let i = 0; i < data.length; i++) {
    const value = data[i][0]; // A열 값
    if (value == 1 || value == '1') {
      rows.push({
        rowData: data[i],     // 해당 행의 전체 데이터
        rowIndex: i + 1      // 시트에서의 실제 행 번호 (1부터 시작)
      });
    }
  }
  
  return rows;
}

/**
 * 전달받은 rows 객체 배열의 rowIndex를 기반으로 시트의 A열 값을 0으로 수정하는 함수
 * @param {Array<Object>} rows - getRowsWithOne에서 반환된 형식의 배열
 */
function clearRowsOnes(rows) {
  if (!rows || rows.length === 0) return;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  
  rows.forEach(item => {
    // item.rowIndex를 사용하여 해당 행의 1번째 열(A열)을 0으로 설정
    // 0 대신 빈 칸을 원하시면 .clearContent()를 사용하세요.
    sheet.getRange(item.rowIndex, 1).setValue(0);  //sheet.getRange(item.rowIndex, 1).clearContent();로 수정
  });
  
  console.log(rows.length + "개의 행이 성공적으로 업데이트되어 0으로 변경되었습니다.");
}


function updateMainProcess() {
  // 1. 대상 행 가져오기
  const targetRows = getRowsWithOne();
  
  if (targetRows.length === 0) {
    console.log("처리할 데이터가 없습니다.");
    return;
  }
  
  // 2. 서버 업데이트 시뮬레이션 (성공한 데이터만 추려내기)
  const successRows = targetRows.filter(item => {
    const isSuccess = sendUpdateToServer(item.rowData); // 가상의 서버 요청 함수
    return isSuccess;
  });
  
  // 3. 성공한 행들만 시트에서 A열 값을 0으로 변경
  clearRowsOnes(successRows);
}

// 가상의 서버 요청 함수 예시
function sendUpdateToServer(rowData) {
  // 실제로는 UrlFetchApp.fetch() 등을 사용합니다.
  return true; 
}

/*
// 2. 서버 통신 후 시트 수정 시
// sheetIndex가 4인 것을 확인했으므로 바로 4행으로 찾아감
sheet.getRange(item.sheetIndex, 1).setValue(0);
*/

/**
 * 추출된 rows 데이터를 서버 모델 규격에 맞게 변환하는 함수
 * @param {Array} rows - getRowsWithOne()에서 반환된 배열
 * @return {Array<Object>} 모델 필드가 적용된 객체 리스트
 */
function prepareModelList(rows) {
  if (!rows || rows.length === 0) return [];

  // 각 행(row)을 순회하며 서버 모델로 매핑합니다.
  const modelList = rows.map(item => {
    const data = item.rowData; // [A열값, B열값, C열값, ...]

    return {
      // 1. 서버에서 요구하는 필드명 : 시트의 데이터 (인덱스 주의)
      id: data[0],          // A열
      productName: data[1], // B열
      price: data[2],       // C열
      
      // 2. 나중에 성공 시 업데이트를 위해 rowIndex도 슬쩍 포함해두면 관리가 편합니다.
      sheetIndex: item.rowIndex 
    };
  });

  return modelList;
}

