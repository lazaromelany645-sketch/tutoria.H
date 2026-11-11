// Módulo principal: TUTORÍA -> ATENDER CASOS
const router = require('express').Router();
const { all, get, run } = require('../db');
const { isAdmin } = require('../lib/auth');
const { MOTIVOS, ESTADOS, esc, nl2br, hoy, render, flash, csrfInput, miniForm, select } = require('../lib/ui');

router.get('/', (req, res) => {
  const fe = String(req.query.estado || ''), fm = String(req.query.motivo || ''), q = String(req.query.q || '').trim();
  let sql = `SELECT a.*, g.grado, g.seccion, p.apellidos || ', ' || p.nombres AS alumno, u.nomuser
             FROM atenciones a JOIN grupos g ON g.idgrupo = a.idgrupo
             JOIN personas p ON p.idpersona = g.idalumno JOIN usuarios u ON u.idusuario = a.idusuario WHERE 1=1`;
  const par = [];
  if (ESTADOS[fe]) { sql += ' AND a.estado = ?'; par.push(fe); }
  if (MOTIVOS.includes(fm)) { sql += ' AND a.motivo = ?'; par.push(fm); }
  if (q) { sql += ' AND (p.apellidos LIKE ? OR p.nombres LIKE ?)'; par.push(`%${q}%`, `%${q}%`); }
  sql += " ORDER BY CASE a.estado WHEN 'Pendiente' THEN 1 WHEN 'Curso' THEN 2 ELSE 3 END, a.fechaatencion DESC";
  const filas = all(sql, ...par);

  render(req, res, 'Atenciones', `
<div class="bar"><h1>Tutoría · Atender casos</h1><a class="btn" href="/atenciones/nuevo">+ Registrar caso</a></div>
<form class="filtros card" method="get">
  <div><label>Alumno</label><input name="q" value="${esc(q)}" placeholder="Apellido o nombre"></div>
  <div><label>Estado</label>${select('estado', Object.keys(ESTADOS).map((k) => ({ value: k, label: k })), fe, { vacio: 'Todos', required: false })}</div>
  <div><label>Motivo</label>${select('motivo', MOTIVOS.map((m) => ({ value: m, label: m })), fm, { vacio: 'Todos', required: false })}</div>
  <button class="btn">Filtrar</button> <a class="btn sec" href="/atenciones">Limpiar</a>
</form>
<table><tr><th>Fecha</th><th>Alumno</th><th>Grupo</th><th>Motivo</th><th>Descripción / Resolución</th><th>Estado</th><th>Registró</th><th></th></tr>
${filas.map((a) => `<tr><td>${esc(a.fechaatencion)}</td><td>${esc(a.alumno)}</td><td>${esc(a.grado + '° ' + a.seccion)}</td><td>${esc(a.motivo)}</td>
<td>${nl2br(a.descripcion)}${a.resolucion ? `<br><b>Solución:</b> ${nl2br(a.resolucion)}` : ''}</td>
<td><span class="badge ${esc(a.estado)}">${esc(a.estado)}</span></td><td>${esc(a.nomuser)}</td>
<td style="white-space:nowrap"><a class="btn sm" href="/atenciones/${a.idatencion}/editar">Atender</a>
${a.estado === 'Pendiente' ? miniForm(req, '/atenciones/estado', { id: a.idatencion, estado: 'Curso' }, 'Pasar a Curso', 'sm sec') : ''}
${isAdmin(req) ? miniForm(req, '/atenciones/eliminar', { id: a.idatencion }, 'X', 'sm del', '¿Eliminar atención?') : ''}</td></tr>`).join('') || '<tr><td colspan="8">No hay casos con esos filtros.</td></tr>'}
</table>`);
});

function formulario(req, res, a, titulo) {
  const grupos = all(
    `SELECT g.idgrupo, m.periodo, g.nivel, g.grado, g.seccion, p.apellidos || ', ' || p.nombres AS alumno
     FROM grupos g JOIN matriculas m ON m.idmatricula = g.idmatricula JOIN personas p ON p.idpersona = g.idalumno
     ORDER BY m.periodo DESC, p.apellidos`).map((g) => ({ value: g.idgrupo, label: `${g.alumno} — ${g.periodo} · ${g.nivel} ${g.grado}° ${g.seccion}` }));
  render(req, res, titulo, `<h1>${titulo}</h1><div class="card">
<form class="f" method="post" action="/atenciones/guardar">${csrfInput(req)}
<input type="hidden" name="idatencion" value="${esc(a.idatencion)}">
<div class="full"><label>Alumno (grupo)</label>${select('idgrupo', grupos, a.idgrupo)}</div>
<div><label>Fecha de atención</label><input type="date" name="fechaatencion" value="${esc(a.fechaatencion)}" required></div>
<div><label>Motivo</label>${select('motivo', MOTIVOS.map((m) => ({ value: m, label: m })), a.motivo, { vacio: null })}</div>
<div class="full"><label>Descripción del caso</label><textarea name="descripcion">${esc(a.descripcion)}</textarea></div>
<div class="full"><label>Resolución / solución brindada</label><textarea name="resolucion">${esc(a.resolucion)}</textarea></div>
<div><label>Estado</label>${select('estado', Object.entries(ESTADOS).map(([k, t]) => ({ value: k, label: t })), a.estado, { vacio: null })}</div>
<div class="full"><button class="btn">Guardar</button> <a class="btn sec" href="/atenciones">Cancelar</a></div>
</form></div>`);
}

router.get('/nuevo', (req, res) => formulario(req, res,
  { idatencion: '', idgrupo: req.query.idgrupo || '', fechaatencion: hoy(), motivo: MOTIVOS[0], descripcion: '', resolucion: '', estado: 'Pendiente' }, 'Registrar caso'));
router.get('/:id/editar', (req, res) => {
  const a = get('SELECT * FROM atenciones WHERE idatencion = ?', Number(req.params.id));
  if (!a) return res.redirect('/atenciones');
  formulario(req, res, a, `Atender caso #${a.idatencion}`);
});

router.post('/guardar', (req, res) => {
  const b = req.body;
  try {
    if (!MOTIVOS.includes(b.motivo)) throw new Error('Motivo inválido.');
    if (!ESTADOS[b.estado]) throw new Error('Estado inválido.');
    const resolucion = String(b.resolucion || '').trim();
    if (b.estado === 'Resuelto' && !resolucion) throw new Error('Para marcar como Resuelto debe indicar la solución brindada.');
    const d = [Number(b.idgrupo), b.fechaatencion, b.motivo, String(b.descripcion || '').trim(), resolucion || null, b.estado];
    if (b.idatencion) {
      run('UPDATE atenciones SET idgrupo=?, fechaatencion=?, motivo=?, descripcion=?, resolucion=?, estado=? WHERE idatencion=?', ...d, Number(b.idatencion));
      flash(req, 'Atención actualizada.');
    } else {
      run('INSERT INTO atenciones (idgrupo,idusuario,fechaatencion,motivo,descripcion,resolucion,estado) VALUES (?,?,?,?,?,?,?)',
        d[0], req.session.user.idusuario, d[1], d[2], d[3], d[4], d[5]);
      flash(req, 'Caso registrado.');
    }
  } catch (e) { flash(req, e.message || 'No se pudo guardar.', 'err'); return res.redirect(b.idatencion ? `/atenciones/${b.idatencion}/editar` : '/atenciones/nuevo'); }
  res.redirect('/atenciones');
});

router.post('/estado', (req, res) => {
  if (!ESTADOS[req.body.estado]) return res.redirect('/atenciones');
  run('UPDATE atenciones SET estado = ? WHERE idatencion = ?', req.body.estado, Number(req.body.id));
  flash(req, `Caso marcado como ${req.body.estado}.`);
  res.redirect('/atenciones');
});

router.post('/eliminar', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Solo administradores.');
  run('DELETE FROM atenciones WHERE idatencion = ?', Number(req.body.id));
  flash(req, 'Atención eliminada.');
  res.redirect('/atenciones');
});

module.exports = router;
