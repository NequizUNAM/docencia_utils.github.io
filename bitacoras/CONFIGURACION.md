# Configuración del Programa de Bitácoras CCH — v1

**Versión:** v1 — 2026-11-18
**Para:** Nequiz (CCH-UNAM)

Guía corta y concreta para dejar la v1 funcionando. Nequiz hace estos pasos él mismo, con su propia cuenta de Google y su propia cuenta de GitHub.

Resumen del programa en [`README.md`](README.md). El checklist de decisiones (27 secciones) está en `../checklist-bitacora-web.md` y la guía de AppSheet en `../guia-configuracion-appsheet.md`.

> **Placeholders:** en esta entrega no hay URLs ni contraseñas reales. Donde veas `TU_URL_APPS_SCRIPT_AQUI`, `TU_CONTRASENA_AQUI` o `TU_REPO_AQUI`, pon tu valor real. La tabla completa está al final de esta guía.

---

## 1) En Drive: crear la carpeta `Bitacoras/` y subir los archivos

1. Abre [Google Drive](https://drive.google.com) con tu cuenta de Google.
2. Crea una carpeta llamada **`Bitacoras`** en la raíz de tu Drive.
3. Dentro de `Bitacoras/`, NO crees una carpeta `Evidencias/` global (D3): cada proyecto tiene su propia carpeta `<slug>/Evidencias/` (por ejemplo `Bitacoras/estadistica-2/Evidencias/`). Se crean solas con Mantenimiento → «Crear estructura desde cero», o con la acción `crearEstructura` de Apps Script; si las creas a mano, crea una por proyecto.
4. Sube a `Bitacoras/` estos archivos de esta entrega:
   - `INDICE-bitacoras.json` → en `Bitacoras/`
   - `banco-peticiones.json` → en `Bitacoras/` (referencia; no lo edita la página)
   - Las 6 plantillas de `plantillas/` → **una en cada carpeta de proyecto** (D2): `estadistica-1-plantilla-sesion.json` en `Bitacoras/estadistica-1/`, `estadistica-2-plantilla-sesion.json` en `Bitacoras/estadistica-2/`, y así con `cch-page`, `control-facturas`, `asistencia-cch` y `moodle-dgtic` (cada una como `<slug>/plantilla-sesion.json`).
   - `formato-por-defecto.json` → como formato inicial de cada proyecto, en `<slug>/formato-exportacion.json` (uno por proyecto; si ya existe uno, no lo sobrescribas).
5. **No crees un `bitacoras.json` único en `Bitacoras/`** (D1): el código nunca lee ese archivo. Cada proyecto tiene su propio `<slug>/bitacora.json` (por ejemplo `Bitacoras/estadistica-2/bitacora.json`), que se crea solo con Mantenimiento → «Crear estructura desde cero» o con la acción `crearEstructura`. El índice central es `INDICE-bitacoras.json` y las bitácoras viven por proyecto.
6. Crea **una hoja de cálculo por cada una** de estas 5 hojas (la hoja `Firmas` ya no existe: las firmas diarias se quitaron del programa) (pueden estar en un solo libro o en libros separados; lo recomendado es un solo libro llamado `Bitacoras`):
   - `Bitacoras`
   - `Sesiones`
   - `Pendientes`
   - `Hitos`
   - `Puntaje`
   
   Cada hoja lleva sus columnas según `../guia-configuracion-appsheet.md` (mismas hojas para la web y para AppSheet). No hace falta llenarlas: se llenan solas al usar la página.
7. No necesitas anotar ningún ID de Drive (D4): `Codigo.gs` trabaja **por nombre** de carpeta y archivo (`getFoldersByName` / `getFilesByName`), no por ID. No hay constantes de ID donde ponerlos. Si en Drive hay dos carpetas con el mismo nombre, usa la primera que encuentre el código: evita duplicar nombres.

> **Nota (M11):** los archivos que se suben a Drive (evidencias e informes Word) son **privados del dueño** por defecto: sus enlaces `/view` solo los abre la cuenta propietaria. Si alguien más debe ver las fotos o los informes, comparte con esa persona la carpeta `<slug>/Evidencias/` o `<slug>/Informes/` desde Drive. No se cambian permisos automáticamente.

> **Nota (v2 — documentos como evidencia):** además de imágenes, cada sesión acepta PDF, Word (`.doc`, `.docx`) y Excel (`.xls`, `.xlsx`) como evidencia, **máx. 10 MB por archivo**. Las imágenes se comprimen a máx. 1200 px (JPG); los documentos se guardan tal cual, con su nombre original, en `<slug>/Evidencias/`. En modo local (sin Apps Script) los documentos quedan como base64 en localStorage: un solo PDF grande puede llenar el límite de ~5 MB, así que en ese modo conviene subirlos a Drive cuanto antes.

## 2) En GitHub: crear el repo y activar Pages

1. Abre [GitHub](https://github.com) con tu cuenta.
2. Crea un repositorio nuevo. **Nombre a elegir; sugerencia: `bitacoras`**. Puedes ponerle el nombre que quieras; en esta guía se usa `TU_REPO_AQUI` como placeholder.
   - Visibilidad: público (necesario para GitHub Pages gratuito) o privado con Pages habilitado según tu plan.
3. Sube **solo `index.html` y `protocolo-puntaje-cch-v2.json`** a la raíz del repo (o a la carpeta `docs/` si prefieres esa opción; elige una, no las dos). Auditoría v2, Paso 7g: el resto de la carpeta (checklist, análisis, auditorías, plantillas) es documentación interna y NO se publica.
4. Activa GitHub Pages:
   - Ve a **Settings → Pages**.
   - En **Source**, elige la rama principal (`main`) y la carpeta donde subiste `index.html` (raíz `/` o `/docs`, según el paso anterior).
   - Guarda. GitHub te dará la URL de la página, con la forma `https://TU_USUARIO.github.io/TU_REPO_AQUI/`.
5. Espera 1–2 minutos y abre esa URL para comprobar que la página carga (aunque todavía no tenga la URL de Apps Script, debe abrir en modo local).

## 3) En Apps Script: crear el proyecto, pegar `Codigo.gs` y desplegar

1. Abre [Apps Script](https://script.google.com) con la **misma cuenta de Google** que usaste en Drive.
2. Crea un proyecto nuevo y ponle el nombre que quieras (sugerencia: `Bitacoras CCH`).
3. Borra el contenido de `Code.gs` y pega el contenido completo de **`Codigo.gs`** de esta entrega.
4. En `Codigo.gs` no hay que poner ningún ID de Drive (D4): el código busca la carpeta `Bitacoras/`, las carpetas de proyecto y el libro por su **nombre**. Solo revisa que los nombres coincidan con los del paso 1 (`Bitacoras` y libro `Bitacoras`).
5. Guarda el proyecto (icono de disquete o `Ctrl + S`).
6. Despliega como Web App:
   - Haz clic en **Deploy → New deployment**.
   - Tipo: **Web app**.
   - **Execute as: Me** (tu cuenta).
   - **Who has access:** Anyone (cualquiera con el enlace) o según lo que indique `Codigo.gs`; la página es la que llama a la app, no los usuarios directamente.
   - Haz clic en **Deploy** y autoriza los permisos de Drive y de las hojas cuando Google lo pida.
7. Copia la URL que termina en **`/exec`**. Esa es la URL del backend. Es la que vas a pegar en el paso siguiente.
8. Cada vez que modifiques `Codigo.gs`, **edita el despliegue existente** (D6): Deploy → Manage deployments → ✎ (editar el despliegue) → **New version**. NO crees un despliegue nuevo: un despliegue nuevo genera otra URL `/exec` y tendrías que volver a pegarla en `index.html`; editar el existente conserva la misma URL.

## 4) Pegar la URL en UN solo lugar: `index.html`

1. Abre `index.html` (el archivo de tu repo local, o edítalo en GitHub).
2. Busca el objeto `CONFIG` y pon la URL del paso 3 en **ese único lugar**:
   ```js
   const CONFIG = {
     appsScriptUrl: "TU_URL_APPS_SCRIPT_AQUI"
   };
   ```
   Es decir, sustituye `TU_URL_APPS_SCRIPT_AQUI` por tu URL `/exec` real.
3. **No pegues la URL en ningún otro archivo.** Solo aquí.
4. Sube el `index.html` actualizado al repo (commit y push, o súbelo en la web de GitHub). Espera 1–2 minutos a que Pages se actualice.
5. Sin URL (con `appsScriptUrl` vacía), la página funciona en **modo local**: guarda en el navegador sin sincronizar con Drive. Con la URL puesta, sincroniza con Drive a través de Apps Script.

## 5) Contraseña web: fijarla en Apps Script Properties (nunca en el HTML)

La página tiene login con contraseña aparte. La contraseña **nunca va en el HTML**.

1. En el proyecto de Apps Script del paso 3, abre el editor y busca en `Codigo.gs` la función indicada para fijar la contraseña (la función que guarda el hash en Script Properties).
2. Ejecuta **una sola vez** la función `fijarPasswordWebTemporal()` (D5): en el editor, en la lista de funciones, elige `fijarPasswordWebTemporal` (sin argumentos: el botón Ejecutar del editor no admite argumentos) y pulsa Ejecutar. Antes, pon tu contraseña en la línea `NUEVA_CONTRASENA = 'TU_CONTRASENA_AQUI'` dentro de esa función (mínimo 12 caracteres, auditoría v2).
   - La función guarda solo el **hash con sal** en **Script Properties**; la contraseña en texto plano no queda guardada en ningún archivo.
   - **Después de ejecutarla, BORRA la contraseña de esa función** (o borra toda la función `fijarPasswordWebTemporal`) para que no quede escrita en el código.
3. Comprueba en **Project Settings → Script Properties** que quedó guardada la propiedad del hash (verás el nombre de la propiedad y un valor hash, no tu contraseña).
4. **No escribas la contraseña en `index.html`, ni en Drive como texto, ni en el repo de GitHub.** Si la olvidas, vuelve a ejecutar la función del paso 2 con una contraseña nueva.
5. El login y el mantenimiento (§24 y §25 del checklist) quedan bloqueados sin sesión: sin haber hecho login, la página no debe dejar entrar a mantenimiento.

## 6) AppSheet: conectar a las hojas de Drive

1. Sigue **`../guia-configuracion-appsheet.md`** (checklist §26). Ahí están las hojas, las columnas y las vistas.
2. Abre [AppSheet](https://www.appsheet.com) con la misma cuenta de Google.
3. Crea una app nueva conectada al libro de hojas del paso 1 (las 5 hojas: `Bitacoras`, `Sesiones`, `Pendientes`, `Hitos`, `Puntaje`).
4. AppSheet lee y escribe en las **mismas hojas** que usa la página web; no crees hojas duplicadas.
5. El acceso a AppSheet se controla desde Apps Script / tu cuenta Google (D10): llena `CUENTAS_AUTORIZADAS_APPSHEET` en `Codigo.gs` con los correos autorizados; la función `verificarCuentaAppSheet_(correo)` (y la acción `verificarAppSheet`) comprueba si un correo está en esa lista. Mientras la lista esté vacía, nadie está autorizado por esa vía. No compartas el libro con cuentas que no deban ver las bitácoras.

## 7) Verificación final

Con la página publicada y la URL de Apps Script puesta:

1. Abre la página en tu navegador (la URL de GitHub Pages del paso 2).
2. Haz **login** con la contraseña del paso 5. Comprueba que sin la contraseña no entras a mantenimiento. (C5: la lectura de Drive también exige sesión; sin login la página solo muestra los datos locales.)
3. Crea una **sesión** en un proyecto (por ejemplo `#Estadistica2`). La fecha debe venir en la fecha actual por defecto.
4. **Sincronizar:** recarga la página y comprueba que la sesión sigue ahí (al iniciar sesión la página lee los datos de Drive); abre Drive y comprueba que `<slug>/bitacora.json` y las hojas se actualizaron.
5. Haz la lista completa de pruebas del apartado **«Cómo probar la v1»** de `README.md` (acuerdo → pendiente, marcar hecho, calendario, exportar JSON/CSV, login bloqueado sin sesión y modo local sin URL).

Si algo falla, anota en qué paso, con qué proyecto y qué mensaje apareció, y revisa primero que la URL `/exec` del paso 3 sea la del despliegue vigente y que esté pegada solo en `CONFIG.appsScriptUrl`.

---

## Tabla de placeholders

| Placeholder | Qué poner | Dónde va |
|---|---|---|
| `TU_URL_APPS_SCRIPT_AQUI` | La URL `/exec` del despliegue Web App de Apps Script (paso 3) | En `index.html`, en un solo lugar: `CONFIG.appsScriptUrl` |
| `TU_CONTRASENA_AQUI` | Tu contraseña web, al ejecutar la función indicada en `Codigo.gs` | Solo como argumento de esa función; se guarda como hash en Script Properties. **Nunca en el HTML, ni en Drive como texto, ni en GitHub** |
| `TU_REPO_AQUI` | El nombre de tu repositorio de GitHub (sugerencia: `bitacoras`) | En el nombre del repo y en la URL de GitHub Pages: `https://TU_USUARIO.github.io/TU_REPO_AQUI/` |

## Versión

**v1 — 2026-11-18.**

## 8) Ciclo y folios de proyecto (v4)

- Los proyectos llevan un folio `CICLO-NN` (p. ej. `20271-01`). El ciclo
  vigente se cambia en la página, en **Mantenimiento → Ciclo y folios**,
  con el campo «Nuevo ciclo» (solo dígitos, 4-6 caracteres). Al cambiarlo,
  el contador se reinicia en 01 automáticamente y los folios del ciclo
  anterior no cambian.
- Se guarda en Drive en `Bitacoras/config-ciclo.json` (ciclo, siguiente,
  usados e historial por ciclo) y los folios en `INDICE-bitacoras.json`
  (acción `guardarConfigCiclo_` en `Codigo.gs`). Sin Apps Script, el ciclo
  solo vive en el navegador (localStorage).

## 9) Borrar los datos de ejemplo (v4)

- En modo local la página siembra una sesión de ejemplo en Estadística 2.
  Para dejar el dashboard en blanco, entra a **Mantenimiento → Datos de
  ejemplo → Borrar datos de ejemplo** y confirma dos veces. Borra SOLO los
  datos de ejemplo (sesión, pendiente, hitos y puntaje marcados como
  ejemplo), en local y en Drive; tus datos reales no se tocan y el ejemplo
  no vuelve a aparecer al recargar.
