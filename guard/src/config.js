// Central config. In production, JWT_SECRET comes from a secrets manager, never from code.
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  JWT_EXPIRES_IN: '2h',
  BCRYPT_ROUNDS: 10,
  ROLES: { STUDENT: 'student', ADMIN: 'admin' },
  MAX_FAILED_LOGINS: 5,
  LOCKOUT_MS: 15 * 60 * 1000,
};
