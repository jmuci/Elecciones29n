// Estado del test y su codificación para compartir. Sin dependencias de Astro: lo usan los
// scripts del cliente (test y aviso de test a medias) y el build.

/** Clave de `localStorage` con las respuestas en curso. */
export const CLAVE_ESTADO = 'test-afinidad-v2';
/** Clave de `localStorage` con la página del test en la que se quedó (índice desde 0). */
export const CLAVE_PASO = 'test-afinidad-paso-v2';
/** Clave de `sessionStorage`: el aviso de test a medias se cerró en esta sesión. */
export const CLAVE_AVISO = 'test-afinidad-aviso-cerrado';
/** Prefijo del fragmento de un resultado compartido: `/test#r=…`. */
export const PREFIJO_COMPARTIR = '#r=';
export const NOMBRE_MAX = 40;
/** Importancia por defecto de cada pregunta (escala 1–5). */
export const IMPORTANCIA_INICIAL = 3;

/**
 * Respuesta a una pregunta: las opciones marcadas (índices, ordenados y sin repetir), `'ninguna'`
 * («ninguna de las opciones me convence») o `null` si no se ha respondido.
 */
export type Respuesta = number[] | 'ninguna' | null;

export type Estado = Record<string, { importancia: number; respuesta: Respuesta }>;

/**
 * Normaliza lo que haya guardado o llegue de fuera. Los estados anteriores guardaban un solo
 * número por pregunta; se leen como una única opción marcada.
 */
export function normalizarRespuesta(valor: unknown): Respuesta {
  if (valor === 'ninguna') return 'ninguna';
  if (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0) return [valor];
  if (Array.isArray(valor)) {
    const indices = [...new Set(valor.filter((v): v is number => Number.isInteger(v) && v >= 0))].sort((a, b) => a - b);
    return indices.length > 0 ? indices : null;
  }
  return null;
}

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
  const respondidas = valores.filter((v) => normalizarRespuesta(v.respuesta) !== null).length;
  const empezado = respondidas > 0;
  return { respondidas, total: valores.length, aMedias: empezado && respondidas < valores.length };
}

const VERSION = 2;
/** Versiones que `decodificar` sabe leer. La 1 guardaba una sola opción por pregunta (4 bits). */
const VERSION_UNA_OPCION = 1;
const SIN_RESPUESTA_V1 = 0x0f;
/** En la máscara de la v2, los bits 0–14 son las opciones y el bit 15 es «ninguna». */
const BIT_NINGUNA = 0x8000;
/** Máximo de opciones por pregunta que caben en la máscara. */
export const MAX_OPCIONES = 15;

const aBase64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const deBase64url = (texto: string): Uint8Array =>
  Uint8Array.from(atob(texto.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const aMascara = (respuesta: Respuesta): number => {
  const r = normalizarRespuesta(respuesta);
  if (r === null) return 0;
  if (r === 'ninguna') return BIT_NINGUNA;
  return r.reduce((m, i) => (i < MAX_OPCIONES ? m | (1 << i) : m), 0);
};

/** `undefined` si la máscara marca opciones que no existen (o mezcla «ninguna» con opciones). */
const deMascara = (mascara: number, opciones: number): Respuesta | undefined => {
  if (mascara === 0) return null;
  if (mascara === BIT_NINGUNA) return 'ninguna';
  if (mascara & BIT_NINGUNA) return undefined;
  const indices: number[] = [];
  for (let i = 0; i < MAX_OPCIONES; i++) if (mascara & (1 << i)) indices.push(i);
  return indices.every((i) => i < opciones) ? indices : undefined;
};

/**
 * Formato (v2): [versión][longitud del nombre][nombre UTF-8] y, por pregunta,
 * [huella 16 bits][importancia][máscara de respuesta 16 bits] (máscara 0 = sin respuesta).
 * Ir por huella y no por posición hace que el enlace siga valiendo si se añaden o quitan preguntas.
 */
export function codificar(nombre: string, estado: Estado): string {
  const n = new TextEncoder().encode(nombre.trim().slice(0, NOMBRE_MAX));
  const preguntas = Object.entries(estado);
  const bytes = new Uint8Array(2 + n.length + 5 * preguntas.length);
  bytes[0] = VERSION;
  bytes[1] = n.length;
  bytes.set(n, 2);
  preguntas.forEach(([id, { importancia, respuesta }], i) => {
    const o = 2 + n.length + 5 * i;
    const h = huella(id);
    const m = aMascara(respuesta);
    bytes[o] = h >> 8;
    bytes[o + 1] = h & 0xff;
    bytes[o + 2] = importancia;
    bytes[o + 3] = m >> 8;
    bytes[o + 4] = m & 0xff;
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
  const version = bytes[0];
  if (bytes.length < 2 || (version !== VERSION && version !== VERSION_UNA_OPCION)) return null;
  const tamano = version === VERSION ? 5 : 3;
  const largo = bytes[1] ?? 0;
  const inicio = 2 + largo;
  if (bytes.length < inicio || (bytes.length - inicio) % tamano !== 0) return null;
  const nombre = new TextDecoder().decode(bytes.subarray(2, inicio));
  const porHuella = new Map(preguntas.map((p) => [huella(p.id), p]));
  const estado: Estado = Object.fromEntries(
    preguntas.map((p) => [p.id, { importancia: IMPORTANCIA_INICIAL, respuesta: null as Respuesta }]),
  );
  let descartadas = 0;
  for (let o = inicio; o < bytes.length; o += tamano) {
    const p = porHuella.get(((bytes[o] ?? 0) << 8) | (bytes[o + 1] ?? 0));
    let importancia: number;
    let respuesta: Respuesta | undefined;
    if (version === VERSION) {
      importancia = bytes[o + 2] ?? 0;
      respuesta = p ? deMascara(((bytes[o + 3] ?? 0) << 8) | (bytes[o + 4] ?? 0), p.opciones.length) : undefined;
    } else {
      const valor = bytes[o + 2] ?? 0;
      importancia = valor >> 4;
      const r = valor & 0x0f;
      // Los enlaces más antiguos usaban importancia 0 para «no cuenta»: se quedan sin responder.
      if (importancia === 0) continue;
      respuesta = r === SIN_RESPUESTA_V1 ? null : p && r < p.opciones.length ? [r] : undefined;
    }
    if (!p || importancia < 1 || importancia > 5 || respuesta === undefined) {
      descartadas += 1;
      continue;
    }
    estado[p.id] = { importancia, respuesta };
  }
  return { nombre, estado, descartadas };
}
