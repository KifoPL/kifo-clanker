import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('check_docs', Path(__file__).parents[2] / 'scripts/check-docs.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DocumentationLinks(unittest.TestCase):
    def test_project_paths_pretty_pages_fragments_and_encoded_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'docs/guide').mkdir(parents=True)
            (root / 'docs/guide/index.html').write_text('<h1 id="start">Guide</h1>')
            (root / 'logo file.png').write_bytes(b'logo')
            home = root / 'index.html'
            home.write_text('<a href="/kifo-clanker/docs/guide/#start">Guide</a><img src="/kifo-clanker/logo%20file.png">')
            self.assertEqual(module.check_site(root, '/kifo-clanker'), [])
            home.write_text('<a href="/kifo-clanker/docs/guide/#missing">Guide</a>')
            self.assertIn('missing fragment', '\n'.join(module.check_site(root, '/kifo-clanker')))
            home.write_text('<a href="/docs/guide/">Guide</a><img src="/kifo-clanker/missing.png">')
            errors = '\n'.join(module.check_site(root, '/kifo-clanker'))
            self.assertIn('project path missing', errors)
            self.assertIn('missing /kifo-clanker/missing.png', errors)
            (root / 'src').mkdir()
            self.assertIn('Application directory leaked', '\n'.join(module.check_site(root, '/kifo-clanker')))


if __name__ == '__main__':
    unittest.main()
