import { LEGISLATURAS } from './modelo';
import type { Caso, Legislatura, Partido } from './modelo';

/** Las gráficas cubren los 20 años anteriores a las elecciones del 29-N-2026. */
export const DESDE_GRAFICAS = new Date('2006-11-29T00:00:00Z');

/** Un partido de la web o, agrupados, los demás. */
export interface GrupoCorrupcion {
  id: string;
  etiqueta: string;
}

export const OTROS: GrupoCorrupcion = { id: 'otros', etiqueta: 'Otros partidos' };

export interface ResumenCorrupcion {
  /** Solo los grupos con algún caso, en el orden fijo de la web y «Otros» al final. */
  grupos: GrupoCorrupcion[];
  legislaturas: { legislatura: Legislatura; porGrupo: Map<string, Caso[]> }[];
  totales: Map<string, number>;
  total: number;
  casos: Caso[];
}

export const grupoDe = (c: Caso): string => c.data.partido?.id ?? OTROS.id;

export function legislaturaDe(d: Date): Legislatura | undefined {
  const iso = d.toISOString().slice(0, 10);
  return LEGISLATURAS.find((l) => iso >= l.inicio && (!('fin' in l) || iso <= l.fin));
}

/** Años de una legislatura para la UI: "2019–2023", "2023–" si sigue abierta. */
export function periodoLegislatura(l: Legislatura): string {
  const ini = l.inicio.slice(0, 4);
  return 'fin' in l ? `${ini}–${l.fin.slice(0, 4)}` : `${ini}–`;
}

export function resumirCorrupcion(casos: Caso[], partidos: Map<string, Partido>): ResumenCorrupcion {
  const enPeriodo = casos.filter((c) => c.data.firme.fecha >= DESDE_GRAFICAS);
  const ids = new Set(enPeriodo.map(grupoDe));
  const grupos: GrupoCorrupcion[] = [...partidos.values()]
    .filter((p) => ids.has(p.id))
    .sort((a, b) => a.data.orden - b.data.orden)
    .map((p) => ({ id: p.id, etiqueta: p.data.nombre_corto }));
  if (ids.has(OTROS.id)) grupos.push(OTROS);

  const desde = DESDE_GRAFICAS.toISOString().slice(0, 10);
  const legislaturas = LEGISLATURAS.filter((l) => !('fin' in l) || l.fin >= desde).map((legislatura) => ({
    legislatura,
    porGrupo: new Map<string, Caso[]>(),
  }));
  const totales = new Map<string, number>();
  for (const c of enPeriodo) {
    const l = legislaturaDe(c.data.firme.fecha);
    const fila = legislaturas.find((x) => x.legislatura.id === l?.id);
    if (!fila) throw new Error(`Caso ${c.id}: la fecha de la sentencia firme no cae en ninguna legislatura`);
    const g = grupoDe(c);
    fila.porGrupo.set(g, [...(fila.porGrupo.get(g) ?? []), c]);
    totales.set(g, (totales.get(g) ?? 0) + 1);
  }
  return { grupos, legislaturas, totales, total: enPeriodo.length, casos: enPeriodo };
}
