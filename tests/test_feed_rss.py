import importlib.util
import shutil
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))
SPEC = importlib.util.spec_from_file_location("feed_rss", SCRIPTS_DIR / "feed-rss.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class IncrementalFeedTest(unittest.TestCase):
    def test_unchanged_feed_does_not_rewrite_public_files(self):
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
                        (1, '1.jpg', '2026-07-14T10:00:00+02:00', 'Ana', 'Foto estable');
                    """
                )

            MODULE.generate_rss(root)
            outputs = [
                root / "feed.xml",
                root / "data.json",
                root / "sitemap.xml",
                root / "f" / "1" / "index.html",
            ]
            mtimes = {path: path.stat().st_mtime_ns for path in outputs}

            MODULE.generate_rss(root)
            self.assertEqual(mtimes, {path: path.stat().st_mtime_ns for path in outputs})


if __name__ == "__main__":
    unittest.main()
