const router = require('express').Router();
const { all, get, run } = require('../db');
const { isAdmin } = require('../lib/auth');
const { esc, render, flash, csrfInput, miniForm, select, nombreCompleto } = require('../lib/ui');

const CONTRATOS = ['Nombrado', 'Contratado', 'Por horas'];

router.get('/', (req, res) => {
  const filas = all('SELECT d.*, p.apellidos, p.nombres, p.numerodoc, p.telefono FROM docentes d JOIN personas p ON p.idpersona = d.idpersona ORDER BY p.apellidos');
  render(req, res, 'Docentes', `
<div class="bar"><h1>Docentes</h1><a class="btn" href="/docentes/nuevo">+ Nuevo docente</a></div>
<table><tr><th>Docente</th><th>Documento</th><th>Teléfono</th><th>Contrato</th><th></th></tr>
${filas.map((d) => `<tr><td>${esc(nombreCompleto(d))}</td><td>${esc(d.numerodoc)}</td><td>${esc(d.telefono)}</td><td>${esc(d.tipocontrato)}</td>
<td><a class="btn sm" href="/docentes/${d.iddocente}/editar">Editar</a>
${isAdmin(req) ? miniForm(req, '/docentes/eliminar', { id: d.iddocente }, 'Eliminar', 'sm del', '¿Eliminar docente?') : ''}</td></tr>`).join('') || '<tr><td colspan="5">Sin docentes.</td></tr>'}
</table>`);
});

function formulario(req, res, d, titulo) {
  const personas = all('SELECT idpersona, apellidos, nombres, numerodoc FROM personas ORDER BY apellidos, nombres')
    .map((p) => ({ value: p.idpersona, label: `${nombreCompleto(p)} - ${p.numerodoc}` }));
  render(req, res, titulo, `<h1>${titulo}</h1><div class="card">
<form class="f" method="post" action="/docentes/guardar">${csrfInput(req)}
<input type="hidden" name="iddocente" value="${esc(d.iddocente)}">
<div><label>Persona</label>${select('idpersona', personas, d.idpersona)}
<span class="small">¿No aparece? Regístrela primero en <a href="/personas/nuevo">Personas</a>.</span></div>
<div><label>Tipo de contrato</label>${select('tipocontrato', CONTRATOS.map((c) => ({ value: c, label: c })), d.tipocontrato, { vacio: null })}</div>
<div class="full"><button class="btn">Guardar</button> <a class="btn sec" href="/docentes">Cancelar</a></div>
</form></div>`);
}

router.get('/nuevo', (req, res) => formulario(req, res, { iddocente: '', idpersona: '', tipocontrato: 'Nombrado' }, 'Nuevo docente'));
router.get('/:id/editar', (req, res) => {
  const d = get('SELECT * FROM docentes WHERE iddocente = ?', Number(req.params.id));
  if (!d) return res.redirect('/docentes');
  formulario(req, res, d, 'Editar docente');
});

router.post('/guardar', (req, res) => {
  const b = req.body;
  try {
    if (b.iddocente) run('UPDATE docentes SET idpersona=?, tipocontrato=? WHERE iddocente=?', Number(b.idpersona), b.tipocontrato, Number(b.iddocente));
    else run('INSERT INTO docentes (idpersona,tipocontrato) VALUES (?,?)', Number(b.idpersona), b.tipocontrato);
    flash(req, 'Docente guardado.');
  } catch (e) { flash(req, 'No se pudo guardar el docente.', 'err'); }
  res.redirect('/docentes');
});

router.post('/eliminar', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Solo administradores.');
  try { run('DELETE FROM docentes WHERE iddocente = ?', Number(req.body.id)); flash(req, 'Docente eliminado.'); }
  catch (e) { flash(req, 'No se puede eliminar: el docente tiene grupos asignados.', 'err'); }
  res.redirect('/docentes');
});

module.exports = router;
