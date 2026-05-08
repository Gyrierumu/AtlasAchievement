function extractHourNumbers(value = '') {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/até/g, 'ate')
    .replace(/\+/g, ' plus ');

  const matches = normalized.match(/\d+(?:\.\d+)?/g) || [];
  return matches.map(Number).filter(Number.isFinite);
}

function parseTimeRange(value = '') {
  const numbers = extractHourNumbers(value);
  if (!numbers.length) {
    return {
      minHours: null,
      maxHours: null,
      sortHours: Number.MAX_SAFE_INTEGER
    };
  }

  const minHours = Math.min(...numbers);
  let maxHours = Math.max(...numbers);

  if (/\+/.test(String(value))) {
    maxHours = null;
  }

  return {
    minHours,
    maxHours,
    sortHours: minHours
  };
}

function getTimeBucketFromHours(sortHours) {
  if (!Number.isFinite(sortHours) || sortHours === Number.MAX_SAFE_INTEGER) {
    return null;
  }

  if (sortHours <= 15) return 'short';
  if (sortHours <= 40) return 'medium';
  return 'long';
}

function parseTimeValue(value = '') {
  return parseTimeRange(value).sortHours;
}

function formatTimeMetadata(time) {
  const range = parseTimeRange(time);
  const timeBucket = getTimeBucketFromHours(range.sortHours);

  return {
    time_min_hours: range.minHours,
    time_max_hours: range.maxHours,
    time_sort_hours: Number.isFinite(range.sortHours) ? range.sortHours : null,
    time_bucket: timeBucket
  };
}

module.exports = {
  extractHourNumbers,
  parseTimeRange,
  parseTimeValue,
  formatTimeMetadata,
  getTimeBucketFromHours
};
