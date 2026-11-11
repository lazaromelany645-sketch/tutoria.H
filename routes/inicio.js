// Login, logout y panel de inicio
const router = require('express').Router();
const { all, get } = require('../db');
const { verifyPassword, requireLogin } = require('../lib/auth');
const { esc, render, flash, csrfInput } = require('../lib/ui');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  render(req, res, 'Iniciar sesión', `
<div class="card login"><h1>🎓 Tutoría</h1>
<form method="post" action="/login">${csrfInput(req)}
  <label>Usuario</label><input name="nomuser" required autofocus>
  <label style="margin-top:10px">Contraseña</label><input type="password" name="passuser" required>
  <p><button class="btn" type="submit">Ingresar</button></p>
</form>
<p class="small">Demo: admin / admin123 · tutora / tutor123</p></div>`);
});

router.post('/login', (req, res) => {
  const u = get(
    `SELECT u.*, p.nombres, p.apellidos FROM usuarios u JOIN personas p ON p.idpersona = u.idpersona
     WHERE u.nomuser = ? AND u.estado = 1`, String(req.body.nomuser || '').trim());
  if (u && verifyPassword(String(req.body.passuser || ''), u.passuser)) {
    delete u.passuser;
    req.session.user = u;
    return res.redirect('/');
  }
  flash(req, 'Usuario o contraseña incorrectos.', 'err');
  res.redirect('/login');
});

router.get('/logout', (req, res) => { req.logout(); res.redirect('/login'); });

router.get('/', requireLogin, (req, res) => {
  const c = { Pendiente: 0, Curso: 0, Resuelto: 0 };
  all('SELECT estado, COUNT(*) n FROM atenciones GROUP BY estado').forEach((r) => { c[r.estado] = r.n; });
  const alumnos = get('SELECT COUNT(DISTINCT idalumno) n FROM grupos').n;
  const porMotivo = all('SELECT motivo, COUNT(*) n FROM atenciones GROUP BY motivo ORDER BY n DESC');
  const ult = all(
    `SELECT a.*, p.apellidos || ', ' || p.nombres AS alumno FROM atenciones a
     JOIN grupos g ON g.idgrupo = a.idgrupo JOIN personas p ON p.idpersona = g.idalumno
     ORDER BY a.fechaatencion DESC, a.idatencion DESC LIMIT 8`);
  const u = req.session.user;
  render(req, res, 'Inicio', `
<h1>Panel de tutoría</h1>
<p>Bienvenido(a), <b>${esc(u.nombres + ' ' + u.apellidos)}</b>.</p>
<div class="grid">
  <div class="stat pend"><b>${c.Pendiente}</b>Pendientes</div>
  <div class="stat curso"><b>${c.Curso}</b>En curso</div>
  <div class="stat res"><b>${c.Resuelto}</b>Resueltos</div>
  <div class="stat"><b>${alumnos}</b>Alumnos en grupos</div>
</div>
<div class="card" style="margin-top:18px">
  <div class="bar"><h2 style="margin:0">Últimas atenciones</h2><a class="btn" href="/atenciones/nuevo">+ Nuevo caso</a></div>
  <table><tr><th>Fecha</th><th>Alumno</th><th>Motivo</th><th>Estado</th></tr>
  ${ult.map((a) => `<tr><td>${esc(a.fechaatencion)}</td><td>${esc(a.alumno)}</td><td>${esc(a.motivo)}</td><td><span class="badge ${esc(a.estado)}">${esc(a.estado)}</span></td></tr>`).join('') || '<tr><td colspan="4">Sin atenciones registradas.</td></tr>'}
  </table></div>
<div class="card"><h2 style="margin-top:0">Casos por motivo</h2>
  <table><tr><th>Motivo</th><th>Cantidad</th></tr>
  ${porMotivo.map((m) => `<tr><td>${esc(m.motivo)}</td><td>${m.n}</td></tr>`).join('') || '<tr><td colspan="2">Sin datos.</td></tr>'}
  </table></div>`);
});

module.exports = router;
