// Base de datos SQLite (módulo nativo de Node 22.5+). Tablas según el diagrama:
// USUARIOS, PERSONAS, DOCENTES, MATRICULAS, GRUPOS, ATENCIONES
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./lib/auth');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(process.env.DB_FILE || path.join(dir, 'tutoria.db'));
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS personas (
  idpersona INTEGER PRIMARY KEY AUTOINCREMENT,
  apellidos TEXT NOT NULL,
  nombres   TEXT NOT NULL,
  genero    TEXT NOT NULL,
  tipodoc   TEXT NOT NULL DEFAULT 'DNI',
  numerodoc TEXT NOT NULL UNIQUE,
  telefono  TEXT,
  direccion TEXT
);
CREATE TABLE IF NOT EXISTS docentes (
  iddocente    INTEGER PRIMARY KEY AUTOINCREMENT,
  idpersona    INTEGER NOT NULL REFERENCES personas(idpersona),
  tipocontrato TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usuarios (
  idusuario   INTEGER PRIMARY KEY AUTOINCREMENT,
  idpersona   INTEGER NOT NULL REFERENCES personas(idpersona),
  nomuser     TEXT NOT NULL UNIQUE,
  passuser    TEXT NOT NULL,
  nivelacceso TEXT NOT NULL,
  estado      INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS matriculas (
  idmatricula INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo     TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS grupos (
  idgrupo     INTEGER PRIMARY KEY AUTOINCREMENT,
  idmatricula INTEGER NOT NULL REFERENCES matriculas(idmatricula),
  nivel       TEXT NOT NULL,
  grado       TEXT NOT NULL,
  seccion     TEXT NOT NULL,
  idalumno    INTEGER NOT NULL REFERENCES personas(idpersona),
  iddocente   INTEGER NOT NULL REFERENCES docentes(iddocente),
  idapoderado INTEGER NOT NULL REFERENCES personas(idpersona)
);
CREATE TABLE IF NOT EXISTS atenciones (
  idatencion    INTEGER PRIMARY KEY AUTOINCREMENT,
  idgrupo       INTEGER NOT NULL REFERENCES grupos(idgrupo),
  idusuario     INTEGER NOT NULL REFERENCES usuarios(idusuario),
  fechaatencion TEXT NOT NULL,
  motivo        TEXT NOT NULL,
  descripcion   TEXT,
  resolucion    TEXT,
  estado        TEXT NOT NULL DEFAULT 'Pendiente'
);
`);

const all = (sql, ...p) => db.prepare(sql).all(...p);
const get = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);

// ---- Datos de ejemplo (solo si la base está vacía) ----
if (!get('SELECT 1 x FROM personas LIMIT 1')) {
  const ins = `INSERT INTO personas (apellidos,nombres,genero,tipodoc,numerodoc,telefono,direccion) VALUES (?,?,?,?,?,?,?)`;
  [
    ['Administrador', 'Sistema', 'M', 'DNI', '10000001', '999000001', 'Oficina de tutoría'],
    ['Quispe Ramos', 'Lucía', 'F', 'DNI', '10000002', '999000002', 'Av. Los Olivos 123'],
    ['Huamán Torres', 'Carlos', 'M', 'DNI', '10000003', '999000003', 'Jr. Lima 456'],
    ['Flores Díaz', 'Mariana', 'F', 'DNI', '20000001', '999000004', 'Calle Sol 78'],
    ['Rojas Vega', 'Pedro', 'M', 'DNI', '20000002', '999000005', 'Av. Grau 910'],
    ['Díaz Paredes', 'Rosa', 'F', 'DNI', '30000001', '999000006', 'Calle Sol 78'],
    ['Vega Salas', 'Jorge', 'M', 'DNI', '30000002', '999000007', 'Av. Grau 910'],
  ].forEach((p) => run(ins, ...p));
  run(`INSERT INTO docentes (idpersona,tipocontrato) VALUES (2,'Nombrado'),(3,'Contratado')`);
  run(`INSERT INTO usuarios (idpersona,nomuser,passuser,nivelacceso,estado) VALUES (1,'admin',?,'Administrador',1)`, hashPassword('admin123'));
  run(`INSERT INTO usuarios (idpersona,nomuser,passuser,nivelacceso,estado) VALUES (2,'tutora',?,'Tutor',1)`, hashPassword('tutor123'));
  run(`INSERT INTO matriculas (periodo) VALUES ('2025'),('2026')`);
  run(`INSERT INTO grupos (idmatricula,nivel,grado,seccion,idalumno,iddocente,idapoderado) VALUES (2,'Secundaria','3','A',4,1,6),(2,'Secundaria','3','A',5,1,7)`);
  run(`INSERT INTO atenciones (idgrupo,idusuario,fechaatencion,motivo,descripcion,resolucion,estado) VALUES
    (1,2,'2026-11-02','Muchas inasistencias','Faltó 5 días seguidos.',NULL,'Pendiente'),
    (2,2,'2026-11-05','Bajas calificaciones','Bajo rendimiento en matemática.','Se acordó reforzamiento semanal.','Curso'),
    (1,2,'2026-10-20','Tardanzas','Llega tarde con frecuencia.','Se conversó con la apoderada y mejoró.','Resuelto')`);
}

module.exports = { db, all, get, run };
