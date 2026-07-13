/* =========================================================
   H. P. Lovecraft — lógica del catálogo
   Carga js/lovecraft-data.json, permite buscar, filtrar por
   categoría, ordenar por fecha y alternar entre vista lista/bloques.
   ========================================================= */

(function () {
  'use strict';

  const CATEGORY_LABELS = {
    esoterico: 'Esotérico',
    cosmico: 'Cósmico',
    monstruos: 'Monstruos',
    suenos: 'Sueños',
    mundos: 'Mundos',
  };
  const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);

  const state = {
    all: [],
    query: '',
    categories: new Set(),
    sortBy: null,       // 'publish' | 'writing' | null
    sortDir: 'asc',      // 'asc' | 'desc'
    view: 'list',         // 'list' | 'grid'
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheEls();
    bindEvents();
    initIconRiver();
    try {
      const res = await fetch('js/lovecraft-data.json');
      state.all = await res.json();
    } catch (err) {
      console.error('No se pudo cargar lovecraft-data.json', err);
      els.noResults.textContent = 'No se pudo cargar el catálogo. Si abriste el archivo directamente en el navegador, ejecuta un servidor local (ej. "npx serve").';
      els.noResults.classList.add('show');
      return;
    }
    render();
  }

  function cacheEls() {
    els.searchForm = document.getElementById('search-form');
    els.searchInput = document.getElementById('search-input');
    els.categoryToggle = document.getElementById('category-toggle');
    els.categoryMenu = document.getElementById('category-menu');
    els.sortPublish = document.getElementById('sort-publish');
    els.sortWriting = document.getElementById('sort-writing');
    els.viewList = document.getElementById('view-list');
    els.viewGrid = document.getElementById('view-grid');
    els.btnClear = document.getElementById('btn-clear');
    els.listView = document.getElementById('list-view');
    els.gridView = document.getElementById('grid-view');
    els.noResults = document.getElementById('no-results');
    els.resultsCount = document.getElementById('results-count');
  }

  function bindEvents() {
    els.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.query = els.searchInput.value.trim().toLowerCase();
      render();
    });
    els.searchInput.addEventListener('input', () => {
      state.query = els.searchInput.value.trim().toLowerCase();
      render();
    });

    els.categoryToggle.addEventListener('click', () => {
      const open = els.categoryMenu.classList.toggle('open');
      els.categoryToggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.category-dropdown')) {
        els.categoryMenu.classList.remove('open');
        els.categoryToggle.setAttribute('aria-expanded', 'false');
      }
    });
    els.categoryMenu.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.checked) state.categories.add(cb.value);
        else state.categories.delete(cb.value);
        updateCategoryToggleLabel();
        render();
      });
    });

    [els.sortPublish, els.sortWriting].forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sort;
        if (state.sortBy === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortBy = key;
          state.sortDir = 'asc';
        }
        updateSortButtons();
        render();
      });
    });

    els.viewList.addEventListener('click', () => setView('list'));
    els.viewGrid.addEventListener('click', () => setView('grid'));

    els.btnClear.addEventListener('click', resetAll);
  }

  function updateCategoryToggleLabel() {
    const n = state.categories.size;
    els.categoryToggle.firstChild.textContent = n ? `Categorías (${n}) ` : 'Categorías ';
    els.categoryToggle.classList.toggle('active', n > 0);
  }

  function updateSortButtons() {
    [els.sortPublish, els.sortWriting].forEach((btn) => {
      const isActive = state.sortBy === btn.dataset.sort;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('desc', isActive && state.sortDir === 'desc');
    });
  }

  function setView(view) {
    state.view = view;
    els.viewList.classList.toggle('active', view === 'list');
    els.viewGrid.classList.toggle('active', view === 'grid');
    els.viewList.setAttribute('aria-pressed', String(view === 'list'));
    els.viewGrid.setAttribute('aria-pressed', String(view === 'grid'));
    els.listView.style.display = view === 'list' ? '' : 'none';
    els.gridView.style.display = view === 'grid' ? '' : 'none';
  }

  function resetAll() {
    state.query = '';
    state.categories.clear();
    state.sortBy = null;
    state.sortDir = 'asc';
    els.searchInput.value = '';
    els.categoryMenu.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
    updateCategoryToggleLabel();
    updateSortButtons();
    setView('list');
    render();
  }

  function matchesQuery(item, q) {
    if (!q) return true;
    const haystack = [
      item.titleEnglish,
      item.titleSpanish,
      item.coAutor || '',
      ...(item.topics || []),
      ...(item.category || []).map((c) => CATEGORY_LABELS[c] || c),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  }

  function getFiltered() {
    let list = state.all.filter((item) => matchesQuery(item, state.query));
    if (state.categories.size) {
      const selected = Array.from(state.categories);
      // Intersección: el cuento debe tener TODAS las categorías seleccionadas, no solo alguna.
      list = list.filter((item) => selected.every((c) => (item.category || []).includes(c)));
    }
    if (state.sortBy) {
      const dir = state.sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = a[state.sortBy] ?? 0;
        const bv = b[state.sortBy] ?? 0;
        return (av - bv) * dir;
      });
    }
    return list;
  }

  function categoryIconsMarkup(categories) {
    return (categories || [])
      .map((c) => `<svg title="${CATEGORY_LABELS[c] || c}"><use href="#icon-${c}"/></svg>`)
      .join('');
  }

  function readLink(item) {
    if (!item.reading) return '';
    return `js/lovecraftstories.html?no=${item.no}`;
  }

  function render() {
    const list = getFiltered();
    els.resultsCount.textContent = `${list.length} cuento${list.length === 1 ? '' : 's'} encontrado${list.length === 1 ? '' : 's'}`;
    els.noResults.classList.toggle('show', list.length === 0);
    renderList(list);
    renderGrid(list);
  }

  function renderList(list) {
    const head = `
      <div class="list-row list-head">
        <div>Título (inglés)</div>
        <div>Título (español)</div>
        <div>Escritura</div>
        <div>Publicación</div>
        <div>Categorías</div>
        <div></div>
      </div>`;
    const rows = list
      .map((item) => {
        const link = readLink(item);
        const tag = link ? 'a' : 'div';
        const hrefAttr = link ? ` href="${link}"` : '';
        const stateClass = link ? 'has-reading' : 'no-reading';
        return `
        <${tag} class="list-row ${stateClass}"${hrefAttr}>
          <div class="list-cell-title title-en">
            <span class="story-no">Nº ${item.no}</span>
            <span class="story-title-en">${escapeHtml(item.titleEnglish)}</span>
            ${item.coAutor ? `<span class="story-coauthor">con ${escapeHtml(item.coAutor)}</span>` : ''}
          </div>
          <div class="list-cell-title title-es">
            <span class="story-title-es">${escapeHtml(item.titleSpanish)}</span>
          </div>
          <div class="list-cell-year">${item.writing ?? '—'}</div>
          <div class="list-cell-year">${item.publish ?? '—'}</div>
          <div class="list-cell-icons">${categoryIconsMarkup(item.category)}</div>
          <div class="list-cell-action">
            ${link ? `<span class="read-indicator" title="Leer cuento"><svg><use href="#icon-book"/></svg></span>` : ''}
          </div>
        </${tag}>`;
      })
      .join('');
    els.listView.innerHTML = list.length ? head + rows : '';
  }

  function renderGrid(list) {
    els.gridView.innerHTML = list
      .map((item) => {
        const link = readLink(item);
        const tag = link ? 'a' : 'div';
        const hrefAttr = link ? ` href="${link}"` : '';
        const stateClass = link ? 'has-reading' : 'no-reading';
        return `
        <${tag} class="story-card ${stateClass}"${hrefAttr}>
          <span class="story-no">Nº ${item.no}</span>
          <h3 class="story-title-en">${escapeHtml(item.titleEnglish)}</h3>
          <p class="story-title-es">${escapeHtml(item.titleSpanish)}</p>
          ${item.coAutor ? `<span class="story-coauthor">con ${escapeHtml(item.coAutor)}</span>` : ''}
          <div class="story-meta">
            <span>Escrito<b>${item.writing ?? '—'}</b></span>
            <span>Publicado<b>${item.publish ?? '—'}</b></span>
          </div>
          <div class="story-icons">${categoryIconsMarkup(item.category)}</div>
          <div class="story-footer">
            ${link ? `<span class="read-indicator"><svg><use href="#icon-book"/></svg>Leer</span>` : ''}
          </div>
        </${tag}>`;
      })
      .join('');
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function initIconRiver() {
    const container = document.getElementById('icon-river');
    if (!container) return;

    const count = Math.round(random(20, 30)); // entre 20 y 30 visibles
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const key = CATEGORY_KEYS[Math.floor(Math.random() * CATEGORY_KEYS.length)];
      const size = random(4.2, 5.8); // ~5% del viewport, con variación
      const duration = random(22, 42); // velocidades distintas de "corriente"
      const delay = -random(0, duration); // negativo: arranca a media animación, llena la pantalla desde el inicio
      const top = random(-2, 92);
      const drift = random(-3, 3); // balanceo vertical tipo río
      const opacity = random(0.12, 0.28);

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'river-icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.style.setProperty('--size', `${size.toFixed(2)}vw`);
      svg.style.setProperty('--duration', `${duration.toFixed(2)}s`);
      svg.style.setProperty('--delay', `${delay.toFixed(2)}s`);
      svg.style.setProperty('--top', `${top.toFixed(2)}%`);
      svg.style.setProperty('--drift', `${drift.toFixed(2)}vh`);
      svg.style.setProperty('--opacity', opacity.toFixed(2));

      const use = document.createElementNS(svgNS, 'use');
      use.setAttribute('href', `#icon-${key}`);
      svg.appendChild(use);
      frag.appendChild(svg);
    }
    container.appendChild(frag);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
