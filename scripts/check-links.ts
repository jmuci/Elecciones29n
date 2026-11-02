/**
 * Comprueba que `url` y `archivo` de cada fuente responden (HEAD y, si falla, GET).
 *   node scripts/check-links.ts [directorio-content]
 *
 * Clasifica cada enlace: ok, redirección (con destino), bloqueado por protección
 * antibots (403/503 con señales de Cloudflare), roto (404/410, DNS, conexión,
 * timeout) o inesperado (otros 4xx/5xx; no se sabe si el enlace está roto).
 * Ignora las fuentes ficticias (mismas reglas que check-content.ts).
 *
 * Falla (código 1) solo si `archivo` está roto, o `url` está rota y no hay
 * `archivo` utilizable. El resto sale como `::warning::`: la UI puede seguir
 * enlazando al snapshot.
 *
 * Es un script aparte de check-sources.ts porque la semántica es distinta
 * (sin hashes, HEAD antes que GET, clasificación y criterio de fallo propios).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { esEjemplo } from './check-content.ts';

const USER_AGENT =
  'Elecciones29n-link-check/1.0 (+https://github.com/jmuci/Elecciones29n; comprobacion de enlaces a fuentes oficiales)';
const TIMEOUT_MS = Number(process.env.LINKS_TIMEOUT_MS ?? 20_000);
const INTENTOS = 2;

export type Estado = 'ok' | 'redireccion' | 'bloqueado' | 'roto' | 'inesperado';

export interface Enlace {
  estado: Estado;
  detalle?: string;
}

interface Fuente {
  id: string;
  url: string;
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
      return [{ id: f.replace(/\.ya?ml$/, ''), url: String(d.url), archivo: d.archivo ? String(d.archivo) : undefined }];
    });
}

const normalizar = (url: string): string => new URL(url).href;

const CF_BODY = /just a moment|cf-chl|attention required|challenge-platform|cloudflare/i;

function esAntibot(res: Response, cuerpo: string): boolean {
  if (res.status !== 403 && res.status !== 503) return false;
  const h = res.headers;
  return (
    h.has('cf-mitigated') ||
    h.has('cf-ray') ||
    /cloudflare/i.test(h.get('server') ?? '') ||
    CF_BODY.test(cuerpo)
  );
}

async function pedir(url: string, method: 'HEAD' | 'GET'): Promise<{ res: Response; cuerpo: string }> {
  const res = await fetch(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8' },
  });
  let cuerpo = '';
  if (method === 'GET' && (res.status === 403 || res.status === 503)) cuerpo = (await res.text()).slice(0, 20_000);
  else await res.body?.cancel();
  return { res, cuerpo };
}

function clasificarRespuesta(url: string, res: Response, cuerpo: string): Enlace {
  if (res.ok) {
    if (res.url && normalizar(res.url) !== normalizar(url)) return { estado: 'redireccion', detalle: `redirige a ${res.url}` };
    return { estado: 'ok' };
  }
  if (res.status === 404 || res.status === 410) return { estado: 'roto', detalle: `HTTP ${res.status}` };
  if (esAntibot(res, cuerpo)) return { estado: 'bloqueado', detalle: `HTTP ${res.status} (protección antibots)` };
  return { estado: 'inesperado', detalle: `HTTP ${res.status} ${res.statusText}`.trim() };
}

function clasificarError(e: unknown): Enlace {
  const err = e as Error & { cause?: { code?: string; errors?: { code?: string }[] } };
  if (err.name === 'TimeoutError') return { estado: 'roto', detalle: `timeout tras ${TIMEOUT_MS / 1000}s` };
  const code = err.cause?.code ?? err.cause?.errors?.[0]?.code;
  return { estado: 'roto', detalle: `${err.message}${code ? ` (${code})` : ''}` };
}

export async function comprobarEnlace(url: string): Promise<Enlace> {
  let ultimo: Enlace = { estado: 'roto', detalle: 'sin intentos' };
  for (let i = 1; i <= INTENTOS; i++) {
    let r = await intentar(url, 'HEAD');
    if (r.estado !== 'ok' && r.estado !== 'redireccion') r = await intentar(url, 'GET');
    ultimo = r;
    // Solo se reintenta ante fallos que pueden ser transitorios.
    if (r.estado === 'ok' || r.estado === 'redireccion' || r.estado === 'bloqueado') return r;
    if (r.estado === 'roto' && /^HTTP (404|410)/.test(r.detalle ?? '')) return r;
  }
  return ultimo;
}

async function intentar(url: string, method: 'HEAD' | 'GET'): Promise<Enlace> {
  try {
    const { res, cuerpo } = await pedir(url, method);
    return clasificarRespuesta(url, res, cuerpo);
  } catch (e) {
    return clasificarError(e);
  }
}

/** Una redirección del snapshot a otro snapshot de Wayback es normal y no se avisa. */
const esWayback = (u: string): boolean => /^https:\/\/web\.archive\.org\//.test(u);

async function main(): Promise<void> {
  const base = process.argv[2] ?? 'src/content';
  const fuentes = cargarFuentes(base);
  const enActions = process.env.GITHUB_ACTIONS === 'true';
  let fallos = 0;
  let avisos = 0;

  const aviso = (msg: string): void => {
    avisos++;
    console.log(enActions ? `::warning::${msg}` : `  ⚠ ${msg}`);
  };
  const fallo = (msg: string): void => {
    fallos++;
    console.log(enActions ? `::error::${msg}` : `  ✖ ${msg}`);
  };

  for (const f of fuentes) {
    const url = await comprobarEnlace(f.url);
    const archivo = f.archivo ? await comprobarEnlace(f.archivo) : undefined;
    const fmt = (e: Enlace): string => `${e.estado}${e.detalle ? ` (${e.detalle})` : ''}`;
    console.log(`${f.id}\n  url:     ${fmt(url)}\n  archivo: ${archivo ? fmt(archivo) : 'sin archivo'}`);

    if (archivo?.estado === 'roto') fallo(`${f.id}: el snapshot (archivo) está roto: ${archivo.detalle} — ${f.archivo}`);
    else if (url.estado === 'roto' && (!archivo || archivo.estado !== 'ok' && archivo.estado !== 'redireccion'))
      fallo(`${f.id}: url rota (${url.detalle}) y sin snapshot utilizable — ${f.url}`);
    else if (url.estado === 'roto') aviso(`${f.id}: url rota (${url.detalle}); queda el snapshot — ${f.url}`);
    else if (url.estado !== 'ok') aviso(`${f.id}: url ${fmt(url)} — ${f.url}`);

    if (archivo && archivo.estado !== 'ok' && archivo.estado !== 'roto' && !(archivo.estado === 'redireccion' && esWayback(f.archivo ?? '')))
      aviso(`${f.id}: archivo ${fmt(archivo)} — ${f.archivo}`);
  }

  console.log(`\n${fuentes.length} fuente(s): ${fallos} fallo(s), ${avisos} aviso(s)`);
  if (fallos > 0) process.exit(1);
}

if (import.meta.main) await main();
