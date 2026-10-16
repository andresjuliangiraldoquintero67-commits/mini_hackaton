/**
 * Ejecuta fn dentro de una transacción. BEGIN IMMEDIATE toma el bloqueo de escritura
 * antes de leer: dos solicitudes simultáneas no pueden validar y escribir a la vez.
 * Si fn lanza un error, se deshace todo.
 */
export function enTransaccion(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
