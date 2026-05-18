const routes = [];

export function register(pattern, handler) {
  const parts = pattern.split('/').filter(Boolean).map(p => {
    if (p.startsWith(':')) return { type: 'param', name: p.slice(1) };
    return { type: 'literal', value: p };
  });
  routes.push({ parts, handler });
}

function match(path) {
  const segs = path.split('/').filter(Boolean);
  for (const route of routes) {
    if (route.parts.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < route.parts.length; i++) {
      const part = route.parts[i];
      if (part.type === 'literal') {
        if (part.value !== segs[i]) { ok = false; break; }
      } else {
        params[part.name] = decodeURIComponent(segs[i]);
      }
    }
    if (ok) return { handler: route.handler, params };
  }
  return null;
}

let currentToken = 0;

async function dispatch() {
  const path = location.hash.slice(1) || '/today';
  const m = match(path);
  const token = ++currentToken;
  const view = document.getElementById('view');
  view.innerHTML = '<div class="loading">불러오는 중…</div>';
  if (!m) {
    location.hash = '#/today';
    return;
  }
  try {
    const result = await m.handler(m.params);
    if (token !== currentToken) return; // user navigated away
    if (result instanceof Node) {
      view.replaceChildren(result);
    } else if (typeof result === 'string') {
      view.innerHTML = result;
    }
  } catch (err) {
    if (token !== currentToken) return;
    console.error('Route handler error:', err);
    view.innerHTML = `
      <div class="error-box">
        <strong>오류가 발생했습니다.</strong>
        <p>${escapeHtml(err.message || String(err))}</p>
      </div>`;
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function start() {
  window.addEventListener('hashchange', dispatch);
  dispatch();
}

export function navigate(path) {
  if (path.startsWith('#')) path = path.slice(1);
  if (location.hash === '#' + path) {
    dispatch();
  } else {
    location.hash = '#' + path;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
