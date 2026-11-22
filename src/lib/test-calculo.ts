// Cálculo de la afinidad. Sin dependencias de Astro: lo usa el script del cliente.

import { IMPORTANCIA_INICIAL, normalizarRespuesta, type Estado } from './test-estado';

/** Lo que el cálculo necesita de cada pregunta: `opciones[j]` son los partidos que proponen la opción j. */
export interface PreguntaCalculo {
  id: string;
  tema: string;
  opciones: string[][];
}

export interface Suma {
  /** Peso de las respuestas que coinciden con el partido. */
  acierto: number;
  /** Peso de las preguntas que cuentan y en las que el partido tiene propuesta. */
  peso: number;
  /** Número de esas preguntas. */
  preguntas: number;
}

export interface Calculo {
  global: Map<string, Suma>;
  porTema: Map<string, Map<string, Suma>>;
  /** Peso total de las preguntas que cuentan. */
  pesoTotal: number;
  /** Preguntas que cuentan (respondidas con alguna opción). */
  cuentan: number;
  /** Preguntas en las que se ha marcado «ninguna»: no cuentan para ningún partido. */
  ningunas: number;
  /** Preguntas en las que se ha marcado más de una opción. */
  multiples: number;
}

const vacia = (): Suma => ({ acierto: 0, peso: 0, preguntas: 0 });

export const porcentaje = (s: Suma): number | null => (s.peso > 0 ? Math.round((100 * s.acierto) / s.peso) : null);

/**
 * Por partido: peso de las respuestas que coinciden ÷ peso de las preguntas que cuentan en las
 * que tiene propuesta.
 *
 * - Una pregunta con varias opciones marcadas reparte su importancia a partes iguales entre ellas:
 *   el partido que propone una de las k marcadas suma importancia / k. Así marcar más opciones no
 *   infla el porcentaje de nadie (marcarlas todas da a cada partido 1/n) y cada pregunta pesa lo
 *   mismo se marque lo que se marque.
 * - «Ninguna de las opciones» no cuenta para ningún partido: no dice nada a favor ni en contra de
 *   quien tiene propuesta, igual que una pregunta sin responder. Se cuenta aparte.
 */
export function calcular(preguntas: PreguntaCalculo[], partidos: string[], estado: Estado): Calculo {
  const global = new Map(partidos.map((p) => [p, vacia()]));
  const porTema = new Map<string, Map<string, Suma>>();
  let pesoTotal = 0;
  let cuentan = 0;
  let ningunas = 0;
  let multiples = 0;
  for (const q of preguntas) {
    const { importancia = IMPORTANCIA_INICIAL, respuesta: bruta = null } = estado[q.id] ?? {};
    const respuesta = normalizarRespuesta(bruta);
    if (respuesta === null) continue;
    if (respuesta === 'ninguna') {
      ningunas += 1;
      continue;
    }
    pesoTotal += importancia;
    cuentan += 1;
    if (respuesta.length > 1) multiples += 1;
    const parte = importancia / respuesta.length;
    const elegidos = new Set(respuesta.flatMap((j) => q.opciones[j] ?? []));
    const tema = porTema.get(q.tema) ?? new Map(partidos.map((p) => [p, vacia()]));
    porTema.set(q.tema, tema);
    for (const partido of q.opciones.flat()) {
      for (const s of [global.get(partido), tema.get(partido)]) {
        if (!s) continue;
        s.peso += importancia;
        s.preguntas += 1;
        if (elegidos.has(partido)) s.acierto += parte;
      }
    }
  }
  return { global, porTema, pesoTotal, cuentan, ningunas, multiples };
}
