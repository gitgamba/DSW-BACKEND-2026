import type { PayloadToken } from '../shared/jwt.js';

// Declaration merging: le sumamos a Request de Express el usuario que deja autenticar.
// Es opcional porque en las rutas públicas el middleware no corrió.
declare global {
  namespace Express {
    interface Request {
      usuario?: PayloadToken;
    }
  }
}
