#!/usr/bin/env python3
"""Check local links, images, and fragments in a built GitHub Pages project site."""
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.ids = set()
        self.links = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if "id" in attributes:
            self.ids.add(attributes["id"])
        if tag in {"a", "link"} and attributes.get("href"):
            self.links.append(attributes["href"])
        if tag in {"img", "script"} and attributes.get("src"):
            self.links.append(attributes["src"])


def check_site(root, base):
    pages = {path: Page(path.read_text()) for path in root.rglob("*.html")}
    if not pages or root / "index.html" not in pages:
        return ["The built site must include index.html and HTML documentation pages."]
    errors = []
    for path, page in pages.items():
        relative = path.relative_to(root).as_posix()
        page_url = f"{base}/{relative}"
        for target in page.links:
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc:
                continue
            url = urlsplit(urljoin(page_url, target))
            decoded = unquote(url.path)
            if decoded != base and not decoded.startswith(base + "/"):
                errors.append(f"{relative}: project path missing from {target}")
                continue
            destination = root / decoded[len(base):].lstrip("/")
            if destination.is_dir():
                destination /= "index.html"
            if not destination.exists() and not destination.suffix:
                destination = destination.with_suffix(".html")
            if not destination.exists():
                errors.append(f"{relative}: missing {target}")
            elif url.fragment and destination in pages and unquote(url.fragment) not in pages[destination].ids:
                errors.append(f"{relative}: missing fragment {target}")
    for excluded in ("src", "tests", "scripts", "node_modules", "migrations", "infra", "dist"):
        if (root / excluded).exists():
            errors.append(f"Application directory leaked into website: {excluded}")
    return errors


if __name__ == "__main__":
    site_root = Path(sys.argv[1]).resolve()
    site_base = sys.argv[2].rstrip("/")
    errors = check_site(site_root, site_base)
    if errors:
        sys.exit("\n".join(errors))
    print("Documentation links, anchors, images, and project paths are valid.")
