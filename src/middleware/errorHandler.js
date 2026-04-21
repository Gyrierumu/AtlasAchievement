function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message = err.message || 'Erro interno do servidor';

  const payload = {
    error: {
      code,
      message,
      requestId: req.requestId || null
    },
    message,
    requestId: req.requestId || null
  };

  if (err.details) {
    payload.error.details = err.details;
    payload.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.error.stack = err.stack;
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = errorHandler;
