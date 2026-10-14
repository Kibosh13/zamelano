#!/usr/bin/env python3
"""Audit tracked source for unwanted files, secrets and broken static references."""
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
BANNED_DIRS = {'.openai','.codex','.agents','node_modules','build','dist','out','outputs','work','tmp','temp','data','storage','uploads','__pycache__'}
BANNED_SUFFIXES = {'.db','.sqlite','.sqlite3','.sql','.log','.tmp','.temp','.bak','.pem','.key','.zip','.tar','.tgz','.pyc'}
SECRET_PATTERNS = [
    rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    rb'\bgh[pousr]_[A-Za-z0-9]{30,}\b',
    rb'\bgithub_pat_[A-Za-z0-9_]{40,}\b',
    rb'\bAKIA[0-9A-Z]{16}\b',
    rb'\bxox[baprs]-[A-Za-z0-9-]{20,}\b',
    rb'\bsk-[A-Za-z0-9_-]{30,}\b',
    rb'\b\d{8,12}:[A-Za-z0-9_-]{35}\b',
]

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.sources, self.anchors = [], [], []
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if 'id' in data:
            self.ids.append(data['id'])
        if 'src' in data:
            self.sources.append(data['src'])
        if tag == 'link' and data.get('rel') in {'stylesheet', 'icon', 'preload'} and 'href' in data:
            self.sources.append(data['href'])
        if tag == 'a' and data.get('href','').startswith('#') and data['href'] != '#':
            self.anchors.append(data['href'][1:])

def main():
    paths = subprocess.check_output(['git','ls-files','-z','--cached'],cwd=ROOT).decode().split('\0')
    files = [Path(p) for p in paths if p]
    if not files:
        raise SystemExit('Stage project source before running the audit')
    errors = []
    for relative in files:
        path = ROOT / relative
        if path.is_symlink():
            errors.append(f'Symlink not allowed in static source: {relative}')
        if any(part in BANNED_DIRS for part in relative.parts) or relative.name.startswith('.env') or path.suffix in BANNED_SUFFIXES or relative.name.endswith('.tar.gz'):
            errors.append(f'Forbidden tracked path: {relative}')
        data = path.read_bytes()
        if any(re.search(pattern,data) for pattern in SECRET_PATTERNS):
            errors.append(f'Possible secret in {relative}; value suppressed')
    page = Page()
    page.feed((ROOT/'site/index.html').read_text(encoding='utf-8'))
    if len(page.ids) != len(set(page.ids)):
        errors.append('Duplicate HTML IDs')
    for source in page.sources:
        # Version queries refresh browser caches without changing the asset path.
        asset_path = unquote(urlsplit(source).path)
        if not (ROOT/'site'/asset_path).is_file():
            errors.append(f'Missing static asset: {source}')
    for anchor in page.anchors:
        if anchor not in page.ids:
            errors.append(f'Missing internal section: #{anchor}')
    products = json.loads((ROOT/'site/catalog.json').read_text())['products']
    for product in products:
        if not (ROOT/'site'/product['image']).is_file():
            errors.append(f'Missing product image: {product["id"]}')
        if set(product['name']) != {'ru','en'}:
            errors.append(f'Missing product translation: {product["id"]}')
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'Audit passed: {len(files)} tracked files; no prohibited paths or detected secrets; static references valid.')

if __name__ == '__main__':
    main()
