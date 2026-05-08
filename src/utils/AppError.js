class AppError extends Error {
  constructor(message, statusCode = 500, details = null, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }
}

module.exports = AppError;
