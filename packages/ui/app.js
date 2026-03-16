const API_BASE = '/api';

// State
let snippets = [];
let currentSnippet = null;
let openTabs = []; // array of snippet IDs

// DOM Elements
const listEl = document.getElementById('snippet-list');
const tabBar = document.getElementById('tab-bar');
const btnNew = document.getElementById('btn-new');
const btnSave = document.getElementById('btn-save');
const btnDelete = document.getElementById('btn-delete');
const btnDryrun = document.getElementById('btn-dryrun');

const inputId = document.getElementById('input-id');
const inputTriggers = document.getElementById('input-triggers');
const inputBody = document.getElementById('input-body');
const inputWord = document.getElementById('input-word');
const inputSearch = document.getElementById('input-search');

const diagnosticsBox = document.getElementById('diagnostics-box');
const previewBox = document.getElementById('preview-box');

const statusLeft = document.getElementById('status-left');
const statusRight = document.getElementById('status-right');

const modalExport = document.getElementById('modal-export');
const exportContent = document.getElementById('export-plan-content');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCloseModalFooter = document.getElementById('btn-close-modal-footer');

const commandPalette = document.getElementById('command-palette');
const paletteBackdrop = document.getElementById('palette-backdrop');
const commandInput = document.getElementById('command-input');
const commandList = document.getElementById('command-list');

let isPaletteOpen = false;
let paletteItems = [];
let selectedPaletteIndex = 0;

async function fetchSnippets() {
  try {
    const res = await fetch(`${API_BASE}/snippets`, {
      headers: { 'X-SEC-Token': window.__SEC_TOKEN__ }
    });

    if (!res.ok) {
      throw new Error(`Status: ${res.status}`);
    }

    snippets = await res.json();
    renderList();
    updateStatus();
    if (snippets.length > 0 && !currentSnippet) {
      selectSnippet(snippets[0].id);
    }
  } catch (err) {
    console.error('Failed to fetch snippets:', err);
  }
}

function updateStatus() {
  if (snippets) {
    statusRight.textContent =
      `${snippets.length} snippet${snippets.length === 1 ? '' : 's'}`;
  }

  if (currentSnippet) {
    let text = `Selected: ${currentSnippet.id}`;
    if (currentSnippet.id.startsWith('new-')) {
      text += ' (unsaved)';
    }
    statusLeft.textContent = text;

    // Enable inputs
    inputTriggers.disabled = false;
    inputBody.disabled = false;
    inputWord.disabled = false;
    btnSave.disabled = false;
    btnDelete.disabled = false;
  } else {
    statusLeft.textContent = `Ready`;

    // Disable inputs
    inputTriggers.disabled = true;
    inputBody.disabled = true;
    inputWord.disabled = true;
    btnSave.disabled = true;
    btnDelete.disabled = true;
  }
}

function renderList() {
  listEl.innerHTML = '';
  const query = inputSearch.value.toLowerCase();

  const filtered = snippets.filter(s => {
    if (!query) return true;
    const triggers = s.triggers.join(', ').toLowerCase();
    const body = s.body.toLowerCase();
    return triggers.includes(query) || body.includes(query);
  });

  // Group snippets by origin.path (or 'Unsaved' / 'Unknown File')
  const groups = new Map();

  const getExplorerGroupName = (s) => {
    if (s.id.startsWith('new-')) return 'Unsaved';
    if (!s.origin || !s.origin.path) return 'Unknown File';
    if (s.origin.path === 'new') return 'Unknown File';
    const parts = s.origin.path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  filtered.forEach(s => {
    const groupName = getExplorerGroupName(s);
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(s);
  });

  // Render groups
  groups.forEach((groupSnippets, groupName) => {
    const header = document.createElement('li');
    header.className = 'explorer-group-header';
    header.setAttribute('role', 'presentation');
    header.textContent = groupName;
    listEl.appendChild(header);

    groupSnippets.forEach(s => {
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
  });
}

function renderTabs() {
  tabBar.innerHTML = '';
  openTabs.forEach(id => {
    const s = snippets.find(x => x.id === id);
    if (!s) return; // ignore invalid tabs

    const isUnsaved = id.startsWith('new-');
    const triggersText = s.triggers.length > 0 ? s.triggers.join(', ') : '(No trigger)';
    const displayLabel = `${triggersText}${isUnsaved ? ' *' : ''}`;

    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.setAttribute('role', 'tab');

    const isActive = (currentSnippet && currentSnippet.id === id);
    if (isActive) {
      tab.classList.add('active');
    }
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;

    tab.addEventListener('click', () => selectSnippet(id));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSnippet(id);
      }
    });

    const titleSpan = document.createElement('span');
    titleSpan.textContent = displayLabel;
    titleSpan.title = s.id;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', `Close tab ${displayLabel}`);
    closeBtn.textContent = 'x';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(id);
    });

    tab.appendChild(titleSpan);
    tab.appendChild(closeBtn);
    tabBar.appendChild(tab);
  });
}

function closeTab(id) {
  openTabs = openTabs.filter(tid => tid !== id);
  if (currentSnippet && currentSnippet.id === id) {
    currentSnippet = null;
    inputId.value = '';
    inputTriggers.value = '';
    inputBody.value = '';
    inputWord.checked = false;
    if (openTabs.length > 0) {
      selectSnippet(openTabs[openTabs.length - 1]);
    } else {
      previewBox.textContent = '';
      diagnosticsBox.className = 'diagnostics clean';
      diagnosticsBox.innerHTML = 'All good.';
      renderList();
      renderTabs();
      updateStatus();
    }
  } else {
    renderTabs();
  }
}

function selectSnippet(id) {
  const s = snippets.find(x => x.id === id);
  if (!s) return;

  if (!openTabs.includes(id)) {
    openTabs.push(id);
  }

  currentSnippet = { ...s }; // copy for editing

  inputId.value = s.id;
  inputTriggers.value = s.triggers.join(', ');
  inputBody.value = s.body;
  inputWord.checked = s.constraints?.wordBoundary || false;

  renderList();
  renderTabs();
  updateStatus();
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
  renderTabs();
  updateStatus();

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
      headers: {
        'Content-Type': 'application/json',
        'X-SEC-Token': window.__SEC_TOKEN__
      },
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
      headers: {
        'Content-Type': 'application/json',
        'X-SEC-Token': window.__SEC_TOKEN__
      },
      body: JSON.stringify(currentSnippet)
    });
    const data = await res.json();
    let previewText = data.preview.text || '';
    if (data.preview.isTemplate) {
      previewText += '\n\n(Template variables detected)';
    }
    if (data.preview.warnings && data.preview.warnings.length > 0) {
      previewText += '\n\nWarnings:\n' + data.preview.warnings.join('\n');
    }
    previewBox.textContent = previewText;
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

  // Build a dynamic regex matching any known snippet ID
  // Escape IDs to safely embed them in the regex
  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const knownIds = snippets.map(s => escapeRegExp(s.id)).filter(Boolean);
  const knownIdsSet = new Set(snippets.map(s => s.id));

  let idRegex = null;
  if (knownIds.length > 0) {
    // Sort by length descending to match longer IDs first (prevent partial matches)
    knownIds.sort((a, b) => b.length - a.length);
    idRegex = new RegExp(`\\b(${knownIds.join('|')})\\b`, 'g');
  }

  issues.forEach(i => {
    const li = document.createElement('li');

    if (!idRegex) {
      li.textContent = i;
      ul.appendChild(li);
      return;
    }

    // Reset regex state for each issue line
    idRegex.lastIndex = 0;

    // Split text by matching IDs
    let lastIndex = 0;
    let match;
    while ((match = idRegex.exec(i)) !== null) {
      const textBefore = i.substring(lastIndex, match.index);
      if (textBefore) {
        li.appendChild(document.createTextNode(textBefore));
      }

      const matchedId = match[0];
      // O(1) membership check
      if (knownIdsSet.has(matchedId)) {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'conflict-link';
        link.textContent = matchedId;
        link.addEventListener('click', () => selectSnippet(matchedId));
        li.appendChild(link);
      } else {
        li.appendChild(document.createTextNode(matchedId));
      }

      lastIndex = idRegex.lastIndex;
    }

    // Append remaining text
    const textAfter = i.substring(lastIndex);
    if (textAfter) {
      li.appendChild(document.createTextNode(textAfter));
    }

    ul.appendChild(li);
  });
  diagnosticsBox.innerHTML = '';
  diagnosticsBox.appendChild(ul);
}

// Bind events
inputTriggers.addEventListener('input', handleEdit);
inputBody.addEventListener('input', handleEdit);
inputWord.addEventListener('change', handleEdit);
inputSearch.addEventListener('input', renderList);


btnSave.addEventListener('click', async () => {
  if (!currentSnippet) return;
  const draft = getDraft();
  const oldId = currentSnippet.id;
  try {
    const res = await fetch(`${API_BASE}/snippets/${oldId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-SEC-Token': window.__SEC_TOKEN__
      },
      body: JSON.stringify(draft)
    });

    if (!res.ok) {
      const textData = await res.text();
      let errorMessage = `Status: ${res.status}`;
      try {
        const errorData = JSON.parse(textData);
        if (errorData.error) errorMessage = errorData.error;
      } catch (e) {
        // Fallback to text if JSON parsing fails
        if (textData) errorMessage = textData;
      }
      throw new Error(errorMessage);
    }

    const saved = await res.json();

    // Update local cache
    const idx = snippets.findIndex(s => s.id === oldId);
    if (idx >= 0) {
      snippets[idx] = saved;
    } else {
      snippets.push(saved);
    }

    // if new ID was assigned on save (e.g. from new-123 to stableId), update openTabs
    if (oldId !== saved.id) {
      const tabIdx = openTabs.indexOf(oldId);
      if (tabIdx >= 0) {
        openTabs[tabIdx] = saved.id;
      }
    }

    currentSnippet = saved;
    inputId.value = saved.id;
    renderList();
    renderTabs();
    updateStatus();
    alert('Snippet saved');
  } catch (err) {
    console.error('Save error:', err);
    const message = err && err.message ? err.message : 'Unknown error';
    alert(`Failed to save: ${message}`);
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
  if (!currentSnippet) return;

  // Prevent deleting new unsaved snippets that haven't been PUT to server yet
  if (currentSnippet.id.startsWith('new-')) {
    const idx = snippets.findIndex(s => s.id === currentSnippet.id);
    if (idx >= 0) snippets.splice(idx, 1);
    currentSnippet = null;
    renderList();
    updateStatus();
    if (snippets.length > 0) selectSnippet(snippets[0].id);
    return;
  }

  if (!confirm('Remove this snippet?')) return;

  try {
    const res = await fetch(`${API_BASE}/snippets/${currentSnippet.id}`, {
      method: 'DELETE',
      headers: { 'X-SEC-Token': window.__SEC_TOKEN__ }
    });

    if (res.ok) {
      const idx = snippets.findIndex(s => s.id === currentSnippet.id);
      if (idx >= 0) snippets.splice(idx, 1);

      currentSnippet = null;

      // Clean up stale tabs against actual snippets array
      openTabs = openTabs.filter(tid => snippets.some(s => s.id === tid));

      renderList();
      renderTabs();
      updateStatus();

      if (openTabs.length > 0) {
        selectSnippet(openTabs[openTabs.length - 1]);
      } else if (snippets.length > 0) {
        selectSnippet(snippets[0].id);
      } else {
        inputId.value = '';
        inputTriggers.value = '';
        inputBody.value = '';
        previewBox.textContent = '';
        diagnosticsBox.className = 'diagnostics clean';
        diagnosticsBox.innerHTML = 'All good.';
        updateStatus();
      }
    } else {
      alert('Failed to delete');
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete');
  }
});

btnDryrun.addEventListener('click', async () => {
  modalExport.classList.add('open');
  exportContent.textContent = 'Generating plan...';
  try {
    const res = await fetch(`${API_BASE}/export/dry-run`, {
      method: 'POST',
      headers: { 'X-SEC-Token': window.__SEC_TOKEN__ }
    });
    const plan = await res.json();
    exportContent.textContent = JSON.stringify(plan, null, 2);
  } catch(err) {
    exportContent.textContent = 'Error generating plan:\n' + err.message;
  }
});

btnCloseModal.addEventListener('click', () => modalExport.classList.remove('open'));
btnCloseModalFooter.addEventListener('click', () => modalExport.classList.remove('open'));

// --- Command Palette Logic ---

function getAvailableCommands() {
  return [
    {
      name: 'New Snippet',
      shortcut: '',
      action: () => btnNew.click()
    },
    {
      name: 'Save Snippet',
      shortcut: '',
      action: () => {
        if (!btnSave.disabled) btnSave.click();
      }
    },
    {
      name: 'Delete Snippet',
      shortcut: '',
      action: () => {
        if (!btnDelete.disabled) btnDelete.click();
      }
    },
    {
      name: 'Dry-run Export (Espanso)',
      shortcut: '',
      action: () => btnDryrun.click()
    }
  ];
}

function openPalette() {
  isPaletteOpen = true;
  commandPalette.classList.add('open');
  paletteBackdrop.classList.add('open');
  commandInput.value = '';
  renderPalette();
  commandInput.focus();
}

function closePalette() {
  isPaletteOpen = false;
  commandPalette.classList.remove('open');
  paletteBackdrop.classList.remove('open');
  // Return focus to active snippet body if available
  if (currentSnippet) {
    inputBody.focus();
  }
}

function renderPalette() {
  const query = commandInput.value.toLowerCase().trim();
  commandList.innerHTML = '';

  // 1. Gather Commands
  let commands = getAvailableCommands();
  if (query) {
    commands = commands.filter(cmd => cmd.name.toLowerCase().includes(query));
  }

  // 2. Gather Snippets
  let filteredSnippets = [];
  if (query) {
    filteredSnippets = snippets.filter(s => {
      const triggers = s.triggers.join(', ').toLowerCase();
      const body = s.body.toLowerCase();
      const id = s.id.toLowerCase();
      return triggers.includes(query) || body.includes(query) || id.includes(query);
    });
  } else {
    // default show recently opened or first few snippets
    filteredSnippets = snippets.slice(0, 5);
  }

  paletteItems = [
    ...commands.map(cmd => ({ type: 'command', item: cmd })),
    ...filteredSnippets.map(s => ({ type: 'snippet', item: s }))
  ];

  if (paletteItems.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No results found.';
    li.style.color = '#6b7280';
    li.style.cursor = 'default';
    commandList.appendChild(li);
    selectedPaletteIndex = -1;
    return;
  }

  if (selectedPaletteIndex >= paletteItems.length) {
    selectedPaletteIndex = 0;
  }
  if (selectedPaletteIndex < 0) {
    selectedPaletteIndex = 0;
  }

  paletteItems.forEach((entry, idx) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    if (idx === selectedPaletteIndex) {
      li.classList.add('active');
      li.setAttribute('aria-selected', 'true');
    } else {
      li.setAttribute('aria-selected', 'false');
    }

    if (entry.type === 'command') {
      const nameSpan = document.createElement('span');
      nameSpan.className = 'command-name';
      nameSpan.textContent = entry.item.name;
      li.appendChild(nameSpan);

      if (entry.item.shortcut) {
        const keySpan = document.createElement('span');
        keySpan.className = 'command-shortcut';
        keySpan.textContent = entry.item.shortcut;
        li.appendChild(keySpan);
      }
    } else if (entry.type === 'snippet') {
      const s = entry.item;
      const nameSpan = document.createElement('span');
      nameSpan.className = 'command-name';
      const triggersText = s.triggers.length > 0 ? s.triggers.join(', ') : s.id;
      nameSpan.textContent = `Open: ${triggersText}`;
      li.appendChild(nameSpan);

      const pathSpan = document.createElement('span');
      pathSpan.className = 'command-shortcut';
      pathSpan.textContent = s.origin && s.origin.path ? s.origin.path.split(/[/\\]/).pop() : 'Snippet';
      li.appendChild(pathSpan);
    }

    li.addEventListener('click', () => {
      executePaletteItem(entry);
    });
    li.addEventListener('mouseenter', () => {
      // In-place update to prevent re-render flickering
      if (selectedPaletteIndex !== idx) {
        const currentActive = commandList.querySelector('li.active');
        if (currentActive) {
          currentActive.classList.remove('active');
          currentActive.setAttribute('aria-selected', 'false');
        }
        selectedPaletteIndex = idx;
        li.classList.add('active');
        li.setAttribute('aria-selected', 'true');
      }
    });

    commandList.appendChild(li);
  });

  // scroll to active item
  const activeLi = commandList.querySelector('li.active');
  if (activeLi) {
    activeLi.scrollIntoView({ block: 'nearest' });
  }
}

function executePaletteItem(entry) {
  closePalette();
  if (entry.type === 'command') {
    entry.item.action();
  } else if (entry.type === 'snippet') {
    selectSnippet(entry.item.id);
  }
}

// Event Listeners for Command Palette
commandInput.addEventListener('input', () => {
  selectedPaletteIndex = 0;
  renderPalette();
});

commandInput.addEventListener('keydown', (e) => {
  if (paletteItems.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedPaletteIndex = (selectedPaletteIndex + 1) % paletteItems.length;
    renderPalette();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedPaletteIndex = (selectedPaletteIndex - 1 + paletteItems.length) % paletteItems.length;
    renderPalette();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedPaletteIndex >= 0 && selectedPaletteIndex < paletteItems.length) {
      executePaletteItem(paletteItems[selectedPaletteIndex]);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closePalette();
  }
});

paletteBackdrop.addEventListener('click', closePalette);

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    // Block if Export Modal is open
    if (modalExport.classList.contains('open')) {
      return;
    }

    e.preventDefault();
    if (isPaletteOpen) {
      closePalette();
    } else {
      openPalette();
    }
  } else if (e.key === 'Escape' && isPaletteOpen) {
    e.preventDefault();
    closePalette();
  }
});
