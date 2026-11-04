import type { CollectionEntry } from 'astro:content';

/** Orden de presentación de los estados (de más a menos contenido). */
export const ESTADOS = ['completo', 'parcial', 'sin_propuesta', 'no_publicado'] as const;
export type Estado = (typeof ESTADOS)[number];

/** Estados cuya lista `propuestas` debe estar vacía. */
export const ESTADOS_SIN_PROPUESTAS = ['sin_propuesta', 'no_publicado'] as const satisfies readonly Estado[];

export const TIPOS_FUENTE = [
  'programa',
  'manifiesto',
  'plan_sectorial',
  'documento_politico',
  'argumentario',
  'web',
  'nota_prensa',
] as const;
export type TipoFuente = (typeof TIPOS_FUENTE)[number];

export const TIPOS_AMBITO = ['toda_espana', 'casi_toda_espana', 'algunas_circunscripciones'] as const;
export type TipoAmbito = (typeof TIPOS_AMBITO)[number];

export type Partido = CollectionEntry<'partidos'>;
export type Tema = CollectionEntry<'temas'>;
export type Fuente = CollectionEntry<'fuentes'>;
export type Celda = CollectionEntry<'propuestas'>;
export type Propuesta = Celda['data']['propuestas'][number];

/** Tipos de fuente de la sección /historia (no confundir con `TIPOS_FUENTE`, que es de documentos de partido). */
export const TIPOS_FUENTE_HISTORIA = ['prensa', 'opinion', 'institucion', 'organizacion', 'sentencia', 'estudio'] as const;
export type TipoFuenteHistoria = (typeof TIPOS_FUENTE_HISTORIA)[number];

/** Bloque político del partido que gobierna, solo para la línea de tiempo. */
export const BLOQUES = ['derecha', 'izquierda'] as const;
export type Bloque = (typeof BLOQUES)[number];

/**
 * Legislaturas de las Cortes Generales, con la fecha de constitución de cada una.
 * Sirven para agrupar los casos de corrupción por la fecha de su sentencia firme.
 */
export const LEGISLATURAS = [
  { id: 'VIII', inicio: '2004-04-02', fin: '2008-03-31' },
  { id: 'IX', inicio: '2008-04-01', fin: '2011-12-12' },
  { id: 'X', inicio: '2011-12-13', fin: '2016-01-12' },
  { id: 'XI', inicio: '2016-01-13', fin: '2016-07-18' },
  { id: 'XII', inicio: '2016-07-19', fin: '2019-05-20' },
  { id: 'XIII', inicio: '2019-05-21', fin: '2019-12-02' },
  { id: 'XIV', inicio: '2019-12-03', fin: '2023-08-16' },
  { id: 'XV', inicio: '2023-08-17' },
] as const satisfies readonly { id: string; inicio: string; fin?: string }[];
export type Legislatura = (typeof LEGISLATURAS)[number];

/** Gráficas de /historia: bloque (cifras agregadas o percepción) y forma. */
export const BLOQUES_GRAFICA = ['macro', 'percepcion'] as const;
export const TIPOS_GRAFICA = ['lineas', 'barras', 'apiladas'] as const;

export type Gobierno = CollectionEntry<'gobiernos'>;
export type Grafica = CollectionEntry<'graficas'>;
export type Caso = CollectionEntry<'casos'>;
export type Recuento = CollectionEntry<'recuentos'>;

/** Partidos que desglosan las encuestas (Democracia 21 no aparece en ninguna), en el orden fijo de la web. */
export const PARTIDOS_ENCUESTA = ['pp', 'psoe', 'vox', 'frente-amplio', 'podemos'] as const;
export type PartidoEncuesta = (typeof PARTIDOS_ENCUESTA)[number];

/** Otras fuerzas que desglosan las encuestas (el «Resto» del hemiciclo), en orden alfabético. */
export const OTROS_PARTIDOS = {
  adelante: 'Adelante Andalucía',
  bng: 'BNG',
  cca: 'Coalición Canaria',
  compromis: 'Compromís-Front Valencià',
  'eh-bildu': 'EH Bildu',
  erc: 'ERC',
  junts: 'Junts',
  pnv: 'PNV',
} as const;
export type OtroPartido = keyof typeof OTROS_PARTIDOS;
export const IDS_OTROS = Object.keys(OTROS_PARTIDOS) as OtroPartido[];

export const TIPOS_FUENTE_ENCUESTA = ['original', 'medio', 'recopilacion'] as const;

export const TOTAL_ESCANOS = 350;
export const MAYORIA_ABSOLUTA = 176;

export type Encuesta = CollectionEntry<'encuestas'>;
