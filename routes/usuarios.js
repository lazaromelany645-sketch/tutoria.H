const router = require('express').Router();
const { all, get, run } = require('../db');
const { requireAdmin, hashPassword } = require('../lib/auth');
const { esc, render, flash, csrfInput, miniForm, select, nombreCompleto } = require('../lib/ui');

const NIVELES = ['Administrador', 'Tutor'];
router.use(requireAdmin);

router.get('/', (req, res) => {
  const filas = all('SELECT u.*, p.apellidos, p.nombres FROM usuarios u JOIN personas p ON p.idpersona = u.idpersona ORDER BY u.nomuser');
  render(req, res, 'Usuarios', `
<div class="bar"><h1>Usuarios</h1><a class="btn" href="/usuarios/nuevo">+ Nuevo usuario</a></div>
<table><tr><th>Usuario</th><th>Persona</th><th>Nivel</th><th>Estado</th><th></th></tr>
${filas.map((u) => `<tr><td>${esc(u.nomuser)}</td><td>${esc(nombreCompleto(u))}</td><td>${esc(u.nivelacceso)}</td>
<td><span class="badge ${u.estado ? 'on' : 'off'}">${u.estado ? 'Activo' : 'Inactivo'}</span></td>
<td><a class="btn sm" href="/usuarios/${u.idusuario}/editar">Editar</a> ${miniForm(req, '/usuarios/estado', { id: u.idusuario }, u.estado ? 'Desactivar' : 'Activar', 'sm sec')}</td></tr>`).join('')}
</table>`);
});

function formulario(req, res, u, titulo) {
  const pers = all('SELECT idpersona, apellidos, nombres, numerodoc FROM personas ORDER BY apellidos, nombres')
    .map((p) => ({ value: p.idpersona, label: `${nombreCompleto(p)} - ${p.numerodoc}` }));
  const nuevo = !u.idusuario;
  render(req, res, titulo, `<h1>${titulo}</h1><div class="card">
<form class="f" method="post" action="/usuarios/guardar" autocomplete="off">${csrfInput(req)}
<input type="hidden" name="idusuario" value="${esc(u.idusuario)}">
<div><label>Persona</label>${select('idpersona', pers, u.idpersona)}</div>
<div><label>Usuario</label><input name="nomuser" value="${esc(u.nomuser)}" required></div>
<div><label>Contraseña ${nuevo ? '' : '(vacío = no cambiar)'}</label><input type="password" name="passuser" ${nuevo ? 'required' : ''}></div>
<div><label>Nivel de acceso</label>${select('nivelacceso', NIVELES.map((n) => ({ value: n, label: n })), u.nivelacceso, { vacio: null })}</div>
<div class="full"><button class="btn">Guardar</button> <a class="btn sec" href="/usuarios">Cancelar</a></div>
</form></div>`);
}

router.get('/nuevo', (req, res) => formulario(req, res, { idusuario: '', idpersona: '', nomuser: '', nivelacceso: 'Tutor' }, 'Nuevo usuario'));
router.get('/:id/editar', (req, res) => {
  const u = get('SELECT * FROM usuarios WHERE idusuario = ?', Number(req.params.id));
  if (!u) return res.redirect('/usuarios');
  formulario(req, res, u, 'Editar usuario');
});

router.post('/guardar', (req, res) => {
  const b = req.body;
  try {
    if (b.idusuario) {
      run('UPDATE usuarios SET idpersona=?, nomuser=?, nivelacceso=? WHERE idusuario=?', Number(b.idpersona), String(b.nomuser).trim(), b.nivelacceso, Number(b.idusuario));
      if (b.passuser) run('UPDATE usuarios SET passuser=? WHERE idusuario=?', hashPassword(b.passuser), Number(b.idusuario));
      flash(req, 'Usuario actualizado.');
    } else {
      if (String(b.passuser || '').length < 6) throw new Error('corta');
      run('INSERT INTO usuarios (idpersona,nomuser,passuser,nivelacceso,estado) VALUES (?,?,?,?,1)', Number(b.idpersona), String(b.nomuser).trim(), hashPassword(b.passuser), b.nivelacceso);
      flash(req, 'Usuario creado.');
    }
  } catch (e) { flash(req, 'No se pudo guardar: usuario duplicado o contraseña menor a 6 caracteres.', 'err'); }
  res.redirect('/usuarios');
});

router.post('/estado', (req, res) => {
  const id = Number(req.body.id);
  if (id === req.session.user.idusuario) flash(req, 'No puede desactivar su propio usuario.', 'err');
  else { run('UPDATE usuarios SET estado = 1 - estado WHERE idusuario = ?', id); flash(req, 'Estado actualizado.'); }
  res.redirect('/usuarios');
});

module.exports = router;
