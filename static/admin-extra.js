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

const couponDraft = {
  editingId: null, name: '', discountType: 'RATE', discountValue: '', minOrderAmount: '0',
  issueTarget: 'ALL', orderCountMin: '', orderCountMax: '', startAt: '', endAt: '', applyScope: 'ALL', brandId: '',
};
const pointsDraft = {
  keyword: '', joinPeriod: 'ALL', purchaseMin: '', purchaseMax: '', direction: 'GRANT',
  timing: 'IMMEDIATE', amount: '', expiresAt: '', reason: '수동', reasonNote: '', pickIds: [],
};

function syncCouponDraft() {
  const read = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
  const name = read('cp-name');
  if (name == null) return;
  couponDraft.name = name;
  couponDraft.discountValue = read('cp-value') || '';
  couponDraft.minOrderAmount = read('cp-min') || '0';
  couponDraft.orderCountMin = read('cp-omin') || '';
  couponDraft.orderCountMax = read('cp-omax') || '';
  couponDraft.startAt = read('cp-start') || '';
  couponDraft.endAt = read('cp-end') || '';
  couponDraft.brandId = read('cp-brand') || '';
}

function setCouponField(key, value) {
  syncCouponDraft();
  couponDraft[key] = value;
  if (key === 'applyScope' && value === 'ALL') couponDraft.brandId = '';
  renderAdmin();
}

function resetCouponDraft() {
  Object.assign(couponDraft, {
    editingId: null, name: '', discountType: 'RATE', discountValue: '', minOrderAmount: '0',
    issueTarget: 'ALL', orderCountMin: '', orderCountMax: '', startAt: '', endAt: '', applyScope: 'ALL', brandId: '',
  });
  renderAdmin();
}

function paidCount(userId) {
  return (adminState.orders || []).filter((order) => order.user_id === userId && order.payment_status === 'PAID').length;
}

function couponAudience() {
  const users = adminState.users || [];
  if (couponDraft.issueTarget !== 'ORDER_COUNT') return users;
  const min = couponDraft.orderCountMin === '' ? null : Number(couponDraft.orderCountMin);
  const max = couponDraft.orderCountMax === '' ? null : Number(couponDraft.orderCountMax);
  return users.filter((user) => {
    const count = paidCount(user.id);
    if (min != null && count < min) return false;
    if (max != null && count > max) return false;
    return true;
  });
}

function couponIssueLabel(coupon) {
  if (coupon.issue_target === 'ORDER_COUNT') {
    const min = coupon.order_count_min == null ? '' : coupon.order_count_min;
    const max = coupon.order_count_max == null ? '' : coupon.order_count_max;
    return `주문 ${min || 0}~${max === '' ? '제한없음' : max}회`;
  }
  return '전체 고객';
}

function renderCoupons() {
  const coupons = adminState.coupons || [];
  const audience = couponAudience();
  return `
    <div class="page-kicker">${couponDraft.editingId ? '쿠폰 수정' : '쿠폰 관리'}</div>
    <p class="page-sub">할인·기간을 정하고, 적용 대상은 전체 상품 또는 브랜드로 고릅니다. 발급 대상은 전체 또는 주문횟수입니다.</p>
    <div class="sheet-card" style="margin-top:16px">
      <div class="form-split">
        <section>
          <p style="font-size:13px;font-weight:700;color:#334155">쿠폰 정보</p>
          <div class="inline-field"><label>쿠폰명</label><input class="soft-input" id="cp-name" value="${couponDraft.name}" placeholder="예: 헤어케어 특가"></div>
          <div class="inline-field"><label>할인</label>
            <div class="seg">
              <button type="button" class="${couponDraft.discountType === 'RATE' ? 'on' : ''}" onclick="setCouponField('discountType','RATE')">정률</button>
              <button type="button" class="${couponDraft.discountType === 'AMOUNT' ? 'on' : ''}" onclick="setCouponField('discountType','AMOUNT')">정액</button>
            </div>
            <input class="soft-input" id="cp-value" value="${couponDraft.discountValue}" style="width:88px" placeholder="0">
            <span style="font-size:12px;color:#94a3b8">${couponDraft.discountType === 'RATE' ? '%' : '원'}</span>
          </div>
          <div class="inline-field"><label>최소주문</label><input class="soft-input" id="cp-min" value="${couponDraft.minOrderAmount}" style="width:120px"><span style="font-size:12px;color:#94a3b8">원</span></div>
          <div class="inline-field"><label>발급대상</label>
            <div class="seg">
              <button type="button" class="${couponDraft.issueTarget === 'ALL' ? 'on' : ''}" onclick="setCouponField('issueTarget','ALL')">전체</button>
              <button type="button" class="${couponDraft.issueTarget === 'ORDER_COUNT' ? 'on' : ''}" onclick="setCouponField('issueTarget','ORDER_COUNT')">주문횟수</button>
            </div>
            ${couponDraft.issueTarget === 'ORDER_COUNT' ? `<input class="soft-input" id="cp-omin" value="${couponDraft.orderCountMin}" style="width:64px" placeholder="0"><span>~</span><input class="soft-input" id="cp-omax" value="${couponDraft.orderCountMax}" style="width:72px" placeholder="제한없음"><span style="font-size:12px;color:#94a3b8">회</span>` : `<input type="hidden" id="cp-omin" value=""><input type="hidden" id="cp-omax" value="">`}
          </div>
          <p style="margin:8px 0 0 80px;font-size:12px;color:#94a3b8">${audience.length}명에게 지급됩니다.</p>
        </section>
        <section>
          <p style="font-size:13px;font-weight:700;color:#334155">기간</p>
          <div class="inline-field"><label>사용기간</label><input class="soft-input" id="cp-start" type="date" value="${couponDraft.startAt}" style="width:150px"><span>~</span><input class="soft-input" id="cp-end" type="date" value="${couponDraft.endAt}" style="width:150px"></div>
        </section>
      </div>
    </div>
    <div class="sheet-card" style="margin-top:12px;padding:16px 18px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <p style="font-size:13px;font-weight:700;color:#334155">적용 대상</p>
          <div class="seg">
            <button type="button" class="${couponDraft.applyScope === 'ALL' ? 'on' : ''}" onclick="setCouponField('applyScope','ALL')">전체 상품</button>
            <button type="button" class="${couponDraft.applyScope === 'BRAND' ? 'on' : ''}" onclick="setCouponField('applyScope','BRAND')">브랜드 지정</button>
          </div>
          ${couponDraft.applyScope === 'BRAND' ? `<select class="soft-select" id="cp-brand" style="min-width:180px">${(adminState.brands || []).map((brand) => `<option value="${brand.id}" ${String(couponDraft.brandId) === String(brand.id) ? 'selected' : ''}>${brand.name}</option>`).join('')}</select>` : '<input type="hidden" id="cp-brand" value="">'}
        </div>
        <div style="display:flex;gap:8px">
          ${couponDraft.editingId ? '<button class="ghost-btn" type="button" onclick="resetCouponDraft()">수정 취소</button>' : ''}
          <button class="solid-btn" type="button" onclick="submitCouponForm()">${couponDraft.editingId ? '저장' : '발급'}</button>
        </div>
      </div>
      <p style="margin-top:10px;font-size:12px;color:#94a3b8">${couponDraft.applyScope === 'BRAND' ? '고른 브랜드 상품에만 적용됩니다.' : '판매 중인 전체 상품에 적용됩니다.'}</p>
    </div>
    <div class="table-tools" style="margin-top:18px"><strong style="font-size:13px;color:#334155">발행된 쿠폰</strong><span style="margin-left:auto;font-size:12px;color:#94a3b8">수정으로 기간과 대상을 다시 쓸 수 있습니다</span></div>
    <div class="sheet-card" style="overflow:auto">
      <table class="data-table">
        <thead><tr><th>쿠폰명</th><th>적용 대상</th><th>발급 대상</th><th>발급/사용</th><th>기간</th><th>상태</th><th></th></tr></thead>
        <tbody>
          ${coupons.map((coupon) => `
            <tr>
              <td>${coupon.name}<div style="color:#94a3b8;font-size:12px">${coupon.discount_type === 'RATE' ? coupon.discount_value + '%' : money(coupon.discount_value)} · 최소 ${money(coupon.min_order_amount || 0)}</div></td>
              <td>${coupon.apply_scope === 'BRAND' ? brandName(coupon.brand_id) : '전체 상품'}</td>
              <td>${couponIssueLabel(coupon)}</td>
              <td>${(coupon.issued_count || 0).toLocaleString()} / ${(coupon.used_count || 0).toLocaleString()}</td>
              <td>${coupon.starts_at || '-'} ~ ${coupon.ends_at || '상시'}</td>
              <td><span class="status-pill ${coupon.status === 'ACTIVE' ? 'paid' : 'pending'}">${coupon.status === 'ACTIVE' ? '진행중' : '중지'}</span></td>
              <td><button class="text-link" onclick="beginCouponEdit(${coupon.id})">수정</button>${coupon.status === 'ACTIVE' ? `<button class="text-link muted" onclick="stopCoupon(${coupon.id})">중지</button>` : ''}</td>
            </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px">쿠폰이 없습니다</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function beginCouponEdit(id) {
  const coupon = (adminState.coupons || []).find((item) => item.id === id);
  if (!coupon) return;
  Object.assign(couponDraft, {
    editingId: coupon.id,
    name: coupon.name,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    minOrderAmount: coupon.min_order_amount || 0,
    issueTarget: coupon.issue_target || 'ALL',
    orderCountMin: coupon.order_count_min == null ? '' : coupon.order_count_min,
    orderCountMax: coupon.order_count_max == null ? '' : coupon.order_count_max,
    startAt: coupon.starts_at || '',
    endAt: coupon.ends_at || '',
    applyScope: coupon.apply_scope === 'BRAND' ? 'BRAND' : 'ALL',
    brandId: coupon.brand_id || '',
  });
  renderAdmin();
}

async function submitCouponForm() {
  syncCouponDraft();
  if (!couponDraft.name) { showToast('쿠폰명을 입력하세요', 'error'); return; }
  const audience = couponAudience();
  const body = {
    name: couponDraft.name,
    discount_type: couponDraft.discountType,
    discount_value: couponDraft.discountValue,
    min_order_amount: couponDraft.minOrderAmount,
    brand_id: couponDraft.applyScope === 'BRAND' ? couponDraft.brandId : null,
    issue_target: couponDraft.issueTarget,
    order_count_min: couponDraft.orderCountMin,
    order_count_max: couponDraft.orderCountMax,
    starts_at: couponDraft.startAt,
    ends_at: couponDraft.endAt,
    issued_count: audience.length,
  };
  const res = couponDraft.editingId
    ? await api('/api/coupons/' + couponDraft.editingId, 'PUT', body)
    : await api('/api/coupons', 'POST', body);
  if (!res.success) { showToast(res.error || '저장하지 못했습니다', 'error'); return; }
  showToast(couponDraft.editingId ? '쿠폰을 수정했습니다' : `쿠폰을 ${audience.length}명 기준으로 발급했습니다`, 'success');
  resetCouponDraft();
  await loadPageData('coupons');
}

async function stopCoupon(id) {
  await api('/api/coupons/' + id, 'DELETE');
  showToast('쿠폰을 중지했습니다', 'success');
  await loadPageData('coupons');
}

function pointMatchedUsers() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return (adminState.users || []).filter((user) => {
    if (pointsDraft.keyword && !`${user.name} ${user.phone || ''}`.includes(pointsDraft.keyword.trim())) return false;
    if (pointsDraft.joinPeriod === 'THIS_MONTH' && !String(user.created_at || '').startsWith(month)) return false;
    const count = paidCount(user.id);
    if (pointsDraft.purchaseMin !== '' && count < Number(pointsDraft.purchaseMin)) return false;
    if (pointsDraft.purchaseMax !== '' && count > Number(pointsDraft.purchaseMax)) return false;
    return true;
  });
}

function setPointField(key, value) {
  const keyword = document.getElementById('pt-keyword');
  const min = document.getElementById('pt-pmin');
  const max = document.getElementById('pt-pmax');
  const amount = document.getElementById('pt-amount');
  const expires = document.getElementById('pt-expire');
  const note = document.getElementById('pt-note');
  if (keyword) pointsDraft.keyword = keyword.value;
  if (min) pointsDraft.purchaseMin = min.value;
  if (max) pointsDraft.purchaseMax = max.value;
  if (amount) pointsDraft.amount = amount.value;
  if (expires) pointsDraft.expiresAt = expires.value;
  if (note) pointsDraft.reasonNote = note.value;
  pointsDraft[key] = value;
  renderAdmin();
}

function renderPoints() {
  const section = adminState.pointsSection || 'grant';
  const matched = pointMatchedUsers();
  const grants = adminState.points || [];
  return `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
      <div>
        <div class="page-kicker">포인트 관리</div>
        <p class="page-sub">${section === 'blocked' ? '포인트를 쓸 수 없는 상품을 고릅니다. 고른 상품 금액은 포인트 한도에서 빠집니다.' : '가입일과 구매횟수로 대상을 고른 뒤 지급하거나 차감합니다.'}</p>
      </div>
      <div class="seg">
        <button type="button" class="${section === 'grant' ? 'on' : ''}" onclick="adminState.pointsSection='grant';renderAdmin()">수동 지급/차감</button>
        <button type="button" class="${section === 'blocked' ? 'on' : ''}" onclick="adminState.pointsSection='blocked';renderAdmin()">사용불가 상품</button>
      </div>
    </div>
    ${section === 'blocked' ? renderBlockedProducts() : `
    <div class="form-split" style="margin-top:16px;gap:12px">
      <section class="sheet-card">
        <div style="display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #f1f5f9"><strong style="font-size:13px">대상 조건</strong><span style="font-size:12px;color:#94a3b8">조건에 맞는 회원 ${matched.length}명</span></div>
        <div class="inline-field"><label>검색</label><input class="soft-input" id="pt-keyword" value="${pointsDraft.keyword}" placeholder="이름, 연락처" oninput="pointsDraft.keyword=this.value"></div>
        <div class="inline-field"><label>가입</label>
          <div class="seg">
            <button type="button" class="${pointsDraft.joinPeriod === 'ALL' ? 'on' : ''}" onclick="setPointField('joinPeriod','ALL')">전체</button>
            <button type="button" class="${pointsDraft.joinPeriod === 'THIS_MONTH' ? 'on' : ''}" onclick="setPointField('joinPeriod','THIS_MONTH')">이번달</button>
          </div>
        </div>
        <div class="inline-field"><label>구매횟수</label><input class="soft-input" id="pt-pmin" value="${pointsDraft.purchaseMin}" style="width:72px" placeholder="0" oninput="pointsDraft.purchaseMin=this.value"><span>~</span><input class="soft-input" id="pt-pmax" value="${pointsDraft.purchaseMax}" style="width:72px" placeholder="제한없음" oninput="pointsDraft.purchaseMax=this.value"><button class="ghost-btn" type="button" onclick="setPointField('keyword', pointsDraft.keyword)">조회</button></div>
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid #f1f5f9">
          <p style="font-size:13px;font-weight:700;color:#334155">지급 설정 <span style="color:#4f46e5">${matched.length}명${pointsDraft.amount ? ` · ${pointsDraft.direction === 'GRANT' ? '+' : '-'}${Number(pointsDraft.amount).toLocaleString()}P` : ''}</span></p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            <button type="button" class="${pointsDraft.direction === 'GRANT' ? 'solid-btn' : 'ghost-btn'}" onclick="setPointField('direction','GRANT')">지급</button>
            <button type="button" class="${pointsDraft.direction === 'DEDUCT' ? 'solid-btn' : 'ghost-btn'}" style="${pointsDraft.direction === 'DEDUCT' ? 'background:#e11d48' : ''}" onclick="setPointField('direction','DEDUCT')">차감</button>
            <button type="button" class="${pointsDraft.timing === 'IMMEDIATE' ? 'solid-btn' : 'ghost-btn'}" onclick="setPointField('timing','IMMEDIATE')">즉시 지급</button>
            <button type="button" class="${pointsDraft.timing === 'SCHEDULED' ? 'solid-btn' : 'ghost-btn'}" onclick="setPointField('timing','SCHEDULED')">예약 지급</button>
          </div>
          <div class="inline-field"><label>포인트</label><input class="soft-input" id="pt-amount" value="${pointsDraft.amount}" style="width:120px" oninput="pointsDraft.amount=this.value"></div>
          ${pointsDraft.direction === 'GRANT' ? `<div class="inline-field"><label>만료일</label><input class="soft-input" id="pt-expire" type="date" value="${pointsDraft.expiresAt}" style="width:160px"></div>` : '<input type="hidden" id="pt-expire" value="">'}
          <div class="inline-field"><label>사유</label>
            <div class="seg">
              ${['수동', 'CS', '기타'].map((reason) => `<button type="button" class="${pointsDraft.reason === reason ? 'on' : ''}" onclick="setPointField('reason','${reason}')">${reason}</button>`).join('')}
            </div>
          </div>
          ${pointsDraft.reason === '기타' ? `<div class="inline-field"><label></label><input class="soft-input" id="pt-note" value="${pointsDraft.reasonNote}" placeholder="기타 사유"></div>` : '<input type="hidden" id="pt-note" value="">'}
          <button class="solid-btn" style="margin-top:12px;width:100%" type="button" onclick="submitPointForm()">${pointsDraft.timing === 'IMMEDIATE' ? '지금 지급/차감' : '예약 등록'}</button>
        </div>
      </section>
      <section class="sheet-card" style="padding:0;overflow:hidden">
        <div style="padding:14px 16px;border-bottom:1px solid #f1f5f9"><strong style="font-size:13px">대상 회원</strong><div style="font-size:28px;font-weight:500;margin-top:6px">${matched.length}<span style="font-size:13px;color:#64748b"> 명</span></div></div>
        <table class="data-table">
          <thead><tr><th>고객</th><th>구매횟수</th><th>보유 포인트</th></tr></thead>
          <tbody>
            ${matched.slice(0, 12).map((user) => `<tr><td>${user.name}</td><td>${paidCount(user.id)}</td><td>${(user.points || 0).toLocaleString()}P</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:24px">조건에 맞는 회원이 없습니다</td></tr>'}
          </tbody>
        </table>
      </section>
    </div>
    <div class="sheet-card" style="margin-top:12px;overflow:auto">
      <div style="padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:700">지급 이력</div>
      <table class="data-table">
        <thead><tr><th>지급/예약 일시</th><th>지급 대상</th><th>유형</th><th>포인트</th><th>유효기간</th><th>사유</th><th>등록자</th><th>상태</th></tr></thead>
        <tbody>
          ${grants.map((grant) => `
            <tr>
              <td>${grant.created_at}</td>
              <td>${grant.target_summary || grant.user_name}</td>
              <td>${grant.amount < 0 ? '차감' : '지급'}</td>
              <td style="color:${grant.amount < 0 ? '#e11d48' : '#0f172a'}">${grant.amount > 0 ? '+' : ''}${grant.amount.toLocaleString()}P</td>
              <td>${grant.expires_at || '-'}</td>
              <td>${grant.reason}</td>
              <td>${grant.created_by || 'Admin'}</td>
              <td><span class="status-pill ${grant.status === 'COMPLETED' ? 'paid' : 'pending'}">${grant.status === 'SCHEDULED' ? '예약됨' : '지급완료'}</span></td>
            </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px">지급 이력이 없습니다</td></tr>'}
        </tbody>
      </table>
    </div>`}`;
}

function renderBlockedProducts() {
  const products = adminState.blockedProducts || [];
  return `
    <div class="sheet-card" style="margin-top:16px;overflow:auto">
      <table class="data-table">
        <thead><tr><th>상품</th><th>브랜드</th><th>포인트</th></tr></thead>
        <tbody>
          ${products.map((product) => `
            <tr>
              <td>${product.name}</td>
              <td>${brandName(product.brand_id)}</td>
              <td><button class="${product.blocked ? 'solid-btn' : 'ghost-btn'}" style="${product.blocked ? 'background:#e11d48' : ''}" onclick="toggleBlockedProduct(${product.id}, ${product.blocked ? 'false' : 'true'})">${product.blocked ? '사용불가' : '사용가능'}</button></td>
            </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:24px">상품이 없습니다</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

async function toggleBlockedProduct(id, blocked) {
  const res = await api('/api/points/blocked', 'POST', { product_id: id, blocked });
  if (res.success) await loadPageData('points');
}

async function submitPointForm() {
  setPointField('amount', document.getElementById('pt-amount') ? document.getElementById('pt-amount').value : pointsDraft.amount);
  const users = pointMatchedUsers();
  if (!users.length) { showToast('지급할 회원이 없습니다', 'error'); return; }
  const reason = pointsDraft.reason === '기타' ? (pointsDraft.reasonNote || '기타') : pointsDraft.reason;
  const res = await api('/api/points', 'POST', {
    user_ids: users.map((user) => user.id),
    direction: pointsDraft.direction,
    timing: pointsDraft.timing,
    amount: pointsDraft.amount,
    expires_at: pointsDraft.expiresAt,
    reason,
    target_summary: users.length === 1 ? users[0].name : `조건 ${users.length}명`,
  });
  if (!res.success) { showToast(res.error || '반영하지 못했습니다', 'error'); return; }
  showToast(pointsDraft.timing === 'SCHEDULED' ? '포인트 지급을 예약했습니다' : '포인트를 반영했습니다', 'success');
  pointsDraft.amount = '';
  await loadPageData('points');
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

function yearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function settlementRowsForView() {
  const data = adminState.settlements || { rows: [] };
  const rows = data.rows || [];
  const query = (adminState.settlementQuery || '').trim();
  if (adminState.settlementSalon && adminState.settlementSalon !== 'ALL') return rows;
  if (!query) return rows;
  return rows.filter((row) => row.salon_name.includes(query) || (row.owner_name || '').includes(query));
}

function settlementSummary() {
  const data = adminState.settlements || { month: '', rows: [] };
  const rows = (adminState.settlementSalon && adminState.settlementSalon !== 'ALL')
    ? (data.rows || []).filter((row) => row.period === data.month)
    : settlementRowsForView();
  const sum = (key) => rows.reduce((acc, row) => acc + (row[key] || 0), 0);
  return {
    order_count: sum('orders'),
    sales: sum('sales'),
    paid_amount: sum('paid_amount'),
    cancelled_amount: sum('cancelled_amount'),
    points_used: sum('points_used'),
    coupon_discount: sum('coupon_discount'),
    shipping_fee: sum('shipping_fee'),
    payout: sum('payout'),
  };
}

function onSettlementQuery(value) {
  const pos = value.length;
  adminState.settlementQuery = value;
  renderAdmin();
  const input = document.getElementById('settle-query');
  if (input) { input.focus(); input.setSelectionRange(pos, input.value.length); }
}

function renderStoreSettlements() {
  const data = adminState.settlements || { month: '', months: [], rows: [], range: {} };
  const summary = settlementSummary();
  const rows = settlementRowsForView();
  const history = adminState.settlementSalon && adminState.settlementSalon !== 'ALL';
  const now = new Date();
  const thisMonth = yearMonth(now);
  const lastMonth = yearMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const years = [...new Set((data.months || []).map((month) => month.slice(0, 4)))];
  const [year = '', month = ''] = (data.month || '').split('-');
  const selected = new Set(adminState.settlementSelected || []);
  const selectedRows = rows.filter((row) => selected.has(row.id));
  const pending = selectedRows.filter((row) => row.status === 'PENDING');
  const confirmed = selectedRows.filter((row) => row.status === 'CONFIRMED');
  const paid = selectedRows.filter((row) => row.status === 'PAID');
  const salons = (adminState.salons || []).filter((salon) => {
    const query = (adminState.settlementQuery || '').trim();
    return !query || salon.salon_name.includes(query) || (salon.owner_name || '').includes(query);
  });
  const salonName = history ? ((data.rows || [])[0] || {}).salon_name || '선택 매장' : '전체 매장';
  const detail = (data.rows || []).find((row) => row.id === adminState.settlementDetail);
  const feeText = (value) => value ? money(value) : '무료';
  return `
    <div class="page-kicker">매출/정산</div>
    <p class="page-sub">매장별 기간 매출 및 정산 내역을 확인합니다. 정산액은 판매 매출의 30%이고, 원장에게 지급합니다.</p>
    <div class="filter-card">
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:240px">
          <label class="field-label">매장 검색</label>
          <input class="soft-input" id="settle-query" value="${adminState.settlementQuery || ''}" placeholder="매장명, 원장명 검색" oninput="onSettlementQuery(this.value)">
        </div>
        <div>
          <label class="field-label">매장 선택</label>
          <select class="soft-select" style="min-width:200px" onchange="changeSettlementSalon(this.value)">
            <option value="ALL" ${history ? '' : 'selected'}>전체 매장</option>
            ${salons.map((salon) => `<option value="${salon.id}" ${String(adminState.settlementSalon) === String(salon.id) ? 'selected' : ''}>${salon.salon_name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="period-row">
        <span class="field-label" style="margin:0">조회 기간</span>
        <button type="button" class="period-chip ${data.month === thisMonth ? 'on' : ''}" onclick="changeSettlementMonth('${thisMonth}')">이번달</button>
        <button type="button" class="period-chip ${data.month === lastMonth ? 'on' : ''}" onclick="changeSettlementMonth('${lastMonth}')">지난달</button>
        <select class="soft-select" style="height:32px" onchange="changeSettlementYear(this.value)">
          ${years.map((item) => `<option value="${item}" ${item === year ? 'selected' : ''}>${item}년</option>`).join('')}
        </select>
        <select class="soft-select" style="height:32px" onchange="changeSettlementMonth('${year}-' + this.value)">
          ${Array.from({ length: 12 }, (_, index) => {
            const mm = String(index + 1).padStart(2, '0');
            const allowed = (data.months || []).includes(`${year}-${mm}`);
            return `<option value="${mm}" ${mm === month ? 'selected' : ''} ${allowed ? '' : 'disabled'}>${index + 1}월</option>`;
          }).join('')}
        </select>
        <span style="margin-left:auto;font-size:12px;color:#94a3b8">${salonName} · ${(data.range || {}).start || ''} ~ ${(data.range || {}).end || ''}</span>
      </div>
    </div>
    <div class="summary-head"><span>조회 합계</span><span class="count-pill">${summary.order_count}건</span></div>
    <div class="summary-grid">
      <div class="summary-card sales">
        <div class="summary-title">매출</div>
        <div class="metric-row">
          <div class="metric-tile"><i class="fas fa-won-sign"></i><strong>${money(summary.sales)}</strong><span>총 매출액</span></div>
          <div class="metric-tile"><i class="fas fa-credit-card"></i><strong>${money(summary.paid_amount)}</strong><span>실 결제액</span></div>
          <div class="metric-tile"><i class="fas fa-times-circle"></i><strong>${money(summary.cancelled_amount)}</strong><span>취소금액</span></div>
          <div class="metric-tile"><i class="fas fa-coins"></i><strong>${money(summary.points_used)}</strong><span>포인트 사용</span></div>
          <div class="metric-tile"><i class="fas fa-ticket-alt"></i><strong>${money(summary.coupon_discount)}</strong><span>쿠폰사용</span></div>
        </div>
      </div>
      <div class="summary-card payout">
        <div class="summary-title">정산</div>
        <div class="metric-row">
          <div class="metric-tile pay"><i class="fas fa-store"></i><strong>${money(summary.sales)}</strong><span>판매 매출</span></div>
          <div class="metric-tile pay"><i class="fas fa-truck"></i><strong>${feeText(summary.shipping_fee)}</strong><span>배송비</span></div>
          <div class="metric-tile pay"><i class="fas fa-wallet"></i><strong>${money(summary.payout)}</strong><span>정산액 30%</span></div>
        </div>
      </div>
    </div>
    <div class="table-tools">
      <strong style="font-size:14px;color:#334155">정산 내역</strong>
      <span style="font-size:12px;color:#94a3b8">${history ? `${salonName} · 월별` : `${data.month} · 매장별`}</span>
      ${history ? '<button class="text-link" onclick="changeSettlementSalon(\'ALL\')">전체 매장</button>' : ''}
      <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
        <button class="ghost-btn" ${paid.length ? '' : 'disabled'} onclick="bulkSettlement('CONFIRMED', selectedSettlementIds('PAID'))">선택 일괄 확정으로${paid.length ? ` (${paid.length})` : ''}</button>
        <button class="ghost-btn" ${confirmed.length ? '' : 'disabled'} onclick="bulkSettlement('PENDING', selectedSettlementIds('CONFIRMED'))">선택 일괄 예정으로${confirmed.length ? ` (${confirmed.length})` : ''}</button>
        <button class="ghost-btn" ${confirmed.length ? '' : 'disabled'} onclick="bulkSettlement('PAID', selectedSettlementIds('CONFIRMED'))" style="color:${confirmed.length ? '#047857' : ''};border-color:${confirmed.length ? '#a7f3d0' : ''}">선택 일괄 지급완료${confirmed.length ? ` (${confirmed.length})` : ''}</button>
        <button class="solid-btn" ${pending.length ? '' : 'disabled'} onclick="bulkSettlement('CONFIRMED', selectedSettlementIds('PENDING'))">선택 일괄 정산확정${pending.length ? ` (${pending.length})` : ''}</button>
      </div>
    </div>
    <div class="sheet-card" style="overflow:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th><input type="checkbox" ${rows.length && rows.every((row) => selected.has(row.id)) ? 'checked' : ''} onclick="toggleSettlementPage()"></th>
            ${history ? '' : '<th>매장</th>'}
            <th>정산 기간</th><th>총 매출액</th><th>실 결제액</th><th>배송비</th><th>정산액</th><th>상태</th><th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><input type="checkbox" ${selected.has(row.id) ? 'checked' : ''} onclick="toggleSettlement('${row.id}')"></td>
              ${history ? '' : `<td><button class="text-link" onclick="changeSettlementSalon('${row.salon_id}')">${row.salon_name}</button></td>`}
              <td style="${row.period === data.month ? 'color:#4f46e5;font-weight:700' : ''}">${row.period}</td>
              <td>${money(row.sales)}</td>
              <td>${money(row.paid_amount)}</td>
              <td>${feeText(row.shipping_fee)}</td>
              <td>${money(row.payout)}</td>
              <td>
                <span class="status-pill ${row.status === 'PAID' ? 'paid' : row.status === 'CONFIRMED' ? 'confirmed' : 'pending'}">${SETTLE_LABEL[row.status]}</span>
                ${row.status === 'PENDING' ? `<button class="text-link" onclick="bulkSettlement('CONFIRMED', ['${row.id}'])">확정</button>` : ''}
                ${row.status === 'CONFIRMED' ? `<button class="text-link muted" onclick="bulkSettlement('PENDING', ['${row.id}'])">예정</button><button class="text-link" onclick="bulkSettlement('PAID', ['${row.id}'])">지급</button>` : ''}
                ${row.status === 'PAID' ? `<button class="text-link muted" onclick="bulkSettlement('CONFIRMED', ['${row.id}'])">확정</button>` : ''}
              </td>
              <td>
                <button class="text-link" onclick="openSettlementOrders('${row.id}')">목록보기</button>
                ${history ? '' : `<button class="text-link muted" onclick="changeSettlementSalon('${row.salon_id}')">월별보기</button>`}
              </td>
            </tr>`).join('') || `<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:24px">${history ? '해당 매장의 정산 내역이 없습니다.' : '선택한 기간의 정산 내역이 없습니다.'}</td></tr>`}
        </tbody>
      </table>
    </div>
    ${detail ? `
      <div class="sheet-card" style="margin-top:12px;overflow:auto">
        <div style="padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:700">${detail.salon_name} ${detail.period} 주문</div>
        <table class="data-table">
          <thead><tr><th>주문</th><th>고객</th><th>디자이너</th><th>매출</th></tr></thead>
          <tbody>
            ${(detail.lines || []).map((line) => `<tr><td>#${line.order_id}<div style="color:#94a3b8;font-size:12px">${line.created_at}</div></td><td>${line.user_name}</td><td>${line.designer_name || '담당 없음'}${line.designer_status === 'RESIGNED' ? ' <span class="badge badge-resigned">퇴사</span>' : ''}</td><td>${money(line.sales)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:24px">이 기간 주문이 없습니다</td></tr>'}
          </tbody>
        </table>
      </div>` : ''}`;
}

async function changeSettlementMonth(month) {
  adminState.settlementMonth = month;
  adminState.settlementSelected = [];
  adminState.settlementDetail = '';
  await loadPageData('settlements');
}

function changeSettlementYear(year) {
  const month = (adminState.settlementMonth || '').slice(5) || '01';
  const months = (adminState.settlements || {}).months || [];
  const candidate = `${year}-${month}`;
  changeSettlementMonth(months.includes(candidate) ? candidate : (months.find((item) => item.startsWith(year + '-')) || candidate));
}

async function changeSettlementSalon(id) {
  adminState.settlementSalon = id || 'ALL';
  adminState.settlementSelected = [];
  adminState.settlementDetail = '';
  await loadPageData('settlements');
}

function toggleSettlement(id) {
  const selected = new Set(adminState.settlementSelected || []);
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  adminState.settlementSelected = [...selected];
  renderAdmin();
}

function selectedSettlementIds(status) {
  const selected = new Set(adminState.settlementSelected || []);
  return settlementRowsForView().filter((row) => selected.has(row.id) && row.status === status).map((row) => row.id);
}

function toggleSettlementPage() {
  const ids = settlementRowsForView().map((row) => row.id);
  const selected = new Set(adminState.settlementSelected || []);
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
  ids.forEach((id) => { if (allOn) selected.delete(id); else selected.add(id); });
  adminState.settlementSelected = [...selected];
  renderAdmin();
}

function openSettlementOrders(id) {
  adminState.settlementDetail = adminState.settlementDetail === id ? '' : id;
  renderAdmin();
}

async function bulkSettlement(status, ids) {
  if (!ids || !ids.length) return;
  const label = SETTLE_LABEL[status];
  if (!window.confirm(`선택한 ${ids.length}건을 ${label}으로 바꾸시겠습니까?`)) return;
  const res = await api('/api/settlements/status', 'POST', { ids, status });
  if (!res.success) { showToast(res.error || '바꾸지 못했습니다', 'error'); return; }
  adminState.settlementSelected = [];
  showToast(label + '으로 바꿨습니다', 'success');
  await loadPageData('settlements');
}

async function setSettlementStatus(id, status) {
  await bulkSettlement(status, [id]);
}
