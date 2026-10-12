const SHIP_LABEL = { READY: '배송준비', SHIPPING: '배송중', DELIVERED: '배송완료' };
const SHIP_NEXT = { READY: 'SHIPPING', SHIPPING: 'DELIVERED' };
const SETTLE_LABEL = { PENDING: '정산예정', CONFIRMED: '정산확정', PAID: '지급완료' };

function money(value) {
  return (value || 0).toLocaleString() + '원';
}

function brandName(id) {
  return (adminState.brands || []).find((brand) => brand.id === id)?.name || '전체';
}

function renderShippingOrders() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px">
      <div>
        <h2 style="font-size:18px;font-weight:700">주문/배송 (${adminState.orders.length}건)</h2>
        <p style="font-size:12px;color:#6b7280;margin-top:4px">결제 뒤 배송준비, 배송중, 배송완료로 넘깁니다.</p>
      </div>
    </div>
    <div class="panel">
      <table class="data-table">
        <thead>
          <tr><th>주문</th><th>고객</th><th>매장</th><th>디자이너</th><th>결제금액</th><th>배송</th><th></th></tr>
        </thead>
        <tbody>
          ${adminState.orders.map((order) => `
            <tr>
              <td style="font-weight:400">#${order.id}<div style="color:#9ca3af;font-size:12px">${order.created_at}</div></td>
              <td>${order.user_name}</td>
              <td>${order.salon_name}</td>
              <td>${order.designer_name || '담당 없음'}${order.designer_status === 'RESIGNED' ? ' <span class="badge badge-resigned">퇴사</span>' : ''}</td>
              <td>${money(order.total_amount)}</td>
              <td><span class="badge badge-${(order.shipping_status || 'READY').toLowerCase()}">${SHIP_LABEL[order.shipping_status] || '배송준비'}</span></td>
              <td>${SHIP_NEXT[order.shipping_status] ? `<button class="btn btn-sm btn-outline" onclick="advanceShipping(${order.id}, '${SHIP_NEXT[order.shipping_status]}')">${SHIP_LABEL[SHIP_NEXT[order.shipping_status]]}</button>` : ''}</td>
            </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:24px">주문이 없습니다</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

async function advanceShipping(id, status) {
  const res = await api(`/api/orders/${id}/shipping`, 'PUT', { shipping_status: status });
  if (res.success) {
    showToast('배송 상태를 바꿨습니다', 'success');
    await loadPageData('orders');
  }
}

function renderBrands() {
  const brands = adminState.brands || [];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <h2 style="font-size:18px;font-weight:700">브랜드 (${brands.length})</h2>
        <p style="font-size:12px;color:#6b7280;margin-top:4px">브랜드를 고르고 그 브랜드 상품을 등록합니다. 수수료는 브랜드 설정이고, 정산 지급 대상은 아닙니다.</p>
      </div>
      <button class="btn btn-accent" onclick="openAddBrand()"><i class="fas fa-plus"></i> 브랜드 추가</button>
    </div>
    ${brands.map((brand) => `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">${brand.name}</span>
          <span style="font-size:13px;color:#6b7280">브랜드 수수료 ${(brand.commission_rate * 100).toFixed(0)}%</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;gap:8px;margin-bottom:14px">
            <input class="form-input" id="brand-rate-${brand.id}" type="number" value="${Math.round(brand.commission_rate * 100)}" style="max-width:120px" min="0" max="100">
            <button class="btn btn-outline" onclick="saveBrandRate(${brand.id})">수수료 저장</button>
          </div>
          <table class="data-table">
            <thead><tr><th>상품</th><th>정가</th><th>VIP가</th><th>재고</th></tr></thead>
            <tbody>
              ${(adminState.products || []).filter((product) => product.brand_id === brand.id).map((product) => `
                <tr>
                  <td>${product.name}</td>
                  <td>${money(product.original_price)}</td>
                  <td>${money(product.vip_discount_price)}</td>
                  <td>${product.stock_quantity}</td>
                </tr>`).join('') || '<tr><td colspan="4" style="color:#9ca3af">등록된 상품이 없습니다</td></tr>'}
            </tbody>
          </table>
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;margin-top:12px">
            <input class="form-input" id="bp-name-${brand.id}" placeholder="상품명">
            <input class="form-input" id="bp-price-${brand.id}" type="number" placeholder="정가">
            <input class="form-input" id="bp-vip-${brand.id}" type="number" placeholder="VIP가">
            <input class="form-input" id="bp-cat-${brand.id}" placeholder="카테고리" value="샴푸">
            <button class="btn btn-primary" onclick="addBrandProduct(${brand.id})">상품 등록</button>
          </div>
        </div>
      </div>`).join('')}
  `;
}

function openAddBrand() {
  showModal(`
    <h3 style="font-size:18px;font-weight:700;margin-bottom:16px">브랜드 추가</h3>
    <div class="form-group"><label class="form-label">브랜드명</label><input class="form-input" id="m-brand-name"></div>
    <div class="form-group"><label class="form-label">브랜드 수수료 %</label><input class="form-input" id="m-brand-rate" type="number" value="10"></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-accent" style="flex:1" onclick="submitBrand()">추가</button>
    </div>`);
}

async function submitBrand() {
  const res = await api('/api/brands', 'POST', {
    name: document.getElementById('m-brand-name').value,
    commission_rate: (parseFloat(document.getElementById('m-brand-rate').value) || 0) / 100,
  });
  if (res.success) { closeModal(); showToast('브랜드를 추가했습니다', 'success'); await loadPageData('brands'); }
}

async function saveBrandRate(id) {
  const rate = (parseFloat(document.getElementById('brand-rate-' + id).value) || 0) / 100;
  const res = await api('/api/brands/' + id, 'PUT', { commission_rate: rate });
  if (res.success) { showToast('브랜드 수수료를 저장했습니다', 'success'); await loadPageData('brands'); }
}

async function addBrandProduct(brandId) {
  const res = await api('/api/products', 'POST', {
    name: document.getElementById('bp-name-' + brandId).value,
    original_price: document.getElementById('bp-price-' + brandId).value,
    vip_discount_price: document.getElementById('bp-vip-' + brandId).value,
    category: document.getElementById('bp-cat-' + brandId).value || '기타',
    brand_id: brandId,
  });
  if (!res.success) { showToast(res.error || '상품을 등록하지 못했습니다', 'error'); return; }
  await api('/api/products/' + res.data.id, 'PUT', { brand_id: brandId });
  showToast('상품을 등록했습니다', 'success');
  await loadPageData('brands');
}

function renderCoupons() {
  const coupons = adminState.coupons || [];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <h2 style="font-size:18px;font-weight:700">쿠폰 (${coupons.length})</h2>
        <p style="font-size:12px;color:#6b7280;margin-top:4px">정액 또는 정률, 전체 상품 또는 브랜드 지정.</p>
      </div>
      <button class="btn btn-accent" onclick="openAddCoupon()"><i class="fas fa-plus"></i> 쿠폰 추가</button>
    </div>
    <div class="panel"><table class="data-table">
      <thead><tr><th>쿠폰</th><th>코드</th><th>할인</th><th>적용</th><th>기간</th><th>상태</th><th></th></tr></thead>
      <tbody>
        ${coupons.map((coupon) => `
          <tr>
            <td>${coupon.name}</td>
            <td>${coupon.code}</td>
            <td>${coupon.discount_type === 'RATE' ? coupon.discount_value + '%' : money(coupon.discount_value)}</td>
            <td>${coupon.apply_scope === 'BRAND' ? brandName(coupon.brand_id) : '전체 상품'}</td>
            <td>${coupon.starts_at} ~ ${coupon.ends_at || '상시'}</td>
            <td>${coupon.status === 'ACTIVE' ? '진행중' : '중지'}</td>
            <td>${coupon.status === 'ACTIVE' ? `<button class="btn btn-sm btn-outline" onclick="stopCoupon(${coupon.id})">중지</button>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:24px">쿠폰이 없습니다</td></tr>'}
      </tbody>
    </table></div>`;
}

function openAddCoupon() {
  showModal(`
    <h3 style="font-size:18px;font-weight:700;margin-bottom:16px">쿠폰 추가</h3>
    <div class="form-group"><label class="form-label">쿠폰명</label><input class="form-input" id="m-cp-name"></div>
    <div class="form-group"><label class="form-label">할인 방식</label>
      <select class="form-select" id="m-cp-type"><option value="AMOUNT">정액</option><option value="RATE">정률 %</option></select>
    </div>
    <div class="form-group"><label class="form-label">할인 값</label><input class="form-input" id="m-cp-value" type="number"></div>
    <div class="form-group"><label class="form-label">적용 브랜드</label>
      <select class="form-select" id="m-cp-brand"><option value="">전체 상품</option>${(adminState.brands || []).map((brand) => `<option value="${brand.id}">${brand.name}</option>`).join('')}</select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="form-group"><label class="form-label">시작</label><input class="form-input" id="m-cp-start" type="date"></div>
      <div class="form-group"><label class="form-label">종료</label><input class="form-input" id="m-cp-end" type="date"></div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-accent" style="flex:1" onclick="submitCoupon()">추가</button>
    </div>`);
}

async function submitCoupon() {
  const brand = document.getElementById('m-cp-brand').value;
  const res = await api('/api/coupons', 'POST', {
    name: document.getElementById('m-cp-name').value,
    discount_type: document.getElementById('m-cp-type').value,
    discount_value: document.getElementById('m-cp-value').value,
    brand_id: brand || null,
    starts_at: document.getElementById('m-cp-start').value,
    ends_at: document.getElementById('m-cp-end').value,
  });
  if (res.success) { closeModal(); showToast('쿠폰을 추가했습니다', 'success'); await loadPageData('coupons'); }
  else showToast(res.error || '추가하지 못했습니다', 'error');
}

async function stopCoupon(id) {
  await api('/api/coupons/' + id, 'DELETE');
  showToast('쿠폰을 중지했습니다', 'success');
  await loadPageData('coupons');
}

function renderPoints() {
  const grants = adminState.points || [];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <h2 style="font-size:18px;font-weight:700">포인트</h2>
        <p style="font-size:12px;color:#6b7280;margin-top:4px">고객에게 즉시 지급하거나 차감합니다.</p>
      </div>
      <button class="btn btn-accent" onclick="openAddPoint()"><i class="fas fa-plus"></i> 지급/차감</button>
    </div>
    <div class="panel"><table class="data-table">
      <thead><tr><th>일시</th><th>고객</th><th>금액</th><th>사유</th><th>상태</th></tr></thead>
      <tbody>
        ${grants.map((grant) => `
          <tr>
            <td>${grant.created_at}</td>
            <td>${grant.user_name}</td>
            <td style="color:${grant.amount < 0 ? '#dc2626' : '#111827'}">${grant.amount > 0 ? '+' : ''}${grant.amount.toLocaleString()}P</td>
            <td>${grant.reason}</td>
            <td>${grant.status === 'COMPLETED' ? '지급완료' : '예약됨'}</td>
          </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:24px">내역이 없습니다</td></tr>'}
      </tbody>
    </table></div>`;
}

function openAddPoint() {
  showModal(`
    <h3 style="font-size:18px;font-weight:700;margin-bottom:16px">포인트 지급/차감</h3>
    <div class="form-group"><label class="form-label">고객</label>
      <select class="form-select" id="m-pt-user">${(adminState.users || []).map((user) => `<option value="${user.id}">${user.name}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label class="form-label">구분</label>
      <select class="form-select" id="m-pt-dir"><option value="GRANT">지급</option><option value="DEDUCT">차감</option></select>
    </div>
    <div class="form-group"><label class="form-label">포인트</label><input class="form-input" id="m-pt-amt" type="number"></div>
    <div class="form-group"><label class="form-label">사유</label><input class="form-input" id="m-pt-reason" placeholder="첫 구매 적립"></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-accent" style="flex:1" onclick="submitPoint()">저장</button>
    </div>`);
}

async function submitPoint() {
  const res = await api('/api/points', 'POST', {
    user_id: document.getElementById('m-pt-user').value,
    direction: document.getElementById('m-pt-dir').value,
    amount: document.getElementById('m-pt-amt').value,
    reason: document.getElementById('m-pt-reason').value,
  });
  if (res.success) { closeModal(); showToast('포인트를 반영했습니다', 'success'); await loadPageData('points'); }
  else showToast(res.error || '반영하지 못했습니다', 'error');
}

function renderBanners(type) {
  const banners = (adminState.banners || []).filter((banner) => banner.banner_type === type);
  const label = type === 'MAIN' ? '메인 배너' : '가로 배너';
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <h2 style="font-size:18px;font-weight:700">${label}</h2>
        <p style="font-size:12px;color:#6b7280;margin-top:4px">노출 기간이 있는 배너입니다.</p>
      </div>
      <button class="btn btn-accent" onclick="openAddBanner('${type}')"><i class="fas fa-plus"></i> 배너 추가</button>
    </div>
    <div class="panel"><table class="data-table">
      <thead><tr><th>순서</th><th>제목</th><th>기간</th><th>상태</th><th></th></tr></thead>
      <tbody>
        ${banners.map((banner) => `
          <tr>
            <td>${banner.sort_order}</td>
            <td>${banner.title}</td>
            <td>${banner.starts_at} ~ ${banner.ends_at || '상시'}</td>
            <td>${banner.status === 'ACTIVE' ? '노출중' : '중지'}</td>
            <td>${banner.status === 'ACTIVE' ? `<button class="btn btn-sm btn-outline" onclick="stopBanner(${banner.id}, '${type}')">중지</button>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:24px">배너가 없습니다</td></tr>'}
      </tbody>
    </table></div>`;
}

function openAddBanner(type) {
  showModal(`
    <h3 style="font-size:18px;font-weight:700;margin-bottom:16px">${type === 'MAIN' ? '메인' : '가로'} 배너 추가</h3>
    <div class="form-group"><label class="form-label">제목</label><input class="form-input" id="m-bn-title"></div>
    <div class="form-group"><label class="form-label">이미지 URL</label><input class="form-input" id="m-bn-img" placeholder="https://"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="form-group"><label class="form-label">시작</label><input class="form-input" id="m-bn-start" type="date"></div>
      <div class="form-group"><label class="form-label">종료</label><input class="form-input" id="m-bn-end" type="date"></div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-accent" style="flex:1" onclick="submitBanner('${type}')">추가</button>
    </div>`);
}

async function submitBanner(type) {
  const res = await api('/api/banners', 'POST', {
    banner_type: type,
    title: document.getElementById('m-bn-title').value,
    image_url: document.getElementById('m-bn-img').value,
    starts_at: document.getElementById('m-bn-start').value,
    ends_at: document.getElementById('m-bn-end').value,
  });
  if (res.success) {
    closeModal();
    showToast('배너를 추가했습니다', 'success');
    await loadPageData(type === 'MAIN' ? 'banners' : 'mid-banners');
  } else showToast(res.error || '추가하지 못했습니다', 'error');
}

async function stopBanner(id, type) {
  await api('/api/banners/' + id, 'DELETE');
  showToast('배너를 중지했습니다', 'success');
  await loadPageData(type === 'MAIN' ? 'banners' : 'mid-banners');
}

function renderStoreSettlements() {
  const data = adminState.settlements || { month: '', months: [], rows: [] };
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;gap:12px;flex-wrap:wrap">
      <div>
        <h2 style="font-size:18px;font-weight:700">매장 정산</h2>
        <p style="font-size:12px;color:#6b7280;margin-top:4px">판매 매출 기준, 월별. 원장에게 30%를 지급하고 디자이너 정산은 없습니다.</p>
      </div>
      <select class="form-select" style="width:160px" onchange="changeSettlementMonth(this.value)">
        ${(data.months || []).map((month) => `<option value="${month}" ${month === data.month ? 'selected' : ''}>${month}</option>`).join('')}
      </select>
    </div>
    <div class="note-bar">지급 대상은 매장 원장입니다. 브랜드 수수료는 브랜드 관리에서만 설정합니다. 디자이너가 퇴사해도 해당 매출 줄에는 그 디자이너 이름이 남습니다.</div>
    ${(data.rows || []).map((row) => `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">${row.salon_name} · ${row.owner_name}</span>
          <span class="badge badge-${row.status === 'PAID' ? 'paid' : row.status === 'CONFIRMED' ? 'active' : 'pending'}">${SETTLE_LABEL[row.status]}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 20px 0">
          <div><div style="font-size:12px;color:#6b7280">판매 매출</div><div style="font-size:18px;font-weight:400">${money(row.sales)}</div></div>
          <div><div style="font-size:12px;color:#6b7280">주문</div><div style="font-size:18px;font-weight:400">${row.orders}건</div></div>
          <div><div style="font-size:12px;color:#6b7280">원장 지급 30%</div><div style="font-size:18px;font-weight:400">${money(row.payout)}</div></div>
          <div><div style="font-size:12px;color:#6b7280">디자이너 정산</div><div style="font-size:18px;font-weight:400">0원</div></div>
        </div>
        <div class="panel-body">
          <table class="data-table">
            <thead><tr><th>주문</th><th>고객</th><th>디자이너</th><th>매출</th><th>디자이너 지급</th></tr></thead>
            <tbody>
              ${row.lines.map((line) => `
                <tr>
                  <td>#${line.order_id}<div style="color:#9ca3af;font-size:12px">${line.created_at}</div></td>
                  <td>${line.user_name}</td>
                  <td>${line.designer_name || '담당 없음'}${line.designer_status === 'RESIGNED' ? ' <span class="badge badge-resigned">퇴사</span>' : ''}</td>
                  <td>${money(line.sales)}</td>
                  <td>0원</td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div style="display:flex;gap:8px;margin-top:12px">
            ${row.status === 'PENDING' ? `<button class="btn btn-outline" onclick="setSettlementStatus('${row.id}','CONFIRMED')">정산확정</button>` : ''}
            ${row.status === 'CONFIRMED' ? `<button class="btn btn-primary" onclick="setSettlementStatus('${row.id}','PAID')">지급완료</button>` : ''}
          </div>
        </div>
      </div>`).join('') || '<div class="panel"><div class="panel-body" style="color:#9ca3af">이 달에 정산할 매출이 없습니다</div></div>'}
  `;
}

async function changeSettlementMonth(month) {
  adminState.settlementMonth = month;
  await loadPageData('settlements');
}

async function setSettlementStatus(id, status) {
  const res = await api('/api/settlements/status', 'POST', { id, status });
  if (res.success) { showToast(SETTLE_LABEL[status] + '로 바꿨습니다', 'success'); await loadPageData('settlements'); }
}

function renderOwnerApp() {
  const salon = (adminState.salons || []).find((item) => item.id === 1) || (adminState.salons || [])[0];
  const designers = (adminState.designers || []).filter((item) => salon && item.salon_id === salon.id);
  const row = ((adminState.settlements || {}).rows || []).find((item) => salon && item.salon_id === salon.id);
  return `
    <div class="phone-shell">
      <div class="note-bar">원장 모바일 어드민 · ${salon ? salon.salon_name : ''}. 디자이너를 추가하거나 퇴사 처리할 수 있고, 이번 달 매장 정산을 봅니다.</div>
      <div class="panel"><div class="panel-body">
        <div style="font-size:13px;color:#6b7280">이번 달 원장 지급 30%</div>
        <div style="font-size:28px;font-weight:400;margin:6px 0 12px">${row ? money(row.payout) : '0원'}</div>
        <div style="font-size:13px;color:#6b7280">판매 매출 ${row ? money(row.sales) : '0원'} · 디자이너 정산 0원</div>
      </div></div>
      <div class="panel">
        <div class="panel-header"><span class="panel-title">디자이너</span>
          <button class="btn btn-sm btn-accent" onclick="openOwnerDesigner(${salon ? salon.id : 1})">추가</button>
        </div>
        <div class="panel-body">
          ${designers.map((designer) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f3f4f6">
              <div>
                <div>${designer.designer_name}</div>
                <div style="font-size:12px;color:#6b7280">${designer.status === 'ACTIVE' ? '활동중' : '퇴사'}</div>
              </div>
              ${designer.status === 'ACTIVE'
                ? `<button class="btn btn-sm btn-danger" onclick="resignDesigner(${designer.id}, '${designer.designer_name}')">퇴사</button>`
                : `<button class="btn btn-sm btn-success" onclick="reinstateDesigner(${designer.id})">복직</button>`}
            </div>`).join('') || '<div style="color:#9ca3af">디자이너가 없습니다</div>'}
        </div>
      </div>
    </div>`;
}

function openOwnerDesigner(salonId) {
  showModal(`
    <h3 style="font-size:18px;font-weight:700;margin-bottom:16px">디자이너 추가</h3>
    <div class="form-group"><label class="form-label">이름</label><input class="form-input" id="m-od-name"></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">취소</button>
      <button class="btn btn-accent" style="flex:1" onclick="submitOwnerDesigner(${salonId})">추가</button>
    </div>`);
}

async function submitOwnerDesigner(salonId) {
  const res = await api('/api/designers', 'POST', {
    salon_id: salonId,
    designer_name: document.getElementById('m-od-name').value,
    commission_rate: 0,
  });
  if (res.success) { closeModal(); showToast('디자이너를 추가했습니다', 'success'); await loadPageData('owner'); }
  else showToast(res.error || '추가하지 못했습니다', 'error');
}

function renderDesignerApp() {
  const designer = (adminState.designers || []).find((item) => item.id === 1) || (adminState.designers || [])[0];
  const lines = ((adminState.settlements || {}).rows || []).flatMap((row) => row.lines.map((line) => ({ ...line, salon_name: row.salon_name }))).filter((line) => designer && line.designer_name === designer.designer_name);
  return `
    <div class="phone-shell">
      <div class="note-bar">${designer ? designer.designer_name : '디자이너'} 모바일 화면. 내 판매 내역은 보이지만, 정산금은 원장에게 지급되고 디자이너 정산은 없습니다.</div>
      <div class="panel"><div class="panel-body">
        <div style="font-size:13px;color:#6b7280">내 이번 달 정산</div>
        <div style="font-size:28px;font-weight:400;margin-top:6px">0원</div>
      </div></div>
      <div class="panel"><div class="panel-body">
        ${lines.map((line) => `
          <div style="padding:10px 0;border-bottom:1px solid #f3f4f6">
            <div>${line.salon_name} · ${line.user_name}</div>
            <div style="font-size:12px;color:#6b7280">${line.created_at} · 매출 ${money(line.sales)} · 내 정산 0원</div>
          </div>`).join('') || '<div style="color:#9ca3af">이번 달 판매가 없습니다</div>'}
      </div></div>
    </div>`;
}
