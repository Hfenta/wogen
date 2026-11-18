export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what) => new ApiError(404, 'not_found', `${what} not found`);

export function errorHandler(err, req, res, _next) {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: { code: 'validation_error', message: 'Invalid request', details: err.issues } });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
}
