// Contraseñas (scrypt), sesiones en memoria y protección CSRF, sin dependencias extra.
const crypto = require('crypto');

function hashPassword(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pass, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pass, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pass, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

const sessions = new Map();

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, v.join('=')])
  );
}

// Middleware: crea req.session y la cookie "sid"
function sessionMiddleware(req, res, next) {
  let sid = parseCookies(req.headers.cookie).sid;
  if (!sid || !sessions.has(sid)) {
    sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, { csrf: crypto.randomBytes(16).toString('hex') });
    res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/`);
  }
  req.sid = sid;
  req.session = sessions.get(sid);
  req.logout = () => sessions.delete(sid);
  next();
}

function csrfMiddleware(req, res, next) {
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).send('Token de seguridad inválido. Recarga la página.');
  }
  next();
}

const requireLogin = (req, res, next) => (req.session.user ? next() : res.redirect('/login'));
const requireAdmin = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.nivelacceso !== 'Administrador') return res.status(403).send('Acceso restringido a administradores.');
  next();
};
const isAdmin = (req) => req.session.user && req.session.user.nivelacceso === 'Administrador';

module.exports = { hashPassword, verifyPassword, sessionMiddleware, csrfMiddleware, requireLogin, requireAdmin, isAdmin };
