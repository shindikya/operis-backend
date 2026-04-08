class OperisError extends Error {
  constructor(message, code, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function handleError(res, err) {
  if (err instanceof OperisError) {
    const body = { error: err.message, code: err.code };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
}

module.exports = { OperisError, handleError };
