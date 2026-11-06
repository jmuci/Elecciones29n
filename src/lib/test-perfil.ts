// Perfil, mensaje y mapa de cercanía del resultado del test. Sin dependencias de Astro: lo usa
// el script del cliente. Todo sale de los datos (coincidencias entre respuestas): ningún
// partido se coloca a mano en un eje ni se clasifica.

import { IMPORTANCIA_INICIAL, fnv1a, type Estado } from './test-estado';

/** Un partido solo puede ser «el más afín» si sus propuestas cubren al menos esta parte del peso. */
export const COBERTURA_MINIMA = 0.5;

export interface AfinidadPartido {
  partido: string;
  /** Porcentaje 0–100, o `null` si no tiene propuestas en las preguntas que cuentan. */
  pct: number | null;
  /** Parte del peso total de las preguntas que cuentan en la que el partido tiene propuesta (0–1). */
  parte: number;
}

export type Caso = 'pleno' | 'alineado' | 'dividido' | 'parcial' | 'transversal' | 'sin-datos';

export interface Perfil {
  caso: Caso;
  etiqueta: string;
  mensaje: string;
  /** Partido más afín, si hay alguno con cobertura suficiente. */
  primero?: string;
}

const ETIQUETAS: Record<Caso, string> = {
  pleno: 'Sintonía total',
  alineado: 'Afinidad clara',
  dividido: 'Entre dos',
  parcial: 'Afinidad parcial',
  transversal: 'Perfil transversal',
  'sin-datos': 'Faltan respuestas',
};

// {p1}/{n1}: partido y porcentaje más altos; {p2}/{n2}: los segundos.
const MENSAJES: Record<Caso, string[]> = {
  pleno: [
    'Coincides en el {n1} % con {p1}: casi como si hubieras escrito tú su programa.',
    'Estás de suerte: las propuestas de {p1} coinciden en el {n1} % con lo que has respondido.',
    '{p1} y tú pensáis parecido en casi todo: coincidís en el {n1} % de lo que te importa.',
  ],
  alineado: [
    'Tienes un partido claramente más cercano: {p1}, con un {n1} %. No coincidís en todo, pero sí en buena parte.',
    '{p1} es el que más se parece a lo que piensas ({n1} %), con ventaja sobre el siguiente.',
    'Lo tuyo tiene nombre: {p1}, con un {n1} % de coincidencia y distancia sobre el resto.',
  ],
  dividido: [
    'Estás entre dos: {p1} ({n1} %) y {p2} ({n2} %) quedan casi empatados con tus respuestas.',
    'Te disputan dos partidos: {p1} con un {n1} % y {p2} con un {n2} %. La diferencia es pequeña.',
    'Empate técnico: {p1} ({n1} %) y {p2} ({n2} %) recogen tus respuestas casi por igual.',
  ],
  parcial: [
    'Coincides a medias con varios partidos. El más cercano es {p1}, con un {n1} %.',
    'Ningún partido recoge del todo lo que piensas; {p1} es el que más se acerca, con un {n1} %.',
    'Compartes algunas ideas con cada partido y muchas con ninguno. El más cercano: {p1} ({n1} %).',
  ],
  transversal: [
    'Tus ideas no encajan en un solo paquete: coincides en parte con varios partidos y con ninguno de forma clara. El más cercano es {p1}, con un {n1} %.',
    'Tienes un perfil transversal: tomas posiciones que hoy proponen partidos distintos. El que más se acerca es {p1}, con un {n1} %.',
    'Hoy por hoy ningún partido recoge la mayoría de tus respuestas. Aun así, el más cercano es {p1} ({n1} %).',
  ],
  'sin-datos': [
    'Con estas respuestas no hay ningún partido con propuestas en al menos la mitad de lo que te importa, así que no se puede señalar uno más cercano. Responde más preguntas o cambia su importancia.',
  ],
};

/** Huella estable de las respuestas: el mismo resultado (propio o compartido) elige el mismo texto. */
const semilla = (estado: Estado): number =>
  fnv1a(
    Object.keys(estado)
      .sort()
      .map((id) => `${id}:${estado[id]?.importancia}:${estado[id]?.respuesta}`)
      .join('|'),
  );

/**
 * `afinidades` va en el orden fijo de partidos; ante un empate de porcentaje, gana ese orden.
 * `nombre` traduce el id del partido a su nombre corto.
 */
export function perfil(
  afinidades: AfinidadPartido[],
  estado: Estado,
  nombre: (partido: string) => string,
): Perfil {
  const validos = afinidades
    .filter((a): a is AfinidadPartido & { pct: number } => a.pct !== null && a.parte >= COBERTURA_MINIMA)
    .sort((a, b) => b.pct - a.pct);
  const [uno, dos] = validos;
  let caso: Caso;
  if (!uno) caso = 'sin-datos';
  else if (uno.pct >= 65 && dos && uno.pct - dos.pct < 10) caso = 'dividido';
  else if (uno.pct >= 80) caso = 'pleno';
  else if (uno.pct >= 65) caso = 'alineado';
  else if (uno.pct >= 50) caso = 'parcial';
  else caso = 'transversal';

  const variantes = MENSAJES[caso];
  const plantilla = variantes[semilla(estado) % variantes.length] ?? '';
  const mensaje = plantilla
    .replaceAll('{p1}', uno ? nombre(uno.partido) : '')
    .replaceAll('{n1}', String(uno?.pct ?? ''))
    .replaceAll('{p2}', dos ? nombre(dos.partido) : '')
    .replaceAll('{n2}', String(dos?.pct ?? ''));
  return { caso, etiqueta: ETIQUETAS[caso], mensaje, primero: uno?.partido };
}

/** Temas a los que se ha dado más importancia media (como mucho 3); vacío si todo pesa igual. */
export function prioridades(estado: Estado, preguntas: { id: string; tema: string }[], temas: string[]): string[] {
  const suma = new Map<string, { total: number; n: number }>();
  for (const q of preguntas) {
    const { importancia, respuesta } = estado[q.id] ?? { importancia: IMPORTANCIA_INICIAL, respuesta: null };
    if (respuesta === null) continue;
    const s = suma.get(q.tema) ?? { total: 0, n: 0 };
    s.total += importancia;
    s.n += 1;
    suma.set(q.tema, s);
  }
  const media = (t: string): number => {
    const s = suma.get(t);
    return s ? s.total / s.n : 0;
  };
  const conDatos = temas.filter((t) => suma.has(t));
  const maximo = Math.max(0, ...conDatos.map(media));
  if (conDatos.every((t) => media(t) === maximo)) return [];
  // `sort` es estable: a igual media, manda el orden de los temas de la web.
  return [...conDatos].sort((a, b) => media(b) - media(a)).slice(0, 3);
}

// — Mapa de cercanía —

export interface PuntoMapa {
  id: string;
  x: number;
  y: number;
}

/**
 * Escalado multidimensional por mayorización del estrés (SMACOF) con pesos: coloca los puntos en 2D
 * de modo que sus distancias se parezcan a `d`. `w[i][j] = 0` = distancia desconocida.
 * Arranca de un círculo en el orden de entrada, así que el resultado es determinista.
 */
function smacof(d: number[][], w: number[][], fijos: number, iniciales: [number, number][] = []): [number, number][] {
  const n = d.length;
  const x: [number, number][] = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return iniciales[i] ?? [0.5 * Math.cos(a), 0.5 * Math.sin(a)];
  });
  for (let it = 0; it < 300; it++) {
    const nuevo = x.map((p) => [...p] as [number, number]);
    for (let i = fijos; i < n; i++) {
      let pesos = 0;
      let sx = 0;
      let sy = 0;
      for (let j = 0; j < n; j++) {
        const wij = w[i]?.[j] ?? 0;
        if (i === j || wij === 0) continue;
        const [xi, yi] = x[i] as [number, number];
        const [xj, yj] = x[j] as [number, number];
        const dist = Math.hypot(xi - xj, yi - yj) || 1e-9;
        const r = (d[i]?.[j] ?? 0) / dist;
        sx += wij * (xj + r * (xi - xj));
        sy += wij * (yj + r * (yi - yj));
        pesos += wij;
      }
      if (pesos > 0) nuevo[i] = [sx / pesos, sy / pesos];
    }
    x.splice(0, n, ...nuevo);
  }
  return x;
}

const poner = (m: number[][], i: number, j: number, v: number): void => {
  const fi = m[i];
  const fj = m[j];
  if (fi) fi[j] = v;
  if (fj) fj[i] = v;
};

/**
 * Mapa con los partidos y la persona. Distancia entre dos partidos: parte de las preguntas en
 * las que ambos tienen propuesta en la que proponen respuestas distintas (igual peso para todas:
 * el mapa de partidos es el mismo para todo el mundo). Distancia a la persona: 1 − afinidad.
 * Solo entran los partidos con afinidad calculada.
 */
export function mapa(
  preguntas: { opciones: string[][] }[],
  afinidades: AfinidadPartido[],
): { partidos: PuntoMapa[]; persona: PuntoMapa } | null {
  const ids = afinidades.filter((a) => a.pct !== null).map((a) => a.partido);
  if (ids.length < 2) return null;
  const n = ids.length;
  const d = Array.from({ length: n + 1 }, () => Array<number>(n + 1).fill(0));
  const w = Array.from({ length: n + 1 }, () => Array<number>(n + 1).fill(0));
  const opcion = (q: { opciones: string[][] }, p: string): number => q.opciones.findIndex((o) => o.includes(p));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      let comunes = 0;
      let distintas = 0;
      for (const q of preguntas) {
        const a = opcion(q, ids[i] ?? '');
        const b = opcion(q, ids[j] ?? '');
        if (a < 0 || b < 0) continue;
        comunes += 1;
        if (a !== b) distintas += 1;
      }
      if (comunes === 0) continue;
      poner(d, i, j, distintas / comunes);
      poner(w, i, j, comunes);
    }
  const partidos = smacof(d.slice(0, n).map((f) => f.slice(0, n)), w.slice(0, n).map((f) => f.slice(0, n)), 0);

  // La persona se coloca después, con los partidos fijos: así su respuesta no mueve el mapa de partidos.
  ids.forEach((id, i) => {
    const a = afinidades.find((x) => x.partido === id);
    poner(d, n, i, 1 - (a?.pct ?? 0) / 100);
    poner(w, n, i, a?.parte ?? 0);
  });
  const cx = partidos.reduce((s, p) => s + p[0], 0) / n;
  const cy = partidos.reduce((s, p) => s + p[1], 0) / n;
  const todos = smacof(d, w, n, [...partidos, [cx, cy]]);
  const persona = todos[n] as [number, number];
  return {
    partidos: ids.map((id, i) => ({ id, x: partidos[i]?.[0] ?? 0, y: partidos[i]?.[1] ?? 0 })),
    persona: { id: 'persona', x: persona[0], y: persona[1] },
  };
}
