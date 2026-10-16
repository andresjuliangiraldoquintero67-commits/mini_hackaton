// ÚNICA fuente de parámetros de las reglas de negocio.
// Para la modificación en vivo: cambia un valor aquí y ejecuta `npm test`.

export const REGLAS = {
  // R2: porcentaje del aforo instalado que se permite ocupar
  PORCENTAJE_AFORO_MAX: 100,

  // R4: mínimo de personas en cualquier reserva
  MIN_ASISTENTES_GENERAL: 2,

  // R1: minutos de separación obligatoria entre reservas del mismo espacio
  MARGEN_ENTRE_RESERVAS_MIN: 0,

  // Duración máxima de una reserva
  DURACION_MAX_RESERVA_MIN: 240,

  // R5: horario de operación del campus (hora local, America/Bogota)
  HORARIO: { apertura: '07:00', cierre: '18:00' },

  // R6 (incremento posterior): reglas especiales del Auditorio
  AUDITORIO: {
    codigo: 'ESP-01',
    min_sin_alternativa: 8,
  },
  BUSQUEDA_ALTERNATIVA: { ventana_min: 120, paso_min: 30 },
};
