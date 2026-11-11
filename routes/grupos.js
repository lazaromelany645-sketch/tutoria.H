const router = require('express').Router();
const { all, get, run } = require('../db');
const { isAdmin } = require('../lib/auth');
const { esc, render, flash, csrfInput, miniForm, select, nombreCompleto } = require('../lib/ui');

const NIVELES = ['Inicial', 'Primaria', 'Secundaria'];

router.get('/', (req, res) => {
  const filas = all(
    `SELECT g.*, m.periodo,
            a.apellidos || ', ' || a.nombres AS alumno,
            ap.apellidos || ', ' || ap.nombres AS apoderado, ap.telefono AS tel_apo,
            pd.apellidos || ', ' || pd.nombres AS docente
     FROM grupos g
     JOIN matriculas m ON m.idmatricula = g.idmatricula
     JOIN personas a  ON a.idpersona  = g.idalumno
     JOIN personas ap ON ap.idpersona = g.idapoderado
     JOIN docentes d  ON d.iddocente  = g.iddocente
     JOIN personas pd ON pd.idpersona = d.idpersona
     ORDER BY m.periodo DESC, g.nivel, g.grado, g.seccion, a.apellidos`);
  render(req, res, 'Grupos', `
<div class="bar"><h1>Grupos</h1><a class="btn" href="/grupos/nuevo">+ Asignar alumno a grupo</a></div>
<table><tr><th>Periodo</th><th>Grupo</th><th>Alumno</th><th>Apoderado</th><th>Docente tutor</th><th></th></tr>
${filas.map((g) => `<tr><td>${esc(g.periodo)}</td><td>${esc(`${g.nivel} ${g.grado}° "${g.seccion}"`)}</td><td>${esc(g.alumno)}</td>
<td>${esc(g.apoderado)}<br><span class="small">${esc(g.tel_apo)}</span></td><td>${esc(g.docente)}</td>
<td><a class="btn sm" href="/grupos/${g.idgrupo}/editar">Editar</a> <a class="btn sm sec" href="/atenciones/nuevo?idgrupo=${g.idgrupo}">+ Caso</a>
${isAdmin(req) ? miniForm(req, '/grupos/eliminar', { id: g.idgrupo }, 'Eliminar', 'sm del', '¿Eliminar?') : ''}</td></tr>`).join('') || '<tr><td colspan="6">Sin grupos.</td></tr>'}
</table>`);
});

function formulario(req, res, g, titulo) {
  const mats = all('SELECT * FROM matriculas ORDER BY periodo DESC').map((m) => ({ value: m.idmatricula, label: m.periodo }));
  const pers = all('SELECT idpersona, apellidos, nombres, numerodoc FROM personas ORDER BY apellidos, nombres')
    .map((p) => ({ value: p.idpersona, label: `${nombreCompleto(p)} - ${p.numerodoc}` }));
  const docs = all('SELECT d.iddocente, p.apellidos, p.nombres FROM docentes d JOIN personas p ON p.idpersona = d.idpersona ORDER BY p.apellidos')
    .map((d) => ({ value: d.iddocente, label: nombreCompleto(d) }));
  render(req, res, titulo, `<h1>${titulo}</h1><div class="card">
<form class="f" method="post" action="/grupos/guardar">${csrfInput(req)}
<input type="hidden" name="idgrupo" value="${esc(g.idgrupo)}">
<div><label>Periodo (matrícula)</label>${select('idmatricula', mats, g.idmatricula, { vacio: null })}</div>
<div><label>Nivel</label>${select('nivel', NIVELES.map((n) => ({ value: n, label: n })), g.nivel, { vacio: null })}</div>
<div><label>Grado</label><input name="grado" value="${esc(g.grado)}" required></div>
<div><label>Sección</label><input name="seccion" maxlength="5" value="${esc(g.seccion)}" required></div>
<div><label>Alumno</label>${select('idalumno', pers, g.idalumno)}</div>
<div><label>Apoderado</label>${select('idapoderado', pers, g.idapoderado)}</div>
<div><label>Docente tutor</label>${select('iddocente', docs, g.iddocente)}</div>
<div class="full"><button class="btn">Guardar</button> <a class="btn sec" href="/grupos">Cancelar</a></div>
</form></div>`);
}

router.get('/nuevo', (req, res) => formulario(req, res, { idgrupo: '', idmatricula: '', nivel: 'Secundaria', grado: '', seccion: '', idalumno: '', iddocente: '', idapoderado: '' }, 'Nuevo grupo (asignar alumno)'));
router.get('/:id/editar', (req, res) => {
  const g = get('SELECT * FROM grupos WHERE idgrupo = ?', Number(req.params.id));
  if (!g) return res.redirect('/grupos');
  formulario(req, res, g, 'Editar grupo');
});

router.post('/guardar', (req, res) => {
  const b = req.body;
  const d = [Number(b.idmatricula), b.nivel, String(b.grado).trim(), String(b.seccion).trim().toUpperCase(), Number(b.idalumno), Number(b.iddocente), Number(b.idapoderado)];
  try {
    if (b.idgrupo) run('UPDATE grupos SET idmatricula=?, nivel=?, grado=?, seccion=?, idalumno=?, iddocente=?, idapoderado=? WHERE idgrupo=?', ...d, Number(b.idgrupo));
    else run('INSERT INTO grupos (idmatricula,nivel,grado,seccion,idalumno,iddocente,idapoderado) VALUES (?,?,?,?,?,?,?)', ...d);
    flash(req, 'Grupo guardado.');
  } catch (e) { flash(req, 'No se pudo guardar el grupo.', 'err'); }
  res.redirect('/grupos');
});

router.post('/eliminar', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Solo administradores.');
  try { run('DELETE FROM grupos WHERE idgrupo = ?', Number(req.body.id)); flash(req, 'Grupo eliminado.'); }
  catch (e) { flash(req, 'No se puede eliminar: el grupo tiene atenciones.', 'err'); }
  res.redirect('/grupos');
});

module.exports = router;
