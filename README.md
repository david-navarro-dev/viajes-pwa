# Tripfolio · PWA de viajes

Planificador de viajes personal para iPhone: itinerario por días, mapa, documentos y checklists. Funciona sin conexión una vez instalada. Sin servidor, sin cuentas y sin datos personales en este repositorio.

## Uso en el iPhone

1. Abre la URL de GitHub Pages en **Safari**.
2. Pulsa Compartir → **Añadir a pantalla de inicio**. Abre la app desde ese icono (así iOS protege mejor sus datos).
3. En la pantalla de bienvenida, **Elegir archivo JSON** y selecciona el archivo del viaje (por AirDrop, Archivos o iCloud).
4. Abre la app una vez con conexión en cada pantalla para que se guarde en caché. A partir de ahí, la agenda, los documentos y los checklists funcionan sin conexión.

### Documentos sin conexión
En **Documentos**, toca un documento → *Añadir archivo* y elige el PDF o la captura. Se guarda solo en el iPhone y se abre sin conexión.

### Actualizar desde Notion
Genera un JSON nuevo con el proceso de importación (ver abajo) e impórtalo desde **Viajes**. La fusión:
- conserva lo marcado como hecho, tus notas, lo que añadiste, los checklists y los archivos;
- actualiza lo que no tocaste;
- si cambiaste algo que Notion también cambió, mantiene tu versión y te deja elegir;
- no borra elementos que ya no estén en Notion: los marca.

### Copia de seguridad
**Viajes → Exportar copia** (con o sin archivos de documentos). Para restaurar, importa ese archivo desde la misma pantalla.

## Formato de datos (schemaVersion 1)

```
{ schemaVersion, kind: "trip" | "backup", exportedAt,
  trip: { id, name, destination, tz, homeTz, currency, startDate, endDate, source },
  days: [{ id, n, date, title, city, tz, kind: "destination"|"transit", note, lodging, source,
           items: [{ id, type, title, start, end, tz?, endTz?, endDayOffset?, mode?, location?, reservation?,
                     note?, planning?, optional?, links?, done, source }] }],
  documents: [{ id, title, kind, status, detail, url?, day, itemId, files? }],
  checklists: [{ id, kind: "equipaje"|"viaje"|"dia"|"rodaje", title, scope, day, sections: [{ title, items: [{ id, text, done }] }] }] }
```
Las horas son locales de la zona indicada (`tz` del elemento o del día). Los IDs son estables entre importaciones.

## Desarrollo

Sin paso de compilación: HTML, CSS y módulos JavaScript. Leaflet va incluido en `vendor/`.

- Probar en local: `python3 -m http.server 8000` y abrir `http://localhost:8000`.
- Tests del modelo: `npm test` (Node 20+).
- Al publicar una versión nueva, cambia `VERSION` en `sw.js` para que el iPhone ofrezca *Actualizar*.

## Límites conocidos
- El mapa base (OpenStreetMap · CARTO) necesita conexión; sin ella solo se ven las zonas ya visitadas y los marcadores.
- Las líneas del mapa marcan el orden del día, no rutas reales. Las rutas las calcula Google Maps al abrirlo.
- Las coordenadas del dataset de Japón son aproximadas; los enlaces a Google Maps usan nombre y dirección.
- Los cambios no vuelven a Notion.

## Marca

Tripfolio: mapa plegado con pin, degradado atardecer sobre fondo oscuro. Los iconos y las imágenes de arranque de iOS se generan con `node tools/brand.mjs` (requiere Playwright); la animación de inicio está en línea en `index.html`.

## Navegación (v1.4)

- **Inicio**: logo, viaje en curso o próximo (con cuenta atrás), Añadir un viaje, Mis viajes y accesos rápidos.
- **Menú lateral** (botón ☰ o deslizar desde el borde izquierdo): secciones del viaje (Hoy, Itinerario, Mapa del viaje, Documentos, Checklists, Enlaces) y de la app (Inicio, Mis viajes, Añadir, Ajustes y copias).
- **Barra inferior**: Itinerario · Hoy · Documentos.
- **Mapa del viaje**: rutas de todos los días por colores; al tocar una ruta o su número se abre el resumen del día. Sin mapa base, se dibuja un esquema.
- **Enlaces**: referencias (Google Maps, Pinterest, TikTok, Instagram, YouTube, web) por viaje y opcionalmente por día. Se guardan en `userLinks`, entran en la copia y se conservan al reimportar.

## Visor de documentos (v1.7)

Los archivos de cada documento se abren a pantalla completa, ajustados para verse enteros; se amplían pellizcando o con doble toque. Los PDF se dibujan con PDF.js (Mozilla, licencia Apache 2.0, en `vendor/pdfjs/`), que el service worker guarda para poder abrir billetes sin conexión.
