#!/usr/bin/env python3
import sqlite3
import requests
import time
import os
import sys
from datetime import datetime, timedelta
import json

# Configuración
BLUESKY_THREAD_HANDLE = 'fotos.aldeapucela.org'
API_BASE_URL = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread'
RATE_LIMIT_DELAY = 0.5  # 500ms entre requests para ser respetuosos
BATCH_SIZE = 10  # Procesar en lotes pequeños

def get_project_root():
    """Obtener el directorio raíz del proyecto"""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_bluesky_stats(post_id):
    """
    Obtener estadísticas de un post de Bluesky
    
    Args:
        post_id (str): ID del post en Bluesky
        
    Returns:
        dict: Diccionario con like_count, comment_count, repost_count o None si error
    """
    try:
        thread_uri = f"at://{BLUESKY_THREAD_HANDLE}/app.bsky.feed.post/{post_id}"
        url = f"{API_BASE_URL}?uri={thread_uri}"
        
        headers = {
            'Accept': 'application/json',
            'User-Agent': 'AldeaPucela-Photos-Bot/1.0'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if 'thread' in data and 'post' in data['thread']:
            post = data['thread']['post']
            return {
                'like_count': int(post.get('likeCount', 0)),
                'comment_count': len(data['thread'].get('replies', [])),
                'repost_count': int(post.get('repostCount', 0))
            }
        else:
            print(f"⚠️  Post {post_id}: estructura de respuesta inesperada")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error API para post {post_id}: {e}")
        return None
    except (KeyError, ValueError, TypeError) as e:
        print(f"❌ Error procesando datos del post {post_id}: {e}")
        return None

def update_bluesky_cache():
    """Actualizar el cache de estadísticas de Bluesky"""
    project_root = get_project_root()
    db_path = os.path.join(project_root, 'fotos.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Obtener todos los posts de Bluesky con sus IDs de imagen
        cursor.execute("""
            SELECT bp.image_id, bp.post_id, i.path, bic.last_updated
            FROM bluesky_posts bp
            JOIN imagenes i ON bp.image_id = i.id
            LEFT JOIN bluesky_interactions_cache bic ON bp.image_id = bic.image_id
            ORDER BY bp.image_id
        """)
        
        posts = cursor.fetchall()
        
        # Limitar posts en modo de prueba
        if globals().get('TEST_MODE', False):
            posts = posts[:3]
            print("🧪 Modo de prueba activo - limitado a 3 posts")
        
        total_posts = len(posts)
        
        if total_posts == 0:
            print("ℹ️  No se encontraron posts de Bluesky para actualizar")
            return True
        
        print(f"🔄 Iniciando actualización de {total_posts} posts de Bluesky...")
        
        updated_count = 0
        error_count = 0
        skipped_count = 0
        
        for i, (image_id, post_id, image_path, last_updated) in enumerate(posts, 1):
            # Mostrar progreso
            print(f"📊 [{i}/{total_posts}] Procesando {image_path} (post: {post_id[:8]}...)")
            
            # Verificar si necesita actualización (más de 12 horas)
            needs_update = True
            if last_updated:
                try:
                    last_update_time = datetime.fromisoformat(last_updated.replace(' ', 'T'))
                    if datetime.now() - last_update_time < timedelta(hours=12):
                        needs_update = False
                        skipped_count += 1
                        print(f"⏭️  Saltando (actualizado hace menos de 12h)")
                        continue
                except ValueError:
                    # Si hay error parseando la fecha, actualizar de todas formas
                    pass
            
            if not needs_update:
                continue
                
            # Obtener estadísticas de la API
            stats = get_bluesky_stats(post_id)
            
            if stats is None:
                error_count += 1
                continue
            
            # Actualizar o insertar en el cache
            cursor.execute("""
                INSERT OR REPLACE INTO bluesky_interactions_cache 
                (image_id, like_count, comment_count, repost_count, last_updated)
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (
                image_id,
                stats['like_count'],
                stats['comment_count'],
                stats['repost_count']
            ))
            
            updated_count += 1
            print(f"✅ Actualizado: {stats['like_count']} likes, {stats['comment_count']} comentarios, {stats['repost_count']} reposts")
            
            # Rate limiting - pausa entre requests
            if i < total_posts:  # No pausar en el último
                time.sleep(RATE_LIMIT_DELAY)
        
        # Confirmar cambios
        conn.commit()
        conn.close()
        
        # Resumen final
        print(f"\n🎉 Actualización completada:")
        print(f"   ✅ Actualizados: {updated_count}")
        print(f"   ⏭️  Saltados: {skipped_count}")
        print(f"   ❌ Errores: {error_count}")
        print(f"   📊 Total procesados: {total_posts}")
        
        return error_count == 0
        
    except sqlite3.Error as e:
        print(f"❌ Error de base de datos: {e}")
        return False
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        return False

def show_cache_stats():
    """Mostrar estadísticas del cache actual"""
    project_root = get_project_root()
    db_path = os.path.join(project_root, 'fotos.db')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Estadísticas generales
        cursor.execute("SELECT COUNT(*) FROM bluesky_interactions_cache")
        total_cached = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM bluesky_posts")
        total_posts = cursor.fetchone()[0]
        
        # Top fotos por likes
        cursor.execute("""
            SELECT i.path, bic.like_count, bic.comment_count, bic.last_updated
            FROM bluesky_interactions_cache bic
            JOIN imagenes i ON bic.image_id = i.id
            ORDER BY bic.like_count DESC
            LIMIT 5
        """)
        top_photos = cursor.fetchall()
        
        print(f"\n📈 Estadísticas del cache:")
        print(f"   📊 Posts cacheados: {total_cached}/{total_posts}")
        print(f"   📸 Cobertura: {(total_cached/total_posts*100):.1f}%" if total_posts > 0 else "   📸 Cobertura: 0%")
        
        if top_photos:
            print(f"\n🔥 Top 5 fotos más populares:")
            for path, likes, comments, updated in top_photos:
                filename = os.path.basename(path)
                updated_time = updated.split('.')[0] if updated else 'Desconocido'
                print(f"   🏆 {filename}: {likes} likes, {comments} comentarios (actualizado: {updated_time})")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Error consultando estadísticas: {e}")

if __name__ == "__main__":
    print("🚀 Script de actualización de estadísticas de Bluesky")
    print("=" * 50)
    
    # Verificar argumentos
    if len(sys.argv) > 1 and sys.argv[1] == "--stats":
        show_cache_stats()
        sys.exit(0)
    
    # Modo de prueba limitada para desarrollo
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        print("🧪 Modo de prueba: procesando solo los primeros 3 posts")
        global TEST_MODE
        TEST_MODE = True
    else:
        TEST_MODE = False
    
    # Ejecutar actualización
    success = update_bluesky_cache()
    
    # Mostrar estadísticas finales
    show_cache_stats()
    
    # Exit code para cron
    sys.exit(0 if success else 1)
