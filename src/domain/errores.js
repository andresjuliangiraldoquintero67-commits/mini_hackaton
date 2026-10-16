// Error de negocio: se muestra al usuario tal cual, con su código HTTP.
export class ErrorDominio extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

export const datoInvalido = (msg) => new ErrorDominio(400, 'DATO_INVALIDO', msg);
export const noEncontrado = (msg) => new ErrorDominio(404, 'NO_ENCONTRADO', msg);
export const conflicto = (codigo, msg) => new ErrorDominio(409, codigo, msg);
export const reglaIncumplida = (codigo, msg) => new ErrorDominio(422, codigo, msg);
