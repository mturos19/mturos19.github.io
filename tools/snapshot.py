#!/usr/bin/env python3
"""Refresh the offline repo snapshot and the project screenshots.

The site reads GitHub live in the visitor's browser; assets/data/repos.json is only the
fallback for when the API is rate-limited or blocked. Run this after a big push:

    python3 tools/snapshot.py

Needs git and Pillow (pip install pillow). Clones each repo into a temp folder, rebuilds
assets/data/repos.json, and re-encodes every assets/*.png screenshot as WebP (+ a thumbnail).
"""
import collections, json, os, subprocess, sys, tempfile

OWNER = 'mturos19'
REPOS = {'PalBoard': 'palboard', 'Somni': 'somni'}
CODE = {'.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.mjs': 'JavaScript',
        '.cjs': 'JavaScript', '.css': 'CSS', '.html': 'HTML', '.py': 'Python', '.sh': 'Shell'}
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def git(repo_dir, *args):
    return subprocess.check_output(['git', '-C', repo_dir, *args], text=True)


def main():
    try:
        from PIL import Image
    except ImportError:
        sys.exit('Pillow is required: pip install pillow')
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        for repo, slug in REPOS.items():
            d = os.path.join(tmp, repo)
            subprocess.check_call(['git', 'clone', '--quiet', f'https://github.com/{OWNER}/{repo}.git', d])
            branch = git(d, 'rev-parse', '--abbrev-ref', 'HEAD').strip()
            tree, langs = [], collections.Counter()
            for line in git(d, 'ls-tree', '-r', '-l', 'HEAD').splitlines():
                meta, path = line.split('\t', 1)
                size = int(meta.split()[3])
                tree.append({'path': path, 'size': size})
                lang = CODE.get(os.path.splitext(path)[1])
                if lang and 'package-lock' not in path:
                    langs[lang] += size
            commits = []
            for line in git(d, 'log', '-12', '--format=%H%x09%aI%x09%s').splitlines():
                sha, date, msg = line.split('\t', 2)
                commits.append({'sha': sha, 'date': date, 'message': msg})
            readme = os.path.join(d, 'README.md')
            out[repo] = {
                'owner': OWNER, 'repo': repo, 'branch': branch,
                'snapshot': git(d, 'log', '-1', '--format=%aI').strip(),
                'commitCount': int(git(d, 'rev-list', '--count', 'HEAD')),
                'firstCommit': git(d, 'log', '--reverse', '--format=%aI').splitlines()[0],
                'languages': dict(langs.most_common()),
                'commits': commits, 'tree': tree,
                'readme': open(readme, encoding='utf-8').read() if os.path.exists(readme) else '',
            }
            shots = os.path.join(d, 'assets')
            dest = os.path.join(SITE, 'assets', 'img', slug)
            os.makedirs(dest, exist_ok=True)
            for f in sorted(os.listdir(shots)) if os.path.isdir(shots) else []:
                if not f.lower().endswith('.png'):
                    continue
                base = os.path.splitext(f)[0]
                im = Image.open(os.path.join(shots, f)).convert('RGB')
                im.save(os.path.join(dest, base + '.webp'), 'WEBP', quality=84, method=6)
                im.thumbnail((480, 480))
                im.save(os.path.join(dest, base + '-thumb.webp'), 'WEBP', quality=78, method=6)
            print(f'{repo}: {len(tree)} files, {out[repo]["commitCount"]} commits')
    with open(os.path.join(SITE, 'assets', 'data', 'repos.json'), 'w') as fh:
        json.dump(out, fh, separators=(',', ':'))
    print('wrote assets/data/repos.json')


if __name__ == '__main__':
    main()
