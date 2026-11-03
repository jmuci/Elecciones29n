import { getCollection, type CollectionEntry } from 'astro:content';
import type { Tema } from './modelo';

export type Pregunta = CollectionEntry<'preguntas'>;
export type Opcion = Pregunta['data']['opciones'][number];

/** Importancia por defecto de cada pregunta (escala 0–5; 0 = no cuenta). */
export const IMPORTANCIA_INICIAL = 3;
export const IMPORTANCIAS = [0, 1, 2, 3, 4, 5] as const;

/** Datos mínimos que necesita el script del cliente para calcular la afinidad. */
export interface DatosCliente {
  partidos: string[];
  preguntas: { id: string; tema: string; opciones: string[][] }[];
}

/** FNV-1a de 32 bits: semilla estable a partir del id de la pregunta. */
function semilla(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: generador pseudoaleatorio pequeño y determinista. */
function aleatorio(s: number): () => number {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Baraja las respuestas con una semilla fija por pregunta: el orden no sigue
 * el de los partidos ni el del YAML, y es el mismo en cada build.
 */
function barajar<T>(id: string, lista: readonly T[]): T[] {
  const r = aleatorio(semilla(id));
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}

/** Preguntas en el orden de los temas (y `orden` dentro de cada tema), con las respuestas barajadas. */
export async function cargarPreguntas(temas: Tema[]): Promise<Pregunta[]> {
  const posicion = new Map(temas.map((t, i) => [t.id, i]));
  const preguntas = await getCollection('preguntas');
  preguntas.sort(
    (a, b) =>
      (posicion.get(a.data.tema.id) ?? 0) - (posicion.get(b.data.tema.id) ?? 0) || a.data.orden - b.data.orden,
  );
  return preguntas.map((p) => ({ ...p, data: { ...p.data, opciones: barajar(p.id, p.data.opciones) } }));
}
