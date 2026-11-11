import importlib.util
from pathlib import Path
import unittest
import tempfile
import json
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("installer", Path(__file__).parents[1] / "scripts/install.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def run_install(self, app, *flags):
        with patch("sys.argv", ["install.py", "--app-home", str(app), *flags]), \
                patch.object(installer.subprocess, "run"):
            installer.main()

    def test_fresh_and_update_install_include_shortcut_router(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            (app / "keys.json").write_text('{"global":{"ctrl-shift-t":"tab.new"}}')
            self.run_install(app)
            self.assertTrue((app / "mods/float-space-new/main.js").is_file())
            keys = json.loads((app / "keys.json").read_text())
            self.assertEqual(keys["global"]["ctrl-shift-t"], "tab.new")
            self.assertEqual(keys["terminal"]["ctrl-shift-t"], "mod.open:float-space-new")
            self.run_install(app, "--update")
            for name in installer.MOD_FILES:
                target = app / "mods" / name
                installer.verify_installed(target, json.loads((target / installer.MARKER).read_text()))

    def test_update_adds_router_to_an_existing_single_mod_install(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            (app / "keys.json").write_text('{}')
            with patch.dict(installer.MOD_FILES, {installer.MOD_NAME: installer.FILES}, clear=True):
                self.run_install(app)
            self.assertFalse((app / "mods/float-space-new").exists())
            self.run_install(app, "--update")
            self.assertTrue((app / "mods/float-space-new/main.js").is_file())

    def test_update_adds_navigation_entries_to_an_existing_new_terminal_router_install(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            original = {"global": {"ctrl-tab": "tab.next", "ctrl-shift-tab": "tab.prev", "ctrl-shift-n": "space.new"}}
            (app / "keys.json").write_text(json.dumps(original))
            previous = {name: files for name, files in installer.MOD_FILES.items()
                        if name in ("float-space", "float-space-new")}
            with patch.dict(installer.MOD_FILES, previous, clear=True):
                self.run_install(app)
            self.run_install(app, "--update")
            keys = json.loads((app / "keys.json").read_text())
            for key, route in [("ctrl-tab", "next"), ("ctrl-shift-tab", "prev"), ("ctrl-shift-n", "notes")]:
                self.assertEqual(keys["terminal"][key], f"mod.open:float-space-{route}")
                self.assertEqual(keys["global"][key], original["global"][key])
                self.assertTrue((app / "mods" / f"float-space-{route}" / "main.js").is_file())

    def test_navigation_binding_conflict_changes_no_installed_files(self):
        for key in ("ctrl-tab", "ctrl-shift-tab", "ctrl-shift-n"):
            with self.subTest(key=key), tempfile.TemporaryDirectory() as directory:
                app = Path(directory)
                original = json.dumps({"terminal": {key: "my.custom-action"}})
                (app / "keys.json").write_text(original)
                with self.assertRaisesRegex(ValueError, "Shortcut conflict"):
                    self.run_install(app)
                self.assertEqual((app / "keys.json").read_text(), original)
                self.assertFalse((app / "mods").exists())

    def test_failure_saving_keys_restores_both_mods_and_original_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            original = '{"global":{"ctrl-shift-t":"tab.new"}}'
            (app / "keys.json").write_text(original)
            self.run_install(app)
            before = {p.relative_to(app): p.read_bytes() for p in (app / "mods").rglob("*") if p.is_file()}
            keys_before = (app / "keys.json").read_bytes()
            atomic = installer.atomic_json
            def fail_keys(path, value):
                if path == app / "keys.json":
                    raise OSError("simulated key-save failure")
                return atomic(path, value)
            with patch.object(installer, "atomic_json", side_effect=fail_keys):
                with self.assertRaisesRegex(OSError, "key-save failure"):
                    self.run_install(app, "--update")
            after = {p.relative_to(app): p.read_bytes() for p in (app / "mods").rglob("*") if p.is_file()}
            self.assertEqual(after, before)
            self.assertEqual((app / "keys.json").read_bytes(), keys_before)

    def test_custom_terminal_new_tab_binding_is_preserved_as_a_conflict(self):
        existing = {"terminal": {"ctrl-shift-t": "my.custom-command"}}
        with self.assertRaisesRegex(ValueError, "Shortcut conflict"):
            installer.merge_keys(existing, {"terminal": {"ctrl-shift-t": "mod.open:float-space-new"}})
        self.assertEqual(existing["terminal"]["ctrl-shift-t"], "my.custom-command")

    def test_shortcut_conflict_leaves_input_unchanged(self):
        original = {"global": {"ctrl-shift-space": "some.other-action", "ctrl-shift-f": "layout.toggle:panel"}}
        with self.assertRaisesRegex(ValueError, "Shortcut conflict"):
            installer.merge_keys(original, {"global": {"ctrl-shift-space": "mod.open:float-space"}})
        self.assertEqual(original["global"]["ctrl-shift-space"], "some.other-action")

    def test_repeat_install_keeps_its_binding_and_other_keys(self):
        existing = {"global": {"ctrl-shift-space": "mod.open:float-space", "ctrl-shift-f": "layout.toggle:panel"}}
        merged = installer.merge_keys(existing, {"global": {"ctrl-shift-space": "mod.open:float-space"}, "terminal": {"ctrl-shift-space": "mod.open:float-space"}})
        self.assertEqual(merged["global"], existing["global"])
        self.assertEqual(merged["terminal"], {"ctrl-shift-space": "mod.open:float-space"})

    def test_update_refuses_additional_user_files(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)
            (destination / "main.js").write_text("original")
            marker = {"package": "herdr-float-space", "files": {"main.js": installer.digest(destination / "main.js")}}
            installer.verify_installed(destination, marker)
            (destination / "my-notes.md").write_text("do not delete")
            with self.assertRaisesRegex(ValueError, "Extra installed file"):
                installer.verify_installed(destination, marker)
            self.assertEqual((destination / "my-notes.md").read_text(), "do not delete")

    def test_update_refuses_edited_source_but_accepts_host_generated_types(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)
            (destination / "main.js").write_text("original")
            marker = {"package": "herdr-float-space", "files": {"main.js": installer.digest(destination / "main.js")}}
            (destination / "gpui-kit.d.ts").write_text("generated")
            installer.verify_installed(destination, marker)
            (destination / "main.js").write_text("customized")
            with self.assertRaisesRegex(ValueError, "Installed file was edited"):
                installer.verify_installed(destination, marker)


if __name__ == "__main__":
    unittest.main()
