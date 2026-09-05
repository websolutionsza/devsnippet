/* ============================================================
   CONFIGURATION - FILL IN YOUR POSTBASE DETAILS HERE
   ============================================================ */
const CONFIG = {
    // Your Postbase API Base URL (e.g., https://your-project.up.railway.app/api/v1)
    POSTBASE_URL: 'https://postbase-production-b4c8.up.railway.app/api/v1',

    // YOUR ANON KEY - Copy this from Postbase Dashboard → API Keys
    ANON_KEY: 'pb_anon_F2szKSwUOQXYB6lXCDFmbfYh2KWZJRAEDlmbEf614-H8PBzQmWc3Ob5TqLD5XiUW',

    // REST endpoint for the snippets table (adjust if your URL structure is different)
    get REST_URL() {
        return `${this.POSTBASE_URL}/rest/snippets`;
    }
};

/* ============================================================
   GLOBAL STATE
   ============================================================ */
let state = {
    user: null,          // { id, email, avatar, access_token }
    snippets: [],
    currentSnippetId: null, // for editing
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
    // Force reflow
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

// GET snippets for the current user
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

// CREATE a snippet
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

// UPDATE a snippet
async function updateSnippet(id, payload) {
    const headers = getHeaders();
    // Security: filter by both id AND user_id
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

// DELETE a snippet
async function deleteSnippet(id) {
    const headers = getHeaders();
    // Security: filter by both id AND user_id
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

    // Search filter
    if (state.searchTerm.trim()) {
        const term = state.searchTerm.toLowerCase().trim();
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(term) ||
            (s.description && s.description.toLowerCase().includes(term))
        );
    }

    // Language filter
    if (state.languageFilter) {
        filtered = filtered.filter(s =>
            s.language && s.language.toLowerCase() === state.languageFilter.toLowerCase()
        );
    }

    // Tag filter
    if (state.tagFilter.trim()) {
        const tag = state.tagFilter.trim().toLowerCase();
        filtered = filtered.filter(s => {
            if (!s.tags) return false;
            const tags = s.tags.split(',').map(t => t.trim().toLowerCase());
            return tags.includes(tag);
        });
    }

    // Clear grid (keep empty state element)
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

        // Click on card opens detail
        card.addEventListener('click', (e) => {
            // Ignore clicks on buttons inside the card
            if (e.target.closest('button')) return;
            openDetail(snippet.id);
        });

        // Edit button
        card.querySelector('.btn-edit-card').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditForm(snippet.id);
        });

        // Delete button
        card.querySelector('.btn-delete-card').addEventListener('click', (e) => {
            e.stopPropagation();
            handleDelete(snippet.id);
        });

        grid.appendChild(card);
    });
}

/* ============================================================
   AUTH: GOOGLE LOGIN
   ============================================================ */
// NOTE: Since Postbase uses a redirect flow, we handle the callback
// when the user returns to the app.
// For this demo, we assume the user clicks the button, and Postbase redirects.
// The actual implementation of the OAuth redirect depends on your Postbase setup.
// Usually you redirect to: POSTBASE_URL/oauth/google?redirect_to=YOUR_APP_URL

function initAuth() {
    // Check for existing session
    const session = getSession();
    if (session) {
        // We have a user, load dashboard
        loadDashboard();
        return;
    }

    // Check if we just returned from Google OAuth redirect
    // Postbase usually appends ?access_token=... or uses hash fragment.
    // For simplicity in this build, we expect the user to set the session manually
    // OR we redirect to a specific OAuth flow.
    // Let's implement a basic redirect to Postbase Google Auth.
    // Usually the URL is: https://your-postbase-url/api/auth/v1/authorize?provider=google&redirect_to=YOUR_APP_URL

    // For now, show login page.
    showPage('login');
}

// Login button
$('btn-google-login').addEventListener('click', () => {
    const redirectTo = window.location.origin + window.location.pathname;
    // Try the correct Better Auth Social Sign-In endpoint
    const authUrl = 'https://postbase-production-b4c8.up.railway.app/api/auth/sign-in/social?provider=google&redirect_to=' + encodeURIComponent(redirectTo);
    
    console.log('Redirecting to:', authUrl); // This will show in console if button works
    window.location.href = authUrl;
});

// Handle OAuth callback - This should parse the URL params after redirect
function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token') || params.get('token');
    const userId = params.get('user_id') || params.get('id');
    const email = params.get('email');
    const avatar = params.get('avatar_url');

    if (accessToken && userId) {
        const user = {
            id: userId,
            email: email || 'user@example.com',
            avatar: avatar || '',
            access_token: accessToken,
        };
        saveSession(user);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        loadDashboard();
        showToast('Welcome back!', 'success');
    }
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

    // Load snippets
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

    // Tags
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

    // Code
    const codeEl = $('detail-code');
    codeEl.textContent = snippet.code || '';
    codeEl.className = `language-${snippet.language?.toLowerCase() || 'plaintext'}`;
    // Apply syntax highlighting
    if (window.hljs) {
        window.hljs.highlightElement(codeEl);
    }

    // Store current snippet ID for edit/delete actions
    state.currentSnippetId = id;

    // Copy button
    $('btn-copy-code').onclick = () => {
        const codeText = snippet.code || '';
        navigator.clipboard.writeText(codeText).then(() => {
            showToast('Code copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = codeText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Code copied!', 'success');
        });
    };

    // Edit button
    $('btn-detail-edit').onclick = () => {
        openEditForm(id);
    };

    // Delete button
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
        // Remove from local state
        state.snippets = state.snippets.filter(s => s.id !== id);
        // If we are on detail page, go back to dashboard
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
    // Check OAuth callback params
    handleOAuthCallback();

    // If no user after callback check, show login or dashboard based on session
    if (!state.user) {
        const session = getSession();
        if (session) {
            loadDashboard();
        } else {
            showPage('login');
        }
    }
});

/* ============================================================
   NOTE ON AUTHENTICATION FLOW:
   Postbase uses OAuth redirect. After the user logs in via Google,
   they are redirected back to your app with a token in the URL.
   For this to work in development, you need to ensure your
   Postbase Callback URL matches your localhost address.
   If you're testing locally, add http://localhost:5500 or whatever
   your Live Server uses to the authorized redirect URIs in Google Cloud.
   ============================================================ */
