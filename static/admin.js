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

function escAttr(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderProducts() {
  return `
    <div style="display:flex;justify-content:space-between;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:700">서비스/상품 (${adminState.products.length}개)</h2>
      <button class="btn btn-accent" onclick="openAddProductModal()"><i class="fas fa-plus"></i> 상품 추가</button>
    </div>
    <div class="panel">
      <table class="data-table">
        <thead>
          <tr><th>상품명</th><th>브랜드</th><th>카테고리</th><th>공급가</th><th>정가</th><th>판매가</th><th>재고</th><th>관리</th></tr>
        </thead>
        <tbody>
          ${adminState.products.map(p => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <img src="${escAttr(p.image_url || '')}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;background:#f3f4f6"
                     onerror="this.style.display='none'">
                <span style="font-weight:600">${escAttr(p.name)}</span>
              </div>
            </td>
            <td>${escAttr(productBrandLabel(p.brand_id))}</td>
            <td><span class="badge" style="background:#f3f4f6;color:#374151">${escAttr(productCategoryLabel(p))}</span></td>
            <td>${p.supply_price ? p.supply_price.toLocaleString() + '원' : '-'}</td>
            <td style="text-decoration:line-through;color:#9ca3af">${p.original_price.toLocaleString()}원</td>
            <td style="font-weight:600;color:#e94560">${p.vip_discount_price.toLocaleString()}원</td>
            <td><span style="color:${p.stock_quantity < 5 ? '#dc2626' : '#16a34a'};font-weight:600">${stockLabel(p.stock_quantity)}</span></td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="openEditProductModal(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#9ca3af;padding:24px">상품 없음</td></tr>'}
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
    salePeriod: 'ALL', saleStart: '', saleEnd: '', imageUrl: '', detailImages: [], description: '',
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
      <div class="price-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="form-group"><label class="form-label">재고 수량</label><input class="form-input price-input" id="pf-stock" type="number" min="0" placeholder="제한없음" value="${escAttr(productDraft.stock)}"></div>
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
      <button class="btn btn-accent" style="flex:1" onclick="submitProductForm()"><i class="fas fa-save"></i> 저장</button>
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
      await Promise.all([
        api('/api/products').then(r => { if (r.success) adminState.products = r.data; }),
        api('/api/brands').then(r => { if (r.success) adminState.brands = r.data; }),
      ]);
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
