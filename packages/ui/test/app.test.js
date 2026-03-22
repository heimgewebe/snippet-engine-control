const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('UI app.js - New Snippet Default Behavior', () => {
    const listeners = {};

    // Spies on mock elements to capture event handlers and state
    const createMockElement = (id) => ({
        id,
        innerHTML: '',
        textContent: '',
        value: '',
        checked: false,
        disabled: false,
        appendChild: () => {},
        addEventListener: (event, cb) => {
            if (!listeners[id]) listeners[id] = {};
            listeners[id][event] = cb;
        },
        setAttribute: () => {},
        classList: {
            add: () => {},
            remove: () => {},
            contains: () => false
        },
        dataset: {},
        focus: () => {}
    });

    const mockElements = {
        'snippet-list': createMockElement('snippet-list'),
        'tab-bar': createMockElement('tab-bar'),
        'btn-new': createMockElement('btn-new'),
        'btn-save': createMockElement('btn-save'),
        'btn-delete': createMockElement('btn-delete'),
        'btn-dryrun': createMockElement('btn-dryrun'),
        'btn-apply': createMockElement('btn-apply'),
        'input-id': createMockElement('input-id'),
        'input-triggers': createMockElement('input-triggers'),
        'input-body': createMockElement('input-body'),
        'input-word': createMockElement('input-word'),
        'input-search': createMockElement('input-search'),
        'diagnostics-box': createMockElement('diagnostics-box'),
        'preview-box': createMockElement('preview-box'),
        'status-left': createMockElement('status-left'),
        'status-right': createMockElement('status-right'),
        'modal-export': createMockElement('modal-export'),
        'modal-export-title': createMockElement('modal-export-title'),
        'export-plan-content': createMockElement('export-plan-content'),
        'btn-close-modal': createMockElement('btn-close-modal'),
        'btn-close-modal-footer': createMockElement('btn-close-modal-footer'),
        'modal-settings': createMockElement('modal-settings'),
        'btn-settings': createMockElement('btn-settings'),
        'btn-close-settings': createMockElement('btn-close-settings'),
        'btn-save-settings': createMockElement('btn-save-settings'),
        'setting-theme': createMockElement('setting-theme'),
        'command-palette': createMockElement('command-palette'),
        'palette-backdrop': createMockElement('palette-backdrop'),
        'command-input': createMockElement('command-input'),
        'command-list': createMockElement('command-list')
    };

    const sandbox = {
        document: {
            getElementById: (id) => mockElements[id] || createMockElement(id),
            createElement: (tag) => createMockElement(tag),
            body: createMockElement('body'),
            activeElement: null,
            addEventListener: (event, cb) => {
                if (!listeners['document']) listeners['document'] = {};
                listeners['document'][event] = cb;
            }
        },
        window: {
            __SEC_TOKEN__: 'mock-token',
            matchMedia: () => ({ matches: false })
        },
        fetch: async () => ({
            ok: true,
            json: async () => ([]) // Return empty snippet list initially
        }),
        alert: () => {},
        console: { log: () => {}, error: () => {} },
        setTimeout: (cb) => { cb(); return 1; },
        clearTimeout: () => {},
        localStorage: { getItem: () => null, setItem: () => {} }
    };

    vm.createContext(sandbox);

    // Load and run app.js in the sandbox
    const code = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
    vm.runInContext(code, sandbox);

    // Trigger the 'New Snippet' flow
    assert.ok(listeners['btn-new']['click'], 'New button should have a click listener');
    listeners['btn-new']['click']();

    // Verify data state
    const snippets = vm.runInContext('snippets', sandbox);
    assert.strictEqual(snippets.length, 1, 'Should have exactly 1 snippet after clicking New');
    assert.strictEqual(snippets[0].constraints.wordBoundary, true, 'New snippets should default to wordBoundary: true');

    // Verify UI state
    assert.strictEqual(mockElements['input-word'].checked, true, 'The UI checkbox should be checked for new snippets');
});
