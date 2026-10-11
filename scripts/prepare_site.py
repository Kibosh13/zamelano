#!/usr/bin/env python3
"""Prepare static demo/production output without changing source or image bytes."""
import argparse
import hashlib
import re
import shutil
from html import escape
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]

def digest(path):
    return hashlib.sha256(path.read_bytes()).digest()

def prepare(target, output, base_url):
    parsed = urlparse(base_url)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError('base-url must be an absolute HTTPS URL without query or fragment')
    base_url = base_url.rstrip('/') + '/'
    output = output.resolve()
    source = ROOT / 'site'
    if output == ROOT / 'build' or not output.is_relative_to(ROOT / 'build'):
        raise ValueError('Generated output must be in a dedicated subdirectory of build/')
    output.mkdir(parents=True, exist_ok=True)
    expected = {'robots.txt', '.nojekyll'}
    for item in source.rglob('*'):
        if not item.is_file():
            continue
        relative = item.relative_to(source)
        expected.add(relative.as_posix())
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or digest(item) != digest(destination):
            shutil.copyfile(item, destination)
    page = output / 'index.html'
    html = page.read_text(encoding='utf-8')
    for name in ('robots', 'googlebot', 'yandex'):
        html = re.sub(r'\s*<meta\s+name="' + name + r'"[^>]*>', '', html)
    html = re.sub(r'\s*<link\s+rel="canonical"[^>]*>', '', html)
    html = re.sub(r'\s*<meta\s+property="og:image"[^>]*>', '', html)
    indexing = 'noindex, nofollow, noarchive' if target == 'demo' else 'index, follow'
    metadata = '\n'.join([
        f'  <meta name="robots" content="{indexing}">',
        f'  <meta name="googlebot" content="{indexing}">',
        f'  <meta name="yandex" content="{indexing}">',
        f'  <link rel="canonical" href="{escape(base_url, quote=True)}">',
        f'  <meta property="og:image" content="{escape(base_url, quote=True)}assets/ivory.webp">',
    ])
    html = html.replace('</head>', metadata + '\n</head>')
    if page.read_text(encoding='utf-8') != html:
        page.write_text(html, encoding='utf-8')
    # Crawlers must be able to read noindex. Project-level robots.txt on Pages
    # is not the origin's robots.txt; the HTML noindex tags are authoritative.
    robots = 'User-agent: *\nAllow: /\n'
    if target == 'production':
        expected.add('sitemap.xml')
        robots += f'Sitemap: {base_url}sitemap.xml\n'
        (output / 'sitemap.xml').write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            f'<url><loc>{escape(base_url)}</loc></url></urlset>\n', encoding='utf-8')
    else:
        robots += '# Demo indexing is disabled by noindex tags in index.html.\n'
    (output / 'robots.txt').write_text(robots, encoding='utf-8')
    (output / '.nojekyll').write_text('', encoding='utf-8')
    # This is a generated output directory. Remove files no longer in source,
    # but always preserve Git metadata when publishing through a worktree.
    for item in output.rglob('*'):
        relative = item.relative_to(output)
        if '.git' in relative.parts:
            continue
        if item.is_file() and relative.as_posix() not in expected:
            item.unlink()
    print(f'Prepared {target}: {output}; indexing={indexing}; base={base_url}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['demo', 'production'], default='demo')
    parser.add_argument('--output', type=Path, default=ROOT / 'build' / 'demo')
    parser.add_argument('--base-url')
    args = parser.parse_args()
    if args.target == 'production' and not args.base_url:
        parser.error('Production requires --base-url with the final production domain')
    prepare(args.target, args.output, args.base_url or 'https://kibosh13.github.io/zamelano/')
