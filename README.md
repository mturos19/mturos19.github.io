# mturos19.github.io

Personal site of **Mark Turos**, software engineer.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies to install.
Push it to GitHub Pages and it is live.

## What's in it

| Feature | How it works |
|---|---|
| **Hex decoder hero** | The JSON in the hero is encoded to real UTF-8 bytes, decoded back and timed. Hover any byte to see its offset and the character it decodes to. |
| **Browser-frame previews** | Each project sits in a browser window with its real URL. Tabs cycle through the screenshots, any shot opens full screen (arrow keys or swipe), and the URL bar opens the live site. |
| **Source explorer** | Browse the PalBoard and Somni repos without leaving the page: file tree, filter, syntax-highlighted files, rendered READMEs and recent commits. |
| **Command menu** | `Ctrl K` / `⌘ K` or `/`. Jump to sections, open the live sites, switch theme, or fuzzy-search every file in both repos. |
| **Live GitHub data** | Commit counts, stars, languages and file trees come from the GitHub API in the visitor's browser, cached for 15 minutes. If GitHub rate-limits the visitor, the site falls back to `assets/data/repos.json`. |
| **Stack evidence** | Click a tool to see which project or role used it. Counts are computed from `data-uses` attributes in the HTML. |
| **Light and dark** | Follows the system setting; the toggle remembers the visitor's choice. |

## Deploy to GitHub Pages

**As your main site (`https://mturos19.github.io`):**

1. Create a public repo named exactly `mturos19.github.io`.
2. Push the contents of this folder to its `main` branch.
3. In the repo, open **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
4. It goes live in about a minute.

**As a project site (`https://mturos19.github.io/portfolio/`):** the same steps in any repo
name. Every path in the site is relative, so it works from a subfolder unchanged.

**Custom domain (`turos.dev`, the domain on your LinkedIn):** add a file called `CNAME`
containing `turos.dev`, then point the domain's DNS at GitHub Pages
([GitHub's guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)).
Also change the `og:image` URL in `index.html` to `https://turos.dev/assets/og.png`.

## Editing

All content lives in `index.html`; behaviour is in `assets/js/site.js`, styles in `assets/css/site.css`.

- **Somni's live URL** is a placeholder (`somni.app`). Search `index.html` for `somni.app`
  and replace every match when it has a real home. The command menu reads it from the
  `data-live` attribute on `#somni`, so nothing in the JS needs changing.
- **Project 03**: replace the `#incoming` article when it ships. Copy the `#somni` article
  as a template, and add the repo name to `REPO_SLUGS` in `site.js` if you want it in the
  explorer.
- **Stack evidence**: a tool links to a project or role when its exact name appears in that
  element's `data-uses` list.
- **Research link**: the PPO allocator has no public repo linked yet. Add a button to the
  `#research` section when it does.

## Refreshing the offline snapshot

The snapshot only matters when GitHub rate-limits a visitor (60 API requests per hour per IP).
After a big push to PalBoard or Somni:

```bash
pip install pillow
python3 tools/snapshot.py
```

This rebuilds `assets/data/repos.json` and re-encodes each repo's `assets/*.png`
screenshots as WebP.

## Structure

```
index.html              the whole page
404.html                self-contained "offset 0x194" page
assets/css/site.css     tokens, layout, components
assets/js/site.js       all behaviour (no dependencies)
assets/vendor/          marked 12.0.2, DOMPurify 3.1.6, highlight.js 11.9.0
                        (loaded only when the source explorer opens)
assets/data/repos.json  offline snapshot of both repos
assets/img/             screenshots as WebP, plus 480px thumbnails
assets/og.png           1200×630 link preview
tools/snapshot.py       refreshes the snapshot and screenshots
```
