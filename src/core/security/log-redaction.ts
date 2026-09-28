/**
 * Paths pino must never write. Request bodies are not logged at all; these
 * cover headers and any object a developer passes to the logger by mistake.
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  "*.password",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.secret",
  "*.email",
  "*.phone",
  "*.dateOfBirth",
  "*.note",
  "*.notes",
];
