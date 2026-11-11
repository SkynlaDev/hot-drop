"""Met en page docs/WIKI.md en docs/wiki.html (lecture dans un navigateur, sprites compris).

Usage : python3 tools/wiki-html.py (lancé par npm run wiki). Nécessite le module Python « markdown ».
"""
import markdown

md = open('docs/WIKI.md', encoding='utf-8').read()
body = markdown.markdown(md, extensions=['tables', 'toc'])
css = """body{font-family:system-ui,sans-serif;background:#1d2127;color:#dfe3e8;max-width:980px;margin:auto;padding:24px 32px;line-height:1.5}
h1,h2,h3{color:#f0b252}h2{border-bottom:1px solid #3a414b;padding-bottom:4px;margin-top:40px}h4{margin-bottom:4px;color:#fff}
table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #3a414b;padding:4px 10px}th{background:#2a3038}
img{image-rendering:pixelated;vertical-align:middle;background:#3a414b;border-radius:4px;padding:2px}a{color:#6fd0fa}code{background:#2a3038;padding:1px 4px}"""
with open('docs/wiki.html', 'w', encoding='utf-8') as f:
    f.write(f'<!doctype html><meta charset="utf-8"><title>Hot Drop — Wiki</title><style>{css}</style>{body}')
print('docs/wiki.html')
