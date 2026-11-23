// In-memory user store (prototype only). Production: EduConnect's database / university SSO.
const bcrypt = require('bcryptjs');
const { BCRYPT_ROUNDS, ROLES } = require('./config');

const users = new Map(); // email -> user

function createUser({ email, password, name, role = ROLES.STUDENT }) {
  email = email.trim().toLowerCase();
  if (users.has(email)) throw new Error('EMAIL_EXISTS');
  const user = {
    id: 'u_' + (users.size + 1),
    email,
    name,
    role,
    passwordHash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
    failedLogins: 0,
    lockedUntil: 0,
  };
  users.set(email, user);
  return user;
}

const findByEmail = (email) => users.get(String(email).trim().toLowerCase());
const findById = (id) => [...users.values()].find((u) => u.id === id);
const publicUser = ({ id, email, name, role }) => ({ id, email, name, role });

// Demo accounts so the prototype works immediately
function seedDemoUsers() {
  if (users.size) return;
  createUser({ email: 'student@demo.ac.ae', password: 'Student#123', name: 'Layla A.', role: ROLES.STUDENT });
  createUser({ email: 'admin@demo.ac.ae', password: 'Admin#123', name: 'Ada Admin', role: ROLES.ADMIN });
}

module.exports = { createUser, findByEmail, findById, publicUser, seedDemoUsers };
