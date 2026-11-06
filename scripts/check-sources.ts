/**
 * Detecta cambios en las fuentes oficiales: descarga la `url` de cada fuente
 * con `sha256` y compara el hash. Se ejecuta con Node de forma nativa:
 *   node scripts/check-sources.ts [directorio-content] [--json informe.json]
 *
 * Ignora las fuentes ficticias (mismas reglas que check-content.ts). Las fuentes
 * sin `sha256` se listan como "sin hash" y no cuentan como error.
 * Sale con código 1 si hay hash distinto, error HTTP/red o redirección.
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

export type Estado = 'ok' | 'hash_distinto' | 'error' | 'redireccion' | 'sin_hash';

export interface Resultado {
  id: string;
  url: string;
  estado: Estado;
  hashAnterior?: string;
  hashNuevo?: string;
  urlFinal?: string;
  detalle?: string;
}

export interface Fuente {
  id: string;
  url: string;
  sha256?: string;
  archivo?: string;
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
      return [
        {
          id: f.replace(/\.ya?ml$/, ''),
          url: String(d.url),
          sha256: d.sha256 ? String(d.sha256).toLowerCase() : undefined,
          archivo: d.archivo ? String(d.archivo) : undefined,
        },
      ];
    });
}

const normalizar = (url: string): string => new URL(url).href;

export async function descargar(url: string): Promise<{ cuerpo: Buffer; hash: string; urlFinal: string }> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
  const cuerpo = Buffer.from(await res.arrayBuffer());
  return { cuerpo, hash: createHash('sha256').update(cuerpo).digest('hex'), urlFinal: res.url || url };
}

export async function comprobar(f: Fuente): Promise<Resultado> {
  const base = { id: f.id, url: f.url, hashAnterior: f.sha256 };
  if (!f.sha256) return { ...base, estado: 'sin_hash' };
  let ultimo = '';
  for (let i = 1; i <= INTENTOS; i++) {
    try {
      const { hash, urlFinal } = await descargar(f.url);
      if (normalizar(urlFinal) !== normalizar(f.url))
        return { ...base, estado: 'redireccion', hashNuevo: hash, urlFinal, detalle: `redirige a ${urlFinal}` };
      if (hash !== f.sha256) return { ...base, estado: 'hash_distinto', hashNuevo: hash };
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

  const marca: Record<Estado, string> = { ok: '✔', hash_distinto: '✖ hash distinto', error: '✖ error', redireccion: '✖ redirección', sin_hash: '– sin hash' };
  for (const r of resultados) console.log(`${marca[r.estado]}  ${r.id}${r.detalle ? `: ${r.detalle}` : ''}`);

  const problemas = resultados.filter((r) => r.estado !== 'ok' && r.estado !== 'sin_hash');
  console.log(`\n${fuentes.length} fuente(s): ${problemas.length} con problemas, ${resultados.filter((r) => r.estado === 'sin_hash').length} sin hash`);
  if (salida) writeFileSync(salida, JSON.stringify(problemas, null, 2));
  if (problemas.length > 0) process.exit(1);
}

if (import.meta.main) await main();
