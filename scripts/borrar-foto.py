#!/usr/bin/env python3
import sqlite3
import os
import sys
import argparse

def delete_photo(photo_id):
    try:
        # Get the project root directory (parent of scripts directory)
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(project_root, 'fotos.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. Buscar la ruta del archivo en la base de datos usando el ID
        cursor.execute("SELECT path FROM imagenes WHERE id = ?", (photo_id,))
        result = cursor.fetchone()

        if result is None:
            print(f"No se encontró ninguna foto con ID {photo_id} en la base de datos.")
            return False

        file_name = result[0]
        file_path = os.path.join(project_root, 'files', file_name)

        # 2. Borrar el archivo físico si existe
        file_deleted = False
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"Archivo borrado: {file_path}")
                file_deleted = True
            except OSError as e:
                print(f"Error al borrar el archivo físico {file_path}: {e}")
                # Decidir si continuar o no. Por ahora, continuaremos para borrar la entrada de la BD.
        else:
            print(f"Advertencia: El archivo físico no existe en la ruta esperada: {file_path}")
            # Considerar esto como éxito parcial si la entrada de la BD se borra

        # 3. Borrar el registro de la base de datos usando el ID
        cursor.execute("DELETE FROM imagenes WHERE id = ?", (photo_id,))
        rows_affected = cursor.rowcount
        conn.commit()

        if rows_affected > 0:
            print(f"Registro de la foto con ID {photo_id} (archivo: {file_name}) eliminado de la base de datos.")
            # El éxito general depende de si se encontró en la BD y se pudo borrar el registro.
            # El borrado del archivo es secundario pero se informa.
            return True
        else:
            # Esto no debería ocurrir si fetchone() devolvió algo, pero por si acaso.
            print(f"Error inesperado: No se pudo borrar el registro con ID {photo_id} de la base de datos.")
            return False

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
