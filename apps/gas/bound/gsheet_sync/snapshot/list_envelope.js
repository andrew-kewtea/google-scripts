/**
 * fast2 목록 API 공통 envelope: ``items``, ``total``, (선택) ``page``, ``size``, ``sort``, ``order``.
 * Vue ``useListQuery`` 타입과 같은 축으로 맞춤. 과거 비표준 본문은 단계적으로 흡수.
 */

/** @returns {Array<Object>} */
function extractItemsFromListEnvelope_(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.data)) return json.data;
  if (json.data && Array.isArray(json.data.items)) return json.data.items;
  if (Array.isArray(json.results)) return json.results;
  if (Array.isArray(json.notes)) return json.notes;
  return [];
}

/**
 * @returns {{items: Array, total: number, page: *, size: *, sort: *, order: *, raw: *}}
 */
function parseListEnvelope_(json) {
  var items = extractItemsFromListEnvelope_(json);
  var total =
    json && typeof json.total === 'number' ? json.total : items.length;
  return {
    items: items,
    total: total,
    page: json && json.page != null ? json.page : '',
    size: json && json.size != null ? json.size : '',
    sort: json && json.sort != null ? json.sort : '',
    order: json && json.order != null ? json.order : '',
    raw: json,
  };
}
