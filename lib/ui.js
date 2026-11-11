// Constantes del sistema y helpers de HTML
const { isAdmin } = require('./auth');

const MOTIVOS = [
  'Problemas familiares', 'Muchas inasistencias', 'Bajas calificaciones',
  'Tardanzas', 'No cumple las tareas', 'Conflictiva',
];
const ESTADOS = {
  Pendiente: 'Pendiente (solo se registró)',
  Curso: 'Curso (tutora lo está atendiendo)',
  Resuelto: 'Resuelto (se brindó una solución)',
};

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = (v) => esc(v).replace(/\n/g, '<br>');
const hoy = () => new Date().toLocaleDateString('en-CA');
const nombreCompleto = (p) => `${p.apellidos}, ${p.nombres}`;

function select(name, opciones, valor, { vacio = '-- Seleccione --', required = true } = {}) {
  const o = opciones.map((x) => `<option value="${esc(x.value)}" ${String(x.value) === String(valor) ? 'selected' : ''}>${esc(x.label)}</option>`);
  return `<select name="${name}" ${required ? 'required' : ''}>${vacio !== null ? `<option value="">${vacio}</option>` : ''}${o.join('')}</select>`;
}

function csrfInput(req) {
  return `<input type="hidden" name="_csrf" value="${req.session.csrf}">`;
}

// Formulario pequeño de un solo botón (eliminar, cambiar estado, etc.)
function miniForm(req, action, campos, boton, clase = 'sm', confirmar = '') {
  const hidden = Object.entries(campos).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');
  return `<form method="post" action="${action}" style="display:inline" ${confirmar ? `onsubmit="return confirm('${confirmar}')"` : ''}>${csrfInput(req)}${hidden}<button class="btn ${clase}">${boton}</button></form>`;
}

function flash(req, msg, tipo = 'ok') { req.session.flash = [msg, tipo]; }

function layout(req, titulo, cuerpo) {
  const f = req.session.flash; delete req.session.flash;
  const u = req.session.user;
  const nav = u ? `
<header class="topbar">
  <div class="brand">🎓 Sistema de Tutoría</div>
  <nav>
    <a href="/">Inicio</a><a href="/atenciones">Atenciones</a><a href="/grupos">Grupos</a>
    <a href="/matriculas">Matrículas</a><a href="/personas">Personas</a><a href="/docentes">Docentes</a>
    ${isAdmin(req) ? '<a href="/usuarios">Usuarios</a>' : ''}
  </nav>
  <div class="user">${esc(u.nomuser)} (${esc(u.nivelacceso)}) · <a href="/logout">Salir</a></div>
</header>` : '';
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · Sistema de Tutoría</title><link rel="stylesheet" href="/style.css"></head>
<body>${nav}<main class="container">${f ? `<div class="alert ${esc(f[1])}">${esc(f[0])}</div>` : ''}${cuerpo}</main>
<footer class="footer">Sistema de Tutoría · Node.js + Express + SQLite</footer></body></html>`;
}

const render = (req, res, titulo, cuerpo) => res.send(layout(req, titulo, cuerpo));

module.exports = { MOTIVOS, ESTADOS, esc, nl2br, hoy, nombreCompleto, select, csrfInput, miniForm, flash, render };
