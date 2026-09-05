/* ============================================================
   CONFIGURATION - FILL IN YOUR POSTBASE DETAILS HERE
   ============================================================ */
const CONFIG = {
    // Your Postbase API Base URL
    POSTBASE_URL: 'https://postbase-production-b4c8.up.railway.app/api/v1',

    // YOUR ANON KEY - Copy this from Postbase Dashboard → API Keys
    ANON_KEY: 'pb_anon_F2szKSwUOQXYB6lXCDFmbfYh2KWZJRAEDlmbEf614-H8PBzQmWc3Ob5TqLD5XiUW',

    // REST endpoint for the snippets table
    get REST_URL() {
        return `${this.POSTBASE_URL}/rest/snippets`;
    }
};

/* ============================================================
   GLOBAL STATE
   ============================================================ */
let state = {
    user: null,
    snippets: [],
    currentSnippetId: null,
    searchTerm: '',
    languageFilter: '',
    tagFilter: '',
};

/* ============================================================
   DOM REFS
   ============================================================ */
const $ = (id) => document.getElementById(id);
const pages = {
    login: $('page-login'),
    dashboard: $('page-dashboard'),
    form: $('page-form'),
    detail: $('page-detail'),
};

const toastEl = $('toast');
let toastTimeout = null;

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function showToast(message, type = 'info') {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3000);
}

/* ============================================================
   PAGE NAVIGATION
   ============================================================ */
function showPage(pageId) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add('active');
}

/* ============================================================
   AUTH HELPERS (STORAGE)
   ============================================================ */
function saveSession(user) {
    localStorage.setItem('devsnippet_user', JSON.stringify(user));
    state.user = user;
}

function getSession() {
    const data = localStorage.getItem('devsnippet_user');
    if (data) {
        try {
            state.user = JSON.parse(data);
            return state.user;
        } catch (e) {
            return null;
        }
    }
    return null;
}

function clearSession() {
    localStorage.removeItem('devsnippet_user');
    state.user = null;
    state.snippets = [];
}

/* ============================================================
   API HELPERS (Postbase REST)
   ============================================================ */
function getHeaders() {
    if (!state.user || !state.user.access_token) {
        throw new Error('User not authenticated');
    }
    return {
        'apikey': CONFIG.ANON_KEY,
        'Authorization': `Bearer ${state.user.access_token}`,
        'Content-Type': 'application/json',
    };
}

async function fetchSnippets() {
    if (!state.user) return [];
    const headers = getHeaders();
    const url = `${CONFIG.REST_URL}?user_id=eq.${state.user.id}&order=created_at.desc`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to fetch snippets: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    state.snippets = data;
    return data;
}

async function createSnippet(payload) {
    const headers = getHeaders();
    const body = {
        user_id: state.user.id,
        ...payload
    };
    const resp = await fetch(CONFIG.REST_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to create snippet: ${resp.status} ${text}`);
    }
    return await resp.json();
}

async function updateSnippet(id, payload) {
    const headers = getHeaders();
    const url = `${CONFIG.REST_URL}?id=eq.${id}&user_id=eq.${state.user.id}`;
    const resp = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to update snippet: ${resp.status} ${text}`);
    }
    return await resp.json();
}

async function deleteSnippet(id) {
    const headers = getHeaders();
    const url = `${CONFIG.REST_URL}?id=eq.${id}&user_id=eq.${state.user.id}`;
    const resp = await fetch(url, {
        method: 'DELETE',
        headers,
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to delete snippet: ${resp.status} ${text}`);
    }
    return true;
}

/* ============================================================
   RENDER FUNCTIONS
   ============================================================ */
function renderSnippets() {
    const grid = $('snippet-grid');
    const empty = $('empty-state');
    let filtered = state.snippets;

    if (state.searchTerm.trim()) {
        const term = state.searchTerm.toLowerCase().trim();
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(term) ||
            (s.description && s.description.toLowerCase().includes(term))
        );
    }

    if (state.languageFilter) {
        filtered = filtered.filter(s =>
            s.language && s.language.toLowerCase() === state.languageFilter.toLowerCase()
        );
    }

    if (state.tagFilter.trim()) {
        const tag = state.tagFilter.trim().toLowerCase();
        filtered = filtered.filter(s => {
            if (!s.tags) return false;
            const tags = s.tags.split(',').map(t => t.trim().toLowerCase());
            return tags.includes(tag);
        });
    }

    const cards = grid.querySelectorAll('.snippet-card');
    cards.forEach(el => el.remove());

    if (filtered.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    filtered.forEach(snippet => {
        const card = document.createElement('div');
        card.className = 'snippet-card';
        card.dataset.id = snippet.id;

        const tagsHtml = snippet.tags ? snippet.tags.split(',').map(t =>
            `<span class="snippet-card-tag">${t.trim()}</span>`
        ).join('') : '';

        const date = snippet.created_at ? new Date(snippet.created_at).toLocaleDateString() : 'N/A';
        const lang = snippet.language || 'Unknown';

        card.innerHTML = `
            <span class="snippet-card-language">${lang}</span>
            <div class="snippet-card-title">${snippet.title || 'Untitled'}</div>
            <div class="snippet-card-description">${snippet.description || ''}</div>
            <div class="snippet-card-tags">${tagsHtml}</div>
            <div class="snippet-card-footer">
                <span>${date}</span>
                <div class="snippet-card-actions">
                    <button class="btn-edit-card" data-id="${snippet.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete-card" data-id="${snippet.id}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            openDetail(snippet.id);
        });

        card.querySelector('.btn-edit-card').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditForm(snippet.id);
        });

        card.querySelector('.btn-delete-card').addEventListener('click', (e) => {
            e.stopPropagation();
            handleDelete(snippet.id);
        });

        grid.appendChild(card);
    });
}

/* ============================================================
   AUTH: GOOGLE LOGIN - TEST 2: sign-in/social (WITH state)
   ============================================================ */
$('btn-google-login').addEventListener('click', () => {
    const redirectTo = window.location.origin + window.location.pathname;
    
    // ===== TEST 2: sign-in/social WITH state =====
    const stateParam = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://postbase-production-b4c8.up.railway.app/api/auth/sign-in/social?provider=google&redirect_to=${encodeURIComponent(redirectTo)}&state=${stateParam}`;
    
    console.log('🟢 TEST 2 - Opening:', authUrl);
    window.open(authUrl, 'google-auth', 'width=500,height=600,left=200,top=100');
});

// Handle OAuth callback from URL params
function handleOAuthCallback() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token') || hashParams.get('token');
    const userId = hashParams.get('user_id') || hashParams.get('id');
    const email = hashParams.get('email');
    const avatar = hashParams.get('avatar_url');
    
    const queryParams = new URLSearchParams(window.location.search);
    const queryAccessToken = queryParams.get('access_token') || queryParams.get('token');
    const queryUserId = queryParams.get('user_id') || queryParams.get('id');
    const queryEmail = queryParams.get('email');
    const queryAvatar = queryParams.get('avatar_url');
    
    const finalToken = accessToken || queryAccessToken;
    const finalUserId = userId || queryUserId;
    const finalEmail = email || queryEmail || 'user@example.com';
    const finalAvatar = avatar || queryAvatar || '';

    if (finalToken && finalUserId) {
        const user = {
            id: finalUserId,
            email: finalEmail,
            avatar: finalAvatar,
            access_token: finalToken,
        };
        saveSession(user);
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('Welcome back!', 'success');
        loadDashboard();
        return true;
    }
    return false;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function loadDashboard() {
    const user = getSession();
    if (!user) {
        showPage('login');
        return;
    }

    showPage('dashboard');
    $('user-email').textContent = user.email || '';
    if (user.avatar) {
        $('user-avatar').src = user.avatar;
        $('user-avatar').style.display = 'inline-block';
    } else {
        $('user-avatar').style.display = 'none';
    }

    try {
        await fetchSnippets();
        renderSnippets();
    } catch (err) {
        showToast('Failed to load snippets: ' + err.message, 'error');
    }
}

/* ============================================================
   LOGOUT
   ============================================================ */
$('btn-logout').addEventListener('click', () => {
    clearSession();
    showPage('login');
    showToast('Logged out.', 'info');
});

/* ============================================================
   CREATE / EDIT FORM
   ============================================================ */
function openCreateForm() {
    state.currentSnippetId = null;
    $('form-title').textContent = 'Create New Snippet';
    $('snippet-form').reset();
    $('form-title-input').value = '';
    $('form-description').value = '';
    $('form-language').value = '';
    $('form-tags').value = '';
    $('form-code').value = '';
    showPage('form');
}

function openEditForm(id) {
    const snippet = state.snippets.find(s => s.id === id);
    if (!snippet) {
        showToast('Snippet not found', 'error');
        return;
    }
    state.currentSnippetId = id;
    $('form-title').textContent = 'Edit Snippet';
    $('form-title-input').value = snippet.title || '';
    $('form-description').value = snippet.description || '';
    $('form-language').value = snippet.language || '';
    $('form-tags').value = snippet.tags || '';
    $('form-code').value = snippet.code || '';
    showPage('form');
}

$('btn-create-snippet').addEventListener('click', openCreateForm);
$('btn-form-cancel').addEventListener('click', () => {
    loadDashboard();
});

$('snippet-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('form-title-input').value.trim();
    const description = $('form-description').value.trim();
    const language = $('form-language').value.trim();
    const tags = $('form-tags').value.trim();
    const code = $('form-code').value.trim();

    if (!title || !code) {
        showToast('Title and Code are required.', 'error');
        return;
    }

    const payload = {
        title,
        description,
        language: language || 'Other',
        tags: tags || '',
        code,
        updated_at: new Date().toISOString(),
    };

    const saveBtn = $('btn-form-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (state.currentSnippetId) {
            await updateSnippet(state.currentSnippetId, payload);
            showToast('Snippet updated!', 'success');
        } else {
            await createSnippet(payload);
            showToast('Snippet created!', 'success');
        }
        await loadDashboard();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Snippet';
    }
});

/* ============================================================
   DETAIL VIEW
   ============================================================ */
async function openDetail(id) {
    const snippet = state.snippets.find(s => s.id === id);
    if (!snippet) {
        showToast('Snippet not found', 'error');
        return;
    }

    showPage('detail');
    $('detail-title').textContent = snippet.title || 'Untitled';
    $('detail-language').textContent = snippet.language || 'Unknown';
    $('detail-description').textContent = snippet.description || 'No description provided.';

    const created = snippet.created_at ? new Date(snippet.created_at).toLocaleString() : 'N/A';
    const updated = snippet.updated_at ? new Date(snippet.updated_at).toLocaleString() : 'N/A';
    $('detail-created').textContent = `Created: ${created}`;
    $('detail-updated').textContent = `Updated: ${updated}`;

    const tagsContainer = $('detail-tags');
    tagsContainer.innerHTML = '';
    if (snippet.tags) {
        snippet.tags.split(',').forEach(t => {
            const span = document.createElement('span');
            span.className = 'tag-pill';
            span.textContent = t.trim();
            tagsContainer.appendChild(span);
        });
    }

    const codeEl = $('detail-code');
    codeEl.textContent = snippet.code || '';
    codeEl.className = `language-${snippet.language?.toLowerCase() || 'plaintext'}`;
    if (window.hljs) {
        window.hljs.highlightElement(codeEl);
    }

    state.currentSnippetId = id;

    $('btn-copy-code').onclick = () => {
        const codeText = snippet.code || '';
        navigator.clipboard.writeText(codeText).then(() => {
            showToast('Code copied to clipboard!', 'success');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = codeText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Code copied!', 'success');
        });
    };

    $('btn-detail-edit').onclick = () => {
        openEditForm(id);
    };

    $('btn-detail-delete').onclick = () => {
        handleDelete(id);
    };
}

$('btn-detail-back').addEventListener('click', () => {
    loadDashboard();
});

/* ============================================================
   DELETE HANDLER
   ============================================================ */
async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this snippet? This action cannot be undone.')) {
        return;
    }
    try {
        await deleteSnippet(id);
        showToast('Snippet deleted.', 'info');
        state.snippets = state.snippets.filter(s => s.id !== id);
        if (pages.detail.classList.contains('active')) {
            loadDashboard();
        } else {
            renderSnippets();
        }
    } catch (err) {
        showToast('Failed to delete: ' + err.message, 'error');
    }
}

/* ============================================================
   SEARCH & FILTERS (Live)
   ============================================================ */
$('search-input').addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    renderSnippets();
});

$('language-filter').addEventListener('change', (e) => {
    state.languageFilter = e.target.value;
    renderSnippets();
});

$('tag-filter').addEventListener('input', (e) => {
    state.tagFilter = e.target.value;
    renderSnippets();
});

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const handled = handleOAuthCallback();
    
    if (!state.user) {
        const session = getSession();
        if (session) {
            loadDashboard();
        } else {
            showPage('login');
        }
    }
});

console.log('🚀 DevSnippet App Loaded - TEST 2: sign-in/social (WITH state)');
