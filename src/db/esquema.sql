PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS espacios (
  id      INTEGER PRIMARY KEY,
  codigo  TEXT NOT NULL UNIQUE,
  nombre  TEXT NOT NULL,
  tipo    TEXT NOT NULL CHECK (tipo IN ('aula', 'cubiculo')),
  aforo   INTEGER NOT NULL CHECK (aforo > 0),
  estado  TEXT NOT NULL CHECK (estado IN ('habilitado', 'inhabilitado', 'mantenimiento'))
);

CREATE TABLE IF NOT EXISTS recursos (
  id         INTEGER PRIMARY KEY,
  codigo     TEXT NOT NULL UNIQUE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('televisor', 'cable_hdmi')),
  espacio_id INTEGER NOT NULL REFERENCES espacios(id),
  estado     TEXT NOT NULL CHECK (estado IN ('operativo', 'danado', 'en_reparacion'))
);

-- Fechas en hora local del campus (America/Bogota) con formato 'YYYY-MM-DDTHH:MM'.
-- Un único formato permite comparar como texto sin errores de zona horaria.
CREATE TABLE IF NOT EXISTS reservas (
  id                    INTEGER PRIMARY KEY,
  espacio_id            INTEGER NOT NULL REFERENCES espacios(id),
  tipo_solicitante      TEXT NOT NULL CHECK (tipo_solicitante IN ('campus', 'empresa')),
  organizacion          TEXT NOT NULL,
  responsable           TEXT NOT NULL,
  asistentes            INTEGER NOT NULL CHECK (asistentes > 0),
  inicio                TEXT NOT NULL,
  fin                   TEXT NOT NULL,
  equipos_a_transmitir  INTEGER NOT NULL DEFAULT 0 CHECK (equipos_a_transmitir >= 0),
  estado                TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada')),
  creado_en             TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (fin > inicio)
);
CREATE INDEX IF NOT EXISTS idx_reservas_espacio ON reservas (espacio_id, estado, inicio);

-- Módulo 2: los equipos son fijos, el "préstamo" es su asignación a una franja horaria.
CREATE TABLE IF NOT EXISTS asignaciones_recurso (
  id          INTEGER PRIMARY KEY,
  reserva_id  INTEGER NOT NULL REFERENCES reservas(id),
  recurso_id  INTEGER NOT NULL REFERENCES recursos(id),
  inicio      TEXT NOT NULL,
  fin         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS historial_recurso (
  id              INTEGER PRIMARY KEY,
  recurso_id      INTEGER NOT NULL REFERENCES recursos(id),
  estado_anterior TEXT NOT NULL,
  estado_nuevo    TEXT NOT NULL,
  motivo          TEXT NOT NULL,
  incidencia_id   INTEGER,
  fecha           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Módulo 3 (incremento 2)
CREATE TABLE IF NOT EXISTS incidencias (
  id                   INTEGER PRIMARY KEY,
  descripcion          TEXT NOT NULL,
  espacio_id           INTEGER REFERENCES espacios(id),
  recurso_id           INTEGER REFERENCES recursos(id),
  categoria            TEXT,
  prioridad            TEXT,
  area_destino         TEXT,
  estado               TEXT NOT NULL DEFAULT 'abierta',
  origen_clasificacion TEXT NOT NULL DEFAULT 'pendiente' CHECK (origen_clasificacion IN ('ia', 'manual', 'pendiente')),
  ia_justificacion     TEXT,
  ia_modelo            TEXT,
  creado_en            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Registros de los archivos oficiales que no pasaron la validación
CREATE TABLE IF NOT EXISTS import_errores (
  id      INTEGER PRIMARY KEY,
  archivo TEXT NOT NULL,
  fila    INTEGER NOT NULL,
  motivo  TEXT NOT NULL,
  payload TEXT NOT NULL
);
