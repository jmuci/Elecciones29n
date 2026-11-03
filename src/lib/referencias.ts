import { getCollection } from 'astro:content';

/**
 * Astro 7 solo registra en el log las referencias rotas (p. ej. una `fuente`
 * que no existe), sin hacer fallar el build. Esta comprobación lanza un error
 * con todas las referencias rotas. La invoca `src/middleware.ts`.
 */
const COLECCIONES = ['partidos', 'temas', 'fuentes', 'propuestas', 'preguntas', 'gobiernos', 'casos'] as const;

type Referencia = { collection: string; id: string };

function esReferencia(v: unknown): v is Referencia {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Referencia).collection === 'string' &&
    typeof (v as Referencia).id === 'string' &&
    (COLECCIONES as readonly string[]).includes((v as Referencia).collection)
  );
}

function* referencias(valor: unknown, ruta: string): Generator<[string, Referencia]> {
  if (esReferencia(valor)) {
    yield [ruta, valor];
  } else if (Array.isArray(valor)) {
    for (const [i, v] of valor.entries()) yield* referencias(v, `${ruta}[${i}]`);
  } else if (typeof valor === 'object' && valor !== null && !(valor instanceof Date)) {
    for (const [k, v] of Object.entries(valor)) yield* referencias(v, ruta ? `${ruta}.${k}` : k);
  }
}

export async function validarReferencias(): Promise<void> {
  const entradas = await Promise.all(COLECCIONES.map((c) => getCollection(c)));
  const ids = new Set(entradas.flat().map((e) => `${e.collection}/${e.id}`));
  const rotas: string[] = [];
  for (const entrada of entradas.flat()) {
    for (const [ruta, ref] of referencias(entrada.data, '')) {
      if (!ids.has(`${ref.collection}/${ref.id}`)) {
        rotas.push(`- ${entrada.collection}/${entrada.id} (${ruta}): no existe "${ref.id}" en ${ref.collection}`);
      }
    }
  }
  if (rotas.length > 0) {
    throw new Error(`Referencias rotas en src/content:\n${rotas.join('\n')}`);
  }
}
