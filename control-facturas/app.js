/* =========================================================================
   CONTROL DE FACTURAS · app.js
   -------------------------------------------------------------------------
   Toda la lógica de la app en un solo archivo. Las pantallas (HTML) están
   en templates.html y se dibujan con JsRender; los estilos en index.html.

   Índice
     1. CONFIG ............ ajustes tipo ".env" (contraseña, RFC, Google)
     2. Utilidades ........ formato de dinero/fechas, íconos
     3. CFDI .............. lector de XML de factura y complemento de pago
     4. Store ............. guardado en Google Drive o en el navegador
     5. Plantillas ........ carga y dibujo de templates.html
     6. Modelo ............ estructura de datos, estados, cálculos
     7. UI básica ......... modales, avisos, selector de archivos
     8. Bloqueo ........... contraseña y bloqueo por inactividad
     9. Arranque y guardado
    10. Navegación ........ rutas (#/facturas, #/saldos, …) y menú
    11. Facturas .......... lista, formulario, marca de agua FACTURADO
    12. Saldos a favor .... nacen en una declaración mensual y se usan en otra
    13. Mensuales ......... declaraciones mensuales
    14. Anuales ........... declaraciones anuales
    15. Visor ............. vista previa de PDF/XML
    16. Ajustes ........... respaldo, CSV, cambio de contraseña

   Ciclo de una factura
     Por facturar  → se sube el PDF que llega para facturar (solicitud)
     Pendiente     → se suben la factura PDF + XML del CFDI
     Cobrado       → se sube el complemento de pago (REP); el PDF de la
                     factura recibe la marca de agua FACTURADO
   ========================================================================= */
(() => {
'use strict';


/* =========================================================================
   1. CONFIG  (equivalente a un archivo .env)
   ⚠ En GitHub Pages este archivo es público: la contraseña sólo evita
     miradas casuales. Tus PDF están protegidos por tu cuenta de Google.
   ========================================================================= */
const CONFIG = {
  APP_NAME: 'Control de Facturas',

  /** Súbelo cada vez que cambies templates.html (evita usar copia vieja en caché). */
  VERSION: '4',

  /**
   * SHA-256 de la contraseña de desbloqueo.
   * Contraseña sugerida: Facturas#2026
   * Para cambiarla: Ajustes → "Cambiar contraseña" genera el código a pegar aquí.
   */
  PASSWORD_SHA256: 'b250a672224013ae26c6c25ef43e835e571ce633732005fdd30b10694d901074',

  /** Minutos sin uso antes de bloquear la app. */
  AUTO_LOCK_MINUTES: 15,

  /**
   * ID de cliente OAuth de Google Cloud (tipo "Aplicación web").
   * Vacío = la app guarda todo sólo en este navegador.
   * Pasos: console.cloud.google.com → habilitar "Google Drive API" →
   * pantalla de consentimiento (agrega tu correo como usuario de prueba) →
   * Credenciales → ID de cliente OAuth → Aplicación web → en "Orígenes de
   * JavaScript autorizados" pon https://TU-USUARIO.github.io
   */
  GOOGLE_CLIENT_ID: '283041748014-l5okmhe1f1ff8o0b19klfu90035napjj.apps.googleusercontent.com',

  /** Carpeta que se crea en tu Drive. */
  DRIVE_ROOT_FOLDER: 'Control Facturas',

  /** Nombre de archivos:  053_NEMP920226AU6_03124.pdf / .xml */
  RFC_EMISOR: 'NEMP920226AU6',   // se usa si el XML no trae el RFC del emisor
  SEQ_DIGITS: 3,                 // 53 → 053

  /** Texto de la marca de agua que se pone al PDF de la factura cobrada. */
  WATERMARK_TEXT: 'FACTURADO',

  /** Valores iniciales del desglose (en %). */
  IVA_DEFAULT: 16,
  RET_ISR_DEFAULT: 0,   // ej. 1.25 RESICO, 10 honorarios
  RET_IVA_DEFAULT: 0    // ej. 10.6667 = 2/3 del IVA
};
const C = CONFIG;


/* =========================================================================
   2. UTILIDADES
   ========================================================================= */
/** querySelector corto */
const $ = (s, r = document) => r.querySelector(s);
/** querySelectorAll como arreglo */
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
/** 1234.5 → "$1,234.50" */
const money = n => (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
/** Convierte texto a número (ignora $ y comas); vacío → 0 */
const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
/** Redondea a centavos */
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
/** Identificador único */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
/** Rellena con ceros: pad(53,3) → "053" */
const pad = (n, l = 4) => String(n).padStart(l, '0');
/** Fecha ISO en hora local (no UTC), para no "brincar" de día en la noche */
const localISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
const today = () => localISO().slice(0, 10);       // "2026-10-18"
const thisMonth = () => localISO().slice(0, 7);    // "2026-10"
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
/** "2026-10-18" o fecha ISO completa → "18/10/2026" */
const fmtDate = d => { if (!d) return ''; if (d.length > 10) d = localISO(new Date(d)); const [y, m, dd] = d.slice(0, 10).split('-'); return `${+dd}/${+m}/${y}`; };
/** "2025-07" → "Julio 2025" */
const fmtPeriodo = p => { if (!p) return ''; const [y, m] = p.split('-'); return `${MESES[+m - 1]} ${y}`; };
/** Bytes → "12 KB" */
const fmtSize = b => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
/** Limpia texto para usarlo en nombres de archivo (sin acentos ni símbolos) */
const cleanPart = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, '-').replace(/[^\w.\-]/g, '').slice(0, 60);
/** "archivo.PDF" → "pdf" */
const extOf = name => (String(name || '').split('.').pop() || '').toLowerCase();

/** Íconos SVG que usan las plantillas con {{:~icon('nombre')}} */
const ICONS = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h11M4 17h7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.6-.6-3-1.6M12 6v2M12 16v2"/></svg>',
  drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 3h8l6 10-4 7H6l-4-7z"/><path d="M8 3l6 10h8M2 13h12l-4 7"/></svg>'
};


/* =========================================================================
   3. CFDI — lector de XML del SAT (CFDI 4.0 / 3.3)
   Soporta factura de ingreso (tipo "I") y complemento de pago (tipo "P",
   Pagos 2.0 / 1.0). No valida el sello: sólo extrae datos para llenar el
   formulario.
   ========================================================================= */
const CFDI = (() => {
  const byTag = (root, tag) => Array.from(root.getElementsByTagNameNS('*', tag));
  const n = v => (v == null || v === '' ? null : parseFloat(v));

  /**
   * Lee un XML CFDI.
   * @param {string} text contenido del .xml
   * @returns {{tipo:string, serie:string, folio:string, fecha:string, subtotal:number, total:number,
   *   metodoPago:string, emisorRfc:string, emisorNombre:string, receptorRfc:string, receptorNombre:string,
   *   uuid:string, iva:number, retIsr:number, retIva:number, descripcion:string,
   *   pagos:Array<{fecha:string, monto:number, doctos:Array<{uuid:string, pagado:number, saldoInsoluto:number}>}>}}
   */
  function parse(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo no es un XML válido');
    const comp = byTag(doc, 'Comprobante')[0];
    if (!comp) throw new Error('No parece un CFDI (falta el nodo Comprobante)');
    const a = k => comp.getAttribute(k);
    const emisor = byTag(comp, 'Emisor')[0];
    const receptor = byTag(comp, 'Receptor')[0];
    const timbre = byTag(doc, 'TimbreFiscalDigital')[0];

    // Impuestos del comprobante (nodo hijo directo, no los de cada concepto)
    const imp = Array.from(comp.children).find(c => c.localName === 'Impuestos');
    let retIsr = 0, retIva = 0;
    if (imp) {
      byTag(imp, 'Retencion').forEach(r => {
        if (r.parentNode.parentNode !== imp) return;
        const v = n(r.getAttribute('Importe')) || 0;
        if (r.getAttribute('Impuesto') === '001') retIsr += v;   // 001 = ISR
        if (r.getAttribute('Impuesto') === '002') retIva += v;   // 002 = IVA
      });
    }
    const out = {
      tipo: a('TipoDeComprobante'),
      serie: a('Serie') || '', folio: a('Folio') || '',
      fecha: (a('Fecha') || '').slice(0, 10),
      subtotal: n(a('SubTotal')), total: n(a('Total')),
      metodoPago: a('MetodoPago') || '',
      emisorNombre: emisor?.getAttribute('Nombre') || '', emisorRfc: emisor?.getAttribute('Rfc') || '',
      receptorNombre: receptor?.getAttribute('Nombre') || '', receptorRfc: receptor?.getAttribute('Rfc') || '',
      uuid: (timbre?.getAttribute('UUID') || '').toUpperCase(),
      iva: imp ? n(imp.getAttribute('TotalImpuestosTrasladados')) || 0 : 0,
      retIsr, retIva,
      descripcion: byTag(comp, 'Concepto').map(c => c.getAttribute('Descripcion')).find(Boolean) || '',
      pagos: []
    };
    if (out.tipo === 'P') {
      byTag(doc, 'Pago').forEach(p => {
        if (!p.getAttribute('Monto')) return; // ignora el contenedor "Pagos"
        out.pagos.push({
          fecha: (p.getAttribute('FechaPago') || '').slice(0, 10),
          monto: n(p.getAttribute('Monto')),
          doctos: byTag(p, 'DoctoRelacionado').map(d => ({
            uuid: (d.getAttribute('IdDocumento') || '').toUpperCase(),
            pagado: n(d.getAttribute('ImpPagado')),
            saldoInsoluto: n(d.getAttribute('ImpSaldoInsoluto'))
          }))
        });
      });
    }
    return out;
  }

  /**
   * Busca dentro de un complemento el pago que corresponde a una factura.
   * @returns {{fecha:string, monto:number, saldoInsoluto:number}|null}
   */
  function pagoDeFactura(cfdi, uuid) {
    const u = (uuid || '').toUpperCase();
    for (const p of cfdi.pagos) {
      const d = p.doctos.find(x => x.uuid === u);
      if (d) return { fecha: p.fecha, monto: d.pagado ?? p.monto, saldoInsoluto: d.saldoInsoluto };
    }
    return null;
  }
  return { parse, pagoDeFactura };
})();


/* =========================================================================
   4. STORE — dónde se guardan datos y archivos
   - Modo "drive": carpeta en tu Google Drive. Permiso drive.file: la app
     sólo ve lo que ella misma crea. Los datos van en base-datos.json.
   - Modo "local": IndexedDB del navegador (sólo este dispositivo).
   Cada archivo guardado se describe con un objeto "meta":
     { id, name, size, mime, uploadedAt, path:[carpetas], link, original }
   Los id que empiezan con "loc_" están en el navegador; los demás en Drive.
   ========================================================================= */
const Store = (() => {
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const FOLDER = 'application/vnd.google-apps.folder';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const DB_NAME = 'base-datos.json';

  const local = {
    db: localforage.createInstance({ name: 'controlFacturas', storeName: 'db' }),
    files: localforage.createInstance({ name: 'controlFacturas', storeName: 'files' })
  };
  /** Estado de la sesión de Google */
  const D = { token: null, exp: 0, client: null, rootId: null, dbId: null, folders: {}, onErr: null };
  /** Archivos ya descargados en esta sesión (evita bajarlos dos veces) */
  const cache = new Map();
  let mode = localStorage.getItem('cf_mode') || null;

  const driveAvailable = () => !!C.GOOGLE_CLIENT_ID;
  const authErr = () => Object.assign(new Error('Tu sesión de Google Drive expiró. Vuelve a conectar.'), { auth: true });

  // El token de Google dura ~1 h; se guarda en sessionStorage para sobrevivir recargas.
  try {
    const t = JSON.parse(sessionStorage.getItem('cf_tok') || 'null');
    if (t && t.e > Date.now()) { D.token = t.t; D.exp = t.e; }
  } catch {}
  const tokenValid = () => D.token && Date.now() < D.exp;

  function initClient() {
    if (D.client) return;
    if (!window.google?.accounts?.oauth2) throw new Error('No se pudo cargar Google. Revisa tu conexión.');
    D.client = google.accounts.oauth2.initTokenClient({
      client_id: C.GOOGLE_CLIENT_ID, scope: SCOPE, callback: () => {},
      error_callback: e => D.onErr && D.onErr(e)
    });
  }
  /** Abre la ventana de Google y obtiene un token. Debe llamarse desde un clic. */
  function requestToken() {
    return new Promise((res, rej) => {
      initClient();
      D.client.callback = r => {
        if (r.error) return rej(new Error('Google: ' + r.error));
        D.token = r.access_token;
        D.exp = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
        sessionStorage.setItem('cf_tok', JSON.stringify({ t: D.token, e: D.exp }));
        res();
      };
      D.onErr = e => rej(new Error(e?.type === 'popup_closed' ? 'Cerraste la ventana de Google' : 'No se pudo abrir la ventana de Google (¿bloqueador de ventanas?)'));
      D.client.requestAccessToken({ prompt: '' });
    });
  }
  /** fetch a la API de Drive con el token; lanza error "auth" si expiró. */
  async function api(url, opts = {}) {
    if (!tokenValid()) throw authErr();
    const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + D.token } });
    if (r.status === 401) { D.token = null; sessionStorage.removeItem('cf_tok'); throw authErr(); }
    if (!r.ok) throw new Error('Drive ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r;
  }
  const qs = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  /** Busca un archivo/carpeta por nombre dentro de una carpeta. */
  async function findOne(name, parent, isFolder) {
    const q = [`name='${qs(name)}'`, 'trashed=false', `'${parent}' in parents`];
    if (isFolder) q.push(`mimeType='${FOLDER}'`);
    const r = await api(`${API}/files?q=${encodeURIComponent(q.join(' and '))}&fields=files(id,name)&spaces=drive&pageSize=1`);
    return (await r.json()).files[0] || null;
  }
  /** Devuelve el id de una carpeta; la crea si no existe. */
  async function ensureFolder(name, parent) {
    const key = parent + '/' + name;
    if (D.folders[key]) return D.folders[key];
    let f = await findOne(name, parent, true);
    if (!f) {
      const r = await api(`${API}/files?fields=id`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] })
      });
      f = await r.json();
    }
    return (D.folders[key] = f.id);
  }
  /** ['Facturas','053_RFC_REF'] → id de la carpeta final (crea las que falten) */
  async function ensurePath(arr) {
    let p = D.rootId;
    for (const name of arr) p = await ensureFolder(String(name).replace(/[\/\\]/g, '-').trim() || 'sin-nombre', p);
    return p;
  }
  /** Sube un archivo nuevo a Drive (metadatos + contenido en una sola petición). */
  async function multipart(meta, blob) {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file', blob);
    const r = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink,size`, { method: 'POST', body: form });
    return r.json();
  }
  const guessMime = name => ({ pdf: 'application/pdf', xml: 'application/xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[extOf(name)] || 'application/octet-stream');

  /**
   * Prepara Drive: pide token (si interactive) y localiza la carpeta raíz.
   * @param {boolean} interactive true sólo cuando viene de un clic del usuario
   */
  async function connect(interactive) {
    if (mode !== 'drive') return;
    if (!tokenValid()) {
      if (!interactive) throw authErr();
      await requestToken();
    }
    if (!D.rootId) D.rootId = await ensureFolder(C.DRIVE_ROOT_FOLDER, 'root');
  }
  /** Lee la base de datos (objeto db) o null si aún no existe. */
  async function loadDB() {
    if (mode === 'drive') {
      const f = await findOne(DB_NAME, D.rootId);
      if (!f) return null;
      D.dbId = f.id;
      return (await api(`${API}/files/${f.id}?alt=media`)).json();
    }
    return local.db.getItem('db');
  }
  const loadLocalDB = () => local.db.getItem('db');
  /** Guarda la base de datos completa. */
  async function saveDB(db) {
    if (mode === 'drive') {
      const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
      if (D.dbId) await api(`${UPLOAD}/files/${D.dbId}?uploadType=media`, { method: 'PATCH', body: blob, headers: { 'Content-Type': 'application/json' } });
      else D.dbId = (await multipart({ name: DB_NAME, parents: [D.rootId], mimeType: 'application/json' }, blob)).id;
      local.db.setItem('db_drive_cache', db).catch(() => {}); // copia de respaldo en el navegador
      return;
    }
    await local.db.setItem('db', db);
  }
  /**
   * Guarda un archivo.
   * @param {Blob} blob contenido
   * @param {string} name nombre final (ej. 053_RFC_03124.pdf)
   * @param {string[]} path carpetas dentro de la raíz
   * @returns {Promise<object>} meta del archivo
   */
  async function putFile(blob, name, path) {
    const base = { name, size: blob.size, mime: blob.type || guessMime(name), uploadedAt: new Date().toISOString(), path };
    if (mode === 'drive') {
      const f = await multipart({ name, parents: [await ensurePath(path)] }, blob);
      cache.set(f.id, blob);
      return { ...base, id: f.id, link: f.webViewLink || '' };
    }
    const id = 'loc_' + uid();
    await local.files.setItem(id, blob);
    cache.set(id, blob);
    return { ...base, id };
  }
  /** Descarga el contenido de un archivo guardado. */
  async function getFile(meta) {
    if (cache.has(meta.id)) return cache.get(meta.id);
    let blob = meta.id.startsWith('loc_') ? await local.files.getItem(meta.id) : await (await api(`${API}/files/${meta.id}?alt=media`)).blob();
    if (!blob) throw new Error('No se encontró el archivo');
    if (!blob.type && meta.mime) blob = new Blob([blob], { type: meta.mime });
    cache.set(meta.id, blob);
    return blob;
  }
  /** Borra un archivo. En Drive va a la papelera (recuperable 30 días). */
  async function deleteFile(meta) {
    if (!meta) return;
    cache.delete(meta.id);
    if (meta.id.startsWith('loc_')) return local.files.removeItem(meta.id);
    await api(`${API}/files/${meta.id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  }
  /** Cambia el nombre de un archivo (en Drive cambia el nombre real). */
  async function renameFile(meta, name) {
    if (!meta || meta.name === name) return;
    if (!meta.id.startsWith('loc_')) await api(`${API}/files/${meta.id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    meta.name = name;
  }
  /** Sube a Drive los archivos que estaban sólo en el navegador y actualiza sus id. */
  async function migrateLocalFiles(db, onProgress) {
    const metas = [];
    const walk = o => {
      if (!o || typeof o !== 'object') return;
      if (typeof o.id === 'string' && o.id.startsWith('loc_') && o.name) metas.push(o);
      Object.values(o).forEach(walk);
    };
    walk(db);
    let i = 0;
    for (const m of metas) {
      onProgress && onProgress(++i, metas.length);
      const blob = await local.files.getItem(m.id);
      if (!blob) continue;
      const nu = await putFile(blob, m.name, m.path || ['Migrados']);
      await local.files.removeItem(m.id);
      Object.assign(m, { id: nu.id, link: nu.link });
    }
    return metas.length;
  }
  function setMode(m) { mode = m; localStorage.setItem('cf_mode', m); }
  /** Cierra la sesión de Google en este navegador. */
  function disconnect() {
    if (D.token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(D.token, () => {});
    Object.assign(D, { token: null, rootId: null, dbId: null, folders: {} });
    sessionStorage.removeItem('cf_tok');
  }
  return {
    get mode() { return mode; }, setMode, driveAvailable, tokenValid, connect, disconnect,
    loadDB, loadLocalDB, saveDB, putFile, getFile, deleteFile, renameFile, migrateLocalFiles,
    folderLink: () => (D.rootId ? `https://drive.google.com/drive/folders/${D.rootId}` : '')
  };
})();


/* =========================================================================
   5. PLANTILLAS (JsRender)
   templates.html se descarga en cuanto abre la página (mientras escribes
   la contraseña), se compila una vez y luego cada pantalla se dibuja con
   R('nombre', datos). Rendimiento: compilar es instantáneo y dibujar es
   armar texto HTML, igual que escribirlo a mano en JS.
   ========================================================================= */
const T = {};
jsrender.views.helpers({ money, fecha: fmtDate, periodo: fmtPeriodo, icon: n => ICONS[n] || '' });
const templatesReady = fetch(`templates.html?v=${C.VERSION}`)
  .then(r => { if (!r.ok) throw new Error('No se pudo cargar templates.html'); return r.text(); })
  .then(text => {
    new DOMParser().parseFromString(text, 'text/html').querySelectorAll('script[type="text/x-jsrender"]')
      .forEach(s => { T[s.id] = jsrender.templates(s.id, s.textContent); });
  });
/**
 * Dibuja una plantilla y devuelve el HTML.
 * @param {string} name id de la plantilla en templates.html
 * @param {object} data datos (siempre un objeto; un arreglo haría que JsRender repita la plantilla)
 */
const R = (name, data = {}) => {
  if (!T[name]) throw new Error('Falta la plantilla ' + name);
  return T[name].render(data);
};


/* =========================================================================
   6. MODELO DE DATOS
   db = {
     version, seq,
     facturas: [ {
       id, seq (consecutivo), referencia, rfcEmisor, descripcion, sede,
       cliente, rfcCliente, folio, uuid, fechaEmision, metodoPago (PUE|PPD),
       total, ivaRate, retIsrRate, retIvaRate, desgloseManual,
       subtotal, iva, retIsr, retIva, montoCobrado, fechaCobro,
       pagadaSinComplemento, cancelada, notas, createdAt, updatedAt,
       docs: { solicitud, facturaPdf, facturaXml, complementoPdf,
               complementoXml, facturaPdfOriginal }   ← metas de Store
     } ],
     mensuales: { "2025-07": {
       periodo, estado (pendiente|presentada|pagada), fechaPresentacion,
       isr, iva, totalPagado, notas,
       docs: { declaracion, vistaPrevia },
       saldo: { monto, concepto (IVA|ISR|Otro), nota,
                aplicaciones: [ { id, periodo (dónde se usó), monto, nota, fecha } ] }
     } },
     anuales: { "2025": { year, estado, resultado, monto, fechaPresentacion,
                          notas, docs:[{ id, tipo, file }] } }
   }
   ========================================================================= */
const emptyDB = () => ({ version: 3, seq: 0, facturas: [], mensuales: {}, anuales: {}, updatedAt: null });
/** Base de datos en memoria; se guarda con persist() */
let db = emptyDB();
/** Estado de la interfaz (filtros, año visible, etc.) */
const ui = { view: 'facturas', filtro: 'todas', q: '', orden: 'asc', year: new Date().getFullYear(), openYear: null };

/** Documentos de una factura, en el orden en que llegan */
const DOCS_F = [
  { key: 'solicitud', etapa: 1, label: 'PDF a facturar (solicitud / orden)', accept: 'application/pdf,.pdf' },
  { key: 'facturaPdf', etapa: 2, label: 'Factura (PDF)', accept: 'application/pdf,.pdf' },
  { key: 'facturaXml', etapa: 2, label: 'Factura (XML del CFDI)', accept: '.xml,text/xml,application/xml' },
  { key: 'complementoPdf', etapa: 3, label: 'Complemento de pago (PDF)', accept: 'application/pdf,.pdf' },
  { key: 'complementoXml', etapa: 3, label: 'Complemento de pago (XML · REP)', accept: '.xml,text/xml,application/xml' }
];
/** Sufijo de cada documento en el nombre: 053_RFC_REF{sufijo}.ext */
const SUFIJO = { solicitud: '_SOLICITUD', facturaPdf: '', facturaXml: '', complementoPdf: '_COMPLEMENTO', complementoXml: '_COMPLEMENTO', facturaPdfOriginal: '_ORIGINAL' };
/** Etiquetas de estado de factura */
const ESTADOS = {
  porfacturar: { label: 'Por facturar', cls: 'st-gray' },
  pendiente: { label: 'Pendiente de pago', cls: 'st-amber' },
  cobrado: { label: 'Cobrado', cls: 'st-green' },
  cancelada: { label: 'Cancelada', cls: 'st-red' }
};
/** Estados de declaración mensual */
const EST_MENS = {
  pendiente: { label: 'Pendiente', cls: 'st-gray' },
  presentada: { label: 'Presentada', cls: 'st-amber' },
  pagada: { label: 'Pagada / en ceros', cls: 'st-green' }
};
const IMPUESTOS = ['IVA', 'ISR', 'Otro'];
const TIPOS_ANUAL = ['Declaración anual', 'Acuse de recibo', 'Línea de captura', 'Comprobante de pago', 'Constancia de retenciones', 'Devolución de saldo a favor', 'Otro'];
const RES_ANUAL = { cargo: 'A cargo (pagar)', favor: 'A favor (devolución)', cero: 'En ceros' };

/** Nombre base de los archivos de una factura: 053_NEMP920226AU6_03124 */
const baseName = f => [pad(f.seq, C.SEQ_DIGITS || 3), cleanPart((f.rfcEmisor || C.RFC_EMISOR || '').toUpperCase()), cleanPart(f.referencia) || 'SIN-REF'].filter(Boolean).join('_');
/** Nombre completo de un documento de factura */
const docName = (f, key, ext) => baseName(f) + (SUFIJO[key] ?? '_' + key) + '.' + ext;
/** Carpeta de Drive de una factura */
const folderOf = f => ['Facturas', baseName(f)];

/** Estado de una factura según los documentos que tiene. */
function estadoFactura(f) {
  if (f.cancelada) return 'cancelada';
  if (f.docs.complementoXml || f.docs.complementoPdf || f.pagadaSinComplemento) return 'cobrado';
  if (f.docs.facturaPdf || f.docs.facturaXml) return 'pendiente';
  return 'porfacturar';
}
/** Texto "Siguiente: …" que guía qué falta subir. */
function siguientePaso(f) {
  const e = estadoFactura(f);
  if (e === 'porfacturar') return f.docs.solicitud ? 'Subir factura PDF y XML' : 'Subir PDF a facturar';
  if (e === 'pendiente') {
    if (!f.docs.facturaPdf) return 'Falta el PDF de la factura';
    if (!f.docs.facturaXml) return 'Falta el XML de la factura';
    return f.metodoPago === 'PUE' ? 'Marcar como cobrada (PUE)' : 'Subir complemento de pago';
  }
  if (e === 'cobrado' && !f.pagadaSinComplemento && !(f.docs.complementoPdf && f.docs.complementoXml)) return 'Falta ' + (f.docs.complementoPdf ? 'XML' : 'PDF') + ' del complemento';
  return '';
}
/** [solicitud, factura, cobrado] → para las 3 barras de avance */
const etapasHechas = f => [!!f.docs.solicitud, !!(f.docs.facturaPdf || f.docs.facturaXml), estadoFactura(f) === 'cobrado'];

/**
 * Desglosa un total en subtotal, IVA y retenciones.
 * total = subtotal × (1 + IVA% − retISR% − retIVA%)
 */
function calcDesglose(total, iva, retIsr, retIva) {
  const factor = 1 + iva / 100 - retIsr / 100 - retIva / 100;
  const sub = factor > 0 ? total / factor : 0;
  return { subtotal: r2(sub), iva: r2(sub * iva / 100), retIsr: r2(sub * retIsr / 100), retIva: r2(sub * retIva / 100) };
}
/** Desglose de una factura: el capturado a mano/del XML o el calculado desde el total. */
function desglose(f) {
  if (f.desgloseManual) return { subtotal: f.subtotal || 0, iva: f.iva || 0, retIsr: f.retIsr || 0, retIva: f.retIva || 0 };
  return calcDesglose(f.total || 0, f.ivaRate ?? C.IVA_DEFAULT, f.retIsrRate ?? 0, f.retIvaRate ?? 0);
}
/** Parte del monto cobrado que no es IVA (proporcional). */
const cobradoSinIva = f => (f.total ? r2((f.montoCobrado || 0) * desglose(f).subtotal / f.total) : 0);

/* ---- Saldos a favor (viven en las declaraciones mensuales) ---- */
const nuevoSaldo = () => ({ monto: 0, concepto: 'IVA', nota: '', aplicaciones: [] });
/** Cuánto se ha usado del saldo de una declaración */
const saldoUsado = r => r2((r.saldo?.aplicaciones || []).reduce((s, a) => s + (a.monto || 0), 0));
/** Cuánto queda disponible (0 = ya no aparece en "disponibles") */
const saldoDisp = r => r2((r.saldo?.monto || 0) - saldoUsado(r));
/** Declaraciones que generaron saldo a favor, de la más antigua a la más nueva */
const declsConSaldo = () => Object.values(db.mensuales).filter(r => (r.saldo?.monto || 0) > 0).sort((a, b) => a.periodo.localeCompare(b.periodo));
/** Usos registrados EN un mes (saldos de otros meses aplicados en esa declaración) */
const aplicadosEn = periodo => declsConSaldo().flatMap(r => r.saldo.aplicaciones.filter(a => a.periodo === periodo).map(a => ({ ...a, origen: r.periodo, origenLabel: fmtPeriodo(r.periodo), concepto: r.saldo.concepto })));
/** Total disponible de todas las declaraciones */
const saldoTotalDisp = () => r2(declsConSaldo().reduce((s, r) => s + Math.max(0, saldoDisp(r)), 0));

/** Registro vacío de una declaración mensual */
const nuevoMes = p => ({ periodo: p, estado: 'pendiente', fechaPresentacion: '', isr: 0, iva: 0, totalPagado: 0, notas: '', docs: { declaracion: null, vistaPrevia: null }, saldo: nuevoSaldo() });

/** Factura vacía con el siguiente consecutivo */
function nuevaFactura() {
  return {
    id: uid(), seq: Math.max(0, ...db.facturas.map(f => f.seq)) + 1, createdAt: null, updatedAt: null,
    referencia: '', rfcEmisor: C.RFC_EMISOR || '', descripcion: '', sede: '', cliente: '', rfcCliente: '', folio: '', uuid: '', fechaEmision: '',
    metodoPago: 'PPD', total: 0, ivaRate: C.IVA_DEFAULT, retIsrRate: C.RET_ISR_DEFAULT, retIvaRate: C.RET_IVA_DEFAULT,
    desgloseManual: false, subtotal: 0, iva: 0, retIsr: 0, retIva: 0,
    montoCobrado: 0, fechaCobro: '', pagadaSinComplemento: false, cancelada: false, notas: '',
    docs: { solicitud: null, facturaPdf: null, facturaXml: null, complementoPdf: null, complementoXml: null, facturaPdfOriginal: null }
  };
}

/**
 * Actualiza datos guardados con versiones anteriores.
 * v2 guardaba el saldo a favor en cada factura; ahora vive en la declaración
 * del mes donde se generó (o el mes de alta de la factura si no se indicó).
 */
function migrar(d) {
  d.facturas.forEach(f => {
    f.rfcEmisor ??= C.RFC_EMISOR || '';
    f.docs.facturaPdfOriginal ??= null;
    if (f.saldo && f.saldo.monto > 0) {
      const p = f.saldo.periodoOrigen || (f.createdAt ? localISO(new Date(f.createdAt)).slice(0, 7) : thisMonth());
      const r = d.mensuales[p] ||= nuevoMes(p);
      r.saldo ||= nuevoSaldo();
      r.saldo.monto = r2((r.saldo.monto || 0) + f.saldo.monto);
      r.saldo.concepto = f.saldo.concepto || r.saldo.concepto;
      r.saldo.nota = [r.saldo.nota, f.saldo.nota, `de factura #${f.seq}`].filter(Boolean).join(' · ');
      r.saldo.aplicaciones.push(...(f.saldo.aplicaciones || []));
    }
    delete f.saldo;
  });
  Object.values(d.mensuales).forEach(r => { r.saldo ||= nuevoSaldo(); r.saldo.aplicaciones ||= []; });
  d.seq = Math.max(d.seq || 0, ...d.facturas.map(f => f.seq), 0);
  d.version = 3;
  return d;
}


/* =========================================================================
   7. UI BÁSICA
   ========================================================================= */
/** Mensaje corto abajo de la pantalla. type: '' | 'ok' | 'err' */
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  const box = $('#toasts');
  while (box.children.length >= 2) box.firstChild.remove();
  box.appendChild(t);
  setTimeout(() => t.remove(), type === 'err' ? 6000 : 2600);
}
/** Capa "Guardando…" que bloquea la pantalla. Devuelve { set(texto), done() } */
function busy(msg) {
  const b = document.createElement('div');
  b.className = 'busy';
  b.innerHTML = '<div class="box"><div class="spin"></div><span></span></div>';
  $('span', b).textContent = msg;
  document.body.appendChild(b);
  return { set: m => ($('span', b).textContent = m), done: () => b.remove() };
}
/**
 * Abre una ventana modal (plantilla "modal").
 * Cualquier elemento con data-close la cierra; al cerrarse emite el evento "closed".
 * @returns {{el:HTMLElement, close:Function, body:HTMLElement}}
 */
function openModal({ title, body, footer = '', size = '' }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = R('modal', { title, body, footer, size });
  document.body.appendChild(bg);
  document.body.style.overflow = 'hidden';
  const close = () => { bg.remove(); if (!$('.modal-bg')) document.body.style.overflow = ''; bg.dispatchEvent(new Event('closed')); };
  bg.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  return { el: bg, close, body: $('.modal-b', bg) };
}
/** Pregunta Sí/No. Devuelve Promise<boolean>. */
function confirmar(msg, ok = 'Aceptar', danger = false) {
  return new Promise(res => {
    const m = openModal({ title: 'Confirmar', body: R('confirm-body', { msg }), footer: R('confirm-footer', { ok, danger }) });
    let r = false;
    $('[data-ok]', m.el).onclick = () => { r = true; m.close(); };
    m.el.addEventListener('closed', () => res(r));
  });
}
/** Abre el selector de archivos del sistema. Devuelve Promise<File|null>. */
function pickFile(accept) {
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept || '';
    inp.onchange = () => res(inp.files[0] || null);
    inp.click();
  });
}
/** Muestra un error; si es de sesión de Google, ofrece reconectar. */
function handleErr(e) {
  console.error(e);
  if (e && e.auth) { showAuthBanner(); toast(e.message, 'err'); return; }
  toast(e?.message || String(e), 'err');
}
/**
 * Datos para la plantilla "slot" (renglón de archivo).
 * @param {string} key clave del documento
 * @param {string} label texto visible
 * @param {object|null} meta archivo ya guardado
 * @param {File|'REMOVE'|undefined} pend cambio pendiente (se aplica al Guardar)
 * @param {object} extra campos adicionales (note, extra:{act,label})
 */
function slotVM(key, label, meta, pend, extra = {}) {
  const removed = pend === 'REMOVE';
  const file = pend instanceof File ? pend : null;
  const name = file ? file.name : meta?.name;
  const ext = extOf(name);
  return {
    key, label, removed, hasFile: !!name, canView: !!name && !removed, canRemove: !!(meta || file) && !removed,
    cls: !name ? 'empty-slot' : file ? 'pending' : removed ? 'removed' : '',
    icoCls: name ? (ext === 'xml' ? 'xml' : 'pdf') : 'none',
    extLabel: name ? ext.toUpperCase() : '—',
    sub: file ? `${file.name} · nuevo, se sube al guardar` : removed ? 'Se quitará al guardar' : meta ? `${meta.name} · ${fmtSize(meta.size || 0)} · ${fmtDate(meta.uploadedAt)}` : 'Sin archivo',
    ...extra
  };
}


/* =========================================================================
   8. BLOQUEO
   Seguridad básica: se compara el SHA-256 de lo escrito con
   CONFIG.PASSWORD_SHA256. Tras 5 intentos fallidos espera 30 s. La sesión
   sigue abierta mientras haya actividad (sessionStorage), y se bloquea sola
   tras CONFIG.AUTO_LOCK_MINUTES sin uso. Bloquear = recargar la página,
   con lo que se borra todo de la memoria.
   ========================================================================= */
async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}
let fails = 0, lockedUntil = 0, idleTimer = null;
/** Registra actividad y reinicia el temporizador de bloqueo. */
function touch() {
  sessionStorage.setItem('cf_last', Date.now());
  clearTimeout(idleTimer);
  idleTimer = setTimeout(lock, C.AUTO_LOCK_MINUTES * 60000);
}
function lock() { sessionStorage.removeItem('cf_last'); location.reload(); }
function initLock() {
  const last = +sessionStorage.getItem('cf_last') || 0;
  if (last && Date.now() - last < C.AUTO_LOCK_MINUTES * 60000) return unlock();
  $('#lockPw').focus();
  $('#pwToggle').onclick = () => { const i = $('#lockPw'); i.type = i.type === 'password' ? 'text' : 'password'; };
  $('#lockForm').onsubmit = async e => {
    e.preventDefault();
    const err = $('#lockErr');
    if (Date.now() < lockedUntil) { err.textContent = `Demasiados intentos. Espera ${Math.ceil((lockedUntil - Date.now()) / 1000)} s.`; return; }
    if (!window.crypto?.subtle) { err.textContent = 'Abre la página con https:// (GitHub Pages) para poder desbloquear.'; return; }
    if (await sha256($('#lockPw').value) === C.PASSWORD_SHA256) return unlock();
    if (++fails >= 5) { lockedUntil = Date.now() + 30000; fails = 0; }
    err.textContent = 'Contraseña incorrecta';
    const fm = $('#lockForm'); fm.classList.remove('shake'); void fm.offsetWidth; fm.classList.add('shake');
    $('#lockPw').select();
  };
}
function unlock() {
  $('#lock').remove();
  $('#app').hidden = false;
  touch();
  ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (+sessionStorage.getItem('cf_last') < Date.now() - 20000) touch(); }, { passive: true }));
  start().catch(handleErr);
}


/* =========================================================================
   9. ARRANQUE Y GUARDADO
   ========================================================================= */
/** Después de desbloquear: elige almacenamiento, carga datos y dibuja. */
async function start() {
  await templatesReady;
  if (!Store.driveAvailable() && Store.mode !== 'local') Store.setMode('local');
  if (!Store.mode) return renderSetup();
  if (Store.mode === 'drive') {
    if (!Store.tokenValid()) return renderConnect();
    const b = busy('Cargando desde Google Drive…');
    try { await Store.connect(false); await loadData(); }
    catch (e) { b.done(); handleErr(e); return renderConnect(); }
    b.done();
  } else await loadData();
  window.addEventListener('hashchange', route);
  route();
}
/** Carga db; si Drive está vacío y hay datos locales, ofrece subirlos. */
async function loadData() {
  const data = await Store.loadDB();
  db = migrar(Object.assign(emptyDB(), data || {}));
  if (data && data.version !== 3) persist(); // guarda la migración
  if (!data && Store.mode === 'drive') {
    const loc = await Store.loadLocalDB();
    if (loc && loc.facturas?.length && await confirmar(`Hay ${loc.facturas.length} factura(s) guardadas sólo en este dispositivo. ¿Subirlas a Google Drive?`, 'Subir a Drive')) {
      db = migrar(Object.assign(emptyDB(), loc));
      const b = busy('Subiendo archivos…');
      try { await Store.migrateLocalFiles(db, (i, n) => b.set(`Subiendo archivo ${i} de ${n}…`)); await persist(); toast('Datos subidos a Drive', 'ok'); }
      catch (e) { handleErr(e); } finally { b.done(); }
    }
  }
}
function renderSetup() {
  $('#app').innerHTML = R('setup');
  $$('[data-m]').forEach(b => b.onclick = () => { Store.setMode(b.dataset.m); start(); });
}
function renderConnect() {
  $('#app').innerHTML = R('connect', { folder: C.DRIVE_ROOT_FOLDER });
  $('#cnx').onclick = async () => {
    try {
      await Store.connect(true);
      const b = busy('Cargando…'); try { await loadData(); } finally { b.done(); }
      window.addEventListener('hashchange', route); route();
    } catch (e) { handleErr(e); }
  };
  $('#loc').onclick = () => { Store.setMode('local'); start(); };
}

let saveChain = Promise.resolve();
/** Guarda db. Los guardados se encadenan para que nunca se pisen entre sí. */
function persist() {
  db.updatedAt = new Date().toISOString();
  setSync('saving');
  saveChain = saveChain.then(() => Store.saveDB(db)).then(() => setSync('ok')).catch(e => { setSync('error'); handleErr(e); });
  return saveChain;
}
/** Indicador de la barra superior: En Drive / Local / Guardando… / Sin guardar */
function setSync(s) {
  const el = $('#sync'); if (!el) return;
  el.className = 'sync ' + s;
  $('.lbl', el).textContent = s === 'saving' ? 'Guardando…' : s === 'error' ? 'Sin guardar' : (Store.mode === 'drive' ? 'En Drive' : 'Local');
}
/** Aviso con botón "Reconectar" cuando expira la sesión de Google. */
function showAuthBanner() {
  const main = $('main'); if (!main || $('#authBanner')) return;
  main.insertAdjacentHTML('afterbegin', `<div class="banner" id="authBanner"><span class="grow">La sesión de Google Drive expiró. Los cambios no se guardaron.</span><button class="btn sm primary" id="reauth">Reconectar</button></div>`);
  $('#reauth').onclick = async () => {
    try { await Store.connect(true); $('#authBanner').remove(); await persist(); toast('Reconectado y guardado', 'ok'); } catch (e) { handleErr(e); }
  };
}


/* =========================================================================
   10. NAVEGACIÓN
   Rutas por hash: #/facturas · #/saldos · #/mensuales · #/anuales[/2025]
   ========================================================================= */
const VIEWS = {
  facturas: { title: 'Facturas', icon: 'file', render: renderFacturas },
  saldos: { title: 'Saldos a favor', short: 'Saldos', icon: 'coin', render: renderSaldos },
  mensuales: { title: 'Declaraciones mensuales', short: 'Mensuales', icon: 'cal', render: renderMensuales },
  anuales: { title: 'Declaraciones anuales', short: 'Anuales', icon: 'archive', render: renderAnuales }
};
function route() {
  const [v, arg] = (location.hash.replace('#/', '') || 'facturas').split('/');
  ui.view = VIEWS[v] ? v : 'facturas';
  if (ui.view === 'anuales' && arg) ui.openYear = arg;
  renderShell();
}
/** Dibuja la estructura (barra, navegación) y la vista actual. */
function renderShell() {
  const V = VIEWS[ui.view];
  $('#app').innerHTML = R('shell', {
    title: V.title, icon: V.icon, fab: ui.view === 'facturas',
    syncLabel: Store.mode === 'drive' ? 'En Drive' : 'Local',
    nav: Object.entries(VIEWS).map(([key, v]) => ({ key, icon: v.icon, label: v.short || v.title, active: key === ui.view }))
  });
  $('#menuBtn').onclick = openDrawer;
  $('#lockBtn').onclick = lock;
  $('#fab') && ($('#fab').onclick = openFabSheet);
  V.render();
}
/** Vuelve a dibujar sólo la vista actual (después de guardar algo). */
const rerender = () => VIEWS[ui.view].render();
function openDrawer() {
  const wrap = document.createElement('div');
  wrap.innerHTML = R('drawer', {
    appName: C.APP_NAME, view: ui.view, years: Object.keys(db.anuales).sort().reverse(),
    driveLink: Store.mode === 'drive' ? Store.folderLink() : ''
  });
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  $('.drawer-bg', wrap).onclick = close;
  $$('a', wrap).forEach(a => a.addEventListener('click', close));
  $('#dSet', wrap).onclick = () => { close(); openAjustes(); };
  $('#dLock', wrap).onclick = lock;
}


/* =========================================================================
   11. FACTURAS
   ========================================================================= */
/** Datos de la plantilla "factura-card" */
function cardVM(f) {
  const e = estadoFactura(f), d = desglose(f);
  return {
    id: f.id, seq: f.seq, ref: f.referencia || 'Sin referencia', metodo: f.metodoPago, desc: f.descripcion || '—',
    estadoLabel: ESTADOS[e].label, estadoCls: ESTADOS[e].cls, facturado: !!f.docs.facturaPdf?.watermarked,
    meta: [f.sede, f.cliente, f.folio && 'Folio ' + f.folio, 'Alta ' + fmtDate(f.createdAt)].filter(Boolean).join(' · '),
    total: f.total, subtotal: d.subtotal,
    tercerLabel: e === 'cobrado' ? 'Cobrado' : 'IVA', tercer: e === 'cobrado' ? f.montoCobrado : d.iva,
    steps: etapasHechas(f), sig: siguientePaso(f)
  };
}
/** Página principal: indicadores + tarjetas en el orden en que se agregaron. */
function renderFacturas() {
  const all = db.facturas;
  const cuenta = k => all.filter(f => estadoFactura(f) === k).length;
  const pend = all.filter(f => estadoFactura(f) === 'pendiente');
  const year = String(new Date().getFullYear());
  const cobradas = all.filter(f => estadoFactura(f) === 'cobrado' && (f.fechaCobro || f.updatedAt || '').startsWith(year));
  let list = all.filter(f => ui.filtro === 'todas' || estadoFactura(f) === ui.filtro);
  if (ui.q) {
    const q = ui.q.toLowerCase();
    list = list.filter(f => [f.seq, f.referencia, f.descripcion, f.sede, f.cliente, f.folio, f.uuid, f.notas, baseName(f)].join(' ').toLowerCase().includes(q));
  }
  list.sort((a, b) => ui.orden === 'asc' ? a.seq - b.seq : b.seq - a.seq);

  $('#view').innerHTML = R('vista-facturas', {
    k: {
      porCobrar: pend.reduce((s, f) => s + (f.total || 0), 0), nPend: pend.length, year,
      cobrado: cobradas.reduce((s, f) => s + (f.montoCobrado || 0), 0), cobradoSinIva: cobradas.reduce((s, f) => s + cobradoSinIva(f), 0),
      nPorFacturar: cuenta('porfacturar'), saldoDisp: saldoTotalDisp(), nSaldo: declsConSaldo().filter(r => saldoDisp(r) > 0).length
    },
    q: ui.q, ordenLabel: ui.orden === 'asc' ? '↑ Más antiguas' : '↓ Más recientes',
    chips: [['todas', 'Todas', all.length], ['porfacturar', 'Por facturar', cuenta('porfacturar')], ['pendiente', 'Pendientes de pago', cuenta('pendiente')],
      ['cobrado', 'Cobradas', cuenta('cobrado')], ['cancelada', 'Canceladas', cuenta('cancelada')]]
      .map(([k, label, count]) => ({ k, label, count, on: ui.filtro === k })),
    cards: list.map(cardVM), hayFacturas: all.length > 0
  });

  const q = $('#q');
  q.oninput = () => { ui.q = q.value; const pos = q.selectionStart; renderFacturas(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  $('#orden').onclick = () => { ui.orden = ui.orden === 'asc' ? 'desc' : 'asc'; renderFacturas(); };
  $$('[data-f]').forEach(b => b.onclick = () => { ui.filtro = b.dataset.f; renderFacturas(); });
  $$('.card').forEach(c => c.onclick = () => openFactura(db.facturas.find(x => x.id === c.dataset.id)));
  $('#emptyNew') && ($('#emptyNew').onclick = () => openFactura(null));
}
/** Menú del botón "+": nueva factura, desde XML o cargar complemento. */
function openFabSheet() {
  const m = openModal({ title: 'Agregar', body: R('fab-sheet') });
  $$('[data-a]', m.el).forEach(b => b.onclick = async () => {
    m.close();
    if (b.dataset.a === 'new') return openFactura(null);
    const file = await pickFile('.xml,text/xml,application/xml');
    if (!file) return;
    if (b.dataset.a === 'xml') return openFactura(null, { facturaXml: file });
    // Complemento: busca la factura cuyo UUID aparece en el XML del pago
    try {
      const x = CFDI.parse(await file.text());
      if (x.tipo !== 'P') return toast('Ese XML no es un complemento de pago (tipo P)', 'err');
      const uuids = x.pagos.flatMap(p => p.doctos.map(d => d.uuid));
      const f = db.facturas.find(f => f.uuid && uuids.includes(f.uuid.toUpperCase()));
      if (!f) return toast('No encontré la factura con UUID ' + (uuids[0] || '?') + '. Ábrela y súbelo manualmente.', 'err');
      if (uuids.length > 1) toast(`El complemento ampara ${uuids.length} facturas; se asignó a #${f.seq}.`);
      openFactura(f, { complementoXml: file });
    } catch (e) { handleErr(e); }
  });
}

/**
 * Sella un PDF con un texto diagonal en todas las páginas (pdf-lib).
 * @param {Blob} blob PDF original
 * @param {string} texto marca grande (ej. FACTURADO)
 * @param {string} sub leyenda pequeña arriba a la izquierda
 * @returns {Promise<Blob>} PDF nuevo
 */
async function marcarPdf(blob, texto, sub) {
  if (!window.PDFLib) throw new Error('No cargó la librería para la marca de agua');
  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
  const doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.78, 0.12, 0.12);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const ang = Math.atan2(height, width);  // sigue la diagonal de la hoja
    const size = Math.min(140, (Math.hypot(width, height) * 0.62) / font.widthOfTextAtSize(texto, 1));
    const tw = font.widthOfTextAtSize(texto, size), th = font.heightAtSize(size) * 0.7;
    page.drawText(texto, {   // centrado sobre la diagonal
      x: width / 2 - (tw / 2) * Math.cos(ang) + (th / 2) * Math.sin(ang),
      y: height / 2 - (tw / 2) * Math.sin(ang) - (th / 2) * Math.cos(ang),
      size, font, color, opacity: 0.2, rotate: degrees(ang * 180 / Math.PI)
    });
    if (sub) page.drawText(sub, { x: 22, y: height - 20, size: 8, font, color, opacity: 0.85 });
  }
  return new Blob([await doc.save()], { type: 'application/pdf' });
}
/**
 * Pone la marca FACTURADO cuando la factura ya tiene complemento, o la quita
 * si se eliminó el complemento. El PDF original se guarda como _ORIGINAL.
 */
async function sincronizarMarca(f) {
  const hayComplemento = !!(f.docs.complementoPdf || f.docs.complementoXml);
  const pdf = f.docs.facturaPdf;
  if (hayComplemento && pdf && !pdf.watermarked) {
    let marcado;
    try {
      const sub = `${C.WATERMARK_TEXT} · complemento de pago recibido${f.fechaCobro ? ' el ' + fmtDate(f.fechaCobro) : ''}${f.uuid ? ' · UUID ' + f.uuid : ''}`;
      marcado = await marcarPdf(await Store.getFile(pdf), C.WATERMARK_TEXT, sub);
    } catch (e) { toast('No pude poner la marca de agua: ' + e.message, 'err'); return; }
    await Store.renameFile(pdf, docName(f, 'facturaPdfOriginal', 'pdf'));
    const meta = await Store.putFile(marcado, docName(f, 'facturaPdf', 'pdf'), folderOf(f));
    Object.assign(meta, { watermarked: true, original: pdf.original });
    f.docs.facturaPdfOriginal = pdf;
    f.docs.facturaPdf = meta;
  } else if (!hayComplemento && pdf?.watermarked && f.docs.facturaPdfOriginal) {
    await Store.deleteFile(pdf).catch(() => {});
    f.docs.facturaPdf = f.docs.facturaPdfOriginal;
    f.docs.facturaPdfOriginal = null;
  }
}

/**
 * Formulario de factura (nueva o existente).
 * Los archivos elegidos quedan "pendientes" y se suben al pulsar Guardar.
 * @param {object|null} orig factura a editar (null = nueva)
 * @param {Object<string,File>} preload archivos a cargar al abrir (ej. complemento desde el "+")
 */
function openFactura(orig, preload = {}) {
  const isNew = !orig;
  const f = isNew ? nuevaFactura() : structuredClone(orig);   // se edita una copia
  const pending = {};                                          // key → File | 'REMOVE'
  const m = openModal({
    title: isNew ? 'Nueva factura' : `Factura #${f.seq} · ${f.referencia || 'sin referencia'}`, size: 'wide',
    body: R('factura-form', { f, isNew, sedes: [...new Set(db.facturas.map(x => x.sede).filter(Boolean))] }),
    footer: R('factura-footer', { isNew })
  });
  const form = $('#ff', m.el);
  const F = n => form.elements[n];

  /** Copia los valores del formulario a f */
  function readForm() {
    ['referencia', 'sede', 'descripcion', 'cliente', 'folio', 'fechaEmision', 'metodoPago', 'notas', 'fechaCobro'].forEach(k => f[k] = F(k).value.trim());
    ['rfcCliente', 'rfcEmisor', 'uuid'].forEach(k => f[k] = F(k).value.trim().toUpperCase());
    ['seq', 'total', 'ivaRate', 'retIsrRate', 'retIvaRate', 'subtotal', 'iva', 'retIsr', 'retIva', 'montoCobrado'].forEach(k => f[k] = num(F(k).value));
    f.seq = Math.round(f.seq);
    ['desgloseManual', 'pagadaSinComplemento', 'cancelada'].forEach(k => f[k] = F(k).checked);
  }
  /** Documentos como quedarán al guardar (para calcular el estado en vivo) */
  const docsEfectivos = () => Object.fromEntries(DOCS_F.map(({ key }) => [key, pending[key] === 'REMOVE' ? null : (pending[key] || f.docs[key])]));

  /**
   * Redibuja la lista de archivos. Sólo se llama cuando cambian archivos:
   * si se redibujara al salir de un campo, el clic en "Subir" se perdería.
   */
  function drawSlots() {
    $('#slots', m.el).innerHTML = R('slots', {
      slots: DOCS_F.map(d => {
        const meta = f.docs[d.key];
        const extra = d.key === 'facturaPdf' && meta?.watermarked && !pending[d.key]
          ? { note: `Con marca de agua ${C.WATERMARK_TEXT}`, extra: f.docs.facturaPdfOriginal ? { act: 'orig', label: 'Original' } : null } : {};
        return slotVM(d.key, `${d.etapa} · ${d.label}`, meta, pending[d.key], extra);
      })
    });
    refresh();
  }
  /** Actualiza etapas, nombre de archivo, desglose y estado mientras se escribe */
  function refresh() {
    readForm();
    const tmp = { ...f, docs: docsEfectivos() };
    const h = etapasHechas(tmp);
    $('#tl', m.el).innerHTML = R('factura-timeline', { etapas: ['Solicitud', 'Factura + XML', 'Cobrado'].map((t, i) => ({ t, n: i + 1, done: h[i] })) });
    $('#nombreArchivo', m.el).textContent = baseName(f) + '.pdf / .xml';
    $('#manual', m.el).hidden = !f.desgloseManual;
    if (!f.desgloseManual) {
      const c = calcDesglose(f.total, f.ivaRate, f.retIsrRate, f.retIvaRate);
      ['subtotal', 'iva', 'retIsr', 'retIva'].forEach(k => F(k).value = c[k].toFixed(2));
    }
    const d = desglose(f), suma = r2(d.subtotal + d.iva - d.retIsr - d.retIva);
    $('#calc', m.el).innerHTML = R('factura-calc', { ...d, suma, total: f.total, noCuadra: f.desgloseManual && Math.abs(suma - f.total) > 0.05 });
    const e = estadoFactura(tmp), falta = r2(f.total - f.montoCobrado);
    $('#cobroHint', m.el).innerHTML = R('factura-cobro', { ...ESTADOS[e], cobrado: f.montoCobrado > 0, sinIva: cobradoSinIva(f), falta: f.montoCobrado && falta > 0.05 ? falta : 0 });
  }
  /** Al elegir un archivo: queda pendiente; si es XML, se leen sus datos. */
  async function onFile(key, file) {
    pending[key] = file;
    if (extOf(file.name) === 'xml') {
      try {
        const x = CFDI.parse(await file.text());
        if (key === 'facturaXml') applyFacturaXml(x);
        if (key === 'complementoXml') applyComplementoXml(x);
      } catch (e) { toast('No pude leer el XML: ' + e.message, 'err'); }
    }
    drawSlots();
  }
  /** Llena el formulario con el XML de la factura (folio, UUID, importes…) */
  function applyFacturaXml(x) {
    if (x.tipo && x.tipo !== 'I') toast(`Ojo: el XML es tipo ${x.tipo}, no de ingreso (I).`, 'err');
    const set = (n, v) => { if (v) F(n).value = v; };
    set('folio', [x.serie, x.folio].filter(Boolean).join('-'));
    set('uuid', x.uuid); set('fechaEmision', x.fecha); set('cliente', x.receptorNombre);
    set('rfcCliente', x.receptorRfc); set('rfcEmisor', x.emisorRfc); set('metodoPago', x.metodoPago);
    if (!F('descripcion').value) set('descripcion', x.descripcion);
    if (x.total != null) {
      F('total').value = x.total;
      F('desgloseManual').checked = true;   // usa los importes exactos del XML
      F('subtotal').value = x.subtotal ?? 0; F('iva').value = x.iva; F('retIsr').value = x.retIsr; F('retIva').value = x.retIva;
      if (x.subtotal) {
        F('ivaRate').value = Math.round(x.iva / x.subtotal * 1e4) / 100;
        F('retIsrRate').value = Math.round(x.retIsr / x.subtotal * 1e6) / 1e4;
        F('retIvaRate').value = Math.round(x.retIva / x.subtotal * 1e6) / 1e4;
      }
    }
    toast('Datos leídos del XML de la factura', 'ok');
  }
  /** Llena monto y fecha de cobro con el complemento; avisa si no menciona esta factura */
  function applyComplementoXml(x) {
    if (x.tipo !== 'P') { toast('Ese XML no es un complemento de pago (tipo P)', 'err'); return; }
    const uuid = F('uuid').value.trim().toUpperCase();
    const p = uuid ? CFDI.pagoDeFactura(x, uuid) : null;
    if (uuid && !p) toast('El complemento no menciona el UUID de esta factura. Revisa que sea el correcto.', 'err');
    const pago = p || (x.pagos[0] ? { fecha: x.pagos[0].fecha, monto: x.pagos[0].monto } : null);
    if (pago) {
      F('montoCobrado').value = pago.monto ?? '';
      F('fechaCobro').value = pago.fecha || '';
      toast(`Pago leído: ${money(pago.monto)} el ${fmtDate(pago.fecha)}` + (p?.saldoInsoluto ? ` · saldo insoluto ${money(p.saldoInsoluto)}` : ''), 'ok');
    }
  }

  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  // Botones de porcentajes rápidos (IVA, ISR retenido, IVA retenido)
  $$('[data-pre]', m.el).forEach(b => b.onclick = () => {
    const [a, bb, c] = b.dataset.pre.split(',');
    F('ivaRate').value = a; F('retIsrRate').value = bb; F('retIvaRate').value = c; F('desgloseManual').checked = false; refresh();
  });
  // Botones de cada archivo: pick | view | orig | remove | undo
  $('#slots', m.el).addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const key = btn.closest('[data-slot]').dataset.slot;
    const def = DOCS_F.find(d => d.key === key), act = btn.dataset.act;
    if (act === 'pick') { const file = await pickFile(def.accept); if (file) onFile(key, file); }
    if (act === 'view') openViewer(pending[key] instanceof File ? pending[key] : f.docs[key]);
    if (act === 'orig') openViewer(f.docs.facturaPdfOriginal);
    if (act === 'remove') { if (f.docs[key]) pending[key] = 'REMOVE'; else delete pending[key]; drawSlots(); }
    if (act === 'undo') { delete pending[key]; drawSlots(); }
  });

  /*
   * Guardar:
   *  1. valida consecutivo único
   *  2. sube/borra los archivos pendientes
   *  3. renombra todos los archivos a 053_RFC_REF… (por si cambió la referencia)
   *  4. pone o quita la marca FACTURADO
   *  5. guarda db
   */
  $('#save', m.el).onclick = async () => {
    readForm();
    if (!f.referencia && !f.descripcion && !Object.keys(pending).length) return toast('Escribe al menos la referencia o sube un documento', 'err');
    if (!(f.seq > 0)) return toast('El número consecutivo debe ser mayor a 0', 'err');
    const dup = db.facturas.find(x => x.seq === f.seq && x.id !== f.id);
    if (dup) return toast(`El consecutivo ${f.seq} ya lo usa la factura ${dup.referencia || ''}`, 'err');
    if (!f.desgloseManual) Object.assign(f, calcDesglose(f.total, f.ivaRate, f.retIsrRate, f.retIvaRate));
    if (isNew) f.createdAt = new Date().toISOString();
    const keys = Object.keys(pending);
    const b = busy('Guardando…');
    try {
      let i = 0;
      for (const key of keys) {
        const p = pending[key];
        // si se reemplaza el PDF de la factura, también se descarta su original sin marca
        const viejos = key === 'facturaPdf' ? [f.docs.facturaPdf, f.docs.facturaPdfOriginal] : [f.docs[key]];
        if (p instanceof File) {
          b.set(`Subiendo archivo ${++i} de ${keys.length}…`);
          const meta = await Store.putFile(p, docName(f, key, extOf(p.name)), folderOf(f));
          meta.original = p.name;
          for (const v of viejos) if (v) await Store.deleteFile(v).catch(() => {});
          f.docs[key] = meta;
        } else if (p === 'REMOVE') {
          for (const v of viejos) if (v) await Store.deleteFile(v).catch(() => {});
          f.docs[key] = null;
        }
        if (key === 'facturaPdf') f.docs.facturaPdfOriginal = null;
      }
      b.set('Ordenando nombres…');
      for (const [key, meta] of Object.entries(f.docs)) {
        if (meta) await Store.renameFile(meta, docName(f, key, extOf(meta.name)));
      }
      b.set('Revisando marca de agua…');
      await sincronizarMarca(f);
      f.updatedAt = new Date().toISOString();
      if (isNew) db.facturas.push(f); else db.facturas[db.facturas.findIndex(x => x.id === f.id)] = f;
      db.seq = Math.max(db.seq, f.seq);
      await persist();
      b.done(); m.close(); renderShell();
      toast(isNew ? `Factura #${f.seq} guardada` : 'Cambios guardados', 'ok');
    } catch (e) {
      b.done();
      // si falló a medias, conserva la factura con lo que sí se subió
      if (isNew && keys.length && !db.facturas.includes(f)) { db.facturas.push(f); persist(); }
      handleErr(e);
    }
  };
  $('#del', m.el) && ($('#del', m.el).onclick = async () => {
    if (!await confirmar(`¿Eliminar la factura #${f.seq} y sus documentos? En Drive van a la papelera.`, 'Eliminar', true)) return;
    const b = busy('Eliminando…');
    try {
      for (const meta of Object.values(orig.docs)) if (meta) await Store.deleteFile(meta).catch(() => {});
      db.facturas = db.facturas.filter(x => x.id !== f.id);
      await persist(); m.close(); renderShell(); toast('Factura eliminada');
    } catch (e) { handleErr(e); } finally { b.done(); }
  });

  drawSlots();
  Object.entries(preload).forEach(([k, file]) => onFile(k, file));
}


/* =========================================================================
   12. SALDOS A FAVOR
   El saldo nace en una declaración mensual ("Saldo a favor de esta
   declaración") y se usa en declaraciones POSTERIORES. Mientras tenga
   disponible aparece en la pestaña Saldos con sus PDFs; al llegar a $0 sale
   de la lista y pasa al historial plegado.
   ========================================================================= */
/** "2025-12" → "2026-01" (el saldo sólo se usa a partir del mes siguiente) */
const mesSiguiente = p => { const [y, m] = p.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1, 2)}`; };
/** Datos de la plantilla "saldo-card" / "saldo-modal" para una declaración */
function saldoVM(r) {
  const monto = r.saldo.monto || 0, usado = saldoUsado(r), disp = saldoDisp(r);
  return {
    periodo: r.periodo, minMes: mesSiguiente(r.periodo), label: 'Declaración ' + fmtPeriodo(r.periodo), concepto: r.saldo.concepto, nota: r.saldo.nota,
    monto, usado, disp, agotado: disp <= 0, pct: monto ? Math.min(100, Math.round(usado / monto * 100)) : 0,
    hasDecl: !!r.docs.declaracion, hasVista: !!r.docs.vistaPrevia,
    usos: r.saldo.aplicaciones.map(a => ({ ...a, periodoLabel: fmtPeriodo(a.periodo), hasDecl: !!db.mensuales[a.periodo]?.docs?.declaracion }))
  };
}
function renderSaldos() {
  const list = declsConSaldo().map(saldoVM);
  const total = r2(list.reduce((s, x) => s + x.monto, 0)), usado = r2(list.reduce((s, x) => s + x.usado, 0));
  $('#view').innerHTML = R('vista-saldos', { total, usado, disp: r2(total - usado), activos: list.filter(x => !x.agotado), agotados: list.filter(x => x.agotado) });
  $('#usarSaldo') && ($('#usarSaldo').onclick = () => openUsarSaldo());
  $$('.saldo-card').forEach(card => card.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const r = db.mensuales[card.dataset.p];
    if (t.dataset.ver) return openViewer(r.docs[t.dataset.ver]);
    if (t.dataset.decl) return verDeclaracion(t.dataset.decl);
    if (t.hasAttribute('data-open')) return openMensual(r.periodo);
    if (t.hasAttribute('data-aplicar')) return openSaldo(r.periodo);
  }));
}
/** Abre el PDF de la declaración de un mes (o avisa si no está cargado). */
function verDeclaracion(periodo) {
  const d = db.mensuales[periodo]?.docs?.declaracion;
  if (d) openViewer(d); else toast('Aún no subes la declaración de ' + fmtPeriodo(periodo), 'err');
}
/** Registrar / quitar usos del saldo de UNA declaración. */
function openSaldo(periodo) {
  const r = db.mensuales[periodo];
  const m = openModal({ title: `Saldo a favor · ${fmtPeriodo(periodo)}`, body: '<div id="sb"></div>' });
  const draw = () => {
    const vm = saldoVM(r);
    $('#sb', m.el).innerHTML = R('saldo-modal', { ...vm, mes: thisMonth() > vm.minMes ? thisMonth() : vm.minMes });
    $('#apf', m.el) && ($('#apf', m.el).onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target), monto = r2(num(fd.get('monto'))), destino = fd.get('periodo');
      if (monto <= 0) return toast('Monto inválido', 'err');
      if (monto > saldoDisp(r) + 0.001) return toast('No puedes usar más de lo disponible', 'err');
      if (destino <= periodo) return toast('Sólo se puede usar en declaraciones posteriores a ' + fmtPeriodo(periodo), 'err');
      r.saldo.aplicaciones.push({ id: uid(), periodo: destino, monto, nota: fd.get('nota').trim(), fecha: today() });
      r.saldo.aplicaciones.sort((a, b) => a.periodo.localeCompare(b.periodo));
      await persist(); draw();
      toast(saldoDisp(r) <= 0 ? 'Uso registrado · saldo utilizado por completo' : 'Uso registrado', 'ok');
    });
    $$('[data-delap]', m.el).forEach(b => b.onclick = async () => {
      if (!await confirmar('¿Quitar este uso? El monto vuelve a quedar disponible.', 'Quitar', true)) return;
      r.saldo.aplicaciones = r.saldo.aplicaciones.filter(a => a.id !== b.dataset.delap);
      await persist(); draw();
    });
  };
  draw();
  m.el.addEventListener('closed', rerender);
}
/**
 * Reparte un monto entre declaraciones con saldo, de la más antigua a la
 * más nueva, sólo de meses ANTERIORES al de destino.
 * @returns {{filas:Array, faltante:number}}
 */
function repartoFIFO(monto, concepto, destino) {
  let resta = r2(monto);
  const filas = [];
  for (const r of declsConSaldo()) {
    if (resta <= 0) break;
    if (destino && r.periodo >= destino) continue;
    if (concepto && r.saldo.concepto !== concepto) continue;
    const disp = saldoDisp(r); if (disp <= 0) continue;
    const toma = r2(Math.min(disp, resta));
    filas.push({ r, label: 'Declaración ' + fmtPeriodo(r.periodo), concepto: r.saldo.concepto, toma, queda: r2(disp - toma) });
    resta = r2(resta - toma);
  }
  return { filas, faltante: resta > 0.001 ? resta : 0 };
}
/**
 * Usar saldo en una declaración tomando de varias (FIFO).
 * @param {string} [periodo] mes destino precargado
 * @param {Function} [onDone] qué hacer al terminar (por defecto redibuja)
 */
function openUsarSaldo(periodo, onDone) {
  const m = openModal({
    title: 'Usar saldo a favor',
    body: R('usar-saldo', { mes: periodo || thisMonth(), disp: saldoTotalDisp(), conceptos: [...new Set(declsConSaldo().filter(r => saldoDisp(r) > 0).map(r => r.saldo.concepto))] }),
    footer: R('footer-ok', { id: 'usOk', label: 'Registrar uso' })
  });
  const form = $('#usf', m.el);
  const prev = () => {
    const fd = new FormData(form);
    const res = repartoFIFO(num(fd.get('monto')), fd.get('concepto'), fd.get('periodo'));
    $('#usPrev', m.el).innerHTML = R('usar-preview', res);
    return res;
  };
  form.addEventListener('input', prev); form.addEventListener('change', prev); prev();
  $('#usOk', m.el).onclick = async () => {
    const fd = new FormData(form), res = prev();
    if (!fd.get('periodo')) return toast('Elige el mes de la declaración', 'err');
    if (!res.filas.length || res.faltante) return toast('No hay saldo suficiente para ese monto', 'err');
    const grupo = uid();  // une los usos que nacieron de un mismo registro
    res.filas.forEach(x => x.r.saldo.aplicaciones.push({ id: uid(), grupo, periodo: fd.get('periodo'), monto: x.toma, nota: fd.get('nota').trim(), fecha: today() }));
    await persist(); m.close(); toast(`Uso registrado en ${fmtPeriodo(fd.get('periodo'))}`, 'ok');
    onDone ? onDone() : rerender();
  };
}


/* =========================================================================
   13. DECLARACIONES MENSUALES
   ========================================================================= */
/** Calendario de 12 meses del año seleccionado. */
function renderMensuales() {
  const y = ui.year, now = thisMonth();
  const meses = MESES.map((nombre, i) => {
    const p = `${y}-${pad(i + 1, 2)}`, r = db.mensuales[p];
    return {
      p, nombre, futuro: p > now, est: r ? EST_MENS[r.estado] : null,
      decl: !!r?.docs?.declaracion, vista: !!r?.docs?.vistaPrevia, pagado: r?.totalPagado || 0,
      aFavor: r ? Math.max(0, saldoDisp(r)) : 0,
      usado: r2(aplicadosEn(p).reduce((s, a) => s + a.monto, 0))
    };
  });
  $('#view').innerHTML = R('vista-mensuales', {
    year: y, meses, saldoDisp: saldoTotalDisp(),
    presentadas: meses.filter(x => x.est && db.mensuales[x.p].estado !== 'pendiente').length,
    pagado: meses.reduce((s, x) => s + x.pagado, 0)
  });
  $('#yPrev').onclick = () => { ui.year--; renderMensuales(); };
  $('#yNext').onclick = () => { ui.year++; renderMensuales(); };
  $$('.month').forEach(el => el.onclick = () => openMensual(el.dataset.p));
}
/** Formulario de un mes: PDFs, importes, saldo generado y saldos usados. */
function openMensual(p) {
  const orig = db.mensuales[p];
  const r = orig ? structuredClone(orig) : nuevoMes(p);
  const pending = {};
  const DOCS = [{ key: 'declaracion', label: 'Declaración (PDF)', file: 'Declaracion' }, { key: 'vistaPrevia', label: 'Vista previa (PDF)', file: 'VistaPrevia' }];
  const m = openModal({
    title: 'Declaración ' + fmtPeriodo(p),
    body: R('mensual-form', {
      r, estados: Object.entries(EST_MENS).map(([k, v]) => ({ k, label: v.label, sel: r.estado === k })),
      conceptos: IMPUESTOS.map(v => ({ v, sel: r.saldo.concepto === v })),
      usosPropios: r.saldo.aplicaciones.map(a => ({ ...a, periodoLabel: fmtPeriodo(a.periodo) })),
      aplicadosAqui: aplicadosEn(p),
      hayDisp: repartoFIFO(0.01, '', p).filas.length > 0
    }),
    footer: R('mensual-footer', { existe: !!orig })
  });
  const drawSlots = () => $('#mslots', m.el).innerHTML = R('slots', { slots: DOCS.map(d => slotVM(d.key, d.label, r.docs[d.key], pending[d.key])) });
  drawSlots();
  $('#mslots', m.el).onclick = async e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const key = btn.closest('[data-slot]').dataset.slot, act = btn.dataset.act;
    if (act === 'pick') { const f = await pickFile('application/pdf,.pdf'); if (f) pending[key] = f; }
    if (act === 'view') return openViewer(pending[key] instanceof File ? pending[key] : r.docs[key]);
    if (act === 'remove') { if (r.docs[key]) pending[key] = 'REMOVE'; else delete pending[key]; }
    if (act === 'undo') delete pending[key];
    drawSlots();
  };
  $$('[data-origen]', m.el).forEach(b => b.onclick = () => verDeclaracion(b.dataset.origen));
  $('#mUsar', m.el) && ($('#mUsar', m.el).onclick = () => openUsarSaldo(p, () => { m.close(); openMensual(p); }));
  $('#msave', m.el).onclick = async () => {
    const fd = new FormData($('#mf', m.el));
    Object.assign(r, { estado: fd.get('estado'), fechaPresentacion: fd.get('fechaPresentacion'), isr: num(fd.get('isr')), iva: num(fd.get('iva')), totalPagado: num(fd.get('totalPagado')), notas: fd.get('notas').trim() });
    Object.assign(r.saldo, { monto: r2(num(fd.get('saldoMonto'))), concepto: fd.get('saldoConcepto'), nota: fd.get('saldoNota').trim() });
    if (r.saldo.monto < saldoUsado(r)) return toast(`El saldo a favor no puede ser menor a lo ya usado (${money(saldoUsado(r))})`, 'err');
    // los usos pueden haber cambiado mientras el formulario estaba abierto
    if (orig) r.saldo.aplicaciones = db.mensuales[p].saldo.aplicaciones;
    const b = busy('Guardando…');
    try {
      for (const [key, pv] of Object.entries(pending)) {
        if (pv instanceof File) {
          const meta = await Store.putFile(pv, `${p}_${DOCS.find(d => d.key === key).file}.pdf`, ['Declaraciones mensuales', p.slice(0, 4)]);
          meta.original = pv.name;
          if (r.docs[key]) await Store.deleteFile(r.docs[key]).catch(() => {});
          r.docs[key] = meta;
        } else if (pv === 'REMOVE') { await Store.deleteFile(r.docs[key]).catch(() => {}); r.docs[key] = null; }
      }
      if (r.estado === 'pendiente' && r.docs.declaracion) r.estado = 'presentada';
      db.mensuales[p] = r;
      await persist(); m.close(); rerender(); toast('Declaración guardada', 'ok');
    } catch (e) { handleErr(e); } finally { b.done(); }
  };
  $('#mdel', m.el) && ($('#mdel', m.el).onclick = async () => {
    if (saldoUsado(orig) > 0) return toast('Este mes tiene saldo a favor ya usado; quita primero esos usos en Saldos.', 'err');
    if (!await confirmar('¿Borrar los datos y PDFs de este mes?', 'Borrar', true)) return;
    for (const d of DOCS) if (orig.docs[d.key]) await Store.deleteFile(orig.docs[d.key]).catch(() => {});
    delete db.mensuales[p]; await persist(); m.close(); rerender();
  });
}


/* =========================================================================
   14. DECLARACIONES ANUALES
   ========================================================================= */
function renderAnuales() {
  if (ui.openYear === 'nuevo') { ui.openYear = null; history.replaceState(null, '', '#/anuales'); setTimeout(nuevoEjercicio); }
  const years = Object.keys(db.anuales).sort().reverse();
  $('#view').innerHTML = R('vista-anuales', {
    anios: years.map((y, i) => {
      const a = db.anuales[y];
      return {
        y, abierto: ui.openYear ? ui.openYear === y : i === 0, presentada: a.estado === 'presentada',
        resultado: RES_ANUAL[a.resultado] || '—', monto: a.monto, fecha: a.fechaPresentacion, notas: a.notas,
        docs: a.docs.map(d => ({ id: d.id, tipo: d.tipo, nombre: d.file.original || d.file.name, ext: extOf(d.file.name).toUpperCase() }))
      };
    })
  });
  ui.openYear = null;
  $('#addY').onclick = nuevoEjercicio;
  $$('[data-edit]').forEach(b => b.onclick = () => openAnual(b.dataset.edit));
  $$('[data-view]').forEach(b => b.onclick = () => { const [y, id] = b.dataset.view.split('|'); openViewer(db.anuales[y].docs.find(d => d.id === id).file); });
}
function nuevoEjercicio() {
  const m = openModal({ title: 'Agregar ejercicio', body: R('nuevo-ejercicio', { def: new Date().getFullYear() - 1 }), footer: R('footer-ok', { id: 'nyok', label: 'Agregar' }) });
  $('#nyok', m.el).onclick = async () => {
    const y = String(num($('#ny', m.el).value));
    if (!/^\d{4}$/.test(y)) return toast('Año inválido', 'err');
    if (!db.anuales[y]) { db.anuales[y] = { year: y, estado: 'pendiente', resultado: '', monto: 0, fechaPresentacion: '', notas: '', docs: [] }; await persist(); }
    m.close(); ui.openYear = y; renderAnuales(); openAnual(y);
  };
}
/** Formulario de ejercicio anual con lista libre de documentos. */
function openAnual(y) {
  const a = structuredClone(db.anuales[y]);
  const adds = [], removes = new Set();   // documentos nuevos / a quitar al guardar
  const m = openModal({
    title: 'Ejercicio ' + y,
    body: R('anual-form', { a, tipos: TIPOS_ANUAL, resultados: Object.entries(RES_ANUAL).map(([k, label]) => ({ k, label, sel: a.resultado === k })) }),
    footer: R('anual-footer')
  });
  const draw = () => {
    $('#adocs', m.el).innerHTML = R('anual-docs', {
      rows: [...a.docs.map(d => ({ id: d.id, tipo: d.tipo, nombre: d.file.original || d.file.name, quitar: removes.has(d.id) })),
        ...adds.map(d => ({ id: d.id, tipo: d.tipo, nombre: d.pend.name + ' · nuevo' }))]
    });
    $$('[data-v]', m.el).forEach(b => b.onclick = () => { const s = a.docs.find(d => d.id === b.dataset.v); openViewer(s ? s.file : adds.find(d => d.id === b.dataset.v).pend); });
    $$('[data-r]', m.el).forEach(b => b.onclick = () => {
      const id = b.dataset.r, ai = adds.findIndex(d => d.id === id);
      if (ai >= 0) adds.splice(ai, 1); else removes.has(id) ? removes.delete(id) : removes.add(id);
      draw();
    });
  };
  draw();
  $('#aadd', m.el).onclick = async () => { const f = await pickFile('application/pdf,.pdf,.xml'); if (f) { adds.push({ id: uid(), tipo: $('#atipo', m.el).value, pend: f }); draw(); } };
  $('#asave', m.el).onclick = async () => {
    const fd = new FormData($('#af', m.el));
    Object.assign(a, { estado: fd.get('estado'), fechaPresentacion: fd.get('fechaPresentacion'), resultado: fd.get('resultado'), monto: num(fd.get('monto')), notas: fd.get('notas').trim() });
    const b = busy('Guardando…');
    try {
      for (const d of a.docs.filter(d => removes.has(d.id))) await Store.deleteFile(d.file).catch(() => {});
      a.docs = a.docs.filter(d => !removes.has(d.id));
      for (const d of adds) {
        const meta = await Store.putFile(d.pend, `${y}_${cleanPart(d.tipo)}_${a.docs.length + 1}.${extOf(d.pend.name)}`, ['Declaraciones anuales', y]);
        meta.original = d.pend.name;
        a.docs.push({ id: d.id, tipo: d.tipo, file: meta });
      }
      db.anuales[y] = a; await persist(); m.close(); ui.openYear = y; renderAnuales(); toast('Ejercicio guardado', 'ok');
    } catch (e) { handleErr(e); } finally { b.done(); }
  };
  $('#adel', m.el).onclick = async () => {
    if (!await confirmar(`¿Eliminar el ejercicio ${y} y sus documentos?`, 'Eliminar', true)) return;
    for (const d of db.anuales[y].docs) await Store.deleteFile(d.file).catch(() => {});
    delete db.anuales[y]; await persist(); m.close(); renderAnuales();
  };
}


/* =========================================================================
   15. VISOR DE DOCUMENTOS
   PDF → se dibuja página por página con pdf.js (funciona en Android, donde
   el navegador no muestra PDF dentro de la página). XML → resumen + texto.
   ========================================================================= */
/** @param {File|object} src archivo pendiente (File) o meta guardado */
async function openViewer(src) {
  if (!src) return;
  const name = src.name;
  const m = openModal({
    title: name, size: 'full',
    body: '<div class="viewer" id="vw"><div class="spin" style="margin-top:40px"></div></div>',
    footer: R('viewer-footer', { link: src.link || '' })
  });
  let url;
  m.el.addEventListener('closed', () => url && setTimeout(() => URL.revokeObjectURL(url), 60000));
  try {
    const blob = src instanceof File ? src : await Store.getFile(src);
    url = URL.createObjectURL(blob);
    $('#vdl', m.el).href = url; $('#vdl', m.el).download = name; $('#vtab', m.el).href = url;
    const vw = $('#vw', m.el);
    if ((/pdf/.test(blob.type) || /\.pdf$/i.test(name)) && window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc ||= 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
      vw.innerHTML = '';
      const width = Math.min(vw.clientWidth - 24, 900);
      for (let i = 1; i <= pdf.numPages; i++) {
        if (!document.body.contains(vw)) return;   // se cerró el visor
        const page = await pdf.getPage(i);
        const scale = (width / page.getViewport({ scale: 1 }).width) * (window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale });
        const cv = document.createElement('canvas');
        cv.width = vp.width; cv.height = vp.height; cv.style.width = width + 'px';
        vw.appendChild(cv);
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      }
    } else if (/xml/.test(blob.type) || /\.xml$/i.test(name)) {
      const texto = await blob.text();
      let x = {};
      try { x = CFDI.parse(texto); } catch {}
      vw.innerHTML = R('xml-resumen', { ...x, tipoLabel: x.tipo === 'P' ? 'Complemento de pago' : x.tipo === 'I' ? 'Ingreso' : (x.tipo || '—'), texto: texto.replace(/></g, '>\n<') });
    } else if (/^image\//.test(blob.type)) {
      vw.innerHTML = `<img src="${url}" style="max-width:100%" alt="">`;
    } else {
      vw.innerHTML = '<p style="color:#fff">Vista previa no disponible. Usa “Descargar”.</p>';
    }
  } catch (e) {
    $('#vw', m.el).innerHTML = '<p style="color:#fff;padding:20px"></p>';
    $('#vw p', m.el).textContent = e.message;
    handleErr(e);
  }
}


/* =========================================================================
   16. AJUSTES, RESPALDO Y EXPORTACIÓN
   ========================================================================= */
function openAjustes() {
  const ejemplo = baseName({ seq: 53, rfcEmisor: C.RFC_EMISOR, referencia: '03124' });
  const m = openModal({ title: 'Ajustes y respaldos', body: R('ajustes', { drive: Store.mode === 'drive', driveAvailable: Store.driveAvailable(), minutos: C.AUTO_LOCK_MINUTES, ejemplo }) });
  $('#toDrive', m.el) && ($('#toDrive', m.el).onclick = async () => {
    Store.setMode('drive');
    try { await Store.connect(true); m.close(); const b = busy('Cargando…'); try { await loadData(); } finally { b.done(); } renderShell(); toast('Conectado a Drive', 'ok'); }
    catch (e) { Store.setMode('local'); handleErr(e); }
  });
  $('#toLocal', m.el) && ($('#toLocal', m.el).onclick = async () => {
    if (!await confirmar('Se cerrará la sesión de Drive en este navegador. Tus archivos siguen en Drive.', 'Desconectar')) return;
    Store.disconnect(); localStorage.removeItem('cf_mode'); location.reload();
  });
  // Generador del código para CONFIG.PASSWORD_SHA256
  $('#genHash', m.el).onclick = async () => {
    const pw = $('#newPw', m.el).value;
    if (!pw) return toast('Escribe la nueva contraseña', 'err');
    $('#hashOut', m.el).textContent = await sha256(pw);
  };
  $('#csv', m.el).onclick = exportCSV;
  $('#bk', m.el).onclick = () => download(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }), `respaldo-facturas-${today()}.json`);
  $('#rs', m.el).onclick = async () => {
    const f = await pickFile('.json,application/json'); if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.facturas)) throw new Error('Archivo de respaldo inválido');
      if (!await confirmar(`Se reemplazarán los datos actuales por el respaldo (${data.facturas.length} facturas).`, 'Restaurar', true)) return;
      db = migrar(Object.assign(emptyDB(), data)); await persist(); m.close(); renderShell(); toast('Respaldo restaurado', 'ok');
    } catch (e) { handleErr(e); }
  };
}
/** Descarga un Blob como archivo. */
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
/** Exporta las facturas a CSV (se abre en Excel con acentos correctos). */
function exportCSV() {
  const head = ['#', 'Archivo', 'Referencia contrato', 'Descripción', 'Sede', 'Cliente', 'RFC cliente', 'Folio', 'UUID', 'Fecha emisión', 'Método', 'Total', 'Subtotal sin IVA', 'IVA', 'ISR retenido', 'IVA retenido', 'Cobrado', 'Cobrado sin IVA', 'Fecha cobro', 'Estado', 'Fecha alta'];
  const rows = [...db.facturas].sort((a, b) => a.seq - b.seq).map(f => {
    const d = desglose(f);
    return [f.seq, baseName(f), f.referencia, f.descripcion, f.sede, f.cliente, f.rfcCliente, f.folio, f.uuid, f.fechaEmision, f.metodoPago, f.total, d.subtotal, d.iva, d.retIsr, d.retIva, f.montoCobrado, cobradoSinIva(f), f.fechaCobro, ESTADOS[estadoFactura(f)].label, (f.createdAt || '').slice(0, 10)];
  });
  const csv = [head, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `facturas-${today()}.csv`);
}


/* ---------- Inicio ---------- */
initLock();
})();
