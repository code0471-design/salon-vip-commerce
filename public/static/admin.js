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
    { id: 'products', icon: 'fa-box', label: '서비스/상품', section: null },
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
    products: '서비스/상품 관리',
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
function renderUsers() {
  return `
    <div style="display:flex;justify-content:space-between;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:700">고객 목록 (${adminState.users.length}명)</h2>
      <p style="font-size:12px;color:#6b7280;margin-top:4px">최근 가입 순</p>
      <select class="form-select" style="width:180px" onchange="filterUsers(this.value)">
        <option value="">전체 살롱</option>
        ${adminState.salons.map(s => `<option value="${s.id}">${s.salon_name}</option>`).join('')}
      </select>
    </div>
    <div class="panel">
      <table class="data-table">
        <thead>
          <tr><th>고객</th><th>연락처</th><th>소속 살롱</th><th>담당 디자이너</th><th>가입일</th></tr>
        </thead>
        <tbody id="user-table-body">
          ${renderUserRows(adminState.users)}
        </tbody>
      </table>
    </div>
  `;
}

function renderUserRows(users) {
  return users.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#1a1a2e,#0f3460);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0">
            ${u.name.charAt(0)}
          </div>
          <div>
            <div style="font-weight:600">${u.name}</div>
            <div style="font-size:11px;color:#9ca3af">ID: ${u.id}</div>
          </div>
        </div>
      </td>
      <td style="color:#6b7280">${u.phone || '-'}</td>
      <td>${u.salon_name ? `<span class="badge badge-active">${u.salon_name}</span>` : '<span style="color:#9ca3af">미등록</span>'}</td>
      <td>${u.designer_name || '<span style="color:#9ca3af">없음</span>'}</td>
      <td style="color:#9ca3af;font-size:12px">${new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:24px">고객 없음</td></tr>';
}

async function filterUsers(salonId) {
  const res = await api(`/api/users${salonId ? '?salon_id=' + salonId : ''}`);
  if (res.success) {
    const tbody = document.getElementById('user-table-body');
    if (tbody) tbody.innerHTML = renderUserRows(res.data);
  }
}

// ============================================================
// PRODUCTS PAGE
// ============================================================
function renderProducts() {
  return `
    <div style="display:flex;justify-content:space-between;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:700">서비스/상품 (${adminState.products.length}개)</h2>
      <button class="btn btn-accent" onclick="openAddProductModal()"><i class="fas fa-plus"></i> 상품 추가</button>
    </div>
    <div class="panel">
      <table class="data-table">
        <thead>
          <tr><th>상품명</th><th>카테고리</th><th>정가</th><th>VIP 할인가</th><th>재고</th><th>관리</th></tr>
        </thead>
        <tbody>
          ${adminState.products.map(p => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <img src="${p.image_url || ''}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;background:#f3f4f6"
                     onerror="this.style.display='none'">
                <span style="font-weight:600">${p.name}</span>
              </div>
            </td>
            <td><span class="badge" style="background:#f3f4f6;color:#374151">${p.category}</span></td>
            <td style="text-decoration:line-through;color:#9ca3af">${p.original_price.toLocaleString()}원</td>
            <td style="font-weight:700;color:#e94560">${p.vip_discount_price.toLocaleString()}원</td>
            <td>
              <span style="color:${p.stock_quantity < 5 ? '#dc2626' : '#16a34a'};font-weight:600">${p.stock_quantity}</span>
            </td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="openEditProductModal(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px">상품 없음</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

async function openAddProductModal() {
  showModal(`
    <h3 style="font-size:18px;font-weight:800;margin-bottom:20px">상품/서비스 추가</h3>
    <div class="form-group"><label class="form-label">상품명 *</label><input class="form-input" id="m-p-name" placeholder="케라틴 트리트먼트"></div>
    <div class="form-group">
      <label class="form-label">카테고리 *</label>
      <select class="form-select" id="m-p-cat">
        ${['샴푸','컨디셔너','트리트먼트','오일&세럼','스타일링'].map(c => `<option>${c}</option>`).join('')}
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">정가 *</label><input class="form-input" id="m-p-price" type="number" placeholder="100000"></div>
      <div class="form-group"><label class="form-label">VIP가 *</label><input class="form-input" id="m-p-vip" type="number" placeholder="70000"></div>
    </div>
    <div class="form-group"><label class="form-label">재고</label><input class="form-input" id="m-p-stock" type="number" value="50"></div>
    <div class="form-group"><label class="form-label">이미지 URL</label><input class="form-input" id="m-p-img" placeholder="https://..."></div>
    <div class="form-group"><label class="form-label">설명</label><textarea class="form-input" id="m-p-desc" rows="2"></textarea></div>
    <div style="display:flex;gap:10px;margin-top:24px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-accent" style="flex:1" onclick="submitAddProduct()"><i class="fas fa-plus"></i> 추가</button>
    </div>
  `);
}

async function submitAddProduct() {
  const body = {
    name: document.getElementById('m-p-name').value,
    category: document.getElementById('m-p-cat').value,
    original_price: parseFloat(document.getElementById('m-p-price').value),
    vip_discount_price: parseFloat(document.getElementById('m-p-vip').value),
    stock_quantity: parseInt(document.getElementById('m-p-stock').value) || 50,
    image_url: document.getElementById('m-p-img').value,
    description: document.getElementById('m-p-desc').value
  };
  if (!body.name || !body.original_price || !body.vip_discount_price) { showToast('필수 항목을 입력하세요', 'error'); return; }
  const res = await api('/api/products', 'POST', body);
  if (res.success) { closeModal(); showToast('상품이 추가되었습니다', 'success'); await loadPageData('products'); }
}

async function openEditProductModal(id) {
  const p = adminState.products.find(x => x.id === id);
  if (!p) return;
  showModal(`
    <h3 style="font-size:18px;font-weight:800;margin-bottom:20px">상품 편집</h3>
    <div class="form-group"><label class="form-label">상품명</label><input class="form-input" id="m-p-name" value="${p.name}"></div>
    <div class="form-group">
      <label class="form-label">카테고리</label>
      <select class="form-select" id="m-p-cat">
        ${['샴푸','컨디셔너','트리트먼트','오일&세럼','스타일링'].map(c => `<option ${c===p.category?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">정가</label><input class="form-input" id="m-p-price" type="number" value="${p.original_price}"></div>
      <div class="form-group"><label class="form-label">VIP가</label><input class="form-input" id="m-p-vip" type="number" value="${p.vip_discount_price}"></div>
    </div>
    <div class="form-group"><label class="form-label">재고</label><input class="form-input" id="m-p-stock" type="number" value="${p.stock_quantity}"></div>
    <div style="display:flex;gap:10px;margin-top:24px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-primary" style="flex:1" onclick="submitEditProduct(${id})"><i class="fas fa-save"></i> 저장</button>
    </div>
  `);
}

async function submitEditProduct(id) {
  const p = adminState.products.find(x => x.id === id);
  const body = {
    name: document.getElementById('m-p-name').value,
    category: document.getElementById('m-p-cat').value,
    original_price: parseFloat(document.getElementById('m-p-price').value),
    vip_discount_price: parseFloat(document.getElementById('m-p-vip').value),
    stock_quantity: parseInt(document.getElementById('m-p-stock').value),
    image_url: p?.image_url, description: p?.description, is_active: 1
  };
  await api(`/api/products/${id}`, 'PUT', body);
  closeModal(); showToast('저장되었습니다', 'success'); await loadPageData('products');
}

async function deleteProduct(id) {
  if (!confirm('이 상품을 비활성화하시겠습니까?')) return;
  await api(`/api/products/${id}`, 'DELETE');
  showToast('비활성화되었습니다', 'success'); await loadPageData('products');
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
function showModal(content) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box">${content}</div>`;
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
      await api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; });
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
      ]);
      break;
    case 'products':
      await api('/api/products').then(r => { if (r.success) adminState.products = r.data; });
      break;
    case 'orders':
      await Promise.all([
        api('/api/orders').then(r => { if (r.success) adminState.orders = r.data; }),
        api('/api/salons').then(r => { if (r.success) adminState.salons = r.data; }),
      ]);
      break;
    case 'brands':
      await Promise.all([
        api('/api/brands').then(r => { if (r.success) adminState.brands = r.data; }),
        api('/api/products').then(r => { if (r.success) adminState.products = r.data; }),
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
