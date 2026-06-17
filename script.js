/* ─── Telekom Srbija — Generator objava (script.js) ─────────── */

// const BACKEND_URL = 'https://sinisa1989.app.n8n.cloud/webhook-test/telekom-content-drafting-assistant'
const BACKEND_URL = 'https://sinisa1989.app.n8n.cloud/webhook/telekom-content-drafting-assistant'
; /* ← promeni na svoju bekend adresu */
 
/* Character limits per network */
const CHAR_LIMITS = {
  x:         280,
  instagram: 2200,
  linkedin:  3000,
};
 
const NETWORK_LABELS = {
  x:         '𝕏 Twitter / X',
  instagram: 'Instagram',
  linkedin:  'LinkedIn',
};
 
const NETWORK_ICONS = {
  x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  instagram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
  linkedin:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`,
};
 
/* ─── DOM refs ───────────────────────────────────────────────── */
const form          = document.getElementById('generate-form');
const urlInput      = document.getElementById('url-input');
const urlError      = document.getElementById('url-error');
const networkSelect = document.getElementById('network-select');
const submitBtn     = document.getElementById('submit-btn');
const chips         = document.querySelectorAll('.chip');
 
const resultSection  = document.getElementById('result-section');
const resultLoading  = document.getElementById('result-loading');
const resultCard     = document.getElementById('result-card');
const resultError    = document.getElementById('result-error');
const errorMessage   = document.getElementById('error-message');
 
const resultNetworkBadge = document.getElementById('result-network-badge');
const resultSource       = document.getElementById('result-source');
const resultTitle        = document.getElementById('result-title');
const resultBody         = document.getElementById('result-body');
const resultHashtags     = document.getElementById('result-hashtags');
const resultMeta         = document.getElementById('result-meta');
 
const copyBtn       = document.getElementById('copy-btn');
const editBtn       = document.getElementById('edit-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
 
const editTitleInput    = document.getElementById('edit-title');
const editBodyInput     = document.getElementById('edit-body');
const editHashtagsInput = document.getElementById('edit-hashtags');
const editActions       = document.getElementById('edit-actions');
const editCancelBtn     = document.getElementById('edit-cancel-btn');
const editSaveBtn       = document.getElementById('edit-save-btn');
 
const loadingBar    = document.querySelector('.loading-bar-inner');
const stepEls       = [
  document.getElementById('step-1'),
  document.getElementById('step-2'),
  document.getElementById('step-3'),
];
 
/* ─── State ──────────────────────────────────────────────────── */
let lastUrl     = '';
let lastNetwork = '';
let progressTimer = null;
 
let currentContent = { title: '', body: '', hashtags: '' }; /* trenutni (možda editovan) sadržaj */
let isEdited        = false;
let isEditing        = false;
 
/* ─── Network chip sync ──────────────────────────────────────── */
chips.forEach(chip => {
  chip.addEventListener('click', () => {
    const net = chip.dataset.network;
    networkSelect.value = net;
    syncChips(net);
  });
});
 
networkSelect.addEventListener('change', () => {
  syncChips(networkSelect.value);
});
 
function syncChips(net) {
  chips.forEach(c => {
    c.classList.toggle('active', c.dataset.network === net);
  });
}
 
/* ─── URL live validation ────────────────────────────────────── */
urlInput.addEventListener('input', () => {
  if (urlInput.classList.contains('error') && isValidUrl(urlInput.value.trim())) {
    urlInput.classList.remove('error');
    urlError.textContent = '';
  }
});
 
function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}
 
/* ─── Form submit ────────────────────────────────────────────── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
 
  const url     = urlInput.value.trim();
  const network = networkSelect.value;
 
  /* Validate */
  if (!isValidUrl(url)) {
    urlInput.classList.add('error');
    urlError.textContent = 'Unesi ispravan URL (npr. https://www.primer.com)';
    urlInput.focus();
    return;
  }
  if (!network) {
    networkSelect.focus();
    return;
  }
 
  urlInput.classList.remove('error');
  urlError.textContent = '';
  lastUrl     = url;
  lastNetwork = network;
 
  await runGenerate(url, network);
});
 
regenerateBtn.addEventListener('click', () => {
  if (lastUrl && lastNetwork) runGenerate(lastUrl, lastNetwork);
});
 
/* ─── Generate flow ─────────────────────────────────────────── */
async function runGenerate(url, network) {
  setLoadingState(true);
  showSection('loading');
  startLoadingAnimation();
 
  try {
    const data = await callBackend(url, network);
    stopLoadingAnimation(true);
 
    await delay(400);
    renderResult(data, url, network);
    showSection('card');
  } catch (err) {
    stopLoadingAnimation(false);
    await delay(300);
    showSection('error');
    errorMessage.textContent = err.message || 'Nije moguće generisati objavu. Proveri URL i pokušaj ponovo.';
  } finally {
    setLoadingState(false);
  }
}
 
/* ─── API call ───────────────────────────────────────────────── */
async function callBackend(url, network) {
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, network }),
  });
 
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Greška servera (${res.status})`);
  }
 
  const json = await res.json();
  /*
    Bekend vraća:
    { "output": { "title": "...", "platform": "LinkedIn", "post": "...", "hashtags": [...] } }
    Izvlačimo output objekat.
  */
  return json.output || json;
}
 
/* ─── Render result ─────────────────────────────────────────── */
function renderResult(data, url, network) {
  /* Badge */
  resultNetworkBadge.innerHTML = `${NETWORK_ICONS[network]} ${NETWORK_LABELS[network]}`;
 
  /* Source */
  const linkIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  resultSource.innerHTML = `${linkIcon} : <a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">${escHtml(url)}</a>`;
 
  /* Content — bekend vraća "post" (ne "body") i hashtags kao niz */
  const hashtagStr = Array.isArray(data.hashtags)
    ? data.hashtags.join(' ')
    : (data.hashtags || '');
 
  /* Tekst posta već sadrži hashtags na kraju — izvuci čist tekst bez njih */
  const postText = (data.post || '').replace(/(#\S+\s*)+$/, '').trim();
 
  /* Sačuvaj trenutni sadržaj u state (izvor istine za prikaz/copy/edit) */
  currentContent = { title: data.title || '', body: postText, hashtags: hashtagStr };
  isEdited        = false;
  isEditing        = false;
 
  applyContentToView();
  exitEditMode();
  updateCharCount(network);
}
 
/* ─── Edit mode ──────────────────────────────────────────────── */
function applyContentToView() {
  resultTitle.textContent    = currentContent.title;
  resultBody.textContent     = currentContent.body;
  resultHashtags.textContent = currentContent.hashtags;
}
 
function enterEditMode() {
  isEditing = true;
  editTitleInput.value    = currentContent.title;
  editBodyInput.value     = currentContent.body;
  editHashtagsInput.value = currentContent.hashtags;
 
  document.querySelectorAll('[data-view]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[data-edit]').forEach(el => el.style.display = 'block');
  editActions.style.display = 'flex';
  resultCard.classList.add('editing');
 
  editTitleInput.focus();
}
 
function exitEditMode() {
  isEditing = false;
  document.querySelectorAll('[data-edit]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[data-view]').forEach(el => el.style.display = 'block');
  editActions.style.display = 'none';
  resultCard.classList.remove('editing');
}
 
editBtn.addEventListener('click', () => {
  if (isEditing) return;
  enterEditMode();
});
 
editCancelBtn.addEventListener('click', () => {
  exitEditMode();
});
 
editSaveBtn.addEventListener('click', () => {
  const newTitle    = editTitleInput.value.trim();
  const newBody     = editBodyInput.value.trim();
  const newHashtags = editHashtagsInput.value.trim();
 
  isEdited = (
    newTitle    !== currentContent.title ||
    newBody     !== currentContent.body  ||
    newHashtags !== currentContent.hashtags
  );
 
  currentContent = { title: newTitle, body: newBody, hashtags: newHashtags };
  applyContentToView();
  exitEditMode();
  updateCharCount(lastNetwork);
  flashSaved();
});
 
function flashSaved() {
  editSaveBtn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
    Sačuvano!
  `;
  setTimeout(() => {
    editSaveBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      Sačuvaj izmene
    `;
  }, 1600);
}
 
/* ─── Character count (sada nezavisno, koristi se i pri editu) ─ */
function updateCharCount(network) {
  const fullText  = [currentContent.title, currentContent.body, currentContent.hashtags]
    .filter(Boolean).join('\n\n');
  const count     = fullText.length;
  const limit     = CHAR_LIMITS[network] || CHAR_LIMITS.linkedin;
  const remaining = limit - count;
 
  let countClass = '';
  if (remaining < 0)        countClass = 'over-limit';
  else if (remaining < 40)  countClass = 'near-limit';
 
  resultMeta.innerHTML = `
    <span>
      Generisano ${new Date().toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' })}
      ${isEdited ? `<span class="edited-flag">✎ Izmenjeno</span>` : ''}
    </span>
    <span class="char-count ${countClass}">
      ${remaining < 0
        ? `⚠ Prelazi limit za ${Math.abs(remaining)} znakova`
        : `${count} / ${limit} znakova`}
    </span>
  `;
}
 
/* ─── Copy ───────────────────────────────────────────────────── */
copyBtn.addEventListener('click', async () => {
  const text = [
    currentContent.title,
    currentContent.body,
    currentContent.hashtags,
  ].filter(Boolean).join('\n\n');
 
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.classList.add('copied');
    copyBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      Kopirano!
    `;
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Kopiraj
      `;
    }, 2200);
  } catch {
    /* clipboard API nije dostupno — fallback */
  }
});
 
/* ─── Loading animation ─────────────────────────────────────── */
function startLoadingAnimation() {
  stepEls.forEach(s => { s.className = 'loading-step'; });
  stepEls[0].classList.add('active');
  loadingBar.style.width = '0%';
 
  let step = 0;
  const steps   = [15, 50, 80];
  const delays  = [0, 1200, 2400];
 
  delays.forEach((ms, i) => {
    setTimeout(() => {
      stepEls.forEach((s, j) => {
        if (j < i)  s.classList.add('done');
        if (j === i) { s.classList.remove('done'); s.classList.add('active'); }
        if (j > i)  s.className = 'loading-step';
      });
      loadingBar.style.width = steps[i] + '%';
    }, ms);
  });
}
 
function stopLoadingAnimation(success) {
  clearTimeout(progressTimer);
  loadingBar.style.width = success ? '100%' : '60%';
  if (success) {
    stepEls.forEach(s => s.classList.add('done'));
  }
}
 
/* ─── UI helpers ─────────────────────────────────────────────── */
function showSection(which) {
  resultSection.style.display = 'block';
  resultLoading.style.display = which === 'loading' ? 'block' : 'none';
  resultCard.style.display    = which === 'card'    ? 'block' : 'none';
  resultError.style.display   = which === 'error'   ? 'flex'  : 'none';
 
  if (which !== 'loading') {
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
 
function setLoadingState(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle('loading', loading);
}
 
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
 
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
 