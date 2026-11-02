import type { CollectionEntry } from 'astro:content';

/** Orden de presentación de los estados (de más a menos contenido). */
export const ESTADOS = ['completo', 'parcial', 'sin_propuesta', 'no_publicado'] as const;
export type Estado = (typeof ESTADOS)[number];

/** Estados cuya lista `propuestas` debe estar vacía. */
export const ESTADOS_SIN_PROPUESTAS = ['sin_propuesta', 'no_publicado'] as const satisfies readonly Estado[];

export const TIPOS_FUENTE = ['programa', 'manifiesto', 'plan_sectorial', 'argumentario', 'web', 'nota_prensa'] as const;
export type TipoFuente = (typeof TIPOS_FUENTE)[number];

export const TIPOS_AMBITO = ['toda_espana', 'casi_toda_espana', 'algunas_circunscripciones'] as const;
export type TipoAmbito = (typeof TIPOS_AMBITO)[number];

export type Partido = CollectionEntry<'partidos'>;
export type Tema = CollectionEntry<'temas'>;
export type Fuente = CollectionEntry<'fuentes'>;
export type Celda = CollectionEntry<'propuestas'>;
export type Propuesta = Celda['data']['propuestas'][number];
