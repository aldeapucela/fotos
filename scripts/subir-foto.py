#!/usr/bin/env python3
import sqlite3
import os
import sys
import shutil
from datetime import datetime
import argparse

def upload_photo(photo_path):
    try:
        # Get the project root directory (parent of scripts directory)
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(project_root, 'fotos.db')
        
        # Verificar que el archivo existe
        if not os.path.exists(photo_path):
            print(f"Error: El archivo {photo_path} no existe")
            return False
            
        # Verificar que es una imagen jpg
        if not photo_path.lower().endswith('.jpg'):
            print("Error: El archivo debe ser una imagen JPG")
            return False
            
        # Conectar a la base de datos
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Obtener el siguiente ID disponible
        cursor.execute("SELECT MAX(CAST(SUBSTR(path, 1, LENGTH(path)-4) AS INTEGER)) FROM imagenes")
        max_id = cursor.fetchone()[0]
        new_id = 1 if max_id is None else max_id + 1
        
        # Construir el nombre del nuevo archivo
        new_filename = f"{new_id}.jpg"
        destination = os.path.join(project_root, 'files', new_filename)
        
        # Copiar el archivo
        shutil.copy2(photo_path, destination)
        
        # Insertar en la base de datos
        fecha = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("INSERT INTO imagenes (path, fecha) VALUES (?, ?)", (new_filename, fecha))
        conn.commit()
        
        print(f"Foto subida correctamente con ID {new_id}")
        return True
        
    except sqlite3.Error as e:
        print(f"Error en la base de datos: {e}")
        return False
    except OSError as e:
        print(f"Error al copiar el archivo: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Subir una foto a la base de datos")
    parser.add_argument("photo_path", help="Ruta de la foto a subir")
    args = parser.parse_args()
    
    upload_photo(args.photo_path)