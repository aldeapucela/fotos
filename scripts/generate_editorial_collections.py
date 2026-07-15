#!/usr/bin/env python3
"""Generate static entry pages for the configured editorial collections."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path


BASE_URL = "https://fotos.aldeapucela.org"
META_RE = re.compile(
    r"[ \t]*<!-- EDITORIAL_META_START -->.*?<!-- EDITORIAL_META_END -->",
    re.DOTALL,
)
SAFE_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def load_collections(project_root: Path) -> list[dict]:
    path = project_root / "data" / "editorial-collections.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise RuntimeError("La configuración de Miradas debe ser una lista")
    return [item for item in data if item.get("published")]


def meta_block(collection: dict) -> str:
    slug = collection["slug"]
    title = html.escape(collection["title"], quote=True)
    description = html.escape(collection["description"], quote=True)
    cover_id = html.escape(str(collection["coverPhotoId"]), quote=True)
    url = f"{BASE_URL}/miradas/{slug}/"
    return "\n".join([
        "  <!-- EDITORIAL_META_START -->",
        f"  <title>{title} - Miradas de Valladolid</title>",
        f'  <link rel="canonical" href="{url}">',
        f'  <meta name="description" content="{description}">',
        f'  <meta property="og:title" content="{title}">',
        '  <meta property="og:type" content="website">',
        f'  <meta property="og:description" content="{description}">',
        f'  <meta property="og:image" content="{BASE_URL}/files/{cover_id}.jpg">',
        f'  <meta property="og:url" content="{url}">',
        '  <meta name="twitter:card" content="summary_large_image">',
        "  <!-- EDITORIAL_META_END -->",
    ])


def generate_editorial_collections(project_root: Path | None = None) -> int:
    project_root = Path(project_root) if project_root else Path(__file__).resolve().parent.parent
    template_path = project_root / "miradas" / "index.html"
    template = template_path.read_text(encoding="utf-8")
    if not META_RE.search(template):
        raise RuntimeError("No se encontró EDITORIAL_META en la plantilla de Miradas")

    collections = load_collections(project_root)
    slugs = [str(collection.get("slug", "")) for collection in collections]
    if len(slugs) != len(set(slugs)):
        raise RuntimeError("Hay slugs de Miradas duplicados")
    invalid = [slug for slug in slugs if not SAFE_SLUG_RE.fullmatch(slug)]
    if invalid:
        raise RuntimeError(f"Slugs de Miradas no seguros: {invalid}")

    generated = 0
    for collection in collections:
        slug = collection["slug"]
        page = META_RE.sub(meta_block(collection), template, count=1)
        page = page.replace(
            'data-collection-slug=""',
            f'data-collection-slug="{html.escape(slug, quote=True)}"',
            1,
        )
        output = project_root / "miradas" / slug / "index.html"
        output.parent.mkdir(parents=True, exist_ok=True)
        previous = output.read_text(encoding="utf-8") if output.exists() else None
        if previous != page:
            output.write_text(page, encoding="utf-8")
            generated += 1

    print(f"Miradas: {generated} páginas actualizadas, {len(collections)} publicadas")
    return len(collections)


if __name__ == "__main__":
    generate_editorial_collections()
