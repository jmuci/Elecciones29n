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
