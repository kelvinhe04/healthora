import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'healthora-backend',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["stripe-signature"]',
      'req.headers["x-clerk-auth-reason"]',
      'err.config.headers.authorization',
    ],
    censor: '[redacted]',
  },
});
