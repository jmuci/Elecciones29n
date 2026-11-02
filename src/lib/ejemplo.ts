/**
 * Datos de ejemplo (ficticios) para desarrollar la UI sin contenido real.
 *
 * true en `astro dev` o si `ELECCIONES_EJEMPLO=1`; false en `astro build`,
 * `astro check` y `astro sync` por defecto. Se evalúa en Node al cargar
 * `content.config.ts`, así que no depende de `import.meta.env`.
 */
// Acceso tipado a `process` sin depender de @types/node.
const proceso = (globalThis as { process?: { argv: string[]; env: Record<string, string | undefined> } })
  .process;

const esDev = proceso?.argv.slice(2).includes('dev') ?? false;

export const INCLUIR_EJEMPLO: boolean = esDev || proceso?.env.ELECCIONES_EJEMPLO === '1';
