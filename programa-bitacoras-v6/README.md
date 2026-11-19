# Programa de Bitácoras CCH — v6

**Versión:** v6 — 2026-11-19 (token de servicio limitado para Muse)
**Para:** Nequiz (CCH-UNAM)
**Carpeta del programa:** `./programa-bitacoras-v6/`

## Qué es el programa

Una sola página web para llevar **bitácoras y minutas de varios proyectos en paralelo**, con texto, imágenes y documentos de evidencia (PDF, Word, Excel), fecha actual por defecto, calendario, hitos y checklist de pendientes por proyecto.

Cada proyecto tiene su propia bitácora, ficha y carpeta en Google Drive. Nada se mezcla entre proyectos.

No hay proyectos precargados. Los proyectos se agregan desde **Mantenimiento → Agregar proyecto** y el índice central se actualiza automáticamente. Los seis registros heredados se ocultan de la interfaz, pero sus archivos de Drive se conservan.

Desde la página, agrega proyectos en **Mantenimiento → Agregar proyecto**. Por WhatsApp, `#nuevaBitacora` solo prepara una propuesta: Muse necesita tu autorización explícita antes de crearla, aunque tenga token de servicio.

## Arquitectura

```
┌─────────────────────────┐
│  Nequiz                 │
│  WhatsApp 1 a 1 (Muse)  │   Captura de hoy: reenviar la minuta
│  Navegador (GitHub      │   a Muse por WhatsApp. Muse es el puente.
│  Pages)                 │
└──────┬──────────┬───────┘
       │          │
       │          ▼
       │   ┌──────────────────────┐
       │   │  index.html          │
       │   │  GitHub Pages        │
       │   │  Un solo archivo,    │
       │   │  CSS/JS puros,       │
       │   │  fondo blanco        │
       │   │  #FFFFFF, azul UNAM  │
       │   │  #002663, dorado     │
       │   │  #C9A227             │
       │   └──────────┬───────────┘
       │              │ fetch (URL /exec)
       ▼              ▼
┌──────────────────────────────┐
│  Codigo.gs                   │
│  Apps Script Web App         │
│  (Execute as: Me)            │
│  Puente entre la página y    │
│  Drive. Controla el login    │
│  y el acceso a AppSheet.     │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Google Drive                │
│  Carpeta Bitacoras/          │
│  ├─ INDICE-bitacoras.json    │  Índice central
│  ├─ <slug>/bitacora.json     │  Datos de cada proyecto (JSON)
│  ├─ <slug>/Evidencias/       │  Imágenes y documentos de evidencia (PDF, Word, Excel; máx. 10 MB por archivo)
│  ├─ <slug>/Informes/         │  Informes Word (por proyecto)
│  └─ Hojas de cálculo         │  Bitacoras, Sesiones, Pendientes,
│     para AppSheet            │  Hitos, Puntaje
└──────────────────────────────┘
```

Los seis proyectos heredados se ocultan de la lista; sus carpetas y bitácoras
se conservan. Los proyectos nuevos se nombran `<ciclo>-<nombre>` (por ejemplo,
`20271-prueba`) y su carpeta se crea junto a la hoja de cálculo; el índice
central conserva su ID para localizarla.

**Lo que NO es la v1:** el bot de WhatsApp Business (Cloud API, número dedicado, webhook) es solo **v2**. En la v1 la captura es por WhatsApp 1 a 1 con Muse.

## Qué lleva cada carpeta / archivo de la entrega

La entrega vive en `~/workspace/goals/ordenar-mis-minutas-y-pendientes/files/`. El programa en sí (página + backend + estos dos documentos) va en la subcarpeta `programa-bitacoras-v1/`; los documentos de diseño y datos que lo acompañan quedan en `files/` y en `files/protocolo-puntaje-cch/`.

### En `programa-bitacoras-v1/`

| Archivo | Qué es |
|---|---|
| `index.html` | La interfaz completa en un solo archivo (CSS/JS puros, fondo blanco #FFFFFF). Se publica en GitHub Pages. La URL de Apps Script se pega en **un solo lugar**: `CONFIG.appsScriptUrl`. Sin URL, funciona en modo local. |
| `Codigo.gs` | El backend: Apps Script Web App. Lee y escribe en Drive, sirve los datos a la página, guarda la contraseña web (hash) en Script Properties y controla el acceso a AppSheet. |
| `README.md` | Este documento: qué es el programa, arquitectura y contenido de la entrega. |
| `CONFIGURACION.md` | Guía paso a paso para Nequiz: Drive, GitHub, Apps Script, contraseña, AppSheet y verificación final. |

### En `files/` (documentos de diseño y datos)

| Archivo / carpeta | Qué es |
|---|---|
| `checklist-bitacora-web.md` | Checklist de control del programa: **27 secciones** (§1–§27). Es el documento maestro de decisiones; nada se construye sin que el checklist lo apruebe. |
| `INDICE-bitacoras.json` | Índice dinámico de los proyectos creados desde la interfaz. Se actualiza automáticamente; inicia vacío. |
| `banco-peticiones.md` y `banco-peticiones.json` | Banco de peticiones **v3: 16 comandos** en CamelCase sin acentos (`#nuevaBitacora`, `#nuevaSesion`, `#verPendientes`, etc.). |
| `plantillas/` | Plantillas heredadas opcionales que se conservan como referencia; no crean proyectos ni se cargan automáticamente. |
| `formato-por-defecto.json` | Formato por defecto para cargar un formato específico por proyecto desde la interfaz (JSON por proyecto, se guarda como formato de ese proyecto y se usa al exportar). |
| `guia-configuracion-appsheet.md` | Guía de AppSheet (§26 del checklist): mismas hojas de Drive para la web y para AppSheet. |

### En `files/protocolo-puntaje-cch/`

Protocolo de puntaje CCH 2020 + Instructivo de Horarios 2023, con plantillas por rubro. Se guarda para enlazarlo a los proyectos: al terminar un proyecto se genera el reporte y se manda por correo o se exporta a PDF para imprimir, con las URLs de referencia en el reporte (flujo en `ENLACE-proyectos.md`, checklist §24).

| Archivo / carpeta | Qué es |
|---|---|
| `protocolo-puntaje-cch.json` (en `files/`) | Protocolo guardado verbatim: 158 actividades, 6 rubros. |
| `analisis-protocolo-puntaje-cch.md` (en `files/`) | Análisis del protocolo, usable como catálogo. |
| `protocolo-puntaje-cch-CORRECCIONES.md` | Correcciones pendientes: etiqueta `min_apoyo_investigacion` engañosa, falta condición de nivel mínimo y regla de no doble conteo. Cuadro real: 165 actividades (no 158 del JSON). |
| `INDICE-plantillas-rubro.md` | Índice de las plantillas por rubro. |
| `ENLACE-proyectos.md` | Cómo se enlaza el programa con los proyectos y cómo se genera el reporte al terminar un proyecto. |
| `plantillas-rubro/` | Una plantilla por rubro (I–VI) + lista jerarquizada: `rubro-I-apoyo-docencia.md`, `rubro-II-investigacion.md`, `rubro-III-formacion-profesores.md`, `rubro-IV-direccion-grupos.md`, `rubro-V-difusion-extension.md`, `rubro-VI-participacion-honoraria.md`, `lista-jerarquizada-horarios.md`. Cada una con machote de correo y de oficio, destinatarios y URLs oficiales. |

### Base común de cada sesión

Toda sesión lleva un cuadro de texto de siete filas para el contenido, acuerdos en texto (uno por línea), asistentes y evidencias. El texto se puede prellenar con cuatro opciones editables: General, Acuerdos, Ejercicios y Seguimiento. Los campos específicos heredados se conservan en registros viejos, pero ya no aparecen en el formulario.

### Formato de documentos

Máster en texto plano (Markdown/JSON) en Drive y GitHub. Google Docs o Word solo como versión para leer, compartir o imprimir, generada desde el máster, nunca editada como máster.

### Login y mantenimiento

- **Login web** con contraseña aparte, guardada como **hash SHA-256 con sal** en Apps Script Properties, **nunca en el HTML** (checklist §25). El bloqueo tras 5 fallos es **por cliente**, no global: un visitante no puede bloquear al dueño (Apps Script no expone la IP; el identificador lo genera la página y viaja en el login; alguien que lo rote podría eludirlo, queda documentado como mitigación, no como garantía). Al cargar, la página valida el token contra el backend (`validarSesion`); el bloqueo de la interfaz por sí solo **no es seguridad**, el backend valida el token en cada llamada.
- **Token de servicio Muse:** `generarTokenServicioMuse()` crea un token aleatorio, guarda solo su hash con sal en Script Properties (`MUSE_SERVICE_TOKEN_HASH`) y lo muestra una vez en los logs de Apps Script. No se incluye en `index.html` ni en archivos del repositorio. Reemplazarlo con uno nuevo invalida el anterior; `revocarTokenServicioMuse()` lo invalida de inmediato.
- **Sesiones independientes:** el token web sigue expirando a las **6 horas** y se invalida con la época al cambiar la contraseña. El token de servicio no usa esa época ni caduca por tiempo; solo se invalida al revocarlo o reemplazarlo.
- **Alcance de Muse:** permite `leer`, `leerProyecto`, `guardarSesion`, `guardarPendiente`, `cerrarPendiente`, `guardarHito`, `subirEvidencia`, `crearProyecto`, `guardar`, `verEvidencia` y `registrarPuntaje`. Rechaza cualquier otra acción; no permite login, cambio de contraseña, crear/verificar estructura, cambiar ciclo, ni las acciones dedicadas para editar o borrar sesiones/hitos. Su `guardar` de sincronización fusiona por ID; conserva registros y elementos de arreglos omitidos, así como propiedades ausentes, nulas o vacías, evitando el borrado de datos por sincronización.
- **Escrituras con `LockService`:** dos guardados simultáneos no se pisan en `bitacora.json` ni en las hojas.
- **Mantenimiento** (§24): crear tablas y hojas de Drive desde cero; «Verificar estructura» llama de verdad a `verificarEstructura` y muestra los faltantes.
- **Proyectos dinámicos:** en Mantenimiento puedes agregar un proyecto con nombre y color. En modo local queda guardado en este navegador; con Apps Script se registra en Drive junto a la hoja de cálculo, con nombre `<ciclo>-<nombre>` (el folio consecutivo sigue siendo independiente). No hace falta editar `INDICE-bitacoras.json` manualmente. Para activar los cambios publicados, actualiza `index.html` en GitHub Pages y `Codigo.gs` en Apps Script; este último requiere una nueva versión del despliegue.
- **Sin datos precargados:** la página ya no crea sesiones de demostración al abrirse. Los archivos JSON de simulación también se retiraron; los registros heredados marcados como ejemplo se pueden limpiar desde Mantenimiento.
- **AppSheet** (§26): acceso controlado desde Apps Script (`CUENTAS_AUTORIZADAS_APPSHEET` + acción `verificarAppSheet`) / cuenta Google; usa las mismas hojas de Drive que la web.
- **Evidencias e informes privados (M11):** los archivos subidos a Drive son privados del dueño; sus enlaces `/view` solo los abre la cuenta propietaria. Para que alguien más los vea, hay que compartirle la carpeta `<slug>/Evidencias/` o `<slug>/Informes/` desde Drive; el programa no cambia permisos automáticamente.
- **Colores (M14):** cada proyecto nuevo guarda su propio color en el índice central. Los colores de los registros heredados se conservan en su archivo de Drive.
- **Proyectos heredados:** los seis proyectos de demostración se retiraron de la lista activa. Sus carpetas y bitácoras se conservan; al crear el siguiente proyecto, sus entradas del índice se guardan como archivadas.

## Pasos que Nequiz hará él en Drive y GitHub (resumen)

Nequiz se encarga él mismo de configurar Drive y GitHub. El detalle paso a paso está en [`CONFIGURACION.md`](CONFIGURACION.md).

1. **Drive:** crear la carpeta `Bitacoras/` y subir los archivos de esta entrega donde indica la guía.
2. **GitHub:** crear el repositorio (nombre a elegir; sugerencia: `bitacoras`), subir **solo** `index.html` y `protocolo-puntaje-cch-v2.json` a la raíz o a `docs/`, activar GitHub Pages. Para actualizar la interfaz, publica el nuevo `index.html`.
3. **Apps Script:** crear el proyecto, pegar `Codigo.gs`, desplegar como Web App (Execute as: Me) y copiar la URL `/exec`. Al cambiar el backend, publica una nueva versión de la implementación.
4. **Pegar la URL en un solo lugar:** `CONFIG.appsScriptUrl` dentro de `index.html`.
5. **Contraseña web:** fijarla en Apps Script Properties con la función indicada en `Codigo.gs` (nunca en el HTML).
6. **AppSheet:** conectarlo a las hojas de Drive según `guia-configuracion-appsheet.md`.
7. **Verificación final:** abrir la página, entrar con la contraseña, crear una sesión y sincronizar.

> No hay URLs ni contraseñas reales en esta entrega. En todos los archivos se usan los placeholders exactos `TU_URL_APPS_SCRIPT_AQUI`, `TU_CONTRASENA_AQUI` y `TU_REPO_AQUI` (ver tabla en `CONFIGURACION.md`).

## Integración página ↔ Apps Script (corrección C1–C5, 2026-11-18)

La auditoría de la v1 encontró que la página y el backend no estaban integrados. Quedó corregido así:

- **C1 — CORS:** `index.html` llama a Apps Script con `Content-Type: text/plain` (fetch simple, sin preflight). El `application/json` anterior disparaba un preflight que Apps Script no responde.
- **C2 — Token:** `enviarAppsScript()` incluye el token de sesión en el body en todas las acciones salvo `login` y `ping`. El backend lo exige para toda escritura.
- **C3 — Sincronización página → Drive:** crear una sesión llama a `guardarSesion`; crear un pendiente desde un acuerdo llama a `guardarPendiente`; marcar hecho llama a `cerrarPendiente`; crear un hito llama a `guardarHito`; editar o borrar una sesión sincroniza la bitácora completa con `guardar`. Sin URL de Apps Script, todo sigue funcionando en localStorage y la página lo indica.
- **C3b — Sincronización Drive → página:** `cargarDatos()` mapea la respuesta real de `leer` (`{indice, proyectos:[{slug, hashtag, nombre, bitacora}]}`) a sesiones, pendientes e hitos. Desde la corrección A1 ya no hay traducción de nombres: página y backend usan el mismo diccionario (`slug`, `sesion_id`, `fecha_compromiso`, `minuta_origen`, estado `Cerrado`). Al iniciar sesión, la página recarga los datos de Drive.
- **C4 — Parámetros:** los nombres del **backend** mandan y la página los usa: `subirEvidencia` con `{slug, nombre, base64, mime}`, `guardarFormato` con `{slug, formato}` y `cambiarPassword` con `{passwordActual, passwordNueva}`.
- **C5 — Lectura protegida:** `leer`, `leerProyecto` y `verificarEstructura` exigen token válido (`?token=...` en GET). Sin sesión, la página no intenta leer de Drive y muestra el login. La URL `/exec` sigue visible en el `index.html` público, pero sin token no devuelve ningún dato.

Pendiente (no es de este turno): nada de la auditoría; D1–D12 y M1–M15 se corrigieron en la sección siguiente. Ver `AUDITORIA-validacion.md` §10.

## Diccionario único de campos y estados (corrección A1–A7, 2026-11-18)

Un solo modelo en página, backend, hojas y formatos; ya no hay traducción parcial. Los nombres del **backend** mandan:

| Objeto | Campos | Estados |
|---|---|---|
| Sesión | `id, slug, fecha, titulo, tipo, texto, asistentes, acuerdos:[texto], evidencias:[{url, pie, nombre, mime, tipo, tamano, agregada_en}], campos, plantilla_version` | El formulario admite `Online`; cada acuerdo nuevo es solo texto, sin responsable ni fecha. |
| Pendiente | `id, sesion_id, slug, texto, responsable, fecha_compromiso, prioridad, estado, fecha_cierre, minuta_origen, notas` | `Pendiente` / `En proceso` / `Cerrado` (nunca `Hecho`; `Vencido` es solo un cálculo por fecha, no un estado guardado) |
| Hito | `id, slug, titulo, fecha, descripcion, estado, fecha_cierre` | `Pendiente` / `En curso` / `Cerrado` (nunca `completado`); la barra de avance cuenta `Cerrado` |
| Evidencia | `url, pie, nombre, mime, tipo, tamano` | `tipo` es `imagen` o `documento` (v2: también PDF, Word y Excel, máx. 10 MB por archivo); `url` es la URL de Drive o, en modo local, el base64; nunca `dataUrl`. Las evidencias viejas `{url, pie}` se normalizan al leer (en v1 solo había imágenes). En modo local, los documentos quedan como base64 en localStorage y ocupan espacio (~4 MB de aviso, ~5 MB de límite). |
| Formato | `nombre, formato_version, secciones:[{titulo, campos}]` | Al cargar se aceptan las variantes viejas (`nombre` de sección, `version`) y se normalizan a `titulo` / `formato_version` |

- **A2 — Fecha local:** la fecha por defecto es hora local (`ahoraLocalISO()`, America/Mexico_City); `toISOString()` (UTC) ya no se usa para fechas por defecto.
- **A3 — Sin fecha inventada:** un acuerdo sin fecha genera un pendiente con `fecha_compromiso` vacío, que se muestra como «sin fecha» y nunca sale como vencido.
- **A5 — Informe por campos:** cada sección se renderiza según sus `campos`; sin formato propio, usa «Información» y después bitácoras cronológicas con contenido y evidencias.
- **A6 — Sin crash:** los filtros usan `(p.responsable || '').toLowerCase()`; un responsable nulo ya no rompe la lista.
- **A7 — localStorage:** con Apps Script, las evidencias (imágenes y documentos) se suben a Drive y en local solo queda su URL; sin Apps Script se mide el tamaño real y se avisa a partir de ~4 MB (límite ~5 MB).
- **v2 — Documentos como evidencia:** además de imágenes, se aceptan PDF, Word (`.doc`, `.docx`) y Excel (`.xls`, `.xlsx`) como evidencia, máx. 10 MB por archivo. Las imágenes se siguen comprimiendo a máx. 1200 px (JPG); los documentos se guardan tal cual, con su nombre original y su mime real, en `<slug>/Evidencias/`. En la tarjeta y en el informe aparecen como ficha/enlace con su nombre, no como imagen.
- **Reporte sin plantilla:** empieza con la sección «Información» y después presenta cada bitácora por fecha, con su contenido y evidencias. Las evidencias nuevas se ordenan por el momento en que se adjuntaron; las antiguas, sin marca de tiempo, mantienen su orden original. Las imágenes de Drive se incrustan en Word cuando pueden leerse con la sesión iniciada; no se añadió una dependencia CDN.

## Correcciones D1–D12 y M1–M15 (2026-11-18)

Decisiones tomadas en los puntos donde la auditoría daba a elegir:

- **D4 — Sin IDs de Drive:** `Codigo.gs` trabaja **por nombre** de carpeta y archivo, no por ID. Se quitaron de `CONFIGURACION.md` los pasos de anotar IDs y de ponerlos en constantes: no hay dónde ponerlos y no hacen falta.
- **D7 — Word en Drive (implementado):** el botón Word ya no es solo una descarga. Con Apps Script, el informe se sube con la acción `subirInforme` a `<slug>/Informes/` y **sobrescribe** el archivo del mismo nombre (`informe-<slug>.doc`). Sin conexión o si la subida falla, se descarga en el navegador y la página lo dice.
- **M1 — Bloqueo por cliente:** ver «Login y mantenimiento» arriba.
- **M7 — Puntaje con interfaz:** la página ya tiene el botón «Registrar puntaje» (rubro, actividad, nivel con puntos automáticos A=25 / B=50 / C=150, alcance, constancia, periodo y categoría objetivo) que llama a `registrarPuntaje` y muestra el total en el panel «Puntaje registrado».
- **M11 — Evidencias privadas:** solo se documenta (ver arriba); no se cambian permisos sin avisar.
- **M6 — Hitos editables:** cada hito tiene ahora Editar, Completar (estado `Cerrado`) y Borrar, con las acciones `editarHito` / `eliminarHito` en el backend.
- **M8 — Plantillas:** al abrir «Nueva sesión» la página carga el texto inicial de la plantilla del proyecto (`leerProyecto`); los cuatro prellenados disponibles se pueden editar en el mismo cuadro de texto.
- **M9 — Contador «Todos»:** la clase (color) del contador usa el conteo real de pendientes abiertos, no el 0 de antes.
- **M10 — Login:** el mensaje de error es el que devuelve el backend (bloqueo, contraseña no fijada, etc.), no siempre «Contraseña incorrecta».
- **M12 — Verificar:** Mantenimiento → «Verificar estructura» llama a `verificarEstructura` y lista los faltantes.
- **M15 — Líneas de `Codigo.gs`:** la cifra 1 329 era falsa; el archivo tenía 1 259 líneas antes de las correcciones y tiene más ahora por el código añadido (ver `wc -l` al final de cada entrega; no se fija una cifra en este documento para que no vuelva a quedar desactualizada).

Pendiente tras este turno: nada de la auditoría. Queda sin probar contra un Apps Script/Drive real (no hay URL desplegada); la prueba fue en jsdom con Apps Script simulado.

## Cómo probar la v1

Probar en este orden, con la página ya publicada y la URL de Apps Script puesta en `index.html`:

1. **Crear sesión con fecha actual:** abrir la página, crear un proyecto desde Mantenimiento, elegirlo, crear una sesión nueva y comprobar que aparece en su lista.
2. **Acuerdo → pendiente:** en la sesión, escribir un acuerdo con responsable y fecha y pulsar «→ Pendiente». Comprobar que aparece en el checklist de pendientes del proyecto, con su responsable y su fecha, y que también quedó guardado en Drive (recargar la página: el pendiente debe seguir ahí). Si se pulsa «→ Pendiente» dos veces sobre el mismo acuerdo, solo se crea un pendiente (no se duplica).
3. **Marcar hecho:** marcar ese pendiente como hecho. Comprobar que cambia de estado y que ya no sale en los pendientes abiertos, y que tras recargar sigue marcado como hecho (se sincronizó con Drive con `cerrarPendiente`).
4. **Calendario:** abrir el calendario y comprobar que en la cuadrícula de cada día aparecen la sesión (●), el hito (◆) y los pendientes con fecha de ese día (•, y ⚠ en rojo si están vencidos); al hacer clic en el día se ve el detalle completo.
5. **Exportar JSON/CSV:** exportar la bitácora del proyecto en JSON y en CSV. El **JSON** trae todo (sesiones, pendientes e hitos de todos los proyectos); el **CSV** trae solo los pendientes, con las columnas Acción | Responsable | Fecha compromiso | Estado | Minuta origen | Notas. El Word, con Apps Script, se guarda en Drive en `<slug>/Informes/` sobrescribiendo el archivo del mismo nombre; sin conexión se descarga en el navegador.
6. **Login / mantenimiento bloqueado sin sesión:** cerrar la sesión (o abrir la página en incógnito), intentar entrar a mantenimiento sin haber hecho login. Debe quedar bloqueado; con la contraseña correcta, debe dejar entrar.
7. **Modo local sin URL:** quitar temporalmente la URL de Apps Script de `index.html` (dejar `CONFIG.appsScriptUrl` vacía) y recargar. La página sigue abriendo en modo local, pero es de **solo lectura salvo ver el ejemplo**: sin URL no se puede iniciar sesión y, sin sesión, crear, editar, borrar, exportar y Mantenimiento están bloqueados. Solo se ve la sesión de ejemplo sembrada. Volver a poner la URL al terminar la prueba.

Si alguna prueba falla, anotar qué proyecto, qué paso y qué mensaje apareció, y no seguir con la siguiente hasta revisarla.

## Qué NO lleva la v1

- **Sin contraseñas reales.** Solo el placeholder `TU_CONTRASENA_AQUI`; la contraseña real se fija en Apps Script Properties, nunca en el HTML.
- **Sin URLs reales.** Solo el placeholder `TU_URL_APPS_SCRIPT_AQUI`; la URL real es la `/exec` del despliegue de cada quien.
- **Sin puente automático de WhatsApp.** No hay webhook ni Cloud API. El token habilita llamadas autorizadas de Muse al Web App, pero no automatiza la recepción de mensajes.
- **Entrega segura del token:** no lo escribas en chats, HTML, JSON, README ni checklist. Cópialo de los logs al generarlo y entrégalo a Muse solo por el mecanismo seguro configurado.

## Versión

**v6 — 2026-11-19.** Token de servicio Muse almacenado solo como hash con sal, con acciones permitidas explícitas, rechazo por lista permitida y revocación independiente de la sesión web de 6 horas. v5 vació el catálogo inicial y ocultó los registros heredados sin borrar sus datos.
