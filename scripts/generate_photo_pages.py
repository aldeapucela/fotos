#!/usr/bin/env python3
"""Generate static, social-previewable URLs for public photos."""

from __future__ import annotations

import html
import os
import re
import shutil
import sqlite3
import struct
import tempfile
from pathlib import Path
from urllib.parse import quote
from xml.etree import ElementTree as ET


BASE_URL = "https://fotos.aldeapucela.org"
META_BLOCK_RE = re.compile(
    r"(?P<indent>[ \t]*)<!-- SOCIAL_META_START -->.*?<!-- SOCIAL_META_END -->",
    re.DOTALL,
)
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")
URL_RE = re.compile(r"https?://[^\s<>()]+", re.IGNORECASE)
PARENTHESIZED_URL_RE = re.compile(r"[ \t]*\([ \t]*https?://[^\s<>()]+[ \t]*\)", re.IGNORECASE)


def photo_id_from_path(image_path: str) -> str:
    return Path(image_path).stem


def jpeg_dimensions(image_path: Path) -> tuple[int, int] | None:
    """Read JPEG dimensions without adding a third-party dependency."""
    try:
        with image_path.open("rb") as image:
            if image.read(2) != b"\xff\xd8":
                return None
            while True:
                marker_start = image.read(1)
                if not marker_start:
                    return None
                if marker_start != b"\xff":
                    continue
                marker = image.read(1)
                while marker == b"\xff":
                    marker = image.read(1)
                if marker in {b"\xd8", b"\xd9"}:
                    continue
                length_bytes = image.read(2)
                if len(length_bytes) != 2:
                    return None
                segment_length = struct.unpack(">H", length_bytes)[0]
                if marker and marker[0] in {
                    0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                    0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
                }:
                    data = image.read(5)
                    if len(data) != 5:
                        return None
                    height, width = struct.unpack(">HH", data[1:])
                    return width, height
                image.seek(segment_length - 2, os.SEEK_CUR)
    except (OSError, struct.error, ValueError):
        return None


def strip_urls_for_sharing(value: str | None) -> str:
    """Remove external URLs and their empty wrapping parentheses."""
    without_parenthesized_urls = PARENTHESIZED_URL_RE.sub("", value or "")
    without_urls = URL_RE.sub("", without_parenthesized_urls)
    return re.sub(r"\(\s*\)", "", without_urls)


def clean_text(value: str | None, limit: int) -> str:
    normalized = " ".join(strip_urls_for_sharing(value).split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"


def photo_title(photo_id: str, description: str | None) -> str:
    first_line = next(
        (line.strip() for line in (description or "").splitlines() if line.strip()),
        "",
    )
    return clean_text(first_line, 70) or f"Foto de Valladolid {photo_id}"


def build_meta_block(
    photo_id: str,
    image_name: str,
    author: str | None,
    description: str | None,
    dimensions: tuple[int, int] | None,
) -> str:
    title = photo_title(photo_id, description)
    page_title = f"{title} — Fotos de Valladolid | Aldea Pucela"
    summary = clean_text(description, 200)
    if not summary:
        summary = f"Foto de Valladolid de {author or 'la comunidad Aldea Pucela'}"

    encoded_id = quote(photo_id, safe="")
    encoded_image = quote(image_name, safe="")
    canonical_url = f"{BASE_URL}/f/{encoded_id}/"
    image_url = f"{BASE_URL}/files/{encoded_image}"

    escaped = {key: html.escape(value, quote=True) for key, value in {
        "title": title,
        "page_title": page_title,
        "summary": summary,
        "canonical_url": canonical_url,
        "image_url": image_url,
    }.items()}

    lines = [
        "  <!-- SOCIAL_META_START -->",
        f"  <title>{escaped['page_title']}</title>",
        '  <link rel="alternate" type="application/rss+xml" title="Fotos de Valladolid - Aldea Pucela" href="/feed.xml" />',
        f'  <link rel="canonical" href="{escaped["canonical_url"]}">',
        f'  <meta property="og:title" content="{escaped["title"]}">',
        '  <meta property="og:type" content="article">',
        f'  <meta property="og:description" content="{escaped["summary"]}">',
        f'  <meta property="og:image" content="{escaped["image_url"]}">',
        f'  <meta property="og:image:secure_url" content="{escaped["image_url"]}">',
        '  <meta property="og:image:type" content="image/jpeg">',
    ]
    if dimensions:
        width, height = dimensions
        lines.extend([
            f'  <meta property="og:image:width" content="{width}">',
            f'  <meta property="og:image:height" content="{height}">',
        ])
    lines.extend([
        f'  <meta property="og:image:alt" content="{escaped["title"]}">',
        f'  <meta property="og:url" content="{escaped["canonical_url"]}">',
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:title" content="{escaped["title"]}">',
        f'  <meta name="twitter:description" content="{escaped["summary"]}">',
        f'  <meta name="twitter:image" content="{escaped["image_url"]}">',
        "  <!-- SOCIAL_META_END -->",
    ])
    return "\n".join(lines)


def public_photos(db_path: Path) -> list[sqlite3.Row]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        return connection.execute(
            """
            SELECT i.path, i.date, i.author, i.description
            FROM imagenes i
            LEFT JOIN image_analysis ia ON ia.image_id = i.id
            WHERE ia.is_appropriate = 1 OR ia.is_appropriate IS NULL
            ORDER BY i.date DESC
            """
        ).fetchall()
    finally:
        connection.close()


def write_sitemap(project_root: Path, photos: list[sqlite3.Row]) -> None:
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ET.register_namespace("", namespace)
    urlset = ET.Element(f"{{{namespace}}}urlset")
    for location in ("/", "/populares/", "/etiquetas/", "/elementos/"):
        url = ET.SubElement(urlset, f"{{{namespace}}}url")
        ET.SubElement(url, f"{{{namespace}}}loc").text = BASE_URL + location
    for photo in photos:
        photo_id = photo_id_from_path(photo["path"])
        url = ET.SubElement(urlset, f"{{{namespace}}}url")
        ET.SubElement(url, f"{{{namespace}}}loc").text = f"{BASE_URL}/f/{quote(photo_id, safe='')}/"
        if photo["date"]:
            ET.SubElement(url, f"{{{namespace}}}lastmod").text = str(photo["date"])[:10]
    tree = ET.ElementTree(urlset)
    ET.indent(tree, space="  ")
    temporary = project_root / ".sitemap.xml.tmp"
    tree.write(temporary, encoding="utf-8", xml_declaration=True)
    temporary.replace(project_root / "sitemap.xml")


def generate_photo_pages(project_root: Path | None = None) -> int:
    project_root = Path(project_root) if project_root else Path(__file__).resolve().parent.parent
    template = (project_root / "index.html").read_text(encoding="utf-8")
    if not META_BLOCK_RE.search(template):
        raise RuntimeError("No se encontró el bloque SOCIAL_META en index.html")

    photos = public_photos(project_root / "fotos.db")
    ids = [photo_id_from_path(photo["path"]) for photo in photos]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Hay identificadores públicos de foto duplicados")
    invalid_ids = [photo_id for photo_id in ids if not SAFE_ID_RE.fullmatch(photo_id)]
    if invalid_ids:
        raise RuntimeError(f"Identificadores públicos no seguros: {invalid_ids[:5]}")

    staging = Path(tempfile.mkdtemp(prefix=".f-build-", dir=project_root))
    # tempfile crea el directorio con 0700. La web se sirve con nginx y debe
    # poder atravesar el directorio final una vez se renombre a `f/`.
    staging.chmod(0o755)
    try:
        for photo, photo_id in zip(photos, ids):
            image_name = Path(photo["path"]).name
            dimensions = jpeg_dimensions(project_root / "files" / image_name)
            meta = build_meta_block(
                photo_id,
                image_name,
                photo["author"],
                photo["description"],
                dimensions,
            )
            page = META_BLOCK_RE.sub(meta, template, count=1)
            destination = staging / photo_id
            destination.mkdir()
            (destination / "index.html").write_text(page, encoding="utf-8")

        output = project_root / "f"
        backup = project_root / ".f-previous"
        if backup.exists():
            shutil.rmtree(backup)
        output_existed = output.exists()
        if output_existed:
            output.replace(backup)
        try:
            staging.replace(output)
        except Exception:
            if output_existed and backup.exists() and not output.exists():
                backup.replace(output)
            raise
        if backup.exists():
            shutil.rmtree(backup)
        write_sitemap(project_root, photos)
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        raise

    print(f"Páginas estáticas generadas: {len(photos)}")
    return len(photos)


if __name__ == "__main__":
    generate_photo_pages()
