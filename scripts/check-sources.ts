/**
 * Detecta cambios en las fuentes oficiales: descarga la `url` de cada fuente
 * con `sha256` y compara el hash. Se ejecuta con Node de forma nativa:
 *   node scripts/check-sources.ts [directorio-content] [--json informe.json]
 *
 * Ignora las fuentes ficticias (mismas reglas que check-content.ts). Las fuentes
 * sin `sha256` se listan como "sin hash" y no cuentan como error.
 *
 * Las respuestas de una protección antibots (Incapsula/Imperva, Cloudflare) se
 * listan como "antibots" y tampoco cuentan como error: no dicen nada del
 * documento. Se reconocen por sus señales (cabeceras, cookies o el texto de la
 * página de verificación) cuando llegan con HTTP 403/429/503, o con HTTP 200 y
 * `text/html` en lugar del PDF esperado (psoe.es devuelve así su página de
 * Incapsula). Un HTML sin esas señales en lugar del PDF sigue contando como
 * hash distinto: puede ser que el PDF ya no exista.
 *
 * Sale con código 1 si hay hash distinto, error HTTP/red o redirección. El
 * informe `--json` solo incluye esos casos (es lo que abre issues en
 * sources-watch).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parse } from 'yaml';
import { esEjemplo } from './check-content.ts';

const USER_AGENT =
  'Elecciones29n-sources-watch/1.0 (+https://github.com/jmuci/Elecciones29n; comprobacion de cambios en fuentes oficiales)';
const TIMEOUT_MS = 30_000;
const INTENTOS = 2;

export type Estado = 'ok' | 'hash_distinto' | 'error' | 'redireccion' | 'sin_hash' | 'antibot';

/** Estados que no cuentan como problema: ni hacen fallar el script ni van al informe. */
const SIN_PROBLEMA: readonly Estado[] = ['ok', 'sin_hash', 'antibot'];

export interface Resultado {
  id: string;
  url: string;
  estado: Estado;
  hashAnterior?: string;
  hashNuevo?: string;
  urlFinal?: string;
  detalle?: string;
}

interface Fuente {
  id: string;
  url: string;
  sha256?: string;
}

export function cargarFuentes(base: string): Fuente[] {
  const dir = join(base, 'fuentes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .flatMap((f) => {
      if (esEjemplo(`fuentes/${f}`)) return [];
      const d = parse(readFileSync(join(dir, f), 'utf8'));
      if (!d || typeof d !== 'object' || d.ficticio === true) return [];
      return [{ id: f.replace(/\.ya?ml$/, ''), url: String(d.url), sha256: d.sha256 ? String(d.sha256).toLowerCase() : undefined }];
    });
}

const normalizar = (url: string): string => new URL(url).href;

const esPdf = (url: string): boolean => new URL(url).pathname.toLowerCase().endsWith('.pdf');

const INCAPSULA_CUERPO = /_Incapsula_Resource|Incapsula incident/i;
const CLOUDFLARE_CUERPO = /just a moment|cf-chl|challenge-platform|attention required/i;

/**
 * Nombre de la protección antibots que ha respondido, o `undefined` si no hay
 * señales. Para Cloudflare no basta con `server`/`cf-ray`: pp.es está detrás
 * de Cloudflare y un 403/404 suyo sería real.
 */
function antibot(res: Response, texto: string): string | undefined {
  const h = res.headers;
  if (h.has('x-iinfo') || /incap_ses_|visid_incap_/.test(h.get('set-cookie') ?? '') || /incapsula|imperva/i.test(h.get('x-cdn') ?? '') || INCAPSULA_CUERPO.test(texto))
    return 'Incapsula';
  if (h.has('cf-mitigated') || CLOUDFLARE_CUERPO.test(texto)) return 'Cloudflare';
  return undefined;
}

type Descarga =
  | { tipo: 'documento'; hash: string; urlFinal: string; html: boolean }
  | { tipo: 'antibot'; detalle: string };

async function descargar(url: string): Promise<Descarga> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8' },
  });
  const cuerpo = Buffer.from(await res.arrayBuffer());
  const tipo = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const html = tipo === 'text/html';
  const bloqueable = [403, 429, 503].includes(res.status) || (res.ok && html && esPdf(url));
  const proteccion = bloqueable ? antibot(res, html ? cuerpo.subarray(0, 20_000).toString('utf8') : '') : undefined;
  if (proteccion)
    return {
      tipo: 'antibot',
      detalle: `HTTP ${res.status}${res.ok ? ` ${tipo} en lugar del PDF` : ''} (${proteccion}); no se ha podido comprobar el documento`,
    };
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
  return { tipo: 'documento', hash: createHash('sha256').update(cuerpo).digest('hex'), urlFinal: res.url || url, html };
}

export async function comprobar(f: Fuente): Promise<Resultado> {
  const base = { id: f.id, url: f.url, hashAnterior: f.sha256 };
  if (!f.sha256) return { ...base, estado: 'sin_hash' };
  let ultimo = '';
  for (let i = 1; i <= INTENTOS; i++) {
    try {
      const d = await descargar(f.url);
      if (d.tipo === 'antibot') return { ...base, estado: 'antibot', detalle: d.detalle };
      const { hash, urlFinal } = d;
      if (normalizar(urlFinal) !== normalizar(f.url))
        return { ...base, estado: 'redireccion', hashNuevo: hash, urlFinal, detalle: `redirige a ${urlFinal}` };
      if (hash !== f.sha256)
        return { ...base, estado: 'hash_distinto', hashNuevo: hash, detalle: d.html && esPdf(f.url) ? 'responde HTML en lugar del PDF' : undefined };
      return { ...base, estado: 'ok', hashNuevo: hash };
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; errors?: { code?: string }[] } };
      const code = err.cause?.code ?? err.cause?.errors?.[0]?.code;
      ultimo = err.name === 'TimeoutError' ? `timeout tras ${TIMEOUT_MS / 1000}s` : `${err.message}${code ? ` (${code})` : ''}`;
    }
  }
  return { ...base, estado: 'error', detalle: ultimo };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const j = args.indexOf('--json');
  const salida = j >= 0 ? args.splice(j, 2)[1] : undefined;
  const base = args[0] ?? 'src/content';

  const fuentes = cargarFuentes(base);
  const resultados: Resultado[] = [];
  for (const f of fuentes) resultados.push(await comprobar(f));

  const marca: Record<Estado, string> = {
    ok: '✔',
    hash_distinto: '✖ hash distinto',
    error: '✖ error',
    redireccion: '✖ redirección',
    sin_hash: '– sin hash',
    antibot: '⚠ antibots',
  };
  const enActions = process.env.GITHUB_ACTIONS === 'true';
  for (const r of resultados) {
    const linea = `${r.id}${r.detalle ? `: ${r.detalle}` : ''}`;
    console.log(r.estado === 'antibot' && enActions ? `::warning::${linea}` : `${marca[r.estado]}  ${linea}`);
  }

  const problemas = resultados.filter((r) => !SIN_PROBLEMA.includes(r.estado));
  const cuantas = (e: Estado): number => resultados.filter((r) => r.estado === e).length;
  console.log(
    `\n${fuentes.length} fuente(s): ${problemas.length} con problemas, ${cuantas('sin_hash')} sin hash, ${cuantas('antibot')} bloqueada(s) por antibots`,
  );
  if (salida) writeFileSync(salida, JSON.stringify(problemas, null, 2));
  if (problemas.length > 0) process.exit(1);
}

if (import.meta.main) await main();
