// Estado del test y su codificación para compartir. Sin dependencias de Astro: lo usan los
// scripts del cliente (test y aviso de test a medias) y el build.

/** Clave de `localStorage` con las respuestas en curso. */
export const CLAVE_ESTADO = 'test-afinidad-v1';
/** Clave de `localStorage` con la página del test en la que se quedó (índice desde 0). */
export const CLAVE_PASO = 'test-afinidad-paso-v1';
/** Clave de `sessionStorage`: el aviso de test a medias se cerró en esta sesión. */
export const CLAVE_AVISO = 'test-afinidad-aviso-cerrado';
/** Prefijo del fragmento de un resultado compartido: `/test#r=…`. */
export const PREFIJO_COMPARTIR = '#r=';
export const NOMBRE_MAX = 40;
/** Importancia por defecto de cada pregunta (escala 1–5). */
export const IMPORTANCIA_INICIAL = 3;

export type Estado = Record<string, { importancia: number; respuesta: number | null }>;

/** FNV-1a de 32 bits. */
export function fnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Identificador corto (16 bits) de una pregunta en el enlace. El build comprueba que no colisionan. */
export const huella = (id: string): number => fnv1a(id) & 0xffff;

/** Preguntas a medias: alguna respondida y alguna sin responder. */
export function progreso(estado: Estado): { respondidas: number; total: number; aMedias: boolean } {
  const valores = Object.values(estado);
  const respondidas = valores.filter((v) => v.respuesta !== null).length;
  const empezado = valores.some((v) => v.respuesta !== null);
  return { respondidas, total: valores.length, aMedias: empezado && respondidas < valores.length };
}

const VERSION = 1;
const SIN_RESPUESTA = 0x0f;

const aBase64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const deBase64url = (texto: string): Uint8Array =>
  Uint8Array.from(atob(texto.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/**
 * Formato (v1): [versión][longitud del nombre][nombre UTF-8] y, por pregunta,
 * [huella 16 bits][importancia << 4 | respuesta (0x0f = sin respuesta)].
 * Ir por huella y no por posición hace que el enlace siga valiendo si se añaden o quitan preguntas.
 */
export function codificar(nombre: string, estado: Estado): string {
  const n = new TextEncoder().encode(nombre.trim().slice(0, NOMBRE_MAX));
  const preguntas = Object.entries(estado);
  const bytes = new Uint8Array(2 + n.length + 3 * preguntas.length);
  bytes[0] = VERSION;
  bytes[1] = n.length;
  bytes.set(n, 2);
  preguntas.forEach(([id, { importancia, respuesta }], i) => {
    const o = 2 + n.length + 3 * i;
    const h = huella(id);
    bytes[o] = h >> 8;
    bytes[o + 1] = h & 0xff;
    bytes[o + 2] = (importancia << 4) | (respuesta ?? SIN_RESPUESTA);
  });
  return aBase64url(bytes);
}

/**
 * Devuelve `null` si el enlace está mal formado. Las preguntas que ya no existen, o cuya
 * respuesta no cabe en las opciones actuales, se descartan; las nuevas quedan sin contar.
 */
export function decodificar(
  texto: string,
  preguntas: { id: string; opciones: unknown[] }[],
): { nombre: string; estado: Estado; descartadas: number } | null {
  let bytes: Uint8Array;
  try {
    bytes = deBase64url(texto);
  } catch {
    return null;
  }
  if (bytes.length < 2 || bytes[0] !== VERSION) return null;
  const largo = bytes[1] ?? 0;
  const inicio = 2 + largo;
  if (bytes.length < inicio || (bytes.length - inicio) % 3 !== 0) return null;
  const nombre = new TextDecoder().decode(bytes.subarray(2, inicio));
  const porHuella = new Map(preguntas.map((p) => [huella(p.id), p]));
  const estado: Estado = Object.fromEntries(
    preguntas.map((p) => [p.id, { importancia: IMPORTANCIA_INICIAL, respuesta: null as number | null }]),
  );
  let descartadas = 0;
  for (let o = inicio; o < bytes.length; o += 3) {
    const p = porHuella.get(((bytes[o] ?? 0) << 8) | (bytes[o + 1] ?? 0));
    const valor = bytes[o + 2] ?? 0;
    const importancia = valor >> 4;
    const r = valor & 0x0f;
    // Los enlaces anteriores usaban importancia 0 para «no cuenta»: se quedan sin responder.
    if (importancia === 0) continue;
    if (!p || importancia > 5 || (r !== SIN_RESPUESTA && r >= p.opciones.length)) {
      descartadas += 1;
      continue;
    }
    estado[p.id] = { importancia, respuesta: r === SIN_RESPUESTA ? null : r };
  }
  return { nombre, estado, descartadas };
}
