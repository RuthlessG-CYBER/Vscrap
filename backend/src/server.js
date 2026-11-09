const express = require('express');
const config = require('./config');
const { applySecurity } = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const downloadRoutes = require('./routes/download');

const app = express();
const startedAt = Date.now();

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' })); // request bodies are tiny (just URLs/codes)

applySecurity(app);

app.get('/', (req, res) =>
  res.json({
    status: 'ok',
    service: 'vscrap-backend',
    version: '1.0.0',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    maxDownloadBytes: config.maxDownloadBytes,
  })
);

app.use('/api/download', downloadRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port} (${config.nodeEnv})`);
});
