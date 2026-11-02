import { getCollection } from 'astro:content';
import type { Celda, Estado, Fuente, Partido, Propuesta, Tema, TipoFuente } from './modelo';

/** Estado de presentación: los 4 del modelo más una celda que aún no existe. */
export type EstadoVista = Estado | 'sin_revisar';

export const ESTADO_VISTA: Record<EstadoVista, { etiqueta: string; descripcion: string }> = {
  completo: {
    etiqueta: 'Revisión completa',
    descripcion: 'Documento revisado entero; están recogidas las propuestas del tema.',
  },
  parcial: {
    etiqueta: 'Revisión parcial',
    descripcion: 'Hay propuestas, pero la revisión no ha terminado o el partido solo ha publicado una parte.',
  },
  sin_propuesta: {
    etiqueta: 'El programa no incluye propuestas sobre este tema',
    descripcion: 'El programa está publicado y revisado, y no trata este tema.',
  },
  no_publicado: {
    etiqueta: 'Pendiente de publicación',
    descripcion: 'El partido aún no ha publicado un documento que cubra este tema.',
  },
  sin_revisar: {
    etiqueta: 'Sin revisar',
    descripcion: 'Esta combinación de partido y tema aún no se ha revisado.',
  },
};

export const TIPO_FUENTE: Record<TipoFuente, string> = {
  programa: 'Programa electoral',
  manifiesto: 'Manifiesto o documento de compromisos',
  plan_sectorial: 'Plan sectorial',
  documento_politico: 'Documento político del partido',
  argumentario: 'Argumentario de campaña',
  web: 'Página web oficial',
  nota_prensa: 'Nota de prensa',
};

const formatoFecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'UTC' });
const formatoFechaLarga = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' });

export function fecha(d: Date, larga = false): { iso: string; texto: string } {
  return { iso: d.toISOString().slice(0, 10), texto: (larga ? formatoFechaLarga : formatoFecha).format(d) };
}

/** "p. 12" o "sección Anexo II". */
export function localizador(pagina: Propuesta['pagina']): string {
  return typeof pagina === 'number' ? `p. ${pagina}` : `sección ${pagina}`;
}

/** URL de la fuente; en PDFs con página numérica añade `#page=N`. */
export function urlPropuesta(fuente: Fuente, pagina: Propuesta['pagina']): string {
  const url = new URL(fuente.data.url);
  if (typeof pagina === 'number' && url.pathname.toLowerCase().endsWith('.pdf')) url.hash = `page=${pagina}`;
  return url.href;
}

export interface Datos {
  partidos: Partido[];
  temas: Tema[];
  /** Temas con al menos una celda, en orden. */
  temasMostrados: Tema[];
  fuentes: Fuente[];
  fuente: (id: string) => Fuente;
  celda: (partido: string, tema: string) => Celda | undefined;
  celdas: Celda[];
}

const porOrden = <T extends { data: { orden: number } }>(a: T, b: T): number => a.data.orden - b.data.orden;

export async function cargarDatos(): Promise<Datos> {
  const [partidos, temas, fuentes, celdas] = await Promise.all([
    getCollection('partidos'),
    getCollection('temas'),
    getCollection('fuentes'),
    getCollection('propuestas'),
  ]);
  partidos.sort(porOrden);
  temas.sort(porOrden);
  const porFuente = new Map(fuentes.map((f) => [f.id, f]));
  const porCelda = new Map(celdas.map((c) => [c.id, c]));
  const temasConCelda = new Set(celdas.map((c) => c.data.tema.id));
  return {
    partidos,
    temas,
    temasMostrados: temas.filter((t) => temasConCelda.has(t.id)),
    fuentes,
    fuente: (id) => {
      const f = porFuente.get(id);
      if (!f) throw new Error(`Fuente inexistente: ${id}`);
      return f;
    },
    celda: (partido, tema) => porCelda.get(`${partido}/${tema}`),
    celdas,
  };
}
