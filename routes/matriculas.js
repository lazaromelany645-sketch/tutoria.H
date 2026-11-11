const router = require('express').Router();
const { all, run } = require('../db');
const { isAdmin } = require('../lib/auth');
const { esc, render, flash, csrfInput, miniForm } = require('../lib/ui');

router.get('/', (req, res) => {
  const filas = all('SELECT m.*, (SELECT COUNT(*) FROM grupos g WHERE g.idmatricula = m.idmatricula) total FROM matriculas m ORDER BY periodo DESC');
  render(req, res, 'Matrículas', `
<h1>Matrículas (periodos)</h1>
<div class="card"><form class="filtros" method="post" action="/matriculas/guardar">${csrfInput(req)}
<div><label>Nuevo periodo</label><input name="periodo" placeholder="Ej. 2027" required></div><button class="btn">Agregar</button></form></div>
<table><tr><th>ID</th><th>Periodo</th><th>Alumnos en grupos</th><th></th></tr>
${filas.map((m) => `<tr><td>${m.idmatricula}</td><td>${esc(m.periodo)}</td><td>${m.total}</td>
<td>${isAdmin(req) ? miniForm(req, '/matriculas/eliminar', { id: m.idmatricula }, 'Eliminar', 'sm del', '¿Eliminar periodo?') : ''}</td></tr>`).join('')}
</table>`);
});

router.post('/guardar', (req, res) => {
  const periodo = String(req.body.periodo || '').trim();
  try {
    if (!periodo) throw new Error('vacío');
    run('INSERT INTO matriculas (periodo) VALUES (?)', periodo);
    flash(req, 'Periodo de matrícula registrado.');
  } catch (e) { flash(req, 'Periodo vacío o duplicado.', 'err'); }
  res.redirect('/matriculas');
});

router.post('/eliminar', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Solo administradores.');
  try { run('DELETE FROM matriculas WHERE idmatricula = ?', Number(req.body.id)); flash(req, 'Periodo eliminado.'); }
  catch (e) { flash(req, 'No se puede eliminar: el periodo tiene grupos.', 'err'); }
  res.redirect('/matriculas');
});

module.exports = router;
