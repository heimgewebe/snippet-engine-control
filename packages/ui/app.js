const API_BASE = '/api';

// State
let snippets = [];
let currentSnippet = null;

// DOM Elements
const listEl = document.getElementById('snippet-list');
const btnNew = document.getElementById('btn-new');
const btnSave = document.getElementById('btn-save');
const btnDelete = document.getElementById('btn-delete');
const btnDryrun = document.getElementById('btn-dryrun');

const inputId = document.getElementById('input-id');
const inputTriggers = document.getElementById('input-triggers');
const inputBody = document.getElementById('input-body');
const inputWord = document.getElementById('input-word');

const diagnosticsBox = document.getElementById('diagnostics-box');
const previewBox = document.getElementById('preview-box');

const modalExport = document.getElementById('modal-export');
const exportContent = document.getElementById('export-plan-content');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCloseModalFooter = document.getElementById('btn-close-modal-footer');

async function fetchSnippets() {
  try {
    const res = await fetch(`${API_BASE}/snippets`);
    snippets = await res.json();
    renderList();
    if (snippets.length > 0 && !currentSnippet) {
      selectSnippet(snippets[0].id);
    }
  } catch (err) {
    console.error('Failed to fetch snippets:', err);
  }
}

function renderList() {
  listEl.innerHTML = '';
  snippets.forEach(s => {
    const li = document.createElement('li');
    li.dataset.id = s.id;
    if (currentSnippet && currentSnippet.id === s.id) {
      li.className = 'selected';
    }

    const triggerSpan = document.createElement('span');
    triggerSpan.className = 'trigger';
    triggerSpan.textContent = s.triggers.join(', ') || 'No trigger';

    const bodySpan = document.createElement('span');
    bodySpan.className = 'snippet-body-preview';
    bodySpan.textContent = s.body;

    li.appendChild(triggerSpan);
    li.appendChild(bodySpan);

    li.addEventListener('click', () => selectSnippet(s.id));
    listEl.appendChild(li);
  });
}

function selectSnippet(id) {
  const s = snippets.find(x => x.id === id);
  if (!s) return;
  currentSnippet = { ...s }; // copy for editing

  inputId.value = s.id;
  inputTriggers.value = s.triggers.join(', ');
  inputBody.value = s.body;
  inputWord.checked = s.constraints?.wordBoundary || false;

  renderList();
  triggerValidation();
}

// Initialize
fetchSnippets();

function getDraft() {
  const tStr = inputTriggers.value.split(',').map(s => s.trim()).filter(Boolean);
  return {
    ...currentSnippet,
    triggers: tStr,
    body: inputBody.value,
    constraints: {
      ...currentSnippet.constraints,
      wordBoundary: inputWord.checked
    }
  };
}

let timeoutId = null;

function handleEdit() {
  if (!currentSnippet) return;
  currentSnippet = getDraft();

  // update UI optimistically
  renderList();

  // Debounce validation
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    triggerValidation();
    triggerPreview();
  }, 300);
}

async function triggerValidation() {
  if (!currentSnippet) return;

  try {
    const res = await fetch(`${API_BASE}/diagnostics/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSnippet)
    });

    const diag = await res.json();
    renderDiagnostics(diag);
  } catch (err) {
    console.error('Validation error:', err);
  }
}

async function triggerPreview() {
  if (!currentSnippet) return;
  try {
    const res = await fetch(`${API_BASE}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSnippet)
    });
    const data = await res.json();
    previewBox.textContent = data.preview;
  } catch(err) {
    console.error('Preview error:', err);
  }
}

function renderDiagnostics(diag) {
  const issues = [
    ...(diag.conflicts || []),
    ...(diag.boundaries || []),
    ...(diag.encodings || [])
  ];

  if (issues.length === 0) {
    diagnosticsBox.className = 'diagnostics clean';
    diagnosticsBox.innerHTML = 'No issues detected.';
    return;
  }

  diagnosticsBox.className = 'diagnostics';
  const ul = document.createElement('ul');
  issues.forEach(i => {
    const li = document.createElement('li');
    li.textContent = i;
    ul.appendChild(li);
  });
  diagnosticsBox.innerHTML = '';
  diagnosticsBox.appendChild(ul);
}

// Bind events
inputTriggers.addEventListener('input', handleEdit);
inputBody.addEventListener('input', handleEdit);
inputWord.addEventListener('change', handleEdit);


btnSave.addEventListener('click', async () => {
  if (!currentSnippet) return;
  const draft = getDraft();
  try {
    const res = await fetch(`${API_BASE}/snippets/${draft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    const saved = await res.json();

    // Update local cache
    const idx = snippets.findIndex(s => s.id === draft.id);
    if (idx >= 0) {
      snippets[idx] = saved;
    } else {
      snippets.push(saved);
    }

    currentSnippet = saved;
    inputId.value = saved.id;
    renderList();
    alert('Snippet saved');
  } catch (err) {
    console.error('Save error:', err);
    alert('Failed to save');
  }
});

btnNew.addEventListener('click', () => {
  const newId = 'new-' + Date.now();
  const s = {
    id: newId,
    triggers: [':new'],
    body: 'new snippet',
    origin: { source: 'espanso', path: 'new' }
  };
  snippets.unshift(s);
  selectSnippet(newId);
});

btnDelete.addEventListener('click', async () => {
  // Mock delete since we only require PUT for the MVP but good to have a simple local state removal
  if (!currentSnippet) return;
  if (!confirm('Remove this snippet?')) return;

  const idx = snippets.findIndex(s => s.id === currentSnippet.id);
  if (idx >= 0) snippets.splice(idx, 1);
  currentSnippet = null;
  renderList();
  if (snippets.length > 0) {
    selectSnippet(snippets[0].id);
  } else {
    inputId.value = '';
    inputTriggers.value = '';
    inputBody.value = '';
  }
});

btnDryrun.addEventListener('click', async () => {
  modalExport.classList.add('open');
  exportContent.textContent = 'Generating plan...';
  try {
    const res = await fetch(`${API_BASE}/export/dry-run`, { method: 'POST' });
    const plan = await res.json();
    exportContent.textContent = JSON.stringify(plan, null, 2);
  } catch(err) {
    exportContent.textContent = 'Error generating plan:\n' + err.message;
  }
});

btnCloseModal.addEventListener('click', () => modalExport.classList.remove('open'));
btnCloseModalFooter.addEventListener('click', () => modalExport.classList.remove('open'));
