# Galeria de fotos - Aldea Pucela

## Estructura de archivos

### Sistema de ficheros
```
aldeapucela/fotos/
├── files/             # Directorio de imágenes
├── scripts/          # Scripts de mantenimiento
│   ├── subir-foto.py
│   ├── borrar-foto.py
│   ├── feed-rss.py   # Generador de RSS, JSON y páginas estáticas
│   ├── generate_photo_pages.py # Generador de URLs /f/{id}/
│   ├── update-tags.py
│   ├── update-ai-tags.py
│   └── bluesky-sync.py  # Sincronización con Bluesky
├── populares/        # Vista de fotos más populares
│   └── index.html
├── miradas/          # Índice y páginas generadas de selecciones editoriales
├── data/
│   └── editorial-collections.json # Configuración de Miradas
├── js/               # Scripts JavaScript
│   ├── script.js     # Galería principal
│   └── populares.js  # Vista de populares
├── fotos.db          # Base de datos SQLite
├── fotos.db.sample   # Plantilla de la base de datos
├── feed.xml          # Feed RSS con las últimas 100 fotos aptas
├── data.json         # API JSON con todas las fotos aptas
├── f/                # Páginas estáticas generadas para compartir fotos
├── sitemap.xml       # Sitemap generado con las URLs públicas
├── tags-cache.json   # Caché de etiquetas
├── ai-tags-cache.json # Caché de etiquetas generadas por IA
├── index.html        # Galería principal
└── etiquetas.html    # Vista de etiquetas
```

## Instalación

1. Crea la base de datos inicial:
```bash
cp fotos.db.sample fotos.db
```

2. Asegúrate que todas las imágenes están en el directorio `files/`
3. Añade la base de datos fotos.db la información de las imágenes
4. Ejecuta `update-tags.py` para generar el caché

### Base de datos
El archivo `fotos.db` contiene las siguientes tablas:

```sql
CREATE TABLE imagenes (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL,      -- Ruta relativa a /files/
    date DATETIME NOT NULL,  -- Fecha y hora
    author TEXT,            -- Autor de la foto
    description TEXT        -- Descripción con #hashtags
);

CREATE TABLE "image_analysis" (
    "id" INTEGER,
    "image_id" INTEGER NOT NULL UNIQUE,
    "description" TEXT NOT NULL,
    "tags" TEXT,
    "risk_assessment" TEXT,
    "flags" TEXT,
    "is_appropriate" BOOLEAN NOT NULL,
    "analysis_date" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY("image_id") REFERENCES "imagenes"("id") ON DELETE CASCADE,
    PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS bluesky_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id INTEGER NOT NULL,
    post_id TEXT NOT NULL,
    FOREIGN KEY(image_id) REFERENCES imagenes(id) ON DELETE CASCADE,
    UNIQUE(image_id)
);

CREATE TABLE IF NOT EXISTS bluesky_interactions_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id INTEGER NOT NULL UNIQUE,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    repost_count INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(image_id) REFERENCES imagenes(id) ON DELETE CASCADE
);
```

**Tabla opcional: `image_analysis`**

Esta tabla permite almacenar los resultados de análisis de contenido de las imágenes utilizando IA. Es útil para:

- Filtrar contenido inapropiado del feed RSS automáticamente.
- Mostrar advertencias en la interfaz cuando sea necesario.
- Mantener un registro de análisis de contenido y moderación.

Campos destacados:
- `image_id`: referencia a la imagen analizada.
- `description`: resumen generado por IA sobre el contenido de la imagen.
- `tags`: etiquetas generadas automáticamente.
- `risk_assessment` y `flags`: información adicional sobre riesgos o advertencias.
- `is_appropriate`: si la imagen es apta para mostrar.
- `analysis_date`: fecha del análisis.

Se recomienda usar un modelo de IA capaz de analizar imágenes para generar estos análisis. Ver [AI_PROMPT.md](AI_PROMPT.md) para un ejemplo del prompt a utilizar y el formato de datos esperado.

**Tabla opcional: `bluesky_posts`**

Esta tabla permite asociar cada imagen de la galería con el identificador (`post_id`) de su post correspondiente en la red social [Bluesky](https://bsky.app/). Esto es útil si quieres mostrar comentarios y 'likes' de Bluesky directamente en la galería, o enlazar cada foto con su publicación original. Si no usas integración con Bluesky, puedes omitir esta tabla sin problema.

- `image_id`: referencia a la imagen de la tabla `imagenes`.
- `post_id`: identificador del post en Bluesky.

**Tabla opcional: `bluesky_interactions_cache`**

Esta tabla almacena las métricas de interacción (likes, comentarios, reposts) de cada foto desde Bluesky. Se utiliza para la funcionalidad de **fotos populares** y permite ordenar las imágenes por su nivel de engagement en la red social.

- `image_id`: referencia a la imagen de la tabla `imagenes`.
- `like_count`: número de likes recibidos en Bluesky.
- `comment_count`: número de comentarios recibidos.
- `repost_count`: número de reposts/shares.
- `last_updated`: fecha de la última actualización de estos datos.

Esta tabla se actualiza automáticamente mediante el script `bluesky-sync.py`.

## Scripts de mantenimiento

### Feed RSS
```bash
./scripts/feed-rss.py
```
- Genera un feed RSS con las últimas 100 fotos aptas
- Genera `data.json` con todas las fotos aptas y los mismos campos que cada elemento RSS
- Genera una página estática `/f/{id}/` para cada foto pública y actualiza `sitemap.xml`
- En ejecuciones sin cambios no reescribe ningún archivo; solo regenera fotos nuevas o modificadas y elimina las retiradas
- Usa un bloqueo no bloqueante para evitar que dos ejecuciones del cron se solapen
- Incluye descripciones, autores y enlaces directos
- Indica la licencia CC BY-SA 4.0 de las imágenes
- Se recomienda ejecutar cada 5 minutos en un cron

Las páginas individuales contienen metadatos Open Graph y Twitter Card que
apuntan directamente a la imagen original de `/files/`. No se crean copias ni
miniaturas. El comando también puede ejecutarse de forma independiente:

```bash
python3 ./scripts/generate_photo_pages.py
```

La URL canónica de una foto es `https://fotos.aldeapucela.org/f/184500/`.
Las URLs históricas `/#184500` se conservan y se migran automáticamente en el
navegador a la URL canónica.

## Miradas editoriales

La sección `/miradas/` agrupa fotografías mediante las etiquetas detectadas
por IA y mantiene una invitación abierta para que la comunidad añada nuevas
fotos desde Telegram. Las colecciones se administran en
`data/editorial-collections.json`; no requieren cambios en SQLite.

Cada definición permite configurar título, texto editorial, portada, etiquetas
de coincidencia, etiqueta de participación y listas manuales de inclusión o
exclusión. Las etiquetas de participación son breves y contextuales, por
ejemplo `#murales`, `#noche` o `#fuentes`.

Las páginas `/miradas/{slug}/` se regeneran junto con las fichas fotográficas o
de forma independiente:

```bash
python3 ./scripts/generate_editorial_collections.py
```

### Sincronización con Bluesky
```bash
./scripts/bluesky-sync.py
```
- Obtiene métricas de interacción (likes, comentarios, reposts) desde Bluesky
- Actualiza la tabla `bluesky_interactions_cache`
- Conserva durante 12 horas las métricas recientes. Para ignorar esa caché o
  actualizar una única foto:

```bash
python3 ./scripts/bluesky-sync.py --force
python3 ./scripts/bluesky-sync.py --force --photo 186917
```

### Corregir asociaciones con BlueSky

Para corregir automáticamente sólo las asociaciones que sean demostrablemente
incorrectas, existe además este comando:

```bash
python3 ./scripts/reassign-bluesky-posts.py
python3 ./scripts/reassign-bluesky-posts.py --apply
```

El primer comando es una simulación. El segundo crea primero una copia de
seguridad `fotos.db.before-bluesky-reassign.*` y actualiza sólo una asociación
existente cuando el post de BlueSky enlaza inequívocamente a una foto distinta.
También invalida las métricas de esas fotos para que el siguiente
`bluesky-sync.py` consulte el post nuevo.
- Necesario para la funcionalidad de fotos populares
- Se recomienda ejecutar cada 30 minutos en un cron

### Borrar fotos
```bash
./scripts/borrar-foto.py ID [-f]
```
- Elimina la foto del sistema de ficheros
- Borra el registro de la base de datos
- Use -f para omitir confirmación

### Actualizar tags
```bash
python3 ./scripts/update-tags.py
```
- Analiza las descripciones de las fotos
- Genera tags-cache.json con conteo de hashtags
- Necesario cada vez que se modifican descripciones

### Actualizar tags de IA
```bash
python3 ./scripts/update-ai-tags.py
```
- Analiza las etiquetas generadas por IA en la tabla image_analysis
- Genera ai-tags-cache.json con conteo de etiquetas
- Solo incluye etiquetas de imágenes marcadas como apropiadas
- Necesario ejecutar después de añadir nuevas fotos o actualizar análisis de IA

Recomendable ejecutar ambos scripts al menos cada hora en un cron.

## Funcionalidad de fotos populares

La galería incluye una vista especial en `/populares/` que muestra las fotos ordenadas por su popularidad basada en las métricas de Bluesky (likes, comentarios, reposts).

### Características:

- **Filtros por período**: Todo el tiempo, último año, últimos 6 meses, último mes, última semana
- **Ordenación**: Por likes, comentarios o engagement total (combinado)
- **URLs compartibles**: Los filtros se reflejan en la URL para compartir vistas específicas
  - `/populares/` - Vista por defecto
  - `/populares/?period=month&sort=comments` - Último mes por comentarios
  - `/populares/?period=week&sort=engagement` - Última semana por engagement
- **Rankings visuales**: Las primeras 10 fotos muestran badges de posición
- **Navegación**: Clic en cualquier foto redirige a la galería principal

### Requisitos:

1. Tabla `bluesky_posts` configurada con los post IDs
2. Tabla `bluesky_interactions_cache` con métricas actualizadas
3. Script `bluesky-sync.py` ejecutándose periódicamente

## Cache de etiquetas

El archivo `tags-cache.json` mantiene un conteo de hashtags:

```json
{
  "lastUpdate": "2024-01-01T12:00:00",
  "tags": [
    {"tag": "#valladolid", "count": 42},
    {"tag": "#arquitectura", "count": 15}
  ]
}
```

El archivo `ai-tags-cache.json` mantiene un conteo similar para las etiquetas generadas por IA:

```json
{
  "lastUpdate": "2024-01-01T12:00:00",
  "tags": [
    {
      "tag": "building",
      "count": 42,
      "latest_photos": ["foto1.jpg", "foto2.jpg", "foto3.jpg", "foto4.jpg"]
    }
  ]
}
```

## Despliegue

1. Asegúrate que todas las imágenes están en el directorio `files/`
2. Verifica que `fotos.db` está actualizado
3. Ejecuta `feed-rss.py` para generar RSS, JSON, sitemap y páginas `/f/{id}/`
4. Ejecuta `update-tags.py` para regenerar el caché de hashtags
5. Ejecuta `update-ai-tags.py` para regenerar el caché de etiquetas IA

El servidor debe servir índices de directorio convencionales para que
`/f/184500/` resuelva el archivo `f/184500/index.html`.

## Añadir una foto nueva manualmente

1. Copia la foto al directorio `files/`:
```bash
cp mi_foto.jpg files/
```

2. Abre SQLite y añade la entrada:
```bash
sqlite3 fotos.db
```

```sql
INSERT INTO imagenes (path, date, author, description) 
VALUES 
('mi_foto.jpg',                    -- Ruta relativa al directorio files/
 datetime('now'),                  -- O una fecha específica: '2024-01-15 14:30:00'
 'Nombre del Autor',               -- Tu nombre
 'Descripción #tag1 #tag2');      -- Descripción con hashtags
```

Puedes automatizar con herramientas externas la importación de imágenes a la carpeta y entradas en la base de datos. Por ejemplo con [n8n](https://n8n.io/).

3. Actualiza el caché de tags:
```bash
./scripts/update-tags.py
```

## Licencia
El código fuente está bajo licencia [GNU Affero General Public License v3](LICENSE). Vea el archivo LICENSE para más detalles.
