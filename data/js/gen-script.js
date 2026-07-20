/* =========================================================
   UMBRAL — generador de ideas narrativas
   Los bancos de palabras viven en words.json (3 objetos
   independientes: historiasPropias, historiasAjenas, lovecraft).
   Este script los carga por separado — no comparten arreglo.
   ========================================================= */

// las 3 variables quedan vacías hasta que loadWordBanks() las llena;
// a partir de ahí cada una es independiente de las otras dos
let historiasPropias = [];
let historiasAjenas = [];
let lovecraft = [];
let ALL_WORDS_POOL = []; // sólo para el respaldo local (Etapa 2), se arma a partir de las 3 anteriores

// Etapa 4: también viven en words.json, como dos objetos más, separados
// de los bancos de palabras de arriba
let generosTerror = [];          // 19 subcategorías del pentagrama del horror
let situacionesDramaticas = [];  // 36 situaciones de Georges Polti: [{titulo, elementos}]

const CATS = [
  { key: 'propias',   label: 'Historias Propias' },
  { key: 'ajenas',    label: 'Historias Ajenas' },
  { key: 'lovecraft', label: 'Lovecraft' }
];

// une cada clave de categoría con SU PROPIA constante — cada llamada
// aquí toca un solo banco, nunca uno combinado
function bankForCat(catKey){
  if (catKey === 'propias') return historiasPropias;
  if (catKey === 'ajenas') return historiasAjenas;
  if (catKey === 'lovecraft') return lovecraft;
  return [];
}

async function loadWordBanks(){
  const res = await fetch('js/gen-words.json');
  if (!res.ok) throw new Error('No se pudo leer words.json (' + res.status + ')');
  const data = await res.json();

  // tres invocaciones separadas, una por columna — así se nota en el
  // código que historiasPropias, historiasAjenas y lovecraft son bancos
  // independientes y no vistas de un mismo arreglo
  historiasPropias = Array.isArray(data.historiasPropias) ? data.historiasPropias : [];
  historiasAjenas  = Array.isArray(data.historiasAjenas)  ? data.historiasAjenas  : [];
  lovecraft        = Array.isArray(data.lovecraft)        ? data.lovecraft        : [];
  generosTerror         = Array.isArray(data.generosTerror) ? data.generosTerror : [];
  situacionesDramaticas = Array.isArray(data.situacionesDramaticas) ? data.situacionesDramaticas : [];

  const seen = new Map();
  [...historiasAjenas, ...historiasPropias, ...lovecraft].forEach((w) => {
    const k = w.toLowerCase();
    if (!seen.has(k)) seen.set(k, w);
  });
  ALL_WORDS_POOL = [...seen.values()];
}

/* ---------- estado ---------- */

function freshBank(catKey){
  return { pos: 0, shuffled: shuffle(bankForCat(catKey)) };
}

function createClaveState(){
  return {
    words: ['', '', ''],
    fillCursor: 0,
    banks: {
      propias:   freshBank('propias'),
      ajenas:    freshBank('ajenas'),
      lovecraft: freshBank('lovecraft')
    },
    drawn: { propias: null, ajenas: null, lovecraft: null }
  };
}

function createDesgloseState(){
  return {
    initializedFromClave: false,
    roots: ['', '', ''],        // las 3 palabras de partida (una por árbol)
    trees: [null, null, null],  // datos generados por árbol: { root, status, rootTour, rootPos, rootSource, level1 }
    selected: ['', '', ''],     // las 3 palabras finales elegidas (libres, no atadas a un árbol)
    fillCursor: 0                // rotación 1→2→3→1… igual que en Clave
  };
}

function createConceptoState(){
  return {
    initializedFromDesglose: false,
    words: ['', '', ''],
    cards: [null, null, null] // { status, definicion, parteGramatical, ejemplo, sinonimos:[] }
  };
}
function createContextoState(){
  return {
    generoTour: { shuffled: [], pos: 0 },
    genero: '',                          // resultado actual, editable
    situacionesTour: { shuffled: [], pos: 0 },
    situaciones: ['', ''],               // los 2 resultados actuales, editables
    situacionesCaptions: ['', '']        // "elementos" de cada situación, sólo informativo
  };
}

function createConclusionState(){
  return {
    initialized: false, // ya se trajeron los datos de los pasos 2 y 4
    words: ['', '', ''],
    genero: '',
    situaciones: ['', ''],
    texto: ''
  };
}

// el estado de cada etapa se llena hasta que loadWordBanks() termina
// (ver init() al final del archivo)
const appState = {
  activeStage: 'clave',
  clave: null,
  desglose: null,
  concepto: null,
  contexto: null,
  conclusion: null
};

/* ---------- utilidades ---------- */

function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (s) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

/* saca las siguientes 3 palabras únicas del recorrido de un banco;
   si el banco se agotó, lo vuelve a barajar (así se completa un
   recorrido entero antes de repetir palabra) */
function drawNext(catKey){
  const bank = appState.clave.banks[catKey];
  if (bank.pos + 3 > bank.shuffled.length){
    bank.shuffled = shuffle(bankForCat(catKey));
    bank.pos = 0;
  }
  const words = bank.shuffled.slice(bank.pos, bank.pos + 3);
  bank.pos += 3;
  appState.clave.drawn[catKey] = words;
  return words;
}

// mismo mecanismo que drawNext pero genérico: recorre `sourceList` sin
// repetir hasta agotarla, entonces vuelve a barajar. Se usa en Etapa 4
// para las dos tómbolas (género y situaciones dramáticas).
function drawFromTour(tourState, sourceList, count){
  if (tourState.shuffled.length < sourceList.length){
    tourState.shuffled = shuffle(sourceList);
    tourState.pos = 0;
  }
  if (tourState.pos + count > tourState.shuffled.length){
    tourState.shuffled = shuffle(sourceList);
    tourState.pos = 0;
  }
  const picked = tourState.shuffled.slice(tourState.pos, tourState.pos + count);
  tourState.pos += count;
  return picked;
}

function capitalizeWord(w){
  const clean = String(w).trim();
  if (!clean) return clean;
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

// clave de comparación que ignora acentos y mayúsculas, para no mostrar
// "Brujeria" y "Brujería" como si fueran dos palabras distintas
function normalizeForDedup(w){
  return String(w).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function localFallbackWords(excludeWord, count){
  const excludeKey = normalizeForDedup(excludeWord);
  const pool = ALL_WORDS_POOL.filter((w) => normalizeForDedup(w) !== excludeKey);
  return shuffle(pool).slice(0, count);
}

/* ---------- Etapa 2: fuentes externas (Datamuse + MyMemory + respaldo local) ----------

   Por qué el español directo de Datamuse (ml=...&v=es) a veces da resultados
   raros o vacíos: su relación "means-like" se construye con WordNet + OneLook
   + word2vec, que son recursos sobre todo en INGLÉS; "v=es" sólo filtra la
   salida a palabras que existen en un vocabulario español de 500 mil
   términos, pero el motor semántico de fondo sigue razonando en inglés. Por
   eso "inmortalidad" puede devolver algo como "revancha" — coincidencia de
   vocabulario, no de significado — y una palabra común como "espacio" puede
   no encontrar nada.

   Para mejorar esto, la palabra RAÍZ de cada árbol (nivel 1) se traduce al
   inglés con MyMemory (gratis, sin llave), se consulta el Datamuse en inglés
   —ahí sí con todo WordNet/OneLook detrás— y esos resultados se traducen de
   vuelta al español. Es más lento (varias llamadas) pero da matches mucho
   más relacionados. Las palabras de nivel 2 (las hojas) usan sólo la
   consulta directa en español para no multiplicar las llamadas por 4.
------------------------------------------------------------------------- */

// caché de traducciones (guarda la promesa, evita traducir la misma
// palabra dos veces si dos árboles la piden a la vez)
const translateCache = new Map();

function translateWord(word, from, to){
  const key = `${from}|${to}|${word.trim().toLowerCase()}`;
  if (translateCache.has(key)) return translateCache.get(key);
  const promise = (async () => {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${from}|${to}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const text = data && data.responseData && data.responseData.translatedText;
      if (!text || typeof text !== 'string') return null;
      return text.trim();
    } catch (err){
      return null;
    }
  })();
  translateCache.set(key, promise);
  return promise;
}

// traduce la palabra al inglés, consulta el Datamuse en inglés (mucho más
// rico) y traduce de vuelta los mejores candidatos
async function fetchRelatedViaEnglish(word){
  const en = await translateWord(word, 'es', 'en');
  if (!en) return []; // sólo si la traducción falló de verdad (null); los cognados (mismo string) sí siguen

  let enCandidates = [];
  try {
    const url = `https://api.datamuse.com/words?ml=${encodeURIComponent(en)}&max=25`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    enCandidates = data
      .map((item) => item.word)
      .filter((w) => typeof w === 'string' && w.trim() && !w.includes(' '))
      .slice(0, 6); // se limitan las traducciones de vuelta para no gastar cuota de más
  } catch (err){
    return [];
  }

  const backTranslations = await Promise.all(enCandidates.map((w) => translateWord(w, 'en', 'es')));
  const seen = new Set();
  const results = [];
  const rootKey = normalizeForDedup(word);
  backTranslations.forEach((w) => {
    if (!w) return;
    const cap = capitalizeWord(w);
    const k = normalizeForDedup(cap);
    if (k === rootKey || seen.has(k)) return;
    seen.add(k);
    results.push(cap);
  });
  return results;
}

// consulta Datamuse directo en español (ml=...&v=es)
async function fetchRelatedDirect(word){
  try {
    const url = `https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&v=es&max=25`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const seen = new Set();
    const rootKey = normalizeForDedup(word);
    return data
      .map((item) => item.word)
      .filter((w) => typeof w === 'string' && w.trim() && !w.includes(' '))
      .map(capitalizeWord)
      .filter((w) => {
        const k = normalizeForDedup(w);
        if (k === rootKey || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  } catch (err){
    return [];
  }
}

// pone primero las palabras que ya existen en nuestro banco local
// (vocabulario ya validado temáticamente), sin descartar las demás
function prioritizeLocalOverlap(list){
  const localSet = new Set(ALL_WORDS_POOL.map(normalizeForDedup));
  const inLocal = list.filter((w) => localSet.has(normalizeForDedup(w)));
  const rest = list.filter((w) => !localSet.has(normalizeForDedup(w)));
  return [...inLocal, ...rest];
}

// caché de resultados combinados por palabra (+ si se pidió con pivote a inglés)
const relatedCache = new Map();

// opts.pivot = true → además del español directo, traduce vía inglés
// (se usa sólo para la raíz de cada árbol, no para las hojas)
function fetchRelated(word, opts = {}){
  const usePivot = !!opts.pivot;
  const trimmed = word.trim();
  if (!trimmed) return Promise.resolve({ words: [], source: 'local' });

  const key = (usePivot ? 'pivot:' : 'direct:') + normalizeForDedup(trimmed);
  if (relatedCache.has(key)) return relatedCache.get(key);

  const promise = (async () => {
    const [direct, pivoted] = await Promise.all([
      fetchRelatedDirect(trimmed),
      usePivot ? fetchRelatedViaEnglish(trimmed) : Promise.resolve([])
    ]);

    const seenAll = new Set();
    let combined = [...prioritizeLocalOverlap(pivoted), ...prioritizeLocalOverlap(direct)].filter((w) => {
      const k = normalizeForDedup(w);
      if (seenAll.has(k)) return false;
      seenAll.add(k);
      return true;
    });

    let source = 'local';
    if (pivoted.length) source = 'api-en';
    else if (direct.length >= 4) source = 'api';

    if (combined.length < 8){
      const fallback = localFallbackWords(trimmed, 12).filter((w) => !seenAll.has(normalizeForDedup(w)));
      combined = combined.concat(fallback);
    }
    return { words: combined, source };
  })();

  relatedCache.set(key, promise);
  return promise;
}

/* ---------- Etapa 3: fuentes externas (dictionaryapi.dev + Datamuse rel_syn/rel_ant) ----------

   dictionaryapi.dev sí tiene un endpoint directo en español
   (entries/es/palabra), así que la definición se intenta ahí primero —
   sin traducir nada. Sólo si esa palabra no tiene entrada en español se
   traduce al inglés, se busca ahí y se traduce la definición de vuelta.

   Para sinónimos/antónimos se usa Datamuse con rel_syn / rel_ant, que son
   relaciones reales de WordNet — más precisas que el "means-like" que usa
   Desglose — pero sólo existen en inglés, así que aquí SIEMPRE se pasa por
   la traducción.

   La etimología depende de que dictionaryapi.dev la tenga cargada, lo cual
   es bastante irregular incluso en inglés; para palabras coloquiales o
   inventadas es normal que no aparezca — se muestra "No disponible".
------------------------------------------------------------------------- */

const POS_ES = {
  noun: 'sustantivo', verb: 'verbo', adjective: 'adjetivo', adverb: 'adverbio',
  pronoun: 'pronombre', preposition: 'preposición', conjunction: 'conjunción',
  interjection: 'interjección', exclamation: 'interjección', article: 'artículo',
  determiner: 'determinante', numeral: 'numeral'
};

function posToSpanish(pos){
  if (!pos) return '';
  const known = POS_ES[pos.trim().toLowerCase()];
  return known || capitalizeWord(pos);
}

async function fetchDictionaryEntry(word, lang){
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    const entry = data[0];
    const meaning = (entry.meanings && entry.meanings[0]) || null;
    const def = meaning && meaning.definitions && meaning.definitions[0];
    return {
      definicion: def ? (def.definition || '') : '',
      etimologia: entry.origin || '',
      parteGramatical: meaning ? (meaning.partOfSpeech || '') : '',
      ejemplo: def ? (def.example || '') : ''
    };
  } catch (err){
    return null;
  }
}

async function lookupDictionary(word){
  const direct = await fetchDictionaryEntry(word, 'es');
  if (direct && direct.definicion){
    return {
      definicion: direct.definicion,
      parteGramatical: posToSpanish(direct.parteGramatical),
      ejemplo: direct.ejemplo
    };
  }

  // sin entrada directa en español: se traduce y se busca en inglés,
  // luego se traduce la definición (y el ejemplo, si hay) de vuelta
  const en = await translateWord(word, 'es', 'en');
  if (!en){
    return { definicion: '', parteGramatical: '', ejemplo: '' };
  }
  const enEntry = await fetchDictionaryEntry(en, 'en');
  if (!enEntry || !enEntry.definicion){
    return { definicion: '', parteGramatical: '', ejemplo: '' };
  }
  const [defEs, ejEs] = await Promise.all([
    translateWord(enEntry.definicion, 'en', 'es'),
    enEntry.ejemplo ? translateWord(enEntry.ejemplo, 'en', 'es') : Promise.resolve('')
  ]);
  return {
    definicion: defEs || '',
    parteGramatical: posToSpanish(enEntry.parteGramatical),
    ejemplo: ejEs || ''
  };
}

async function fetchDatamuseRel(relCode, englishWord){
  try {
    const url = `https://api.datamuse.com/words?${relCode}=${encodeURIComponent(englishWord)}&max=10`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .map((item) => item.word)
      .filter((w) => typeof w === 'string' && w.trim() && !w.includes(' '));
  } catch (err){
    return [];
  }
}

async function backTranslateTop3(word, englishList){
  const top = englishList.slice(0, 3);
  const translated = await Promise.all(top.map((w) => translateWord(w, 'en', 'es')));
  const rootKey = normalizeForDedup(word);
  const seen = new Set();
  const out = [];
  translated.forEach((w) => {
    if (!w) return;
    const cap = capitalizeWord(w);
    const k = normalizeForDedup(cap);
    if (k === rootKey || seen.has(k)) return;
    seen.add(k);
    out.push(cap);
  });
  return out;
}

async function lookupSynonyms(word){
  const en = await translateWord(word, 'es', 'en');
  if (!en){
    return { sinonimos: [] };
  }
  const synEn = await fetchDatamuseRel('rel_syn', en);
  let sinonimos = await backTranslateTop3(word, synEn);
  // rel_syn (WordNet) a veces no tiene nada; se completa con el "means-like"
  // vía inglés (sin relleno de banco local: aquí la tabla es de referencia,
  // no de brainstorming, así que si no hay nada genuinamente relacionado
  // se deja en "No disponible" en vez de mostrar palabras al azar)
  if (!sinonimos.length){
    const viaEnglish = await fetchRelatedViaEnglish(word);
    sinonimos = viaEnglish.slice(0, 3);
  }
  return { sinonimos };
}

/* ---------- referencias al DOM fijo ---------- */

const stageContentEl = document.getElementById('stage-content');
const tabEls = document.querySelectorAll('.tab');
const btnPrint = document.getElementById('btn-print');
const btnReset = document.getElementById('btn-reset');

/* ---------- render: Etapa 1 · Clave ---------- */

function wordCardHTML(cat){
  const drawn = appState.clave.drawn[cat.key];
  const hasWords = drawn && drawn.length > 0;
  const listContent = hasWords
    ? drawn.map((w) => `<li><button type="button" class="word-chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button></li>`).join('')
    : `<li class="word-list-hint">Presiona «Barajar» para revelar tres palabras.</li>`;

  return `
    <div class="word-card" data-cat="${cat.key}">
      <div class="word-card-head">
        <h3 class="word-card-title">${cat.label}</h3>
        <button class="btn-shuffle" type="button" data-cat="${cat.key}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h3.5c1.5 0 2.3.6 3.1 1.7l5.8 8.6c.8 1.1 1.6 1.7 3.1 1.7H21M4 17h3.5c1.5 0 2.3-.6 3.1-1.7l.7-1M15.4 8.7c.8-1.1 1.6-1.7 3.1-1.7H21"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>
          <span>Barajar</span>
        </button>
      </div>
      <ul class="word-list ${hasWords ? '' : 'is-empty'}" data-cat="${cat.key}" role="list">
        ${listContent}
      </ul>
    </div>`;
}

function claveInputBlockHTML(i){
  const val = appState.clave.words[i];
  return `
    <div class="input-block" data-slot-wrap="${i}">
      <label for="clave-input-${i}">Palabra ${i + 1}</label>
      <input
        class="word-input ${val.trim() ? 'is-filled' : ''}"
        id="clave-input-${i}"
        data-slot="${i}"
        data-stage="clave"
        type="text"
        placeholder="Escribe o elige arriba…"
        value="${escapeHtml(val)}"
        autocomplete="off">
    </div>`;
}

function renderClave(){
  CATS.forEach((cat) => {
    if (!appState.clave.drawn[cat.key]) drawNext(cat.key);
  });

  stageContentEl.innerHTML = `
    <div class="stage-head">
      <span class="stage-kicker">Etapa I · el origen</span>
      <h1 class="stage-title">Clave</h1>
      <p class="stage-sub">Tres orillas distintas de donde puede nacer tu historia. Elige una palabra de cada una.</p>
    </div>

    <div class="grid-3">
      ${CATS.map(wordCardHTML).join('')}
    </div>

    <p class="section-label">Escribe una palabra en cada recuadro:</p>
    <div class="grid-3">
      ${[0, 1, 2].map(claveInputBlockHTML).join('')}
    </div>

    <div class="actions-row">
      <span class="validation-msg" id="clave-validation">Completa las tres palabras para continuar.</span>
      <button class="btn-primary" id="btn-next-stage" type="button">
        Siguiente
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </div>
  `;
}

/* ---------- render: Etapa 2 · Desglose (árbol de 3 niveles) ---------- */

function treeCardInnerHTML(i){
  const d = appState.desglose;
  const root = d.roots[i];
  const tree = d.trees[i];

  if (!root.trim()){
    return `<p class="tree-hint">Escribe una palabra arriba y presiona Enter.</p>`;
  }
  if (!tree || tree.status === 'loading' || tree.status === 'loading-level2'){
    return `<p class="tree-hint tree-hint--loading">Consultando Datamuse…</p>`;
  }
  if (tree.status === 'error' || !tree.level1.length){
    return `<p class="tree-hint">No se pudo generar el árbol. Intenta de nuevo.</p>`;
  }

  const branches = tree.level1.map((node) => `
    <li class="tree-node">
      <button type="button" class="tree-chip" data-tree="${i}" data-word="${escapeHtml(node.word)}">${escapeHtml(node.word)}</button>
      <ul class="tree sub-tree">
        ${node.level2.map((w) => `
          <li class="tree-node">
            <button type="button" class="tree-chip tree-chip--leaf" data-tree="${i}" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>
          </li>`).join('')}
      </ul>
    </li>`).join('');

  const sourceLabel = {
    'api-en': 'Datamuse (vía inglés)',
    'api': 'Datamuse',
    'local': 'banco local'
  }[tree.rootSource] || 'banco local';

  return `
    <ul class="tree" role="tree">${branches}</ul>
    <p class="tree-source-tag">fuente: ${sourceLabel}</p>
  `;
}

function renderTreeCard(i){
  const card = document.getElementById(`tree-card-${i}`);
  if (card) card.innerHTML = treeCardInnerHTML(i);
}

function treeColumnHTML(i){
  const d = appState.desglose;
  const root = d.roots[i];
  return `
    <div class="tree-col">
      <div class="tree-root-row">
        <input
          class="word-input tree-root-input"
          id="root-input-${i}"
          data-tree-root="${i}"
          type="text"
          placeholder="Escribe una palabra…"
          value="${escapeHtml(root)}"
          autocomplete="off">
        <button class="icon-btn btn-tree-shuffle" type="button" data-tree-shuffle="${i}" title="Rotar árbol" aria-label="Rotar árbol">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h3.5c1.5 0 2.3.6 3.1 1.7l5.8 8.6c.8 1.1 1.6 1.7 3.1 1.7H21M4 17h3.5c1.5 0 2.3-.6 3.1-1.7l.7-1M15.4 8.7c.8-1.1 1.6-1.7 3.1-1.7H21"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>
        </button>
      </div>
      <div class="tree-card" id="tree-card-${i}">
        ${treeCardInnerHTML(i)}
      </div>
    </div>`;
}

function desgloseSelectedInputHTML(i){
  const val = appState.desglose.selected[i];
  return `
    <div class="input-block" data-selected-wrap="${i}">
      <label for="selected-input-${i}">Palabra final ${i + 1}</label>
      <input
        class="word-input ${val.trim() ? 'is-filled' : ''}"
        id="selected-input-${i}"
        data-slot="${i}"
        data-stage="desglose-selected"
        type="text"
        placeholder="Elige del árbol o escribe…"
        value="${escapeHtml(val)}"
        autocomplete="off">
    </div>`;
}

function renderDesglose(){
  const d = appState.desglose;

  // si llegamos con las 3 palabras de Clave completas y aún no se han
  // traído a esta etapa, se copian una sola vez; de ahí en adelante
  // los recuadros quedan libres para editar
  if (!d.initializedFromClave){
    const c = appState.clave.words;
    if (c[0].trim() && c[1].trim() && c[2].trim()){
      d.roots = [...c];
      d.initializedFromClave = true;
    }
  }

  stageContentEl.innerHTML = `
    <div class="stage-head">
      <span class="stage-kicker">Etapa II · el desglose</span>
      <h1 class="stage-title">Desglose</h1>
      <p class="stage-sub">De cada palabra crece un árbol: tres ramas, y de cada rama, tres hojas más — trece por árbol, treinta y nueve en total.</p>
    </div>

    <div class="tree-grid">
      ${[0, 1, 2].map(treeColumnHTML).join('')}
    </div>

    <p class="section-label">Elige palabras de cualquier árbol (rotan igual que en Clave) o escríbelas:</p>
    <div class="grid-3">
      ${[0, 1, 2].map(desgloseSelectedInputHTML).join('')}
    </div>

    <div class="actions-row">
      <span class="validation-msg" id="desglose-validation">Completa las tres palabras finales para continuar.</span>
      <button class="btn-primary" id="btn-next-stage-2" type="button">
        Siguiente
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </div>
  `;

  // arranca (o retoma) la generación de cada árbol cuyo recuadro tenga palabra
  d.roots.forEach((word, i) => {
    if (word.trim() && !d.trees[i]) buildTree(i, word.trim());
  });
}

/* ---------- Etapa 2: construcción de árboles ---------- */

async function buildTree(i, rootWord){
  const d = appState.desglose;
  d.trees[i] = { root: rootWord, status: 'loading', level1: [], rootTour: [], rootPos: 0, rootSource: 'local' };
  renderTreeCard(i);

  // pivot: true → la raíz también se busca traduciendo al inglés (mejores
  // resultados), no sólo con el español directo de Datamuse
  const { words, source } = await fetchRelated(rootWord, { pivot: true });
  const current = d.trees[i];
  if (!current || current.root !== rootWord) return; // la raíz cambió mientras esperábamos

  current.rootSource = source;
  // se respeta el orden ya priorizado (banco local > pivote inglés > directo);
  // no se baraja para no perder esa prioridad en la primera vuelta
  current.rootTour = words.length ? words : localFallbackWords(rootWord, 15);
  await advanceRoot(i);
}

async function advanceRoot(i){
  const d = appState.desglose;
  const tree = d.trees[i];
  if (!tree) return;

  if (tree.rootPos + 3 > tree.rootTour.length){
    tree.rootTour = shuffle(tree.rootTour);
    tree.rootPos = 0;
  }
  const picks = tree.rootTour.slice(tree.rootPos, tree.rootPos + 3);
  tree.rootPos += 3;
  tree.status = 'loading-level2';
  renderTreeCard(i);

  const level1 = await Promise.all(picks.map(async (word) => {
    const child = await fetchRelated(word); // sin pivote: sólo directo + local, para no multiplicar llamadas
    const pool = child.words.length ? child.words : localFallbackWords(word, 9);
    return { word, level2: pool.slice(0, 3), source: child.source };
  }));

  const current = d.trees[i];
  if (!current || current.root !== tree.root) return; // obsoleto: la raíz ya cambió
  current.level1 = level1;
  current.status = 'ready';
  renderTreeCard(i);
}

function commitRootWord(i, rawValue){
  const value = rawValue.trim();
  const d = appState.desglose;
  if (value === d.roots[i] && d.trees[i]) return; // sin cambios reales
  d.roots[i] = value;
  d.trees[i] = null;
  if (!value){
    renderTreeCard(i);
    return;
  }
  buildTree(i, value);
}

function handleTreeShuffle(i){
  const tree = appState.desglose.trees[i];
  if (!tree || tree.status === 'loading' || tree.status === 'loading-level2') return;
  advanceRoot(i);
}

function updateDesgloseSelectedInputsDOM(){
  for (let i = 0; i < 3; i++){
    const el = document.getElementById(`selected-input-${i}`);
    if (!el) continue;
    el.value = appState.desglose.selected[i];
    el.classList.toggle('is-filled', !!el.value.trim());
  }
  updateAllTreeChipHighlights();
  hideDesgloseValidation();
}

function updateAllTreeChipHighlights(){
  const selectedLower = appState.desglose.selected.map((w) => w.trim().toLowerCase()).filter(Boolean);
  stageContentEl.querySelectorAll('.tree-chip').forEach((chip) => {
    chip.classList.toggle('is-used', selectedLower.includes(chip.dataset.word.toLowerCase()));
  });
}

// clic en CUALQUIER palabra de CUALQUIER árbol llena el siguiente recuadro
// final disponible, en rotación 1→2→3→1… — igual que en Clave, no queda
// atada al árbol del que vino
function handleTreeWordSelect(word){
  const idx = appState.desglose.fillCursor;
  appState.desglose.selected[idx] = word;
  appState.desglose.fillCursor = (idx + 1) % 3;
  updateDesgloseSelectedInputsDOM();
}

function showDesgloseValidation(){
  const msg = document.getElementById('desglose-validation');
  if (msg) msg.classList.add('visible');
  appState.desglose.selected.forEach((w, i) => {
    if (!w.trim()){
      const wrap = stageContentEl.querySelector(`[data-selected-wrap="${i}"]`);
      if (wrap){
        wrap.classList.remove('shake');
        void wrap.offsetWidth;
        wrap.classList.add('shake');
      }
    }
  });
}

function hideDesgloseValidation(){
  const msg = document.getElementById('desglose-validation');
  if (msg) msg.classList.remove('visible');
  stageContentEl.querySelectorAll('.input-block.shake').forEach((el) => el.classList.remove('shake'));
}

function handleNextStage2(){
  const allFilled = appState.desglose.selected.every((w) => w.trim().length > 0);
  if (!allFilled){
    showDesgloseValidation();
    return;
  }
  appState.concepto.words = [...appState.desglose.selected];
  appState.concepto.cards = [null, null, null];
  appState.concepto.initializedFromDesglose = true;
  switchStage('concepto');
}

/* ---------- render: Etapa 3 · Concepto (tabla generada por API) ---------- */

const CONCEPT_ROWS = [
  { key: 'palabra', label: 'Palabra' },
  { key: 'definicion', label: 'Definición' },
  { key: 'sinonimos', label: 'Sinónimos' },
  { key: 'extra', label: 'Datos extra' }
];

function conceptWordInputHTML(i){
  const val = appState.concepto.words[i];
  return `
    <div class="input-block">
      <label for="concept-input-${i}">Palabra ${i + 1}</label>
      <input
        class="word-input"
        id="concept-input-${i}"
        data-concept-word="${i}"
        type="text"
        placeholder="Escribe una palabra…"
        value="${escapeHtml(val)}"
        autocomplete="off">
    </div>`;
}

function conceptCellContent(i, rowKey){
  const c = appState.concepto;
  const word = c.words[i];
  const card = c.cards[i];
  if (!word.trim()) return '<span class="concept-empty">—</span>';
  if (!card || card.status === 'loading') return '<span class="concept-loading">Cargando…</span>';

  switch (rowKey){
    case 'palabra':
      return escapeHtml(word);
    case 'definicion':
      return card.definicion ? escapeHtml(card.definicion) : '<span class="concept-empty">No disponible</span>';
    case 'sinonimos':
      return card.sinonimos.length ? escapeHtml(card.sinonimos.join(', ')) : '<span class="concept-empty">No disponible</span>';
    case 'extra': {
      const parts = [];
      if (card.parteGramatical) parts.push(capitalizeWord(card.parteGramatical));
      if (card.ejemplo) parts.push(`«${card.ejemplo}»`);
      return parts.length ? escapeHtml(parts.join(' — ')) : '<span class="concept-empty">No disponible</span>';
    }
    default:
      return '';
  }
}

function conceptTableHTML(){
  const c = appState.concepto;
  return `
    <div class="concept-table-wrap" id="concept-table-wrap">
      <table class="concept-table">
        <thead>
          <tr>
            <th>Concepto</th>
            ${[0, 1, 2].map((i) => `<th>${c.words[i].trim() ? escapeHtml(c.words[i]) : '—'}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${CONCEPT_ROWS.map((row) => `
            <tr>
              <th scope="row">${row.label}</th>
              ${[0, 1, 2].map((i) => `<td>${conceptCellContent(i, row.key)}</td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderConceptTable(){
  const wrap = document.getElementById('concept-table-wrap');
  if (wrap) wrap.outerHTML = conceptTableHTML();
}

function renderConcepto(){
  const c = appState.concepto;

  // si llegamos con las 3 palabras de Desglose completas y aún no se han
  // traído a esta etapa, se copian una sola vez; de ahí en adelante los
  // recuadros quedan libres para editar
  if (!c.initializedFromDesglose){
    const sel = appState.desglose.selected;
    if (sel[0].trim() && sel[1].trim() && sel[2].trim()){
      c.words = [...sel];
      c.initializedFromDesglose = true;
    }
  }

  stageContentEl.innerHTML = `
    <div class="stage-head">
      <span class="stage-kicker">Etapa III · el concepto</span>
      <h1 class="stage-title">Concepto</h1>
      <p class="stage-sub">Una ficha por palabra: definición, etimología, sinónimos y antónimos.</p>
    </div>

    <div class="grid-3">
      ${[0, 1, 2].map(conceptWordInputHTML).join('')}
    </div>

    ${conceptTableHTML()}

    <p class="stage-note">Fuentes: dictionaryapi.dev (definición) y Datamuse (sinónimos).</p>

    <div class="actions-row">
      <button class="btn-primary" id="btn-next-stage-3" type="button">
        Siguiente
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </div>
  `;

  c.words.forEach((word, i) => {
    if (word.trim() && !c.cards[i]) buildConceptCard(i, word.trim());
  });
}

async function buildConceptCard(i, word){
  const c = appState.concepto;
  c.cards[i] = { status: 'loading', definicion: '', parteGramatical: '', ejemplo: '', sinonimos: [] };
  renderConceptTable();

  const [dict, syn] = await Promise.all([
    lookupDictionary(word),
    lookupSynonyms(word)
  ]);

  // si la palabra de esta columna cambió mientras esperábamos la respuesta,
  // no pisamos con datos que ya no corresponden
  if (normalizeForDedup(c.words[i]) !== normalizeForDedup(word)) return;

  c.cards[i] = {
    status: 'ready',
    definicion: dict.definicion,
    parteGramatical: dict.parteGramatical,
    ejemplo: dict.ejemplo,
    sinonimos: syn.sinonimos
  };
  renderConceptTable();
}

function commitConceptWord(i, rawValue){
  const value = rawValue.trim();
  const c = appState.concepto;
  if (value === c.words[i] && c.cards[i]) return; // sin cambios reales
  c.words[i] = value;
  c.cards[i] = null;
  renderConceptTable();
  const header = stageContentEl.querySelectorAll('.concept-table thead th')[i + 1];
  if (header) header.textContent = value || '—';
  if (value) buildConceptCard(i, value);
}

function handleNextStage3(){
  // Concepto no valida ni pasa datos a Contexto: la Etapa 4 es independiente
  switchStage('contexto');
}

/* ---------- render: Etapa 4 · Contexto (dos tómbolas, sin APIs) ---------- */

function generoColHTML(){
  const val = appState.contexto.genero;
  return `
    <div class="context-col" id="context-genero-col">
      <div class="word-card-head">
        <h3 class="word-card-title">Género de terror</h3>
        <button class="btn-shuffle" type="button" id="btn-draw-genero">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h3.5c1.5 0 2.3.6 3.1 1.7l5.8 8.6c.8 1.1 1.6 1.7 3.1 1.7H21M4 17h3.5c1.5 0 2.3-.6 3.1-1.7l.7-1M15.4 8.7c.8-1.1 1.6-1.7 3.1-1.7H21"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>
          <span>Girar</span>
        </button>
      </div>
      <div class="input-block" data-context-wrap="genero">
        <label for="context-genero-input">Resultado</label>
        <input
          class="word-input ${val.trim() ? 'is-filled' : ''}"
          id="context-genero-input"
          data-context-field="genero"
          type="text"
          placeholder="Presiona «Girar»…"
          value="${escapeHtml(val)}"
          autocomplete="off">
      </div>
    </div>`;
}

function situacionesColHTML(){
  const ctx = appState.contexto;
  const s = ctx.situaciones;
  const caps = ctx.situacionesCaptions;
  return `
    <div class="context-col" id="context-situaciones-col">
      <div class="word-card-head">
        <h3 class="word-card-title">Situación dramática</h3>
        <button class="btn-shuffle" type="button" id="btn-draw-situaciones">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h3.5c1.5 0 2.3.6 3.1 1.7l5.8 8.6c.8 1.1 1.6 1.7 3.1 1.7H21M4 17h3.5c1.5 0 2.3-.6 3.1-1.7l.7-1M15.4 8.7c.8-1.1 1.6-1.7 3.1-1.7H21"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>
          <span>Girar</span>
        </button>
      </div>
      ${[0, 1].map((i) => `
        <div class="input-block" data-context-wrap="situacion${i}">
          <label for="context-situacion-input-${i}">Situación ${i + 1}</label>
          <input
            class="word-input ${s[i].trim() ? 'is-filled' : ''}"
            id="context-situacion-input-${i}"
            data-context-field="situacion${i}"
            type="text"
            placeholder="Presiona «Girar»…"
            value="${escapeHtml(s[i])}"
            autocomplete="off">
          ${caps[i] ? `<p class="context-caption">${escapeHtml(caps[i])}</p>` : ''}
        </div>`).join('')}
    </div>`;
}

function renderContexto(){
  const ctx = appState.contexto;

  // primer arranque de cada tómbola: se dispara sola para no dejar la
  // etapa vacía al llegar (igual que las tarjetas de Clave)
  if (!ctx.genero.trim() && !ctx.generoTour.shuffled.length){
    const picked = drawFromTour(ctx.generoTour, generosTerror, 1);
    ctx.genero = picked[0] || '';
  }
  if (!ctx.situaciones[0].trim() && !ctx.situaciones[1].trim() && !ctx.situacionesTour.shuffled.length){
    const picked = drawFromTour(ctx.situacionesTour, situacionesDramaticas, 2);
    ctx.situaciones = picked.map((s) => s.titulo);
    ctx.situacionesCaptions = picked.map((s) => s.elementos);
  }

  stageContentEl.innerHTML = `
    <div class="stage-head">
      <span class="stage-kicker">Etapa IV · el contexto</span>
      <h1 class="stage-title">Contexto</h1>
      <p class="stage-sub">Dos tómbolas para cerrar el cuadro: un género de terror y dos situaciones dramáticas, al azar.</p>
    </div>

    <div class="grid-2">
      ${generoColHTML()}
      ${situacionesColHTML()}
    </div>

    <div class="actions-row">
      <span class="validation-msg" id="contexto-validation">Completa género y las dos situaciones para continuar.</span>
      <button class="btn-primary" id="btn-next-stage-4" type="button">
        Siguiente
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </div>
  `;
}

function handleDrawGenero(){
  const ctx = appState.contexto;
  const picked = drawFromTour(ctx.generoTour, generosTerror, 1);
  ctx.genero = picked[0] || '';
  const col = document.getElementById('context-genero-col');
  if (col) col.outerHTML = generoColHTML();
  hideContextoValidation();
}

function handleDrawSituaciones(){
  const ctx = appState.contexto;
  const picked = drawFromTour(ctx.situacionesTour, situacionesDramaticas, 2);
  ctx.situaciones = picked.map((s) => s.titulo);
  ctx.situacionesCaptions = picked.map((s) => s.elementos);
  const col = document.getElementById('context-situaciones-col');
  if (col) col.outerHTML = situacionesColHTML();
  hideContextoValidation();
}

function showContextoValidation(){
  const msg = document.getElementById('contexto-validation');
  if (msg) msg.classList.add('visible');
  const ctx = appState.contexto;
  const empties = [];
  if (!ctx.genero.trim()) empties.push('genero');
  if (!ctx.situaciones[0].trim()) empties.push('situacion0');
  if (!ctx.situaciones[1].trim()) empties.push('situacion1');
  empties.forEach((field) => {
    const wrap = stageContentEl.querySelector(`[data-context-wrap="${field}"]`);
    if (wrap){
      wrap.classList.remove('shake');
      void wrap.offsetWidth;
      wrap.classList.add('shake');
    }
  });
}

function hideContextoValidation(){
  const msg = document.getElementById('contexto-validation');
  if (msg) msg.classList.remove('visible');
  stageContentEl.querySelectorAll('.input-block.shake').forEach((el) => el.classList.remove('shake'));
}

function handleNextStage4(){
  const ctx = appState.contexto;
  const allFilled = ctx.genero.trim() && ctx.situaciones[0].trim() && ctx.situaciones[1].trim();
  if (!allFilled){
    showContextoValidation();
    return;
  }
  const c = appState.conclusion;
  c.words = [...appState.desglose.selected];
  c.genero = ctx.genero;
  c.situaciones = [...ctx.situaciones];
  c.initialized = true;
  switchStage('conclusion');
}

/* ---------- render: Etapa 5 · Conclusión (datos bloqueados + texto libre) ---------- */

function lockedItemHTML(label, value){
  return `
    <div class="locked-item">
      <span class="locked-label">${escapeHtml(label)}</span>
      <span class="locked-value">${value.trim() ? escapeHtml(value) : '—'}</span>
    </div>`;
}

function renderConclusion(){
  const c = appState.conclusion;

  // si se llega sin pasar por el botón Siguiente de Contexto (p.ej. por
  // pestaña directa), se muestra lo que ya exista en Desglose/Contexto
  if (!c.initialized){
    c.words = [...appState.desglose.selected];
    c.genero = appState.contexto.genero;
    c.situaciones = [...appState.contexto.situaciones];
  }

  stageContentEl.innerHTML = `
    <div class="stage-head">
      <span class="stage-kicker">Etapa V · la conclusión</span>
      <h1 class="stage-title">Conclusión</h1>
      <p class="stage-sub">Los ingredientes ya están listos — de aquí en adelante no se traen más datos.</p>
    </div>

    <div class="locked-grid">
      ${lockedItemHTML('Palabra 1', c.words[0] || '')}
      ${lockedItemHTML('Palabra 2', c.words[1] || '')}
      ${lockedItemHTML('Palabra 3', c.words[2] || '')}
      ${lockedItemHTML('Género', c.genero || '')}
      ${lockedItemHTML('Situación 1', c.situaciones[0] || '')}
      ${lockedItemHTML('Situación 2', c.situaciones[1] || '')}
    </div>

    <p class="conclusion-prompt">Ahora, con tus tres palabras, agregando el género y dándole trama con las situaciones dramáticas, escribe en pocas líneas la idea o el argumento que salga de todo esto.</p>

    <textarea class="conclusion-textarea" id="conclusion-textarea" rows="8" placeholder="Escribe aquí tu idea…">${escapeHtml(c.texto)}</textarea>
  `;
}

/* ---------- despachador de etapas ---------- */

function renderStage(stageKey){
  if (!appState.clave) return; // los bancos de palabras aún no cargan (ver init)
  if (stageKey === 'clave') renderClave();
  else if (stageKey === 'desglose') renderDesglose();
  else if (stageKey === 'concepto') renderConcepto();
  else if (stageKey === 'contexto') renderContexto();
  else if (stageKey === 'conclusion') renderConclusion();
}

function switchStage(stageKey){
  if (!appState.clave) return;
  appState.activeStage = stageKey;
  tabEls.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.stage === stageKey)));
  renderStage(stageKey);
}

/* ---------- interacción: Etapa 1 ---------- */

function updateClaveInputsDOM(){
  for (let i = 0; i < 3; i++){
    const el = document.getElementById(`clave-input-${i}`);
    if (!el) continue;
    el.value = appState.clave.words[i];
    el.classList.toggle('is-filled', !!el.value.trim());
  }
  hideClaveValidation();
}

function handleChipClick(word){
  const idx = appState.clave.fillCursor;
  appState.clave.words[idx] = word;
  appState.clave.fillCursor = (idx + 1) % 3;
  updateClaveInputsDOM();
}

function handleShuffle(catKey){
  const words = drawNext(catKey);
  const listEl = stageContentEl.querySelector(`.word-list[data-cat="${catKey}"]`);
  if (!listEl) return;
  listEl.classList.remove('is-empty');
  listEl.innerHTML = words.map((w) => `<li><button type="button" class="word-chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button></li>`).join('');
}

function showClaveValidation(){
  const msg = document.getElementById('clave-validation');
  if (msg) msg.classList.add('visible');
  appState.clave.words.forEach((w, i) => {
    if (!w.trim()){
      const wrap = stageContentEl.querySelector(`[data-slot-wrap="${i}"]`);
      if (wrap){
        wrap.classList.remove('shake');
        void wrap.offsetWidth; // fuerza reflow para poder repetir la animación
        wrap.classList.add('shake');
      }
    }
  });
}

function hideClaveValidation(){
  const msg = document.getElementById('clave-validation');
  if (msg) msg.classList.remove('visible');
  stageContentEl.querySelectorAll('.input-block.shake').forEach((el) => el.classList.remove('shake'));
}

function handleNextStage(){
  const allFilled = appState.clave.words.every((w) => w.trim().length > 0);
  if (!allFilled){
    showClaveValidation();
    return;
  }
  appState.desglose.roots = [...appState.clave.words];
  appState.desglose.initializedFromClave = true;
  switchStage('desglose');
}

/* ---------- delegación de eventos dentro del contenido de etapa ---------- */

stageContentEl.addEventListener('click', (e) => {
  const drawGenero = e.target.closest('#btn-draw-genero');
  if (drawGenero){
    handleDrawGenero();
    return;
  }
  const drawSituaciones = e.target.closest('#btn-draw-situaciones');
  if (drawSituaciones){
    handleDrawSituaciones();
    return;
  }
  const nextBtn4 = e.target.closest('#btn-next-stage-4');
  if (nextBtn4){
    handleNextStage4();
    return;
  }
  const chip = e.target.closest('.word-chip');
  if (chip){
    handleChipClick(chip.dataset.word);
    return;
  }
  const shuffleBtn = e.target.closest('.btn-shuffle');
  if (shuffleBtn){
    handleShuffle(shuffleBtn.dataset.cat);
    return;
  }
  const nextBtn = e.target.closest('#btn-next-stage');
  if (nextBtn){
    handleNextStage();
    return;
  }
  const treeChip = e.target.closest('.tree-chip');
  if (treeChip){
    handleTreeWordSelect(treeChip.dataset.word);
    return;
  }
  const treeShuffleBtn = e.target.closest('[data-tree-shuffle]');
  if (treeShuffleBtn){
    handleTreeShuffle(Number(treeShuffleBtn.dataset.treeShuffle));
    return;
  }
  const nextBtn2 = e.target.closest('#btn-next-stage-2');
  if (nextBtn2){
    handleNextStage2();
    return;
  }
  const nextBtn3 = e.target.closest('#btn-next-stage-3');
  if (nextBtn3){
    handleNextStage3();
  }
});

stageContentEl.addEventListener('input', (e) => {
  const contextInp = e.target.closest('input[data-context-field]');
  if (contextInp){
    const field = contextInp.dataset.contextField;
    const ctx = appState.contexto;
    contextInp.classList.toggle('is-filled', !!contextInp.value.trim());
    if (field === 'genero'){
      ctx.genero = contextInp.value;
    } else if (field === 'situacion0'){
      ctx.situaciones[0] = contextInp.value;
      ctx.situacionesCaptions[0] = ''; // ya no corresponde a lo que se dibujó
    } else if (field === 'situacion1'){
      ctx.situaciones[1] = contextInp.value;
      ctx.situacionesCaptions[1] = '';
    }
    hideContextoValidation();
    return;
  }

  const textarea = e.target.closest('#conclusion-textarea');
  if (textarea){
    appState.conclusion.texto = textarea.value;
    return;
  }

  const inp = e.target.closest('input[data-slot]');
  if (!inp) return;
  const idx = Number(inp.dataset.slot);
  const stage = inp.dataset.stage;

  if (stage === 'clave'){
    appState.clave.words[idx] = inp.value;
    inp.classList.toggle('is-filled', !!inp.value.trim());
    hideClaveValidation();
  } else if (stage === 'desglose-selected'){
    appState.desglose.selected[idx] = inp.value;
    inp.classList.toggle('is-filled', !!inp.value.trim());
    updateAllTreeChipHighlights();
    hideDesgloseValidation();
  }
});

// las palabras raíz de cada árbol (Etapa 2) y las de la tabla de Concepto
// (Etapa 3) sólo disparan la consulta a las APIs al confirmar con Enter o
// al salir del recuadro, no en cada tecla
stageContentEl.addEventListener('keydown', (e) => {
  const rootInput = e.target.closest('[data-tree-root]');
  if (rootInput && e.key === 'Enter'){
    e.preventDefault();
    rootInput.blur();
    return;
  }
  const conceptInput = e.target.closest('[data-concept-word]');
  if (conceptInput && e.key === 'Enter'){
    e.preventDefault();
    conceptInput.blur();
  }
});

stageContentEl.addEventListener('blur', (e) => {
  const rootInput = e.target.closest && e.target.closest('[data-tree-root]');
  if (rootInput){
    commitRootWord(Number(rootInput.dataset.treeRoot), rootInput.value);
    return;
  }
  const conceptInput = e.target.closest && e.target.closest('[data-concept-word]');
  if (conceptInput){
    commitConceptWord(Number(conceptInput.dataset.conceptWord), conceptInput.value);
  }
}, true);

/* ---------- pestañas, imprimir, reiniciar (barra fija) ---------- */

tabEls.forEach((tab) => {
  tab.addEventListener('click', () => switchStage(tab.dataset.stage));
});

btnPrint.addEventListener('click', () => window.print());

btnReset.addEventListener('click', () => {
  if (!appState.clave) return; // aún cargando
  const stage = appState.activeStage;
  if (stage === 'clave') appState.clave = createClaveState();
  else if (stage === 'desglose') appState.desglose = createDesgloseState();
  else if (stage === 'concepto') appState.concepto = createConceptoState();
  else if (stage === 'contexto') appState.contexto = createContextoState();
  else if (stage === 'conclusion') appState.conclusion = createConclusionState();
  renderStage(stage);
});

/* ---------- arranque ---------- */

async function init(){
  stageContentEl.innerHTML = `<p class="tree-hint tree-hint--loading" style="padding-top:110px;">Cargando banco de palabras…</p>`;
  try {
    await loadWordBanks();
  } catch (err){
    stageContentEl.innerHTML = `
      <div class="stage-placeholder" style="max-width:640px;">
        No se pudo cargar <code>words.json</code>.<br><br>
        Si abriste <code>index.html</code> haciendo doble clic, el navegador bloquea esa
        carga por seguridad (política de mismo origen). Sirve la carpeta con un servidor
        local — por ejemplo, desde una terminal en esa carpeta:
        <br><br><code>python3 -m http.server</code><br><br>
        y abre <code>http://localhost:8000</code>. También funciona con la extensión
        «Live Server» de VS Code.
      </div>`;
    return;
  }

  appState.clave = createClaveState();
  appState.desglose = createDesgloseState();
  appState.concepto = createConceptoState();
  appState.contexto = createContextoState();
  appState.conclusion = createConclusionState();
  renderStage(appState.activeStage);
}

init();
