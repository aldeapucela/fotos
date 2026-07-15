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

    def test_photo_without_description_has_no_numeric_fallback_title(self):
        self.assertEqual(MODULE.photo_title("174855", None), "Foto de Valladolid")
        self.assertNotIn("174855", MODULE.photo_title("174855", ""))

    def test_generated_pages_use_root_absolute_local_assets(self):
        page = (PROJECT_ROOT / "f" / "184500" / "index.html").read_text(encoding="utf-8")
        relative_asset = re.search(r'(?:src|href)="(?:js|css)/', page)
        self.assertIsNone(relative_asset)
        self.assertIn('src="/js/script.js', page)
        self.assertIn('href="/css/style.css', page)

    def test_generated_pages_include_the_new_gallery_shell(self):
        page = (PROJECT_ROOT / "f" / "184500" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Valladolid fotografiada por sus vecinos", page)
        self.assertIn("Comparte tu mirada de Valladolid", page)
        self.assertIn("Enviar por Telegram", page)
        self.assertIn('class="gallery-brand-mark"', page)
        self.assertIn('src="/img/marca/isotipo-fotos.svg"', page)
        self.assertIn('href="/img/marca/isotipo-fotos-512.png"', page)
        self.assertIn('id="scrollTopBrand" href="/"', page)
        self.assertNotIn('class="gallery-brand" title="Aldea Pucela"', page)
        self.assertNotIn('class="fa-brands fa-creative-commons license-mark"', page)
        self.assertIn('id="licenseInfoButton"', page)
        self.assertIn('aria-label="Navegación principal"', page)
        self.assertIn('src="/js/gallery-shell.js', page)
        self.assertNotIn('<span id="totalPhotosCount">0</span>', page)

    def test_gallery_shell_provides_accessible_back_to_top_control(self):
        shell = (PROJECT_ROOT / "js" / "gallery-shell.js").read_text(encoding="utf-8")
        styles = (PROJECT_ROOT / "css" / "style.css").read_text(encoding="utf-8")
        self.assertIn("backToTopButton", shell)
        self.assertIn("Volver arriba", shell)
        self.assertIn("prefers-reduced-motion: reduce", shell)
        self.assertIn("window.scrollTo({ top: 0", shell)
        self.assertIn(".back-to-top", styles)
        self.assertIn("env(safe-area-inset-bottom)", styles)
        self.assertIn("background: transparent;", styles)
        self.assertIn("transform: translateY(-2px);", styles)

    def test_newsletter_cta_is_value_led_and_available_in_generated_pages(self):
        page = (PROJECT_ROOT / "f" / "184500" / "index.html").read_text(encoding="utf-8")
        script = (PROJECT_ROOT / "js" / "newsletter-cta.js").read_text(encoding="utf-8")
        styles = (PROJECT_ROOT / "css" / "style.css").read_text(encoding="utf-8")

        self.assertIn('href="https://aldeapucela.org/boletin/"', page)
        self.assertIn("Únete al boletín", page)
        self.assertIn('src="/js/newsletter-cta.js', page)
        self.assertIn("Nuevas fotos, una vez a la semana", script)
        self.assertIn("debates, noticias y eventos", script)
        self.assertIn("JOINED_STORAGE_KEY", script)
        self.assertIn("localStorage.setItem", script)
        self.assertIn("hasJoinedNewsletter()", script)
        self.assertIn("INSERT_AFTER_PHOTOS = 30", script)
        self.assertNotIn("suscri", script.lower())
        self.assertIn(".newsletter-cta", styles)
        self.assertIn("min-height: 48px", styles)

    def test_every_gallery_template_links_the_weekly_newsletter(self):
        for relative_path in ("index.html", "populares/index.html", "miradas/index.html"):
            with self.subTest(template=relative_path):
                page = (PROJECT_ROOT / relative_path).read_text(encoding="utf-8")
                self.assertIn("https://aldeapucela.org/boletin/", page)
                self.assertIn("Únete al boletín", page)
                self.assertIn("Fotos y novedades cada semana", page)
                self.assertIn("newsletter-cta.js", page)

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
