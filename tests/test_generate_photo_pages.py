import importlib.util
import re
import sqlite3
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

    def test_generated_pages_use_root_absolute_local_assets(self):
        page = (PROJECT_ROOT / "f" / "184500" / "index.html").read_text(encoding="utf-8")
        relative_asset = re.search(r'(?:src|href)="(?:js|css)/', page)
        self.assertIsNone(relative_asset)
        self.assertIn('src="/js/script.js', page)
        self.assertIn('href="/css/style.css', page)

    def test_sitemap_contains_photo_url(self):
        sitemap = (PROJECT_ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://fotos.aldeapucela.org/f/184500/", sitemap)


if __name__ == "__main__":
    unittest.main()
