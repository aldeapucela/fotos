#!/usr/bin/env python3
import sqlite3
import os
import sys
import argparse

def delete_photo(photo_id):
    try:
        conn = sqlite3.connect('fotos.db')
        cursor = conn.cursor()
        
        # Construir el nombre del archivo basado en el ID
        file_path = f"{photo_id}.jpg"
        
        # Borrar el registro de la base de datos
        cursor.execute("DELETE FROM imagenes WHERE path = ?", (file_path,))
        rows_affected = cursor.rowcount
        conn.commit()
        
        if rows_affected == 0:
            print(f"No se encontró la foto {file_path} en la base de datos")
            return False
        
        # Borrar el archivo si existe
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"Archivo borrado: {file_path}")
        else:
            print(f"Advertencia: El archivo no existe en el sistema: {file_path}")
            
        print(f"Foto {file_path} eliminada correctamente de la base de datos")
        return True
        
    except sqlite3.Error as e:
        print(f"Error en la base de datos: {e}")
        return False
    except OSError as e:
        print(f"Error al borrar el archivo: {e}")
        return False
    finally:
        if conn:
            conn.close()

def main():
    parser = argparse.ArgumentParser(description='Borrar foto de la galería y base de datos')
    parser.add_argument('photo_id', type=int, help='ID de la foto a borrar')
    parser.add_argument('--force', '-f', action='store_true', help='Borrar sin confirmación')
    
    args = parser.parse_args()
    
    if not args.force:
        confirm = input(f"¿Está seguro de que desea borrar la foto con ID {args.photo_id}? (s/N): ")
        if confirm.lower() != 's':
            print("Operación cancelada")
            return
    
    if delete_photo(args.photo_id):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()