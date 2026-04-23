const AppError = require('../utils/AppError');

const ALLOWED_TROPHY_TYPES = ['Platina', 'Ouro', 'Prata', 'Bronze'];
const ALLOWED_SORTS = ['recommended-desc', 'updated-desc', 'created-desc', 'difficulty-desc', 'time-asc', 'trophies-desc', 'name-asc'];
const ALLOWED_FACETS = [
  'all',
  'difficulty-low',
  'difficulty-mid',
  'difficulty-high',
  'time-short',
  'time-medium',
  'time-long',
  'trophies-small',
  'trophies-medium',
  'trophies-large'
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeString(value, maxLength = null) {
  const sanitized = typeof value === 'string' ? value.trim() : '';
  if (maxLength && sanitized.length > maxLength) {
    return sanitized.slice(0, maxLength);
  }
  return sanitized;
}

function isSafeImagePath(value) {
  return typeof value === 'string' && (/^https?:\/\//i.test(value.trim()) || value.trim().startsWith('/uploads/'));
}

function normalizeGamePayload(payload = {}) {
  return {
    name: sanitizeString(payload.name, 120),
    difficulty: Number(payload.difficulty),
    time: sanitizeString(payload.time, 40),
    missable: sanitizeString(payload.missable, 800),
    image: typeof payload.image === 'string' ? payload.image.trim() || null : null,
    roadmap: Array.isArray(payload.roadmap)
      ? payload.roadmap.map(step => sanitizeString(step, 500)).filter(Boolean)
      : [],
    trophies: Array.isArray(payload.trophies)
      ? payload.trophies.map(trophy => ({
          id: sanitizeString(trophy?.id, 60),
          name: sanitizeString(trophy?.name, 140),
          type: sanitizeString(trophy?.type, 20),
          description: sanitizeString(trophy?.description, 500),
          tip: sanitizeString(trophy?.tip, 1000),
          is_missable: Boolean(trophy?.is_missable),
          is_spoiler: Boolean(trophy?.is_spoiler)
        }))
      : []
  };
}

function validateGamePayload(payload) {
  const errors = [];

  if (!isNonEmptyString(payload.name)) {
    errors.push('name é obrigatório.');
  } else if (payload.name.length < 2 || payload.name.length > 120) {
    errors.push('name deve ter entre 2 e 120 caracteres.');
  }

  if (!Number.isInteger(payload.difficulty) || payload.difficulty < 1 || payload.difficulty > 10) {
    errors.push('difficulty deve ser um número inteiro entre 1 e 10.');
  }

  if (!isNonEmptyString(payload.time)) {
    errors.push('time é obrigatório.');
  } else if (!/\d/.test(payload.time)) {
    errors.push('time deve informar pelo menos um valor numérico de horas.');
  }

  if (!isNonEmptyString(payload.missable)) {
    errors.push('missable é obrigatório.');
  }

  if (!Array.isArray(payload.roadmap) || payload.roadmap.length === 0 || payload.roadmap.some(step => !isNonEmptyString(step))) {
    errors.push('roadmap deve ser um array com pelo menos um passo válido.');
  } else if (payload.roadmap.length > 40) {
    errors.push('roadmap aceita até 40 passos.');
  }

  if (!Array.isArray(payload.trophies) || payload.trophies.length === 0) {
    errors.push('trophies deve ser um array com pelo menos um troféu.');
  } else {
    const ids = new Set();

    payload.trophies.forEach((trophy, index) => {
      if (!isNonEmptyString(trophy.id)) {
        errors.push(`trophies[${index}].id é obrigatório.`);
      } else if (!/^[a-zA-Z0-9._:-]{1,60}$/.test(trophy.id)) {
        errors.push(`trophies[${index}].id deve usar até 60 caracteres alfanuméricos ou . _ : -.`);
      } else if (ids.has(trophy.id.toLowerCase())) {
        errors.push(`trophies[${index}].id está duplicado.`);
      } else {
        ids.add(trophy.id.toLowerCase());
      }

      if (!isNonEmptyString(trophy.name)) {
        errors.push(`trophies[${index}].name é obrigatório.`);
      }

      if (!ALLOWED_TROPHY_TYPES.includes(trophy.type)) {
        errors.push(`trophies[${index}].type deve ser Platina, Ouro, Prata ou Bronze.`);
      }

      if (!isNonEmptyString(trophy.description)) {
        errors.push(`trophies[${index}].description é obrigatório.`);
      }

      if (!isNonEmptyString(trophy.tip)) {
        errors.push(`trophies[${index}].tip é obrigatório.`);
      }
    });
  }

  if (payload.image !== null && typeof payload.image !== 'string') {
    errors.push('image deve ser uma string quando informada.');
  } else if (payload.image && !isSafeImagePath(payload.image)) {
    errors.push('image deve ser uma URL http(s) válida ou um caminho interno de upload.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function normalizeListQuery(query = {}) {
  return {
    search: typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '',
    facet: typeof query.facet === 'string' ? query.facet.trim() : 'all',
    sort: typeof query.sort === 'string' ? query.sort.trim() : 'name-asc',
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 24
  };
}

function validateListQuery(query) {
  const errors = [];

  if (!ALLOWED_FACETS.includes(query.facet)) {
    errors.push('facet inválido.');
  }

  if (!ALLOWED_SORTS.includes(query.sort)) {
    errors.push('sort inválido.');
  }

  if (!Number.isInteger(query.page) || query.page < 1) {
    errors.push('page deve ser um inteiro maior ou igual a 1.');
  }

  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) {
    errors.push('limit deve ser um inteiro entre 1 e 100.');
  }

  if (errors.length) {
    throw new AppError('Parâmetros de consulta inválidos.', 400, errors, 'INVALID_QUERY');
  }

  return query;
}

module.exports = {
  validateGamePayload,
  normalizeGamePayload,
  normalizeListQuery,
  validateListQuery
};
