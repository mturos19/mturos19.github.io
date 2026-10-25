/* Mark Turos: site behaviour.
   No dependencies. The source explorer lazy-loads three vendored libraries (marked, DOMPurify,
   highlight.js) the first time it opens. GitHub data is fetched live and cached for 15 minutes;
   assets/data/repos.json is the offline snapshot used until (or instead of) the live answer. */
(() => {
  'use strict';

  const GH_USER = 'mturos19';
  const LINKEDIN = 'https://www.linkedin.com/in/markturos';
  const REPO_SLUGS = { PalBoard: 'palboard', Somni: 'somni' };
  const LANG_COLORS = { TypeScript: '#3178c6', JavaScript: '#f1e05a', CSS: '#663399', HTML: '#e34c26', Python: '#3572a5', Shell: '#89e051', MDX: '#fcb32c' };
  const EXT_LANG = { ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript', css: 'CSS', html: 'HTML', py: 'Python', sh: 'Shell' };
  const HL_LANG = { ts: 'typescript', tsx: 'typescript', mts: 'typescript', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', json: 'json', jsonc: 'json', css: 'css', html: 'xml', svg: 'xml', xml: 'xml', md: 'markdown', yml: 'yaml', yaml: 'yaml', toml: 'ini', sh: 'bash', py: 'python', example: 'bash', gitignore: 'bash' };
  const IMG_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']);
  const BIN_EXT = new Set(['ico', 'wasm', 'woff', 'woff2', 'ttf', 'otf', 'zip', 'gz', 'exe', 'pdf', 'mp3', 'mp4']);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  const root = document.documentElement;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  };
  const cache = {
    get(k, ttl = 15 * 60e3) {
      try { const o = JSON.parse(localStorage.getItem(k) || 'null'); return o && Date.now() - o.t < ttl ? o.v : null; } catch { return null; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch { /* quota or blocked */ } },
  };

  const ICON = {
    hash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6h11M2 10h11M6.5 2.5 5 13.5M11 2.5l-1.5 11"/></svg>',
    out: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>',
    code: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 4.5-4 3.5 4 3.5M10.5 4.5l4 3.5-4 3.5"/></svg>',
    theme: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11Z" fill="currentColor"/></svg>',
    file: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5l3.5 3.5v9.5h-8.5z"/><path d="M9 1.5V5h3.5"/></svg>',
    chev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>',
  };

  /* ---------- small utilities ---------- */
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  function rel(iso) {
    if (!iso) return 'unknown';
    const s = (new Date(iso).getTime() - Date.now()) / 1000;
    for (const [unit, sec] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600]]) {
      if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit);
    }
    return rtf.format(Math.round(s / 60), 'minute');
  }
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtMonth = (iso) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  function fmtSize(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function normPath(p) {
    const out = [];
    for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); }
    return out.join('/');
  }
  const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
  const rawUrl = (repo, branch, path) => `https://raw.githubusercontent.com/${GH_USER}/${repo}/${encodeURIComponent(branch)}/${encPath(path)}`;
  const blobUrl = (repo, branch, path) => `https://github.com/${GH_USER}/${repo}/blob/${encodeURIComponent(branch)}/${encPath(path)}`;
  function localAsset(repo, path) {
    const m = /^assets\/([\w-]+)\.png$/i.exec(path);
    return m && REPO_SLUGS[repo] ? `assets/img/${REPO_SLUGS[repo]}/${m[1]}.webp` : null;
  }
  const extOf = (path) => { const b = path.split('/').pop(); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : b.replace(/^\./, '').toLowerCase(); };

  function openUrl(url) {
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- theme ---------- */
  const lightQ = matchMedia('(prefers-color-scheme: light)');
  const theme = () => root.dataset.theme || (lightQ.matches ? 'light' : 'dark');
  const themeListeners = [];
  function syncTheme() {
    const t = theme();
    $$('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'));
    const m = $('meta[name="theme-color"]');
    if (m) m.content = t === 'dark' ? '#0b0d12' : '#f3f4f7';
    themeListeners.forEach((fn) => fn());
  }
  function toggleTheme() {
    const next = theme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    store.set('theme', next);
    syncTheme();
  }
  lightQ.addEventListener?.('change', syncTheme);
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- hero: the hex decoder ---------- */
  function initHex() {
    const view = $('#hexview'), hexEl = $('#hex'), jsonEl = $('#hex-json');
    if (!view || !hexEl || !jsonEl) return;
    const bytes = new TextEncoder().encode(jsonEl.textContent);
    const t0 = performance.now();
    const text = new TextDecoder('utf-8').decode(bytes);
    const ms = performance.now() - t0;
    const cursorEl = $('#hex-cursor');

    // Colour the decoded JSON by role; every character keeps its byte offset (the text is ASCII).
    const cls = new Array(text.length).fill('');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        let j = i + 1; while (j < text.length && text[j] !== '"') j++;
        let k = j + 1; while (text[k] === ' ') k++;
        const kind = text[k] === ':' ? 'j-key' : 'j-str';
        for (let x = i; x <= j; x++) cls[x] = kind;
        i = j;
      } else if ('{}[]:,'.includes(c)) cls[i] = 'j-p';
    }
    jsonEl.innerHTML = Array.from(text, (c, i) => `<span class="hx-c ${cls[i]}" data-i="${i}">${esc(c)}</span>`).join('');
    const chars = $$('.hx-c', jsonEl);

    $('#hex-size').textContent = `${bytes.length} B · UTF-8`;
    $('#hex-decoded').textContent = `decoded ${bytes.length} bytes in ${ms < 0.05 ? '<0.05' : ms.toFixed(2)} ms`;

    let cells = [], perRow = 0, readUpTo = text.length, head = -1, hot = -1;
    const show = (c) => (c === '\n' ? '\\n' : c === ' ' ? 'SP' : c);
    const setCursor = (i) => {
      cursorEl.textContent = i == null || i < 0 ? 'hover any byte'
        : `0x${i.toString(16).padStart(4, '0')}  ${bytes[i].toString(16).padStart(2, '0')}  ${show(text[i])}`;
    };
    function renderHex() {
      const n = view.clientWidth >= 470 ? 16 : 8;
      if (n === perRow) return;
      perRow = n;
      hexEl.style.setProperty('--n', n);
      let html = '';
      for (let i = 0; i < bytes.length; i++) {
        if (i % n === 0) html += `<span class="hx-off">${i.toString(16).padStart(4, '0')}</span>`;
        html += `<span class="hx-b${i <= readUpTo ? ' is-read' : ''}" data-i="${i}">${bytes[i].toString(16).padStart(2, '0')}</span>`;
      }
      hexEl.innerHTML = html;
      cells = $$('.hx-b', hexEl);
    }
    renderHex();
    if ('ResizeObserver' in window) new ResizeObserver(renderHex).observe(view);

    const mark = (i, cl, on) => { cells[i]?.classList.toggle(cl, on); chars[i]?.classList.toggle(cl, on); };
    function setHot(i) {
      if (hot === i) return;
      if (hot >= 0) mark(hot, 'is-hot', false);
      hot = i;
      if (i >= 0) mark(i, 'is-hot', true);
      setCursor(i);
    }
    view.addEventListener('pointerover', (e) => { const t = e.target.closest('[data-i]'); if (t) setHot(+t.dataset.i); });
    view.addEventListener('pointerleave', () => setHot(-1));

    // One read pass on load: a head runs through the bytes and lights each decoded character.
    if (!motionOK()) return;
    readUpTo = -1;
    cells.forEach((c) => c.classList.remove('is-read'));
    view.classList.add('is-reading');
    const start = performance.now() + 350, dur = 1800;
    const step = (now) => {
      const i = Math.max(0, Math.min(bytes.length - 1, Math.floor(((now - start) / dur) * bytes.length)));
      if (now >= start) {
        if (head >= 0) mark(head, 'is-head', false);
        for (let k = readUpTo + 1; k <= i; k++) mark(k, 'is-read', true);
        readUpTo = i; head = i;
        mark(i, 'is-head', true);
        if (hot < 0) setCursor(i);
      }
      if (i < bytes.length - 1 || now < start) requestAnimationFrame(step);
      else setTimeout(() => { mark(head, 'is-head', false); head = -1; view.classList.remove('is-reading'); if (hot < 0) setCursor(null); }, 400);
    };
    requestAnimationFrame(step);
  }

  /* ---------- galleries (browser frames) ---------- */
  const galleries = [];
  function initGalleries() {
    const DWELL = 5200;
    $$('[data-gallery]').forEach((g) => {
      const tabs = $$('[role="tab"]', g), shots = $$('.browser__shot', g);
      const path = $('.browser__path', g), cap = $('.browser__caption', g), back = $('.browser__backdrop', g), vp = $('.browser__viewport', g);
      const tablist = tabs[0].parentElement;
      let idx = 0, timer = 0, visible = false, paused = false, stopped = !motionOK();
      g.style.setProperty('--dwell', DWELL + 'ms');

      const restart = () => {
        clearTimeout(timer);
        g.classList.remove('is-auto');
        if (stopped || !visible || paused || document.hidden) return;
        void g.offsetWidth; // restart the tab timer animation
        g.classList.add('is-auto');
        timer = setTimeout(() => show(idx + 1), DWELL);
      };
      function show(i, focus) {
        idx = (i + shots.length) % shots.length;
        shots.forEach((s, k) => s.classList.toggle('is-active', k === idx));
        tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === idx)); t.tabIndex = k === idx ? 0 : -1; });
        const t = tabs[idx];
        if (path) path.textContent = t.dataset.path || '';
        if (cap) cap.textContent = t.dataset.caption || '';
        if (back) back.style.backgroundImage = `url("${shots[idx].dataset.thumb}")`;
        if (tablist.scrollWidth > tablist.clientWidth) tablist.scrollTo({ left: t.offsetLeft - (tablist.clientWidth - t.offsetWidth) / 2, behavior: motionOK() ? 'smooth' : 'auto' });
        if (focus) t.focus();
        restart();
      }
      tabs.forEach((t, k) => t.addEventListener('click', () => { stopped = true; show(k); }));
      tablist.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (d) { e.preventDefault(); stopped = true; show(idx + d, true); }
        else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); stopped = true; show(e.key === 'Home' ? 0 : shots.length - 1, true); }
      });
      vp.addEventListener('click', () => {
        stopped = true; restart();
        openLightbox(shots.map((s, k) => ({ src: s.currentSrc || s.src, alt: s.alt, label: tabs[k].textContent.trim(), caption: tabs[k].dataset.caption })), idx, (i) => show(i));
      });
      g.addEventListener('pointerenter', () => { paused = true; restart(); });
      g.addEventListener('pointerleave', () => { paused = false; restart(); });
      g.addEventListener('focusin', () => { paused = true; restart(); });
      g.addEventListener('focusout', () => { paused = false; restart(); });
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; restart(); }, { threshold: 0.5 }).observe(g);
      if (back) back.style.backgroundImage = `url("${shots[0].dataset.thumb}")`;
      galleries.push(restart);
    });
    document.addEventListener('visibilitychange', () => galleries.forEach((fn) => fn()));
  }

  /* ---------- lightbox ---------- */
  const lb = $('#lightbox'), lbImg = $('#lb-img'), lbCap = $('#lb-caption'), lbCount = $('#lb-count');
  let lbItems = [], lbIdx = 0, lbSync = null;
  function lbShow(i) {
    lbIdx = (i + lbItems.length) % lbItems.length;
    const it = lbItems[lbIdx];
    lbImg.src = it.src; lbImg.alt = it.alt;
    lbCap.textContent = it.caption ? `${it.label}. ${it.caption}` : it.label;
    lbCount.textContent = `${lbIdx + 1} / ${lbItems.length}`;
    lbSync?.(lbIdx);
  }
  function openLightbox(items, i, sync) { lbItems = items; lbSync = sync; lbShow(i); if (!lb.open) lb.showModal(); }
  function initLightbox() {
    $('#lb-prev').addEventListener('click', () => lbShow(lbIdx - 1));
    $('#lb-next').addEventListener('click', () => lbShow(lbIdx + 1));
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); lbShow(lbIdx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); lbShow(lbIdx + 1); }
    });
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb__stage') || e.target.classList.contains('lb')) lb.close(); });
    let x0 = null;
    lb.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    lb.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 60 && e.pointerType !== 'mouse') lbShow(lbIdx + (dx < 0 ? 1 : -1));
    });
  }

  /* ---------- GitHub data: snapshot first, live when it answers ---------- */
  let snapP;
  const loadSnapshot = () => (snapP ||= fetch('assets/data/repos.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  const liveP = {};
  function loadLive(name) {
    if (liveP[name]) return liveP[name];
    const hit = cache.get('gh:' + name);
    if (hit) return (liveP[name] = Promise.resolve(hit));
    const base = `https://api.github.com/repos/${GH_USER}/${name}`;
    const get = (u) => fetch(u, { headers: { Accept: 'application/vnd.github+json' } }).then((r) => { if (!r.ok) throw new Error('GitHub ' + r.status); return r; });
    return (liveP[name] = (async () => {
      const [meta, commits, languages, countRes] = await Promise.all([
        get(base).then((r) => r.json()),
        get(base + '/commits?per_page=12').then((r) => r.json()),
        get(base + '/languages').then((r) => r.json()),
        get(base + '/commits?per_page=1'),
      ]);
      const branch = meta.default_branch || 'main';
      const [tree, readme] = await Promise.all([
        get(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`).then((r) => r.json()),
        fetch(rawUrl(name, branch, 'README.md')).then((r) => (r.ok ? r.text() : null)).catch(() => null),
      ]);
      const last = /[?&]page=(\d+)>;\s*rel="last"/.exec(countRes.headers.get('link') || '');
      const data = {
        live: true, branch,
        stars: meta.stargazers_count, forks: meta.forks_count, pushed: meta.pushed_at, created: meta.created_at,
        commitCount: last ? +last[1] : (await countRes.json()).length,
        languages,
        commits: commits.map((c) => ({ sha: c.sha, date: c.commit?.author?.date || c.commit?.committer?.date, message: (c.commit?.message || '').split('\n')[0] })),
        tree: (tree.tree || []).filter((t) => t.type === 'blob').map((t) => ({ path: t.path, size: t.size })),
        readme,
      };
      cache.set('gh:' + name, data);
      return data;
    })().catch(() => null));
  }
  async function repoData(name, live) {
    const snap = (await loadSnapshot())[name] || null;
    const base = snap ? { ...snap, live: false } : null;
    if (!live) return base;
    const l = await loadLive(name);
    return l ? { ...(snap || {}), ...l, readme: l.readme || snap?.readme || '' } : base;
  }

  function langParts(langs) {
    const entries = Object.entries(langs || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const top = entries.slice(0, 4);
    const rest = entries.slice(4).reduce((s, [, v]) => s + v, 0);
    if (rest) top.push(['Other', rest]);
    return top.map(([name, v]) => ({ name, v, pct: (v / total) * 100, color: LANG_COLORS[name] || 'var(--fg-3)' }));
  }
  const langBarHTML = (parts) => parts.map((p) => `<i style="flex:${p.v} 1 0;--c:${p.color}" title="${esc(p.name)} ${p.pct.toFixed(1)}%"></i>`).join('');
  const langLegendHTML = (parts) => parts.map((p) => `<span style="--c:${p.color}">${esc(p.name)} <em>${p.pct < 0.1 ? '<0.1' : p.pct.toFixed(1)}%</em></span>`).join('');

  function renderRepoSummaries(name, d) {
    if (!d) return;
    const bar = $(`[data-langbar="${name}"]`);
    if (bar) {
      const parts = langParts(d.languages);
      bar.innerHTML = langBarHTML(parts);
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', 'Languages: ' + parts.map((p) => `${p.name} ${p.pct.toFixed(1)}%`).join(', '));
      let legend = bar.nextElementSibling;
      if (!legend || !legend.classList.contains('langlegend')) { legend = document.createElement('span'); legend.className = 'langlegend'; bar.after(legend); }
      legend.innerHTML = langLegendHTML(parts);
    }
    const stats = $(`[data-repo-stats="${name}"]`);
    if (stats) {
      stats.innerHTML = [
        `<span><b>${d.commitCount}</b> commits</span>`,
        `<span><b>${d.tree.length}</b> files</span>`,
        d.stars != null ? `<span><b>${d.stars}</b> ${d.stars === 1 ? 'star' : 'stars'}</span>` : '',
        `<span>${d.live ? 'live' : 'snapshot'}</span>`,
      ].join('');
    }
    const lastEl = $(`[data-repo-last="${name}"]`);
    if (lastEl && d.commits?.[0]) lastEl.textContent = `${d.commits[0].sha.slice(0, 7)}  ${d.commits[0].message}  ·  ${rel(d.commits[0].date)}`;
    const line = $(`[data-gh-line="${name}"]`);
    if (line) {
      const since = d.firstCommit || d.created;
      line.textContent = `${d.commitCount} commits${since ? ' since ' + fmtMonth(since) : ''} · last push ${rel(d.pushed || d.commits?.[0]?.date)}${d.live ? ' · live from GitHub' : ''}`;
    }
  }
  function initRepoSummaries() {
    const names = Object.keys(REPO_SLUGS);
    loadSnapshot().then(() => names.forEach(async (n) => renderRepoSummaries(n, await repoData(n, false))));
    const go = () => names.forEach(async (n) => { const d = await repoData(n, true); if (d?.live) renderRepoSummaries(n, d); });
    const target = $('#work');
    if (!target || !('IntersectionObserver' in window)) return go();
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '600px 0px' });
    io.observe(target);
  }

  /* ---------- source explorer ---------- */
  const ex = {
    dlg: $('#explorer'), box: $('#ex'), meta: $('#ex-meta'), gh: $('#ex-gh'), side: $('#ex-side'), list: $('#ex-list'),
    filter: $('#ex-filter'), langs: $('#ex-langs'), path: $('#ex-path'), actions: $('#ex-file-actions'), view: $('#ex-view'),
  };
  const st = { repo: null, data: null, tree: null, sizes: new Map(), open: new Set(), file: null, tab: 'files', md: 'preview', token: 0 };
  const fileCache = new Map();

  let libsP;
  const libs = () => (libsP ||= Promise.all(['marked.min.js', 'purify.min.js', 'highlight.min.js'].map((f) => new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'assets/vendor/' + f; s.async = true; s.onload = s.onerror = () => res();
    document.head.appendChild(s);
  }))));

  function buildTree(entries) {
    const top = { name: '', path: '', dirs: new Map(), files: [] };
    for (const { path, size } of entries) {
      const parts = path.split('/');
      let node = top;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { name: parts[i], path: parts.slice(0, i + 1).join('/'), dirs: new Map(), files: [] });
        node = node.dirs.get(parts[i]);
      }
      node.files.push({ name: parts[parts.length - 1], path, size });
    }
    return top;
  }
  const dotColor = (path) => LANG_COLORS[EXT_LANG[extOf(path)]] || 'var(--line-strong)';
  function fileRow(path, label, size, depth, q) {
    let name = esc(label);
    if (q) {
      const i = label.toLowerCase().indexOf(q);
      if (i >= 0) name = esc(label.slice(0, i)) + '<mark>' + esc(label.slice(i, i + q.length)) + '</mark>' + esc(label.slice(i + q.length));
    }
    return `<button type="button" class="tr tr--file" data-file="${esc(path)}" style="--d:${depth}"${path === st.file ? ' aria-current="true"' : ''}><span class="tr__ico"><i style="--c:${dotColor(path)}"></i></span><span class="tr__name">${name}</span><span class="tr__size">${fmtSize(size)}</span></button>`;
  }
  function renderSide() {
    if (!st.data) return;
    if (st.tab === 'history') {
      const d = st.data;
      ex.list.innerHTML = (d.commits || []).map((c) => `<a class="commit" href="https://github.com/${GH_USER}/${st.repo}/commit/${c.sha}" target="_blank" rel="noopener"><span class="commit__msg">${esc(c.message)}</span><span class="commit__meta">${c.sha.slice(0, 7)} · ${esc(rel(c.date))}</span></a>`).join('')
        + `<a class="commit" href="https://github.com/${GH_USER}/${st.repo}/commits" target="_blank" rel="noopener"><span class="commit__meta">All ${d.commitCount} commits on GitHub ↗</span></a>`;
      return;
    }
    const q = ex.filter.value.trim().toLowerCase();
    if (q) {
      const hits = st.data.tree.filter((t) => t.path.toLowerCase().includes(q)).slice(0, 400);
      ex.list.innerHTML = hits.length ? hits.map((t) => fileRow(t.path, t.path, t.size, 0, q)).join('') : `<p class="ex__loading">No files match “${esc(q)}”.</p>`;
      return;
    }
    const rows = [];
    const walk = (node, depth) => {
      [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name)).forEach((d) => {
        const open = st.open.has(d.path);
        rows.push(`<button type="button" class="tr tr--dir" data-dir="${esc(d.path)}" aria-expanded="${open}" style="--d:${depth}"><span class="tr__ico">${ICON.chev}</span><span class="tr__name">${esc(d.name)}</span></button>`);
        if (open) walk(d, depth + 1);
      });
      [...node.files].sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => rows.push(fileRow(f.path, f.name, f.size, depth)));
    };
    walk(st.tree, 0);
    ex.list.innerHTML = rows.join('');
  }
  function renderMeta() {
    const d = st.data;
    ex.meta.innerHTML = [
      `<span class="src${d.live ? ' src--live' : ''}"><i></i>${d.live ? 'Live from GitHub' : 'Snapshot of ' + fmtDate(d.snapshot)}</span>`,
      `<span>branch <b>${esc(d.branch)}</b></span>`,
      `<span><b>${d.commitCount}</b> commits</span>`,
      `<span><b>${d.tree.length}</b> files</span>`,
      d.stars != null ? `<span><b>${d.stars}</b> ${d.stars === 1 ? 'star' : 'stars'}</span>` : '',
      `<span>pushed <b>${esc(rel(d.pushed || d.commits?.[0]?.date))}</b></span>`,
    ].join('');
    const parts = langParts(d.languages);
    ex.langs.innerHTML = parts.length ? `<span class="label">Languages</span><span class="langbar" role="img" aria-label="${esc(parts.map((p) => `${p.name} ${p.pct.toFixed(1)}%`).join(', '))}">${langBarHTML(parts)}</span><span class="langlegend">${langLegendHTML(parts)}</span>` : '';
  }
  function renderCrumbs(path) {
    const parts = path.split('/');
    ex.path.innerHTML = parts.map((p, i) => (i === parts.length - 1 ? `<b>${esc(p)}</b>` : `<span>${esc(p)} / </span>`)).join('');
    ex.path.title = path;
    const blob = blobUrl(st.repo, st.data.branch, path);
    const isMd = extOf(path) === 'md';
    ex.actions.innerHTML = (isMd ? `<button type="button" class="btn btn--sm" data-md-toggle>${st.md === 'preview' ? 'Source' : 'Preview'}</button>` : '')
      + `<a class="btn btn--sm btn--quiet" href="${esc(blob)}" target="_blank" rel="noopener">GitHub ${ICON.out}</a>`;
  }
  function note(title, body, href) {
    ex.view.innerHTML = `<div class="ex__note"><h3>${esc(title)}</h3><p>${esc(body)}</p>${href ? `<a class="btn btn--sm" href="${esc(href)}" target="_blank" rel="noopener">Open on GitHub ${ICON.out}</a>` : ''}</div>`;
  }
  async function fetchText(repo, branch, path) {
    const key = `${repo}@${branch}:${path}`;
    if (fileCache.has(key)) return fileCache.get(key);
    const r = await fetch(rawUrl(repo, branch, path));
    if (!r.ok) throw new Error(String(r.status));
    const t = await r.text();
    fileCache.set(key, t);
    return t;
  }
  function renderCode(text, ext) {
    const lang = HL_LANG[ext];
    let html = esc(text);
    if (window.hljs && lang && hljs.getLanguage(lang)) { try { html = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value; } catch { /* plain */ } }
    const n = Math.max(1, text.split('\n').length - (text.endsWith('\n') ? 1 : 0));
    const gutter = Array.from({ length: n }, (_, i) => i + 1).join('\n');
    ex.view.innerHTML = `<div class="code"><pre class="code__gutter" aria-hidden="true">${gutter}</pre><pre class="code__src"><code class="hljs">${html}</code></pre></div>`;
  }
  function renderMd(md) {
    const safe = window.marked && window.DOMPurify ? DOMPurify.sanitize(marked.parse(md, { gfm: true })) : `<pre>${esc(md)}</pre>`;
    const art = document.createElement('article');
    art.className = 'md';
    art.innerHTML = safe;
    const repo = st.repo, branch = st.data.branch, dir = st.file.includes('/') ? st.file.replace(/[^/]+$/, '') : '';
    art.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!/^(https?:|data:)/i.test(src)) { const p = normPath(dir + decodeURIComponent(src)); img.src = localAsset(repo, p) || rawUrl(repo, branch, p); }
      img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => img.remove(), { once: true });
    });
    art.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (href.startsWith('#')) { a.addEventListener('click', (e) => e.preventDefault()); return; }
      a.target = '_blank'; a.rel = 'noopener';
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return;
      const p = normPath(dir + decodeURIComponent(href.split('#')[0]));
      a.href = blobUrl(repo, branch, p);
      if (st.sizes.has(p)) a.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); openFile(p); });
    });
    if (window.hljs) art.querySelectorAll('pre code').forEach((c) => { try { hljs.highlightElement(c); } catch { /* leave plain */ } });
    ex.view.replaceChildren(art);
  }
  async function openFile(path) {
    if (!st.data) return;
    const repo = st.repo, d = st.data, token = st.token;
    st.file = path;
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) st.open.add(parts.slice(0, i).join('/'));
    renderSide();
    ex.list.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    renderCrumbs(path);
    ex.box.classList.remove('is-side-open');
    ex.view.scrollTo(0, 0);
    const ext = extOf(path), size = st.sizes.get(path), blob = blobUrl(repo, d.branch, path);
    if (IMG_EXT.has(ext)) {
      ex.view.innerHTML = `<div class="ex__img"><img src="${esc(localAsset(repo, path) || rawUrl(repo, d.branch, path))}" alt="${esc(path)}"></div>`;
      $('img', ex.view).addEventListener('error', () => note('Image unavailable', 'GitHub did not serve this image to the page.', blob), { once: true });
      return;
    }
    if (BIN_EXT.has(ext)) return note('Binary file', `${parts[parts.length - 1]} is a ${fmtSize(size)} binary file, so there is no text to show.`, blob);
    if (size > 400000) return note('Large file', `At ${fmtSize(size)} this file is bigger than the viewer renders. GitHub shows it in full.`, blob);
    let text;
    if (path === 'README.md' && d.readme) text = d.readme;
    else {
      ex.view.innerHTML = `<p class="ex__loading">Fetching ${esc(path)}…</p>`;
      try { text = await fetchText(repo, d.branch, path); }
      catch {
        if (token === st.token && st.file === path) note('Could not load this file', 'GitHub did not answer the request from this page. The file is still readable on GitHub.', blob);
        return;
      }
    }
    await libs();
    if (token !== st.token || st.file !== path) return;
    if (ext === 'md' && st.md === 'preview') renderMd(text); else renderCode(text, ext);
  }
  function applyRepo(d, openPath, refresh) {
    st.data = d;
    st.sizes = new Map(d.tree.map((t) => [t.path, t.size]));
    st.tree = buildTree(d.tree);
    renderMeta();
    if (!refresh) { renderSide(); openFile(openPath); return; }
    if (st.file === 'README.md') openFile('README.md'); else renderSide();
  }
  async function selectRepo(name, path) {
    const token = ++st.token;
    st.repo = name; st.open = new Set(); st.file = null; st.data = null;
    $$('[data-ex-repo]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.exRepo === name)));
    ex.gh.href = `https://github.com/${GH_USER}/${name}`;
    ex.filter.value = '';
    ex.meta.innerHTML = '';
    ex.list.innerHTML = '';
    ex.path.textContent = `${GH_USER}/${name}`;
    ex.actions.innerHTML = '';
    ex.view.innerHTML = '<p class="ex__loading">Loading repository…</p>';
    libs();
    const snap = await repoData(name, false);
    if (token !== st.token) return;
    if (snap) applyRepo(snap, path || 'README.md', false);
    const live = await repoData(name, true);
    if (token !== st.token) return;
    if (live?.live) applyRepo(live, path || 'README.md', !!snap);
    else if (!snap) note('Repository unavailable', 'Neither GitHub nor the offline snapshot answered. Try again in a minute.', `https://github.com/${GH_USER}/${name}`);
  }
  function openExplorer(name, path) {
    if (!ex.dlg.open) ex.dlg.showModal();
    if (st.repo === name && st.data && !path) return;
    if (st.repo === name && st.data && path) { openFile(path); return; }
    selectRepo(name, path);
  }
  function initExplorer() {
    $$('[data-ex-repo]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.exRepo !== st.repo) selectRepo(b.dataset.exRepo); }));
    $$('[data-side]').forEach((b) => b.addEventListener('click', () => {
      st.tab = b.dataset.side;
      $$('[data-side]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      ex.side.classList.toggle('is-history', st.tab === 'history');
      renderSide();
    }));
    ex.filter.addEventListener('input', renderSide);
    ex.list.addEventListener('click', (e) => {
      const dir = e.target.closest('[data-dir]');
      if (dir) { const p = dir.dataset.dir; st.open.has(p) ? st.open.delete(p) : st.open.add(p); renderSide(); ex.list.querySelector(`[data-dir="${CSS.escape(p)}"]`)?.focus(); return; }
      const file = e.target.closest('[data-file]');
      if (file) openFile(file.dataset.file);
    });
    ex.actions.addEventListener('click', (e) => {
      if (!e.target.closest('[data-md-toggle]')) return;
      st.md = st.md === 'preview' ? 'source' : 'preview';
      openFile(st.file);
    });
    $('#ex-files-btn').addEventListener('click', () => ex.box.classList.toggle('is-side-open'));
  }

  /* ---------- command menu ---------- */
  const pal = $('#palette'), pIn = $('#palette-input'), pList = $('#palette-list');
  let pItems = [], pSel = 0, files = null;
  const go = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' });
  const liveUrl = (id) => $('#' + id)?.dataset.live;
  const ACTIONS = [
    { g: 'Go to', label: 'Work', hint: 'section', icon: 'hash', run: go('work'), k: 'projects portfolio' },
    { g: 'Go to', label: 'PalBoard', hint: 'project 01', icon: 'hash', run: go('palboard'), k: 'palworld save dashboard' },
    { g: 'Go to', label: 'Somni', hint: 'project 02', icon: 'hash', run: go('somni'), k: 'bedtime story voice' },
    { g: 'Go to', label: 'Project 03', hint: 'incoming', icon: 'hash', run: go('incoming'), k: 'incoming stealth next' },
    { g: 'Go to', label: 'Source', hint: 'section', icon: 'hash', run: go('source'), k: 'code repositories' },
    { g: 'Go to', label: 'Experience', hint: 'section', icon: 'hash', run: go('experience'), k: 'cv resume career jobs pertemba education' },
    { g: 'Go to', label: 'Research', hint: 'section', icon: 'hash', run: go('research'), k: 'ppo cvar reinforcement learning portfolio' },
    { g: 'Go to', label: 'Stack', hint: 'section', icon: 'hash', run: go('stack'), k: 'skills tools technologies' },
    { g: 'Open', label: () => `Open ${new URL(liveUrl('palboard')).host}`, hint: 'new tab', icon: 'out', run: () => openUrl(liveUrl('palboard')), k: 'palboard live site' },
    { g: 'Open', label: () => `Open ${new URL(liveUrl('somni')).host}`, hint: 'new tab', icon: 'out', run: () => openUrl(liveUrl('somni')), k: 'somni live site' },
    { g: 'Source', label: 'Browse PalBoard source', hint: 'explorer', icon: 'code', run: () => openExplorer('PalBoard'), k: 'repo code files' },
    { g: 'Source', label: 'Browse Somni source', hint: 'explorer', icon: 'code', run: () => openExplorer('Somni'), k: 'repo code files' },
    { g: 'Source', label: 'PalBoard on GitHub', hint: 'new tab', icon: 'out', run: () => openUrl(`https://github.com/${GH_USER}/PalBoard`), k: 'repo' },
    { g: 'Source', label: 'Somni on GitHub', hint: 'new tab', icon: 'out', run: () => openUrl(`https://github.com/${GH_USER}/Somni`), k: 'repo' },
    { g: 'Elsewhere', label: 'GitHub profile', hint: 'new tab', icon: 'out', run: () => openUrl(`https://github.com/${GH_USER}`), k: 'repositories' },
    { g: 'Elsewhere', label: 'LinkedIn', hint: 'new tab', icon: 'out', run: () => openUrl(LINKEDIN), k: 'profile social' },
    { g: 'Preferences', label: () => `Switch to ${theme() === 'dark' ? 'light' : 'dark'} theme`, hint: 'theme', icon: 'theme', run: toggleTheme, k: 'dark light mode appearance' },
  ];
  function score(q, text) {
    if (!text) return -1;
    const t = text.toLowerCase(), i = t.indexOf(q);
    if (i === 0) return 100;
    if (i > 0) return 80 - Math.min(i, 40) + (/[\s/._-]/.test(t[i - 1]) ? 12 : 0);
    let qi = 0, gaps = 0, last = -1;
    for (let k = 0; k < t.length && qi < q.length; k++) if (t[k] === q[qi]) { if (last >= 0) gaps += k - last - 1; last = k; qi++; }
    return qi === q.length ? Math.max(1, 30 - gaps) : -1;
  }
  function hl(label, q) {
    const i = q ? label.toLowerCase().indexOf(q) : -1;
    return i < 0 ? esc(label) : esc(label.slice(0, i)) + '<mark>' + esc(label.slice(i, i + q.length)) + '</mark>' + esc(label.slice(i + q.length));
  }
  function renderPalette() {
    const q = pIn.value.trim().toLowerCase();
    const items = [];
    for (const a of ACTIONS) {
      const label = typeof a.label === 'function' ? a.label() : a.label;
      const s = q ? Math.max(score(q, label), score(q, a.k) - 25) : 0;
      if (s >= 0) items.push({ ...a, label, s });
    }
    let groups;
    if (!q) {
      groups = [];
      for (const it of items) { let grp = groups.find((x) => x.name === it.g); if (!grp) groups.push((grp = { name: it.g, items: [] })); grp.items.push(it); }
    } else {
      groups = [{ name: 'Best matches', items: items.sort((a, b) => b.s - a.s).slice(0, 8) }];
      if (q.length >= 2 && files) {
        const hits = [];
        for (const f of files) {
          const base = f.path.split('/').pop();
          const s = Math.max(score(q, base) + 10, score(q, f.path));
          if (s >= 0) hits.push({ g: 'Files', label: f.path, hint: f.repo, icon: 'file', s, run: () => openExplorer(f.repo, f.path) });
        }
        hits.sort((a, b) => b.s - a.s || a.label.length - b.label.length);
        if (hits.length) groups.push({ name: 'Files', items: hits.slice(0, 10) });
      }
    }
    pItems = groups.flatMap((g) => g.items);
    pSel = Math.min(pSel, Math.max(0, pItems.length - 1));
    let n = 0;
    pList.innerHTML = pItems.length ? groups.filter((g) => g.items.length).map((g) => `<li class="palette__group" role="presentation">${esc(g.name)}</li>` + g.items.map((it) => {
      const id = n++;
      return `<li class="palette__item" role="option" id="po-${id}" data-i="${id}" aria-selected="${id === pSel}">${ICON[it.icon] || ''}<span class="palette__label">${hl(it.label, q)}</span><span class="palette__hint">${esc(it.hint || '')}</span></li>`;
    }).join('')).join('') : `<li class="palette__empty" role="presentation">Nothing matches “${esc(pIn.value.trim())}”.</li>`;
    pIn.setAttribute('aria-activedescendant', pItems.length ? 'po-' + pSel : '');
  }
  function movePalette(d) {
    if (!pItems.length) return;
    pSel = (pSel + d + pItems.length) % pItems.length;
    $$('.palette__item', pList).forEach((el) => el.setAttribute('aria-selected', String(+el.dataset.i === pSel)));
    pIn.setAttribute('aria-activedescendant', 'po-' + pSel);
    $('#po-' + pSel)?.scrollIntoView({ block: 'nearest' });
  }
  function runPalette(i) {
    const it = pItems[i];
    if (!it) return;
    pal.close();
    it.run();
  }
  function openPalette() {
    if (pal.open) return;
    pIn.value = ''; pSel = 0;
    renderPalette();
    pal.showModal();
    pIn.focus();
    if (!files) loadSnapshot().then((s) => {
      files = Object.entries(s).flatMap(([repo, d]) => (d.tree || []).map((t) => ({ repo, path: t.path })));
      if (pal.open && pIn.value.trim().length >= 2) renderPalette();
    });
  }
  function initPalette() {
    pIn.addEventListener('input', () => { pSel = 0; renderPalette(); });
    pIn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); runPalette(pSel); }
    });
    pList.addEventListener('pointermove', (e) => {
      const li = e.target.closest('.palette__item');
      if (li && +li.dataset.i !== pSel) { pSel = +li.dataset.i; movePalette(0); }
    });
    pList.addEventListener('click', (e) => { const li = e.target.closest('.palette__item'); if (li) runPalette(+li.dataset.i); });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        pal.open ? pal.close() : openPalette();
        return;
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) { e.preventDefault(); openPalette(); }
    });
  }

  /* ---------- stack evidence ---------- */
  function initStack() {
    const out = $('#evidence');
    if (!out) return;
    const empty = out.innerHTML;
    const map = new Map();
    $$('[data-uses]').forEach((el) => el.dataset.uses.split(',').forEach((u) => {
      const k = u.trim();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(el);
    }));
    const kind = (el) => (el.classList.contains('project') ? 'project' : el.classList.contains('log__item') ? 'role' : 'research');
    const tools = $$('.tool');
    tools.forEach((t) => {
      const n = map.get(t.textContent.trim())?.length;
      if (n) t.dataset.count = n;
      t.setAttribute('aria-pressed', 'false');
      t.addEventListener('click', () => {
        const on = t.getAttribute('aria-pressed') !== 'true';
        tools.forEach((x) => x.setAttribute('aria-pressed', 'false'));
        if (!on) { out.innerHTML = empty; return; }
        t.setAttribute('aria-pressed', 'true');
        const name = t.textContent.trim(), hits = map.get(name) || [];
        out.innerHTML = `<p class="evidence__title">${esc(name)}</p>` + (hits.length
          ? `<ul class="evidence__list">${hits.map((el) => `<li><a href="#${el.id}" data-lit="${el.id}">${esc(el.dataset.title)} <small>${kind(el)}</small></a></li>`).join('')}</ul>`
          : '<p class="evidence__none">Listed on my CV, with no public project to point to yet.</p>');
      });
    });
    out.addEventListener('click', (e) => {
      const a = e.target.closest('[data-lit]');
      if (!a) return;
      const el = document.getElementById(a.dataset.lit);
      el?.classList.add('is-lit');
      setTimeout(() => el?.classList.remove('is-lit'), 2400);
    });
  }

  /* ---------- research chart tooltip ---------- */
  function initBars() {
    const plot = $('#bars .bars__plot'), tip = $('#bars-tip');
    if (!plot || !tip) return;
    const show = (bar, x) => {
      tip.textContent = bar.dataset.tip;
      tip.hidden = false;
      const pr = plot.getBoundingClientRect(), fr = $('.bar__fill', bar).getBoundingClientRect();
      const half = Math.min(130, pr.width / 2);
      tip.style.left = Math.max(half, Math.min(pr.width - half, (x ?? fr.right) - pr.left)) + 'px';
      tip.style.top = fr.top - pr.top + 'px';
    };
    $$('.bar', plot).forEach((b) => {
      b.addEventListener('pointermove', (e) => show(b, e.clientX));
      b.addEventListener('pointerleave', () => { tip.hidden = true; });
      b.addEventListener('focus', () => show(b));
      b.addEventListener('blur', () => { tip.hidden = true; });
    });
  }

  /* ---------- project 03: static and scramble ---------- */
  function initIncoming() {
    const c = $('#static');
    if (c && c.getContext) {
      const ctx = c.getContext('2d'), W = 120, H = 52;
      c.width = W; c.height = H;
      let colors = [], visible = false, last = 0;
      const read = () => { const cs = getComputedStyle(root); colors = ['--panel', '--fg-3', '--signal'].map((v) => cs.getPropertyValue(v).trim()); };
      const draw = (now = performance.now()) => {
        ctx.globalAlpha = 1; ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = colors[1];
        for (let i = 0; i < 1100; i++) { ctx.globalAlpha = Math.random() * 0.42; ctx.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1); }
        ctx.globalAlpha = 0.1; ctx.fillRect(0, ((now / 70) % (H + 6)) - 6, W, 4);
        ctx.fillStyle = colors[2]; ctx.globalAlpha = 0.8;
        for (let i = 0; i < 5; i++) ctx.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1);
      };
      const loop = (now) => {
        if (!visible || !motionOK()) return;
        if (now - last > 85) { draw(now); last = now; }
        requestAnimationFrame(loop);
      };
      read(); draw();
      themeListeners.push(() => { read(); draw(); });
      if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) requestAnimationFrame(loop); }).observe(c);
    }
    const s = $('.scramble');
    if (!s || !motionOK()) return;
    const final = s.dataset.scramble, glyphs = 'X#/\\|<>_=+*01';
    let seen = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { seen = e.isIntersecting; }).observe(s);
    setInterval(() => {
      if (!seen || document.hidden) return;
      let f = 0;
      const id = setInterval(() => {
        f++;
        s.textContent = Array.from(final, (ch, i) => (i < (f / 18) * final.length ? ch : glyphs[(Math.random() * glyphs.length) | 0])).join('');
        if (f >= 18) { clearInterval(id); s.textContent = final; }
      }, 40);
    }, 5200);
  }

  /* ---------- nav and wiring ---------- */
  function initSpy() {
    const links = $$('.nav__links a');
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      byId.get(e.target.id)?.setAttribute('aria-current', 'true');
    }), { rootMargin: '-45% 0px -50% 0px' });
    ['top', ...byId.keys()].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
  function initWiring() {
    $$('[data-mod]').forEach((k) => { k.textContent = isMac ? '⌘' : 'Ctrl'; });
    $$('[data-open-palette]').forEach((b) => b.addEventListener('click', openPalette));
    $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', toggleTheme));
    $$('[data-open-explorer]').forEach((b) => b.addEventListener('click', () => openExplorer(b.dataset.openExplorer)));
    $$('dialog').forEach((d) => {
      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
      $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
    });
    const h = location.hash.slice(1).toLowerCase();
    const deep = { 'src-palboard': 'PalBoard', 'src-somni': 'Somni' }[h];
    if (deep) openExplorer(deep);
  }

  syncTheme();
  initWiring();
  initHex();
  initGalleries();
  initLightbox();
  initExplorer();
  initPalette();
  initRepoSummaries();
  initStack();
  initBars();
  initIncoming();
  initSpy();
})();
