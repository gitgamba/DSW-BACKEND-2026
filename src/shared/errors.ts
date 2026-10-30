// Errores del negocio: cada uno sabe con qué status HTTP se responde.
// Los services los lanzan y el errorHandler los convierte en la respuesta JSON.
export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

// 409: el pedido es válido, pero choca con el estado actual de los datos
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

// 401: no sabemos quién sos (falta el token, es inválido o las credenciales no cierran)
export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(401, message);
  }
}

// 403: sabemos quién sos, pero no podés hacer esto
export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, message);
  }
}
