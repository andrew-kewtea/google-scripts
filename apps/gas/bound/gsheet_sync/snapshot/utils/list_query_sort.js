/**
 * list GET 쿼리 ``sort`` 키: 시트 표기(compact) → API snake_case.
 * ``makeListSortParamNormalizer_(aliasMap)`` 로 모델별 맵만 교체.
 *
 * @param {Object<string,string>} compactLowerToSnake  compact(underscore·공백 제거·소문자) → API 필드명
 * @returns {function(string,string): string}
 */
function makeListSortParamNormalizer_(compactLowerToSnake) {
  return function listSortParamNormalizer_(paramKey, raw) {
    if (paramKey !== 'sort') return raw;
    var s = String(raw || '').trim();
    if (!s) return s;
    var compact = s.replace(/_/g, '').replace(/\s+/g, '').toLowerCase();
    if (compactLowerToSnake[compact]) return compactLowerToSnake[compact];
    return s;
  };
}
