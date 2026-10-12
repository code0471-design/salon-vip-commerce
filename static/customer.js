// ============================================================
// SALON VIP — Customer SPA (Mobile-First Premium)
// ============================================================

const API = '';
let state = {
  currentPage: window.__INITIAL_PAGE__ || 'home',
  user: null,
  salons: [],
  products: [],
  bestProducts: [],
  categories: ['전체', '샴푸', '컨디셔너', '트리트먼트', '오일&세럼', '스타일링'],
  selectedCategory: '전체',
  cart: [],
  orders: [],
  scanResult: null,
  switchInfo: null,
  selectedSalon: null,
  selectedDesigner: null,
  loading: false
};

// ---- Session Storage for demo user ----
function loadUser() {
  const saved = sessionStorage.getItem('salon_user');
  if (saved) state.user = JSON.parse(saved);
}
function saveUser(u) {
  state.user = u;
  sessionStorage.setItem('salon_user', JSON.stringify(u));
}

// ---- API Helpers ----
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

// ---- Toast ----
function showToast(msg, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2800);
}

// ---- Navigation ----
function navigate(page) {
  state.currentPage = page;
  render();
  window.scrollTo(0, 0);
}

// ---- Render Main ----
function render() {
  const app = document.getElementById('app');
  app.innerHTML = renderShell();
  attachListeners();
}

function renderShell() {
  const showCartFAB = state.cart.length > 0 && state.currentPage === 'shop';
  // 매장명: 로그인 상태면 매장명, 없으면 브랜드명
  const salonName = state.user?.salon_name || null;
  return `
    <header class="app-header">
      ${salonName
        ? `<div class="header-salon-name">${salonName}<span class="brand-dot"></span></div>`
        : `<div class="logo">SALON <span>VIP</span></div>`
      }
      <div class="header-right">
        ${state.user ? `<span class="header-user-chip">${state.user.name}님</span>` : ''}
        <i class="fas fa-bell header-icon"></i>
      </div>
    </header>
    <main class="page-content" id="page-content">
      ${renderPage()}
    </main>
    ${renderBottomNav()}
    ${showCartFAB ? renderCartFAB() : ''}
  `;
}

function renderBottomNav() {
  const tabs = [
    { id: 'home',    icon: 'fa-home',    label: '홈' },
    { id: 'scan',    icon: 'fa-qrcode',  label: 'QR 스캔' },
    { id: 'shop',    icon: 'fa-store',   label: '쇼핑' },
    { id: 'profile', icon: 'fa-user',    label: '내 정보' }
  ];
  return `<nav class="bottom-nav">${tabs.map(t => `
    <button class="nav-item ${state.currentPage === t.id ? 'active' : ''}" onclick="navigate('${t.id}')">
      <i class="fas ${t.icon}"></i><span>${t.label}</span>
    </button>`).join('')}</nav>`;
}

function renderCartFAB() {
  const total = state.cart.reduce((s, i) => s + i.qty, 0);
  return `<button class="cart-fab" onclick="openCart()">
    <i class="fas fa-shopping-bag"></i>
    ${total > 0 ? `<span class="cart-count">${total}</span>` : ''}
  </button>`;
}

function renderPage() {
  switch(state.currentPage) {
    case 'home':    return renderHome();
    case 'scan':    return renderScan();
    case 'shop':    return renderShop();
    case 'orders':  return renderOrders();
    case 'profile': return renderProfile();
    default:        return renderHome();
  }
}

// ============================================================
// HOME PAGE
// ============================================================
function renderHome() {
  if (!state.user) return renderLogin();

  const u = state.user;
  const best = state.bestProducts.length > 0 ? state.bestProducts : state.products.slice(0, 6);

  // 카테고리 아이콘 맵
  const catIcons = {
    '샴푸':      'fa-pump-soap',
    '컨디셔너':  'fa-bottle-water',
    '트리트먼트':'fa-star',
    '오일&세럼': 'fa-droplet',
    '스타일링':  'fa-wind',
  };
  const catColors = {
    '샴푸':      '#4f7cff',
    '컨디셔너':  '#7c4fff',
    '트리트먼트':'#ff6b6b',
    '오일&세럼': '#f59e0b',
    '스타일링':  '#10b981',
  };

  return `
    <!-- ① 고객 인사 배너 (한 줄) -->
    <div class="home-greeting-bar">
      <div class="home-greeting-text">
        <span class="greeting-name">${u.name}님,</span>
        <span class="greeting-sub"> 오늘도 좋은 하루 되세요 ✨</span>
      </div>
      <div class="greeting-vip-chip"><i class="fas fa-crown"></i> VIP</div>
    </div>

    <!-- ② 등록된 살롱 카드 -->
    ${u.current_salon_id ? `
    <div class="my-salon-card">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="flex:1;padding-left:8px">
          <div class="salon-tag">등록된 살롱</div>
          <div style="font-size:17px;font-weight:800;color:var(--text);margin:4px 0 2px">${u.salon_name}</div>
          <div style="font-size:12px;color:var(--muted)">담당 · ${u.designer_name || '미배정'}</div>
        </div>
        <div class="salon-verified"><i class="fas fa-check"></i></div>
      </div>
    </div>` : `
    <div style="margin:10px 16px;background:var(--white);border:1.5px dashed var(--border);border-radius:var(--card-r);padding:20px;text-align:center">
      <i class="fas fa-store" style="font-size:36px;color:var(--accent);margin-bottom:10px;display:block;opacity:0.7"></i>
      <p style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:4px">살롱 QR을 스캔해 등록하세요</p>
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px">나만의 살롱 · 담당 디자이너 등록</p>
      <button class="btn-gold" onclick="navigate('scan')"><i class="fas fa-qrcode"></i> QR 스캔하기</button>
    </div>`}

    <!-- ③ 카테고리 메뉴 (살롱카드 바로 아래) -->
    <div class="home-category-grid">
      ${Object.entries(catIcons).map(([name, icon]) => `
        <div class="home-cat-item" onclick="goShopCategory('${name}')">
          <div class="home-cat-icon" style="background:${catColors[name]}18;border:1.5px solid ${catColors[name]}30">
            <i class="fas ${icon}" style="color:${catColors[name]}"></i>
          </div>
          <span class="home-cat-label">${name}</span>
        </div>`).join('')}
    </div>

    <!-- ④ BEST 제품 -->
    <div class="section-header" style="margin-top:4px">
      <span class="section-title">
        <span style="background:var(--rose);color:white;font-size:9px;font-weight:800;padding:3px 7px;border-radius:5px;letter-spacing:1px;margin-right:6px">BEST</span>
        베스트 제품
      </span>
      <span class="see-all" onclick="navigate('shop')">전체보기 →</span>
    </div>
    <div class="best-scroll">
      ${best.map(p => renderBestCard(p)).join('')}
    </div>

    <!-- ⑤ 최근 주문 -->
    <div class="section-header" style="margin-top:4px">
      <span class="section-title">최근 주문</span>
      <span class="see-all" onclick="navigate('orders')">전체보기 →</span>
    </div>
    <div class="order-list" style="padding:0 16px 100px">
      ${state.orders.length === 0
        ? `<div style="text-align:center;padding:20px 0;color:var(--muted);font-size:13px"><i class="fas fa-receipt" style="font-size:26px;opacity:0.25;display:block;margin-bottom:8px"></i>주문 내역이 없습니다</div>`
        : state.orders.slice(0,3).map(o => renderOrderCard(o)).join('')}
    </div>
  `;
}

// 홈 카테고리 클릭 → 쇼핑 페이지로 이동 + 카테고리 필터
function goShopCategory(cat) {
  state.selectedCategory = cat;
  navigate('shop');
}

function renderBestCard(p) {
  const disc = Math.round((1 - p.vip_discount_price / p.original_price) * 100);
  const stars = renderStars(p.rating || 4.8);
  return `
    <div class="best-card" onclick="openProductDetail(${p.id})">
      <div class="best-card-img-wrap">
        <img class="best-card-img" src="${p.image_url || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&q=80'}"
             alt="${p.name}" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&q=80'">
        ${p.is_best ? `<div class="best-badge">BEST</div>` : ''}
        <div class="gift-badge"><i class="fas fa-gift"></i></div>
      </div>
      <div class="best-card-body">
        <div class="best-cat">${p.category}</div>
        <div class="best-name">${p.name}</div>
        <div class="best-price-row">
          <span class="best-original">${(p.original_price||0).toLocaleString()}</span>
          <span class="best-discount">${disc}%</span>
        </div>
        <div class="best-vip">${(p.vip_discount_price||0).toLocaleString()}<span style="font-size:11px;font-weight:500">원</span></div>
        <div class="best-rating">
          <span class="best-stars">${stars}</span>
          <span class="best-rating-val">${p.rating || '4.8'}</span>
          <span class="best-rating-cnt">(${(p.review_count||0).toLocaleString()})</span>
        </div>
      </div>
    </div>`;
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = (rating - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '<i class="fas fa-star"></i>'.repeat(full)
    + (half ? '<i class="fas fa-star-half-alt"></i>' : '')
    + '<i class="far fa-star"></i>'.repeat(empty);
}

// ============================================================
// LOGIN PAGE
// ============================================================
function renderLogin() {
  return `
    <div class="login-wrap">
      <div class="login-hero">
        <div class="login-logo">
          <i class="fas fa-scissors" style="font-size:28px;color:var(--accent)"></i>
        </div>
        <h1 style="font-size:26px;font-weight:900;letter-spacing:2px;margin:14px 0 4px;color:var(--text)">SALON VIP</h1>
        <p style="font-size:13px;color:var(--muted);letter-spacing:0.3px">프리미엄 살롱 VIP 멤버십</p>
      </div>

      <div class="vip-perks">
        <div class="perk-row"><i class="fas fa-tag" style="color:var(--rose)"></i><span>모든 제품 <strong style="color:var(--rose)">VIP 전용 할인가</strong> 적용</span></div>
        <div class="perk-row"><i class="fas fa-user-tie" style="color:var(--accent)"></i><span>담당 디자이너 전용 케어</span></div>
        <div class="perk-row"><i class="fas fa-qrcode" style="color:var(--primary2)"></i><span>살롱 QR 스캔으로 간편 등록</span></div>
        <div class="perk-row"><i class="fas fa-gift" style="color:#7c3aed"></i><span>SUBLIMIC 프리미엄 제품 라인업</span></div>
      </div>

      <div class="login-body">
        <div class="form-field">
          <label class="form-label">이름</label>
          <input id="login-name" class="form-input" type="text" placeholder="이름을 입력하세요">
        </div>
        <div class="form-field">
          <label class="form-label">전화번호</label>
          <input id="login-phone" class="form-input" type="tel" placeholder="010-0000-0000">
        </div>
        <button class="btn-primary" style="margin-top:8px" onclick="handleLogin()">
          <i class="fas fa-arrow-right"></i> 시작하기
        </button>
        <div style="text-align:center;margin-top:14px">
          <button onclick="loginAsDemo()" class="demo-link">데모 계정으로 둘러보기</button>
        </div>
      </div>
    </div>
  `;
}

async function handleLogin() {
  const name = document.getElementById('login-name').value.trim();
  const phone = document.getElementById('login-phone').value.trim();
  if (!name) { showToast('이름을 입력해주세요', 'error'); return; }

  const kakaoId = 'kakao_' + Date.now();
  const res = await api('/api/users', 'POST', { kakao_id: kakaoId, name, phone });
  if (res.success) {
    saveUser(res.data);
    await loadAppData();
    render();
    showToast('환영합니다, ' + name + '님! 👋', 'success');
  }
}

async function loginAsDemo() {
  const res = await api('/api/users/1');
  if (res.success) {
    saveUser(res.data.user);
    await loadAppData();
    render();
    showToast('데모 계정으로 로그인했습니다', 'success');
  }
}

// ============================================================
// QR SCAN PAGE
// ============================================================
function renderScan() {
  if (state.switchInfo) return renderSwitchConfirm();
  if (!state.user) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;

  return `
    <div class="scan-page">
      <h2 style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:4px">QR 살롱 스캔</h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:22px">살롱 QR을 스캔하거나 아래에서 직접 선택하세요</p>

      <div class="qr-visual">
        <i class="fas fa-qrcode" style="font-size:72px;color:var(--primary);opacity:0.12"></i>
        <p style="font-size:11px;color:var(--muted);margin-top:10px">카메라 기능 준비 중</p>
      </div>

      <p style="font-size:14px;font-weight:700;color:var(--text);margin:20px 0 12px">
        <i class="fas fa-store" style="color:var(--accent);margin-right:6px"></i>살롱 선택
      </p>
      ${state.salons.map(s => `
        <div class="salon-option ${state.selectedSalon?.id === s.id ? 'selected' : ''}" onclick="selectSalonForScan(${s.id})">
          <div class="salon-icon-wrap">
            <i class="fas fa-scissors" style="color:var(--accent);font-size:16px"></i>
          </div>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--text);font-size:15px">${s.salon_name}</div>
            <div style="font-size:12px;color:var(--muted)">디자이너 ${s.active_designers || 0}명 활동중</div>
          </div>
          ${state.selectedSalon?.id === s.id ? `<i class="fas fa-check-circle" style="color:var(--accent);font-size:20px"></i>` : `<i class="fas fa-chevron-right" style="color:var(--border);font-size:14px"></i>`}
        </div>`).join('')}

      ${state.selectedSalon && state.selectedSalon.designers?.length > 0 ? `
        <div class="designer-section">
          <p style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px">
            <i class="fas fa-cut" style="color:var(--rose);margin-right:6px"></i>담당 디자이너 선택
            <span style="font-size:11px;color:var(--muted);font-weight:400;margin-left:4px">(선택사항)</span>
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            ${state.selectedSalon.designers.map(d => `
              <div class="designer-chip ${state.selectedDesigner === d.id ? 'selected' : ''} ${d.status === 'RESIGNED' ? 'resigned' : ''}" onclick="selectDesigner(${d.id})">
                <div class="d-avatar">
                  <img src="${d.profile_img || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + d.id}" alt="${d.designer_name}">
                </div>
                <span style="font-size:12px;font-weight:600">${d.designer_name.replace(' 디자이너','')}</span>
                ${d.status === 'RESIGNED' ? '<span style="font-size:9px;color:var(--rose)">퇴사</span>' : ''}
              </div>`).join('')}
          </div>
        </div>
        <button class="btn-primary" style="margin-top:16px" onclick="confirmScan()">
          <i class="fas fa-check"></i> ${state.selectedDesigner ? '디자이너와 함께 등록' : '살롱 등록하기'}
        </button>` : state.selectedSalon ? `
        <button class="btn-primary" style="margin-top:16px" onclick="confirmScan()">
          <i class="fas fa-check"></i> 살롱 등록하기
        </button>` : ''}
    </div>
  `;
}

function renderSwitchConfirm() {
  const info = state.switchInfo;
  return `
    <div style="padding:24px 20px">
      <div style="background:linear-gradient(135deg,var(--primary),#0f3460);border-radius:var(--card-r);padding:28px 24px;color:white;text-align:center;margin-bottom:20px">
        <div style="width:64px;height:64px;background:rgba(200,169,110,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <i class="fas fa-exchange-alt" style="font-size:28px;color:var(--accent)"></i>
        </div>
        <h3 style="font-size:18px;font-weight:800;margin-bottom:8px">살롱 변경 확인</h3>
        <p style="font-size:13px;opacity:0.7;margin-bottom:20px">메인 살롱을 변경하시겠습니까?</p>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap">
          <div style="background:rgba(255,255,255,0.1);padding:8px 14px;border-radius:10px;font-size:13px">
            <i class="fas fa-store" style="margin-right:6px;opacity:0.7"></i>${info.from_salon}
          </div>
          <i class="fas fa-arrow-right" style="color:var(--accent)"></i>
          <div style="background:rgba(200,169,110,0.25);border:1px solid rgba(200,169,110,0.5);padding:8px 14px;border-radius:10px;font-size:13px">
            <i class="fas fa-store" style="margin-right:6px;color:var(--accent)"></i>${info.to_salon}
          </div>
        </div>
        <p style="font-size:11px;opacity:0.5;margin-top:14px">※ 기존 주문 내역은 유지됩니다</p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" style="flex:1" onclick="cancelSwitch()">취소</button>
        <button class="btn-primary" style="flex:2" onclick="confirmSwitch()">
          <i class="fas fa-check"></i> 변경하기
        </button>
      </div>
    </div>
  `;
}

async function selectSalonForScan(salonId) {
  const res = await api(`/api/salons/${salonId}/qr`);
  if (res.success) {
    state.selectedSalon = { id: salonId, ...res.data.salon, designers: res.data.designers };
    state.selectedDesigner = null;
    render();
  }
}

function selectDesigner(id) {
  state.selectedDesigner = state.selectedDesigner === id ? null : id;
  render();
}

async function confirmScan() {
  if (!state.selectedSalon || !state.user) return;
  const res = await api(`/api/users/${state.user.id}/scan-qr`, 'POST', {
    salon_id: state.selectedSalon.id,
    designer_id: state.selectedDesigner || null
  });
  if (res.success) {
    if (res.requires_confirmation) {
      state.switchInfo = res.switch_info;
      render();
    } else {
      saveUser(res.data);
      state.selectedSalon = null;
      state.selectedDesigner = null;
      await loadUserOrders();
      render();
      showToast(res.message, 'success');
    }
  }
}

async function confirmSwitch() {
  const info = state.switchInfo;
  const res = await api(`/api/users/${state.user.id}/confirm-switch`, 'POST', {
    to_salon_id: info.to_salon_id,
    designer_id: info.designer_id
  });
  if (res.success) {
    saveUser(res.data);
    state.switchInfo = null;
    state.selectedSalon = null;
    state.selectedDesigner = null;
    await loadUserOrders();
    render();
    showToast(res.message, 'success');
  }
}

function cancelSwitch() {
  state.switchInfo = null;
  state.selectedSalon = null;
  render();
}

// ============================================================
// SHOP PAGE
// ============================================================
function renderShop() {
  const filtered = state.selectedCategory === '전체'
    ? state.products
    : state.products.filter(p => p.category === state.selectedCategory);

  const cartTotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);
  const salonName = state.user?.salon_name || 'SUBLIMIC';

  return `
    <!-- Shop Header -->
    <div class="shop-header">
      <div>
        <h2>${salonName}</h2>
        <p class="sub">프리미엄 헤어케어 · VIP 전용가</p>
      </div>
      ${state.cart.length > 0 ? `
      <div class="cart-mini-bar" onclick="openCart()">
        <i class="fas fa-shopping-bag" style="color:var(--rose);font-size:13px"></i>
        <span style="font-size:12px;font-weight:700;color:var(--rose)">${cartCount}개 담김</span>
        <button class="cart-checkout-btn">결제</button>
      </div>` : `
      <span class="vip-info-bar"><i class="fas fa-crown"></i> VIP 전용가</span>`}
    </div>

    <!-- Category Tabs -->
    <div class="cat-tabs-wrap">
      <div class="cat-tabs">
        ${state.categories.map(cat => `
          <button class="cat-tab ${state.selectedCategory === cat ? 'active' : ''}" onclick="filterCategory('${cat}')">
            ${cat}
          </button>`).join('')}
      </div>
    </div>

    <!-- Product Grid -->
    <div class="product-grid" style="padding-bottom:100px">
      ${filtered.length === 0
        ? `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted)"><i class="fas fa-box-open" style="font-size:36px;opacity:0.3;display:block;margin-bottom:10px"></i>제품이 없습니다</div>`
        : filtered.map(p => renderProductCard(p)).join('')}
    </div>
  `;
}

function renderProductCard(p) {
  const disc = Math.round((1 - p.vip_discount_price / p.original_price) * 100);
  const stars = renderStars(p.rating || 4.8);
  const inCart = state.cart.find(i => i.product_id === p.id);
  return `
    <div class="product-card" onclick="openProductDetail(${p.id})">
      <div class="product-card-img-wrap">
        <img class="product-card-img" src="${p.image_url || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&q=80'}"
             alt="${p.name}" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&q=80'">
        ${p.is_best ? `<div class="p-best-badge">BEST</div>` : ''}
        <div class="p-gift-tag"><i class="fas fa-gift"></i></div>
        ${inCart ? `<div style="position:absolute;bottom:8px;right:8px;background:var(--rose);color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${inCart.qty}</div>` : ''}
      </div>
      <div class="product-card-body">
        <div class="pc-cat">${p.category}</div>
        <div class="pc-name">${p.name}</div>
        <div class="pc-price-row">
          <span class="pc-original">${(p.original_price||0).toLocaleString()}</span>
          <span class="pc-discount-badge">${disc}%</span>
        </div>
        <div class="pc-vip">${(p.vip_discount_price||0).toLocaleString()}<span style="font-size:11px;font-weight:500">원</span></div>
        <div class="pc-rating">
          <span class="pc-stars">${stars}</span>
          <span class="pc-rating-val">${p.rating || '4.8'}</span>
          <span class="pc-review-cnt">${(p.review_count||0).toLocaleString()}</span>
        </div>
      </div>
    </div>`;
}

function filterCategory(cat) {
  state.selectedCategory = cat;
  render();
}

// ---- Product Detail Modal ----
function openProductDetail(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  const qty = state.cart.find(i => i.product_id === id)?.qty || 0;
  const disc = Math.round((1 - p.vip_discount_price / p.original_price) * 100);
  const stars = renderStars(p.rating || 4.8);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <img class="product-detail-img"
           src="${p.image_url || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80'}"
           alt="${p.name}"
           onerror="this.src='https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80'">
      <div style="padding:0 4px">
        <span style="font-size:11px;color:var(--muted);background:var(--light);padding:3px 9px;border-radius:6px;border:1px solid var(--border)">${p.category}</span>
        <h3 class="product-detail-name">${p.name}</h3>
        <div class="product-detail-rating">
          <span class="pc-stars">${stars}</span>
          <span class="pc-rating-val">${p.rating || '4.8'}</span>
          <span class="pc-review-cnt">${(p.review_count||0).toLocaleString()}개 리뷰</span>
          ${p.is_best ? `<span class="p-best-badge" style="position:static;font-size:10px;padding:2px 6px">BEST</span>` : ''}
        </div>
        <div style="display:flex;align-items:baseline;gap:10px;margin:10px 0 6px">
          <span class="detail-vip-price">${(p.vip_discount_price||0).toLocaleString()}원</span>
          <span style="font-size:13px;color:var(--muted);text-decoration:line-through">${(p.original_price||0).toLocaleString()}원</span>
          <span style="font-size:13px;font-weight:700;color:var(--rose)">-${disc}%</span>
        </div>
        <p style="font-size:13px;color:var(--muted);line-height:1.65;margin-bottom:14px;border-top:1px solid var(--border);padding-top:12px">${p.description || ''}</p>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:16px">
          <span>무료배송</span>
          <span>재고 ${p.stock_quantity}개</span>
        </div>

        ${qty > 0 ? `
          <div class="qty-stepper">
            <button class="qty-btn" onclick="updateCartQty(${p.id},-1)">−</button>
            <span class="qty-val">${qty}</span>
            <button class="qty-btn" onclick="updateCartQty(${p.id},1)">+</button>
          </div>` : ''}

        <button class="btn-primary" onclick="addToCart(${p.id});closeModal()">
          <i class="fas fa-shopping-bag"></i> ${qty > 0 ? '추가 담기' : '장바구니 담기'}
        </button>
        <button onclick="closeModal()" style="width:100%;background:none;border:none;padding:14px;color:var(--muted);font-size:13px;cursor:pointer;margin-top:4px">닫기</button>
      </div>
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  document.body.appendChild(modal);
  window.__modal = modal;
  requestAnimationFrame(() => modal.querySelector('.modal-sheet')?.classList.add('open'));
}

function closeModal() {
  if (window.__modal) {
    window.__modal.remove();
    window.__modal = null;
  }
}

function addToCart(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  const existing = state.cart.find(i => i.product_id === productId);
  if (existing) { existing.qty++; }
  else { state.cart.push({ product_id: p.id, name: p.name, price: p.vip_discount_price, qty: 1 }); }
  render();
  showToast('장바구니에 담겼습니다 🛒', 'success');
}

function updateCartQty(productId, delta) {
  const item = state.cart.find(i => i.product_id === productId);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) state.cart = state.cart.filter(i => i.product_id !== productId);
  }
  closeModal();
  render();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.product_id !== productId);
}

// ---- Cart Sheet ----
function openCart() {
  if (!state.user || !state.user.current_salon_id) {
    showToast('먼저 살롱을 등록해주세요', 'error');
    return;
  }
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const designerAmt = state.user.designer_name ? Math.round(total * 0.15) : 0;
  const salonAmt = state.user.designer_name ? Math.round(total * 0.15) : Math.round(total * 0.30);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h3 style="font-size:17px;font-weight:800;color:var(--text);margin-bottom:16px">
        <i class="fas fa-shopping-bag" style="color:var(--rose);margin-right:8px"></i>주문 확인
      </h3>
      <div class="cart-salon-info">
        <div style="font-size:11px;color:var(--muted);margin-bottom:3px">담당 살롱 · 디자이너</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">
          ${state.user.salon_name || '미등록'} · ${state.user.designer_name || '담당 없음'}
        </div>
      </div>
      ${state.cart.map(i => `
        <div class="cart-line">
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text)">${i.name}</div>
            <div style="font-size:12px;color:var(--muted)">${i.price.toLocaleString()}원 × ${i.qty}</div>
          </div>
          <span style="font-size:14px;font-weight:700;color:var(--rose)">${(i.price*i.qty).toLocaleString()}원</span>
        </div>`).join('')}
      <div class="cart-total-row">
        <span>합계</span>
        <span class="cart-total-val">${total.toLocaleString()}원</span>
      </div>
      <div class="rev-breakdown">
        <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:8px">💰 수익 배분</div>
        <div class="rev-grid">
          <div class="rev-item"><div style="font-size:10px;color:var(--muted)">플랫폼</div><div style="font-size:13px;font-weight:700">${Math.round(total*0.4).toLocaleString()}원</div><div style="font-size:10px;color:var(--muted)">40%</div></div>
          <div class="rev-item"><div style="font-size:10px;color:var(--muted)">매장</div><div style="font-size:13px;font-weight:700">${salonAmt.toLocaleString()}원</div><div style="font-size:10px;color:var(--muted)">${state.user.designer_name ? '15%' : '30%'}</div></div>
          <div class="rev-item"><div style="font-size:10px;color:var(--muted)">디자이너</div><div style="font-size:13px;font-weight:700;color:${designerAmt > 0 ? 'var(--text)' : 'var(--muted)'}">${designerAmt.toLocaleString()}원</div><div style="font-size:10px;color:var(--muted)">${state.user.designer_name ? '15%' : '0%'}</div></div>
        </div>
      </div>
      <button class="btn-primary" style="margin-top:4px" onclick="placeOrder()">
        <i class="fas fa-credit-card"></i> 결제하기 ${total.toLocaleString()}원
      </button>
      <button onclick="closeModal()" style="width:100%;background:none;border:none;padding:12px;color:var(--muted);font-size:13px;cursor:pointer;margin-top:4px">취소</button>
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  document.body.appendChild(modal);
  window.__modal = modal;
}

async function placeOrder() {
  if (!state.user || !state.user.current_salon_id) return;
  closeModal();
  const res = await api('/api/orders', 'POST', {
    user_id: state.user.id,
    salon_id: state.user.current_salon_id,
    designer_id: state.user.mapped_designer_id || null,
    items: state.cart.map(i => ({ product_id: i.product_id, qty: i.qty }))
  });
  if (res.success) {
    state.cart = [];
    await loadUserOrders();
    render();
    showToast('주문이 완료되었습니다! 🎉', 'success');
    setTimeout(() => navigate('orders'), 1500);
  } else {
    showToast(res.error || '주문 실패', 'error');
  }
}

// ============================================================
// ORDERS PAGE
// ============================================================
function renderOrders() {
  if (!state.user) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;

  return `
    <div style="padding:16px 20px 8px">
      <h2 style="font-size:20px;font-weight:800;color:var(--text)">주문 내역</h2>
      <p style="font-size:12px;color:var(--muted);margin-top:2px">${state.orders.length}건의 주문</p>
    </div>
    ${state.orders.length === 0
      ? `<div style="text-align:center;padding:60px 24px;color:var(--muted)">
           <i class="fas fa-receipt" style="font-size:48px;opacity:0.2;display:block;margin-bottom:16px"></i>
           <p style="font-weight:600;margin-bottom:6px">주문 내역이 없습니다</p>
           <p style="font-size:13px">VIP 제품을 이용해보세요!</p>
           <button class="btn-gold" onclick="navigate('shop')" style="margin-top:20px;width:auto;padding:12px 28px">쇼핑하기</button>
         </div>`
      : `<div class="order-list" style="padding:0 16px 100px">
           ${state.orders.map(o => renderOrderCard(o)).join('')}
         </div>`}
  `;
}

function renderOrderCard(o) {
  const items = JSON.parse(o.order_items || '[]');
  const statusMap = { PAID:'결제완료', PENDING:'결제대기', CANCELLED:'취소됨', REFUNDED:'환불됨' };
  return `
    <div class="order-card" onclick="openOrderDetail(${o.id})">
      <div class="order-card-top">
        <span style="font-size:11px;color:var(--muted)">#${o.id} · ${new Date(o.created_at).toLocaleDateString('ko-KR')}</span>
        <span class="order-status-badge status-${o.payment_status}">${statusMap[o.payment_status]||o.payment_status}</span>
      </div>
      <div class="order-salon">${o.salon_name}</div>
      <div class="order-designer"><i class="fas fa-user-tie" style="margin-right:4px;opacity:0.5"></i>${o.designer_name || '담당 없음'}</div>
      <div class="order-items-preview">${items.slice(0,2).map(i => i.name).join(' · ')}${items.length > 2 ? ` 외 ${items.length-2}건` : ''}</div>
      <div class="order-footer">
        <span style="font-size:12px;color:var(--muted)">총 ${items.reduce((s,i)=>s+i.qty,0)}개</span>
        <span class="order-amount">${(o.total_amount||0).toLocaleString()}원</span>
      </div>
    </div>`;
}

function openOrderDetail(id) {
  const o = state.orders.find(x => x.id === id);
  if (!o) return;
  const items = JSON.parse(o.order_items || '[]');
  const statusMap = { PAID:'결제완료', PENDING:'결제대기', CANCELLED:'취소됨', REFUNDED:'환불됨' };
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-size:17px;font-weight:800;color:var(--text)">주문 #${o.id}</h3>
        <span class="order-status-badge status-${o.payment_status}">${statusMap[o.payment_status]}</span>
      </div>
      <div class="cart-salon-info" style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted)">살롱 · 디자이너</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:2px">${o.salon_name} · ${o.designer_name||'담당 없음'}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">${new Date(o.created_at).toLocaleString('ko-KR')}</div>
      </div>
      ${items.map(i => `
        <div class="cart-line">
          <span style="font-size:13px;color:var(--text)">${i.name} × ${i.qty}</span>
          <span style="font-size:13px;font-weight:600">${(i.price*i.qty).toLocaleString()}원</span>
        </div>`).join('')}
      <div class="cart-total-row">
        <span>합계</span>
        <span class="cart-total-val">${(o.total_amount||0).toLocaleString()}원</span>
      </div>
      <div class="rev-breakdown">
        <div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:8px">수익 배분 내역</div>
        <div class="rev-grid">
          <div class="rev-item">
            <div style="font-size:10px;color:var(--muted)">플랫폼</div>
            <div style="font-size:13px;font-weight:700">${(o.platform_amount||0).toLocaleString()}원</div>
            <div style="font-size:10px;color:var(--muted)">40%</div>
          </div>
          <div class="rev-item">
            <div style="font-size:10px;color:var(--muted)">매장 오너</div>
            <div style="font-size:13px;font-weight:700">${(o.salon_commission_amount||0).toLocaleString()}원</div>
            <div style="font-size:10px;color:var(--muted)">${Math.round((o.salon_commission_amount||0)/(o.total_amount||1)*100)}%</div>
          </div>
          <div class="rev-item">
            <div style="font-size:10px;color:var(--muted)">디자이너</div>
            <div style="font-size:13px;font-weight:700;color:${(o.designer_commission_amount||0) > 0 ? 'var(--text)' : 'var(--muted)'}">${(o.designer_commission_amount||0).toLocaleString()}원</div>
            <div style="font-size:10px;color:var(--muted)">${Math.round((o.designer_commission_amount||0)/(o.total_amount||1)*100)}%</div>
          </div>
        </div>
      </div>
      <button onclick="closeModal()" style="width:100%;background:none;border:none;padding:14px;color:var(--muted);font-size:13px;cursor:pointer;margin-top:8px">닫기</button>
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  document.body.appendChild(modal);
  window.__modal = modal;
}

// ============================================================
// PROFILE PAGE
// ============================================================
function renderProfile() {
  if (!state.user) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;
  const u = state.user;
  const totalSpent = state.orders.filter(o => o.payment_status === 'PAID').reduce((s,o) => s + o.total_amount, 0);
  const orderCount = state.orders.filter(o => o.payment_status === 'PAID').length;

  return `
    <div class="profile-hero">
      <div class="profile-avatar-wrap">
        <i class="fas fa-user" style="font-size:28px;color:white;opacity:0.9"></i>
      </div>
      <div class="profile-name">${u.name}</div>
      <div class="profile-vip-chip"><i class="fas fa-crown" style="margin-right:4px"></i>VIP 멤버</div>
    </div>

    <div class="profile-stats">
      <div class="profile-stat-item">
        <div style="font-size:22px;font-weight:800;color:var(--text)">${orderCount}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">총 주문</div>
      </div>
      <div style="width:1px;background:var(--border)"></div>
      <div class="profile-stat-item">
        <div style="font-size:17px;font-weight:800;color:var(--rose)">${totalSpent.toLocaleString()}원</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">총 이용금액</div>
      </div>
    </div>

    <div class="info-card">
      <div class="info-card-header">내 살롱</div>
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--light);border-radius:12px">
        <div style="width:46px;height:46px;background:var(--primary);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-scissors" style="color:var(--accent);font-size:18px"></i>
        </div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text)">${u.salon_name || '미등록'}</div>
          <div style="font-size:12px;color:var(--muted)">담당 · ${u.designer_name || '없음'}</div>
        </div>
      </div>
    </div>

    <div class="info-card">
      <div class="info-card-header">계정 정보</div>
      <div class="info-row"><span>이름</span><span>${u.name}</span></div>
      <div class="info-row"><span>전화번호</span><span>${u.phone || '-'}</span></div>
      <div class="info-row" style="border-bottom:none"><span>가입일</span><span>${new Date(u.created_at).toLocaleDateString('ko-KR')}</span></div>
    </div>

    <div style="padding:0 16px 100px">
      <button class="btn-secondary" style="margin-bottom:10px" onclick="navigate('scan')">
        <i class="fas fa-qrcode" style="margin-right:8px"></i>살롱 변경
      </button>
      <button onclick="handleLogout()" style="width:100%;background:none;border:1.5px solid #fee2e2;border-radius:14px;padding:14px;color:#dc2626;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:0.3px">
        <i class="fas fa-sign-out-alt" style="margin-right:8px"></i>로그아웃
      </button>
    </div>
  `;
}

function renderLoginPrompt() {
  return `<div style="text-align:center;padding:60px 24px">
    <div style="width:64px;height:64px;background:var(--light);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;border:1.5px solid var(--border)">
      <i class="fas fa-lock" style="font-size:24px;color:var(--muted)"></i>
    </div>
    <h3 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">로그인이 필요합니다</h3>
    <p style="font-size:13px;color:var(--muted);margin-bottom:20px">홈에서 간단히 가입하고 시작하세요</p>
    <button class="btn-primary" onclick="navigate('home')" style="width:auto;padding:12px 28px">
      <i class="fas fa-home"></i> 홈으로
    </button>
  </div>`;
}

function handleLogout() {
  state.user = null;
  state.orders = [];
  state.cart = [];
  sessionStorage.removeItem('salon_user');
  navigate('home');
  showToast('로그아웃되었습니다');
}

function attachListeners() { /* reserved for swipe gestures */ }

// ============================================================
// DATA LOADING
// ============================================================
async function loadAppData() {
  try {
    const [salonsRes, productsRes, bestRes] = await Promise.all([
      api('/api/salons'),
      api('/api/products'),
      api('/api/products?best=1')
    ]);
    if (salonsRes.success) state.salons = salonsRes.data;
    if (productsRes.success) state.products = productsRes.data;
    if (bestRes.success) state.bestProducts = bestRes.data;
    if (state.user) await loadUserOrders();
  } catch (e) {
    console.error('Load error:', e);
  }
}

async function loadUserOrders() {
  if (!state.user) return;
  const res = await api(`/api/orders?user_id=${state.user.id}`);
  if (res.success) state.orders = res.data;
}

// ============================================================
// INIT
// ============================================================
async function init() {
  loadUser();
  render();
  await initDB();
  await loadAppData();
  // 세션에 저장된 유저 데이터를 API에서 최신 정보로 갱신 (매장명 등 변경 반영)
  if (state.user?.id) {
    try {
      const res = await api(`/api/users/${state.user.id}`);
      if (res.success) saveUser(res.data.user);
    } catch (e) { /* 세션 데이터 유지 */ }
  }
  render();
}

async function initDB() {
  try {
    await api('/api/init-db', 'POST');
    await api('/api/seed-db', 'POST');
  } catch (e) { console.log('DB may already be initialized'); }
}

init();
