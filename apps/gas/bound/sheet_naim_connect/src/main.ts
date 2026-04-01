type SheetCell = string | number | boolean | Date | null;
type SheetRow = SheetCell[];

interface RowWithIndex {
  rowData: SheetRow;
  rowIndex: number;
}

interface PreparedModel {
  id: SheetCell;
  productName: SheetCell;
  price: SheetCell;
  sheetIndex: number;
}

function getSheetOrThrow(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  name: string,
): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet not found: ${name}`);
  }
  return sheet;
}
/* 
main.ts로 만들것을 컴파일해서 Code.js로 변환해서 push하는 것이 목적

컴파일해서 dist/main.js로 생성
dist/appsscript.json을 만들어서 push하는 것이 목적


*/
/**
 * A열의 값이 1 또는 "1"인 행을 찾아 데이터와 행 인덱스를 반환합니다.
 */
function getRowsWithOne(): RowWithIndex[] {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const data = sheet.getDataRange().getValues() as SheetRow[];

  const rows: RowWithIndex[] = [];
  for (let i = 0; i < data.length; i += 1) {
    const row = data[i];
    const value = row[0];
    if (value === 1 || value === "1") {
      rows.push({
        rowData: row,
        rowIndex: i + 1,
      });
    }
  }

  return rows;
}

/**
 * 전달받은 rows의 rowIndex 기준으로 시트의 A열 값을 0으로 수정합니다.
 */
function clearRowsOnes(rows: RowWithIndex[]): void {
  if (rows.length === 0) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  rows.forEach((item) => {
    sheet.getRange(item.rowIndex, 1).setValue(0);
  });

  console.log(`${rows.length}개의 행이 성공적으로 업데이트되어 0으로 변경되었습니다.`);
}

function updateMainProcess(): void {
  const targetRows = getRowsWithOne();
  if (targetRows.length === 0) {
    console.log("처리할 데이터가 없습니다.");
    return;
  }

  const successRows = targetRows.filter((item) => {
    const isSuccess = sendUpdateToServer(item.rowData);
    return isSuccess;
  });

  clearRowsOnes(successRows);
}

// 가상의 서버 요청 함수 예시
function sendUpdateToServer(rowData: SheetRow): boolean {
  // 실제 구현에서는 UrlFetchApp.fetch() 등으로 API를 호출합니다.
  void rowData;
  return true;
}

/**
 * 추출된 rows 데이터를 서버 모델 규격에 맞게 변환합니다.
 */
function prepareModelList(rows: RowWithIndex[]): PreparedModel[] {
  if (rows.length === 0) return [];

  return rows.map((item) => {
    const data = item.rowData;
    return {
      id: data[0] ?? null,
      productName: data[1] ?? null,
      price: data[2] ?? null,
      sheetIndex: item.rowIndex,
    };
  });
}