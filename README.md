# Galeria de fotos - Aldea Pucela

## Estructura de archivos

### Sistema de ficheros
```
aldeapucela/fotos/
├── files/             # Directorio de imágenes
├── scripts/          # Scripts de mantenimiento
│   ├── subir-foto.py
│   ├── borrar-foto.py
│   ├── feed-rss.py   # Generador del feed RSS
│   └── update-tags.py
├── fotos.db          # Base de datos SQLite
├── fotos.db.sample   # Plantilla de la base de datos
├── feed.xml          # Feed RSS con las últimas 100 fotos
├── tags-cache.json   # Caché de etiquetas
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
```

La tabla `image_analysis` es opcional y está diseñada para almacenar resultados de análisis de contenido de las imágenes utilizando IA. Esto permite:

1. Filtrar contenido inapropiado del feed RSS automáticamente
2. Mostrar advertencias en la interfaz cuando sea necesario
3. Mantener un registro de análisis de contenido

Se recomienda usar un modelo de IA capaz de analizar imágenes para generar estos análisis. Ver [AI_PROMPT.md](AI_PROMPT.md) para un ejemplo del prompt a utilizar y el formato de datos esperado.

## Scripts de mantenimiento

### Feed RSS
```bash
./scripts/feed-rss.py
```
- Genera un feed RSS con las últimas 100 fotos
- Incluye descripciones, autores y enlaces directos
- Indica la licencia CC BY-SA 4.0 de las imágenes
- Se recomienda ejecutar cada 5 minutos en un cron

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

Recomendable ejecutar al menos cada hora en un cron.

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

## Despliegue

1. Asegúrate que todas las imágenes están en el directorio `files/`
2. Verifica que `fotos.db` está actualizado
3. Ejecuta `update-tags.py` para regenerar el caché

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