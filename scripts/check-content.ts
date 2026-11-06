/**
 * Validaciones de contenido que el schema de Zod no cubre (referencias,
 * fuentes huérfanas, subtemas fuera de la lista del tema y preguntas del test
 * que no se apoyan en una propuesta real). Se ejecuta con Node de forma nativa:
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
  propuestas: { fuente?: unknown; pagina?: unknown; subtema?: unknown }[];
  fuentes_revisadas?: unknown[];
}

export interface Pregunta {
  ruta: string;
  tema?: unknown;
  opciones: { partidos?: { partido?: unknown; fuente?: unknown; pagina?: unknown }[] }[];
}

export interface Contenido {
  partidos: Set<string>;
  /** id del tema → sus `subtemas` permitidos. */
  temas: Map<string, string[]>;
  fuentes: Set<string>;
  celdas: Celda[];
  preguntas: Pregunta[];
}

/** Preguntas del test de afinidad por tema (PLAN.md §1, sección 5). */
const PREGUNTAS_POR_TEMA = { min: 1, max: 2 };

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

export function validar({ partidos, temas, fuentes, celdas, preguntas }: Contenido): string[] {
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
      const permitidos = temas.get(String(celda.tema));
      const subtemas = p.subtema === undefined ? [] : Array.isArray(p.subtema) ? p.subtema : [p.subtema];
      for (const s of subtemas)
        if (permitidos && !permitidos.includes(String(s)))
          errores.push(
            `${donde}: el subtema \`${String(s)}\` no está en temas/${String(celda.tema)}.yaml (${permitidos.join(', ')})`,
          );
    });

    celda.fuentes_revisadas?.forEach((id, i) => {
      if (!fuentes.has(String(id)))
        errores.push(`${celda.ruta}: fuentes_revisadas[${i}]: la fuente \`${String(id)}\` no existe en src/content/fuentes/`);
      else usadas.add(String(id));
    });
  }

  errores.push(...validarPreguntas(preguntas, celdas, temas));

  for (const id of fuentes)
    if (!usadas.has(id))
      errores.push(
        `fuentes/${id}.yaml: la fuente no está referenciada por ninguna propuesta ni en \`fuentes_revisadas\``,
      );

  return errores;
}

/**
 * Cada partido de una respuesta debe apoyarse en una propuesta suya (de
 * cualquier tema) con la misma `fuente` y `pagina`, y cada tema debe tener
 * entre PREGUNTAS_POR_TEMA.min y .max preguntas. Si no hay ninguna pregunta
 * (p. ej. en los fixtures), no se exige nada.
 */
function validarPreguntas(preguntas: Pregunta[], celdas: Celda[], temas: Map<string, string[]>): string[] {
  if (preguntas.length === 0) return [];
  const errores: string[] = [];
  const propuestas = new Set(
    celdas.flatMap((c) => c.propuestas.map((p) => `${String(c.partido)}|${String(p.fuente)}|${String(p.pagina)}`)),
  );
  const porTema = new Map([...temas.keys()].map((t) => [t, 0]));

  for (const pregunta of preguntas) {
    const tema = String(pregunta.tema);
    if (!temas.has(tema)) errores.push(`${pregunta.ruta}: el tema \`${tema}\` no existe en src/content/temas/`);
    else porTema.set(tema, (porTema.get(tema) ?? 0) + 1);
    pregunta.opciones.forEach((o, i) =>
      o.partidos?.forEach(({ partido, fuente, pagina }, j) => {
        if (!propuestas.has(`${String(partido)}|${String(fuente)}|${String(pagina)}`))
          errores.push(
            `${pregunta.ruta}: opciones[${i}].partidos[${j}]: ninguna propuesta de \`${String(partido)}\` cita ` +
              `\`${String(fuente)}\` en la página o sección \`${String(pagina)}\``,
          );
      }),
    );
  }

  for (const [tema, n] of porTema)
    if (n < PREGUNTAS_POR_TEMA.min || n > PREGUNTAS_POR_TEMA.max)
      errores.push(
        `preguntas: el tema \`${tema}\` tiene ${n} pregunta(s); deben ser entre ${PREGUNTAS_POR_TEMA.min} y ${PREGUNTAS_POR_TEMA.max}`,
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
  const temas = new Map(
    [...ids('temas')].map((id) => {
      const { subtemas } = leer(`temas/${id}.yaml`);
      return [id, Array.isArray(subtemas) ? subtemas.map(String) : []];
    }),
  );
  const preguntas = ficheros
    .filter((f) => /^preguntas\/[^/]+\.ya?ml$/.test(f))
    .map((ruta) => {
      const d = leer(ruta);
      return { ruta, tema: d.tema, opciones: Array.isArray(d.opciones) ? d.opciones : [] };
    });
  return { partidos: ids('partidos'), temas, fuentes: ids('fuentes'), celdas, preguntas };
}

const cifra = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Las series de `graficas` copian cifras de los textos de `gobiernos`: cada valor debe
 * aparecer, con el mismo formato («−3,8 %»), en alguno de esos textos. Evita erratas al
 * pasar las cifras a la gráfica y que la gráfica muestre un dato que la web no documenta.
 * Es una comprobación de mínimos: busca la cifra, no la relaciona con su año.
 */
export function validarGraficas(base: string): string[] {
  const dir = (n: string): string[] =>
    existsSync(join(base, n)) ? readdirSync(join(base, n)).filter((f) => /\.ya?ml$/.test(f)).sort() : [];
  const textos = dir('gobiernos')
    .map((f) => readFileSync(join(base, 'gobiernos', f), 'utf8'))
    .join('\n');
  const errores: string[] = [];
  for (const f of dir('graficas')) {
    const d = parse(readFileSync(join(base, 'graficas', f), 'utf8')) ?? {};
    for (const serie of Array.isArray(d.series) ? d.series : []) {
      for (const [periodo, valor] of Object.entries(serie?.valores ?? {})) {
        const texto = `${cifra.format(Number(valor)).replace('-', '−')} %`;
        // Las caídas pueden ir sin signo en el texto («cayó un 6,6 %»).
        const absoluto = `${cifra.format(Math.abs(Number(valor)))} %`;
        if (!textos.includes(texto) && !(Number(valor) < 0 && textos.includes(absoluto)))
          errores.push(`graficas/${f}: ${serie.id} ${periodo} = ${texto} no aparece en ningún texto de gobiernos/`);
      }
    }
  }
  return errores;
}

function main(): void {
  const base = process.argv[2] ?? 'src/content';
  const rel = relative('.', base);
  const prefijo = rel.startsWith('..') ? base : rel;
  const errores = [...validar(cargar(base, INCLUIR_EJEMPLO)), ...validarGraficas(base)].map((e) =>
    e.replace(/^(?=\w)/, `${prefijo}/`),
  );
  if (errores.length > 0) {
    console.error(`✖ ${errores.length} error(es) de contenido:\n${errores.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }
  console.log('✔ Contenido válido');
}

if (import.meta.main) main();
