import importlib.util
import re
import shutil
import sqlite3
import stat
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = PROJECT_ROOT / "scripts" / "generate_photo_pages.py"
SPEC = importlib.util.spec_from_file_location("generate_photo_pages", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class StaticPhotoPagesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.generated_count = MODULE.generate_photo_pages(PROJECT_ROOT)

    def test_generates_one_page_for_every_public_photo(self):
        connection = sqlite3.connect(PROJECT_ROOT / "fotos.db")
        try:
            expected = connection.execute(
                """
                SELECT COUNT(*)
                FROM imagenes i
                LEFT JOIN image_analysis ia ON ia.image_id = i.id
                WHERE ia.is_appropriate = 1 OR ia.is_appropriate IS NULL
                """
            ).fetchone()[0]
        finally:
            connection.close()

        pages = list((PROJECT_ROOT / "f").glob("*/index.html"))
        self.assertEqual(expected, self.generated_count)
        self.assertEqual(expected, len(pages))

    def test_page_has_unique_social_metadata_and_original_image(self):
        page = (PROJECT_ROOT / "f" / "184500" / "index.html").read_text(encoding="utf-8")
        self.assertIn('rel="canonical" href="https://fotos.aldeapucela.org/f/184500/"', page)
        self.assertIn('property="og:url" content="https://fotos.aldeapucela.org/f/184500/"', page)
        self.assertIn('property="og:image" content="https://fotos.aldeapucela.org/files/184500.jpg"', page)
        self.assertIn('name="twitter:card" content="summary_large_image"', page)
        self.assertRegex(page, r'property="og:image:width" content="\d+"')
        self.assertRegex(page, r'property="og:image:height" content="\d+"')
        self.assertNotIn("x.com/javcalles", page)

    def test_urls_and_wrapping_parentheses_are_removed_from_share_text(self):
        text = "Foto del día (https://example.com/original) y más https://example.org/info"
        self.assertEqual(MODULE.strip_urls_for_sharing(text), "Foto del día y más ")

    def test_generated_pages_use_root_absolute_local_assets(self):
        page = (PROJECT_ROOT / "f" / "184500" / "index.html").read_text(encoding="utf-8")
        relative_asset = re.search(r'(?:src|href)="(?:js|css)/', page)
        self.assertIsNone(relative_asset)
        self.assertIn('src="/js/script.js', page)
        self.assertIn('href="/css/style.css', page)

    def test_sitemap_contains_photo_url(self):
        sitemap = (PROJECT_ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://fotos.aldeapucela.org/f/184500/", sitemap)

    def test_generated_directory_is_web_server_traversable(self):
        mode = stat.S_IMODE((PROJECT_ROOT / "f").stat().st_mode)
        self.assertEqual(mode, 0o755)

    def test_incremental_build_only_updates_changed_photos(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "index.html").write_text(
                "<html><head>\n<!-- SOCIAL_META_START -->\n"
                "<title>Plantilla</title>\n<!-- SOCIAL_META_END -->\n"
                "</head><body></body></html>",
                encoding="utf-8",
            )
            (root / "files").mkdir()
            shutil.copyfile(PROJECT_ROOT / "files" / "184500.jpg", root / "files" / "1.jpg")
            shutil.copyfile(PROJECT_ROOT / "files" / "184440.jpg", root / "files" / "2.jpg")

            with sqlite3.connect(root / "fotos.db") as connection:
                connection.executescript(
                    """
                    CREATE TABLE imagenes (
                        id INTEGER PRIMARY KEY, path TEXT, date TEXT,
                        author TEXT, description TEXT
                    );
                    CREATE TABLE image_analysis (
                        image_id INTEGER, is_appropriate INTEGER
                    );
                    INSERT INTO imagenes VALUES
                        (1, '1.jpg', '2026-07-14T10:00:00+02:00', 'Ana', 'Primera foto');
                    """
                )

            MODULE.generate_photo_pages(root)
            first_page = root / "f" / "1" / "index.html"
            first_mtime = first_page.stat().st_mtime_ns

            with sqlite3.connect(root / "fotos.db") as connection:
                connection.execute(
                    "INSERT INTO imagenes VALUES (?, ?, ?, ?, ?)",
                    (2, "2.jpg", "2026-07-14T11:00:00+02:00", "Luis", "Segunda foto"),
                )

            MODULE.generate_photo_pages(root)
            self.assertEqual(first_mtime, first_page.stat().st_mtime_ns)
            second_page = root / "f" / "2" / "index.html"
            self.assertTrue(second_page.is_file())

            with sqlite3.connect(root / "fotos.db") as connection:
                connection.execute(
                    "UPDATE imagenes SET description = ? WHERE id = 2",
                    ("Segunda foto modificada",),
                )
                connection.execute("DELETE FROM imagenes WHERE id = 1")

            MODULE.generate_photo_pages(root)
            self.assertIn("Segunda foto modificada", second_page.read_text(encoding="utf-8"))
            self.assertFalse(first_page.parent.exists())


if __name__ == "__main__":
    unittest.main()
