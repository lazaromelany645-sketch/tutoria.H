const express = require('express');
const path = require('path');
const { sessionMiddleware, csrfMiddleware, requireLogin } = require('./lib/auth');
require('./db'); // crea tablas y datos de ejemplo

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(sessionMiddleware);
app.use(csrfMiddleware);

app.use('/', require('./routes/inicio'));
app.use('/personas', requireLogin, require('./routes/personas'));
app.use('/docentes', requireLogin, require('./routes/docentes'));
app.use('/matriculas', requireLogin, require('./routes/matriculas'));
app.use('/grupos', requireLogin, require('./routes/grupos'));
app.use('/usuarios', require('./routes/usuarios'));
app.use('/atenciones', requireLogin, require('./routes/atenciones'));

app.use((req, res) => res.status(404).send('Página no encontrada'));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).send('Error interno del servidor.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sistema de Tutoría en http://localhost:${PORT}`));
