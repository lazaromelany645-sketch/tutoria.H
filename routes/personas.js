const router = require('express').Router();
const { all, get, run } = require('../db');
const { isAdmin } = require('../lib/auth');
const { esc, render, flash, csrfInput, miniForm, select, nombreCompleto } = require('../lib/ui');

const TIPOS = ['DNI', 'CE', 'Pasaporte'];

router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q}%`;
  const filas = all('SELECT * FROM personas WHERE apellidos LIKE ? OR nombres LIKE ? OR numerodoc LIKE ? ORDER BY apellidos, nombres', like, like, like);
  render(req, res, 'Personas', `
<div class="bar"><h1>Personas</h1><a class="btn" href="/personas/nuevo">+ Nueva persona</a></div>
<p class="small">Aquí se registran alumnos, apoderados, docentes y usuarios (todos son personas).</p>
<form class="filtros card" method="get"><div><label>Buscar</label><input name="q" value="${esc(q)}" placeholder="Apellido, nombre o documento"></div><button class="btn">Buscar</button></form>
<table><tr><th>Apellidos y nombres</th><th>Género</th><th>Documento</th><th>Teléfono</th><th>Dirección</th><th></th></tr>
${filas.map((p) => `<tr><td>${esc(nombreCompleto(p))}</td><td>${esc(p.genero)}</td><td>${esc(p.tipodoc + ' ' + p.numerodoc)}</td><td>${esc(p.telefono)}</td><td>${esc(p.direccion)}</td>
<td><a class="btn sm" href="/personas/${p.idpersona}/editar">Editar</a>
${isAdmin(req) ? miniForm(req, '/personas/eliminar', { id: p.idpersona }, 'Eliminar', 'sm del', '¿Eliminar esta persona?') : ''}</td></tr>`).join('') || '<tr><td colspan="6">Sin resultados.</td></tr>'}
</table>`);
});

function formulario(req, res, p, titulo) {
  render(req, res, titulo, `<h1>${titulo}</h1><div class="card">
<form class="f" method="post" action="/personas/guardar">${csrfInput(req)}
<input type="hidden" name="idpersona" value="${esc(p.idpersona)}">
<div><label>Apellidos</label><input name="apellidos" value="${esc(p.apellidos)}" required></div>
<div><label>Nombres</label><input name="nombres" value="${esc(p.nombres)}" required></div>
<div><label>Género</label>${select('genero', [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }], p.genero, { vacio: null })}</div>
<div><label>Tipo de documento</label>${select('tipodoc', TIPOS.map((t) => ({ value: t, label: t })), p.tipodoc, { vacio: null })}</div>
<div><label>N° documento</label><input name="numerodoc" value="${esc(p.numerodoc)}" required></div>
<div><label>Teléfono</label><input name="telefono" value="${esc(p.telefono)}"></div>
<div class="full"><label>Dirección</label><input name="direccion" value="${esc(p.direccion)}"></div>
<div class="full"><button class="btn">Guardar</button> <a class="btn sec" href="/personas">Cancelar</a></div>
</form></div>`);
}

router.get('/nuevo', (req, res) => formulario(req, res, { idpersona: '', apellidos: '', nombres: '', genero: 'M', tipodoc: 'DNI', numerodoc: '', telefono: '', direccion: '' }, 'Nueva persona'));
router.get('/:id/editar', (req, res) => {
  const p = get('SELECT * FROM personas WHERE idpersona = ?', Number(req.params.id));
  if (!p) return res.redirect('/personas');
  formulario(req, res, p, 'Editar persona');
});

router.post('/guardar', (req, res) => {
  const b = req.body;
  const d = [b.apellidos, b.nombres, b.genero, b.tipodoc, b.numerodoc, b.telefono || '', b.direccion || ''].map((x) => String(x).trim());
  try {
    if (b.idpersona) {
      run('UPDATE personas SET apellidos=?, nombres=?, genero=?, tipodoc=?, numerodoc=?, telefono=?, direccion=? WHERE idpersona=?', ...d, Number(b.idpersona));
      flash(req, 'Persona actualizada.');
    } else {
      run('INSERT INTO personas (apellidos,nombres,genero,tipodoc,numerodoc,telefono,direccion) VALUES (?,?,?,?,?,?,?)', ...d);
      flash(req, 'Persona registrada.');
    }
  } catch (e) { flash(req, 'No se pudo guardar: documento duplicado.', 'err'); }
  res.redirect('/personas');
});

router.post('/eliminar', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Solo administradores.');
  try { run('DELETE FROM personas WHERE idpersona = ?', Number(req.body.id)); flash(req, 'Persona eliminada.'); }
  catch (e) { flash(req, 'No se puede eliminar: la persona está en uso (docente, usuario o grupo).', 'err'); }
  res.redirect('/personas');
});

module.exports = router;
