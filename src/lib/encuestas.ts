import { getCollection } from 'astro:content';
import { IDS_OTROS, OTROS_PARTIDOS, PARTIDOS_ENCUESTA, TOTAL_ESCANOS } from './modelo';
import type { Encuesta, OtroPartido, PartidoEncuesta } from './modelo';

export type EscanosEncuesta = NonNullable<Encuesta['data']['escanos']>[PartidoEncuesta];

export interface Rango {
  min: number;
  max: number;
}

/** Segmento del hemiciclo: un partido (con su clase de color) o el resto. */
export interface Segmento {
  id: PartidoEncuesta | OtroPartido | 'resto';
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

/** Reparte `total` en enteros proporcionales a `pesos` (mayor resto); si todos los pesos son 0, devuelve ceros. */
function repartir(pesos: number[], total: number): number[] {
  const suma = pesos.reduce((acc, p) => acc + p, 0);
  if (suma === 0) return pesos.map(() => 0);
  const exactos = pesos.map((p) => (p * total) / suma);
  const base = exactos.map(Math.floor);
  let faltan = total - base.reduce((acc, n) => acc + n, 0);
  const porResto = exactos.map((x, i) => ({ i, resto: x - Math.floor(x) })).sort((a, b) => b.resto - a.resto);
  for (const { i } of porResto) {
    if (faltan-- <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
  }
  return base;
}

/**
 * Añade al hemiciclo las otras fuerzas desglosadas y un «Resto» con lo que
 * queda. Si lo desglosado supera los escaños disponibles, se reparte
 * proporcionalmente para que el total siga siendo 350.
 */
function conOtros(partes: Segmento[], otros: Segmento[]): Segmento[] {
  const disponibles = TOTAL_ESCANOS - partes.reduce((acc, s) => acc + s.escanos, 0);
  const suma = otros.reduce((acc, s) => acc + s.escanos, 0);
  const ajustados =
    suma > disponibles ? repartir(otros.map((s) => s.escanos), disponibles).map((escanos, i) => ({ ...otros[i]!, escanos })) : otros;
  const resto = disponibles - ajustados.reduce((acc, s) => acc + s.escanos, 0);
  return [
    ...partes,
    ...ajustados.filter((s) => s.escanos > 0),
    ...(resto > 0 || ajustados.length === 0 ? [{ id: 'resto' as const, etiqueta: 'Resto', escanos: resto }] : []),
  ];
}

/**
 * Segmentos del hemiciclo de una encuesta: los partidos desglosados (punto
 * medio si hay horquilla), las otras fuerzas si la encuesta las desglosa y un
 * «Resto» que completa los 350 escaños. Si falta un partido, sus escaños quedan
 * dentro del resto.
 */
export function segmentos(
  escanos: NonNullable<Encuesta['data']['escanos']>,
  nombres: Record<PartidoEncuesta, string>,
  otros: Encuesta['data']['otros_escanos'] = undefined,
): Segmento[] {
  const partes: Segmento[] = PARTIDOS_ENCUESTA.flatMap((id) => {
    const v = escanos[id];
    if (v === undefined) return [];
    const r = rangoDe(v);
    return [{ id, etiqueta: nombres[id], escanos: centro(v), rango: r.min === r.max ? undefined : textoEscanos(v) }];
  });
  const desglose: Segmento[] = IDS_OTROS.flatMap((id) => {
    const v = otros?.[id];
    if (v === undefined) return [];
    const r = rangoDe(v);
    return [{ id, etiqueta: OTROS_PARTIDOS[id], escanos: centro(v), rango: r.min === r.max ? undefined : textoEscanos(v) }];
  });
  return conOtros(partes, desglose);
}

/**
 * Media simple (sin ponderar) de los puntos medios de las encuestas con
 * escaños. Cada partido se promedia solo entre las encuestas que lo desglosan.
 * Las otras fuerzas se promedian entre las encuestas que las desglosan y se
 * reparten en proporción dentro del «Resto» de la media.
 */
export function media(
  encuestas: Encuesta[],
  nombres: Record<PartidoEncuesta, string>,
): {
  segmentos: Segmento[];
  n: number;
  nOtros: number;
  rangos: Partial<Record<PartidoEncuesta, Rango>>;
} {
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
  const disponibles = TOTAL_ESCANOS - partes.reduce((acc, s) => acc + s.escanos, 0);
  const { filas, n: nOtros } = mediaResto(encuestas);
  const repartidos = repartir(
    filas.map((f) => f.escanos),
    disponibles,
  );
  const otros: Segmento[] = filas.flatMap((f, i) => (repartidos[i] ? [{ id: f.id, etiqueta: f.nombre, escanos: repartidos[i] }] : []));
  return { segmentos: conOtros(partes, otros), n: conEscanos.length, nOtros, rangos };
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

/** Media de los puntos medios de cada otra fuerza entre las encuestas que la desglosan. */
function mediaResto(encuestas: Encuesta[]): { filas: { id: OtroPartido; nombre: string; escanos: number }[]; n: number } {
  const con = encuestas.filter((e) => e.data.otros_escanos !== undefined);
  const filas = IDS_OTROS.flatMap((id) => {
    const valores = con.flatMap((e) => {
      const v = e.data.otros_escanos?.[id];
      return v === undefined ? [] : [centro(v)];
    });
    if (valores.length === 0) return [];
    return [{ id, nombre: OTROS_PARTIDOS[id], escanos: Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) }];
  });
  return { filas, n: con.length };
}
