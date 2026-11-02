/**
 * Validaciones de contenido que el schema de Zod no cubre (referencias y
 * fuentes huérfanas). Se ejecuta con Node de forma nativa:
 *   node scripts/check-content.ts [directorio-content]
 *
 * Reglas de inclusión de ejemplos: las mismas que content.config.ts, vía
 * INCLUIR_EJEMPLO (src/lib/ejemplo.ts).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { INCLUIR_EJEMPLO } from '../src/lib/ejemplo.ts';

export interface Celda {
  ruta: string;
  partido?: unknown;
  tema?: unknown;
  propuestas: { fuente?: unknown; pagina?: unknown }[];
  fuentes_revisadas?: unknown[];
}

export interface Contenido {
  partidos: Set<string>;
  temas: Set<string>;
  fuentes: Set<string>;
  celdas: Celda[];
}

/**
 * Ficheros ficticios (ruta relativa a src/content). Replica las exclusiones de
 * los globs de src/content.config.ts: mantener ambos sitios sincronizados.
 */
export function esEjemplo(ruta: string): boolean {
  return (
    ruta === 'partidos/ejemplo.yaml' ||
    /^fuentes\/ejemplo-[^/]*\.yaml$/.test(ruta) ||
    ruta.startsWith('propuestas/ejemplo/')
  );
}

export function validar({ partidos, temas, fuentes, celdas }: Contenido): string[] {
  const errores: string[] = [];
  const usadas = new Set<string>();

  for (const celda of celdas) {
    const [, partidoRuta = '', temaRuta = ''] = celda.ruta.replace(/\.ya?ml$/, '').split('/');
    if (celda.partido !== partidoRuta)
      errores.push(`${celda.ruta}: \`partido\` (${String(celda.partido)}) no coincide con la ruta (${partidoRuta})`);
    if (celda.tema !== temaRuta)
      errores.push(`${celda.ruta}: \`tema\` (${String(celda.tema)}) no coincide con la ruta (${temaRuta})`);
    if (!partidos.has(String(celda.partido)))
      errores.push(`${celda.ruta}: el partido \`${String(celda.partido)}\` no existe en src/content/partidos/`);
    if (!temas.has(String(celda.tema)))
      errores.push(`${celda.ruta}: el tema \`${String(celda.tema)}\` no existe en src/content/temas/`);

    celda.propuestas.forEach((p, i) => {
      const donde = `${celda.ruta}: propuestas[${i}]`;
      if (p.fuente === undefined || p.fuente === null || p.fuente === '')
        errores.push(`${donde}: falta \`fuente\``);
      else if (!fuentes.has(String(p.fuente)))
        errores.push(`${donde}: la fuente \`${String(p.fuente)}\` no existe en src/content/fuentes/`);
      else usadas.add(String(p.fuente));
      if (p.pagina === undefined || p.pagina === null || p.pagina === '')
        errores.push(`${donde}: falta \`pagina\``);
    });

    celda.fuentes_revisadas?.forEach((id, i) => {
      if (!fuentes.has(String(id)))
        errores.push(`${celda.ruta}: fuentes_revisadas[${i}]: la fuente \`${String(id)}\` no existe en src/content/fuentes/`);
      else usadas.add(String(id));
    });
  }

  for (const id of fuentes)
    if (!usadas.has(id))
      errores.push(
        `fuentes/${id}.yaml: la fuente no está referenciada por ninguna propuesta ni en \`fuentes_revisadas\``,
      );

  return errores;
}

function yamls(base: string): string[] {
  if (!existsSync(base)) return [];
  return (readdirSync(base, { recursive: true, encoding: 'utf8' }) as string[])
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => f.split('\\').join('/'))
    .sort();
}

export function cargar(base: string, incluirEjemplo: boolean): Contenido {
  const leer = (ruta: string): Record<string, any> => {
    const datos = parse(readFileSync(join(base, ruta), 'utf8'));
    return datos && typeof datos === 'object' ? datos : {};
  };
  const ficheros = yamls(base).filter((f) => incluirEjemplo || !esEjemplo(f));
  const ids = (dir: string) =>
    new Set(ficheros.filter((f) => f.startsWith(`${dir}/`)).map((f) => f.slice(dir.length + 1).replace(/\.ya?ml$/, '')));
  const celdas = ficheros
    .filter((f) => /^propuestas\/[^/]+\/[^/]+\.ya?ml$/.test(f))
    .map((ruta) => {
      const d = leer(ruta);
      return {
        ruta,
        partido: d.partido,
        tema: d.tema,
        propuestas: Array.isArray(d.propuestas) ? d.propuestas : [],
        fuentes_revisadas: Array.isArray(d.fuentes_revisadas) ? d.fuentes_revisadas : undefined,
      };
    });
  return { partidos: ids('partidos'), temas: ids('temas'), fuentes: ids('fuentes'), celdas };
}

function main(): void {
  const base = process.argv[2] ?? 'src/content';
  const rel = relative('.', base);
  const prefijo = rel.startsWith('..') ? base : rel;
  const errores = validar(cargar(base, INCLUIR_EJEMPLO)).map((e) => e.replace(/^(?=\w)/, `${prefijo}/`));
  if (errores.length > 0) {
    console.error(`✖ ${errores.length} error(es) de contenido:\n${errores.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }
  console.log('✔ Contenido válido');
}

if (import.meta.main) main();
