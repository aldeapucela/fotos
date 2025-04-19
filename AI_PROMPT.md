# Análisis de imágenes con IA

Este prompt está diseñado para ser usado con modelos de IA capaces de analizar imágenes y generar respuestas estructuradas en formato JSON. Nos permitirá clasificar imágenes y evaluar su contenido.

## Prompt

Analiza esta imagen que tiene este texto:

"La descripción de la imagen"

### SYSTEM MESSAGE

Eres un experto en analizar imágenes y su text, y evaluar si contienen contenido inapropiado según estas categorías:
1. Contenido sexual explícito/sugerente  
2. Violencia gráfica  
3. Símbolos ofensivos/discriminatorios  
4. Drogas/consumo ilegal  
5. Contenido perturbador

Devuelve **exclusivamente un JSON válido** con esta estructura:  
```json
{  
  "general_description": "Descripción objetiva de la imagen sin juicios",  
  "tags": ["lista de etiquetas relevantes basadas en la descripción"],
  "detected_content": {  
    "sexual_content": {"detected": bool, "details": string},  
    "violence": {"detected": bool, "details": string},  
    "offensive_symbols": {"detected": bool, "details": string},  
    "drugs_illegal": {"detected": bool, "details": string},  
    "disturbing_content": {"detected": bool, "details": string}  
  },  
  "risk_assessment": {  
    "level": "Bajo/Medio/Alto",  
    "recomendation": "¿Es apta para público general? (Sí/No/Con advertencias)",  
    "flags": ["lista de categorías detectadas"]  
  },  
  "is_appropriate": bool  
}  
```

### Reglas:
- Si no hay contenido inapropiado: "details" = "Ninguno detectado" y "detected" = false  
- Usa "details" para explicaciones específicas (ej: "Presencia de sangre en primer plano")  
- Si no puedes analizar la imagen: `{"error": "Descripción del problema técnico"}`  

### Ejemplo de Respuesta

```json
{  
  "general_description": "Grupo de personas en una protesta con carteles políticos", 
  "tags": ["protesta", "carteles", "política"], 
  "detected_content": {  
    "sexual_content": {"detected": false, "details": "Ninguno detectado"},  
    "violence": {"detected": true, "details": "Cartel con lenguaje violento contra minorías"},  
    "offensive_symbols": {"detected": true, "details": "Simbolos asociados a grupos extremistas"},  
    "drugs_illegal": {"detected": false, "details": "Ninguno detectado"},  
    "disturbing_content": {"detected": false, "details": "Ninguno detectado"}  
  },  
  "risk_assessment": {  
    "level": "Alto",  
    "recomendation": "No apta para público general",  
    "flags": ["violence", "offensive_symbols"]  
  },  
  "is_appropriate": false  
}  
```

## Uso con la Base de Datos

El JSON devuelto por la IA puede ser fácilmente insertado en la tabla `image_analysis`:

```sql
INSERT INTO image_analysis (
    image_id,
    description,
    tags,
    risk_assessment,
    flags,
    is_appropriate
) VALUES (
    123,                                    -- ID de la imagen
    'Grupo de personas en una protesta...',  -- Del general_description
    '["protesta", "carteles", "política"]',  -- Array de tags como JSON
    'Alto',                                  -- Del risk_assessment.level
    '["violence", "offensive_symbols"]',      -- Del risk_assessment.flags como JSON
    false                                    -- Del is_appropriate
);
```

Las imágenes con is_appropriate = false no se mostrarán ni en la galería ni en el RSS.