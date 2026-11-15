// ============================================================
// SALON VIP — Customer SPA (Mobile-First Premium)
// ============================================================

const API = (window.__SALON_CONFIG__ && window.__SALON_CONFIG__.apiBase)
  ? String(window.__SALON_CONFIG__.apiBase).replace(/\/$/, '')
  : '';
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
  selectedBrandId: 0, // 0 = 전체 브랜드
  cart: [],
  wishlist: (() => {
    try {
      const raw = JSON.parse(localStorage.getItem('salon-vip-wishlist') || '[]');
      return Array.isArray(raw) ? raw.map(Number).filter(Boolean) : [];
    } catch (_) { return []; }
  })(),
  coupons: [],
  selectedProductId: null,
  productBackPage: 'home',
  selectedOrderId: null,
  orderBackPage: 'orders',
  orderPayOpen: true,
  priceBreakdownOpen: true,
  cartQtySheet: null, // { productId, qty }
  cartAddedSheet: null, // { productId, brandName, brandId }
  // 상품 상세 할인 선택: 기본 전체 적용, 고객이 해제/변경 가능
  dealPrefs: null, // { productId, useCoupon, couponId, usePoints, pointsUse }
  menuOpen: false,
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
  resignConfirmId: null,
  pendingStaffInvites: [],
  deepInviteId: null,
  deepInviteInfo: null,
  manageDraft: null, // { salon_id, salon_name, owner_name, owner_phone, address, address_detail, bank_account }
  profilePhoneVerified: false,
  profileOtpSent: false,
  profileEditing: false,
  profileInfoOpen: false,
  setupDraft: {
    salon_name: '',
    owner_name: '',
    owner_phone: '',
    address: '',
    address_detail: '',
    bank_account: '',
    salon_code: '',
    designers: [{ designer_name: '', phone: '', requested: false }],
  },
  loading: false
};

const AUTH_STORE_KEY = 'salon_auth';
const DEVICE_ID_KEY = 'salon_device_id';
const LAST_PROVIDER_KEY = 'salon_last_provider';

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
  if (provider) rememberLastProvider(provider);
}

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORE_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function rememberLastProvider(provider) {
  if (!provider) return;
  localStorage.setItem(LAST_PROVIDER_KEY, String(provider));
}

function readLastProvider() {
  return localStorage.getItem(LAST_PROVIDER_KEY) || (readAuth() && readAuth().provider) || '';
}

function renderSocialBtn(provider, label, extraClass, iconHtml) {
  const recent = readLastProvider() === provider;
  return `
    <div class="social-btn-wrap">
      ${recent ? '<span class="recent-use-bubble">최근 사용</span>' : ''}
      <button type="button" class="social-btn ${extraClass}" onclick="startSocialLogin('${provider}')">
        <span class="social-ico">${iconHtml}</span>${label}
      </button>
    </div>`;
}

function clearSessionOnly() {
  state.user = null;
  state.orders = [];
  state.storeOrders = [];
  state.storeSettlement = null;
  state.storeView = '';
  state.adminTab = 'sales';
  state.manageDesigners = [];
  state.manageDraft = null;
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
  try {
    const res = await fetch(API + path, opts);
    return await res.json();
  } catch (e) {
    return { success: false, error: '서버에 연결할 수 없습니다' };
  }
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

function openHeaderMenu() {
  state.menuOpen = true;
  render();
}

function closeHeaderMenu() {
  state.menuOpen = false;
  render();
}

function pickMenuCategory(cat) {
  state.menuOpen = false;
  goShopCategory(cat);
}

function pickMenuBrand(brandId) {
  state.menuOpen = false;
  goShopBrand(brandId);
}

function renderHeaderMenu() {
  if (!state.menuOpen) return '';
  const categories = ['전체', '샴푸', '컨디셔너', '트리트먼트', '오일/세럼', '스프레이', '컬크림', '왁스/젤'];
  const brands = (state.brands || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  return `
    <div class="header-menu-overlay" onclick="closeHeaderMenu()">
      <aside class="header-menu-panel" onclick="event.stopPropagation()">
        <div class="header-menu-top">
          <div class="header-menu-title">메뉴</div>
          <button type="button" class="header-menu-close" onclick="closeHeaderMenu()" aria-label="닫기">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="header-menu-section">
          <div class="header-menu-label">카테고리</div>
          <div class="header-menu-list">
            ${categories.map((name) => `
              <button type="button" class="header-menu-item" onclick="pickMenuCategory('${name}')">${name}</button>
            `).join('')}
          </div>
        </div>
        <div class="header-menu-section">
          <div class="header-menu-label">브랜드</div>
          <div class="header-menu-list">
            <button type="button" class="header-menu-item" onclick="pickMenuBrand(0)">전체 브랜드</button>
            ${brands.map((brand) => `
              <button type="button" class="header-menu-item" onclick="pickMenuBrand(${brand.id})">${escText(brand.name)}</button>
            `).join('')}
          </div>
        </div>
      </aside>
    </div>
  `;
}

function renderShell() {
  // 매장명: 로그인 상태면 매장명, 없으면 브랜드명
  const salonName = state.user?.salon_name || null;
  const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);
  const isProduct = state.currentPage === 'product';
  const isLogin = !state.user;
  return `
    ${isProduct || isLogin ? '' : `
    <header class="app-header">
      ${salonName
        ? `<div class="header-salon-name">${salonName}<span class="brand-dot"></span></div>`
        : `<div class="logo">SALON <span>VIP</span></div>`
      }
      <div class="header-right">
        ${canViewSales() ? `<button type="button" class="header-sales-btn" onclick="openAdmin()"><i class="fas fa-store"></i> 관리자</button>` : ''}
        <button type="button" class="header-icon-btn" onclick="showToast('알림이 없습니다','success')" aria-label="알림">
          <i class="fas fa-bell"></i>
        </button>
        <button type="button" class="header-icon-btn" onclick="openHeaderMenu()" aria-label="메뉴">
          <i class="fas fa-bars"></i>
        </button>
      </div>
    </header>`}
    <main class="page-content${isProduct || isLogin ? ' page-content-flush' : ''}" id="page-content">
      ${renderPage()}
    </main>
    ${state.user && !['entry', 'admin-setup', 'product'].includes(state.currentPage) ? renderBottomNav(cartCount) : ''}
    ${renderHeaderMenu()}
    ${renderCartQtySheet()}
    ${renderCartAddedSheet()}
    ${renderResignConfirm()}
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
    bank_account: '',
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
    { id: 'brands', icon: 'fa-tags', label: '브랜드' },
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
    case 'brands':       return renderBrands();
    case 'category':     return renderBrands(); // 이전 카테고리 탭 → 브랜드
    case 'search':       return renderSearch();
    case 'cart':         return renderCartPage();
    case 'store':        return renderStore();
    case 'entry':        return renderEntryGate();
    case 'admin-setup':  return renderAdminSetup();
    case 'staff-invite': return renderStaffInviteLanding();
    case 'scan':         return renderScan();
    case 'shop':         return renderShop();
    case 'orders':       return renderOrders();
    case 'order-detail': return renderOrderDetailPage();
    case 'profile':      return renderProfile();
    case 'product':      return renderProductPage();
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
      <span class="see-all" onclick="navigate('brands')">전체보기 →</span>
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
  state.selectedBrandId = 0;
  navigate('shop');
}

function goShopBrand(brandId) {
  state.selectedBrandId = Number(brandId) || 0;
  state.selectedCategory = '전체';
  navigate('shop');
}

function renderBrands() {
  if (!state.user) return renderLoginPrompt();
  const brands = (state.brands || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  const counts = {};
  (state.products || []).forEach((p) => {
    const id = Number(p.brand_id) || 0;
    counts[id] = (counts[id] || 0) + 1;
  });
  return `
    <div class="page-pad">
      <h2 class="page-title">브랜드</h2>
      <p class="page-sub">브랜드를 선택해 제품을 보세요</p>
      <div class="category-menu-list">
        <button type="button" class="category-menu-row" onclick="goShopBrand(0)">
          <span>전체 브랜드</span>
          <span class="brand-menu-meta">${(state.products || []).length} · <i class="fas fa-chevron-right"></i></span>
        </button>
        ${brands.map((brand) => `
          <button type="button" class="category-menu-row" onclick="goShopBrand(${brand.id})">
            <span>${escText(brand.name)}</span>
            <span class="brand-menu-meta">${counts[brand.id] || 0} · <i class="fas fa-chevron-right"></i></span>
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
          : `<div class="product-grid search-result-grid">${list.map((p) => renderProductCard(p)).join('')}</div>`}
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
  const itemCount = state.cart.reduce((s, i) => s + Number(i.qty || 0), 0);
  if (state.cart.length === 0) {
    return `
      <div class="page-pad" style="padding-top:48px;text-align:center">
        <i class="fas fa-shopping-bag" style="font-size:32px;color:var(--muted);opacity:0.3"></i>
        <h3 style="margin:14px 0 6px;font-size:16px;font-weight:800">장바구니가 비어 있어요</h3>
        <button class="btn-primary" style="width:auto;padding:12px 24px;margin-top:12px" onclick="navigate('brands')">상품 보러가기</button>
      </div>`;
  }
  return `
    <div class="page-pad cart-page" style="padding-bottom:120px">
      <h2 class="page-title">장바구니</h2>
      <p class="cart-sub">${itemCount}개 상품 · ${escText(state.user.salon_name || '')}${state.user.designer_name ? ' · ' + escText(state.user.designer_name) : ''}</p>
      <div class="cart-list">
        ${state.cart.map((i) => {
          const product = findCatalogProduct(i.product_id);
          const img = (product && product.image_url) || ORDER_FALLBACK_IMG;
          const pid = Number(i.product_id) || 0;
          return `
          <div class="cart-item">
            <img class="cart-thumb" src="${img}" alt="" ${pid ? `onclick="openProductDetail(${pid})"` : ''} onerror="this.src='${ORDER_FALLBACK_IMG}'">
            <div class="cart-item-body">
              <div class="cart-item-name"${pid ? ` onclick="openProductDetail(${pid})"` : ''}>${escText(i.name || '상품')}</div>
              <div class="cart-item-unit">${Number(i.price || 0).toLocaleString()}원</div>
              <div class="cart-item-actions">
                <div class="cart-qty">
                  <button type="button" class="qty-btn" onclick="updateCartQty(${i.product_id},-1)" aria-label="수량 감소">−</button>
                  <span class="cart-qty-num">${i.qty}</span>
                  <button type="button" class="qty-btn" onclick="updateCartQty(${i.product_id},1)" aria-label="수량 증가">+</button>
                </div>
                <button type="button" class="cart-remove" onclick="removeFromCart(${i.product_id});render()">삭제</button>
              </div>
            </div>
            <div class="cart-item-price">${(Number(i.price || 0) * Number(i.qty || 0)).toLocaleString()}원</div>
          </div>`;
        }).join('')}
      </div>
      <div class="cart-total-row">
        <span>합계</span>
        <span class="cart-total-val">${total.toLocaleString()}원</span>
      </div>
      <button class="btn-primary cart-pay-btn" onclick="placeOrder()">
        결제하기 ${total.toLocaleString()}원
      </button>
    </div>
  `;
}

function productBrandName(p) {
  if (p && p.brand_name) return String(p.brand_name);
  const brands = state.brands || [];
  const brand = brands.find((b) => Number(b.id) === Number(p && p.brand_id));
  return brand ? brand.name : (p && p.category) || '';
}

function isWishlisted(productId) {
  return (state.wishlist || []).includes(Number(productId));
}

function toggleWishlist(productId, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const id = Number(productId);
  const list = Array.isArray(state.wishlist) ? state.wishlist.slice() : [];
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);
  state.wishlist = list;
  try { localStorage.setItem('salon-vip-wishlist', JSON.stringify(list)); } catch (_) {}
  render();
}

function addToCartFromCard(productId, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  addToCart(productId);
}

function freeShipHint(p) {
  const qty = Number(p && p.free_ship_qty) || 6;
  return qty + '개 구매시 무료배송';
}

function renderBestCard(p) {
  const deal = maxDiscountBreakdown(p);
  const brand = productBrandName(p);
  const wished = isWishlisted(p.id);
  const inCart = state.cart.find((i) => i.product_id === p.id);
  return `
    <div class="best-card" onclick="openProductDetail(${p.id})">
      <div class="best-card-img-wrap">
        <img class="best-card-img" src="${p.image_url || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&q=80'}"
             alt="${escText(p.name)}" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&q=80'">
        <button type="button" class="pc-wish-btn${wished ? ' on' : ''}" onclick="toggleWishlist(${p.id},event)" aria-label="찜">
          <i class="${wished ? 'fas' : 'far'} fa-heart"></i>
        </button>
        <button type="button" class="pc-cart-btn" onclick="addToCartFromCard(${p.id},event)" aria-label="장바구니">
          <i class="fas fa-shopping-bag"></i>
          ${inCart ? `<span class="pc-cart-qty">${inCart.qty}</span>` : ''}
        </button>
      </div>
      <div class="best-card-body">
        <div class="pc-brand">${escText(brand)}</div>
        <div class="best-name">${escText(p.name)}</div>
        <div class="pc-base-price">${deal.sale.toLocaleString()}원</div>
        <div class="pc-deal-row">
          <span class="pc-deal-price">${deal.maxPrice.toLocaleString()}원</span>
          <span class="pc-deal-label">나의 최대할인가</span>
        </div>
        <div class="pc-ship-hint">${escText(freeShipHint(p))}</div>
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
  // 데모: 폰에선 보통 계정 1개처럼 보이게 제공자당 1명만. auth_id는 시드 기존 회원 고정.
  const device = getDeviceId().slice(-4);
  const map = {
    kakao: [
      { slot: 'minsu', name: '김민수', handle: 'minsu@kakao.com', auth_id: 'kakao_demo_minsu', existing: true },
    ],
    google: [
      { slot: 'jihoon', name: '박지훈', handle: 'jihoon@gmail.com', auth_id: 'kakao_003', existing: true },
    ],
    naver: [
      { slot: 'mirae', name: '김미래', handle: 'mirae@naver.com', auth_id: 'kakao_002', existing: true },
    ],
    apple: [
      { slot: 'sejin', name: '오세진', handle: 'sejin_' + device + '@privaterelay.appleid.com', auth_id: null, existing: false },
    ],
  };
  return map[provider] || [];
}

function authIdForAccount(provider, slot) {
  const acc = providerAccounts(provider).find((a) => String(a.slot) === String(slot));
  if (acc && acc.auth_id) return acc.auth_id;
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
        <div class="login-hero-glow" aria-hidden="true"></div>
        <div class="login-mark" aria-hidden="true">
          <i class="fas fa-scissors"></i>
        </div>
        <h1 class="login-brand">SALON <span>VIP</span></h1>
        <p class="login-tagline">프리미엄 살롱 VIP 멤버십</p>
        <div class="login-hero-line" aria-hidden="true"></div>
      </div>

      <div class="login-body">
        <div class="login-body-handle" aria-hidden="true"></div>
        <h2 class="login-title">시작하기</h2>
        <p class="login-sub">소셜 계정으로 가입하면, 매장 코드 등록 후 VIP 쇼핑이 연결됩니다.</p>

        <div class="social-login-stack">
          ${renderSocialBtn('kakao', '카카오로 시작하기', 'social-kakao', 'K')}
          ${renderSocialBtn('google', 'Google로 시작하기', 'social-google', 'G')}
          ${renderSocialBtn('naver', '네이버로 시작하기', 'social-naver', 'N')}
          ${renderSocialBtn('apple', 'Apple로 시작하기', 'social-apple', '<i class="fab fa-apple"></i>')}
        </div>

        <div class="login-demo-row">
          <button type="button" onclick="loginAsDemo()" class="demo-link">데모 계정</button>
          <span class="login-demo-dot">·</span>
          <button type="button" onclick="loginAsOwner()" class="demo-link">내 매장 원장</button>
          <span class="login-demo-dot">·</span>
          <button type="button" onclick="loginAsStaff()" class="demo-link">담당자</button>
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
  rememberLastProvider(provider);
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
        <label class="form-label">정산 계좌번호</label>
        <input class="form-input" value="${escText(d.bank_account || '')}"
          placeholder="예: 국민 123456-78-901234"
          oninput="updateSetupField('bank_account', this.value)">
        <p style="font-size:12px;color:var(--muted);margin:6px 0 0">매출 정산을 받을 예금주·은행·계좌번호를 입력하세요.</p>
        <label class="form-label">매장코드 6자리</label>
        <input class="form-input code-input" type="tel" inputmode="numeric" maxlength="6"
          value="${escText(d.salon_code)}" placeholder="예: 100001"
          oninput="updateSetupField('salon_code', this.value.replace(/\\D/g,'').slice(0,6)); this.value=state.setupDraft.salon_code">
        <div class="setup-designer-block">
          <div class="setup-designer-head">
            <label class="form-label" style="margin:0">담당자 초대</label>
            <button type="button" class="ghost-text-btn" onclick="addSetupDesignerRow()">+ 추가</button>
          </div>
          <p class="setup-designer-hint">각 담당자 매출 확인이 필요한 경우 추가하세요.<br>1인샵은 추가할 필요 없습니다.</p>
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
  const bankAccount = String(d.bank_account || '').trim();
  if (!bankAccount) {
    showToast('정산 받을 계좌번호를 입력하세요', 'error');
    return;
  }
  d.bank_account = bankAccount;
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
    bank_account: bankAccount,
    salon_code: String(d.salon_code).trim(),
    designers,
  });
  if (!res.success) {
    showToast(res.error || '매장 생성에 실패했습니다', 'error');
    return;
  }
  if (res.data && res.data.user) saveUser(res.data.user);
  if (res.data && res.data.salon) rememberSalon(res.data.salon);
  const auth = readAuth();
  if (auth && auth.provider) rememberLastProvider(auth.provider);
  else rememberLastProvider('kakao');
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
  const res = await api('/api/auth/demo-owner', 'POST', {});
  if (!res.success || !res.data) {
    showToast(res.error || '원장 계정을 찾지 못했습니다', 'error');
    return;
  }
  const provider = res.provider || res.data.auth_provider || 'kakao';
  const authId = res.auth_id || res.data.kakao_id || '';
  if (authId) rememberAuth(provider, authId, true);
  else rememberLastProvider(provider);
  saveUser(res.data);
  await loadAppData();
  navigate('home');
  showToast(res.message || ((res.salon_name || res.data.salon_name || '매장') + ' 원장으로 로그인했습니다'), 'success');
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

  // 이미 매장이 있으면 내 매장 화면. 담당자만 같은 매장 안에서 수정 가능.
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
        매장 방문·QR로 받은 6자리 코드가 있어야 입장됩니다. 코드 입력 후 담당자를 선택하세요.
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
        등록된 매장입니다. 담당자만 같은 매장 안에서 변경할 수 있습니다.
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

  const brandId = Number(state.selectedBrandId) || 0;
  const brands = (state.brands || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  let filtered = state.products || [];
  if (brandId) filtered = filtered.filter((p) => Number(p.brand_id) === brandId);
  if (state.selectedCategory && state.selectedCategory !== '전체') {
    filtered = filtered.filter((p) => p.category === state.selectedCategory);
  }

  const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);
  const salonName = state.user?.salon_name || 'SUBLIMIC';
  const brandName = brandId
    ? ((brands.find((b) => Number(b.id) === brandId) || {}).name || '브랜드')
    : '';

  return `
    <!-- Shop Header -->
    <div class="shop-header">
      <div>
        <h2>${salonName}</h2>
        <p class="sub">프리미엄 헤어케어 · VIP 전용가${state.user?.designer_name ? ' · ' + state.user.designer_name : ''}${brandName ? ' · ' + escText(brandName) : ''}</p>
      </div>
      ${state.cart.length > 0 ? `
      <div class="cart-mini-bar" onclick="openCart()">
        <i class="fas fa-shopping-bag" style="color:var(--rose);font-size:13px"></i>
        <span style="font-size:12px;font-weight:700;color:var(--rose)">${cartCount}개 담김</span>
        <button class="cart-checkout-btn">결제</button>
      </div>` : `
      <span class="vip-info-bar"><i class="fas fa-crown"></i> VIP 전용가</span>`}
    </div>

    <!-- Brand Tabs -->
    <div class="cat-tabs-wrap">
      <div class="cat-tabs">
        <button class="cat-tab ${!brandId ? 'active' : ''}" onclick="filterBrand(0)">전체</button>
        ${brands.map((brand) => `
          <button class="cat-tab ${brandId === Number(brand.id) ? 'active' : ''}" onclick="filterBrand(${brand.id})">
            ${escText(brand.name)}
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
  const deal = maxDiscountBreakdown(p);
  const brand = productBrandName(p);
  const wished = isWishlisted(p.id);
  const inCart = state.cart.find((i) => i.product_id === p.id);
  return `
    <div class="product-card" onclick="openProductDetail(${p.id})">
      <div class="product-card-img-wrap">
        <img class="product-card-img" src="${p.image_url || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&q=80'}"
             alt="${escText(p.name)}" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&q=80'">
        <button type="button" class="pc-wish-btn${wished ? ' on' : ''}" onclick="toggleWishlist(${p.id},event)" aria-label="찜">
          <i class="${wished ? 'fas' : 'far'} fa-heart"></i>
        </button>
        <button type="button" class="pc-cart-btn" onclick="addToCartFromCard(${p.id},event)" aria-label="장바구니">
          <i class="fas fa-shopping-bag"></i>
          ${inCart ? `<span class="pc-cart-qty">${inCart.qty}</span>` : ''}
        </button>
      </div>
      <div class="product-card-body">
        <div class="pc-brand">${escText(brand)}</div>
        <div class="pc-name">${escText(p.name)}</div>
        <div class="pc-base-price">${deal.sale.toLocaleString()}원</div>
        <div class="pc-deal-row">
          <span class="pc-deal-price">${deal.maxPrice.toLocaleString()}원</span>
          <span class="pc-deal-label">나의 최대할인가</span>
        </div>
        <div class="pc-ship-hint">${escText(freeShipHint(p))}</div>
      </div>
    </div>`;
}

function filterCategory(cat) {
  state.selectedCategory = cat;
  render();
}

function filterBrand(brandId) {
  state.selectedBrandId = Number(brandId) || 0;
  state.selectedCategory = '전체';
  render();
}

function couponDiscountAmount(coupon, sale) {
  if (!coupon) return 0;
  const value = Number(coupon.discount_value) || 0;
  if (coupon.discount_type === 'RATE') {
    return Math.min(sale, Math.round(sale * value / 100));
  }
  return Math.min(sale, Math.max(0, value));
}

function userHeldCouponIds() {
  return Array.isArray(state.user && state.user.coupon_ids)
    ? state.user.coupon_ids.map(Number).filter(Boolean)
    : [];
}

function productSalePrice(p) {
  return Math.max(0, Number(p && p.original_price) || sellingPrice(p) || 0);
}

function listAvailableCoupons(p, sale) {
  const price = sale != null ? sale : productSalePrice(p);
  const held = new Set(userHeldCouponIds());
  const active = (state.coupons || []).filter((c) => c && c.status === 'ACTIVE');
  const scoped = active.filter((c) => {
    if (Number(c.min_order_amount || 0) > price) return false;
    if (c.apply_scope === 'BRAND' && Number(c.brand_id) !== Number(p.brand_id)) return false;
    return true;
  });
  const owned = scoped.filter((c) => held.has(Number(c.id)));
  const pool = owned.length ? owned : scoped;
  return pool
    .map((c) => ({ coupon: c, amount: couponDiscountAmount(c, price) }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function pickBestCoupon(p, sale) {
  const list = listAvailableCoupons(p, sale);
  if (!list.length) return { coupon: null, amount: 0 };
  return { coupon: list[0].coupon, amount: list[0].amount };
}

function maxPointsUsable(p, afterCoupon) {
  if (p && p.point_use_disabled) return 0;
  const userPts = Math.max(0, Number(state.user && state.user.points) || 0);
  return Math.min(userPts, Math.max(0, afterCoupon));
}

function ensureDealPrefs(p, forceReset) {
  const sale = productSalePrice(p);
  const available = listAvailableCoupons(p, sale);
  const best = available[0] || null;
  const bestCouponAmt = best ? best.amount : 0;
  const maxPts = maxPointsUsable(p, Math.max(0, sale - bestCouponAmt));
  const same = state.dealPrefs && Number(state.dealPrefs.productId) === Number(p.id);
  if (forceReset || !same) {
    state.dealPrefs = {
      productId: Number(p.id),
      useCoupon: !!best,
      couponId: best ? Number(best.coupon.id) : null,
      usePoints: maxPts > 0,
      pointsUse: maxPts,
    };
    return state.dealPrefs;
  }
  // 선택값이 유효한지 보정
  if (state.dealPrefs.useCoupon) {
    const still = available.find((row) => Number(row.coupon.id) === Number(state.dealPrefs.couponId));
    if (!still) {
      state.dealPrefs.couponId = best ? Number(best.coupon.id) : null;
      state.dealPrefs.useCoupon = !!best;
    }
  }
  const couponAmt = state.dealPrefs.useCoupon
    ? (available.find((row) => Number(row.coupon.id) === Number(state.dealPrefs.couponId)) || { amount: 0 }).amount
    : 0;
  const cap = maxPointsUsable(p, Math.max(0, sale - couponAmt));
  if (!state.dealPrefs.usePoints) state.dealPrefs.pointsUse = 0;
  else state.dealPrefs.pointsUse = Math.min(cap, Math.max(0, Number(state.dealPrefs.pointsUse) || 0));
  if (state.dealPrefs.usePoints && state.dealPrefs.pointsUse === 0 && cap > 0) {
    state.dealPrefs.pointsUse = cap;
  }
  return state.dealPrefs;
}

function maxDiscountBreakdown(p, opts) {
  const interactive = !!(opts && opts.interactive);
  const fullApply = !interactive; // 목록 카드는 항상 최대 적용
  const sale = productSalePrice(p);
  const available = listAvailableCoupons(p, sale);
  let coupon = null;
  let couponAmt = 0;
  let useCoupon = false;
  let usePoints = false;
  let pointsAmt = 0;
  const userPts = Math.max(0, Number(state.user && state.user.points) || 0);
  const pointsDisabled = !!(p && p.point_use_disabled);

  if (fullApply) {
    const best = available[0] || null;
    coupon = best ? best.coupon : null;
    couponAmt = best ? best.amount : 0;
    useCoupon = !!coupon;
    const afterCoupon = Math.max(0, sale - couponAmt);
    pointsAmt = pointsDisabled ? 0 : Math.min(userPts, afterCoupon);
    usePoints = pointsAmt > 0;
  } else {
    const prefs = ensureDealPrefs(p);
    useCoupon = !!prefs.useCoupon && !!prefs.couponId;
    if (useCoupon) {
      const row = available.find((item) => Number(item.coupon.id) === Number(prefs.couponId));
      if (row) { coupon = row.coupon; couponAmt = row.amount; }
      else { useCoupon = false; couponAmt = 0; }
    }
    const afterCoupon = Math.max(0, sale - couponAmt);
    const cap = pointsDisabled ? 0 : Math.min(userPts, afterCoupon);
    usePoints = !!prefs.usePoints && !pointsDisabled;
    pointsAmt = usePoints ? Math.min(cap, Math.max(0, Number(prefs.pointsUse) || 0)) : 0;
  }

  const afterCoupon = Math.max(0, sale - couponAmt);
  const maxPrice = Math.max(0, afterCoupon - pointsAmt);
  const earnRate = Math.max(0, Number(p.earn_points_rate) || 0);
  const earnPts = Math.floor(maxPrice * earnRate / 100);
  return {
    sale,
    availableCoupons: available,
    coupon,
    couponAmt,
    useCoupon,
    hasCoupon: available.length > 0,
    pointsAmt,
    usePoints,
    pointsDisabled,
    pointsCap: pointsDisabled ? 0 : Math.min(userPts, afterCoupon),
    userPts,
    maxPrice,
    earnPts,
  };
}

function togglePriceBreakdown() {
  state.priceBreakdownOpen = !state.priceBreakdownOpen;
  render();
}

function setDealUseCoupon(on) {
  const p = findCatalogProduct(state.selectedProductId);
  if (!p) return;
  const prefs = ensureDealPrefs(p);
  prefs.useCoupon = !!on;
  if (prefs.useCoupon && !prefs.couponId) {
    const best = listAvailableCoupons(p)[0];
    prefs.couponId = best ? Number(best.coupon.id) : null;
    if (!prefs.couponId) prefs.useCoupon = false;
  }
  // 쿠폰 변경 후 포인트 상한 재적용
  const sale = productSalePrice(p);
  const couponAmt = prefs.useCoupon
    ? (listAvailableCoupons(p, sale).find((r) => Number(r.coupon.id) === Number(prefs.couponId)) || { amount: 0 }).amount
    : 0;
  const cap = maxPointsUsable(p, Math.max(0, sale - couponAmt));
  if (prefs.usePoints) prefs.pointsUse = cap;
  render();
}

function setDealCouponId(couponId) {
  const p = findCatalogProduct(state.selectedProductId);
  if (!p) return;
  const prefs = ensureDealPrefs(p);
  const id = couponId === '' || couponId == null ? null : Number(couponId);
  if (!id) {
    prefs.useCoupon = false;
    prefs.couponId = null;
  } else {
    prefs.useCoupon = true;
    prefs.couponId = id;
  }
  const sale = productSalePrice(p);
  const couponAmt = prefs.useCoupon
    ? (listAvailableCoupons(p, sale).find((r) => Number(r.coupon.id) === Number(prefs.couponId)) || { amount: 0 }).amount
    : 0;
  const cap = maxPointsUsable(p, Math.max(0, sale - couponAmt));
  if (prefs.usePoints) prefs.pointsUse = cap;
  render();
}

function setDealUsePoints(on) {
  const p = findCatalogProduct(state.selectedProductId);
  if (!p) return;
  const prefs = ensureDealPrefs(p);
  prefs.usePoints = !!on;
  const deal = maxDiscountBreakdown(p, { interactive: true });
  prefs.pointsUse = prefs.usePoints ? deal.pointsCap : 0;
  // maxDiscountBreakdown already read prefs; re-set and render
  prefs.pointsUse = prefs.usePoints ? (
    maxPointsUsable(p, Math.max(0, productSalePrice(p) - (
      prefs.useCoupon
        ? (listAvailableCoupons(p).find((r) => Number(r.coupon.id) === Number(prefs.couponId)) || { amount: 0 }).amount
        : 0
    )))
  ) : 0;
  render();
}

function setDealPointsUse(value) {
  const p = findCatalogProduct(state.selectedProductId);
  if (!p) return;
  const prefs = ensureDealPrefs(p);
  const sale = productSalePrice(p);
  const couponAmt = prefs.useCoupon
    ? (listAvailableCoupons(p, sale).find((r) => Number(r.coupon.id) === Number(prefs.couponId)) || { amount: 0 }).amount
    : 0;
  const cap = maxPointsUsable(p, Math.max(0, sale - couponAmt));
  const n = Math.min(cap, Math.max(0, Math.floor(Number(value) || 0)));
  prefs.usePoints = n > 0;
  prefs.pointsUse = n;
  render();
}

function renderMaxDiscountBox(p, deal) {
  const open = state.priceBreakdownOpen !== false;
  const prefs = ensureDealPrefs(p);
  const couponOptions = deal.availableCoupons || [];
  return `
    <button type="button" class="pd-max-toggle" onclick="togglePriceBreakdown()">
      <span class="pd-max-price">${deal.maxPrice.toLocaleString()}원</span>
      <span class="pd-max-label">나의 최대할인가</span>
      <i class="fas fa-chevron-${open ? 'up' : 'down'}"></i>
    </button>
    ${open ? `
    <div class="pd-breakdown">
      <div class="pd-row">
        <span>판매가</span>
        <span>${deal.sale.toLocaleString()}원</span>
      </div>

      <div class="pd-apply-block">
        <div class="pd-apply-head">
          <label class="pd-check">
            <input type="checkbox" ${prefs.useCoupon && couponOptions.length ? 'checked' : ''}
              ${couponOptions.length ? '' : 'disabled'}
              onchange="setDealUseCoupon(this.checked)">
            <span>쿠폰 사용</span>
          </label>
          <span class="pd-apply-amt">${deal.couponAmt ? '-' + deal.couponAmt.toLocaleString() + '원' : '0원'}</span>
        </div>
        ${couponOptions.length ? `
        <select class="pd-select" ${prefs.useCoupon ? '' : 'disabled'} onchange="setDealCouponId(this.value)">
          <option value="">사용 안 함</option>
          ${couponOptions.map((row) => `
            <option value="${row.coupon.id}" ${prefs.useCoupon && Number(prefs.couponId) === Number(row.coupon.id) ? 'selected' : ''}>
              ${escText(row.coupon.name)} (−${row.amount.toLocaleString()}원)
            </option>`).join('')}
        </select>
        <div class="pd-hint">사용 가능 쿠폰 ${couponOptions.length}장</div>
        ` : `<div class="pd-hint">사용 가능한 쿠폰이 없습니다</div>`}
      </div>

      <div class="pd-points-box">
        <div class="pd-apply-head">
          <label class="pd-check">
            <input type="checkbox" ${prefs.usePoints && !deal.pointsDisabled && deal.pointsCap > 0 ? 'checked' : ''}
              ${deal.pointsDisabled || deal.userPts <= 0 ? 'disabled' : ''}
              onchange="setDealUsePoints(this.checked)">
            <span>포인트 사용</span>
          </label>
          <span class="pd-apply-amt">${deal.pointsAmt ? '-' + deal.pointsAmt.toLocaleString() + '원' : '0원'}</span>
        </div>
        ${deal.pointsDisabled ? `<div class="pd-hint">이 상품은 포인트 사용이 불가합니다</div>` : `
        <div class="pd-row pd-row-tight">
          <span class="pd-muted">보유 ${deal.userPts.toLocaleString()}P · 사용가능 ${deal.pointsCap.toLocaleString()}P</span>
        </div>
        <div class="pd-points-edit">
          <input class="pd-points-input" type="number" min="0" max="${deal.pointsCap}" step="100"
            value="${deal.pointsAmt}"
            ${prefs.usePoints && deal.pointsCap > 0 ? '' : 'disabled'}
            onchange="setDealPointsUse(this.value)"
            onkeydown="if(event.key==='Enter'){setDealPointsUse(this.value);event.preventDefault();}">
          <button type="button" class="pd-points-max" ${deal.pointsCap > 0 ? '' : 'disabled'}
            onclick="setDealUsePoints(true)">전액</button>
        </div>
        `}
      </div>

      <div class="pd-row pd-row-total">
        <span>최대할인가</span>
        <span>${deal.maxPrice.toLocaleString()}원</span>
      </div>
      <div class="pd-row pd-row-earn">
        <span>추가 구매적립금</span>
        <span>${deal.earnPts.toLocaleString()}원</span>
      </div>
    </div>` : ''}
  `;
}

// ---- Product Detail Page ----
function openProductDetail(id) {
  const p = findCatalogProduct(id);
  if (!p) { showToast('상품을 찾을 수 없습니다', 'error'); return; }
  if (state.currentPage !== 'product') state.productBackPage = state.currentPage || 'home';
  state.selectedProductId = Number(id);
  state.priceBreakdownOpen = true;
  ensureDealPrefs(p, true); // 상품 열 때마다 기본: 전체 적용
  navigate('product');
}

function closeProductPage() {
  const back = state.productBackPage || 'home';
  state.selectedProductId = null;
  state.cartQtySheet = null;
  state.cartAddedSheet = null;
  navigate(back === 'product' ? 'home' : back);
}

function openCartQtySheet(productId) {
  if (state.user && needsSalonBinding()) {
    showToast('먼저 살롱 VIP에 입장해 주세요', 'error');
    navigate('entry');
    return;
  }
  const p = findCatalogProduct(productId);
  if (!p) { showToast('상품을 찾을 수 없습니다', 'error'); return; }
  state.cartAddedSheet = null;
  state.cartQtySheet = { productId: Number(p.id), qty: 0 };
  render();
}

function closeCartQtySheet() {
  state.cartQtySheet = null;
  render();
}

function changeCartQtySheet(delta) {
  if (!state.cartQtySheet) return;
  const next = Math.max(0, Math.min(99, Number(state.cartQtySheet.qty || 0) + delta));
  state.cartQtySheet.qty = next;
  render();
}

function confirmCartQtySheet() {
  if (!state.cartQtySheet || Number(state.cartQtySheet.qty) < 1) return;
  const productId = state.cartQtySheet.productId;
  const qty = Number(state.cartQtySheet.qty);
  const p = findCatalogProduct(productId);
  addToCart(productId, qty, { silent: true });
  state.cartQtySheet = null;
  state.cartAddedSheet = p ? {
    productId: Number(p.id),
    brandName: productBrandName(p),
    brandId: Number(p.brand_id) || 0,
  } : null;
  render();
}

function closeCartAddedSheet() {
  state.cartAddedSheet = null;
  render();
}

function goCartFromAddedSheet() {
  state.cartAddedSheet = null;
  openCart();
}

function openBrandFromAddedSheet(brandId) {
  const id = Number(brandId) || 0;
  state.cartAddedSheet = null;
  state.selectedBrandId = id;
  navigate('shop');
}

function brandOtherProducts(productId, brandId, limit) {
  const pid = Number(productId);
  const bid = Number(brandId);
  return (state.products || [])
    .filter((p) => p && Number(p.id) !== pid && (!bid || Number(p.brand_id) === bid))
    .slice(0, limit || 8);
}

function renderCartRecoCard(p) {
  const deal = maxDiscountBreakdown(p);
  const brand = productBrandName(p);
  const original = Number(p.original_price || 0);
  const sale = Number(deal.sale || p.vip_price || 0);
  const rate = original > sale && original > 0 ? Math.round((1 - sale / original) * 100) : 0;
  return `
    <button type="button" class="cart-reco-card" onclick="closeCartAddedSheet(); openProductDetail(${p.id})">
      <img class="cart-reco-img" src="${p.image_url || ORDER_FALLBACK_IMG}" alt=""
           onerror="this.src='${ORDER_FALLBACK_IMG}'">
      <div class="cart-reco-brand">${escText(brand)}</div>
      <div class="cart-reco-name">${escText(p.name)}</div>
      <div class="cart-reco-price-row">
        ${original > sale ? `<span class="cart-reco-old">${original.toLocaleString()}원</span>` : ''}
        ${rate ? `<span class="cart-reco-rate">${rate}%</span>` : ''}
        <span class="cart-reco-now">${sale.toLocaleString()}원</span>
      </div>
    </button>`;
}

function renderCartQtySheet() {
  const sheet = state.cartQtySheet;
  if (!sheet) return '';
  const p = findCatalogProduct(sheet.productId);
  if (!p) return '';
  const deal = maxDiscountBreakdown(p, {
    interactive: state.currentPage === 'product' && Number(state.selectedProductId) === Number(p.id),
  });
  const qty = Number(sheet.qty || 0);
  const canAdd = qty >= 1;
  return `
    <div class="cart-sheet-overlay" onclick="closeCartQtySheet()">
      <div class="cart-sheet" onclick="event.stopPropagation()">
        <div class="cart-sheet-handle"></div>
        <div class="cart-qty-head">
          <img class="cart-qty-thumb" src="${p.image_url || ORDER_FALLBACK_IMG}" alt=""
               onerror="this.src='${ORDER_FALLBACK_IMG}'">
          <div class="cart-qty-meta">
            <div class="cart-qty-brand">${escText(productBrandName(p))}</div>
            <div class="cart-qty-name">${escText(p.name)}</div>
            <div class="cart-qty-price">${deal.maxPrice.toLocaleString()}원</div>
          </div>
        </div>
        <div class="cart-qty-row">
          <span class="cart-qty-label">수량</span>
          <div class="qty-stepper cart-qty-stepper">
            <button type="button" class="qty-btn" onclick="changeCartQtySheet(-1)" ${qty <= 0 ? 'disabled' : ''}>−</button>
            <span class="qty-val">${qty}</span>
            <button type="button" class="qty-btn" onclick="changeCartQtySheet(1)">+</button>
          </div>
        </div>
        <button type="button" class="btn-primary cart-sheet-add${canAdd ? '' : ' is-disabled'}"
          ${canAdd ? `onclick="confirmCartQtySheet()"` : 'disabled'}>
          ${canAdd ? `장바구니 담기 · ${(deal.maxPrice * qty).toLocaleString()}원` : '수량을 선택해 주세요'}
        </button>
      </div>
    </div>
  `;
}

function renderCartAddedSheet() {
  const sheet = state.cartAddedSheet;
  if (!sheet) return '';
  const brandName = sheet.brandName || '브랜드';
  const others = brandOtherProducts(sheet.productId, sheet.brandId, 8);
  return `
    <div class="cart-sheet-overlay" onclick="closeCartAddedSheet()">
      <div class="cart-sheet cart-added-sheet" onclick="event.stopPropagation()">
        <div class="cart-sheet-handle"></div>
        <div class="cart-added-banner">
          <div class="cart-added-ico" aria-hidden="true">
            <i class="fas fa-shopping-bag"></i>
            <span class="cart-added-check"><i class="fas fa-check"></i></span>
          </div>
          <div class="cart-added-text">장바구니에 상품이 담겼습니다.</div>
          <button type="button" class="cart-added-link" onclick="goCartFromAddedSheet()">장바구니 <i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="cart-reco-head">
          <div class="cart-reco-title">${escText(brandName)}의 다른 제품</div>
          ${sheet.brandId ? `<button type="button" class="cart-reco-more" onclick="openBrandFromAddedSheet(${sheet.brandId})">더보기 <i class="fas fa-chevron-right"></i></button>` : ''}
        </div>
        <div class="cart-reco-rail">
          ${others.length
            ? others.map((p) => renderCartRecoCard(p)).join('')
            : `<div class="cart-reco-empty">같은 브랜드의 다른 상품이 없습니다</div>`}
        </div>
      </div>
    </div>
  `;
}

function renderProductPage() {
  const p = findCatalogProduct(state.selectedProductId);
  if (!p) {
    return `<div style="padding:40px 24px;text-align:center">
      <p style="color:var(--muted);margin-bottom:16px">상품을 찾을 수 없습니다</p>
      <button class="btn-primary" style="width:auto;padding:12px 24px" onclick="navigate('home')">홈으로</button>
    </div>`;
  }
  const brand = productBrandName(p);
  const deal = maxDiscountBreakdown(p, { interactive: true });
  const wished = isWishlisted(p.id);
  return `
    <div class="pd-page">
      <div class="pd-topbar">
        <button type="button" class="pd-back" onclick="closeProductPage()" aria-label="뒤로">
          <i class="fas fa-chevron-left"></i>
        </button>
        <div class="pd-topbar-title">상품 상세</div>
        <button type="button" class="pd-wish-top${wished ? ' on' : ''}" onclick="toggleWishlist(${p.id})" aria-label="찜">
          <i class="${wished ? 'fas' : 'far'} fa-heart"></i>
        </button>
      </div>
      <div class="pd-hero">
        <img src="${p.image_url || 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80'}"
             alt="${escText(p.name)}"
             onerror="this.src='https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80'">
      </div>
      <div class="pd-body">
        <div class="pd-crumb">${escText(brand)} &gt; ${escText(p.category || '')}</div>
        <h1 class="pd-title">${escText(p.name)}</h1>
        <div class="pd-sale">${deal.sale.toLocaleString()}원</div>
        ${renderMaxDiscountBox(p, deal)}
        <div class="pd-ship">${escText(freeShipHint(p))}</div>
        <div class="pd-desc">${escText(p.description || '')}</div>
        ${(p.detail_image_urls || []).map((src) =>
          `<img class="pd-detail-img" src="${String(src).replace(/"/g, '&quot;')}" alt="">`
        ).join('')}
        <div class="pd-meta">
          <span>${p.stock_quantity >= 9999 ? '재고 있음' : '재고 ' + p.stock_quantity + '개'}</span>
          <span>보유 포인트 ${(Number(state.user && state.user.points) || 0).toLocaleString()}P</span>
        </div>
      </div>
      <div class="pd-bottom-bar">
        <button class="btn-primary" onclick="openCartQtySheet(${p.id})">
          <i class="fas fa-shopping-bag"></i> 장바구니 담기 · ${deal.maxPrice.toLocaleString()}원
        </button>
      </div>
    </div>
  `;
}

function closeModal() {
  if (window.__modal) {
    window.__modal.remove();
    window.__modal = null;
  }
}

function addToCart(productId, qtyOrOpts, maybeOpts) {
  if (state.user && needsSalonBinding()) {
    showToast('먼저 살롱 VIP에 입장해 주세요', 'error');
    navigate('entry');
    return;
  }
  const p = findCatalogProduct(productId);
  if (!p) return;
  let qty = 1;
  let opts = {};
  if (typeof qtyOrOpts === 'object' && qtyOrOpts) opts = qtyOrOpts;
  else if (qtyOrOpts != null) qty = Math.max(1, Number(qtyOrOpts) || 1);
  if (maybeOpts) opts = maybeOpts;
  const fromDetail = state.currentPage === 'product' && Number(state.selectedProductId) === Number(productId);
  const deal = maxDiscountBreakdown(p, { interactive: fromDetail });
  const existing = state.cart.find(i => i.product_id === productId);
  if (existing) {
    existing.qty += qty;
    existing.price = deal.maxPrice;
    existing.coupon_id = deal.useCoupon && deal.coupon ? deal.coupon.id : null;
    existing.coupon_discount = deal.couponAmt || 0;
    existing.points_used = deal.pointsAmt || 0;
  } else {
    state.cart.push({
      product_id: p.id,
      name: p.name,
      price: deal.maxPrice,
      qty,
      coupon_id: deal.useCoupon && deal.coupon ? deal.coupon.id : null,
      coupon_discount: deal.couponAmt || 0,
      points_used: deal.pointsAmt || 0,
    });
  }
  if (!opts.silent) {
    render();
    showToast('장바구니에 담겼습니다', 'success');
  }
}

function updateCartQty(productId, delta) {
  const item = state.cart.find(i => i.product_id === productId);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) state.cart = state.cart.filter(i => i.product_id !== productId);
  }
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
  const couponDiscount = state.cart.reduce((s, i) => s + (Number(i.coupon_discount) || 0), 0);
  const pointsUsed = state.cart.reduce((s, i) => s + (Number(i.points_used) || 0), 0);
  const couponId = (state.cart.find((i) => i.coupon_id) || {}).coupon_id || null;
  const res = await api('/api/orders', 'POST', {
    user_id: state.user.id,
    shipping_address: state.user.shipping_address,
    coupon_id: couponId,
    coupon_discount: couponDiscount,
    points_used: pointsUsed,
    items: state.cart.map((i) => ({
      product_id: i.product_id,
      qty: i.qty,
      price: i.price,
      coupon_discount: Number(i.coupon_discount) || 0,
      points_used: Number(i.points_used) || 0,
    })),
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
    const err = String(res.error || '');
    if (/담당자/.test(err)) {
      // 결제 PG 미연동 데모: 담당자 관련 문구는 고객에게 보여 주지 않음
      showToast('결제 연동 준비 중입니다', 'error');
      return;
    }
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

function findOrderById(id) {
  return state.orders.find((x) => Number(x.id) === Number(id))
    || (state.storeOrders || []).find((x) => Number(x.id) === Number(id))
    || null;
}

function orderShippingLabel(status) {
  const map = { READY: '상품준비중', SHIPPING: '배송중', DELIVERED: '배송완료', CANCELLED: '취소' };
  return map[status] || status || '상품준비중';
}

function orderPaymentLabel(status) {
  const map = { PAID: '결제완료', PENDING: '결제대기', CANCELLED: '취소됨', REFUNDED: '환불됨' };
  return map[status] || status || '-';
}

/** 목록·상세 공통 배지 (결제/배송이 따로 놀지 않게) */
function orderStatusBadge(o) {
  if (!o) return { label: '-', cls: 'PENDING' };
  const pay = o.payment_status || 'PENDING';
  const ship = o.shipping_status || 'READY';
  if (pay === 'CANCELLED' || pay === 'REFUNDED') {
    return { label: orderPaymentLabel(pay), cls: pay };
  }
  if (o.cancel_requested && ship === 'READY') {
    return { label: '취소요청중', cls: 'PENDING' };
  }
  if (ship === 'DELIVERED') return { label: '배송완료', cls: 'PAID' };
  if (ship === 'SHIPPING') return { label: '배송중', cls: 'PAID' };
  if (pay === 'PAID') return { label: '결제완료', cls: 'PAID' };
  return { label: orderPaymentLabel(pay), cls: pay };
}

function orderDesignerLabel(o) {
  if (o && o.designer_name) return o.designer_name;
  if (state.user && Number(state.user.id) === Number(o && o.user_id) && state.user.designer_name) {
    return state.user.designer_name;
  }
  return '';
}

function canRequestOrderCancel(o) {
  if (!o) return false;
  if (o.payment_status === 'CANCELLED' || o.payment_status === 'REFUNDED') return false;
  if (o.cancel_requested) return false;
  const ship = o.shipping_status || 'READY';
  return ship === 'READY';
}

async function requestOrderCancel(orderId) {
  if (!state.user) return;
  if (!confirm('이 주문의 취소를 요청할까요?')) return;
  const res = await api('/api/orders/' + orderId + '/cancel-request', 'POST', { user_id: state.user.id });
  if (!res.success) {
    showToast(res.error || '취소 요청에 실패했습니다', 'error');
    return;
  }
  const idx = state.orders.findIndex((o) => Number(o.id) === Number(orderId));
  if (idx >= 0) state.orders[idx] = res.data;
  else state.orders.unshift(res.data);
  render();
  showToast(res.message || '취소 요청이 접수되었습니다', 'success');
}

const ORDER_FALLBACK_IMG = 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&q=80';

function orderItemImage(item) {
  const product = item && item.product_id != null ? findCatalogProduct(item.product_id) : null;
  return (product && product.image_url) || ORDER_FALLBACK_IMG;
}

function openProductFromOrder(productId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const id = Number(productId);
  if (!id || !findCatalogProduct(id)) {
    showToast('상품을 찾을 수 없습니다', 'error');
    return;
  }
  openProductDetail(id);
}

function renderOrderCard(o) {
  const items = JSON.parse(o.order_items || '[]');
  const badge = orderStatusBadge(o);
  const couponDisc = Number(o.coupon_discount || 0);
  const pointsUsed = Number(o.points_used || 0);
  const shown = items.slice(0, 3);
  const extra = Math.max(0, items.length - shown.length);
  return `
    <div class="order-card">
      <div class="order-card-top">
        <span style="font-size:11px;color:var(--muted)">#${o.id} · ${new Date(o.created_at).toLocaleDateString('ko-KR')}</span>
        <span class="order-status-badge status-${badge.cls}">${escText(badge.label)}</span>
      </div>
      <div class="order-product-list">
        ${shown.length ? shown.map((i) => {
          const pid = Number(i.product_id) || 0;
          const img = orderItemImage(i);
          const clickable = pid ? `onclick="openProductFromOrder(${pid}, event)"` : '';
          return `
          <div class="order-product-row${pid ? ' is-link' : ''}" ${clickable}>
            <img class="order-thumb" src="${img}" alt="" onerror="this.src='${ORDER_FALLBACK_IMG}'">
            <div class="order-product-meta">
              <div class="order-product-title">${escText(i.name || '상품')}</div>
              <div class="order-product-qty">수량 ${Number(i.qty || 0)}개</div>
            </div>
          </div>`;
        }).join('') : `<div class="order-product-title">상품 정보 없음</div>`}
        ${extra ? `<div class="order-product-extra">외 ${extra}건</div>` : ''}
      </div>
      <div class="order-salon-sub">${escText(o.salon_name || '')}${orderDesignerLabel(o) ? ' · ' + escText(orderDesignerLabel(o)) : ''}</div>
      <div class="order-meta-line">
        ${escText(orderPaymentLabel(o.payment_status))} · ${escText(orderShippingLabel(o.shipping_status))}
        ${couponDisc ? ` · 쿠폰 -${couponDisc.toLocaleString()}원` : ''}
        ${pointsUsed ? ` · 포인트 -${pointsUsed.toLocaleString()}P` : ''}
      </div>
      ${o.points_earned ? `<div class="order-points">+${Number(o.points_earned).toLocaleString()}P 적립</div>` : ''}
      <div class="order-footer">
        <span style="font-size:12px;color:var(--muted)">총 ${items.reduce((s,i)=>s+i.qty,0)}개</span>
        <span class="order-amount">${(o.total_amount||0).toLocaleString()}원</span>
      </div>
      <button type="button" class="order-detail-btn" onclick="openOrderDetail(${o.id})">주문상세</button>
    </div>`;
}

function openOrderDetail(id) {
  const o = findOrderById(id);
  if (!o) { showToast('주문을 찾을 수 없습니다', 'error'); return; }
  if (state.currentPage !== 'order-detail') state.orderBackPage = state.currentPage || 'orders';
  state.selectedOrderId = Number(id);
  navigate('order-detail');
}

function closeOrderDetailPage() {
  const back = state.orderBackPage || 'orders';
  state.selectedOrderId = null;
  navigate(back === 'order-detail' ? 'orders' : back);
}

function maskPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length < 10) return phone || '-';
  return d.slice(0, 3) + '-' + d.slice(3, 4) + '***-' + d.slice(-4, -3) + '***';
}

function formatOrderDateShort(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return (d.getMonth() + 1) + '. ' + d.getDate() + '. (' + week + ')';
}

function copyOrderNo(orderNo) {
  const text = String(orderNo || '');
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('주문번호가 복사되었습니다', 'success'))
      .catch(() => showToast(text, 'success'));
    return;
  }
  showToast(text, 'success');
}

function toggleOrderPayOpen() {
  state.orderPayOpen = !state.orderPayOpen;
  render();
}

function renderOrderDetailPage() {
  const o = findOrderById(state.selectedOrderId);
  if (!o) {
    return `<div style="padding:40px 24px;text-align:center">
      <p style="color:var(--muted);margin-bottom:16px">주문을 찾을 수 없습니다</p>
      <button class="btn-primary" style="width:auto;padding:12px 24px" onclick="navigate('orders')">주문 목록</button>
    </div>`;
  }
  const items = JSON.parse(o.order_items || '[]');
  const money = orderMoney(o);
  const isOwner = !!(state.user && state.user.is_owner);
  const designerName = orderDesignerLabel(o);
  const badge = orderStatusBadge(o);
  const shipAddr = o.shipping_address
    || (state.user && Number(state.user.id) === Number(o.user_id) ? state.user.shipping_address : '')
    || '';
  const shipName = o.shipping_name
    || (state.user && Number(state.user.id) === Number(o.user_id) ? state.user.name : '')
    || '';
  const shipPhone = o.shipping_phone
    || (state.user && Number(state.user.id) === Number(o.user_id) ? state.user.phone : '')
    || '';
  const couponDisc = Number(o.coupon_discount || money.coupon || 0);
  const pointsUsed = Number(o.points_used || 0);
  const paidAmount = Math.max(0, Number(o.total_amount || 0));
  const goodsAmount = Math.max(paidAmount + couponDisc + pointsUsed,
    items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0));
  const pointsEarned = Number(o.points_earned || 0);
  const canCancel = canRequestOrderCancel(o);
  const orderNo = String(o.id);
  const payOpen = state.orderPayOpen !== false;

  return `
    <div class="od-page od-page-ref">
      <div class="od-topbar od-topbar-ref">
        <div class="od-topbar-title">주문 상세정보</div>
        <button type="button" class="od-close" onclick="closeOrderDetailPage()" aria-label="닫기">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="od-body od-body-ref">
        <div class="od-main-card">
          <div class="od-status-row">
            <span class="od-status-text">${escText(badge.label)}</span>
            <span class="od-status-sub">${escText(formatOrderDateShort(o.created_at))} · ${escText(orderShippingLabel(o.shipping_status))}</span>
          </div>
          ${items.map((i) => {
            const product = findCatalogProduct(i.product_id);
            const img = orderItemImage(i);
            const line = (Number(i.price) || 0) * (Number(i.qty) || 0);
            const original = product ? Number(product.original_price || 0) * (Number(i.qty) || 0) : 0;
            const pid = Number(i.product_id) || 0;
            const openAttr = pid ? `onclick="openProductFromOrder(${pid}, event)"` : '';
            return `
            <div class="od-product-row${pid ? ' is-link' : ''}">
              <img class="od-thumb" src="${img}" alt="" ${openAttr} onerror="this.src='${ORDER_FALLBACK_IMG}'">
              <div class="od-product-meta">
                <div class="od-product-name"${openAttr}>${escText(i.name || '상품')}</div>
                <div class="od-qty-chip">수량 ${Number(i.qty || 0)}개</div>
                <div class="od-price-row">
                  <span class="od-price-now">${line.toLocaleString()}원</span>
                  ${original > line ? `<span class="od-price-old">${original.toLocaleString()}원</span>` : ''}
                </div>
                <div class="od-orderno">
                  주문번호 : ${escText(orderNo)}
                  <button type="button" class="od-copy" onclick="copyOrderNo('${escText(orderNo)}')">복사</button>
                </div>
              </div>
            </div>`;
          }).join('') || `<div class="profile-coupon-empty">상품 정보가 없습니다</div>`}
          <div class="od-store-line">${escText(o.salon_name || '')}${designerName ? ' · 담당 ' + escText(designerName) : ''}</div>
          ${canCancel ? `
          <button type="button" class="od-cancel-soft" onclick="requestOrderCancel(${o.id})">취소요청</button>
          ` : (o.cancel_requested ? `<div class="od-cancel-note">취소 요청이 접수되었습니다</div>` : '')}
        </div>

        <div class="od-section-title">배송지</div>
        <div class="od-ship-card">
          <div class="od-ship-top">
            <div class="od-ship-name">${escText(shipName || '-')}</div>
            ${canCancel ? `<button type="button" class="od-change-btn" onclick="navigate('profile'); openProfileInfo()">변경</button>` : ''}
          </div>
          <div class="od-ship-phone">${escText(maskPhone(shipPhone))}</div>
          <div class="od-ship-addr">${escText(shipAddr || '배송지 정보가 없습니다')}</div>
        </div>

        <button type="button" class="od-section-title od-pay-toggle" onclick="toggleOrderPayOpen()">
          <span>결제정보</span>
          <i class="fas fa-chevron-${payOpen ? 'up' : 'down'}"></i>
        </button>
        ${payOpen ? `
        <div class="od-pay-card">
          <div class="od-pay-summary">
            <span>주문금액</span>
            <span>총 ${paidAmount.toLocaleString()}원</span>
          </div>
          <div class="od-pay-lines">
            <div class="od-pay-line"><span>상품금액</span><span>${goodsAmount.toLocaleString()}원</span></div>
            <div class="od-pay-line"><span>쿠폰할인</span><span>${couponDisc ? '-' + couponDisc.toLocaleString() + '원' : '0원'}</span></div>
            <div class="od-pay-line"><span>포인트사용</span><span>${pointsUsed ? '-' + pointsUsed.toLocaleString() + 'P' : '0P'}</span></div>
            <div class="od-pay-line"><span>배송비</span><span>무료</span></div>
          </div>
          <div class="od-pay-method">
            <span>${escText(orderPaymentLabel(o.payment_status))}</span>
            <span>${paidAmount.toLocaleString()}원</span>
          </div>
          <div class="od-pay-earn">구매 적립 +${pointsEarned.toLocaleString()}P</div>
        </div>` : ''}

        ${isOwner && o.payment_status === 'PAID' ? `
        <div class="od-section-title">정산 정보</div>
        <div class="od-pay-card">
          <div class="od-pay-summary"><span>정산액</span><span>${won(money.storePayout)}</span></div>
          <div class="od-pay-lines">
            <div class="od-pay-line"><span>총매출</span><span>${won(money.sale)}</span></div>
            <div class="od-pay-line"><span>쿠폰</span><span>${won(money.coupon)}</span></div>
          </div>
        </div>` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// PROFILE PAGE
// ============================================================
function phoneDigitsLocal(value) {
  return String(value || '').replace(/\D/g, '');
}

function userOwnedCoupons() {
  const ids = new Set(userHeldCouponIds());
  return (state.coupons || [])
    .filter((c) => c && c.status === 'ACTIVE' && ids.has(Number(c.id)))
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
}

function couponValueLabel(coupon) {
  if (!coupon) return '';
  if (coupon.discount_type === 'RATE') return Number(coupon.discount_value || 0) + '% 할인';
  return Number(coupon.discount_value || 0).toLocaleString() + '원 할인';
}

function openProfileInfo() {
  state.profileInfoOpen = true;
  state.profileEditing = false;
  state.profilePhoneVerified = false;
  state.profileOtpSent = false;
  render();
  window.scrollTo(0, 0);
}

function closeProfileInfo() {
  state.profileInfoOpen = false;
  state.profileEditing = false;
  state.profilePhoneVerified = false;
  state.profileOtpSent = false;
  render();
}

function startProfileEdit() {
  state.profileInfoOpen = true;
  state.profileEditing = true;
  state.profilePhoneVerified = false;
  state.profileOtpSent = false;
  render();
}

function cancelProfileEdit() {
  state.profileEditing = false;
  state.profilePhoneVerified = false;
  state.profileOtpSent = false;
  render();
}

function renderProfileInfoPanel(u) {
  const ship = String(u.shipping_address || '');
  const editing = !!state.profileEditing;
  return `
    <div class="info-card${editing ? ' setup-form' : ''}" style="padding-bottom:16px">
      <div class="info-card-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span>정보관리</span>
        <div style="display:flex;align-items:center;gap:6px">
          ${editing ? '' : `<button type="button" class="profile-edit-btn" onclick="startProfileEdit()">수정</button>`}
          <button type="button" class="profile-edit-btn" onclick="closeProfileInfo()">닫기</button>
        </div>
      </div>
      <div style="padding:12px 16px 0">
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--light);border-radius:12px;margin-bottom:12px">
          <div style="width:42px;height:42px;background:var(--primary);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-scissors" style="color:var(--accent);font-size:16px"></i>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text)">${escText(u.salon_name || '미등록')}</div>
            <div style="font-size:12px;color:var(--muted)">담당 · ${escText(u.designer_name || '없음')}</div>
          </div>
        </div>
      </div>
      ${editing ? `
      <div style="padding:0 16px 4px">
        <label class="form-label">이름</label>
        <input id="profile-name" class="form-input" type="text" value="${escText(u.name || '')}">
        <label class="form-label">휴대폰번호</label>
        <div class="otp-row">
          <input id="profile-phone" class="form-input" type="tel" value="${escText(u.phone || '')}"
            oninput="onProfilePhoneInput()">
          <button type="button" class="btn-secondary otp-send-btn" onclick="sendProfileOtp()">인증요청</button>
        </div>
        <label class="form-label">인증번호</label>
        <div class="otp-row">
          <input id="profile-otp" class="form-input" type="tel" inputmode="numeric" maxlength="4" placeholder="번호 변경 시에만">
          <button type="button" class="btn-secondary otp-send-btn" onclick="verifyProfileOtp()">확인</button>
        </div>
        <p id="profile-otp-hint" class="code-hint">${state.profilePhoneVerified ? '휴대폰 인증 완료' : (state.profileOtpSent ? '인증번호를 입력하세요' : '번호 변경 시에만 인증하세요')}</p>
        <label class="form-label">배송주소</label>
        <div class="address-search-row">
          <input id="profile-address" class="form-input" value="${escText(ship)}" readonly
            placeholder="주소 검색을 눌러주세요"
            onclick="openAddressSearch('profile-address','profile-address-detail')">
          <button type="button" class="btn-secondary address-search-btn" onclick="openAddressSearch('profile-address','profile-address-detail')">주소 검색</button>
        </div>
        <input id="profile-address-detail" class="form-input" type="text" style="margin-top:8px"
          placeholder="상세주소 (동·호수 등)">
        <div class="info-row" style="padding-left:0;padding-right:0;border-bottom:none;margin-top:8px"><span>가입일</span><span>${u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}</span></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button type="button" class="btn-secondary" style="flex:1" onclick="cancelProfileEdit()">취소</button>
          <button type="button" class="btn-primary" style="flex:1.4;margin:0" onclick="saveProfileInfo()">저장</button>
        </div>
      </div>
      ` : `
      <div class="info-row"><span>이름</span><span>${escText(u.name || '-')}</span></div>
      <div class="info-row"><span>전화번호</span><span>${escText(u.phone || '-')}</span></div>
      <div class="info-row"><span>배송주소</span><span style="text-align:right;max-width:62%">${escText(ship || '-')}</span></div>
      <div class="info-row" style="border-bottom:none"><span>가입일</span><span>${u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}</span></div>
      `}
    </div>
  `;
}

function renderProfile() {
  if (!state.user) return `<div style="padding:24px">${renderLoginPrompt()}</div>`;
  const u = state.user;
  const points = Number(u.points || 0);
  const coupons = userOwnedCoupons();
  const recentOrders = (state.orders || []).slice(0, 5);

  return `
    <div class="profile-top">
      <div class="profile-top-name">${escText(u.name)}님</div>
      <button type="button" class="profile-info-btn" onclick="openProfileInfo()">정보관리</button>
    </div>
    <div class="profile-top-sub">
      <span class="profile-vip-chip"><i class="fas fa-crown" style="margin-right:4px"></i>VIP 멤버</span>
      <span class="profile-top-salon">${escText(u.salon_name || '매장 미등록')}${u.designer_name ? ' · ' + escText(u.designer_name) : ''}</span>
    </div>

    ${state.profileInfoOpen ? renderProfileInfoPanel(u) : ''}

    <div class="info-card">
      <div class="info-card-header profile-section-title">보유 혜택</div>
      <div class="profile-benefit-grid">
        <div class="profile-benefit-card">
          <div class="profile-benefit-label"><i class="fas fa-coins" style="margin-right:6px"></i>보유 포인트</div>
          <div class="profile-benefit-value">${points.toLocaleString()}<span>P</span></div>
        </div>
        <div class="profile-benefit-card">
          <div class="profile-benefit-label"><i class="fas fa-ticket-alt" style="margin-right:6px"></i>보유 쿠폰</div>
          <div class="profile-benefit-value">${coupons.length}<span>장</span></div>
        </div>
      </div>
      <div class="profile-coupon-list">
        ${coupons.length === 0
          ? `<div class="profile-coupon-empty">보유 중인 쿠폰이 없습니다</div>`
          : coupons.map((c) => `
            <div class="profile-coupon-item">
              <div>
                <div class="profile-coupon-name">${escText(c.name)}</div>
                <div class="profile-coupon-meta">${escText(couponValueLabel(c))}${c.ends_at ? ' · ~' + escText(c.ends_at) : ''}</div>
              </div>
              <div class="profile-coupon-badge">사용가능</div>
            </div>`).join('')}
      </div>
    </div>

    <div class="info-card" style="padding-bottom:8px">
      <div class="info-card-header profile-section-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span>주문/배송내역</span>
        <button type="button" class="profile-edit-btn" onclick="navigate('orders')">전체보기</button>
      </div>
      <div class="profile-order-list">
        ${recentOrders.length === 0
          ? `<div class="profile-coupon-empty">주문/배송 내역이 없습니다</div>`
          : recentOrders.map((o) => renderOrderCard(o)).join('')}
      </div>
    </div>

    <div style="padding:0 16px 100px">
      ${!u.is_owner && !u.is_staff && !u.current_salon_id ? `
      <button class="btn-secondary" style="margin-bottom:10px" onclick="navigate('entry')">
        <i class="fas fa-store" style="margin-right:8px"></i>살롱 VIP 입장하기
      </button>` : ''}
      <button onclick="handleLogout()" style="width:100%;background:none;border:1.5px solid #fee2e2;border-radius:14px;padding:14px;color:#dc2626;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:0.3px">
        <i class="fas fa-sign-out-alt" style="margin-right:8px"></i>로그아웃
      </button>
    </div>
  `;
}

function onProfilePhoneInput() {
  state.profilePhoneVerified = false;
  state.profileOtpSent = false;
  const hint = document.getElementById('profile-otp-hint');
  if (hint) hint.textContent = '번호 변경 시에만 인증하세요';
}

async function sendProfileOtp() {
  const phone = ((document.getElementById('profile-phone') || {}).value || '').trim();
  if (!phone) { showToast('휴대폰번호를 입력해주세요', 'error'); return; }
  const res = await api('/api/auth/otp/send', 'POST', { phone });
  if (!res.success) {
    showToast(res.error || '인증번호 발송 실패', 'error');
    return;
  }
  state.profileOtpSent = true;
  state.profilePhoneVerified = false;
  const hint = document.getElementById('profile-otp-hint');
  if (hint) hint.textContent = res.demo_code ? `데모 인증번호: ${res.demo_code}` : '인증번호를 입력하세요';
  showToast(res.demo_code ? `데모 인증번호 ${res.demo_code}` : (res.message || '인증번호를 발송했습니다'), 'success');
}

async function verifyProfileOtp() {
  const phone = ((document.getElementById('profile-phone') || {}).value || '').trim();
  const code = ((document.getElementById('profile-otp') || {}).value || '').trim();
  if (!phone || !code) { showToast('휴대폰번호와 인증번호를 입력하세요', 'error'); return; }
  const res = await api('/api/auth/otp/verify', 'POST', { phone, code });
  if (!res.success) {
    state.profilePhoneVerified = false;
    showToast(res.error || '인증 실패', 'error');
    return;
  }
  state.profilePhoneVerified = true;
  const hint = document.getElementById('profile-otp-hint');
  if (hint) hint.textContent = '휴대폰 인증 완료';
  showToast(res.message || '휴대폰 인증이 완료되었습니다', 'success');
}

async function saveProfileInfo() {
  if (!state.user) return;
  const name = ((document.getElementById('profile-name') || {}).value || '').trim();
  const phone = ((document.getElementById('profile-phone') || {}).value || '').trim();
  const base = ((document.getElementById('profile-address') || {}).value || '').trim();
  const detail = ((document.getElementById('profile-address-detail') || {}).value || '').trim();
  const shipping = joinAddress(base, detail) || base;
  if (!name) { showToast('이름을 입력해주세요', 'error'); return; }
  if (!phone) { showToast('휴대폰번호를 입력해주세요', 'error'); return; }
  if (!shipping) { showToast('배송주소를 입력해주세요', 'error'); return; }
  const phoneChanged = phoneDigitsLocal(phone) !== phoneDigitsLocal(state.user.phone);
  if (phoneChanged && !state.profilePhoneVerified) {
    showToast('휴대폰 번호 변경 시 문자 인증을 완료해주세요', 'error');
    return;
  }
  const res = await api('/api/users/' + state.user.id, 'PUT', {
    name,
    phone,
    shipping_address: shipping,
  });
  if (!res.success) {
    showToast(res.error || '저장하지 못했습니다', 'error');
    return;
  }
  saveUser(res.data);
  state.profilePhoneVerified = false;
  state.profileOtpSent = false;
  state.profileEditing = false;
  state.profileInfoOpen = true;
  render();
  showToast(res.message || '회원 정보를 저장했습니다', 'success');
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
    const [salonsRes, allRes, productsRes, bestRes, brandsRes, bannersRes, couponsRes] = await Promise.all([
      api('/api/salons'),
      api('/api/products'),
      api('/api/products' + salonQuery),
      api('/api/products' + bestQuery),
      api('/api/brands'),
      api('/api/banners'),
      api('/api/coupons'),
    ]);
    if (salonsRes.success) state.salons = salonsRes.data;
    if (allRes.success) state.allProducts = allRes.data;
    if (productsRes.success) state.products = productsRes.data;
    if (bestRes.success) state.bestProducts = bestRes.data;
    if (brandsRes.success) state.brands = brandsRes.data;
    if (bannersRes.success) state.banners = bannersRes.data;
    if (couponsRes.success) state.coupons = couponsRes.data;
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
      bank_account: salon.bank_account || '',
    };
  } else {
    // 서버에 상세주소가 생겼는데 draft만 비어 있으면 채움 (입력 중이면 유지)
    if (!state.manageDraft.address_detail && addr.detail) {
      state.manageDraft.address_detail = addr.detail;
    }
    if (!state.manageDraft.address && addr.base) {
      state.manageDraft.address = addr.base;
    }
    if (!state.manageDraft.bank_account && salon.bank_account) {
      state.manageDraft.bank_account = salon.bank_account;
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
        <label class="form-label">정산 계좌번호</label>
        <input id="manage-bank-account" class="form-input" type="text"
          value="${escText(draft.bank_account || '')}"
          placeholder="예: 국민 123456-78-901234"
          oninput="updateManageField('bank_account', this.value)">
        <p style="font-size:12px;color:var(--muted);margin:6px 0 0">매출 정산을 받을 예금주·은행·계좌번호</p>
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
              <button type="button" class="ghost-text-btn resign-text-btn" onclick="askResignDesigner(${d.id})">퇴사처리</button>
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
    bank_account: String((document.getElementById('manage-bank-account') || {}).value || draft.bank_account || '').trim(),
  };
  if (!body.address) {
    showToast('주소 검색으로 매장 주소를 선택해주세요', 'error');
    return;
  }
  if (!body.bank_account) {
    showToast('정산 받을 계좌번호를 입력하세요', 'error');
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
    bank_account: saved.bank_account != null && String(saved.bank_account).length
      ? saved.bank_account
      : body.bank_account,
  };
  rememberSalon(merged);
  state.manageDraft = {
    salon_id: merged.id,
    salon_name: merged.salon_name || body.salon_name,
    owner_name: merged.owner_name || body.owner_name,
    owner_phone: merged.owner_phone || body.owner_phone,
    address: merged.address || '',
    address_detail: merged.address_detail || '',
    bank_account: merged.bank_account || '',
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

function askResignDesigner(id) {
  state.resignConfirmId = Number(id) || null;
  render();
}

function closeResignConfirm() {
  state.resignConfirmId = null;
  render();
}

function renderResignConfirm() {
  const id = Number(state.resignConfirmId || 0);
  if (!id) return '';
  const d = (state.manageDesigners || []).find((row) => Number(row.id) === id);
  const name = d ? String(d.designer_name || '').replace(' 디자이너', '') : '';
  return `
    <div class="confirm-overlay" onclick="closeResignConfirm()">
      <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="resign-confirm-title" onclick="event.stopPropagation()">
        <div class="confirm-ico" aria-hidden="true"><i class="fas fa-user-slash"></i></div>
        <h3 id="resign-confirm-title" class="confirm-title">담당자를 퇴사처리할까요?</h3>
        <p class="confirm-sub">삭제후에도 매출 내역은 남습니다</p>
        ${name ? `<p class="confirm-name">${escText(name)}</p>` : ''}
        <div class="confirm-actions">
          <button type="button" class="confirm-btn cancel" onclick="closeResignConfirm()">취소</button>
          <button type="button" class="confirm-btn danger" onclick="confirmResignDesigner()">퇴사처리</button>
        </div>
      </div>
    </div>
  `;
}

async function confirmResignDesigner() {
  const id = Number(state.resignConfirmId || 0);
  if (!id) return;
  state.resignConfirmId = null;
  const res = await api('/api/designers/' + id + '/resign', 'POST', {});
  if (!res.success) {
    render();
    showToast(res.error || '퇴사처리하지 못했습니다', 'error');
    return;
  }
  await loadManageDesigners();
  render();
  showToast('담당자를 퇴사처리했습니다', 'success');
}

async function resignDesigner(id) {
  askResignDesigner(id);
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
