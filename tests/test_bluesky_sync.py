import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("bluesky_sync", ROOT / "scripts" / "bluesky-sync.py")
bluesky_sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bluesky_sync)


class BlueskySyncTest(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tempdir.name) / "fotos.db"
        connection = sqlite3.connect(self.db_path)
        connection.executescript("""
            CREATE TABLE imagenes (id INTEGER PRIMARY KEY, path TEXT NOT NULL);
            CREATE TABLE bluesky_posts (image_id INTEGER UNIQUE, post_id TEXT NOT NULL);
            CREATE TABLE bluesky_interactions_cache (
                image_id INTEGER UNIQUE,
                like_count INTEGER DEFAULT 0,
                comment_count INTEGER DEFAULT 0,
                repost_count INTEGER DEFAULT 0,
                last_updated DATETIME
            );
            INSERT INTO imagenes VALUES (1, '186917.jpg'), (2, 'other.jpg');
            INSERT INTO bluesky_posts VALUES (1, 'post-one'), (2, 'post-two');
            INSERT INTO bluesky_interactions_cache VALUES (1, 0, 0, 0, datetime('now'));
            INSERT INTO bluesky_interactions_cache VALUES (2, 4, 0, 0, datetime('now'));
        """)
        connection.commit()
        connection.close()

    def tearDown(self):
        self.tempdir.cleanup()

    def test_fresh_cache_is_skipped_by_default(self):
        with patch.object(bluesky_sync, "get_project_root", return_value=self.tempdir.name), \
             patch.object(bluesky_sync, "get_bluesky_stats") as get_stats:
            self.assertTrue(bluesky_sync.update_bluesky_cache(photo="186917"))
        get_stats.assert_not_called()

    def test_force_refreshes_only_selected_photo(self):
        stats = {"like_count": 1, "comment_count": 2, "repost_count": 3}
        with patch.object(bluesky_sync, "get_project_root", return_value=self.tempdir.name), \
             patch.object(bluesky_sync, "get_bluesky_stats", return_value=stats) as get_stats:
            self.assertTrue(bluesky_sync.update_bluesky_cache(force=True, photo="186917"))
        get_stats.assert_called_once_with("post-one")
        connection = sqlite3.connect(self.db_path)
        rows = connection.execute(
            "SELECT image_id, like_count, comment_count, repost_count FROM bluesky_interactions_cache ORDER BY image_id"
        ).fetchall()
        connection.close()
        self.assertEqual(rows, [(1, 1, 2, 3), (2, 4, 0, 0)])


if __name__ == "__main__":
    unittest.main()
