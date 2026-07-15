import importlib.util
import json
import sqlite3
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = PROJECT_ROOT / "scripts" / "generate_editorial_collections.py"
SPEC = importlib.util.spec_from_file_location("generate_editorial_collections", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class EditorialCollectionsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.collections = MODULE.load_collections(PROJECT_ROOT)
        MODULE.generate_editorial_collections(PROJECT_ROOT)

    def test_five_published_collections_are_generated(self):
        self.assertEqual(5, len(self.collections))
        for collection in self.collections:
            page = PROJECT_ROOT / "miradas" / collection["slug"] / "index.html"
            self.assertTrue(page.is_file())
            content = page.read_text(encoding="utf-8")
            self.assertIn(f'data-collection-slug="{collection["slug"]}"', content)
            self.assertIn(f'/miradas/{collection["slug"]}/', content)

    def test_editorial_wording_is_concise(self):
        overview_script = (PROJECT_ROOT / "js" / "miradas.js").read_text(encoding="utf-8")
        detail = (PROJECT_ROOT / "miradas" / "arte-en-los-muros" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("Mirada abierta", overview_script)
        self.assertNotIn("Todas las miradas", detail)
        self.assertNotIn("Mirada abierta", detail)
        self.assertIn('class="editorial-back"', detail)
        self.assertIn("> Volver</a>", detail)
        self.assertIn("Añade una foto", detail)

    def test_editorial_viewer_uses_the_gallery_action_set(self):
        detail = (PROJECT_ROOT / "miradas" / "arte-en-los-muros" / "index.html").read_text(encoding="utf-8")
        for control in (
            "editorialLightboxLikes",
            "editorialLightboxComments",
            "editorialLightboxShare",
            "editorialLightboxDownload",
            "editorialPreviousPhoto",
            "editorialNextPhoto",
        ):
            self.assertIn(f'id="{control}"', detail)
        self.assertIn("CC BY-SA 4.0", detail)
        self.assertNotIn("Ver ficha y comentarios", detail)

    def test_editorial_viewer_preloads_neighbors_and_slides_without_fading(self):
        detail = (PROJECT_ROOT / "miradas" / "arte-en-los-muros" / "index.html").read_text(encoding="utf-8")
        script = (PROJECT_ROOT / "js" / "miradas.js").read_text(encoding="utf-8")
        motion = (PROJECT_ROOT / "js" / "lightbox-motion.js").read_text(encoding="utf-8")
        styles = (PROJECT_ROOT / "css" / "style.css").read_text(encoding="utf-8")
        self.assertIn('id="editorialLightboxMedia"', detail)
        self.assertIn("galleryLightboxMotion?.preloadAdjacent", script)
        self.assertIn("galleryLightboxMotion?.addSwipe", script)
        self.assertIn("image.decode()", motion)
        self.assertIn("pointerup", motion)
        self.assertIn("onDismiss", motion)
        self.assertIn("overscroll-behavior: none", styles)
        self.assertIn("is-incoming-next", styles)
        self.assertIn("is-outgoing-previous", styles)
        self.assertNotIn("from { opacity: 0.45", styles)

    def test_all_gallery_lightboxes_share_motion_and_swipe(self):
        for page in (
            PROJECT_ROOT / "index.html",
            PROJECT_ROOT / "populares" / "index.html",
            PROJECT_ROOT / "miradas" / "index.html",
        ):
            content = page.read_text(encoding="utf-8")
            self.assertIn("lightbox-motion.js", content)
            self.assertIn("lightbox-motion-stage", content)
            self.assertIn("lightbox-motion-image", content)

        for script_path in (
            PROJECT_ROOT / "js" / "script.js",
            PROJECT_ROOT / "js" / "populares.js",
            PROJECT_ROOT / "js" / "miradas.js",
        ):
            content = script_path.read_text(encoding="utf-8")
            self.assertIn("galleryLightboxMotion", content)
            self.assertIn("addSwipe", content)
            self.assertIn("onDismiss", content)

    def test_desktop_editorial_index_uses_a_compact_five_item_mosaic(self):
        styles = (PROJECT_ROOT / "css" / "style.css").read_text(encoding="utf-8")
        self.assertIn("grid-template-columns: repeat(14, minmax(0, 1fr))", styles)
        self.assertIn("grid-auto-rows: clamp(190px, 15vw, 220px)", styles)
        self.assertIn("grid-column: span 6", styles)
        self.assertIn("grid-column: span 4", styles)

    def test_lightbox_close_control_stays_inside_the_viewport(self):
        styles = (PROJECT_ROOT / "css" / "style.css").read_text(encoding="utf-8")
        recent = (PROJECT_ROOT / "index.html").read_text(encoding="utf-8")
        editorial = (PROJECT_ROOT / "miradas" / "index.html").read_text(encoding="utf-8")
        self.assertIn("#lightbox-close,", styles)
        self.assertIn("position: fixed", styles)
        self.assertIn("env(safe-area-inset-top)", styles)
        self.assertIn("width: 48px", styles)
        self.assertIn('id="lightbox-close"', recent)
        self.assertIn('aria-label="Cerrar foto"', recent)
        self.assertLess(
            editorial.index('class="editorial-lightbox-close"'),
            editorial.index('class="editorial-lightbox-panel"'),
        )

    def test_all_lightboxes_use_the_same_compact_spanish_date(self):
        motion = (PROJECT_ROOT / "js" / "lightbox-motion.js").read_text(encoding="utf-8")
        self.assertIn("new Intl.DateTimeFormat('es-ES'", motion)
        self.assertIn("month: 'short'", motion)
        self.assertIn("replace('.', '')", motion)
        for script_path in (
            PROJECT_ROOT / "js" / "script.js",
            PROJECT_ROOT / "js" / "populares.js",
            PROJECT_ROOT / "js" / "miradas.js",
        ):
            content = script_path.read_text(encoding="utf-8")
            self.assertIn("galleryLightboxMotion?.formatDate", content)

    def test_all_lightboxes_use_a_stable_full_screen_layout(self):
        styles = (PROJECT_ROOT / "css" / "style.css").read_text(encoding="utf-8")
        recent = (PROJECT_ROOT / "index.html").read_text(encoding="utf-8")
        popular = (PROJECT_ROOT / "populares" / "index.html").read_text(encoding="utf-8")
        editorial = (PROJECT_ROOT / "miradas" / "index.html").read_text(encoding="utf-8")

        self.assertIn("--lightbox-info-height", styles)
        self.assertIn("grid-template-rows: minmax(0, 1fr) var(--lightbox-info-height)", styles)
        self.assertIn("height: 100svh", styles)
        self.assertIn("#editorialLightboxDescription", styles)
        self.assertIn("max-height: 6em", styles)
        self.assertIn("max-height: 7.5em", styles)
        for content in (recent, popular):
            self.assertIn('class="lightbox-frame ', content)
            self.assertIn('class="lightbox-surface ', content)
            self.assertIn('class="lightbox-info ', content)
        self.assertIn('class="editorial-lightbox-info"', editorial)

        editorial_script = (PROJECT_ROOT / "js" / "miradas.js").read_text(encoding="utf-8")
        self.assertNotIn("description.hidden", editorial_script)

    def test_empty_lightbox_descriptions_move_metadata_below_actions(self):
        styles = (PROJECT_ROOT / "css" / "style.css").read_text(encoding="utf-8")
        self.assertIn(".lightbox-info.is-description-empty #lightbox-desc", styles)
        self.assertIn(".editorial-lightbox-info.is-description-empty", styles)
        for script_path in (
            PROJECT_ROOT / "js" / "script.js",
            PROJECT_ROOT / "js" / "populares.js",
            PROJECT_ROOT / "js" / "miradas.js",
        ):
            content = script_path.read_text(encoding="utf-8")
            self.assertIn("is-description-empty", content)

    def test_overview_has_complete_social_preview_metadata(self):
        overview = (PROJECT_ROOT / "miradas" / "index.html").read_text(encoding="utf-8")
        self.assertIn("https://fotos.aldeapucela.org/img/preview-miradas.jpg", overview)
        self.assertIn('property="og:image:width" content="1200"', overview)
        self.assertIn('property="og:image:height" content="630"', overview)
        self.assertIn('name="twitter:card" content="summary_large_image"', overview)
        self.assertTrue((PROJECT_ROOT / "img" / "preview-miradas.jpg").is_file())

    def test_editorial_pages_load_the_fotos_brand_favicon(self):
        for page in (
            PROJECT_ROOT / "miradas" / "index.html",
            PROJECT_ROOT / "miradas" / "arte-en-los-muros" / "index.html",
        ):
            content = page.read_text(encoding="utf-8")
            self.assertIn(
                '<link rel="icon" type="image/png" href="/img/marca/isotipo-fotos-512.png">',
                content,
            )
            self.assertIn("img-src 'self' data: https://fotos.aldeapucela.org https://aldeapucela.org", content)

    def test_contribution_tags_are_short_and_not_redundant(self):
        tags = {collection["contributionTag"] for collection in self.collections}
        self.assertEqual({"#noche", "#murales", "#rio", "#fuentes", "#flores"}, tags)
        self.assertTrue(all("valladolid" not in tag.lower() for tag in tags))

    def test_every_collection_has_enough_detected_photos_and_a_valid_cover(self):
        with sqlite3.connect(PROJECT_ROOT / "fotos.db") as connection:
            rows = connection.execute(
                """
                SELECT i.path, ia.tags
                FROM imagenes i
                JOIN image_analysis ia ON ia.image_id = i.id
                WHERE ia.is_appropriate = 1
                """
            ).fetchall()

        photos = []
        for path, tags_json in rows:
            photos.append({
                "id": Path(path).stem,
                "tags": {str(tag).strip().lower() for tag in json.loads(tags_json or "[]")},
            })

        for collection in self.collections:
            rules = {tag.lower() for tag in collection["matchTags"]}
            matches = [photo for photo in photos if photo["tags"] & rules]
            self.assertGreaterEqual(len(matches), 12, collection["slug"])
            self.assertTrue((PROJECT_ROOT / "files" / f'{collection["coverPhotoId"]}.jpg').is_file())

    def test_navigation_exposes_miradas_on_gallery_pages(self):
        for page in (PROJECT_ROOT / "index.html", PROJECT_ROOT / "populares" / "index.html"):
            content = page.read_text(encoding="utf-8")
            self.assertIn('href="/miradas/"', content.replace('href="../miradas/"', 'href="/miradas/"'))
            self.assertIn("bottom-navigation-four", content)

    def test_sitemap_exposes_editorial_routes(self):
        sitemap = (PROJECT_ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://fotos.aldeapucela.org/miradas/", sitemap)
        for collection in self.collections:
            self.assertIn(
                f'https://fotos.aldeapucela.org/miradas/{collection["slug"]}/',
                sitemap,
            )


if __name__ == "__main__":
    unittest.main()
