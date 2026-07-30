#!/usr/bin/env python3
"""Corrige manualmente la decisión de moderación de una foto."""

import argparse
import sqlite3
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def get_photo(connection, photo_id):
    """Devuelve la información necesaria para revisar una foto antes de cambiarla."""
    return connection.execute(
        """
        SELECT i.id, i.path, i.author, i.description, ia.is_appropriate,
               ia.risk_assessment, ia.flags
        FROM imagenes AS i
        JOIN image_analysis AS ia ON ia.image_id = i.id
        WHERE i.id = ?
        """,
        (photo_id,),
    ).fetchone()


def set_appropriateness(db_path, photo_id, is_appropriate):
    """Actualiza la decisión de moderación y devuelve la foto afectada."""
    with sqlite3.connect(db_path) as connection:
        photo = get_photo(connection, photo_id)
        if photo is None:
            return None

        connection.execute(
            "UPDATE image_analysis SET is_appropriate = ? WHERE image_id = ?",
            (is_appropriate, photo_id),
        )
        return photo


def regenerate_public_files(project_root):
    """Actualiza los recursos que solo muestran fotos aptas."""
    commands = (
        (project_root / "scripts" / "feed-rss.py",),
        (project_root / "scripts" / "update-ai-tags.py",),
    )
    for (script,) in commands:
        subprocess.run((sys.executable, str(script)), cwd=project_root, check=True)


def status_label(is_appropriate):
    return "adecuada" if is_appropriate else "inadecuada"


def main():
    parser = argparse.ArgumentParser(
        description="Corrige manualmente la moderación de una foto."
    )
    parser.add_argument(
        "action", choices=("aprobar", "rechazar"), help="Decisión de moderación"
    )
    parser.add_argument("photo_id", type=int, help="ID de la foto")
    parser.add_argument(
        "--force", "-f", action="store_true", help="Aplicar sin pedir confirmación"
    )
    args = parser.parse_args()

    db_path = PROJECT_ROOT / "fotos.db"
    if not db_path.is_file():
        parser.error(f"No se encontró la base de datos: {db_path}")

    with sqlite3.connect(db_path) as connection:
        photo = get_photo(connection, args.photo_id)

    if photo is None:
        parser.error(
            f"No se encontró una foto analizada por IA con ID {args.photo_id}."
        )

    desired_status = args.action == "aprobar"
    current_status = bool(photo[4])
    print(f"Foto {photo[0]}: {photo[1]}")
    print(f"Autoría: {photo[2] or 'Sin especificar'}")
    print(f"Estado actual: {status_label(current_status)}")
    print(f"Nuevo estado: {status_label(desired_status)}")

    if current_status == desired_status:
        print("La foto ya tiene ese estado. No se han realizado cambios.")
        return

    if not args.force:
        confirmation = input("¿Confirmas el cambio y la regeneración pública? (s/N): ")
        if confirmation.strip().lower() != "s":
            print("Operación cancelada.")
            return

    set_appropriateness(db_path, args.photo_id, desired_status)
    try:
        regenerate_public_files(PROJECT_ROOT)
    except subprocess.CalledProcessError as error:
        print(
            "El estado se actualizó, pero no se pudieron regenerar todos los archivos públicos. "
            f"Ejecuta los scripts de regeneración manualmente. ({error})",
            file=sys.stderr,
        )
        raise SystemExit(1)

    print("Moderación actualizada y archivos públicos regenerados.")


if __name__ == "__main__":
    main()
