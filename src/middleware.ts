import { defineMiddleware } from 'astro:middleware';
import { validarReferencias } from './lib/referencias';

// En build se valida una sola vez; en dev, en cada petición (el contenido cambia).
let validacion: Promise<void> | undefined;

export const onRequest = defineMiddleware(async (_context, next) => {
  if (import.meta.env.DEV) {
    await validarReferencias();
  } else {
    validacion ??= validarReferencias();
    await validacion;
  }
  return next();
});
