const axios = require('axios');

// Keep error responses generic — never leak stack traces or internal details.
function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);

  if (res.headersSent) {
    return res.destroy();
  }

  const isUpstreamError = axios.isAxiosError(err);
  const status = err.status || (isUpstreamError ? 502 : 400);

  let message = err.publicMessage || err.message;
  if (isUpstreamError && !err.status) {
    message = 'Could not reach the media source';
  }

  res.status(status).json({ error: message || 'Something went wrong' });
}

module.exports = { notFoundHandler, errorHandler };
