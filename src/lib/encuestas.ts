import { getCollection } from 'astro:content';
import { PARTIDOS_ENCUESTA, TOTAL_ESCANOS } from './modelo';
import type { Encuesta, PartidoEncuesta } from './modelo';

export type EscanosEncuesta = NonNullable<Encuesta['data']['escanos']>[PartidoEncuesta];

export interface Rango {
  min: number;
  max: number;
}

/** Segmento del hemiciclo: un partido (con su clase de color) o el resto. */
export interface Segmento {
  id: PartidoEncuesta | 'resto';
  etiqueta: string;
  escanos: number;
  /** Texto con la horquilla original, si la encuesta la da. */
  rango?: string;
}

export const rangoDe = (v: NonNullable<EscanosEncuesta>): Rango =>
  typeof v === 'number' ? { min: v, max: v } : v;

/** Punto medio redondeado hacia arriba; es lo que dibuja el hemiciclo cuando la fuente da horquilla. */
export const centro = (v: NonNullable<EscanosEncuesta>): number => {
  const { min, max } = rangoDe(v);
  return Math.round((min + max) / 2);
};

export const textoEscanos = (v: EscanosEncuesta): string => {
  if (v === undefined) return 'n/d';
  const { min, max } = rangoDe(v);
  return min === max ? String(min) : `${min}–${max}`;
};

const formatoPct = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const textoPct = (v: number | undefined): string => (v === undefined ? 'n/d' : `${formatoPct.format(v)} %`);

/** Ordena de más reciente a más antigua por fin de campo; a igualdad, por instituto. */
export const porFechaDesc = (a: Encuesta, b: Encuesta): number =>
  b.data.campo_fin.getTime() - a.data.campo_fin.getTime() || a.data.instituto.localeCompare(b.data.instituto, 'es');

export async function cargarEncuestas(): Promise<Encuesta[]> {
  return (await getCollection('encuestas')).sort(porFechaDesc);
}

/**
 * Segmentos del hemiciclo de una encuesta: los partidos desglosados (punto
 * medio si hay horquilla) y un «Resto» que completa los 350 escaños. Si falta
 * un partido, sus escaños quedan dentro del resto.
 */
export function segmentos(
  escanos: NonNullable<Encuesta['data']['escanos']>,
  nombres: Record<PartidoEncuesta, string>,
): Segmento[] {
  const partes: Segmento[] = PARTIDOS_ENCUESTA.flatMap((id) => {
    const v = escanos[id];
    if (v === undefined) return [];
    const r = rangoDe(v);
    return [{ id, etiqueta: nombres[id], escanos: centro(v), rango: r.min === r.max ? undefined : textoEscanos(v) }];
  });
  const suma = partes.reduce((acc, s) => acc + s.escanos, 0);
  return [...partes, { id: 'resto', etiqueta: 'Resto', escanos: TOTAL_ESCANOS - suma }];
}

/**
 * Media simple (sin ponderar) de los puntos medios de las encuestas con
 * escaños. Cada partido se promedia solo entre las encuestas que lo desglosan.
 */
export function media(
  encuestas: Encuesta[],
  nombres: Record<PartidoEncuesta, string>,
): { segmentos: Segmento[]; n: number; rangos: Partial<Record<PartidoEncuesta, Rango>> } {
  const conEscanos = encuestas.filter((e) => e.data.escanos !== undefined);
  const rangos: Partial<Record<PartidoEncuesta, Rango>> = {};
  const partes: Segmento[] = PARTIDOS_ENCUESTA.map((id) => {
    const valores = conEscanos.flatMap((e) => {
      const v = e.data.escanos?.[id];
      return v === undefined ? [] : [centro(v)];
    });
    if (valores.length > 0) rangos[id] = { min: Math.min(...valores), max: Math.max(...valores) };
    const m = valores.length === 0 ? 0 : valores.reduce((a, b) => a + b, 0) / valores.length;
    return { id, etiqueta: nombres[id], escanos: Math.round(m) };
  });
  const suma = partes.reduce((acc, s) => acc + s.escanos, 0);
  return {
    segmentos: [...partes, { id: 'resto', etiqueta: 'Resto', escanos: TOTAL_ESCANOS - suma }],
    n: conEscanos.length,
    rangos,
  };
}

export interface Escaño {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Posiciones de los escaños de un hemiciclo, de izquierda a derecha, para
 * pintarlos en un viewBox de 200×105. Los partidos ocupan tramos consecutivos
 * en el orden fijo de la web; no hay ubicación ideológica.
 */
export function posicionesHemiciclo(total: number = TOTAL_ESCANOS, filas = 11): Escaño[] {
  const centroX = 100;
  const centroY = 100;
  const rExt = 96;
  const rInt = 40;
  const radios = Array.from({ length: filas }, (_, i) => rInt + ((rExt - rInt) * i) / (filas - 1));
  const sumaRadios = radios.reduce((a, b) => a + b, 0);
  const porFila = radios.map((r) => Math.round((total * r) / sumaRadios));
  porFila[filas - 1] = (porFila[filas - 1] ?? 0) + (total - porFila.reduce((a, b) => a + b, 0));

  const separacionFilas = (rExt - rInt) / (filas - 1);
  const puntos: (Escaño & { angulo: number })[] = [];
  radios.forEach((radio, i) => {
    const n = porFila[i] ?? 0;
    const separacionArco = (Math.PI * radio) / (n - 1);
    const r = 0.42 * Math.min(separacionFilas, separacionArco);
    for (let j = 0; j < n; j++) {
      const angulo = Math.PI - (Math.PI * j) / (n - 1);
      puntos.push({
        cx: Number((centroX + radio * Math.cos(angulo)).toFixed(2)),
        cy: Number((centroY - radio * Math.sin(angulo)).toFixed(2)),
        r: Number(r.toFixed(2)),
        angulo,
      });
    }
  });
  return puntos.sort((a, b) => b.angulo - a.angulo).map(({ cx, cy, r }) => ({ cx, cy, r }));
}
