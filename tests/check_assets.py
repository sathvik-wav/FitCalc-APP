"""Dependency-free checks for local HTML/CSS references and app metadata."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.navigation_refs = []
        self.ids = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for key in ("src", "href"):
            value = attrs.get(key, "").strip()
            if value:
                self.refs.append(value)
        navigation_attributes = {
            "a": ("href",),
            "area": ("href",),
            "form": ("action",),
            "button": ("formaction",),
            "input": ("formaction",),
            "iframe": ("src",),
        }
        for key in navigation_attributes.get(tag, ()):
            value = attrs.get(key, "").strip()
            if value:
                self.navigation_refs.append((tag, key, value))


class TagBalance(HTMLParser):
    def __init__(self, owner):
        super().__init__(convert_charrefs=True)
        self.owner = owner
        self.stack = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID_ELEMENTS:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        return

    def handle_endtag(self, tag):
        if not self.stack:
            self.errors.append(f"{self.owner}:{self.getpos()[0]} unexpected </{tag}>")
        elif self.stack[-1][0] != tag:
            expected, line = self.stack[-1]
            self.errors.append(f"{self.owner}:{self.getpos()[0]} </{tag}> closes <{expected}> opened on line {line}")
            for index in range(len(self.stack) - 1, -1, -1):
                if self.stack[index][0] == tag:
                    del self.stack[index:]
                    break
        else:
            self.stack.pop()

    def finish(self):
        self.close()
        for tag, line in self.stack:
            self.errors.append(f"{self.owner}:{line} unclosed <{tag}>")
        return self.errors


def local_path(ref, owner):
    if ref.startswith(("#", "//", "data:", "mailto:", "tel:")) or re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", ref):
        return None
    path = ref.split("#", 1)[0].split("?", 1)[0]
    if not path:
        return None
    result = (owner.parent / path).resolve()
    if result.is_dir():
        result /= "index.html"
    return result


def is_directory_navigation(ref, owner):
    """Return true when an internal page navigation relies on directory indexes."""
    if ref.startswith(("#", "//", "data:", "mailto:", "tel:")):
        return False
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", ref) and not ref.lower().startswith("file:"):
        return False
    path = ref.split("#", 1)[0].split("?", 1)[0]
    if not path:
        return False
    if path.lower().startswith("file:"):
        parsed = urlsplit(path)
        if parsed.netloc not in ("", "localhost"):
            return False
        destination = Path(unquote(parsed.path)).resolve()
    else:
        destination = (owner.parent / path).resolve()
    return path.endswith("/") or destination.is_dir()


def main():
    errors = []
    # Ignore generated desktop/mobile output and installed packages; they are
    # not source pages and can contain third-party or tool-generated HTML.
    generated_dirs = {"node_modules", "dist", "android", "ios"}
    html_files = sorted(path for path in ROOT.rglob("*.html") if not generated_dirs.intersection(path.relative_to(ROOT).parts))
    for html in html_files:
        parser = References()
        source = html.read_text(encoding="utf-8")
        parser.feed(source)
        balance = TagBalance(html.relative_to(ROOT))
        balance.feed(source)
        errors.extend(balance.finish())
        duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
        if duplicates:
            errors.append(f"{html.relative_to(ROOT)} duplicate IDs: {', '.join(duplicates)}")
        if "tests" not in html.relative_to(ROOT).parts and 'http-equiv="Content-Security-Policy"' not in source:
            errors.append(f"{html.relative_to(ROOT)} missing Content-Security-Policy meta")
        if "tests" not in html.relative_to(ROOT).parts and 'http-equiv="Content-Security-Policy"' in source:
            policy = re.search(r'<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"', source, re.IGNORECASE)
            if not policy or "https://api.nal.usda.gov" not in policy.group(1):
                errors.append(f"{html.relative_to(ROOT)} CSP must allow the optional USDA FoodData Central API")
            if not policy or "https://search.openfoodfacts.org" not in policy.group(1):
                errors.append(f"{html.relative_to(ROOT)} CSP must allow Open Food Facts full-text search")
        if "fonts.googleapis.com" in source or "fonts.gstatic.com" in source:
            errors.append(f"{html.relative_to(ROOT)} still loads a remote font")
        for ref in parser.refs:
            path = local_path(ref, html)
            if path and not path.is_file():
                errors.append(f"{html.relative_to(ROOT)} missing local reference: {ref}")
        for tag, attribute, ref in parser.navigation_refs:
            if is_directory_navigation(ref, html):
                errors.append(
                    f"{html.relative_to(ROOT)} <{tag} {attribute}=\"{ref}\"> relies on directory-index resolution; use an explicit index.html destination"
                )
        inline_scripts = re.findall(r"<script\b[^>]*>(.*?)</script\s*>", source, flags=re.IGNORECASE | re.DOTALL)
        for script in inline_scripts:
            for match in re.finditer(r"([\"'`])((?:\.\.?/)+[^\"'`?$#]+)\1", script):
                ref = match.group(2)
                if ref not in ("./", "../", "../../") and is_directory_navigation(ref, html):
                    errors.append(
                        f"{html.relative_to(ROOT)} inline navigation path {ref!r} relies on directory-index resolution; use an explicit index.html destination"
                    )

    css = ROOT / "main.css"
    for ref in re.findall(r"url\((?:['\"])?([^)'\"]+)", css.read_text(encoding="utf-8")):
        path = local_path(ref.strip(), css)
        if path and not path.is_file():
            errors.append(f"main.css missing local reference: {ref}")

    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    if not manifest.get("start_url", "").endswith("index.html"):
        errors.append("PWA start_url must point to an explicit index.html file")
    for icon in manifest.get("icons", []):
        if not (ROOT / icon["src"]).is_file():
            errors.append(f"manifest missing icon: {icon['src']}")

    service_worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    if '"./foods-india.js"' not in service_worker:
        errors.append("service worker app shell must cache the offline Indian food dataset")
    if "https://api.nal.usda.gov" not in service_worker:
        errors.append("service worker food-search policy note must include the optional USDA API origin")
    app_shell_refs = re.findall(r'"(\./[^"?]+)"', service_worker)
    for ref in app_shell_refs:
        if ref.endswith("/"):
            errors.append(f"service worker app shell uses a directory URL: {ref}")
        if not (ROOT / ref.removeprefix("./")).is_file():
            errors.append(f"service worker missing app-shell reference: {ref}")

    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    build_files = package.get("build", {}).get("files", [])
    included_files = [pattern for pattern in build_files if not pattern.startswith("!")]
    if not build_files or any("tests" in pattern for pattern in included_files) or "!tests/**" not in build_files:
        errors.append("Electron build allowlist must exclude tests/")
    if '"tests"' not in (ROOT / "main.js").read_text(encoding="utf-8"):
        errors.append("Electron protocol handler must reject tests/")
    if 'win.loadURL("fitcalc://app/index.html")' not in (ROOT / "main.js").read_text(encoding="utf-8"):
        errors.append("Electron entry point must load an explicit index.html path")
    if "?test=1" in (ROOT / "store.js").read_text(encoding="utf-8"):
        errors.append("production storage still recognizes the test query flag")
    if "test" not in package.get("scripts", {}).get("test", ""):
        errors.append("npm test script is missing")
    if not (ROOT / "assets/fonts/Inter-Variable.ttf").is_file():
        errors.append("bundled Inter variable font is missing")
    if not (ROOT / "assets/fonts/OFL.txt").is_file():
        errors.append("Inter font OFL license is missing")
    if not (ROOT / "build/icon.ico").is_file():
        errors.append("Windows application icon is missing")
    for icon_size in (16, 32, 48, 64, 128, 256, 512):
        icon = ROOT / f"build/linux-icons/{icon_size}x{icon_size}.png"
        if not icon.is_file():
            errors.append(f"Linux application icon is missing: {icon.relative_to(ROOT)}")
    build_config = package.get("build", {})
    if not build_config.get("mac", {}).get("extendInfo", {}).get("NSCameraUsageDescription"):
        errors.append("macOS camera permission description is missing")
    if not build_config.get("win", {}).get("target") or not build_config.get("linux", {}).get("target"):
        errors.append("Windows and Linux packaging targets must be configured")
    if build_config.get("win", {}).get("icon") != "build/icon.ico":
        errors.append("Windows build must use its ICO icon")
    if build_config.get("linux", {}).get("icon") != "build/linux-icons":
        errors.append("Linux build must use the standard-size icon set")
    if not build_config.get("linux", {}).get("maintainer") or not package.get("homepage"):
        errors.append("Linux package homepage and maintainer metadata are required")
    if package.get("desktopName") != "FitCalc" or not build_config.get("linux", {}).get("syncDesktopName"):
        errors.append("Linux desktop name must match the application id")
    expected_cache = f'const CACHE_NAME = "fitcalc-app-shell-v{package["version"]}";'
    if expected_cache not in service_worker:
        errors.append("service-worker cache version does not match package.json; run npm run build")

    if errors:
        print("\n".join("FAIL " + error for error in errors))
        return 1
    print(f"PASS tag balance, explicit internal navigation, CSP, local references, unique IDs, packaging boundaries, and manifest icons ({len(html_files)} HTML pages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
