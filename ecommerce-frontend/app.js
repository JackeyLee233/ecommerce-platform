const API_BASE = 'http://127.0.0.1:3000/api';

const healthStatus = document.getElementById('healthStatus');
const frontendUrl = document.getElementById('frontendUrl');
const productsEl = document.getElementById('products');
const registerResult = document.getElementById('registerResult');
const loginResult = document.getElementById('loginResult');

frontendUrl.textContent = window.location.href;

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function checkHealth() {
  try {
    const data = await fetchJSON(`${API_BASE}/health`);
    healthStatus.textContent = `正常 · ${new Date(data.timestamp).toLocaleString()}`;
    healthStatus.className = 'ok';
  } catch (err) {
    healthStatus.textContent = '不可用';
    healthStatus.className = 'bad';
  }
}

async function loadProducts() {
  productsEl.innerHTML = '加载中...';
  try {
    const data = await fetchJSON(`${API_BASE}/products?limit=12`);
    const items = data.products || [];
    if (!items.length) {
      productsEl.className = 'products empty';
      productsEl.textContent = '当前没有商品数据。后端是通的，但数据库里还没商品。';
      return;
    }
    productsEl.className = 'products';
    productsEl.innerHTML = items.map(p => `
      <article class="product">
        <h3>${p.name || '未命名商品'}</h3>
        <p>${p.description || '无描述'}</p>
        <p><strong>价格：</strong>¥${p.price ?? '-'}</p>
        <p><strong>状态：</strong>${p.status || '-'}</p>
        <p><strong>库存：</strong>${p.inventory?.available ?? p.inventory?.total ?? '-'}</p>
      </article>
    `).join('');
  } catch (err) {
    productsEl.className = 'products empty';
    productsEl.textContent = `加载失败：${err.message}`;
  }
}

document.getElementById('refreshHealth').addEventListener('click', checkHealth);
document.getElementById('loadProducts').addEventListener('click', loadProducts);

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    username: fd.get('username'),
    email: fd.get('email'),
    password: fd.get('password'),
    profile: {
      firstName: fd.get('firstName') || '',
      lastName: fd.get('lastName') || ''
    }
  };
  registerResult.textContent = '提交中...';
  try {
    const data = await fetchJSON(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    registerResult.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    registerResult.textContent = err.message;
  }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    email: fd.get('email'),
    password: fd.get('password')
  };
  loginResult.textContent = '提交中...';
  try {
    const data = await fetchJSON(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    loginResult.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    loginResult.textContent = err.message;
  }
});

checkHealth();
