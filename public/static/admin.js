// ============================================================
// SALON Admin Dashboard SPA
// ============================================================

const API = '';
let adminState = {
  page: 'dashboard',
  stats: null,
  salons: [],
  designers: [],
  users: [],
  products: [],
  orders: [],
  brands: [],
  coupons: [],
  points: [],
  banners: [],
  settlements: null,
  settlementMonth: '',
  settlementSalon: 'ALL',
  settlementQuery: '',
  settlementSelected: [],
  settlementDetail: '',
  orderQuery: '',
  orderBrand: 'ALL',
  orderPeriod: 'ALL',
  orderStart: '',
  orderEnd: '',
  orderShip: 'ALL',
  productQuery: '',
  productBrand: 'ALL',
  productStatuses: ['WAITING', 'SELLING', 'SOLDOUT', 'STOP'],
  productDeleted: false,
  productMarginSort: '',
  userQuery: '',
  userSalon: 'ALL',
  userOrderMin: '',
  userOrderMax: '',
  userAmountMin: '',
  userAmountMax: '',
  userPointPresence: 'ALL',
  userPointMin: '',
  userPointMax: '',
  userCouponPresence: 'ALL',
  userCouponId: '',
  pointsSection: 'grant',
  blockedProducts: [],
  loading: false,
  sidebarOpen: false,
  filters: { salon_id: '', status: '' }
};

// ---- API Helpers ----
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ---- Render ----
function renderAdmin() {
  const app = document.getElementById('admin-app');
  app.innerHTML = `
    <div class="sidebar-overlay ${adminState.sidebarOpen ? 'active' : ''}" onclick="toggleSidebar()"></div>
    ${renderSidebar()}
    <div class="main-content">
      ${renderTopbar()}
      <div class="page" id="admin-page">
        ${renderAdminPage()}
      </div>
    </div>
  `;
  attachAdminListeners();
}

function renderSidebar() {
  const navItems = [
    { id: 'dashboard', icon: 'fa-tachometer-alt', label: '대시보드', section: 'OVERVIEW' },
    { id: 'salons', icon: 'fa-store', label: '살롱 관리', section: null },
    { id: 'designers', icon: 'fa-cut', label: '디자이너 관리', section: null },
    { id: 'brands', icon: 'fa-tags', label: '브랜드 관리', section: 'COMMERCE' },
    { id: 'products', icon: 'fa-box', label: '상품 관리', section: null },
    { id: 'users', icon: 'fa-users', label: '고객 관리', section: null },
    { id: 'orders', icon: 'fa-truck', label: '주문/배송', section: null },
    { id: 'coupons', icon: 'fa-ticket-alt', label: '쿠폰 관리', section: null },
    { id: 'points', icon: 'fa-coins', label: '포인트 관리', section: null },
    { id: 'banners', icon: 'fa-image', label: '메인 배너', section: 'DISPLAY' },
    { id: 'mid-banners', icon: 'fa-panorama', label: '가로 배너', section: null },
    { id: 'settlements', icon: 'fa-file-invoice-dollar', label: '매출/정산', section: 'REPORTS' },
  ];

  return `
    <aside class="sidebar ${adminState.sidebarOpen ? 'open' : ''}">
      <div class="sidebar-logo">
        <h1>SALON <span>ADMIN</span></h1>
        <p>B2B2C Platform</p>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map(item => `
          ${item.section ? `<div class="nav-section">${item.section}</div>` : ''}
          <div class="nav-link ${adminState.page === item.id ? 'active' : ''}" onclick="navigateTo('${item.id}')">
            <i class="fas ${item.icon}"></i>
            ${item.label}
          </div>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <div>v1.0.0 · Salon Platform</div>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const titles = {
    dashboard: '대시보드',
    salons: '살롱 관리',
    designers: '디자이너 관리',
    users: '고객 관리',
    products: '상품 관리',
    orders: '주문/배송',
    brands: '브랜드 관리',
    coupons: '쿠폰 관리',
    points: '포인트 관리',
    banners: '메인 배너',
    'mid-banners': '가로 배너',
    settlements: '매출/정산',
    revenue: '수익 분석'
  };
  return `
    <header class="topbar">
      <div style="display:flex;align-items:center;gap:14px">
        <button class="sidebar-toggle" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
        <span class="topbar-title">${titles[adminState.page] || '대시보드'}</span>
      </div>
      <div class="topbar-actions">
        <div class="search-bar" style="min-width:200px">
          <i class="fas fa-search"></i>
          <input type="text" placeholder="검색...">
        </div>
        <div class="admin-badge"><i class="fas fa-user-shield"></i> Admin</div>
      </div>
    </header>
  `;
}

function toggleSidebar() {
  adminState.sidebarOpen = !adminState.sidebarOpen;
  renderAdmin();
}

async function navigateTo(page) {
  adminState.page = page;
  adminState.selectedBrandId = null;
  adminState.sidebarOpen = false;
  if (location.hash !== '#' + page) history.replaceState(null, '', '#' + page);
  renderAdmin();
  await loadPageData(page);
}

// ============================================================
// PAGE ROUTER
// ============================================================
function renderAdminPage() {
  switch(adminState.page) {
    case 'dashboard': return renderDashboard();
    case 'salons': return renderSalons();
    case 'designers': return renderDesigners();
    case 'users': return renderUsers();
    case 'products': return renderProducts();
    case 'orders': return renderShippingOrders();
    case 'brands': return renderBrands();
    case 'coupons': return renderCoupons();
    case 'points': return renderPoints();
    case 'banners': return renderBanners('MAIN');
    case 'mid-banners': return renderBanners('MID');
    case 'settlements': return renderStoreSettlements();
    case 'revenue': return renderRevenue();
    default: return renderDashboard();
  }
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const s = adminState.stats;
  const gmv = s?.total_gmv || 0;
  const platform = s?.platform_revenue || 0;
  const salonComm = s?.total_salon_commission || 0;
  const totalOrders = s?.total_orders || 0;

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card blue">
        <div class="stat-icon blue"><i class="fas fa-won-sign"></i></div>
        <div class="stat-value">${(gmv/10000).toFixed(1)}만</div>
        <div class="stat-label">총 거래액 (GMV)</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon red"><i class="fas fa-building"></i></div>
        <div class="stat-value">${(platform/10000).toFixed(1)}만</div>
        <div class="stat-label">플랫폼 수익 (40%)</div>
      </div>
      <div class="stat-card gold">
        <div class="stat-icon gold"><i class="fas fa-store"></i></div>
        <div class="stat-value">${(salonComm/10000).toFixed(1)}만</div>
        <div class="stat-label">원장 지급 (30%)</div>
      </div>
    </div>

    <div class="panel">
          <div class="panel-header">
            <span class="panel-title"><i class="fas fa-chart-bar"></i> 플랫폼 현황</span>
          </div>
          <div style="padding:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
            ${[
              {label:'총 살롱',val:adminState.salons.length,icon:'fa-store',color:'#3b82f6'},
              {label:'디자이너',val:adminState.designers.length,icon:'fa-cut',color:'#8b5cf6'},
              {label:'고객',val:adminState.users.length,icon:'fa-users',color:'#10b981'},
              {label:'총 주문',val:totalOrders,icon:'fa-receipt',color:'#f59e0b'},
            ].map(item => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f9fafb;border-radius:12px">
              <div style="width:36px;height:36px;border-radius:10px;background:${item.color}18;display:flex;align-items:center;justify-content:center">
                <i class="fas ${item.icon}" style="color:${item.color};font-size:15px"></i>
              </div>
              <div>
                <div style="font-size:18px;font-weight:400;color:#1a1a2e">${item.val}</div>
                <div style="font-size:11px;color:#6b7280">${item.label}</div>
              </div>
            </div>`).join('')}
          </div>
    </div>

    <!-- Salon Revenue Table -->
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title"><i class="fas fa-table"></i> 살롱별 수익 현황</span>
        <button class="btn btn-outline btn-sm" onclick="navigateTo('revenue')">전체 보기</button>
      </div>
      <div class="panel-body">
        <table class="data-table">
          <thead>
            <tr>
              <th>살롱명</th>
              <th>총 매출</th>
              <th>원장 지급 30%</th>
              <th>비중</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            ${(adminState.stats?.salonBreakdown || []).map(s => `
            <tr>
              <td><strong>${s.salon_name}</strong></td>
              <td style="font-weight:700;color:#1a1a2e">${(s.revenue||0).toLocaleString()}원</td>
              <td style="color:#d4af37;font-weight:600">${(s.commission||0).toLocaleString()}원</td>
              <td>
                <div style="width:100px;height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden">
                  <div style="width:${adminState.stats?.total_gmv > 0 ? Math.min(100, Math.round((s.revenue||0)/(adminState.stats.total_gmv)*100)) : 0}%;height:100%;background:#e94560;border-radius:3px"></div>
                </div>
              </td>
              <td><button class="btn btn-sm btn-outline" onclick="navigateTo('salons')">보기</button></td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:24px">데이터 없음</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Orders -->
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title"><i class="fas fa-clock"></i> 최근 주문</span>
        <button class="btn btn-outline btn-sm" onclick="navigateTo('orders')">전체 보기</button>
      </div>
      <div class="panel-body">
        <table class="data-table">
          <thead>
            <tr><th>주문 #</th><th>고객</th><th>살롱</th><th>디자이너</th><th>금액</th><th>상태</th><th>일시</th></tr>
          </thead>
          <tbody>
            ${adminState.orders.slice(0,8).map(o => `
            <tr>
              <td style="font-weight:700">#${o.id}</td>
              <td>${o.user_name}</td>
              <td>${o.salon_name}</td>
              <td>${o.designer_name || '<span style="color:#9ca3af">없음</span>'}</td>
              <td style="font-weight:700;color:#e94560">${o.total_amount.toLocaleString()}원</td>
              <td><span class="badge badge-${o.payment_status.toLowerCase()}">${{PAID:'결제완료',PENDING:'대기',CANCELLED:'취소',REFUNDED:'환불'}[o.payment_status]}</span></td>
              <td style="color:#9ca3af;font-size:12px">${new Date(o.created_at).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
            </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:24px">주문 없음</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================================
// SALONS PAGE
// ============================================================
function blockedBrandLabel(salonId) {
  const names = (adminState.brands || [])
    .filter((brand) => (brand.blocked_salon_ids || []).map(Number).includes(Number(salonId)))
    .map((brand) => brand.name);
  return names.length ? names.join(', ') : '없음';
}

function renderSalons() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <h2 style="font-size:18px;font-weight:700">살롱 목록 (${adminState.salons.length})</h2>
      </div>
      <button class="btn btn-accent" onclick="openAddSalonModal()">
        <i class="fas fa-plus"></i> 살롱 추가
      </button>
    </div>
    <div class="panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>살롱명</th>
            <th>원장</th>
            <th>연락처</th>
            <th>계좌</th>
            <th>디자이너</th>
            <th>본사 제한</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${adminState.salons.map(s => `
          <tr>
            <td>
              <div style="font-weight:600">${s.salon_name}</div>
              <div style="font-size:11px;color:#9ca3af">ID ${s.id}</div>
            </td>
            <td>${s.owner_name || ''}</td>
            <td>${s.owner_phone || ''}</td>
            <td>${s.bank_account || '-'}</td>
            <td>활동 ${s.active_designers || 0} · 전체 ${s.designer_count || 0}</td>
            <td style="font-size:12px;color:#6b7280">${blockedBrandLabel(s.id)}</td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="openQRModal(${s.id})"><i class="fas fa-qrcode"></i></button>
                <button class="btn btn-sm btn-outline" onclick="viewSalonStats(${s.id})">통계</button>
                <button class="btn btn-sm btn-primary" onclick="openEditSalonModal(${s.id})">편집</button>
              </div>
            </td>
          </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px">살롱이 없습니다</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

async function openAddSalonModal() {
  showModal(`
    <h3 style="font-size:18px;font-weight:800;margin-bottom:20px">살롱 추가</h3>
    <div class="form-group"><label class="form-label">살롱명 *</label><input class="form-input" id="m-salon-name" placeholder="살롱 이름"></div>
    <div class="form-group"><label class="form-label">오너 이름 *</label><input class="form-input" id="m-owner-name" placeholder="대표자명"></div>
    <div class="form-group"><label class="form-label">연락처 *</label><input class="form-input" id="m-owner-phone" type="tel" placeholder="010-0000-0000"></div>
    <div class="form-group"><label class="form-label">계좌번호</label><input class="form-input" id="m-bank" placeholder="은행명 000-0000-0000"></div>
    <div style="display:flex;gap:10px;margin-top:24px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-accent" style="flex:1" onclick="submitAddSalon()"><i class="fas fa-plus"></i> 추가</button>
    </div>
  `);
}

async function submitAddSalon() {
  const body = {
    salon_name: document.getElementById('m-salon-name').value,
    owner_name: document.getElementById('m-owner-name').value,
    owner_phone: document.getElementById('m-owner-phone').value,
    bank_account: document.getElementById('m-bank').value
  };
  if (!body.salon_name || !body.owner_name || !body.owner_phone) { showToast('필수 항목을 입력하세요', 'error'); return; }
  const res = await api('/api/salons', 'POST', body);
  if (res.success) {
    closeModal(); showToast('살롱이 추가되었습니다', 'success');
    await loadPageData('salons');
  }
}

async function viewSalonStats(id) {
  const res = await api(`/api/salons/${id}/stats`);
  if (!res.success) return;
  const d = res.data;
  const salon = adminState.salons.find(s => s.id === id);
  showModal(`
    <h3 style="font-size:18px;font-weight:800;margin-bottom:4px">${salon?.salon_name} 통계</h3>
    <p style="font-size:13px;color:#6b7280;margin-bottom:20px">누적 실적</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      ${[
        {label:'총 매출',val:(d.total_revenue||0).toLocaleString()+'원',color:'#1a1a2e'},
        {label:'결제 완료',val:(d.paid_orders||0)+'건',color:'#10b981'},
        {label:'살롱 수수료',val:(d.total_salon_commission||0).toLocaleString()+'원',color:'#d4af37'},
        {label:'고객 수',val:(d.user_count||0)+'명',color:'#3b82f6'},
      ].map(item => `
      <div style="background:#f9fafb;border-radius:12px;padding:14px">
        <div style="font-size:13px;color:#6b7280">${item.label}</div>
        <div style="font-size:18px;font-weight:800;color:${item.color};margin-top:4px">${item.val}</div>
      </div>`).join('')}
    </div>
    <button class="btn btn-outline" style="width:100%" onclick="closeModal()">닫기</button>
  `);
}

async function openQRModal(salonId) {
  const salon = adminState.salons.find(s => s.id === salonId);
  showModal(`
    <div class="qr-display">
      <i class="fas fa-qrcode" style="font-size:100px;margin-bottom:16px;display:block;opacity:0.9"></i>
      <h3 style="font-size:18px;font-weight:800;margin-bottom:4px">${salon?.salon_name}</h3>
      <p style="font-size:13px;opacity:0.7;margin-bottom:16px">이 QR 코드를 고객에게 제공하세요</p>
      <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:10px 16px;font-size:14px;font-family:monospace">
        /scan?salon=${salonId}
      </div>
    </div>
    <button class="btn btn-outline" style="width:100%;margin-top:16px" onclick="closeModal()">닫기</button>
  `);
}

async function openEditSalonModal(id) {
  const salon = adminState.salons.find(s => s.id === id);
  if (!salon) return;
  showModal(`
    <h3 style="font-size:18px;font-weight:800;margin-bottom:20px">살롱 편집</h3>
    <div class="form-group"><label class="form-label">살롱명</label><input class="form-input" id="m-salon-name" value="${salon.salon_name}"></div>
    <div class="form-group"><label class="form-label">오너 이름</label><input class="form-input" id="m-owner-name" value="${salon.owner_name}"></div>
    <div class="form-group"><label class="form-label">연락처</label><input class="form-input" id="m-owner-phone" value="${salon.owner_phone}"></div>
    <div class="form-group"><label class="form-label">계좌번호</label><input class="form-input" id="m-bank" value="${salon.bank_account || ''}"></div>
    <div style="display:flex;gap:10px;margin-top:24px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-primary" style="flex:1" onclick="submitEditSalon(${id})"><i class="fas fa-save"></i> 저장</button>
    </div>
  `);
}

async function submitEditSalon(id) {
  const body = {
    salon_name: document.getElementById('m-salon-name').value,
    owner_name: document.getElementById('m-owner-name').value,
    owner_phone: document.getElementById('m-owner-phone').value,
    bank_account: document.getElementById('m-bank').value
  };
  await api(`/api/salons/${id}`, 'PUT', body);
  closeModal(); showToast('저장되었습니다', 'success');
  await loadPageData('salons');
}

// ============================================================
// DESIGNERS PAGE
// ============================================================
function renderDesigners() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 style="font-size:18px;font-weight:700">디자이너 (${adminState.designers.length})</h2>
        <select class="form-select" style="width:160px;padding:8px 12px" onchange="filterDesigners(this.value)">
          <option value="">전체 살롱</option>
          ${adminState.salons.map(s => `<option value="${s.id}">${s.salon_name}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-accent" onclick="openAddDesignerModal()">
        <i class="fas fa-plus"></i> 디자이너 추가
      </button>
    </div>
    <div class="panel">
      <table class="data-table">
        <thead>
          <tr>
            <th>디자이너</th>
            <th>소속 살롱</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody id="designer-table-body">
          ${renderDesignerRows(adminState.designers)}
        </tbody>
      </table>
    </div>

    <!-- Resignation Rule Notice -->
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:14px;padding:16px;margin-top:20px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <i class="fas fa-info-circle" style="color:#d97706;font-size:18px;margin-top:2px"></i>
        <div>
          <div style="font-weight:700;color:#92400e;margin-bottom:6px">디자이너 퇴사 처리 규칙</div>
          <ul style="font-size:13px;color:#92400e;line-height:1.8;padding-left:16px">
            <li>퇴사 즉시 해당 디자이너에게 매핑된 모든 고객의 담당이 해제됩니다</li>
            <li>퇴사 전 주문에는 그 디자이너 이름이 남습니다</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function renderDesignerRows(designers) {
  return designers.map(d => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <img src="${d.profile_img || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + d.id}" 
               style="width:36px;height:36px;border-radius:50%;object-fit:cover;background:#f3f4f6" 
               onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=default'">
          <div>
            <div style="font-weight:600">${d.designer_name}</div>
            <div style="font-size:11px;color:#9ca3af">ID: ${d.id}</div>
          </div>
        </div>
      </td>
      <td>${d.salon_name}</td>
      <td><span class="badge badge-${d.status === 'ACTIVE' ? 'active' : 'resigned'}">${d.status === 'ACTIVE' ? '활동중' : '퇴사'}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          ${d.status === 'ACTIVE' ?
            `<button class="btn btn-sm btn-danger" onclick="resignDesigner(${d.id}, '${d.designer_name.replace(/'/g, "\\'")}')">
              <i class="fas fa-user-times"></i> 퇴사처리
            </button>` :
            `<button class="btn btn-sm btn-success" onclick="reinstateDesigner(${d.id})">
              <i class="fas fa-user-check"></i> 복직
            </button>`
          }
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:24px">디자이너 없음</td></tr>';
}

async function filterDesigners(salonId) {
  const res = await api(`/api/designers${salonId ? '?salon_id=' + salonId : ''}`);
  if (res.success) {
    const tbody = document.getElementById('designer-table-body');
    if (tbody) tbody.innerHTML = renderDesignerRows(res.data);
  }
}

async function resignDesigner(id, name) {
  showModal(`
    <div style="text-align:center;padding:12px 0">
      <div style="width:64px;height:64px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
        <i class="fas fa-user-times" style="font-size:28px;color:#dc2626"></i>
      </div>
      <h3 style="font-size:18px;font-weight:800;color:#1a1a2e;margin-bottom:8px">퇴사 처리 확인</h3>
      <p style="font-size:14px;color:#6b7280;margin-bottom:16px"><strong>${name}</strong> 디자이너를 퇴사 처리하시겠습니까?</p>
      <div style="background:#fef3c7;border-radius:10px;padding:12px;text-align:left;margin-bottom:20px">
        <p style="font-size:12px;color:#92400e;line-height:1.6">
          ⚠️ 퇴사 처리 시 매핑된 고객의 담당이 해제됩니다.
        </p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
        <button class="btn btn-danger" style="flex:1" onclick="confirmResign(${id})">
          <i class="fas fa-user-times"></i> 퇴사 처리
        </button>
      </div>
    </div>
  `);
}

async function confirmResign(id) {
  const res = await api(`/api/designers/${id}/resign`, 'POST');
  if (res.success) {
    closeModal();
    showToast('퇴사 처리했습니다', 'success');
    await loadPageData('designers');
  }
}

async function reinstateDesigner(id) {
  const res = await api(`/api/designers/${id}/reinstate`, 'POST');
  if (res.success) {
    showToast('복직 처리되었습니다', 'success');
    await loadPageData('designers');
  }
}

async function openAddDesignerModal() {
  showModal(`
    <h3 style="font-size:18px;font-weight:800;margin-bottom:20px">디자이너 추가</h3>
    <div class="form-group">
      <label class="form-label">소속 살롱 *</label>
      <select class="form-select" id="m-d-salon">
        ${adminState.salons.map(s => `<option value="${s.id}">${s.salon_name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">이름 *</label><input class="form-input" id="m-d-name" placeholder="홍길동 디자이너"></div>
    <div style="display:flex;gap:10px;margin-top:24px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-accent" style="flex:1" onclick="submitAddDesigner()"><i class="fas fa-plus"></i> 추가</button>
    </div>
  `);
}

async function submitAddDesigner() {
  const body = {
    salon_id: document.getElementById('m-d-salon').value,
    designer_name: document.getElementById('m-d-name').value,
    commission_rate: 0
  };
  if (!body.designer_name) { showToast('이름을 입력하세요', 'error'); return; }
  const res = await api('/api/designers', 'POST', body);
  if (res.success) {
    closeModal(); showToast('디자이너가 추가되었습니다', 'success');
    await loadPageData('designers');
  }
}

// ============================================================
// USERS PAGE
// ============================================================
function userOrderStats(userId) {
  const orders = (adminState.orders || []).filter((order) => order.user_id === userId && order.payment_status !== 'CANCELLED');
  return {
    count: orders.length,
    amount: orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0),
  };
}

function userBoundOk(value, minRaw, maxRaw) {
  const min = String(minRaw == null ? '' : minRaw).trim();
  const max = String(maxRaw == null ? '' : maxRaw).trim();
  if (min !== '' && value < Number(min)) return false;
  if (max !== '' && value > Number(max)) return false;
  return true;
}

function userHeldCouponIds(user) {
  return (Array.isArray(user.coupon_ids) ? user.coupon_ids : []).map(Number).filter((id) => id);
}

function visibleUsers() {
  const query = (adminState.userQuery || '').trim().toLowerCase();
  const digits = query.replace(/\D/g, '');
  const salon = String(adminState.userSalon || 'ALL');
  const pointMode = adminState.userPointPresence || 'ALL';
  const couponMode = adminState.userCouponPresence || 'ALL';
  const couponId = String(adminState.userCouponId || '');
  return (adminState.users || []).filter((user) => {
    if (salon !== 'ALL' && String(user.current_salon_id) !== salon && String(user.owned_salon_id) !== salon) return false;
    if (query) {
      const phone = String(user.phone || '').replace(/\D/g, '');
      const text = [user.name, user.phone, user.salon_name, user.designer_name].join(' ').toLowerCase();
      if (text.indexOf(query) < 0 && !(digits.length >= 3 && phone.indexOf(digits) >= 0)) return false;
    }
    const stats = userOrderStats(user.id);
    if (!userBoundOk(stats.count, adminState.userOrderMin, adminState.userOrderMax)) return false;
    if (!userBoundOk(stats.amount, adminState.userAmountMin, adminState.userAmountMax)) return false;
    const points = Number(user.points) || 0;
    if (pointMode === 'HAS' && points <= 0) return false;
    if (pointMode === 'NONE' && points > 0) return false;
    if (pointMode !== 'NONE' && !userBoundOk(points, adminState.userPointMin, adminState.userPointMax)) return false;
    const held = userHeldCouponIds(user);
    if (couponMode === 'HAS' && !held.length) return false;
    if (couponMode === 'NONE' && held.length) return false;
    if (couponMode !== 'NONE' && couponId && held.map(String).indexOf(couponId) < 0) return false;
    return true;
  });
}

function setUserFilter(key, value, inputId) {
  adminState[key] = value;
  const id = inputId || (key === 'userQuery' ? 'user-query' : '');
  renderAdmin();
  if (id) {
    const input = document.getElementById(id);
    if (input) {
      input.focus();
      const pos = String(value).length;
      if (input.setSelectionRange) input.setSelectionRange(pos, pos);
    }
  }
}

function setUserNumber(key, value, inputId) {
  setUserFilter(key, String(value).replace(/[^\d]/g, ''), inputId);
}

function resetUserConditions() {
  adminState.userOrderMin = '';
  adminState.userOrderMax = '';
  adminState.userAmountMin = '';
  adminState.userAmountMax = '';
  adminState.userPointPresence = 'ALL';
  adminState.userPointMin = '';
  adminState.userPointMax = '';
  adminState.userCouponPresence = 'ALL';
  adminState.userCouponId = '';
  renderAdmin();
}

function renderUsers() {
  const users = visibleUsers();
  const pointMode = adminState.userPointPresence || 'ALL';
  const couponMode = adminState.userCouponPresence || 'ALL';
  const coupons = (adminState.coupons || []).filter((coupon) => coupon.status !== 'STOPPED');
  const presence = (key, current) => ['ALL', 'HAS', 'NONE'].map((value) => {
    const label = value === 'ALL' ? '전체' : value === 'HAS' ? '있음' : '없음';
    return `<button type="button" class="presence-chip ${current === value ? 'on' : ''}" onclick="setUserFilter('${key}', '${value}')">${label}</button>`;
  }).join('');
  return `
    <div class="page-kicker">고객 관리</div>
    <p class="page-sub">이름과 매장, 주문 건수·금액, 포인트, 쿠폰으로 고객을 찾습니다.</p>
    <div class="filter-card">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:220px">
          <label class="field-label">검색</label>
          <input class="soft-input" id="user-query" value="${escAttr(adminState.userQuery || '')}" placeholder="이름, 연락처, 매장, 디자이너" oninput="setUserFilter('userQuery', this.value)">
        </div>
        <div>
          <label class="field-label">매장</label>
          <select class="soft-select" style="min-width:180px" onchange="setUserFilter('userSalon', this.value)">
            <option value="ALL">전체 매장</option>
            ${adminState.salons.map((salon) => `<option value="${salon.id}" ${String(adminState.userSalon) === String(salon.id) ? 'selected' : ''}>${escAttr(salon.salon_name)}</option>`).join('')}
          </select>
        </div>
        <button type="button" class="ghost-btn" onclick="resetUserConditions()">초기화</button>
        <span style="margin-left:auto;font-size:12px;color:#94a3b8;padding-bottom:10px">조회 ${users.length}명</span>
      </div>
      <div class="range-line">
        <span class="range-label">총 주문건수</span>
        <span class="range-box">
          <input id="user-order-min" inputmode="numeric" value="${escAttr(adminState.userOrderMin)}" placeholder="0" oninput="setUserNumber('userOrderMin', this.value, 'user-order-min')">
          <span>~</span>
          <input id="user-order-max" inputmode="numeric" value="${escAttr(adminState.userOrderMax)}" placeholder="제한없음" oninput="setUserNumber('userOrderMax', this.value, 'user-order-max')">
          <span>건</span>
        </span>
        <span class="range-split"></span>
        <span class="range-label">총 주문금액</span>
        <span class="range-box">
          <input id="user-amount-min" inputmode="numeric" value="${escAttr(adminState.userAmountMin)}" placeholder="0" oninput="setUserNumber('userAmountMin', this.value, 'user-amount-min')">
          <span>~</span>
          <input id="user-amount-max" inputmode="numeric" value="${escAttr(adminState.userAmountMax)}" placeholder="제한없음" oninput="setUserNumber('userAmountMax', this.value, 'user-amount-max')">
          <span>원</span>
        </span>
      </div>
      <div class="presence-row">
        <div class="presence-card">
          <div class="field-label">포인트</div>
          <div class="presence-tools">
            ${presence('userPointPresence', pointMode)}
            <span class="range-box ${pointMode === 'NONE' ? 'is-off' : ''}">
              <input id="user-point-min" inputmode="numeric" value="${escAttr(adminState.userPointMin)}" placeholder="0" ${pointMode === 'NONE' ? 'disabled' : ''} oninput="setUserNumber('userPointMin', this.value, 'user-point-min')">
              <span>이상</span>
              <span class="range-split"></span>
              <input id="user-point-max" inputmode="numeric" value="${escAttr(adminState.userPointMax)}" placeholder="제한없음" ${pointMode === 'NONE' ? 'disabled' : ''} oninput="setUserNumber('userPointMax', this.value, 'user-point-max')">
              <span>이하</span>
            </span>
          </div>
        </div>
        <div class="presence-card">
          <div class="field-label">쿠폰</div>
          <div class="presence-tools">
            ${presence('userCouponPresence', couponMode)}
            <span class="range-box ${couponMode === 'NONE' ? 'is-off' : ''}">
              <select id="user-coupon" ${couponMode === 'NONE' ? 'disabled' : ''} onchange="setUserFilter('userCouponId', this.value)">
                <option value="">발행 쿠폰</option>
                ${coupons.map((coupon) => `<option value="${coupon.id}" ${String(adminState.userCouponId) === String(coupon.id) ? 'selected' : ''}>${escAttr(coupon.name)} (${escAttr(coupon.code || '')})</option>`).join('')}
              </select>
              <span style="color:#94a3b8;font-size:12px">${adminState.userCouponId ? '선택됨' : '선택'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="overflow-x:auto">
      <table class="data-table">
        <thead>
          <tr><th>고객</th><th>연락처</th><th>소속 매장</th><th>담당 디자이너</th><th>주문건수</th><th>주문금액</th><th>가입일</th></tr>
        </thead>
        <tbody>
          ${users.map((user) => {
            const stats = userOrderStats(user.id);
            return `
            <tr>
              <td style="font-weight:400">${escAttr(user.name || '-')}</td>
              <td style="color:#6b7280">${escAttr(user.phone || '-')}</td>
              <td>${user.salon_name ? escAttr(user.salon_name) : '<span style="color:#9ca3af">미등록</span>'}</td>
              <td>${user.designer_name ? escAttr(user.designer_name) : '<span style="color:#9ca3af">없음</span>'}</td>
              <td style="font-weight:400">${stats.count}건</td>
              <td style="font-weight:400">${stats.amount.toLocaleString()}원</td>
              <td style="color:#9ca3af;font-size:12px">${escAttr(String(user.created_at || '').slice(0, 10))}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:24px">조건에 맞는 고객이 없습니다</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// ============================================================
// PRODUCTS PAGE
// ============================================================
function productBrandLabel(id) {
  const brand = (adminState.brands || []).find((item) => item.id === id);
  return brand ? brand.name : '-';
}

function productCategoryLabel(product) {
  return ProductCatalog.normalizeCategory(product) || product.category || '-';
}

function stockLabel(stock) {
  if (stock == null || stock >= ProductCatalog.UNLIMITED_STOCK) return '제한없음';
  return String(stock);
}

const PRODUCT_STATUS = [
  ['WAITING', '등록대기', 'waiting'],
  ['SELLING', '판매중', 'selling'],
  ['SOLDOUT', '품절', 'soldout'],
  ['STOP', '판매중지', 'stop'],
];

function productNumber(product) {
  return product.product_number || String(100000 + Number(product.id || 0));
}

function productSaleState(product) {
  const status = product.sale_status || (product.is_active ? 'SELLING' : 'STOP');
  if (status === 'STOP' || status === 'WAITING' || status === 'SOLDOUT') return status;
  const today = new Date();
  const day = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const start = String(product.sale_start_at || '').slice(0, 10);
  const end = String(product.sale_end_at || '').slice(0, 10);
  if ((start && day < start) || (end && day > end)) return 'EXPIRED';
  if (Number(product.stock_quantity) === 0) return 'SOLDOUT';
  return 'SELLING';
}

function productStatusMeta(state) {
  if (state === 'EXPIRED') return { label: '기간만료', tone: 'stop' };
  const found = PRODUCT_STATUS.find((item) => item[0] === state);
  return found ? { label: found[1], tone: found[2] } : { label: '판매중', tone: 'selling' };
}

function productMarginRate(product) {
  const selling = Number(product.vip_discount_price) || 0;
  if (selling <= 0) return null;
  return Math.round(((selling - (Number(product.supply_price) || 0)) / selling) * 1000) / 10;
}

function productIsDeleted(product) {
  return !!product.deleted_at;
}

function setProductFilter(key, value) {
  adminState[key] = value;
  const pos = key === 'productQuery' ? String(value).length : 0;
  renderAdmin();
  if (key === 'productQuery') {
    const input = document.getElementById('product-query');
    if (input) { input.focus(); input.setSelectionRange(pos, input.value.length); }
  }
}

function toggleProductStatus(status) {
  const all = PRODUCT_STATUS.map((item) => item[0]);
  const current = Array.isArray(adminState.productStatuses) ? adminState.productStatuses.slice() : all.slice();
  if (status === 'ALL') adminState.productStatuses = current.length === all.length ? [] : all.slice();
  else if (current.indexOf(status) >= 0) adminState.productStatuses = current.filter((item) => item !== status);
  else adminState.productStatuses = current.concat(status);
  renderAdmin();
}

function cycleProductMarginSort() {
  const order = ['', 'desc', 'asc'];
  const index = order.indexOf(adminState.productMarginSort || '');
  adminState.productMarginSort = order[(index + 1) % order.length];
  renderAdmin();
}

function visibleAdminProducts() {
  const deleted = !!adminState.productDeleted;
  const query = (adminState.productQuery || '').trim().toLowerCase();
  const brand = String(adminState.productBrand || 'ALL');
  const statuses = Array.isArray(adminState.productStatuses) ? adminState.productStatuses : PRODUCT_STATUS.map((item) => item[0]);
  const rows = (adminState.products || []).filter((product) => {
    if (productIsDeleted(product) !== deleted) return false;
    if (brand !== 'ALL' && String(product.brand_id) !== brand) return false;
    const state = productSaleState(product);
    const bucket = state === 'EXPIRED' ? 'STOP' : state;
    if (statuses.indexOf(bucket) < 0) return false;
    if (!query) return true;
    return String(product.name || '').toLowerCase().indexOf(query) >= 0 || productNumber(product).toLowerCase().indexOf(query) >= 0;
  });
  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || b.id - a.id);
  const dir = adminState.productMarginSort;
  if (dir === 'asc' || dir === 'desc') {
    const sign = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const left = productMarginRate(a);
      const right = productMarginRate(b);
      const av = left == null ? -Infinity : left;
      const bv = right == null ? -Infinity : right;
      if (av === bv) return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      return (av - bv) * sign;
    });
  }
  return rows;
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function downloadCsv(filename, rows) {
  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function downloadProductExcel() {
  const rows = [['상품번호', '등록일', '브랜드', '상품명', '카테고리', '공급가', '정상가', '판매가', '마진%', '노출상태']];
  visibleAdminProducts().forEach((product) => {
    const rate = productMarginRate(product);
    rows.push([
      productNumber(product),
      String(product.created_at || '').slice(0, 10),
      productBrandLabel(product.brand_id),
      product.name || '',
      productCategoryLabel(product),
      product.supply_price || 0,
      product.original_price || 0,
      product.vip_discount_price || 0,
      rate == null ? '' : rate,
      productStatusMeta(productSaleState(product)).label,
    ]);
  });
  const today = new Date();
  const stamp = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  downloadCsv('상품목록_' + stamp + '.csv', rows);
}

function wonText(value) {
  return (Number(value) || 0).toLocaleString() + '원';
}

function escAttr(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderProducts() {
  const rows = visibleAdminProducts();
  const brands = (adminState.brands || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const selected = Array.isArray(adminState.productStatuses) ? adminState.productStatuses : PRODUCT_STATUS.map((item) => item[0]);
  const allOn = PRODUCT_STATUS.every((item) => selected.indexOf(item[0]) >= 0);
  const arrow = adminState.productMarginSort === 'asc' ? '▲' : adminState.productMarginSort === 'desc' ? '▼' : '↕';
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <div class="page-kicker">상품 관리</div>
        <p class="page-sub">등록된 상품을 조회하고 신규 상품을 등록할 수 있습니다.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="ghost-btn" type="button" onclick="downloadProductExcel()"><i class="fas fa-download"></i> 엑셀 다운로드</button>
        <button class="ghost-btn" type="button" onclick="openBulkProductModal()"><i class="fas fa-file-csv"></i> 상품 일괄 등록</button>
        <button class="ghost-btn" type="button" onclick="openBulkImageModal()"><i class="fas fa-image"></i> 이미지 일괄 업로드</button>
        <button class="btn btn-primary" type="button" onclick="openAddProductModal()"><i class="fas fa-plus"></i> 상품 등록</button>
      </div>
    </div>
    <div class="filter-card">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:220px">
          <label class="field-label">검색</label>
          <input class="soft-input" id="product-query" value="${escAttr(adminState.productQuery || '')}" placeholder="상품명 또는 상품번호 검색" oninput="setProductFilter('productQuery', this.value)">
        </div>
        <div>
          <label class="field-label">브랜드</label>
          <select class="soft-select" style="min-width:180px" onchange="setProductFilter('productBrand', this.value)">
            <option value="ALL">전체 브랜드</option>
            ${brands.map((brand) => `<option value="${brand.id}" ${String(adminState.productBrand) === String(brand.id) ? 'selected' : ''}>${escAttr(brand.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="margin-top:14px">
        <div class="field-label">판매 상태</div>
        <div class="status-checks">
          <label><input type="checkbox" ${allOn ? 'checked' : ''} onchange="toggleProductStatus('ALL')"> 전체</label>
          ${PRODUCT_STATUS.map(([value, label]) => `<label><input type="checkbox" ${selected.indexOf(value) >= 0 ? 'checked' : ''} onchange="toggleProductStatus('${value}')"> ${label}</label>`).join('')}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button type="button" class="product-tab ${adminState.productDeleted ? '' : 'on'}" onclick="setProductFilter('productDeleted', false)">전체 상품</button>
      <button type="button" class="product-tab ${adminState.productDeleted ? 'on' : ''}" onclick="setProductFilter('productDeleted', true)">삭제된 상품</button>
    </div>
    <div class="panel" style="overflow-x:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>상품번호</th>
            <th>브랜드</th>
            <th>상품명</th>
            <th>공급가</th>
            <th>정상가</th>
            <th>판매가</th>
            <th><button type="button" class="sort-head" onclick="cycleProductMarginSort()">마진% ${arrow}</button></th>
            <th>노출상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((product) => {
            const meta = productStatusMeta(productSaleState(product));
            const rate = productMarginRate(product);
            return `
            <tr>
              <td style="font-weight:400">${escAttr(productNumber(product))}<div style="color:#9ca3af;font-size:12px">${escAttr(String(product.created_at || '').slice(0, 10))}</div></td>
              <td>${escAttr(productBrandLabel(product.brand_id))}</td>
              <td>${escAttr(product.name)}</td>
              <td style="font-weight:400">${wonText(product.supply_price)}</td>
              <td style="font-weight:400">${wonText(product.original_price)}</td>
              <td style="font-weight:400">${wonText(product.vip_discount_price)}</td>
              <td style="font-weight:400;${rate != null && rate < 0 ? 'color:#e11d48' : ''}">${rate == null ? '-' : rate + '%'}</td>
              <td><span class="sale-badge ${meta.tone}">${meta.label}</span></td>
              <td>${productIsDeleted(product)
                ? `<button class="text-link muted" type="button" onclick="restoreProduct(${product.id})">복구</button>`
                : `<button class="text-link muted" type="button" onclick="openEditProductModal(${product.id})">상세</button>`}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:24px">${adminState.productDeleted ? '삭제된 상품이 없습니다' : '조건에 맞는 상품이 없습니다'}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

let productDraft = null;

function emptyProductOption() {
  return { id: 'opt-' + Math.random().toString(36).slice(2, 8), name: '', supplyPrice: '', additional: '0', stock: '', soldOut: false, restock: '', supplyTouched: false };
}

function blankProductDraft(brandId) {
  return {
    id: null, name: '', brandId: brandId || '', category: '',
    supplyPrice: '', normalPrice: '', discountRate: '', discountAmount: '', discountSource: 'NONE',
    stock: '', minOrder: '1', purchaseUnit: '1', maxPurchase: '', earnRate: '0', pointUseDisabled: false,
    salePeriod: 'ALL', saleStart: '', saleEnd: '', saleStatus: 'SELLING', imageUrl: '', detailImages: [], description: '', deleted: false,
    options: [emptyProductOption()],
  };
}

function draftFromProduct(product) {
  const discount = product.discount_type
    ? { type: product.discount_type, value: product.discount_value || 0 }
    : ProductCatalog.inferDiscount(product.original_price, product.vip_discount_price);
  const options = (product.options || []).map((option) => ({
    id: option.id,
    name: option.name || '',
    supplyPrice: option.supply_price ? String(option.supply_price) : '',
    additional: String(option.additional_selling_price || 0),
    stock: option.stock >= ProductCatalog.UNLIMITED_STOCK ? '' : String(option.stock ?? ''),
    soldOut: !!option.sold_out,
    restock: option.expected_restock_at || '',
    supplyTouched: true,
  }));
  return {
    id: product.id,
    name: product.name || '',
    brandId: product.brand_id || '',
    category: ProductCatalog.normalizeCategory(product),
    supplyPrice: product.supply_price ? String(product.supply_price) : '',
    normalPrice: String(product.original_price || ''),
    discountRate: discount.type === 'RATE' ? String(discount.value) : '',
    discountAmount: discount.type === 'AMOUNT' ? String(discount.value) : '',
    discountSource: discount.type || 'NONE',
    stock: product.stock_quantity >= ProductCatalog.UNLIMITED_STOCK ? '' : String(product.stock_quantity ?? ''),
    minOrder: String(product.min_order_quantity || 1),
    purchaseUnit: String(product.purchase_unit || 1),
    maxPurchase: product.max_purchase_quantity ? String(product.max_purchase_quantity) : '',
    earnRate: String(product.earn_points_rate || 0),
    pointUseDisabled: !!product.point_use_disabled,
    salePeriod: product.sale_start_at || product.sale_end_at ? 'CUSTOM' : 'ALL',
    saleStart: product.sale_start_at || '',
    saleEnd: product.sale_end_at || '',
    saleStatus: product.sale_status || 'SELLING',
    deleted: !!product.deleted_at,
    imageUrl: product.image_url || '',
    detailImages: Array.isArray(product.detail_image_urls) ? product.detail_image_urls.slice() : [],
    description: product.description || '',
    options: options.length ? options : [emptyProductOption()],
  };
}

function readProductDraft() {
  if (!productDraft) return;
  const read = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
  if (read('pf-name') == null) return;
  productDraft.name = read('pf-name');
  productDraft.brandId = read('pf-brand');
  productDraft.category = read('pf-category');
  productDraft.supplyPrice = read('pf-supply');
  productDraft.normalPrice = read('pf-normal');
  productDraft.discountRate = read('pf-discount-rate');
  productDraft.discountAmount = read('pf-discount-amount');
  productDraft.stock = read('pf-stock');
  productDraft.minOrder = read('pf-min');
  productDraft.purchaseUnit = read('pf-unit');
  productDraft.maxPurchase = read('pf-max');
  productDraft.earnRate = read('pf-earn');
  productDraft.pointUseDisabled = !!document.getElementById('pf-point-block').checked;
  productDraft.salePeriod = read('pf-sale-period');
  productDraft.saleStart = read('pf-sale-start');
  productDraft.saleEnd = read('pf-sale-end');
  productDraft.saleStatus = read('pf-sale-status') || productDraft.saleStatus;
  productDraft.description = read('pf-desc');
  productDraft.options.forEach((option, index) => {
    const name = read('pf-opt-name-' + index);
    if (name == null) return;
    option.name = name;
    option.supplyPrice = read('pf-opt-supply-' + index);
    option.additional = read('pf-opt-add-' + index);
    option.stock = read('pf-opt-stock-' + index);
    option.restock = read('pf-opt-restock-' + index) || '';
  });
  const rate = Number(productDraft.discountRate) || 0;
  const amount = Number(productDraft.discountAmount) || 0;
  if (rate > 0 && !(amount > 0)) productDraft.discountSource = 'RATE';
  else if (amount > 0 && !(rate > 0)) productDraft.discountSource = 'AMOUNT';
  else if (!(rate > 0) && !(amount > 0)) productDraft.discountSource = 'NONE';
}

function currentSellingPrice() {
  return ProductCatalog.computeSellingPrice(
    productDraft.normalPrice,
    productDraft.discountSource,
    productDraft.discountRate,
    productDraft.discountAmount
  );
}

function productImageRow(kind) {
  const images = kind === 'thumb'
    ? (productDraft.imageUrl ? [productDraft.imageUrl] : [])
    : (productDraft.detailImages || []);
  const tiles = images.map((src, index) => `
    <div class="image-tile">
      <img src="${escAttr(src)}" alt="">
      <button type="button" class="image-remove" onclick="removeProductImage('${kind}', ${index})">×</button>
    </div>`).join('');
  const canAdd = kind === 'thumb' ? images.length === 0 : images.length < 8;
  const add = canAdd ? `
    <label class="image-add">
      <i class="fas fa-plus"></i>
      <span>이미지 추가</span>
      <input type="file" accept="image/*" ${kind === 'detail' ? 'multiple' : ''} onchange="addProductImages('${kind}', this)">
    </label>` : '';
  return `<div class="image-row">${tiles}${add}</div>`;
}

function productFormHtml() {
  const selling = currentSellingPrice();
  const supply = Number(productDraft.supplyPrice) || 0;
  const margin = selling - supply;
  const marginRate = selling > 0 ? Math.round(((selling - supply) / selling) * 1000) / 10 : null;
  const brands = adminState.brands || [];
  const categories = ProductCatalog.CATEGORIES.slice();
  if (productDraft.category && categories.indexOf(productDraft.category) < 0) categories.push(productDraft.category);
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="font-size:18px;font-weight:800">${productDraft.id ? '상품 수정' : '상품 등록'}</h3>
      <span style="font-size:12px;color:#6b7280">할인율 또는 할인금액 중 하나만 입력하면 판매가가 계산됩니다.</span>
    </div>
    <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">상품명 *</label><input class="form-input" id="pf-name" value="${escAttr(productDraft.name)}" placeholder="상품명"></div>
      <div class="form-group">
        <label class="form-label">브랜드 *</label>
        <select class="form-select" id="pf-brand">
          <option value="">브랜드 선택</option>
          ${brands.map((brand) => `<option value="${brand.id}" ${String(brand.id) === String(productDraft.brandId) ? 'selected' : ''}>${escAttr(brand.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">카테고리 *</label>
        <select class="form-select" id="pf-category">
          <option value="">카테고리 선택</option>
          ${categories.map((category) => `<option value="${escAttr(category)}" ${category === productDraft.category ? 'selected' : ''}>${escAttr(category)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div class="form-group">
            <label class="form-label">판매기간</label>
            <select class="form-select" id="pf-sale-period" onchange="toggleProductSalePeriod()">
              <option value="ALL" ${productDraft.salePeriod === 'ALL' ? 'selected' : ''}>전체기간</option>
              <option value="CUSTOM" ${productDraft.salePeriod === 'CUSTOM' ? 'selected' : ''}>기간지정</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">판매시작일</label><input class="form-input" id="pf-sale-start" type="date" value="${escAttr(productDraft.saleStart)}" ${productDraft.salePeriod === 'ALL' ? 'disabled' : ''}></div>
      <div class="form-group"><label class="form-label">판매종료일</label><input class="form-input" id="pf-sale-end" type="date" value="${escAttr(productDraft.saleEnd)}" ${productDraft.salePeriod === 'ALL' ? 'disabled' : ''}></div>
    </div>
    <div class="form-section">
      <h4>가격 · 재고</h4>
      <div class="price-grid">
        <div class="form-group"><label class="form-label">공급가 *</label><input class="form-input price-input" id="pf-supply" type="number" min="0" value="${escAttr(productDraft.supplyPrice)}" oninput="refreshProductPrices()"></div>
        <div class="form-group"><label class="form-label">정가 *</label><input class="form-input price-input" id="pf-normal" type="number" min="0" value="${escAttr(productDraft.normalPrice)}" oninput="refreshProductPrices()"></div>
        <div class="form-group"><label class="form-label">할인율 %</label><input class="form-input price-input" id="pf-discount-rate" type="number" min="0" max="100" step="0.1" value="${escAttr(productDraft.discountRate)}" oninput="refreshProductPrices('rate')"></div>
        <div class="form-group"><label class="form-label">할인금액</label><input class="form-input price-input" id="pf-discount-amount" type="number" min="0" value="${escAttr(productDraft.discountAmount)}" oninput="refreshProductPrices('amount')"></div>
        <div class="form-group"><label class="form-label">판매가</label><div class="form-input price-input price-computed" id="pf-selling">${selling.toLocaleString()}원</div></div>
        <div class="form-group"><label class="form-label">마진</label><div class="form-input price-input price-computed" id="pf-margin">${margin.toLocaleString()}원${marginRate != null ? ' (' + marginRate + '%)' : ''}</div></div>
      </div>
      <div class="price-grid" style="grid-template-columns:repeat(5,1fr)">
        <div class="form-group"><label class="form-label">재고 수량</label><input class="form-input price-input" id="pf-stock" type="number" min="0" placeholder="제한없음" value="${escAttr(productDraft.stock)}"></div>
        <div class="form-group"><label class="form-label">판매 상태</label>
          <select class="form-select" id="pf-sale-status">
            ${PRODUCT_STATUS.map(([value, label]) => `<option value="${value}" ${productDraft.saleStatus === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">최소 발주 수량</label><input class="form-input price-input" id="pf-min" type="number" min="1" value="${escAttr(productDraft.minOrder)}"></div>
        <div class="form-group"><label class="form-label">추가 단위</label><input class="form-input price-input" id="pf-unit" type="number" min="1" value="${escAttr(productDraft.purchaseUnit)}"></div>
        <div class="form-group"><label class="form-label">최대 구매 수량</label><input class="form-input price-input" id="pf-max" type="number" min="1" placeholder="제한없음" value="${escAttr(productDraft.maxPurchase)}"></div>
      </div>
      <div style="display:grid;grid-template-columns:140px 1fr;gap:12px">
        <div class="form-group"><label class="form-label">적립율 %</label><input class="form-input price-input" id="pf-earn" type="number" min="0" max="100" value="${escAttr(productDraft.earnRate)}"></div>
        <div class="form-group">
          <label class="form-label">포인트 사용 설정</label>
          <label class="form-input" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="pf-point-block" ${productDraft.pointUseDisabled ? 'checked' : ''}>
            포인트 사용 불가
          </label>
        </div>
      </div>
    </div>
    <div class="form-section">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h4 style="margin:0">옵션</h4>
        <button class="btn btn-sm btn-outline" type="button" onclick="addProductOption()">옵션 추가</button>
      </div>
      <p class="hint">판매가 = 기본 판매가 + 추가판매금액. 공급가는 상품 공급가를 따르고, 옵션에서 직접 수정한 값만 따로 유지됩니다.</p>
      <div class="option-head"><span>옵션명</span><span>공급가</span><span>추가판매금액</span><span>판매가</span><span>재고</span><span></span></div>
      ${productDraft.options.map((option, index) => {
        const optionSupply = option.supplyTouched ? option.supplyPrice : (productDraft.supplyPrice || option.supplyPrice || '');
        const optionSelling = selling + (Number(option.additional) || 0);
        return `
          <div class="option-row ${option.soldOut ? 'soldout' : ''}">
            <input class="form-input" id="pf-opt-name-${index}" value="${escAttr(option.name)}" placeholder="예: 500ml">
            <input class="form-input price-input" id="pf-opt-supply-${index}" type="number" min="0" value="${escAttr(optionSupply)}" oninput="touchProductOptionSupply(${index})">
            <input class="form-input price-input" id="pf-opt-add-${index}" type="number" min="0" value="${escAttr(option.additional)}" oninput="refreshProductPrices()">
            <div class="form-input price-computed" id="pf-opt-selling-${index}">${Math.max(0, optionSelling).toLocaleString()}원</div>
            <input class="form-input price-input" id="pf-opt-stock-${index}" type="number" min="0" placeholder="제한없음" value="${escAttr(option.stock)}">
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm ${option.soldOut ? 'btn-danger' : 'btn-outline'}" type="button" onclick="toggleProductOptionSoldOut(${index})">${option.soldOut ? '해제' : '품절'}</button>
              <button class="btn btn-sm btn-outline" type="button" onclick="removeProductOption(${index})"><i class="fas fa-trash"></i></button>
            </div>
            ${option.soldOut ? `<div class="option-restock"><span>재입고일</span><input class="form-input" id="pf-opt-restock-${index}" type="date" value="${escAttr(option.restock)}"></div>` : ''}
          </div>`;
      }).join('')}
    </div>
    <div class="form-section">
      <h4>이미지 · 설명</h4>
      <div class="form-group">
        <label class="form-label">썸네일 이미지</label>
        ${productImageRow('thumb')}
      </div>
      <div class="form-group">
        <label class="form-label">상세 이미지</label>
        ${productImageRow('detail')}
      </div>
      <div class="form-group"><label class="form-label">설명</label><textarea class="form-input" id="pf-desc" rows="2">${escAttr(productDraft.description)}</textarea></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      ${productDraft.id && !productDraft.deleted ? `<button class="btn btn-outline" type="button" onclick="deleteProduct(${productDraft.id})">삭제</button>` : ''}
      ${productDraft.deleted ? `<button class="btn btn-outline" type="button" onclick="restoreProduct(${productDraft.id})">복구</button>` : ''}
      <button class="btn btn-primary" style="flex:1" onclick="submitProductForm()"><i class="fas fa-save"></i> 저장</button>
    </div>
  `;
}

function paintProductForm() {
  const html = productFormHtml();
  if (window.__adminModal) {
    const box = window.__adminModal.querySelector('.modal-box');
    box.classList.add('modal-wide');
    box.innerHTML = html;
    return;
  }
  showModal(html, true);
}

function openAddProductModal(brandId) {
  productDraft = blankProductDraft(brandId || '');
  paintProductForm();
}

function openEditProductModal(id) {
  const product = adminState.products.find((item) => item.id === id);
  if (!product) return;
  productDraft = draftFromProduct(product);
  paintProductForm();
}

function compressProductImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        let width = img.width;
        let height = img.height;
        const scale = Math.min(1, max / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function addProductImages(kind, input) {
  const files = Array.from(input.files || []).filter((file) => file.type.indexOf('image/') === 0);
  if (!files.length) return;
  readProductDraft();
  Promise.all(files.map(compressProductImage)).then((urls) => {
    if (kind === 'thumb') productDraft.imageUrl = urls[0] || '';
    else productDraft.detailImages = (productDraft.detailImages || []).concat(urls).slice(0, 8);
    paintProductForm();
  }).catch(() => showToast('이미지를 읽지 못했습니다', 'error'));
}

function removeProductImage(kind, index) {
  readProductDraft();
  if (kind === 'thumb') productDraft.imageUrl = '';
  else productDraft.detailImages.splice(index, 1);
  paintProductForm();
}

function toggleProductSalePeriod() {
  const custom = document.getElementById('pf-sale-period').value === 'CUSTOM';
  ['pf-sale-start', 'pf-sale-end'].forEach((id) => {
    const el = document.getElementById(id);
    el.disabled = !custom;
    if (!custom) el.value = '';
  });
}

function refreshProductPrices(source) {
  readProductDraft();
  if (source === 'rate') {
    productDraft.discountAmount = '';
    productDraft.discountSource = Number(productDraft.discountRate) > 0 ? 'RATE' : 'NONE';
    const amount = document.getElementById('pf-discount-amount');
    if (amount) amount.value = '';
  } else if (source === 'amount') {
    productDraft.discountRate = '';
    productDraft.discountSource = Number(productDraft.discountAmount) > 0 ? 'AMOUNT' : 'NONE';
    const rate = document.getElementById('pf-discount-rate');
    if (rate) rate.value = '';
  } else if (!Number(productDraft.discountRate) && !Number(productDraft.discountAmount)) {
    productDraft.discountSource = 'NONE';
  }
  const selling = currentSellingPrice();
  const supply = Number(productDraft.supplyPrice) || 0;
  const margin = selling - supply;
  const marginRate = selling > 0 ? Math.round(((selling - supply) / selling) * 1000) / 10 : null;
  const sellingEl = document.getElementById('pf-selling');
  const marginEl = document.getElementById('pf-margin');
  if (sellingEl) sellingEl.textContent = selling.toLocaleString() + '원';
  if (marginEl) marginEl.textContent = margin.toLocaleString() + '원' + (marginRate != null ? ' (' + marginRate + '%)' : '');
  productDraft.options.forEach((option, index) => {
    const cell = document.getElementById('pf-opt-selling-' + index);
    if (cell) cell.textContent = Math.max(0, selling + (Number(option.additional) || 0)).toLocaleString() + '원';
    if (!option.supplyTouched && source == null) {
      const supplyInput = document.getElementById('pf-opt-supply-' + index);
      if (supplyInput) supplyInput.value = productDraft.supplyPrice || '';
    }
  });
}

function touchProductOptionSupply(index) {
  productDraft.options[index].supplyTouched = true;
  readProductDraft();
}

function addProductOption() {
  readProductDraft();
  productDraft.options.push(emptyProductOption());
  paintProductForm();
}

function removeProductOption(index) {
  readProductDraft();
  productDraft.options.splice(index, 1);
  if (!productDraft.options.length) productDraft.options.push(emptyProductOption());
  paintProductForm();
}

function toggleProductOptionSoldOut(index) {
  readProductDraft();
  const option = productDraft.options[index];
  option.soldOut = !option.soldOut;
  if (!option.soldOut) option.restock = '';
  paintProductForm();
}

async function submitProductForm() {
  readProductDraft();
  const selling = currentSellingPrice();
  const discountValue = productDraft.discountSource === 'RATE'
    ? Number(productDraft.discountRate) || 0
    : productDraft.discountSource === 'AMOUNT' ? Number(productDraft.discountAmount) || 0 : 0;
  const body = {
    name: productDraft.name,
    brand_id: productDraft.brandId,
    category: productDraft.category,
    supply_price: productDraft.supplyPrice,
    original_price: productDraft.normalPrice,
    discount_type: productDraft.discountSource,
    discount_value: discountValue,
    vip_discount_price: selling,
    stock_quantity: productDraft.stock,
    min_order_quantity: productDraft.minOrder,
    purchase_unit: productDraft.purchaseUnit,
    max_purchase_quantity: productDraft.maxPurchase,
    earn_points_rate: productDraft.earnRate,
    point_use_disabled: productDraft.pointUseDisabled,
    sale_period: productDraft.salePeriod,
    sale_start_at: productDraft.saleStart,
    sale_end_at: productDraft.saleEnd,
    sale_status: productDraft.saleStatus || 'SELLING',
    image_url: productDraft.imageUrl,
    detail_image_urls: productDraft.detailImages || [],
    description: productDraft.description,
    options: productDraft.options.filter((option) => String(option.name || '').trim()).map((option) => ({
      id: option.id,
      name: option.name,
      supply_price: option.supplyTouched ? option.supplyPrice : (productDraft.supplyPrice || option.supplyPrice),
      additional_selling_price: option.additional,
      stock: option.stock,
      sold_out: option.soldOut,
      expected_restock_at: option.restock,
    })),
  };
  const res = productDraft.id
    ? await api('/api/products/' + productDraft.id, 'PUT', body)
    : await api('/api/products', 'POST', body);
  if (!res.success) { showToast(res.error || '저장하지 못했습니다', 'error'); return; }
  closeModal();
  showToast(productDraft.id ? '저장되었습니다' : '상품이 추가되었습니다', 'success');
  await loadPageData(adminState.page);
}

async function deleteProduct(id) {
  if (!confirm('삭제된 상품 목록으로 옮깁니다. 계속할까요?')) return;
  const res = await api(`/api/products/${id}`, 'DELETE');
  if (!res.success) { showToast(res.error || '삭제하지 못했습니다', 'error'); return; }
  closeModal();
  showToast('삭제된 상품으로 옮겼습니다', 'success');
  await loadPageData('products');
}

async function restoreProduct(id) {
  const res = await api('/api/products/' + id + '/restore', 'POST');
  if (!res.success) { showToast(res.error || '복구하지 못했습니다', 'error'); return; }
  closeModal();
  showToast('상품을 복구했습니다', 'success');
  await loadPageData('products');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((item) => item.some((value) => String(value).trim()));
}

function downloadProductTemplate() {
  downloadCsv('상품일괄등록.csv', [
    ['브랜드', '상품명', '카테고리', '공급가', '정상가', '판매가'],
    ['SUBLIMIC', '샘플 샴푸', '샴푸', '12000', '20000', '18000'],
  ]);
}

function openBulkProductModal() {
  window.__bulkProductRows = null;
  showModal(`
    <h3 style="font-size:18px;font-weight:800;margin-bottom:8px">상품 일괄 등록</h3>
    <p style="font-size:13px;color:#64748b;line-height:1.5">CSV 첫 줄은 브랜드, 상품명, 카테고리, 공급가, 정상가, 판매가입니다. 브랜드 이름은 등록된 브랜드와 같아야 하고, 카테고리는 샴푸·컨디셔너·트리트먼트·오일/세럼·스프레이·컬크림·왁스/젤 중 하나입니다.</p>
    <div style="margin:12px 0"><button class="ghost-btn" type="button" onclick="downloadProductTemplate()">양식 다운로드</button></div>
    <input type="file" accept=".csv,text/csv" onchange="readBulkProductFile(this)">
    <div id="bulk-product-result" style="margin-top:12px;font-size:13px;color:#334155"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-outline" style="flex:1" type="button" onclick="closeModal()">닫기</button>
      <button class="btn btn-primary" style="flex:1" type="button" onclick="runBulkProductUpload()">등록</button>
    </div>
  `);
}

function readBulkProductFile(input) {
  const file = input.files && input.files[0];
  const box = document.getElementById('bulk-product-result');
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result || ''));
    const head = (rows[0] || []).map((cell) => cell.trim());
    if (head[0] !== '브랜드' || head[1] !== '상품명') {
      window.__bulkProductRows = null;
      if (box) box.textContent = '첫 줄 헤더를 확인해 주세요. 양식 다운로드 파일을 사용하면 됩니다.';
      return;
    }
    window.__bulkProductRows = rows.slice(1);
    if (box) box.textContent = window.__bulkProductRows.length + '개 행을 읽었습니다.';
  };
  reader.readAsText(file, 'utf-8');
}

async function runBulkProductUpload() {
  const rows = window.__bulkProductRows || [];
  const box = document.getElementById('bulk-product-result');
  if (!rows.length) { if (box) box.textContent = 'CSV 파일을 먼저 선택해 주세요.'; return; }
  const brands = adminState.brands || [];
  let ok = 0;
  const errors = [];
  for (let index = 0; index < rows.length; index++) {
    const cells = rows[index];
    const brand = brands.find((item) => item.name === String(cells[0] || '').trim());
    const name = String(cells[1] || '').trim();
    const category = String(cells[2] || '').trim();
    const supply = Number(cells[3]);
    const normal = Number(cells[4]);
    const selling = Number(cells[5]);
    if (!brand || !name) { errors.push((index + 2) + '행: 브랜드 또는 상품명'); continue; }
    const discount = ProductCatalog.inferDiscount(normal, selling);
    const res = await api('/api/products', 'POST', {
      name: name,
      brand_id: brand.id,
      category: category,
      supply_price: supply,
      original_price: normal,
      vip_discount_price: selling,
      discount_type: discount.type,
      discount_value: discount.value,
      sale_status: 'SELLING',
      stock_quantity: '',
    });
    if (res.success) ok += 1;
    else errors.push((index + 2) + '행: ' + (res.error || '실패'));
  }
  if (box) box.textContent = ok + '개 등록' + (errors.length ? ' · ' + errors.slice(0, 5).join(' / ') : '');
  await loadPageData('products');
}

function openBulkImageModal() {
  window.__bulkImageFiles = [];
  showModal(`
    <h3 style="font-size:18px;font-weight:800;margin-bottom:8px">이미지 일괄 업로드</h3>
    <p style="font-size:13px;color:#64748b;line-height:1.5">파일 이름에서 확장자를 뺀 값이 상품번호와 같으면 썸네일입니다. 상품번호_2, 상품번호_3 은 상세 이미지로 붙습니다.</p>
    <div style="margin-top:12px"><input type="file" accept="image/*" multiple onchange="readBulkImageFiles(this)"></div>
    <div id="bulk-image-result" style="margin-top:12px;font-size:13px;color:#334155"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-outline" style="flex:1" type="button" onclick="closeModal()">닫기</button>
      <button class="btn btn-primary" style="flex:1" type="button" onclick="runBulkImageUpload()">업로드</button>
    </div>
  `);
}

function readBulkImageFiles(input) {
  window.__bulkImageFiles = input.files ? Array.from(input.files) : [];
  const box = document.getElementById('bulk-image-result');
  if (box) box.textContent = window.__bulkImageFiles.length + '개 이미지를 선택했습니다.';
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다'));
    reader.readAsDataURL(file);
  });
}

function productWriteBody(product, patch) {
  const discount = product.discount_type
    ? { type: product.discount_type, value: product.discount_value || 0 }
    : ProductCatalog.inferDiscount(product.original_price, product.vip_discount_price);
  return Object.assign({
    name: product.name,
    brand_id: product.brand_id,
    category: ProductCatalog.normalizeCategory(product) || product.category,
    supply_price: product.supply_price || 0,
    original_price: product.original_price,
    discount_type: discount.type,
    discount_value: discount.value,
    vip_discount_price: product.vip_discount_price,
    stock_quantity: product.stock_quantity >= ProductCatalog.UNLIMITED_STOCK ? '' : product.stock_quantity,
    min_order_quantity: product.min_order_quantity || 1,
    purchase_unit: product.purchase_unit || 1,
    max_purchase_quantity: product.max_purchase_quantity,
    earn_points_rate: product.earn_points_rate || 0,
    point_use_disabled: product.point_use_disabled,
    sale_period: product.sale_start_at || product.sale_end_at ? 'CUSTOM' : 'ALL',
    sale_start_at: product.sale_start_at || '',
    sale_end_at: product.sale_end_at || '',
    sale_status: product.sale_status || 'SELLING',
    image_url: product.image_url || '',
    detail_image_urls: Array.isArray(product.detail_image_urls) ? product.detail_image_urls.slice() : [],
    description: product.description || '',
    options: product.options || [],
  }, patch || {});
}

async function runBulkImageUpload() {
  const files = window.__bulkImageFiles || [];
  const box = document.getElementById('bulk-image-result');
  if (!files.length) { if (box) box.textContent = '이미지를 먼저 선택해 주세요.'; return; }
  const groups = {};
  files.forEach((file) => {
    const base = file.name.replace(/\.[^.]+$/, '');
    const detail = base.match(/^(.*)_(\d+)$/);
    const number = detail && Number(detail[2]) >= 2 ? detail[1] : base;
    const order = detail && Number(detail[2]) >= 2 ? Number(detail[2]) : 1;
    if (!groups[number]) groups[number] = [];
    groups[number].push({ file: file, detail: !!(detail && Number(detail[2]) >= 2), order: order });
  });
  let ok = 0;
  const errors = [];
  const numbers = Object.keys(groups);
  for (let i = 0; i < numbers.length; i++) {
    const number = numbers[i];
    const product = (adminState.products || []).find((item) => productNumber(item) === number && !item.deleted_at);
    if (!product) { errors.push(number + ': 상품번호 없음'); continue; }
    const images = groups[number].slice().sort((a, b) => a.order - b.order);
    let thumb = product.image_url || '';
    const details = Array.isArray(product.detail_image_urls) ? product.detail_image_urls.slice() : [];
    for (let j = 0; j < images.length; j++) {
      const url = await readImageFile(images[j].file);
      if (images[j].detail) details.push(url);
      else thumb = url;
    }
    const res = await api('/api/products/' + product.id, 'PUT', productWriteBody(product, {
      image_url: thumb,
      detail_image_urls: details.slice(0, 8),
    }));
    if (res.success) ok += 1;
    else errors.push(number + ': ' + (res.error || '실패'));
  }
  if (box) box.textContent = ok + '개 상품에 이미지를 넣었습니다' + (errors.length ? ' · ' + errors.slice(0, 5).join(' / ') : '');
  await loadPageData('products');
}

// ============================================================
// ORDERS PAGE
// ============================================================
function renderOrders() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <h2 style="font-size:18px;font-weight:700">주문 관리 (${adminState.orders.length}건)</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <select class="form-select" style="width:160px" onchange="filterOrders('salon_id',this.value)">
          <option value="">전체 살롱</option>
          ${adminState.salons.map(s => `<option value="${s.id}">${s.salon_name}</option>`).join('')}
        </select>
        <select class="form-select" style="width:140px" onchange="filterOrders('status',this.value)">
          <option value="">전체 상태</option>
          <option value="PAID">결제완료</option>
          <option value="PENDING">대기중</option>
          <option value="CANCELLED">취소됨</option>
        </select>
      </div>
    </div>
    <div class="panel">
      <table class="data-table">
        <thead>
          <tr><th>주문 #</th><th>고객</th><th>살롱</th><th>디자이너</th><th>금액</th><th>매장 정산</th><th>상태</th><th>일시</th></tr>
        </thead>
        <tbody id="orders-table-body">
          ${renderOrderRows(adminState.orders)}
        </tbody>
      </table>
    </div>
  `;
}

function renderOrderRows(orders) {
  return orders.map(o => `
    <tr>
      <td style="font-weight:700">#${o.id}</td>
      <td>${o.user_name}</td>
      <td style="font-size:13px">${o.salon_name}</td>
      <td>${o.designer_name || '<span style="color:#9ca3af;font-size:12px">없음</span>'}</td>
      <td style="font-weight:700;color:#e94560">${o.total_amount.toLocaleString()}원</td>
      <td style="color:#d4af37;font-weight:600">${Math.round((o.total_amount || 0) * 0.3).toLocaleString()}원</td>
      <td><span class="badge badge-${o.payment_status.toLowerCase()}">${{PAID:'결제완료',PENDING:'대기',CANCELLED:'취소',REFUNDED:'환불'}[o.payment_status]}</span></td>
      <td style="color:#9ca3af;font-size:12px">${new Date(o.created_at).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
    </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#9ca3af;padding:24px">주문 없음</td></tr>';
}

async function filterOrders(key, value) {
  adminState.filters[key] = value;
  const params = new URLSearchParams();
  if (adminState.filters.salon_id) params.set('salon_id', adminState.filters.salon_id);
  if (adminState.filters.status) params.set('status', adminState.filters.status);
  const res = await api(`/api/orders?${params}`);
  if (res.success) {
    const tbody = document.getElementById('orders-table-body');
    if (tbody) tbody.innerHTML = renderOrderRows(res.data);
  }
}

// ============================================================
// REVENUE PAGE
// ============================================================
function renderRevenue() {
  const s = adminState.stats;
  const gmv = s?.total_gmv || 0;
  const platform = s?.platform_revenue || 0;
  const salonComm = s?.total_salon_commission || 0;

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card blue">
        <div class="stat-icon blue"><i class="fas fa-chart-line"></i></div>
        <div class="stat-value">${(gmv/10000).toFixed(1)}만원</div>
        <div class="stat-label">총 GMV</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon red"><i class="fas fa-building"></i></div>
        <div class="stat-value">${(platform/10000).toFixed(1)}만원</div>
        <div class="stat-label">플랫폼 수익 (40%)</div>
      </div>
      <div class="stat-card gold">
        <div class="stat-icon gold"><i class="fas fa-handshake"></i></div>
        <div class="stat-value">${(salonComm/10000).toFixed(1)}만원</div>
        <div class="stat-label">원장 지급 합계 (30%)</div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title"><i class="fas fa-chart-pie"></i> 수익 구성 비율</span>
        </div>
        <div style="padding:24px">
          ${[
            {label:'플랫폼 수익',val:platform,pct:40,color:'#1a1a2e'},
            {label:'매장 원장 지급',val:salonComm,pct:30,color:'#d4af37'},
            {label:'기타(서비스 비용)',val:Math.max(0, gmv-platform-salonComm),pct:gmv>0?Math.round(Math.max(0, gmv-platform-salonComm)/gmv*100):0,color:'#9ca3af'},
          ].map(item => `
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:13px;font-weight:600;color:#374151;display:flex;align-items:center;gap:8px">
                <span style="width:10px;height:10px;border-radius:50%;background:${item.color};display:inline-block"></span>
                ${item.label}
              </span>
              <span style="font-size:13px;font-weight:700;color:#1a1a2e">${item.val.toLocaleString()}원 (${item.pct}%)</span>
            </div>
            <div style="background:#f3f4f6;border-radius:4px;height:8px;overflow:hidden">
              <div style="width:${item.pct}%;height:100%;background:${item.color};border-radius:4px;transition:width 0.5s"></div>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title"><i class="fas fa-store"></i> 살롱별 수익</span>
        </div>
        <div class="panel-body">
          <table class="data-table">
            <thead>
              <tr><th>살롱명</th><th>매출</th><th>수수료</th></tr>
            </thead>
            <tbody>
              ${(s?.salonBreakdown || []).map(sb => `
              <tr>
                <td style="font-weight:600">${sb.salon_name}</td>
                <td style="font-weight:700">${(sb.revenue||0).toLocaleString()}원</td>
                <td style="color:#d4af37;font-weight:600">${(sb.commission||0).toLocaleString()}원</td>
              </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#9ca3af;padding:24px">데이터 없음</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Commission Rule Panel -->
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title"><i class="fas fa-book"></i> 수익 배분 정책</span>
      </div>
      <div style="padding:24px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
          ${[
            {label:'VIP 할인율',val:'30% OFF',desc:'정가 대비 VIP 할인',color:'#e94560'},
            {label:'플랫폼',val:'40%',desc:'거래금액의 40%',color:'#1a1a2e'},
            {label:'매장 원장',val:'30%',desc:'판매 매출 기준',color:'#d4af37'},
          ].map(item => `
          <div style="text-align:center;background:#f9fafb;border-radius:14px;padding:16px">
            <div style="font-size:26px;font-weight:400;color:${item.color}">${item.val}</div>
            <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-top:4px">${item.label}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:2px">${item.desc}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// MODAL HELPERS
// ============================================================
function showModal(content, wide) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box${wide ? ' modal-wide' : ''}">${content}</div>`;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  document.body.appendChild(overlay);
  window.__adminModal = overlay;
}

function closeModal() {
  if (window.__adminModal) { window.__adminModal.remove(); window.__adminModal = null; }
}

function attachAdminListeners() {}

// ============================================================
// DATA LOADING
// ============================================================
async function loadPageData(page) {
  switch(page) {
    case 'dashboard':
      await Promise.all([
        api('/api/orders/stats').then(r => { if (r.success) adminState.stats = r.data; }),
        api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; }),
        api('/api/designers').then(r => { if (r.success) adminState.designers = r.data; }),
        api('/api/users').then(r => { if (r.success) adminState.users = r.data; }),
        api('/api/orders').then(r => { if (r.success) adminState.orders = r.data; }),
      ]);
      break;
    case 'salons':
      await Promise.all([
        api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; }),
        api('/api/brands').then(r => { if (r.success) adminState.brands = r.data; }),
      ]);
      break;
    case 'designers':
      await Promise.all([
        api('/api/designers').then(r => { if (r.success) adminState.designers = r.data; }),
        api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; }),
      ]);
      break;
    case 'users':
      await Promise.all([
        api('/api/users').then(r => { if (r.success) adminState.users = r.data; }),
        api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; }),
        api('/api/orders').then(r => { if (r.success) adminState.orders = r.data; }),
        api('/api/coupons').then(r => { if (r.success) adminState.coupons = r.data; }),
      ]);
      break;
    case 'products':
      await Promise.all([
        api('/api/products?admin=1').then(r => { if (r.success) adminState.products = r.data; }),
        api('/api/brands').then(r => { if (r.success) adminState.brands = r.data; }),
      ]);
      break;
    case 'orders':
      await Promise.all([
        api('/api/orders').then(r => { if (r.success) adminState.orders = r.data; }),
        api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; }),
        api('/api/brands').then(r => { if (r.success) adminState.brands = r.data; }),
        api('/api/products').then(r => { if (r.success) adminState.products = r.data; }),
      ]);
      break;
    case 'brands':
      await Promise.all([
        api('/api/brands').then(r => { if (r.success) adminState.brands = r.data; }),
        api('/api/products').then(r => { if (r.success) adminState.products = r.data; }),
        api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; }),
      ]);
      break;
    case 'coupons':
      await Promise.all([
        api('/api/coupons').then(r => { if (r.success) adminState.coupons = r.data; }),
        api('/api/brands').then(r => { if (r.success) adminState.brands = r.data; }),
        api('/api/users').then(r => { if (r.success) adminState.users = r.data; }),
        api('/api/orders').then(r => { if (r.success) adminState.orders = r.data; }),
      ]);
      break;
    case 'points':
      await Promise.all([
        api('/api/points').then(r => { if (r.success) adminState.points = r.data; }),
        api('/api/users').then(r => { if (r.success) adminState.users = r.data; }),
        api('/api/orders').then(r => { if (r.success) adminState.orders = r.data; }),
        api('/api/points/blocked').then(r => { if (r.success) adminState.blockedProducts = r.data; }),
      ]);
      break;
    case 'banners':
    case 'mid-banners':
      await api('/api/banners').then(r => { if (r.success) adminState.banners = r.data; });
      break;
    case 'settlements': {
      const params = new URLSearchParams();
      if (adminState.settlementMonth) params.set('month', adminState.settlementMonth);
      if (adminState.settlementSalon && adminState.settlementSalon !== 'ALL') params.set('salon_id', adminState.settlementSalon);
      await Promise.all([
        api('/api/settlements?' + params).then(r => {
          if (r.success) {
            adminState.settlements = r.data;
            adminState.settlementMonth = r.data.month;
          }
        }),
        api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; }),
      ]);
      break;
    }
    case 'revenue':
      await Promise.all([
        api('/api/orders/stats').then(r => { if (r.success) adminState.stats = r.data; }),
        api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; }),
      ]);
      break;
  }
  renderAdmin();
}

// ============================================================
// INIT
// ============================================================
async function initAdmin() {
  const pages = ['dashboard', 'salons', 'designers', 'brands', 'products', 'users', 'orders', 'coupons', 'points', 'banners', 'mid-banners', 'settlements', 'revenue'];
  const startPage = (location.hash || '#dashboard').replace('#', '') || 'dashboard';
  adminState.page = pages.includes(startPage) ? startPage : 'dashboard';
  renderAdmin();
  await api('/api/init-db', 'POST');
  await api('/api/seed-db', 'POST');
  await loadPageData(adminState.page);
}

// Handle admin route
const path = window.location.pathname;
initAdmin();
