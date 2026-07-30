import importlib.util
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
SPEC = importlib.util.spec_from_file_location(
    "moderar_foto", SCRIPTS_DIR / "moderar-foto.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ModerarFotoTest(unittest.TestCase):
    def create_database(self, root):
        db_path = root / "fotos.db"
        with sqlite3.connect(db_path) as connection:
            connection.executescript(
                """
                CREATE TABLE imagenes (
                    id INTEGER PRIMARY KEY, path TEXT, author TEXT, description TEXT
                );
                CREATE TABLE image_analysis (
                    image_id INTEGER UNIQUE, description TEXT, tags TEXT,
                    risk_assessment TEXT, flags TEXT, is_appropriate INTEGER NOT NULL
                );
                INSERT INTO imagenes VALUES (42, '42.jpg', 'Ana', 'Una escultura');
                INSERT INTO image_analysis VALUES
                    (42, 'Escultura contemporánea', '[]', 'Bajo', '[]', 0);
                """
            )
        return db_path

    def test_approving_photo_updates_its_moderation_status(self):
        with tempfile.TemporaryDirectory() as temporary:
            db_path = self.create_database(Path(temporary))

            photo = MODULE.set_appropriateness(db_path, 42, True)

            self.assertEqual(photo[1], "42.jpg")
            with sqlite3.connect(db_path) as connection:
                status = connection.execute(
                    "SELECT is_appropriate FROM image_analysis WHERE image_id = 42"
                ).fetchone()[0]
            self.assertEqual(status, 1)

    def test_missing_or_unanalysed_photo_is_not_changed(self):
        with tempfile.TemporaryDirectory() as temporary:
            db_path = self.create_database(Path(temporary))

            self.assertIsNone(MODULE.set_appropriateness(db_path, 999, True))

    @patch.object(MODULE.subprocess, "run")
    def test_regeneration_runs_the_public_generators(self, run):
        root = Path("/tmp/fotos-test")

        MODULE.regenerate_public_files(root)

        self.assertEqual(
            run.call_args_list,
            [
                unittest.mock.call(
                    (sys.executable, str(root / "scripts" / "feed-rss.py")),
                    cwd=root,
                    check=True,
                ),
                unittest.mock.call(
                    (sys.executable, str(root / "scripts" / "update-ai-tags.py")),
                    cwd=root,
                    check=True,
                ),
            ],
        )


if __name__ == "__main__":
    unittest.main()
