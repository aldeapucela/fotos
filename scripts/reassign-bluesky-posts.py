#!/usr/bin/env python3
"""Corrige asociaciones BlueSky usando el enlace de la foto incluido en cada post.

Por seguridad, sin --apply no modifica nada. Sólo actualiza asociaciones ya
existentes cuyo post actual sea distinto del post que enlaza inequívocamente a
esa foto; no crea asociaciones nuevas ni borra ninguna.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "fotos.db"
ACTOR = "fotos.aldeapucela.org"
FEED_URL = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed"


def photo_id_from_url(url: str) -> str | None:
    """Extrae el identificador de una URL canónica /f/{id}/ o antigua /#{id}."""
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc != "fotos.aldeapucela.org":
        return None
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) == 2 and parts[0] == "f" and parts[1].isdigit():
        return parts[1]
    if parsed.fragment.isdigit():
        return parsed.fragment
    return None


def linked_photo_id(entry: dict) -> str | None:
    """Devuelve la foto enlazada por el post, si incluye exactamente una."""
    record = entry.get("post", {}).get("record", {})
    ids = set()
    for facet in record.get("facets", []):
        for feature in facet.get("features", []):
            if feature.get("$type", "").endswith("#link") and feature.get("uri"):
                photo_id = photo_id_from_url(feature["uri"])
                if photo_id:
                    ids.add(photo_id)
    return ids.pop() if len(ids) == 1 else None


def fetch_photo_posts() -> tuple[dict[str, str], list[str]]:
    """Obtiene todos los posts y devuelve foto externa -> rkey de BlueSky."""
    cursor = None
    mappings: dict[str, str] = {}
    conflicts: list[str] = []
    while True:
        params = {"actor": ACTOR, "limit": 100}
        if cursor:
            params["cursor"] = cursor
        request = urllib.request.Request(
            f"{FEED_URL}?{urllib.parse.urlencode(params)}",
            headers={"User-Agent": "AldeaPucela-BlueSky-Reassign/1.0"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.load(response)
        for entry in payload.get("feed", []):
            post_id = entry.get("post", {}).get("uri", "").rsplit("/", 1)[-1]
            photo_id = linked_photo_id(entry)
            if not photo_id or not post_id:
                continue
            previous = mappings.get(photo_id)
            if previous and previous != post_id:
                conflicts.append(photo_id)
            else:
                mappings[photo_id] = post_id
        cursor = payload.get("cursor")
        if not cursor:
            break
        time.sleep(0.15)
    # Un enlace repetido a la misma foto no es evidencia suficiente para elegir.
    for photo_id in set(conflicts):
        mappings.pop(photo_id, None)
    return mappings, sorted(set(conflicts))


def proposed_changes(connection: sqlite3.Connection, mappings: dict[str, str]) -> list[tuple[int, str, str, str]]:
    """Obtiene sólo filas con asociación existente y claramente incorrecta."""
    rows = connection.execute("""
        SELECT i.id, i.path, bp.post_id
        FROM imagenes AS i
        JOIN bluesky_posts AS bp ON bp.image_id = i.id
    """).fetchall()
    changes = []
    for image_id, path, current_post_id in rows:
        expected_post_id = mappings.get(Path(path).stem)
        if expected_post_id and expected_post_id != current_post_id:
            changes.append((image_id, path, current_post_id, expected_post_id))
    return sorted(changes, key=lambda item: item[1])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="aplica los cambios propuestos a fotos.db")
    args = parser.parse_args()
    if not DATABASE.exists():
        print(f"No existe {DATABASE}", file=sys.stderr)
        return 1

    print(f"Consultando el feed público de @{ACTOR}…")
    mappings, conflicts = fetch_photo_posts()
    connection = sqlite3.connect(DATABASE)
    try:
        changes = proposed_changes(connection, mappings)
        print(f"Posts con enlace inequívoco a una foto: {len(mappings)}")
        if conflicts:
            print(f"Omitidas {len(conflicts)} fotos con más de un post enlazado.")
        print(f"Reasignaciones incorrectas detectadas: {len(changes)}")
        for _, path, current, expected in changes:
            print(f"  {path}: {current} -> {expected}")
        if not args.apply:
            print("\nSimulación: no se ha modificado la base. Ejecuta de nuevo con --apply para confirmar.")
            return 0

        if not changes:
            print("\nNo hay reasignaciones que aplicar.")
            return 0

        backup = DATABASE.with_name(f"fotos.db.before-bluesky-reassign.{datetime.now():%Y%m%d_%H%M%S}")
        shutil.copy2(DATABASE, backup)
        with connection:
            connection.executemany(
                "UPDATE bluesky_posts SET post_id = ? WHERE image_id = ?",
                [(expected, image_id) for image_id, _, _, expected in changes],
            )
            connection.executemany(
                "DELETE FROM bluesky_interactions_cache WHERE image_id = ?",
                [(image_id,) for image_id, _, _, _ in changes],
            )
        print(f"\nAplicadas {len(changes)} reasignaciones.")
        print(f"Invalidada la caché de esas {len(changes)} fotos para su próximo bluesky-sync.")
        print(f"Copia de seguridad: {backup.name}")
        return 0
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
