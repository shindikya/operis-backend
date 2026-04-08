const { OperisError } = require('./errorHandler');

function requireFields(body, fields) {
  const missing = fields.filter(f => {
    const val = f.split('.').reduce((obj, key) => obj && obj[key], body);
    return val === undefined || val === null || val === '';
  });

  if (missing.length > 0) {
    throw new OperisError(
      `Missing required fields: ${missing.join(', ')}`,
      'MISSING_FIELDS',
      400,
      { missing }
    );
  }
}

function validatePhone(phone) {
  const e164 = /^\+[1-9]\d{7,14}$/;
  if (!e164.test(phone)) {
    throw new OperisError(
      'Phone must be in E.164 format (e.g. +14155550123)',
      'INVALID_PHONE',
      400
    );
  }
}

function validateEmail(email) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email)) {
    throw new OperisError(
      'Invalid email address',
      'INVALID_EMAIL',
      400
    );
  }
}

function validateDatetime(value, fieldName) {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new OperisError(
      `${fieldName} must be a valid ISO 8601 datetime`,
      'INVALID_DATETIME',
      400
    );
  }
}

function validateFuture(value, fieldName) {
  validateDatetime(value, fieldName);
  if (new Date(value) <= new Date()) {
    throw new OperisError(
      `${fieldName} must be in the future`,
      'DATETIME_NOT_FUTURE',
      400
    );
  }
}

module.exports = {
  requireFields,
  validatePhone,
  validateEmail,
  validateDatetime,
  validateFuture
};
