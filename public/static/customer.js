// ============================================================
// SALON VIP — Customer SPA (Mobile-First Premium)
// ============================================================

const API = '';
let state = {
  currentPage: window.__INITIAL_PAGE__ || 'home',
  user: null,
  salons: [],
  products: [],
  allProducts: [],
  brands: [],
  bestProducts: [],
  banners: [],
  categories: ['전체', '샴푸', '컨디셔너', '트리트먼트', '오일/세럼', '스프레이', '컬크림', '왁스/젤'],
  selectedCategory: '전체',
  cart: [],
  orders: [],
  storeOrders: [],
  storeSettlement: null,
  storeView: '',
  priceBrand: 0,
  salesStaff: '',
  scanResult: null,
  switchInfo: null,
  selectedSalon: null,
  selectedDesigner: null,
  salonCodeInput: '',
  onboardingStep: 'code', // code | designer
  loginStep: 'social', // social | account | profile
  pendingSocial: null, // { provider, auth_id, name?, phone? }
  phoneVerified: false,
  otpSent: false,
  adminTab: 'sales', // sales | manage
  manageDesigners: [],
  pendingStaffInvites: [],
  deepInviteId: null,
  deepInviteInfo: null,
  manageDraft: null, // { salon_id, salon_name, owner_name, owner_phone, address, address_detail }
  setupDraft: {
    salon_name: '',
    owner_name: '',
    owner_phone: '',
    address: '',
    address_detail: '',
    salon_code: '',
    designers: [{ designer_name: '', phone: '', requested: false }],
  },
  loading: false
};

const AUTH_STORE_KEY = 'salon_auth';
const DEVICE_ID_KEY = 'salon_device_id';

// ---- Session Storage for demo user ----
function loadUser() {
  const saved = sessionStorage.getItem('salon_user');
  if (saved) state.user = JSON.parse(saved);
}
function saveUser(u) {
  state.user = u;
  sessionStorage.setItem('salon_user', JSON.stringify(u));
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function authIdFor(provider) {
  return provider + '_' + getDeviceId();
}

function rememberAuth(provider, authId, remember) {
  localStorage.setItem(AUTH_STORE_KEY, JSON.stringify({
    provider,
    auth_id: authId,
    remember: !!remember,
  }));
}

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORE_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function clearSessionOnly() {
  state.user = null;
  state.orders = [];
  state.storeOrders = [];
  state.storeSettlement = null;
  state.storeView = '';
  state.adminTab = 'sales';
  state.manageDesigners = [];
  state.cart = [];
  state.pendingSocial = null;
  state.loginStep = 'social';
  resetOnboarding();
  resetSetupDraft();
  sessionStorage.removeItem('salon_user');
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
  state.storeView = '';
  render();
  window.scrollTo(0, 0);
}

function openStoreBrands() {
  state.storeView = 'brands';
  render();
  window.scrollTo(0, 0);
}

function openStorePrices() {
  state.storeView = 'prices';
  state.priceBrand = 0;
  render();
  window.scrollTo(0, 0);
}

// ---- Render Main ----
function render() {
  syncCartPrices();
  const app = document.getElementById('app');
  app.innerHTML = renderShell();
  attachListeners();
}

function renderShell() {
  // 매장명: 로그인 상태면 매장명, 없으면 브랜드명
  const salonName = state.user?.salon_name || null;
  const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);
  return `
    <header class="app-header">
      ${salonName
        ? `<div class="header-salon-name">${salonName}<span class="brand-dot"></span></div>`
        : `<div class="logo">SALON <span>VIP</span></div>`
      }
      <div class="header-right">
        ${canViewSales() ? `<button type="button" class="header-sales-btn" onclick="openAdmin()"><i class="fas fa-store"></i> 관리자</button>` : ''}
        ${state.user ? `<span class="header-user-chip">${state.user.name}님</span>` : ''}
        <i class="fas fa-bell header-icon"></i>
      </div>
    </header>
    <main class="page-content" id="page-content">
      ${renderPage()}
    </main>
    ${state.user && !['entry', 'admin-setup'].includes(state.currentPage) ? renderBottomNav(cartCount) : ''}
  `;
}

function ownerSalon() {
  if (!state.user || !state.user.is_owner) return null;
  const ownedId = Number(state.user.owned_salon_id);
  return state.salons.find((salon) => Number(salon.id) === ownedId) || null;
}

function salesSalon() {
  if (!state.user) return null;
  const owned = ownerSalon();
  if (owned) return owned;
  if (state.user.is_staff && state.user.staff_salon_id) {
    return state.salons.find((salon) => salon.id === state.user.staff_salon_id) || null;
  }
  return null;
}

function canViewSales() {
  return !!salesSalon();
}

function catalogSalonId() {
  if (!state.user) return '';
  return state.user.owned_salon_id || state.user.staff_salon_id || state.user.current_salon_id || '';
}

function needsSalonBinding() {
  if (!state.user || state.user.is_owner || state.user.is_staff) return false;
  return !state.user.current_salon_id || !state.user.mapped_designer_id;
}

function needsEntryGate() {
  if (!state.user) return false;
  if (state.user.is_owner || state.user.is_staff) return false;
  // 담당 해제·고객 미연결 등 무소속이면 입장 화면
  return needsSalonBinding();
}

function visibleStaffInvites() {
  const ownedId = state.user && state.user.owned_salon_id;
  return (state.pendingStaffInvites || []).filter((inv) => {
    // 원장은 본인 매장 초대를 승인하지 않음 — 담당자(초대 수신자)만
    if (ownedId && Number(inv.salon_id) === Number(ownedId)) return false;
    return true;
  });
}

function renderStaffInviteCards() {
  const invites = visibleStaffInvites();
  if (!invites.length) return '';
  return `
    <div class="code-card" style="margin-bottom:14px">
      <div class="section-label" style="margin-top:0">담당자 초대</div>
      <p style="font-size:13px;color:var(--muted);margin:0 0 10px">문자 링크를 받은 담당자가 승인합니다. 승인 시 이전 매장 담당 소속은 자동 해제됩니다.</p>
      ${invites.map((inv) => `
        <div class="manage-designer-row">
          <div>
            <div style="font-weight:700">${escText(inv.salon_name || '매장')}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">${escText((inv.designer_name || '').replace(' 디자이너', ''))} · 초대 대기</div>
          </div>
          <button type="button" class="btn-secondary" style="width:auto;padding:10px 14px;margin:0" onclick="acceptStaffInvite(${inv.id})">승인</button>
        </div>`).join('')}
    </div>`;
}

async function loadDeepInviteInfo(inviteId) {
  const id = Number(inviteId || state.deepInviteId || 0);
  if (!id) {
    state.deepInviteInfo = null;
    return null;
  }
  const res = await api('/api/designers/' + id + '/invite-info');
  state.deepInviteInfo = res.success ? res.data : null;
  return state.deepInviteInfo;
}

async function resumeDeepInviteIfNeeded() {
  if (!state.deepInviteId) return false;
  await loadDeepInviteInfo(state.deepInviteId);
  if (state.user) await loadPendingStaffInvites();
  state.currentPage = 'staff-invite';
  return true;
}

function clearDeepInviteFromUrl() {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has('invite')) return;
    url.searchParams.delete('invite');
    history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);
  } catch (e) { /* ignore */ }
}

function renderStaffInviteLanding() {
  const info = state.deepInviteInfo;
  if (!info) {
    return `
      <div class="scan-page">
        <div class="onboard-card">
          <div class="onboard-icon"><i class="fas fa-link"></i></div>
          <h2>초대를 찾을 수 없습니다</h2>
          <p>링크가 만료되었거나 잘못된 초대입니다.</p>
          <button class="btn-primary" onclick="navigate('home')">홈으로</button>
        </div>
      </div>`;
  }

  if (info.status === 'ACTIVE') {
    return `
      <div class="scan-page">
        <div class="onboard-card">
          <div class="onboard-icon"><i class="fas fa-check"></i></div>
          <h2>이미 승인된 초대</h2>
          <p>${escText(info.salon_name || '매장')} 담당자로 등록되어 있습니다.</p>
          <button class="btn-primary" onclick="navigate('home')">홈으로</button>
        </div>
      </div>`;
  }

  if (info.status !== 'INVITED') {
    return `
      <div class="scan-page">
        <div class="onboard-card">
          <div class="onboard-icon"><i class="fas fa-user-slash"></i></div>
          <h2>유효하지 않은 초대</h2>
          <p>이 초대는 더 이상 사용할 수 없습니다.</p>
          <button class="btn-primary" onclick="navigate('home')">홈으로</button>
        </div>
      </div>`;
  }

  if (!state.user) {
    if (state.loginStep === 'account' || state.loginStep === 'profile') {
      return renderLogin();
    }
    return `
      <div class="scan-page">
        <div class="onboard-card invite-landing-card">
          <div class="onboard-icon"><i class="fas fa-user-check"></i></div>
          <h2>담당자 초대</h2>
          <p><strong>${escText(info.salon_name || '매장')}</strong>에서<br>${escText((info.designer_name || '').replace(' 디자이너', '') || '담당자')}님을 초대했습니다.</p>
          <p class="entry-code-hint">초대받은 휴대폰(끝 ${escText(info.phone_hint || '****')})로 로그인·가입한 뒤 승인하세요.</p>
          <div class="social-login-stack" style="margin-top:12px">
            <button type="button" class="social-btn social-kakao" onclick="startSocialLogin('kakao')">
              <span class="social-ico">K</span>카카오로 시작하기
            </button>
            <button type="button" class="social-btn social-google" onclick="startSocialLogin('google')">
              <span class="social-ico">G</span>Google로 시작하기
            </button>
          </div>
        </div>
      </div>`;
  }

  const ownedOwnSalon = state.user.is_owner && Number(state.user.owned_salon_id) === Number(info.salon_id);
  if (ownedOwnSalon) {
    return `
      <div class="scan-page">
        <div class="onboard-card">
          <div class="onboard-icon"><i class="fas fa-store"></i></div>
          <h2>원장님 계정입니다</h2>
          <p>승인은 초대 문자를 받은 <strong>담당자</strong>가 합니다. 담당자 번호로 로그인한 뒤 링크를 다시 열어 주세요.</p>
          <button class="btn-primary" onclick="navigate('home')">홈으로</button>
          <button type="button" class="entry-logout-link" onclick="handleLogout()">다른 계정으로 로그인</button>
        </div>
      </div>`;
  }

  return `
    <div class="scan-page">
      <div class="onboard-card invite-landing-card">
        <div class="onboard-icon"><i class="fas fa-user-check"></i></div>
        <h2>담당자 초대 승인</h2>
        <p><strong>${escText(info.salon_name || '매장')}</strong> 담당자로 등록할까요?</p>
        <p class="entry-code-hint">승인하면 이전 매장 담당 소속은 자동 해제됩니다.</p>
        <button class="btn-primary" onclick="acceptStaffInvite(${info.id})">승인하고 담당자로 등록</button>
        <button type="button" class="entry-logout-link" onclick="navigate('home')">나중에</button>
      </div>
    </div>`;
}

function splitSalonAddress(salon) {
  if (!salon) return { base: '', detail: '' };
  if (salon.address_detail != null && String(salon.address_detail).length) {
    return { base: String(salon.address || ''), detail: String(salon.address_detail || '') };
  }
  return { base: String(salon.address || ''), detail: '' };
}

async function loadPendingStaffInvites() {
  if (!state.user) {
    state.pendingStaffInvites = [];
    return;
  }
  const res = await api('/api/users/' + state.user.id + '/staff-invites');
  state.pendingStaffInvites = res.success ? (res.data || []) : [];
}

async function acceptStaffInvite(designerId) {
  if (!state.user) {
    state.deepInviteId = Number(designerId);
    state.currentPage = 'staff-invite';
    render();
    showToast('먼저 로그인·가입해 주세요', 'error');
    return;
  }
  if (state.user.is_owner && Number(state.user.owned_salon_id)) {
    const info = state.deepInviteInfo;
    if (info && Number(info.salon_id) === Number(state.user.owned_salon_id)) {
      showToast('승인은 담당자가 합니다', 'error');
      return;
    }
  }
  const res = await api('/api/designers/' + designerId + '/accept', 'POST', { user_id: state.user.id });
  if (!res.success) {
    showToast(res.error || '승인에 실패했습니다', 'error');
    return;
  }
  if (res.data && res.data.user) saveUser(res.data.user);
  state.deepInviteId = null;
  state.deepInviteInfo = null;
  clearDeepInviteFromUrl();
  await loadAppData();
  await loadPendingStaffInvites();
  navigate('home');
  showToast(res.message || '담당자로 등록되었습니다', 'success');
}

function resetSetupDraft() {
  state.setupDraft = {
    salon_name: '',
    owner_name: state.user ? (state.user.name || '') : '',
    owner_phone: state.user ? (state.user.phone || '') : '',
    address: '',
    address_detail: '',
    salon_code: '',
    designers: [{ designer_name: '', phone: '', requested: false }],
  };
}

function openAdmin() {
  state.adminTab = ownerSalon() ? (state.adminTab || 'sales') : 'sales';
  navigate('store');
  if (canViewSales()) loadStoreLedger().then(() => render());
  if (ownerSalon()) loadManageDesigners().then(() => render());
}

function setAdminTab(tab) {
  state.adminTab = tab === 'manage' ? 'manage' : 'sales';
  render();
  if (state.adminTab === 'manage') loadManageDesigners().then(() => render());
  if (state.adminTab === 'sales') loadStoreLedger().then(() => render());
}

function renderBottomNav(cartCount) {
  const count = cartCount == null ? state.cart.reduce((s, i) => s + i.qty, 0) : cartCount;
  const tabs = [
    { id: 'home', icon: 'fa-home', label: '홈' },
    { id: 'category', icon: 'fa-th-large', label: '카테고리' },
    { id: 'search', icon: 'fa-search', label: '검색' },
    { id: 'profile', icon: 'fa-user', label: '마이' },
    { id: 'cart', icon: 'fa-shopping-bag', label: '장바구니', badge: count },
  ];
  return `<nav class="bottom-nav bottom-nav-5">${tabs.map(t => `
    <button class="nav-item ${state.currentPage === t.id ? 'active' : ''}" onclick="navigate('${t.id}')">
      <span class="nav-icon-wrap">
        <i class="fas ${t.icon}"></i>
        ${t.badge ? `<span class="nav-badge">${t.badge > 99 ? '99+' : t.badge}</span>` : ''}
      </span>
      <span>${t.label}</span>
    </button>`).join('')}</nav>`;
}

function renderPage() {
  switch(state.currentPage) {
    case 'home':         return renderHome();
    case 'category':     return renderCategory();
    case 'search':       return renderSearch();
    case 'cart':         return renderCartPage();
    case 'store':        return renderStore();
    case 'entry':        return renderEntryGate();
    case 'admin-setup':  return renderAdminSetup();
    case 'staff-invite': return renderStaffInviteLanding();
    case 'scan':         return renderScan();
    case 'shop':         return renderShop();
    case 'orders':       return renderOrders();
    case 'profile':      return renderProfile();
    default:             return renderHome();
  }
}

// ============================================================
// HOME PAGE
// ============================================================
function renderHome() {
  if (!state.user) return renderLogin();

  const u = state.user;
  const best = state.bestProducts.length > 0 ? state.bestProducts : state.products.slice(0, 6);
  const categories = ['샴푸', '컨디셔너', '트리트먼트', '오일/세럼', '스프레이', '컬크림', '왁스/젤'];
  const mainBanner = (state.banners || []).find((banner) => banner.banner_type === 'MAIN' && banner.status === 'ACTIVE' && banner.image_url);
  const bannerUrl = (mainBanner && mainBanner.image_url) || 'static/banner-sample.png';
  const needSalon = needsSalonBinding();

  return `
    <!-- ① 고객 인사 배너 (한 줄) -->
    <div class="home-greeting-bar">
      <div class="home-greeting-text">
        <span class="greeting-name">${u.name}님,</span>
        <span class="greeting-sub"> 오늘도 좋은 하루 되세요</span>
      </div>
      <div class="greeting-vip-chip"><i class="fas fa-crown"></i> VIP</div>
    </div>

    ${needSalon ? `
    <div class="home-salon-cta" onclick="navigate('entry')">
      <div>
        <div class="home-salon-cta-title">매장 코드를 등록해 주세요</div>
        <div class="home-salon-cta-sub">담당자 연결 후 VIP 쇼핑·적립이 시작됩니다</div>
      </div>
      <span class="home-salon-cta-btn">등록</span>
    </div>` : ''}

    ${!state.user.is_owner ? `<div style="padding:0 16px">${renderStaffInviteCards()}</div>` : ''}

    <div class="home-search-wrap">
      <form class="search-box home-search-box" onsubmit="event.preventDefault(); goHomeSearch();">
        <i class="fas fa-search"></i>
        <input id="home-search" class="search-input" type="search" enterkeyhint="search"
          placeholder="제품명, 브랜드 검색"
          value="${escText(state.searchQuery || '')}"
          oninput="state.searchQuery=this.value">
      </form>
    </div>

    <div class="home-banner">
      <img src="${bannerUrl}" alt="${(mainBanner && mainBanner.title) || '메인 배너'}">
    </div>

    <div class="home-category-grid">
      ${categories.map((name) => `
        <button class="home-cat-item" onclick="goShopCategory('${name}')">${name}</button>`).join('')}
    </div>

    <!-- ④ BEST 제품 -->
    <div class="section-header" style="margin-top:4px">
      <span class="section-title">
        <span style="background:var(--rose);color:white;font-size:9px;font-weight:800;padding:3px 7px;border-radius:5px;letter-spacing:1px;margin-right:6px">BEST</span>
        베스트 제품
      </span>
      <span class="see-all" onclick="navigate('category')">전체보기 →</span>
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

function goHomeSearch() {
  const input = document.getElementById('home-search');
  if (input) state.searchQuery = input.value || '';
  navigate('search');
}

// 홈 카테고리 클릭 → 쇼핑 페이지로 이동 + 카테고리 필터
function goShopCategory(cat) {
  state.selectedCategory = cat;
  navigate('shop');
}

function renderCategory() {
  if (!state.user) return renderLoginPrompt();
  const categories = ['전체', '샴푸', '컨디셔너', '트리트먼트', '오일/세럼', '스프레이', '컬크림', '왁스/젤'];
  return `
    <div class="page-pad">
      <h2 class="page-title">카테고리</h2>
      <p class="page-sub">원하는 제품군을 선택하세요</p>
      <div class="category-menu-list">
        ${categories.map((name) => `
          <button type="button" class="category-menu-row" onclick="goShopCategory('${name}')">
            <span>${name}</span>
            <i class="fas fa-chevron-right"></i>
          </button>`).join('')}
      </div>
    </div>
  `;
}

function renderSearch() {
  if (!state.user) return renderLoginPrompt();
  const q = (state.searchQuery || '').trim().toLowerCase();
  const list = !q
    ? []
    : state.products.filter((p) =>
        String(p.name || '').toLowerCase().includes(q)
        || String(p.category || '').toLowerCase().includes(q)
        || String(p.brand_name || '').toLowerCase().includes(q));
  return `
    <div class="page-pad">
      <h2 class="page-title">검색</h2>
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input id="product-search" class="search-input" type="search" placeholder="제품명, 카테고리 검색"
          value="${state.searchQuery || ''}"
          oninput="state.searchQuery=this.value; render()">
      </div>
      ${!q
        ? `<p class="page-sub" style="margin-top:20px">검색어를 입력해 주세요</p>`
        : list.length === 0
          ? `<p class="page-sub" style="margin-top:20px">검색 결과가 없습니다</p>`
          : `<div class="search-result-list">${list.map((p) => renderProductCard(p)).join('')}</div>`}
    </div>
  `;
}

function renderCartPage() {
  if (!state.user) return renderLoginPrompt();
  if (needsSalonBinding()) {
    return `
      <div class="page-pad" style="padding-top:40px;text-align:center">
        <i class="fas fa-store" style="font-size:28px;color:var(--muted);opacity:0.4"></i>
        <h3 style="margin:14px 0 6px;font-size:16px;font-weight:800">매장 등록이 필요해요</h3>
        <p style="font-size:13px;color:var(--muted);margin-bottom:16px">장바구니·결제는 매장 코드 등록 후 이용할 수 있습니다</p>
        <button class="btn-primary" style="width:auto;padding:12px 24px" onclick="navigate('entry')">살롱 VIP 입장하기</button>
      </div>`;
  }
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const salonAmt = Math.round(total * 0.3);
  const ownerProfit = cartStoreProfit();
  if (state.cart.length === 0) {
    return `
      <div class="page-pad" style="padding-top:48px;text-align:center">
        <i class="fas fa-shopping-bag" style="font-size:32px;color:var(--muted);opacity:0.3"></i>
        <h3 style="margin:14px 0 6px;font-size:16px;font-weight:800">장바구니가 비어 있어요</h3>
        <button class="btn-primary" style="width:auto;padding:12px 24px;margin-top:12px" onclick="navigate('category')">상품 보러가기</button>
      </div>`;
  }
  return `
    <div class="page-pad" style="padding-bottom:120px">
      <h2 class="page-title">장바구니</h2>
      <div class="cart-salon-info" style="margin:12px 0 16px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:3px">담당 살롱 · 디자이너</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">
          ${state.user.salon_name || '미등록'} · ${state.user.designer_name || '담당 없음'}
        </div>
      </div>
      ${state.cart.map((i) => `
        <div class="cart-line">
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--text)">${i.name}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px">
              <button type="button" class="qty-btn" onclick="updateCartQty(${i.product_id},-1)">−</button>
              <span style="margin:0 8px">${i.qty}</span>
              <button type="button" class="qty-btn" onclick="updateCartQty(${i.product_id},1)">+</button>
              · ${i.price.toLocaleString()}원
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:700;color:var(--rose)">${(i.price * i.qty).toLocaleString()}원</div>
            <button type="button" class="demo-link" style="margin-top:4px" onclick="removeFromCart(${i.product_id});render()">삭제</button>
          </div>
        </div>`).join('')}
      <div class="cart-total-row">
        <span>합계</span>
        <span class="cart-total-val">${total.toLocaleString()}원</span>
      </div>
      ${state.user && (state.user.is_owner || state.user.is_staff) ? `<div class="rev-breakdown">
        <div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:8px">매장 수익</div>
        <div style="font-size:16px;font-weight:700;color:var(--text)">${won(ownerProfit)}</div>
      </div>` : `<div class="rev-breakdown">
        <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:8px">수익 배분</div>
        <div class="rev-grid">
          <div class="rev-item"><div style="font-size:10px;color:var(--muted)">플랫폼</div><div style="font-size:13px;font-weight:700">${Math.round(total * 0.4).toLocaleString()}원</div></div>
          <div class="rev-item"><div style="font-size:10px;color:var(--muted)">매장</div><div style="font-size:13px;font-weight:700">${salonAmt.toLocaleString()}원</div></div>
        </div>
      </div>`}
      <button class="btn-primary" style="margin-top:8px" onclick="placeOrder()">
        <i class="fas fa-credit-card"></i> 결제하기 ${total.toLocaleString()}원
      </button>
    </div>
  `;
}

function renderBestCard(p) {
  const price = sellingPrice(p);
  const disc = Math.round((1 - price / p.original_price) * 100);
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
        <div class="best-vip">${price.toLocaleString()}<span style="font-size:11px;font-weight:500">원</span></div>
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
// LOGIN PAGE — social signup → (profile if new) → salon code
// ============================================================
function providerLabel(provider) {
  return ({ kakao: '카카오', google: '구글', naver: '네이버', apple: '애플' })[provider] || provider;
}

function providerAccounts(provider) {
  // 실제 OAuth 연동 전: 계정 선택 UI 데모. 실서비스에서는 카카오/구글 계정 선택창이 뜹니다.
  const device = getDeviceId().slice(-4);
  const map = {
    kakao: [
      { slot: '1', name: '김민수', handle: 'minsu@kakao.com' },
      { slot: '2', name: '이서연', handle: 'seoyeon@kakao.com' },
    ],
    google: [
      { slot: '1', name: '박지훈', handle: 'jihoon@gmail.com' },
      { slot: '2', name: '최유진', handle: 'yujin@gmail.com' },
    ],
    naver: [
      { slot: '1', name: '정하늘', handle: 'haneul@naver.com' },
      { slot: '2', name: '한소희', handle: 'sohee@naver.com' },
    ],
    apple: [
      { slot: '1', name: '오세진', handle: 'sejin_' + device + '@privaterelay.appleid.com' },
    ],
  };
  return map[provider] || [];
}

function authIdForAccount(provider, slot) {
  return provider + '_' + getDeviceId() + '_acct' + slot;
}

function renderLogin() {
  if (state.loginStep === 'account' && state.pendingSocial) {
    return renderSocialAccountPicker();
  }
  if (state.loginStep === 'profile' && state.pendingSocial) {
    return renderSocialProfile();
  }
  return `
    <div class="login-wrap">
      <div class="login-hero">
        <div class="login-logo">
          <i class="fas fa-scissors" style="font-size:28px;color:var(--accent)"></i>
        </div>
        <h1 style="font-size:26px;font-weight:900;letter-spacing:2px;margin:14px 0 4px;color:var(--text)">SALON VIP</h1>
        <p style="font-size:13px;color:var(--muted);letter-spacing:0.3px">프리미엄 살롱 VIP 멤버십</p>
      </div>

      <div class="login-body">
        <h2 class="login-title">시작하기</h2>
        <p class="login-sub">소셜 계정으로 가입하면, 매장 코드 등록 후 VIP 쇼핑이 연결됩니다.</p>

        <div class="social-login-stack">
          <button type="button" class="social-btn social-kakao" onclick="startSocialLogin('kakao')">
            <span class="social-ico">K</span>카카오로 시작하기
          </button>
          <button type="button" class="social-btn social-google" onclick="startSocialLogin('google')">
            <span class="social-ico">G</span>Google로 시작하기
          </button>
          <button type="button" class="social-btn social-naver" onclick="startSocialLogin('naver')">
            <span class="social-ico">N</span>네이버로 시작하기
          </button>
          <button type="button" class="social-btn social-apple" onclick="startSocialLogin('apple')">
            <span class="social-ico"><i class="fab fa-apple"></i></span>Apple로 시작하기
          </button>
        </div>

        <p class="login-flow-hint">기존 회원: 계정 선택만 · 신규: 이름·휴대폰·배송주소 후 입장</p>

        <div style="text-align:center;margin-top:18px">
          <button onclick="loginAsDemo()" class="demo-link" style="display:inline">데모 계정</button>
          <span style="color:#ccc;margin:0 8px">·</span>
          <button onclick="loginAsOwner()" class="demo-link" style="display:inline">원장</button>
          <span style="color:#ccc;margin:0 8px">·</span>
          <button onclick="loginAsStaff()" class="demo-link" style="display:inline">담당자</button>
        </div>
      </div>
    </div>
  `;
}

function goBackToSocialLogin() {
  state.loginStep = 'social';
  state.pendingSocial = null;
  render();
  if (history.state && (history.state.salonLoginStep === 'profile' || history.state.salonLoginStep === 'account')) {
    history.replaceState({}, '', location.pathname + location.search);
  }
}

function goBackToAccountPicker() {
  if (!state.pendingSocial) { goBackToSocialLogin(); return; }
  state.loginStep = 'account';
  render();
}

function renderSocialAccountPicker() {
  const p = state.pendingSocial;
  const accounts = providerAccounts(p.provider);
  const label = providerLabel(p.provider);
  return `
    <div class="login-wrap">
      <div class="login-hero" style="padding:28px 28px 16px">
        <button type="button" class="login-back-btn" onclick="goBackToSocialLogin()">
          <i class="fas fa-chevron-left"></i> 뒤로
        </button>
        <h1 style="font-size:22px;font-weight:900;color:#fff;margin:12px 0 0">${label} 계정 선택</h1>
        <p style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:8px">계속할 ${label} 계정을 선택하세요</p>
      </div>
      <div class="login-body">
        <div class="account-pick-list">
          ${accounts.map((a) => `
            <button type="button" class="account-pick-row" onclick="selectSocialAccount('${p.provider}','${a.slot}','${a.name.replace(/'/g, '')}')">
              <div class="account-pick-avatar">${a.name.slice(0, 1)}</div>
              <div class="account-pick-meta">
                <div class="account-pick-name">${a.name}</div>
                <div class="account-pick-handle">${a.handle}</div>
              </div>
              <i class="fas fa-chevron-right" style="color:#ccc;font-size:12px"></i>
            </button>
          `).join('')}
        </div>
        <button type="button" class="account-pick-other" onclick="useAnotherSocialAccount('${p.provider}')">
          다른 ${label} 계정 사용
        </button>
        <p class="login-flow-hint" style="margin-top:14px">데모용 계정 선택 화면입니다. 실서비스에서는 ${label} 로그인 창이 열립니다.</p>
      </div>
    </div>
  `;
}

function renderSocialProfile() {
  const p = state.pendingSocial || {};
  const suggested = p.suggested_name || '';
  return `
    <div class="login-wrap">
      <div class="login-hero" style="padding:28px 28px 16px">
        <button type="button" class="login-back-btn" onclick="goBackToAccountPicker()">
          <i class="fas fa-chevron-left"></i> 계정 선택으로
        </button>
        <h1 style="font-size:22px;font-weight:900;color:#fff;margin:12px 0 0">회원 정보</h1>
        <p style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:8px">${providerLabel(p.provider)} 신규 가입 · 문자 인증 후 배송에 사용됩니다</p>
      </div>
      <div class="login-body">
        <div class="form-field">
          <label class="form-label">이름</label>
          <input id="login-name" class="form-input" type="text" value="${escText(suggested)}" placeholder="이름을 입력하세요">
        </div>
        <div class="form-field">
          <label class="form-label">휴대폰번호</label>
          <div class="otp-row">
            <input id="login-phone" class="form-input" type="tel" placeholder="010-0000-0000"
              oninput="state.phoneVerified=false; state.otpSent=false">
            <button type="button" class="btn-secondary otp-send-btn" onclick="sendSignupOtp()">인증요청</button>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">인증번호</label>
          <div class="otp-row">
            <input id="login-otp" class="form-input" type="tel" inputmode="numeric" maxlength="4" placeholder="4자리">
            <button type="button" class="btn-secondary otp-send-btn" onclick="verifySignupOtp()">확인</button>
          </div>
          <p id="otp-hint" class="code-hint">${state.phoneVerified ? '휴대폰 인증 완료' : (state.otpSent ? '인증번호를 입력하세요' : '인증요청 후 문자를 확인하세요')}</p>
        </div>
        <div class="form-field">
          <label class="form-label">배송주소</label>
          <div class="address-search-row">
            <input id="login-address" class="form-input" type="text" readonly
              placeholder="주소 검색을 눌러주세요" onclick="openAddressSearch('login-address','login-address-detail')">
            <button type="button" class="btn-secondary address-search-btn" onclick="openAddressSearch('login-address','login-address-detail')">주소 검색</button>
          </div>
          <input id="login-address-detail" class="form-input" type="text" style="margin-top:8px"
            placeholder="상세주소 (동·호수 등)">
        </div>
        <button class="btn-primary" style="margin-top:8px" onclick="submitSocialProfile()">
          <i class="fas fa-arrow-right"></i> 가입하고 입장하기
        </button>
        <button type="button" class="demo-link" onclick="goBackToAccountPicker()">다른 계정으로</button>
      </div>
    </div>
  `;
}

function joinAddress(base, detail) {
  const a = String(base || '').trim();
  const b = String(detail || '').trim();
  if (!a) return '';
  return b ? a + ' ' + b : a;
}

function openAddressSearch(baseInputId, detailInputId) {
  if (!(window.daum && window.daum.Postcode)) {
    showToast('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요', 'error');
    return;
  }
  new daum.Postcode({
    oncomplete(data) {
      const road = data.roadAddress || '';
      const jibun = data.jibunAddress || '';
      let addr = data.userSelectedType === 'R' ? road : jibun;
      if (!addr) addr = road || jibun;
      let extra = '';
      if (data.bname && /[동|로|가]$/g.test(data.bname)) extra += data.bname;
      if (data.buildingName && data.apartment === 'Y') {
        extra += (extra ? ', ' : '') + data.buildingName;
      }
      const base = (data.zonecode ? '(' + data.zonecode + ') ' : '') + addr + (extra ? ' (' + extra + ')' : '');
      const baseEl = document.getElementById(baseInputId);
      if (baseEl) {
        baseEl.value = base;
        baseEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (typeof detailInputId === 'function') {
        detailInputId(base);
      } else if (baseInputId === 'setup-address') {
        updateSetupField('address', base);
      } else if (baseInputId === 'manage-address') {
        updateManageField('address', base);
      }
      const detailEl = detailInputId && typeof detailInputId === 'string'
        ? document.getElementById(detailInputId)
        : null;
      if (detailEl) {
        // 도로명 선택 후에도 상세주소(동·호수)는 유지
        detailEl.focus();
      }
      showToast('주소를 선택했습니다. 상세주소(예: 301호)를 입력하세요', 'success');
    },
  }).open();
}

async function sendSignupOtp() {
  const phone = ((document.getElementById('login-phone') || {}).value || '').trim();
  if (!phone) { showToast('휴대폰번호를 입력해주세요', 'error'); return; }
  const res = await api('/api/auth/otp/send', 'POST', { phone });
  if (!res.success) {
    showToast(res.error || '인증번호 발송 실패', 'error');
    return;
  }
  state.otpSent = true;
  state.phoneVerified = false;
  const hint = document.getElementById('otp-hint');
  if (hint) hint.textContent = res.demo_code ? `데모 인증번호: ${res.demo_code}` : '인증번호를 입력하세요';
  showToast(res.demo_code ? `데모 인증번호 ${res.demo_code}` : (res.message || '인증번호를 발송했습니다'), 'success');
}

async function verifySignupOtp() {
  const phone = ((document.getElementById('login-phone') || {}).value || '').trim();
  const code = ((document.getElementById('login-otp') || {}).value || '').trim();
  if (!phone || !code) { showToast('휴대폰번호와 인증번호를 입력하세요', 'error'); return; }
  const res = await api('/api/auth/otp/verify', 'POST', { phone, code });
  if (!res.success) {
    state.phoneVerified = false;
    showToast(res.error || '인증 실패', 'error');
    return;
  }
  state.phoneVerified = true;
  const hint = document.getElementById('otp-hint');
  if (hint) hint.textContent = '휴대폰 인증 완료';
  showToast(res.message || '휴대폰 인증이 완료되었습니다', 'success');
}

function startSocialLogin(provider) {
  state.pendingSocial = { provider };
  state.loginStep = 'account';
  history.pushState({ salonLoginStep: 'account' }, '', location.href);
  render();
}

async function selectSocialAccount(provider, slot, name) {
  const authId = authIdForAccount(provider, slot);
  // 이름 없이 조회: 기존 회원이면 바로 입장, 신규면 프로필 입력
  const res = await api('/api/auth/social', 'POST', {
    provider,
    auth_id: authId,
  });
  if (res.needs_profile) {
    state.pendingSocial = { provider, auth_id: authId, suggested_name: name || '' };
    state.phoneVerified = false;
    state.otpSent = false;
    state.loginStep = 'profile';
    history.pushState({ salonLoginStep: 'profile' }, '', location.href);
    render();
    return;
  }
  if (!res.success || !res.data) {
    showToast(res.error || '로그인에 실패했습니다', 'error');
    return;
  }
  await finishSocialAuth(res, provider, authId);
}

function useAnotherSocialAccount(provider) {
  const authId = authIdForAccount(provider, 'new_' + Date.now().toString(36));
  state.pendingSocial = { provider, auth_id: authId, suggested_name: '' };
  state.phoneVerified = false;
  state.otpSent = false;
  state.loginStep = 'profile';
  history.pushState({ salonLoginStep: 'profile' }, '', location.href);
  render();
}

async function submitSocialProfile() {
  const name = (document.getElementById('login-name') || {}).value.trim();
  const phone = (document.getElementById('login-phone') || {}).value.trim();
  const shippingBase = (document.getElementById('login-address') || {}).value.trim();
  const shippingDetail = (document.getElementById('login-address-detail') || {}).value.trim();
  const shippingAddress = joinAddress(shippingBase, shippingDetail);
  if (!name) { showToast('이름을 입력해주세요', 'error'); return; }
  if (!phone) { showToast('휴대폰번호를 입력해주세요', 'error'); return; }
  if (!state.phoneVerified) { showToast('휴대폰 문자 인증을 완료해주세요', 'error'); return; }
  if (!shippingBase) { showToast('주소 검색으로 배송주소를 선택해주세요', 'error'); return; }
  if (!state.pendingSocial || !state.pendingSocial.auth_id) {
    state.loginStep = 'account';
    render();
    return;
  }
  const { provider, auth_id } = state.pendingSocial;
  const res = await api('/api/auth/social', 'POST', {
    provider,
    auth_id,
    name,
    phone,
    shipping_address: shippingAddress,
  });
  if (!res.success || !res.data) {
    showToast(res.error || '가입에 실패했습니다', 'error');
    return;
  }
  state.phoneVerified = false;
  state.otpSent = false;
  await finishSocialAuth(res, provider, auth_id);
  if (res.staff_invites_accepted) {
    showToast('담당자 초대가 수락되었습니다', 'success');
  }
}

async function finishSocialAuth(res, provider, authId) {
  rememberAuth(provider, authId, true);
  saveUser(res.data);
  state.pendingSocial = null;
  state.loginStep = 'social';
  await loadAppData();
  if (await resumeDeepInviteIfNeeded()) {
    render();
    showToast('초대를 확인하고 승인해 주세요', 'success');
    return;
  }
  if (needsEntryGate()) {
    navigate('entry');
    showToast('환영합니다! 입장 방법을 선택해 주세요', 'success');
    return;
  }
  navigate('home');
  const salonLabel = res.data.salon_name ? res.data.salon_name + '으로 ' : '';
  showToast(salonLabel + '로그인되었습니다', 'success');
}

async function tryAutoLogin() {
  if (state.user) return true;
  const auth = readAuth();
  if (!auth || !auth.remember || !auth.auth_id || !auth.provider) return false;
  const res = await api('/api/auth/social', 'POST', {
    provider: auth.provider,
    auth_id: auth.auth_id,
  });
  if (res.needs_profile || !res.success || !res.data) return false;
  saveUser(res.data);
  await loadAppData();
  return true;
}

function resetOnboarding() {
  state.salonCodeInput = '';
  state.selectedSalon = null;
  state.selectedDesigner = null;
  state.onboardingStep = 'code';
  state.switchInfo = null;
}

function renderOnboardingGate() {
  return renderEntryGate();
}

function renderEntryGate() {
  if (!state.user) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;
  if (!needsEntryGate()) {
    return `
      <div class="scan-page">
        <div class="onboard-card">
          <div class="onboard-icon"><i class="fas fa-check"></i></div>
          <h2>이미 입장 완료</h2>
          <p>등록된 매장으로 바로 이동합니다.</p>
          <button class="btn-primary" onclick="navigate('home')">홈으로</button>
        </div>
      </div>`;
  }
  const unaffiliated = !state.user.is_owner && !state.user.is_staff && needsSalonBinding();
  const hasInvites = visibleStaffInvites().length > 0;
  return `
    <div class="scan-page entry-page">
      ${renderStaffInviteCards()}
      <div class="onboard-card entry-card">
        <div class="onboard-icon"><i class="fas fa-door-open"></i></div>
        <h2>${unaffiliated ? '소속이 없습니다' : '살롱 VIP 입장하기'}</h2>
        <p>${unaffiliated
          ? '아래 셋 중 하나로 이어가면 됩니다.'
          : '고객은 매장 코드로 입장하고, 원장님은 관리자로 매장을 개설할 수 있어요.'}</p>
        ${unaffiliated ? `
        <ul class="entry-path-list">
          <li><strong>1. 담당자 초대 승인</strong> — 위에서 초대를 승인하면 그 매장 담당자로 등록${hasInvites ? '' : ' (대기 중인 초대가 있으면 표시됩니다)'}</li>
          <li><strong>2. 관리자(원장) 매장 개설</strong> — 내 매장을 새로 만듭니다</li>
          <li><strong>3. 다른 매장 일반 고객</strong> — 방문·QR로 받은 6자리 코드가 있을 때만 가능</li>
        </ul>` : ''}
        <button class="btn-primary" onclick="navigate('scan')">
          <i class="fas fa-key"></i> 다른 매장 일반 고객으로 입장
        </button>
        <p class="entry-code-hint">매장 코드가 없으면 고객 입장이 되지 않습니다.</p>
        <button type="button" class="entry-admin-link" onclick="openAdminSetup()">관리자(원장) · 매장 개설</button>
        <button type="button" class="entry-logout-link" onclick="handleLogout()">로그아웃</button>
      </div>
    </div>
  `;
}

function openAdminSetup() {
  resetSetupDraft();
  if (state.user) {
    state.setupDraft.owner_name = state.user.name || '';
    state.setupDraft.owner_phone = state.user.phone || '';
  }
  navigate('admin-setup');
}

function updateSetupField(key, value) {
  state.setupDraft[key] = value;
}

function updateSetupDesigner(index, key, value) {
  if (!state.setupDraft.designers[index]) return;
  state.setupDraft.designers[index][key] = value;
}

function addSetupDesignerRow() {
  state.setupDraft.designers.push({ designer_name: '', phone: '', requested: false });
  render();
}

function removeSetupDesignerRow(index) {
  if (state.setupDraft.designers.length <= 1) {
    state.setupDraft.designers = [{ designer_name: '', phone: '', requested: false }];
  } else {
    state.setupDraft.designers.splice(index, 1);
  }
  render();
}

function requestSetupDesigner(index) {
  const row = state.setupDraft.designers[index];
  if (!row) return;
  const name = String(row.designer_name || '').trim();
  const phone = String(row.phone || '').trim();
  if (!name) { showToast('담당자 이름을 입력하세요', 'error'); return; }
  if (!phone) { showToast('담당자 휴대폰번호를 입력하세요', 'error'); return; }
  row.requested = true;
  render();
  showToast(`${name}님에게 초대 요청이 예약되었습니다. 매장 생성 시 문자가 발송됩니다`, 'success');
}

function renderAdminSetup() {
  if (!state.user) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;
  if (state.user.is_owner) {
    return `
      <div class="scan-page">
        <div class="onboard-card">
          <h2>이미 매장이 있습니다</h2>
          <p>관리자 화면에서 매장 정보를 수정하세요.</p>
          <button class="btn-primary" onclick="openAdmin()">관리자로 이동</button>
        </div>
      </div>`;
  }
  const d = state.setupDraft;
  return `
    <div class="scan-page admin-setup-page">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <button class="store-back" style="margin:0" onclick="navigate('entry')"><i class="fas fa-chevron-left" style="margin-right:6px"></i>입장</button>
        <button type="button" class="entry-logout-link" style="margin:0;width:auto" onclick="handleLogout()">로그아웃</button>
      </div>
      <h2 style="font-size:20px;font-weight:800;margin-bottom:4px">매장 세팅</h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px">필수 정보를 입력하고 저장하면 매장이 생성됩니다.</p>
      <div class="code-card setup-form">
        <label class="form-label">매장명</label>
        <input class="form-input" value="${escText(d.salon_name)}" placeholder="예: 프로헤어 강남점"
          oninput="updateSetupField('salon_name', this.value)">
        <label class="form-label">대표자</label>
        <input class="form-input" value="${escText(d.owner_name)}" placeholder="대표자 이름"
          oninput="updateSetupField('owner_name', this.value)">
        <label class="form-label">휴대폰번호</label>
        <input class="form-input" type="tel" value="${escText(d.owner_phone)}" placeholder="010-0000-0000"
          oninput="updateSetupField('owner_phone', this.value)">
        <label class="form-label">주소</label>
        <div class="address-search-row">
          <input id="setup-address" class="form-input" value="${escText(d.address)}" readonly
            placeholder="주소 검색을 눌러주세요"
            onclick="openAddressSearch('setup-address','setup-address-detail')">
          <button type="button" class="btn-secondary address-search-btn" onclick="openAddressSearch('setup-address','setup-address-detail')">주소 검색</button>
        </div>
        <input id="setup-address-detail" class="form-input" type="text" style="margin-top:8px"
          value="${escText(d.address_detail || '')}"
          placeholder="상세주소 (동·호수 등)"
          oninput="updateSetupField('address_detail', this.value)">
        <label class="form-label">매장코드 6자리</label>
        <input class="form-input code-input" type="tel" inputmode="numeric" maxlength="6"
          value="${escText(d.salon_code)}" placeholder="예: 100001"
          oninput="updateSetupField('salon_code', this.value.replace(/\\D/g,'').slice(0,6)); this.value=state.setupDraft.salon_code">
        <div class="setup-designer-block">
          <div class="setup-designer-head">
            <label class="form-label" style="margin:0">담당자 초대</label>
            <button type="button" class="ghost-text-btn" onclick="addSetupDesignerRow()">+ 추가</button>
          </div>
          <p style="font-size:12px;color:var(--muted);margin:0 0 10px">이름·휴대폰 입력 후 <strong>요청</strong>을 누르세요. 매장 생성 시 초대 문자가 갑니다.</p>
          ${d.designers.map((row, i) => `
            <div class="setup-designer-row ${row.requested ? 'requested' : ''}">
              <input class="form-input" placeholder="담당자 이름" value="${escText(row.designer_name)}"
                oninput="updateSetupDesigner(${i}, 'designer_name', this.value); state.setupDraft.designers[${i}].requested=false">
              <input class="form-input" type="tel" placeholder="휴대폰번호" value="${escText(row.phone || '')}"
                oninput="updateSetupDesigner(${i}, 'phone', this.value); state.setupDraft.designers[${i}].requested=false">
              <button type="button" class="setup-request-btn ${row.requested ? 'on' : ''}" onclick="requestSetupDesigner(${i})">
                ${row.requested ? '요청됨' : '요청'}
              </button>
              <button type="button" class="setup-remove" onclick="removeSetupDesignerRow(${i})" aria-label="삭제"><i class="fas fa-times"></i></button>
            </div>`).join('')}
        </div>
        <button class="btn-primary" style="margin-top:16px" onclick="submitSalonSetup()">
          <i class="fas fa-check"></i> 저장하고 매장 생성
        </button>
      </div>
    </div>
  `;
}

async function submitSalonSetup() {
  if (!state.user) return;
  const d = state.setupDraft;
  if (!d.salon_name || !d.owner_name || !d.owner_phone) {
    showToast('매장명, 대표자, 휴대폰번호를 입력하세요', 'error');
    return;
  }
  const setupBase = (document.getElementById('setup-address') || {}).value.trim() || String(d.address || '').trim();
  const setupDetail = (document.getElementById('setup-address-detail') || {}).value.trim() || String(d.address_detail || '').trim();
  if (!setupBase) {
    showToast('주소 검색으로 매장 주소를 선택해주세요', 'error');
    return;
  }
  d.address = setupBase;
  d.address_detail = setupDetail;
  if (!/^\d{6}$/.test(String(d.salon_code || '').trim())) {
    showToast('매장 코드는 6자리 숫자입니다', 'error');
    return;
  }
  const pendingInvite = (d.designers || []).filter((row) =>
    String(row.designer_name || '').trim() && String(row.phone || '').trim() && !row.requested);
  if (pendingInvite.length) {
    showToast('담당자 이름·번호를 넣었다면 각 줄의 요청 버튼을 눌러주세요', 'error');
    return;
  }
  const designers = (d.designers || [])
    .filter((row) => row.requested && row.designer_name && String(row.designer_name).trim() && row.phone)
    .map((row) => ({ designer_name: String(row.designer_name).trim(), phone: String(row.phone || '').trim() }));
  const res = await api('/api/salons/setup', 'POST', {
    user_id: state.user.id,
    salon_name: d.salon_name.trim(),
    owner_name: d.owner_name.trim(),
    owner_phone: d.owner_phone.trim(),
    address: setupBase,
    address_detail: setupDetail,
    salon_code: String(d.salon_code).trim(),
    designers,
  });
  if (!res.success) {
    showToast(res.error || '매장 생성에 실패했습니다', 'error');
    return;
  }
  if (res.data && res.data.user) saveUser(res.data.user);
  if (res.data && res.data.salon) rememberSalon(res.data.salon);
  await loadAppData();
  state.adminTab = 'manage';
  navigate('store');
  await loadManageDesigners();
  await loadStoreLedger();
  render();
  const inviteMsg = designers.length
    ? ` · 담당자 ${designers.length}명에게 초대 요청 발송`
    : '';
  showToast((res.message || '매장이 개설되었습니다') + inviteMsg, 'success');
}

async function loginAsOwner() {
  const res = await api('/api/users', 'POST', {
    kakao_id: 'owner-salon-1',
    name: '김지수',
    phone: '010-1234-5678',
  });
  if (res.success) {
    saveUser(res.data);
    await loadAppData();
    navigate('home');
    showToast('프로헤어 강남점 원장 · 헤더 관리자 버튼을 확인하세요', 'success');
  }
}

async function loginAsStaff() {
  const res = await api('/api/auth/social', 'POST', {
    provider: 'kakao',
    auth_id: 'designer-1',
    name: '한예슬',
    phone: '010-2222-3333',
  });
  if (res.success && res.data) {
    saveUser(res.data);
    await loadAppData();
    navigate('home');
    showToast('담당자 로그인 · 헤더 관리자 버튼을 확인하세요', 'success');
  } else {
    showToast(res.error || '담당자 로그인 실패', 'error');
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
// SALON CODE + DESIGNER ONBOARDING
// ============================================================
function renderScan() {
  if (!state.user) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;

  // 이미 매장이 있으면 변경·다중 선택 불가. 담당자만 같은 매장 안에서 수정 가능.
  if (state.user.current_salon_id && !state.selectedSalon) {
    if (!needsSalonBinding()) return renderBoundSalonPage();
    startDesignerChange();
    return `<div class="scan-page"><p style="font-size:13px;color:var(--muted)">담당자 선택을 준비하는 중…</p></div>`;
  }

  const salon = state.selectedSalon;
  const designers = (salon && salon.designers) || [];
  const activeDesigners = designers.filter((d) => d.status !== 'RESIGNED');
  const step = salon ? 'designer' : 'code';

  return `
    <div class="scan-page">
      <h2 style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:4px">
        매장 · 담당자 등록
      </h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:18px">
        매장 방문·QR로 받은 6자리 코드가 있어야 입장됩니다. 코드 입력 후 담당자를 선택하세요. 고객당 매장은 1곳만 등록됩니다.
      </p>

      <div class="onboard-steps">
        <span class="${step === 'code' ? 'on' : 'done'}">1 매장 코드</span>
        <span class="${step === 'designer' ? 'on' : ''}">2 담당자</span>
      </div>

      ${!salon ? `
        <div class="code-card">
          <label class="form-label" for="salon-code-input">매장 코드</label>
          <input id="salon-code-input" class="form-input code-input" type="tel" inputmode="numeric"
            maxlength="6" autocomplete="off"
            value="${state.salonCodeInput || ''}"
            placeholder="예: 100001"
            oninput="state.salonCodeInput=this.value.replace(/\\D/g,'').slice(0,6); this.value=state.salonCodeInput">
          <p class="code-hint">매장에서 안내받은 6자리 숫자 코드를 입력하세요.</p>
          <button class="btn-primary" style="margin-top:14px" onclick="lookupSalonCode()">
            <i class="fas fa-search"></i> 매장 확인
          </button>
        </div>
        <div class="code-demo-hint">
          데모 코드 · <button type="button" class="demo-link" onclick="fillDemoCode('100001')">100001</button>
          · <button type="button" class="demo-link" onclick="fillDemoCode('100002')">100002</button>
          · <button type="button" class="demo-link" onclick="fillDemoCode('100003')">100003</button>
        </div>
      ` : `
        <div class="salon-confirm-card">
          <div class="salon-icon-wrap"><i class="fas fa-scissors" style="color:var(--accent)"></i></div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:16px;color:var(--text)">${salon.salon_name}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">매장 코드 ${salon.salon_code || '-'}</div>
          </div>
          ${!state.user.current_salon_id
            ? `<button type="button" class="ghost-text-btn" onclick="resetOnboarding();render()">다시 입력</button>`
            : ''}
        </div>

        <div class="designer-section">
          <p class="designer-section-label">
            <i class="fas fa-user-check" style="color:var(--rose);margin-right:6px"></i>담당자 선택
            <span>필수</span>
          </p>
          ${activeDesigners.length === 0
            ? `<p style="font-size:13px;color:var(--muted);padding:12px 0">등록된 담당자가 없습니다. 매장에 문의해 주세요.</p>`
            : `<div class="designer-row" style="flex-wrap:wrap">
                ${activeDesigners.map((d) => `
                  <div class="designer-chip ${state.selectedDesigner === d.id ? 'selected' : ''}" onclick="selectDesigner(${d.id})">
                    <div class="d-avatar">
                      <img src="${d.profile_img || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + d.id}" alt="${d.designer_name}">
                    </div>
                    <span class="d-name">${d.designer_name.replace(' 디자이너', '')}</span>
                    ${state.selectedDesigner === d.id ? '<span class="d-selected">선택됨</span>' : ''}
                  </div>`).join('')}
              </div>`}
        </div>

        <button class="btn-primary" style="margin-top:8px" onclick="confirmScan()" ${!state.selectedDesigner ? 'disabled' : ''}>
          <i class="fas fa-check"></i> 담당자 등록 완료
        </button>
      `}
    </div>
  `;
}

function renderBoundSalonPage() {
  const u = state.user;
  return `
    <div class="scan-page">
      <h2 style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:4px">내 매장</h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:18px">
        고객당 매장은 1곳만 등록됩니다. 다른 매장으로 바꿀 수 없습니다.
      </p>
      <div class="salon-confirm-card">
        <div class="salon-icon-wrap"><i class="fas fa-scissors" style="color:var(--accent)"></i></div>
        <div style="flex:1">
          <div style="font-weight:800;font-size:16px;color:var(--text)">${u.salon_name || '등록된 매장'}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">담당 · ${u.designer_name || '없음'}</div>
        </div>
      </div>
      <button class="btn-secondary" style="margin-top:16px" onclick="startDesignerChange()">
        <i class="fas fa-user-edit" style="margin-right:8px"></i>같은 매장 담당자만 변경
      </button>
    </div>
  `;
}

async function startDesignerChange() {
  if (!state.user || !state.user.current_salon_id) return;
  const res = await api('/api/salons/' + state.user.current_salon_id + '/qr');
  if (!res.success) {
    showToast(res.error || '매장 정보를 불러오지 못했습니다', 'error');
    return;
  }
  state.selectedSalon = {
    ...res.data.salon,
    designers: res.data.designers || [],
  };
  state.selectedDesigner = state.user.mapped_designer_id || null;
  render();
}

function fillDemoCode(code) {
  state.salonCodeInput = code;
  const input = document.getElementById('salon-code-input');
  if (input) input.value = code;
  lookupSalonCode();
}

async function lookupSalonCode() {
  const code = (state.salonCodeInput || (document.getElementById('salon-code-input') || {}).value || '').trim();
  if (!code) { showToast('매장 코드를 입력해주세요', 'error'); return; }
  if (!/^\d{6}$/.test(code)) {
    showToast('매장 코드는 6자리 숫자입니다', 'error');
    return;
  }
  state.salonCodeInput = code;
  const res = await api('/api/salons/lookup?code=' + encodeURIComponent(state.salonCodeInput));
  if (!res.success) {
    showToast(res.error || '매장 코드를 찾을 수 없습니다', 'error');
    return;
  }
  state.selectedSalon = {
    ...res.data.salon,
    designers: res.data.designers || [],
  };
  state.selectedDesigner = null;
  state.onboardingStep = 'designer';
  render();
  showToast(res.data.salon.salon_name + '에 입장했습니다', 'success');
}

function selectDesigner(id) {
  state.selectedDesigner = id;
  render();
}

async function confirmScan() {
  if (!state.selectedSalon || !state.user) return;
  if (!state.selectedDesigner) {
    showToast('담당자를 선택해주세요', 'error');
    return;
  }
  const res = await api(`/api/users/${state.user.id}/scan-qr`, 'POST', {
    salon_id: state.selectedSalon.id,
    salon_code: state.selectedSalon.salon_code,
    designer_id: state.selectedDesigner
  });
  if (res.success) {
    saveUser(res.data);
    resetOnboarding();
    await loadAppData();
    navigate('home');
    showToast(res.message || '등록이 완료되었습니다', 'success');
  } else {
    showToast(res.error || '등록에 실패했습니다', 'error');
  }
}

// ============================================================
// SHOP PAGE
// ============================================================
function renderShop() {
  if (state.user && needsSalonBinding()) return renderOnboardingGate();

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
        <p class="sub">프리미엄 헤어케어 · VIP 전용가${state.user?.designer_name ? ' · ' + state.user.designer_name : ''}</p>
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
  const price = sellingPrice(p);
  const disc = Math.round((1 - price / p.original_price) * 100);
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
        <div class="pc-vip">${price.toLocaleString()}<span style="font-size:11px;font-weight:500">원</span></div>
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
  const price = sellingPrice(p);
  const disc = Math.round((1 - price / p.original_price) * 100);
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
          <span class="detail-vip-price">${price.toLocaleString()}원</span>
          <span style="font-size:13px;color:var(--muted);text-decoration:line-through">${(p.original_price||0).toLocaleString()}원</span>
          <span style="font-size:13px;font-weight:700;color:var(--rose)">-${disc}%</span>
        </div>
        <p style="font-size:13px;color:var(--muted);line-height:1.65;margin-bottom:14px;border-top:1px solid var(--border);padding-top:12px">${p.description || ''}</p>
        ${(p.detail_image_urls || []).map((src) => `<img src="${String(src).replace(/"/g, '&quot;')}" alt="" style="width:100%;border-radius:12px;margin-bottom:8px;display:block">`).join('')}
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:16px">
          <span>무료배송</span>
          <span>${p.stock_quantity >= 9999 ? '재고 있음' : '재고 ' + p.stock_quantity + '개'}</span>
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
  if (state.user && needsSalonBinding()) {
    showToast('먼저 살롱 VIP에 입장해 주세요', 'error');
    navigate('entry');
    return;
  }
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  const existing = state.cart.find(i => i.product_id === productId);
  if (existing) { existing.qty++; }
  else { state.cart.push({ product_id: p.id, name: p.name, price: sellingPrice(p), qty: 1 }); }
  render();
  showToast('장바구니에 담겼습니다', 'success');
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

// ---- Cart (bottom tab page) ----
function openCart() {
  if (!state.user) {
    showToast('로그인이 필요합니다', 'error');
    return;
  }
  navigate('cart');
}

async function placeOrder() {
  if (!state.user) return;
  if (needsSalonBinding()) {
    showToast('먼저 살롱 VIP에 입장해 주세요', 'error');
    closeModal();
    navigate('entry');
    return;
  }
  if (!String(state.user.shipping_address || '').trim()) {
    showToast('배송주소가 없습니다. 마이에서 확인하거나 다시 가입해 주세요', 'error');
    closeModal();
    navigate('profile');
    return;
  }
  closeModal();
  const res = await api('/api/orders', 'POST', {
    user_id: state.user.id,
    shipping_address: state.user.shipping_address,
    items: state.cart.map(i => ({ product_id: i.product_id, qty: i.qty }))
  });
  if (res.success) {
    state.cart = [];
    if (res.user) saveUser(res.user);
    await loadUserOrders();
    if (ownerSalon()) await loadStoreLedger();
    render();
    showToast(res.message || '주문이 완료되었습니다', 'success');
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
      ${o.points_earned ? `<div class="order-points">+${Number(o.points_earned).toLocaleString()}P 적립</div>` : ''}
      <div class="order-footer">
        <span style="font-size:12px;color:var(--muted)">총 ${items.reduce((s,i)=>s+i.qty,0)}개</span>
        <span class="order-amount">${(o.total_amount||0).toLocaleString()}원</span>
      </div>
    </div>`;
}

function openOrderDetail(id) {
  const o = state.orders.find(x => x.id === id) || (state.storeOrders || []).find(x => x.id === id);
  if (!o) return;
  const items = JSON.parse(o.order_items || '[]');
  const statusMap = { PAID:'결제완료', PENDING:'결제대기', CANCELLED:'취소됨', REFUNDED:'환불됨' };
  const money = orderMoney(o);
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
      ${o.shipping_address ? `
      <div class="cart-salon-info" style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted)">배송지</div>
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">${escText(o.shipping_name || '')} · ${escText(o.shipping_phone || '')}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:3px">${escText(o.shipping_address)}</div>
      </div>` : ''}
      ${items.map(i => `
        <div class="cart-line">
          <span style="font-size:13px;color:var(--text)">${i.name} × ${i.qty}</span>
          <span style="font-size:13px;font-weight:600">${(i.price*i.qty).toLocaleString()}원</span>
        </div>`).join('')}
      <div class="cart-total-row">
        <span>합계</span>
        <span class="cart-total-val">${(o.total_amount||0).toLocaleString()}원</span>
      </div>
      ${state.user && state.user.is_owner
        ? (o.payment_status === 'PAID' ? `<div class="rev-breakdown">
            <div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:8px">정산액</div>
            <div style="font-size:16px;font-weight:700;color:var(--text)">${won(money.storePayout)}</div>
            <div style="font-size:12px;color:var(--text);margin-top:8px">총매출 ${won(money.sale)} · 실 고객결제액 ${won(Math.max(0, money.sale - money.coupon))}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">쿠폰사용 ${won(money.coupon)} · 총 살롱가 ${won(Math.max(0, money.sale - money.storePayout))}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">정산액 = 총매출 − 총 살롱가</div>
          </div>` : '')
        : `<div class="rev-breakdown">
        <div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:8px">수익 배분 내역</div>
        <div class="rev-grid">
          <div class="rev-item">
            <div style="font-size:10px;color:var(--muted)">플랫폼</div>
            <div style="font-size:13px;font-weight:700">${(o.platform_amount||0).toLocaleString()}원</div>
            <div style="font-size:10px;color:var(--muted)">40%</div>
          </div>
          <div class="rev-item">
            <div style="font-size:10px;color:var(--muted)">매장 원장</div>
            <div style="font-size:13px;font-weight:700">${Math.round((o.total_amount || 0) * 0.3).toLocaleString()}원</div>
            <div style="font-size:10px;color:var(--muted)">30%</div>
          </div>
        </div>
      </div>`}
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
      <div class="info-card-header">내 살롱 · 담당자</div>
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
      <div class="info-row"><span>배송주소</span><span style="text-align:right;max-width:62%">${u.shipping_address || '-'}</span></div>
      <div class="info-row"><span>보유 포인트</span><span>${(u.points || 0).toLocaleString()}P</span></div>
      <div class="info-row" style="border-bottom:none"><span>가입일</span><span>${new Date(u.created_at).toLocaleDateString('ko-KR')}</span></div>
    </div>

    <div style="padding:0 16px 100px">
      ${!u.is_owner ? `
      <button class="btn-secondary" style="margin-bottom:10px" onclick="openAdminSetup()">
        <i class="fas fa-store" style="margin-right:8px"></i>매장 개설하기 (관리자)
      </button>
      <p style="font-size:12px;color:var(--muted);margin:-2px 0 12px;padding:0 2px">고객으로 먼저 입장했어도, 여기서 내 매장을 개설할 수 있습니다.</p>` : ''}
      ${u.current_salon_id ? `
      <button class="btn-secondary" style="margin-bottom:10px" onclick="navigate('scan'); startDesignerChange()">
        <i class="fas fa-user-edit" style="margin-right:8px"></i>같은 매장 담당자만 변경
      </button>` : `
      <button class="btn-secondary" style="margin-bottom:10px" onclick="navigate('entry')">
        <i class="fas fa-store" style="margin-right:8px"></i>살롱 VIP 입장하기
      </button>`}
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
  const auth = readAuth();
  // 자동 로그인은 끄고, 같은 소셜 버튼으로 다시 로그인하면 매장 유지
  if (auth && auth.auth_id) rememberAuth(auth.provider, auth.auth_id, false);
  else localStorage.removeItem(AUTH_STORE_KEY);
  clearSessionOnly();
  navigate('home');
  showToast('로그아웃되었습니다. 다시 로그인하면 내 매장으로 연결됩니다');
}

function attachListeners() {
  const input = document.getElementById('product-search');
  if (input && state.currentPage === 'search') {
    const len = input.value.length;
    input.focus();
    try { input.setSelectionRange(len, len); } catch (e) { /* ignore */ }
  }
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadAppData() {
  try {
    const salonId = catalogSalonId();
    const salonQuery = salonId ? '?salon_id=' + salonId : '';
    const bestQuery = salonId ? '?best=1&salon_id=' + salonId : '?best=1';
    const [salonsRes, allRes, productsRes, bestRes, brandsRes, bannersRes] = await Promise.all([
      api('/api/salons'),
      api('/api/products'),
      api('/api/products' + salonQuery),
      api('/api/products' + bestQuery),
      api('/api/brands'),
      api('/api/banners'),
    ]);
    if (salonsRes.success) state.salons = salonsRes.data;
    if (allRes.success) state.allProducts = allRes.data;
    if (productsRes.success) state.products = productsRes.data;
    if (bestRes.success) state.bestProducts = bestRes.data;
    if (brandsRes.success) state.brands = brandsRes.data;
    if (bannersRes.success) state.banners = bannersRes.data;
    if (state.user) await loadUserOrders();
    if (state.user) await loadPendingStaffInvites();
    if (ownerSalon()) await loadStoreLedger();
  } catch (e) {
    console.error('Load error:', e);
  }
}

function orderMoney(order) {
  return ProductCatalog.orderMoney(order, (id) => findCatalogProduct(id));
}

function won(amount) {
  return (Number(amount) || 0).toLocaleString('ko-KR') + '원';
}

function currentPeriod() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function settleView(row) {
  const sale = Number(row && row.sales) || 0;
  const coupon = Number(row && row.coupon_discount) || 0;
  const payout = Number(row && row.payout) || 0;
  return {
    count: Number(row && row.orders) || 0,
    sale,
    paid: Math.max(0, sale - coupon),
    coupon,
    salon: Math.max(0, sale - payout),
    payout,
  };
}

function renderSettleMetrics(row) {
  const view = settleView(row);
  const tile = (label, value, emph) => `<div class="settle-metric${emph ? ' emph' : ''}"><span>${label}</span><strong>${value}</strong></div>`;
  return `
    <div class="settle-metrics">
      ${tile('총건수', view.count + '건')}
      ${tile('총매출', won(view.sale))}
      ${tile('실 고객결제액', won(view.paid))}
      ${tile('쿠폰사용', won(view.coupon))}
      ${tile('총 살롱가', won(view.salon))}
      ${tile('정산액', won(view.payout), true)}
    </div>
    <div class="settle-formula">총매출 = 실 고객결제액 + 쿠폰사용<br>정산액 = 총매출 − 총 살롱가</div>`;
}

function monthLabel(period) {
  const [year, month] = String(period || '').split('-');
  if (!year || !month) return '';
  const m = Number(month);
  return year === String(new Date().getFullYear()) ? m + '월' : year.slice(2) + '.' + m;
}

function orderItemNames(order) {
  let items = order.order_items;
  if (typeof items === 'string') {
    try { items = JSON.parse(items || '[]'); } catch (e) { items = []; }
  }
  return Array.isArray(items) ? items : [];
}

async function loadStoreLedger() {
  const salon = salesSalon();
  if (!salon) {
    state.storeOrders = [];
    state.storeSettlement = null;
    return;
  }
  const [ordersRes, settleRes] = await Promise.all([
    api('/api/orders?salon_id=' + salon.id),
    api('/api/settlements?salon_id=' + salon.id),
  ]);
  if (ordersRes.success) state.storeOrders = ordersRes.data || [];
  if (settleRes.success) state.storeSettlement = settleRes.data;
}

function brandBlocksStore(brand, salonId) {
  return (brand.blocked_salon_ids || []).map(Number).includes(Number(salonId));
}

function activeSalon() {
  const id = catalogSalonId();
  return state.salons.find((salon) => Number(salon.id) === Number(id)) || null;
}

function findCatalogProduct(id) {
  return state.products.find((product) => product.id === id) || (state.allProducts || []).find((product) => product.id === id);
}

function sellingPrice(product) {
  return ProductCatalog.storeSellingPrice(activeSalon(), product);
}

function syncCartPrices() {
  state.cart.forEach((item) => {
    const product = findCatalogProduct(item.product_id);
    if (product) item.price = sellingPrice(product);
  });
}

function cartStoreProfit() {
  return state.cart.reduce((sum, item) => {
    const product = findCatalogProduct(item.product_id);
    const cost = product ? ProductCatalog.salonCost(product) : Math.round(item.price * 0.7);
    return sum + Math.max(0, item.price - cost) * item.qty;
  }, 0);
}

function rememberSalon(salon) {
  if (!salon || salon.id == null) return;
  const index = state.salons.findIndex((item) => Number(item.id) === Number(salon.id));
  if (index >= 0) state.salons[index] = { ...state.salons[index], ...salon };
  else state.salons.push(salon);
}

function ensureManageDraft(salon) {
  if (!salon) {
    state.manageDraft = null;
    return null;
  }
  const addr = splitSalonAddress(salon);
  const same = state.manageDraft && Number(state.manageDraft.salon_id) === Number(salon.id);
  if (!same) {
    state.manageDraft = {
      salon_id: salon.id,
      salon_name: salon.salon_name || '',
      owner_name: salon.owner_name || '',
      owner_phone: salon.owner_phone || '',
      address: addr.base,
      address_detail: addr.detail,
    };
  } else {
    // 서버에 상세주소가 생겼는데 draft만 비어 있으면 채움 (입력 중이면 유지)
    if (!state.manageDraft.address_detail && addr.detail) {
      state.manageDraft.address_detail = addr.detail;
    }
    if (!state.manageDraft.address && addr.base) {
      state.manageDraft.address = addr.base;
    }
  }
  return state.manageDraft;
}

function updateManageField(key, value) {
  if (!state.manageDraft) state.manageDraft = {};
  state.manageDraft[key] = value;
}

function priceSettingSummary(salon) {
  const rates = salon.brand_discount_rates || {};
  const productRates = salon.product_discount_rates || {};
  const prices = salon.product_prices || {};
  const rateCount = Object.keys(rates).filter((key) => Number(rates[key]) > 0).length;
  const priceCount = Object.keys(productRates).length + Object.keys(prices).length;
  if (!rateCount && !priceCount) return '본사 판매가 그대로';
  return '브랜드 할인 ' + rateCount + '개 · 개별 할인 ' + priceCount + '개';
}

function profitText(profit, price) {
  const base = Number(price) || 0;
  const rate = base ? Math.round(profit / base * 1000) / 10 : 0;
  const label = Number.isInteger(rate) ? String(rate) : rate.toFixed(1);
  return won(profit) + ' (' + label + '%)';
}

function escText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function storePriceProducts(salon) {
  return (state.allProducts || []).filter((product) => {
    const brand = (state.brands || []).find((item) => item.id === product.brand_id);
    return !brandBlocksStore(brand, salon.id);
  });
}

function priceBrandSummary(salon, brand, products) {
  if (brandBlocksStore(brand, salon.id)) return '본사 판매 제한';
  const rates = salon.brand_discount_rates || {};
  const productRates = salon.product_discount_rates || {};
  const overrides = salon.product_prices || {};
  const rate = Number(rates[String(brand.id)]) || 0;
  const custom = products.filter((product) => Object.prototype.hasOwnProperty.call(productRates, String(product.id)) || (overrides[String(product.id)] != null && overrides[String(product.id)] !== '')).length;
  const hidden = (salon.hidden_brand_ids || []).includes(brand.id) ? ' · 미노출' : '';
  const discount = rate ? '할인 ' + rate + '%' : '할인 없음';
  return '상품 ' + products.length + '개 · ' + discount + (custom ? ' · 개별가 ' + custom + '개' : '') + hidden;
}

function renderStorePrices() {
  const salon = ownerSalon();
  if (!salon) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;
  const products = storePriceProducts(salon);
  const brands = (state.brands || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const brand = brands.find((item) => item.id === state.priceBrand) || null;
  if (!brand) return renderPriceBrandList(salon, brands, products);
  return renderPriceBrandDetail(salon, brand, products.filter((product) => product.brand_id === brand.id));
}

function renderPriceBrandList(salon, brands, products) {
  return `
    <div style="padding:20px 16px 28px">
      <button class="store-back" onclick="navigate('store')"><i class="fas fa-chevron-left" style="margin-right:6px"></i>관리자</button>
      <h2 style="font-size:20px;font-weight:800;margin-bottom:4px">판매가 할인 설정</h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px">${escText(salon.salon_name)}에서 할인할 브랜드를 고르세요.</p>
      ${brands.map((brand) => {
        const blocked = brandBlocksStore(brand, salon.id);
        const rows = products.filter((product) => product.brand_id === brand.id);
        return `
          <button class="store-menu" onclick="${blocked ? `showToast('본사에서 판매를 제한한 브랜드입니다','error')` : `setPriceBrand(${brand.id})`}">
            <span>
              <strong>${escText(brand.name)}</strong>
              <small>${priceBrandSummary(salon, brand, rows)}</small>
            </span>
            <i class="fas fa-chevron-right"></i>
          </button>`;
      }).join('') || '<p style="font-size:13px;color:var(--muted)">브랜드가 없습니다.</p>'}
    </div>`;
}

function discountStepButtons(steps, selected, handler, id) {
  return `<div class="discount-steps">${steps.map((step) => `<button type="button" class="discount-step${Number(selected) === step ? ' on' : ''}" onclick="${handler}(${id}, ${step})">${step}%</button>`).join('')}</div>`;
}

function brandDiscountSteps(rows) {
  const steps = new Set([0]);
  rows.forEach((product) => ProductCatalog.discountSteps(product).forEach((step) => steps.add(step)));
  if (steps.size === 1) [5, 10, 15, 20, 25, 30].forEach((step) => steps.add(step));
  return [...steps].sort((a, b) => a - b);
}

function productHasOwnDiscount(salon, product) {
  const rates = (salon && salon.product_discount_rates) || {};
  const prices = (salon && salon.product_prices) || {};
  const key = String(product.id);
  return Object.prototype.hasOwnProperty.call(rates, key) || (prices[key] != null && prices[key] !== '');
}

function renderPriceBrandDetail(salon, brand, rows) {
  const rates = salon.brand_discount_rates || {};
  const productRates = salon.product_discount_rates || {};
  const hidden = new Set(salon.hidden_brand_ids || []);
  const rate = Number(rates[String(brand.id)]) || 0;
  return `
    <div style="padding:20px 16px 28px">
      <button class="store-back" onclick="closePriceBrand()"><i class="fas fa-chevron-left" style="margin-right:6px"></i>브랜드 목록</button>
      <h2 style="font-size:20px;font-weight:800;margin-bottom:4px">${escText(brand.name)}</h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px">이 매장 고객에게만 적용됩니다. 본사 판매가보다 높게, 살롱가보다 낮게는 정할 수 없고, 내린 금액은 이 매장 수익에서 빠집니다.</p>
      <div class="price-brand-box">
        <label>일괄 할인</label>
        ${discountStepButtons(brandDiscountSteps(rows), rate, 'saveBrandDiscount', brand.id)}
        <p>본사 판매가에서 고른 비율만큼 내립니다. 상품에서 따로 고른 할인율은 그대로 둡니다.</p>
      </div>
      ${rows.length ? rows.map((product) => {
        const hq = ProductCatalog.hqPrice(product);
        const floor = ProductCatalog.salonCost(product);
        const store = ProductCatalog.storeSellingPrice(salon, product);
        const profit = Math.max(0, store - floor);
        const custom = productHasOwnDiscount(salon, product);
        const own = Object.prototype.hasOwnProperty.call(productRates, String(product.id)) ? Number(productRates[String(product.id)]) || 0 : rate;
        const raw = Math.round(hq * (100 - rate) / 100);
        const held = !custom && raw < floor;
        return `
          <div class="price-row">
            <div class="price-name">${escText(product.name)}${hidden.has(product.brand_id) ? ' <span class="price-tag">미노출</span>' : ''}${custom ? ' <span class="price-tag">개별 할인</span>' : ''}</div>
            <div class="price-meta">본사 판매가 ${won(hq)} · 살롱가 ${won(floor)}</div>
            ${discountStepButtons(ProductCatalog.discountSteps(product), own, 'saveProductDiscount', product.id)}
            <div class="price-profit">우리 매장 판매가 ${won(store)} · 매장 수익 ${profitText(profit, store)}</div>
            ${held ? '<div class="price-hold">살롱가가 최저가라 여기까지입니다.</div>' : ''}
            ${custom ? `<button class="price-link" onclick="clearProductPrice(${product.id})">일괄 할인 따르기</button>` : ''}
          </div>`;
      }).join('') : '<p style="font-size:13px;color:var(--muted);padding-top:8px">이 브랜드 상품이 없습니다.</p>'}
    </div>`;
}

function setPriceBrand(id) {
  state.priceBrand = id;
  render();
  window.scrollTo(0, 0);
}

function closePriceBrand() {
  state.priceBrand = 0;
  render();
  window.scrollTo(0, 0);
}

async function saveBrandDiscount(brandId, rate) {
  const salon = ownerSalon();
  if (!salon) return;
  const value = Number(rate) || 0;
  const res = await api('/api/salons/' + salon.id + '/prices', 'POST', { brand_id: brandId, discount_rate: value });
  if (!res.success) { showToast(res.error || '저장하지 못했습니다', 'error'); return; }
  rememberSalon(res.data);
  render();
  showToast(value ? '브랜드 할인 ' + value + '%를 적용했습니다' : '브랜드 할인을 해제했습니다', 'success');
}

async function saveProductDiscount(productId, rate) {
  const salon = ownerSalon();
  const product = (state.allProducts || []).find((item) => item.id === productId);
  if (!salon || !product) return;
  const brandRate = Number((salon.brand_discount_rates || {})[String(product.brand_id)]) || 0;
  const value = Number(rate) || 0;
  const body = value === brandRate
    ? { product_id: productId, clear: true }
    : { product_id: productId, discount_rate: value };
  const res = await api('/api/salons/' + salon.id + '/prices', 'POST', body);
  if (!res.success) { showToast(res.error || '저장하지 못했습니다', 'error'); return; }
  rememberSalon(res.data);
  render();
  showToast(value ? value + '% 할인을 적용했습니다' : '할인을 해제했습니다', 'success');
}

async function clearProductPrice(productId) {
  const salon = ownerSalon();
  if (!salon) return;
  const res = await api('/api/salons/' + salon.id + '/prices', 'POST', { product_id: productId, clear: true });
  if (!res.success) { showToast(res.error || '저장하지 못했습니다', 'error'); return; }
  rememberSalon(res.data);
  render();
  showToast('일괄 할인 가격으로 돌렸습니다', 'success');
}

function brandFeeLabel(brand) {
  const rate = Number(brand.commission_rate);
  if (!Number.isFinite(rate)) return '수수료 -';
  const pct = Math.round(rate * 1000) / 10;
  return '수수료 ' + (Number.isInteger(pct) ? pct : pct.toFixed(1)) + '%';
}

function renderStoreBrands() {
  const salon = ownerSalon();
  if (!salon) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;
  const hidden = new Set(salon.hidden_brand_ids || []);
  const brands = (state.brands || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return `
    <div style="padding:20px 16px 28px">
      <button class="store-back" onclick="navigate('store')"><i class="fas fa-chevron-left" style="margin-right:6px"></i>관리자</button>
      <h2 style="font-size:20px;font-weight:800;margin-bottom:4px">브랜드 판매 노출</h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:8px">${salon.salon_name} · 끄면 이 매장 고객에게 그 브랜드 상품이 안 보입니다.</p>
      ${brands.map((brand) => {
        const count = (state.allProducts || []).filter((product) => product.brand_id === brand.id).length;
        const blocked = brandBlocksStore(brand, salon.id);
        const off = blocked || hidden.has(brand.id);
        const status = blocked ? '본사 판매 제한' : (off ? '미노출' : '노출');
        return `
          <div class="brand-row">
            <div>
              <div style="font-weight:700">${brand.name}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">${brandFeeLabel(brand)} · 상품 ${count}개 · ${status}</div>
            </div>
            <button class="switch ${off ? '' : 'on'} ${blocked ? 'locked' : ''}" onclick="${blocked ? `showToast('본사에서 판매를 제한한 브랜드입니다','error')` : `toggleSalonBrand(${brand.id}, ${off ? 'false' : 'true'})`}" aria-label="${brand.name} ${status}"></button>
          </div>`;
      }).join('')}
    </div>`;
}

function renderStaffFilters(sales) {
  const totals = new Map();
  sales.forEach((order) => {
    if (order.payment_status !== 'PAID') return;
    const name = order.designer_name || '담당 없음';
    const money = orderMoney(order);
    const row = totals.get(name) || { name, count: 0, sale: 0, coupon: 0, payout: 0 };
    row.count += 1;
    row.sale += money.sale;
    row.coupon += money.coupon;
    row.payout += money.storePayout;
    totals.set(name, row);
  });
  const people = [...totals.values()].sort((a, b) => b.sale - a.sale);
  const allSale = people.reduce((sum, row) => sum + row.sale, 0);
  const selected = state.salesStaff || '';
  const picked = people.find((row) => row.name === selected);
  const chip = (name, title, sub) => `<button type="button" class="staff-chip${selected === name ? ' on' : ''}" data-staff="${encodeURIComponent(name)}" onclick="setSalesStaff(decodeURIComponent(this.dataset.staff))"><span>${title}</span><small>${sub}</small></button>`;
  return `<div class="staff-row">
      ${chip('', '전체', won(allSale))}
      ${people.map((row) => chip(row.name, row.name, row.count + '건 · ' + won(row.sale))).join('')}
    </div>
    ${picked ? `<p style="font-size:12px;color:var(--muted);margin:-2px 0 10px">${picked.name} · 총매출 ${won(picked.sale)} · 실결제 ${won(Math.max(0, picked.sale - picked.coupon))} · 쿠폰 ${won(picked.coupon)} · 정산 ${won(picked.payout)}</p>` : ''}`;
}

function setSalesStaff(name) {
  state.salesStaff = name || '';
  render();
}

function renderStore() {
  const salon = salesSalon();
  if (!salon) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;
  if (state.storeView === 'brands') return renderStoreBrands();
  if (state.storeView === 'prices') return renderStorePrices();
  const isOwner = !!ownerSalon();
  const tab = state.adminTab === 'manage' && isOwner ? 'manage' : 'sales';
  if (tab === 'manage') return renderStoreManage(salon);
  const hidden = new Set(salon.hidden_brand_ids || []);
  const brands = state.brands || [];
  const blockedCount = brands.filter((brand) => brandBlocksStore(brand, salon.id)).length;
  const hiddenCount = brands.filter((brand) => hidden.has(brand.id) && !brandBlocksStore(brand, salon.id)).length;
  const period = (state.storeSettlement && state.storeSettlement.month) || currentPeriod();
  const rows = (state.storeSettlement && state.storeSettlement.rows) || [];
  const current = rows.find((row) => row.period === period) || { period, orders: 0, sales: 0, payout: 0, status: 'PENDING' };
  const statusLabel = { PENDING: '정산예정', CONFIRMED: '정산확정', PAID: '지급완료' };
  const past = rows.filter((row) => row.period !== period && row.orders > 0);
  const sales = (state.storeOrders || []).slice().sort((a, b) => b.id - a.id);
  return `
    <div style="padding:20px 16px 28px">
      <h2 style="font-size:20px;font-weight:800;margin-bottom:4px">관리자</h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:10px">${salon.salon_name}</p>
      ${renderAdminTabs(isOwner, 'sales')}
      <button class="store-menu" onclick="openStorePrices()">
        <span>
          <strong>판매가 할인 설정</strong>
          <small>${priceSettingSummary(salon)}</small>
        </span>
        <i class="fas fa-chevron-right"></i>
      </button>
      <button class="store-menu" onclick="openStoreBrands()">
        <span>
          <strong>브랜드 판매 노출</strong>
          <small>노출 ${brands.length - hiddenCount - blockedCount}개 · 미노출 ${hiddenCount}개${blockedCount ? ' · 본사 제한 ' + blockedCount + '개' : ''}</small>
        </span>
        <i class="fas fa-chevron-right"></i>
      </button>
      <div class="settle-card">
        <div class="settle-kicker">${monthLabel(current.period)} 정산 · ${statusLabel[current.status] || '정산예정'}</div>
        ${renderSettleMetrics(current)}
      </div>
      ${past.length ? `
        <div class="section-label">지난 정산</div>
        ${past.map((row) => `
          <div class="past-settle">
            <div>
              <div style="font-weight:700">${monthLabel(row.period)}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">${row.orders}건 · 총매출 ${won(row.sales)} · 실결제 ${won(Math.max(0, (row.sales || 0) - (row.coupon_discount || 0)))}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700">${won(row.payout)}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${statusLabel[row.status] || ''}</div>
            </div>
          </div>`).join('')}
      ` : ''}
      <div class="section-label">판매 내역</div>
      ${sales.length === 0
        ? `<p style="font-size:13px;color:var(--muted);padding:8px 0 12px">아직 판매 내역이 없습니다.</p>`
        : `${renderStaffFilters(sales)}
          <div class="order-list" style="padding:0">
            ${sales.filter((order) => !state.salesStaff || (order.designer_name || '담당 없음') === state.salesStaff).map((order) => {
              const items = orderItemNames(order);
              const paid = order.payment_status === 'PAID';
              const money = orderMoney(order);
              const statusMap = { PAID:'결제완료', PENDING:'결제대기', CANCELLED:'취소됨', REFUNDED:'환불됨' };
              return `
                <div class="order-card" onclick="openOrderDetail(${order.id})">
                  <div class="order-card-top">
                    <span style="font-size:11px;color:var(--muted)">${new Date(order.created_at).toLocaleDateString('ko-KR')} · ${order.user_name || '고객'}</span>
                    <span class="order-status-badge status-${order.payment_status}">${statusMap[order.payment_status] || order.payment_status}</span>
                  </div>
                  <div class="order-salon">${items.slice(0, 2).map((item) => item.name).join(' · ') || '상품'}</div>
                  <div class="order-designer"><i class="fas fa-user-tie" style="margin-right:4px;opacity:0.5"></i>${order.designer_name || '담당 없음'}</div>
                  <div class="order-footer">
                    <span style="font-size:12px;color:var(--muted)">${paid ? '정산 ' + won(money.storePayout) + (money.coupon ? ' · 실결제 ' + won(Math.max(0, money.sale - money.coupon)) + ' · 쿠폰 ' + won(money.coupon) : '') : ''}</span>
                    <span class="order-amount">${won(money.sale)}</span>
                  </div>
                </div>`;
            }).join('')}
          </div>
          ${sales.filter((order) => !state.salesStaff || (order.designer_name || '담당 없음') === state.salesStaff).length === 0
            ? `<p style="font-size:13px;color:var(--muted);padding:8px 0 12px">이 담당자의 판매 내역이 없습니다.</p>`
            : ''}`}
    </div>`;
}

function renderAdminTabs(isOwner, active) {
  if (!isOwner) return '';
  return `
    <div class="admin-tabs">
      <button type="button" class="admin-tab${active === 'sales' ? ' on' : ''}" onclick="setAdminTab('sales')">매출</button>
      <button type="button" class="admin-tab${active === 'manage' ? ' on' : ''}" onclick="setAdminTab('manage')">매장관리</button>
    </div>`;
}

async function loadManageDesigners() {
  const salon = ownerSalon();
  if (!salon) {
    state.manageDesigners = [];
    return;
  }
  const res = await api('/api/designers?salon_id=' + salon.id);
  if (res.success) state.manageDesigners = res.data || [];
}

function renderStoreManage(salon) {
  const designers = (state.manageDesigners || []).filter((d) => d.status !== 'RESIGNED');
  const draft = ensureManageDraft(salon) || {};
  return `
    <div style="padding:20px 16px 28px">
      <h2 style="font-size:20px;font-weight:800;margin-bottom:4px">관리자</h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:10px">${escText(salon.salon_name)}</p>
      ${renderAdminTabs(true, 'manage')}
      <div class="code-card setup-form" style="margin-top:4px">
        <div class="section-label" style="margin-top:0">기본 정보</div>
        <label class="form-label">매장명</label>
        <input id="manage-salon-name" class="form-input" value="${escText(draft.salon_name || '')}"
          oninput="updateManageField('salon_name', this.value)">
        <label class="form-label">대표자</label>
        <input id="manage-owner-name" class="form-input" value="${escText(draft.owner_name || '')}"
          oninput="updateManageField('owner_name', this.value)">
        <label class="form-label">휴대폰번호</label>
        <input id="manage-owner-phone" class="form-input" type="tel" value="${escText(draft.owner_phone || '')}"
          oninput="updateManageField('owner_phone', this.value)">
        <label class="form-label">주소</label>
        <div class="address-search-row">
          <input id="manage-address" class="form-input" value="${escText(draft.address || '')}" readonly
            placeholder="주소 검색을 눌러주세요"
            onclick="openAddressSearch('manage-address','manage-address-detail')">
          <button type="button" class="btn-secondary address-search-btn" onclick="openAddressSearch('manage-address','manage-address-detail')">주소 검색</button>
        </div>
        <label class="form-label" style="margin-top:10px">상세주소</label>
        <input id="manage-address-detail" class="form-input" type="text"
          value="${escText(draft.address_detail || '')}"
          placeholder="예: 301호"
          oninput="updateManageField('address_detail', this.value)">
        <label class="form-label">매장코드</label>
        <input class="form-input" value="${escText(salon.salon_code || '')}" disabled>
        <button class="btn-primary" style="margin-top:12px" onclick="saveSalonManage()">기본 정보 저장</button>
      </div>
      <div class="section-label">담당자 리스트</div>
      ${designers.length === 0
        ? '<p style="font-size:13px;color:var(--muted);padding:4px 0 12px">등록된 담당자가 없습니다.</p>'
        : designers.map((d) => `
          <div class="manage-designer-row">
            <div>
              <div style="font-weight:700">${escText((d.designer_name || '').replace(' 디자이너', ''))}
                <span class="designer-status-chip ${d.status === 'INVITED' ? 'wait' : 'ok'}">${d.status === 'INVITED' ? '초대 대기' : '등록 완료'}</span>
              </div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">${escText(d.phone || '연락처 없음')}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${d.status === 'INVITED' ? `<button type="button" class="ghost-text-btn" onclick="resendDesignerInvite(${d.id})">재요청</button>` : ''}
              <button type="button" class="ghost-text-btn" onclick="resignDesigner(${d.id})">삭제</button>
            </div>
          </div>`).join('')}
      <div class="code-card setup-form" style="margin-top:12px">
        <div class="section-label" style="margin-top:0">담당자 초대</div>
        <p style="font-size:12px;color:var(--muted);margin:0 0 10px">요청을 보내면 담당자 휴대폰으로 초대 문자가 갑니다. 같은 번호로 가입·문자인증을 마치면 담당자 등록이 완료됩니다.</p>
        <label class="form-label">이름</label>
        <input id="manage-new-designer-name" class="form-input" placeholder="담당자 이름">
        <label class="form-label">휴대폰</label>
        <input id="manage-new-designer-phone" class="form-input" type="tel" placeholder="010-0000-0000">
        <button class="btn-secondary" style="margin-top:12px;width:100%" onclick="addManageDesigner()">요청 보내기</button>
      </div>
    </div>`;
}

async function saveSalonManage() {
  const salon = ownerSalon();
  if (!salon) return;
  const draft = state.manageDraft || {};
  const body = {
    salon_name: String((document.getElementById('manage-salon-name') || {}).value || draft.salon_name || '').trim(),
    owner_name: String((document.getElementById('manage-owner-name') || {}).value || draft.owner_name || '').trim(),
    owner_phone: String((document.getElementById('manage-owner-phone') || {}).value || draft.owner_phone || '').trim(),
    address: String((document.getElementById('manage-address') || {}).value || draft.address || '').trim(),
    address_detail: String((document.getElementById('manage-address-detail') || {}).value || draft.address_detail || '').trim(),
  };
  if (!body.address) {
    showToast('주소 검색으로 매장 주소를 선택해주세요', 'error');
    return;
  }
  const res = await api('/api/salons/' + salon.id, 'PUT', body);
  if (!res.success) {
    showToast(res.error || '저장하지 못했습니다', 'error');
    return;
  }
  const saved = res.data || {};
  // 응답에 detail이 빠져도 방금 저장한 값 유지
  const merged = {
    ...salon,
    ...saved,
    address: saved.address != null ? saved.address : body.address,
    address_detail: saved.address_detail != null && String(saved.address_detail).length
      ? saved.address_detail
      : body.address_detail,
  };
  rememberSalon(merged);
  state.manageDraft = {
    salon_id: merged.id,
    salon_name: merged.salon_name || body.salon_name,
    owner_name: merged.owner_name || body.owner_name,
    owner_phone: merged.owner_phone || body.owner_phone,
    address: merged.address || '',
    address_detail: merged.address_detail || '',
  };
  if (state.user) {
    const userRes = await api('/api/users/' + state.user.id);
    if (userRes.success) saveUser(userRes.data.user);
  }
  await loadAppData();
  // loadAppData 후에도 방금 저장한 상세주소가 비면 다시 병합
  const after = ownerSalon();
  if (after && body.address_detail && !String(after.address_detail || '').trim()) {
    rememberSalon({ ...after, address: body.address, address_detail: body.address_detail });
    await api('/api/salons/' + salon.id, 'PUT', body);
  }
  showToast(body.address_detail ? `저장했습니다 · 상세 ${body.address_detail}` : '매장 정보를 저장했습니다', 'success');
  navigate('home');
}

async function addManageDesigner() {
  const salon = ownerSalon();
  if (!salon) return;
  const name = ((document.getElementById('manage-new-designer-name') || {}).value || '').trim();
  const phone = ((document.getElementById('manage-new-designer-phone') || {}).value || '').trim();
  if (!name) {
    showToast('담당자 이름을 입력하세요', 'error');
    return;
  }
  if (!phone) {
    showToast('담당자 휴대폰번호를 입력하세요', 'error');
    return;
  }
  const res = await api('/api/designers', 'POST', {
    salon_id: salon.id,
    designer_name: name,
    phone,
    invite: true,
  });
  if (!res.success) {
    showToast(res.error || '요청하지 못했습니다', 'error');
    return;
  }
  await loadManageDesigners();
  render();
  if (res.demo_sms) showToast(res.demo_sms, 'success');
  else showToast(res.message || '초대 요청을 보냈습니다', 'success');
}

async function resendDesignerInvite(id) {
  const res = await api('/api/designers/' + id + '/invite', 'POST', {});
  if (!res.success) {
    showToast(res.error || '재요청에 실패했습니다', 'error');
    return;
  }
  await loadManageDesigners();
  render();
  if (res.demo_sms) showToast(res.demo_sms, 'success');
  else showToast(res.message || '초대 문자를 다시 보냈습니다', 'success');
}

async function resignDesigner(id) {
  if (!confirm('이 담당자를 삭제할까요?')) return;
  const res = await api('/api/designers/' + id + '/resign', 'POST', {});
  if (!res.success) {
    showToast(res.error || '삭제하지 못했습니다', 'error');
    return;
  }
  await loadManageDesigners();
  render();
  showToast('담당자를 삭제했습니다', 'success');
}

async function toggleSalonBrand(brandId, hidden) {
  const salon = ownerSalon();
  if (!salon) return;
  const res = await api('/api/salons/' + salon.id + '/hidden-brands', 'POST', { brand_id: brandId, hidden });
  if (!res.success) { showToast(res.error || '저장하지 못했습니다', 'error'); return; }
  const index = state.salons.findIndex((item) => item.id === salon.id);
  if (index >= 0) state.salons[index] = res.data;
  await loadAppData();
  render();
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
  const params = new URLSearchParams(location.search);
  const inviteId = Number(params.get('invite') || 0);
  if (inviteId) {
    state.deepInviteId = inviteId;
    state.currentPage = 'staff-invite';
  }
  const prefillCode = params.get('code') || '';
  if (!inviteId && prefillCode) {
    state.salonCodeInput = String(prefillCode).replace(/\D/g, '').slice(0, 6);
    state.currentPage = 'scan';
  } else if (!inviteId && params.get('salon')) {
    // legacy QR links: /scan?salon=1 → resolve via salon list after load
    state.legacySalonPrefill = Number(params.get('salon'));
    state.currentPage = 'scan';
  }
  render();
  await initDB();
  await loadAppData();

  if (!state.user) {
    const restored = await tryAutoLogin();
    if (restored) {
      if (await resumeDeepInviteIfNeeded()) {
        render();
        return;
      }
      if (needsEntryGate() && state.currentPage !== 'scan' && state.currentPage !== 'admin-setup') {
        state.currentPage = 'entry';
      }
      render();
      return;
    }
    if (state.deepInviteId) {
      await loadDeepInviteInfo(state.deepInviteId);
      state.currentPage = 'staff-invite';
      render();
      return;
    }
  }

  // 세션에 저장된 유저 데이터를 API에서 최신 정보로 갱신 (매장명 등 변경 반영)
  if (state.user?.id) {
    try {
      const res = await api(`/api/users/${state.user.id}`);
      if (res.success) saveUser(res.data.user);
    } catch (e) { /* 세션 데이터 유지 */ }
  }
  if (await resumeDeepInviteIfNeeded()) {
    render();
    return;
  }
  if (state.user && needsEntryGate() && !['scan', 'admin-setup', 'entry', 'staff-invite'].includes(state.currentPage) && !state.salonCodeInput && !state.legacySalonPrefill) {
    state.currentPage = 'entry';
  }
  if (state.user && state.salonCodeInput && !state.selectedSalon) {
    await lookupSalonCode();
    return;
  }
  if (state.user && state.legacySalonPrefill && !state.selectedSalon) {
    const match = state.salons.find((s) => s.id === state.legacySalonPrefill);
    if (match && match.salon_code) {
      state.salonCodeInput = match.salon_code;
      await lookupSalonCode();
      return;
    }
  }
  render();
}

async function initDB() {
  try {
    await api('/api/init-db', 'POST');
    await api('/api/seed-db', 'POST');
  } catch (e) { console.log('DB may already be initialized'); }
}

window.addEventListener('popstate', () => {
  if (state.user) return;
  if (state.loginStep === 'profile') {
    state.loginStep = state.pendingSocial ? 'account' : 'social';
    render();
    return;
  }
  if (state.loginStep === 'account') {
    state.loginStep = 'social';
    state.pendingSocial = null;
    render();
  }
});

init();
