// GitHub Pages에는 서버가 없어서, 데모 데이터를 브라우저에서 같은 API로 응답한다.
(function () {
  if (!location.hostname.endsWith('github.io')) return;

  const STORAGE_KEY = 'salon-vip-db-v1';
  let db = null;

  function siteRoot() {
    let path = location.pathname;
    if (!path.endsWith('/')) path = path.slice(0, path.lastIndexOf('/') + 1);
    return path;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function applyProductListing(product) {
    const status = product.sale_status || 'SELLING';
    product.is_active = product.deleted_at || status === 'STOP' || status === 'WAITING' ? 0 : 1;
    if (!product.product_number) product.product_number = String(100000 + Number(product.id || 0));
  }

  function nextId(list) {
    return list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
  }

  function nowStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  const otpStore = new Map();

  function phoneDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function issueOtp(phone) {
    const digits = phoneDigits(phone);
    if (digits.length < 10 || digits.length > 11) return null;
    const code = String(1000 + Math.floor(Math.random() * 9000));
    otpStore.set(digits, { code, expires: Date.now() + 5 * 60 * 1000, verified: false });
    return code;
  }

  function verifyOtp(phone, code) {
    const digits = phoneDigits(phone);
    const row = otpStore.get(digits);
    if (!row) return false;
    if (Date.now() > row.expires) return false;
    if (String(code || '').trim() !== row.code) return false;
    row.verified = true;
    otpStore.set(digits, row);
    return true;
  }

  function isPhoneVerified(phone) {
    const row = otpStore.get(phoneDigits(phone));
    return !!(row && row.verified && Date.now() <= row.expires + 30 * 60 * 1000);
  }

  function resignOtherStaffJobs(user, keepDesignerId) {
    const phone = phoneDigits(user.phone);
    const resigned = [];
    db.designers.forEach((d) => {
      if (d.id === Number(keepDesignerId)) return;
      if (d.status !== 'ACTIVE') return;
      const samePhone = phone && phoneDigits(d.phone) === phone;
      const sameStaff = user.staff_designer_id && Number(user.staff_designer_id) === d.id;
      if (!samePhone && !sameStaff) return;
      d.status = 'RESIGNED';
      d.resigned_at = nowStamp();
      resigned.push(d);
    });
    return resigned;
  }

  function activateStaffInvite(user, designer) {
    if (!designer || designer.status !== 'INVITED') return { error: '대기 중인 초대가 없습니다' };
    if (phoneDigits(user.phone) !== phoneDigits(designer.phone)) {
      return { error: '초대된 휴대폰번호와 일치하지 않습니다' };
    }
    const resigned = resignOtherStaffJobs(user, designer.id);
    designer.status = 'ACTIVE';
    designer.joined_at = nowStamp();
    user.staff_designer_id = designer.id;
    return { designer, resigned };
  }

  function inviteUrlFor(designerId) {
    if (typeof location !== 'undefined' && location.origin) {
      const path = String(location.pathname || '/').replace(/index\.html$/i, '');
      const base = location.origin + (path.endsWith('/') ? path : path.replace(/\/?$/, '/'));
      return base + '?invite=' + designerId;
    }
    return 'https://code0471-design.github.io/salon-vip-commerce/?invite=' + designerId;
  }

  function buildInviteSms(salon, designer, matchUser) {
    const salonName = salon ? salon.salon_name : '매장';
    const url = inviteUrlFor(designer.id);
    if (matchUser) {
      return `[살롱VIP] ${salonName} 담당자 초대\n${url}\n링크를 열어 승인하세요.`;
    }
    return `[살롱VIP] ${salonName} 담당자 초대\n${url}\n같은 번호로 가입 후 승인하세요.`;
  }

  function pendingStaffInvitesFor(user) {
    const phone = phoneDigits(user && user.phone);
    if (!phone) return [];
    const owned = ownedSalon(user);
    return db.designers
      .filter((d) => {
        if (d.status !== 'INVITED') return false;
        if (phoneDigits(d.phone) !== phone) return false;
        // 원장은 본인 매장 초대의 승인자 아님 (초대 받는 담당자만)
        if (owned && Number(d.salon_id) === Number(owned.id)) return false;
        return true;
      })
      .map((d) => {
        const salon = findSalon(d.salon_id);
        return {
          ...publicDesigner(d),
          salon_name: salon ? salon.salon_name : '',
          salon_id: d.salon_id,
          invite_url: inviteUrlFor(d.id),
        };
      });
  }

  function acceptDesignerInvites(user) {
    const phone = phoneDigits(user.phone);
    if (!phone) return [];
    const invited = db.designers.filter((d) => d.status === 'INVITED' && phoneDigits(d.phone) === phone);
    const accepted = [];
    invited.forEach((d) => {
      const result = activateStaffInvite(user, d);
      if (!result.error) accepted.push(d);
    });
    return accepted;
  }

  function normalizeSalonCode(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{6}$/.test(digits) ? digits : '';
}

  function defaultSalonCode(salon) {
  const n = 100000 + Number(salon && salon.id ? salon.id : 0);
  return String(n).padStart(6, '0').slice(-6);
}

  function findSalon(id) {
    return db.salons.find((s) => s.id === Number(id));
  }

  function findSalonByCode(code) {
    const normalized = normalizeSalonCode(code);
    if (!normalized) return null;
    return db.salons.find((s) => normalizeSalonCode(s.salon_code) === normalized) || null;
  }

  function findDesigner(id) {
    return db.designers.find((d) => d.id === Number(id));
  }

  function activeDesignersForSalon(salonId) {
    return db.designers
      .filter((d) => d.salon_id === Number(salonId) && d.status === 'ACTIVE')
      .map((d) => ({
        id: d.id,
        designer_name: d.designer_name,
        profile_img: d.profile_img,
        status: d.status,
      }));
  }

  // 1인샵·담당자 미등록 매장: 대표(원장)를 ACTIVE 담당으로 보장
  function ensureOwnerDesigner(salon) {
    if (!salon) return [];
    const active = activeDesignersForSalon(salon.id);
    if (active.length) return active;
    const ownerName = String(salon.owner_name || '').trim() || '매장 대표';
    const designer = {
      id: nextId(db.designers),
      salon_id: salon.id,
      designer_name: ownerName,
      phone: String(salon.owner_phone || '').trim(),
      profile_img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(ownerName),
      status: 'ACTIVE',
      is_owner_slot: true,
      commission_rate: 0,
      created_at: nowStamp(),
    };
    db.designers.push(designer);
    save();
    return activeDesignersForSalon(salon.id);
  }

  function uniqueSalonCode(preferred, excludeId) {
    let candidate = normalizeSalonCode(preferred) || defaultSalonCode({ id: excludeId || 0 });
    let n = Number(candidate);
    while (db.salons.some((s) => s.id !== excludeId && normalizeSalonCode(s.salon_code) === candidate)) {
      n = (n + 1) % 1000000;
    candidate = String(n).padStart(6, '0');
    }
    return candidate;
  }

  function orderPointsEarned(items) {
    const blocked = new Set((db.point_blocked_ids || []).map(Number));
    return items.reduce((sum, item) => {
      const product = db.products.find((p) => p.id === item.product_id);
      if (!product || blocked.has(product.id) || product.point_use_disabled) return sum;
      const rate = Math.max(0, Number(product.earn_points_rate) || 0);
      return sum + Math.floor(item.price * item.qty * rate / 100);
    }, 0);
  }

  function phoneKey(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function ownedSalon(user) {
    const phone = phoneKey(user && user.phone);
    if (!phone) return null;
    return db.salons.find((salon) => phoneKey(salon.owner_phone) === phone) || null;
  }

  function ensureDemoOwnerUsers() {
    (db.salons || []).forEach((salon) => {
      if (!salon || !salon.owner_phone) return;
      let user = (db.users || []).find((u) => phoneKey(u.phone) && phoneKey(u.phone) === phoneKey(salon.owner_phone));
      if (!user) {
        db.users.push({
          id: nextId(db.users),
          kakao_id: 'kakao_owner_' + salon.id,
          auth_provider: 'kakao',
          name: salon.owner_name || '원장',
          phone: salon.owner_phone,
          phone_verified: true,
          shipping_address: '(06236) 서울 강남구 테헤란로 152 801호',
          current_salon_id: salon.id,
          mapped_designer_id: null,
          points: 0,
          coupon_ids: [],
          created_at: nowStamp(),
        });
        return;
      }
      user.kakao_id = user.kakao_id || ('kakao_owner_' + salon.id);
      user.auth_provider = user.auth_provider || 'kakao';
      user.name = salon.owner_name || user.name || '원장';
      user.phone = salon.owner_phone;
      user.phone_verified = true;
      user.current_salon_id = salon.id;
      if (!user.shipping_address) {
        user.shipping_address = '(06236) 서울 강남구 테헤란로 152 801호';
      }
    });
  }

  function hiddenBrandIds(salon) {
    return new Set((salon && salon.hidden_brand_ids) || []);
  }

  function brandBlocksSalon(brand, salonId) {
    return Array.isArray(brand && brand.blocked_salon_ids) && brand.blocked_salon_ids.map(Number).includes(Number(salonId));
  }

  function productSaleBlock(salon, product) {
    if (!salon || !product) return '';
    if (hiddenBrandIds(salon).has(product.brand_id)) return '이 매장에서 판매하지 않습니다';
    const brand = db.brands.find((item) => item.id === product.brand_id);
    if (brandBlocksSalon(brand, salon.id)) return '본사 판매 제한으로 이 매장에서 판매할 수 없습니다';
    return '';
  }

  function visibleProducts(products, salonId) {
    if (!salonId) return products;
    const salon = findSalon(salonId);
    return products.filter((product) => !productSaleBlock(salon, product));
  }

  function publicUser(user) {
    const salon = findSalon(user.current_salon_id);
    const designer = findDesigner(user.mapped_designer_id);
    const owned = ownedSalon(user);
    const staffDesigner = db.designers.find((d) => {
      if (d.status === 'RESIGNED' || d.status === 'INVITED') return false;
      if (user.staff_designer_id && d.id === Number(user.staff_designer_id)) return true;
      if (user.kakao_id && user.kakao_id === `designer-${d.id}`) return true;
      const phone = phoneDigits(user.phone);
      const dPhone = phoneDigits(d.phone);
      return !!(phone && dPhone && phone === dPhone);
    });
    const staffSalon = staffDesigner ? findSalon(staffDesigner.salon_id) : null;
    return {
      ...user,
      salon_name: salon ? salon.salon_name : (owned ? owned.salon_name : (staffSalon ? staffSalon.salon_name : null)),
      designer_name: designer ? designer.designer_name : null,
      designer_img: designer ? designer.profile_img : null,
      is_owner: !!owned,
      owned_salon_id: owned ? owned.id : null,
      is_staff: !!staffDesigner,
      staff_salon_id: staffDesigner ? staffDesigner.salon_id : null,
      staff_designer_id: staffDesigner ? staffDesigner.id : null,
    };
  }

  function publicOrder(order) {
    const user = db.users.find((u) => u.id === order.user_id);
    const salon = findSalon(order.salon_id);
    let designer = findDesigner(order.designer_id);
    // 소속 매장이 바뀌어도 과거 주문 담당자는 그 주문 매장 기준으로만 보정
    if (!designer && user && user.mapped_designer_id) {
      const mapped = findDesigner(user.mapped_designer_id);
      if (mapped && Number(mapped.salon_id) === Number(order.salon_id)) designer = mapped;
    }
    return {
      ...order,
      user_name: user ? user.name : '',
      salon_name: salon ? salon.salon_name : '',
      designer_name: designer ? designer.designer_name : null,
      designer_status: designer ? designer.status : null,
      shipping_status: order.shipping_status || 'READY',
      cancel_requested: !!order.cancel_requested,
      shipping_name: order.shipping_name || (user ? user.name : '') || '',
      shipping_phone: order.shipping_phone || (user ? user.phone : '') || '',
      shipping_address: order.shipping_address || (user ? user.shipping_address : '') || '',
      points_earned: Number(order.points_earned || 0),
      points_used: Number(order.points_used || 0),
      coupon_discount: Number(order.coupon_discount || 0),
    };
  }

  function publicSalon(salon) {
    const designers = db.designers.filter((d) => d.salon_id === salon.id);
    return {
      ...salon,
      designer_count: designers.length,
      active_designers: designers.filter((d) => d.status === 'ACTIVE').length,
    };
  }

  function publicDesigner(designer) {
    const salon = findSalon(designer.salon_id);
    return {
      ...designer,
      salon_name: salon ? salon.salon_name : '',
      mapped_user_count: db.users.filter((u) => u.mapped_designer_id === designer.id).length,
      total_earned: 0,
    };
  }

  function userOrders(userId) {
    return db.orders
      .filter((o) => o.user_id === Number(userId))
      .sort((a, b) => b.id - a.id)
      .map(publicOrder);
  }

  function splitAmount(total) {
    return {
      platform: Math.round(total * 0.4),
      designer: 0,
      salon: Math.round(total * 0.3),
    };
  }

  function orderStats() {
    const paid = db.orders.filter((o) => o.payment_status === 'PAID');
    const bySalon = new Map();
    let gmv = 0;
    for (const order of paid) {
      const amount = order.total_amount || 0;
      const salon = findSalon(order.salon_id);
      const row = bySalon.get(order.salon_id) || {
        id: order.salon_id,
        salon_name: salon ? salon.salon_name : '',
        orders: 0,
        revenue: 0,
        commission: 0,
      };
      row.orders += 1;
      row.revenue += amount;
      row.commission += ProductCatalog.orderStorePayout(order);
      bySalon.set(order.salon_id, row);
      gmv += amount;
    }
    const salonBreakdown = [...bySalon.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      total_orders: db.orders.length,
      paid_orders: paid.length,
      total_gmv: gmv,
      platform_revenue: Math.round(gmv * 0.4),
      total_salon_commission: salonBreakdown.reduce((sum, row) => sum + row.commission, 0),
      total_designer_commission: 0,
      salonBreakdown,
    };
  }

  function assignSalon(user, salonId, designerId) {
    const salon = findSalon(salonId);
    if (!salon) return { error: '살롱을 찾을 수 없습니다' };
    if (!designerId) return { error: '담당자를 선택해주세요' };
    const designer = db.designers.find((d) =>
      d.id === Number(designerId) && d.salon_id === salon.id && d.status === 'ACTIVE');
    if (!designer) return { error: '담당자를 찾을 수 없습니다' };
    // 소속만 갱신. 과거 주문(user_id / order.salon_id)은 절대 수정·삭제하지 않음.
    if (user.current_salon_id && Number(user.current_salon_id) !== Number(salon.id)) {
      user.previous_salon_id = user.current_salon_id;
    }
    user.current_salon_id = salon.id;
    user.mapped_designer_id = designer.id;
    save();
    return { user: publicUser(user), order_count: userOrders(user.id).length };
  }

  function recentSettlementMonths(count) {
    const now = new Date();
    const months = [];
    for (let i = 0; i < count; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    const fromOrders = db.orders.map((order) => String(order.created_at).slice(0, 7));
    return [...new Set(months.concat(fromOrders))].filter(Boolean).sort().reverse();
  }

  function monthBounds(period) {
    const [year, month] = period.split('-').map(Number);
    const last = new Date(year, month, 0).getDate();
    return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, '0')}` };
  }

  function settlementStatusFor(id, period) {
    const override = db.settlement_overrides.find((item) => item.id === id);
    const nowMonth = nowStamp().slice(0, 7);
    return override ? override.status : (period >= nowMonth ? 'PENDING' : 'CONFIRMED');
  }

  function salonPeriodRow(salon, period) {
    const inMonth = db.orders.filter((order) => order.salon_id === salon.id && String(order.created_at).slice(0, 7) === period);
    const paid = inMonth.filter((order) => order.payment_status === 'PAID');
    const cancelled = inMonth.filter((order) => order.payment_status === 'CANCELLED' || order.payment_status === 'REFUNDED');
    const findProduct = (id) => db.products.find((product) => product.id === Number(id));
    const money = paid.map((order) => ProductCatalog.orderMoney(order, findProduct));
    const sumMoney = (key) => money.reduce((sum, row) => sum + (row[key] || 0), 0);
    const shippingFee = paid.reduce((sum, order) => sum + (order.shipping_fee || 0), 0);
    const cancelledAmount = cancelled.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const id = `S${salon.id}-${period}`;
    return {
      id,
      salon_id: salon.id,
      salon_name: salon.salon_name,
      owner_name: salon.owner_name,
      period,
      orders: paid.length,
      sales: sumMoney('sale'),
      paid_amount: sumMoney('paid'),
      cancelled_amount: cancelledAmount,
      points_used: sumMoney('points'),
      coupon_discount: sumMoney('coupon'),
      supply_amount: sumMoney('supply'),
      hq_margin: sumMoney('hqMargin'),
      shipping_fee: shippingFee,
      payout: sumMoney('storePayout'),
      designer_payout: 0,
      status: settlementStatusFor(id, period),
      lines: paid.map(publicOrder).map((order) => {
        const row = ProductCatalog.orderMoney(order, findProduct);
        return {
          order_id: order.id,
          created_at: order.created_at,
          user_name: order.user_name,
          designer_name: order.designer_name,
          designer_status: order.designer_status,
          sales: row.sale,
          paid_amount: row.paid,
          coupon_discount: row.coupon,
          payout: row.storePayout,
          hq_margin: row.hqMargin,
          designer_payout: 0,
        };
      }),
    };
  }

  function summarizeSettlementRows(rows) {
    const sum = (key) => rows.reduce((acc, row) => acc + (row[key] || 0), 0);
    return {
      order_count: sum('orders'),
      sales: sum('sales'),
      paid_amount: sum('paid_amount'),
      cancelled_amount: sum('cancelled_amount'),
      points_used: sum('points_used'),
      coupon_discount: sum('coupon_discount'),
      supply_amount: sum('supply_amount'),
      hq_margin: sum('hq_margin'),
      shipping_fee: sum('shipping_fee'),
      payout: sum('payout'),
      designer_payout: 0,
    };
  }

  const routes = [
    ['POST', /^\/api\/init-db$/, () => ({ data: { ready: true } })],
    ['POST', /^\/api\/seed-db$/, () => ({ data: { seeded: true } })],
    ['GET', /^\/api\/products$/, (req) => {
      const best = req.query.get('best') === '1';
      const admin = req.query.get('admin') === '1';
      let products = admin ? db.products.slice() : db.products.filter((p) => p.is_active && !p.deleted_at);
      if (best) products = products.filter((p) => p.is_best);
      if (!admin) products = visibleProducts(products, req.query.get('salon_id'));
      return { data: products };
    }],
    ['POST', /^\/api\/products$/, (req) => {
      const parsed = ProductCatalog.readProductBody(req.body || {});
      if (parsed.error) return { status: 400, error: parsed.error };
      const product = {
        id: nextId(db.products),
        ...parsed.fields,
        is_best: 0,
        rating: 0,
        review_count: 0,
        deleted_at: '',
        created_at: nowStamp(),
      };
      applyProductListing(product);
      db.products.push(product);
      ProductCatalog.syncPointBlock(db, product);
      save();
      return { data: product };
    }],
    ['POST', /^\/api\/products\/(\d+)\/restore$/, (req, id) => {
      const product = db.products.find((p) => p.id === Number(id));
      if (!product) return { status: 404, error: '상품을 찾을 수 없습니다' };
      product.deleted_at = '';
      if (!product.sale_status || product.sale_status === 'STOP') product.sale_status = 'SELLING';
      applyProductListing(product);
      save();
      return { data: product };
    }],
    ['PUT', /^\/api\/products\/(\d+)$/, (req, id) => {
      const product = db.products.find((p) => p.id === Number(id));
      if (!product) return { status: 404, error: '상품을 찾을 수 없습니다' };
      const parsed = ProductCatalog.readProductBody(req.body || {});
      if (parsed.error) return { status: 400, error: parsed.error };
      Object.assign(product, parsed.fields);
      applyProductListing(product);
      ProductCatalog.syncPointBlock(db, product);
      save();
      return { data: product };
    }],
    ['DELETE', /^\/api\/products\/(\d+)$/, (req, id) => {
      const product = db.products.find((p) => p.id === Number(id));
      if (!product) return { status: 404, error: '상품을 찾을 수 없습니다' };
      product.deleted_at = nowStamp();
      product.is_active = 0;
      save();
      return { data: { id: product.id, deleted_at: product.deleted_at } };
    }],
    ['GET', /^\/api\/salons$/, () => ({ data: db.salons.map(publicSalon) })],
    ['GET', /^\/api\/salons\/lookup$/, (req) => {
      const raw = String(req.query.get('code') || '').trim();
      const code = normalizeSalonCode(raw);
      if (!code) {
        return { status: 400, error: raw ? '매장 코드는 6자리 숫자입니다' : '매장 코드를 입력해주세요' };
      }
      const salon = findSalonByCode(code);
      if (!salon) return { status: 404, error: '매장 코드를 찾을 수 없습니다' };
      return {
        data: {
          salon: publicSalon(salon),
          designers: ensureOwnerDesigner(salon),
        },
      };
    }],
        ['POST', /^\/api\/salons\/setup$/, (req) => {
        const body = req.body || {};
        const user = db.users.find((u) => u.id === Number(body.user_id));
        if (!user) return { status: 404, error: '사용자를 찾을 수 없습니다' };
        if (!body.salon_name || !body.owner_name || !body.owner_phone) {
          return { status: 400, error: '매장명, 대표자, 휴대폰번호를 입력하세요' };
        }
        const rawCode = String(body.salon_code || '').trim();
        const code = normalizeSalonCode(rawCode);
        if (!code) return { status: 400, error: rawCode ? '매장 코드는 6자리 숫자입니다' : '매장 코드를 입력해주세요' };
        if (findSalonByCode(code)) return { status: 400, error: '이미 사용 중인 매장 코드입니다' };
        const owned = ownedSalon(user);
        if (owned) return { status: 400, error: '이미 운영 중인 매장이 있습니다' };
        const salonId = nextId(db.salons);
        const salon = {
          id: salonId,
          salon_name: String(body.salon_name).trim(),
          salon_code: code,
          logo_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=' + encodeURIComponent(body.salon_name),
          owner_name: String(body.owner_name).trim(),
          owner_phone: String(body.owner_phone).trim(),
          address: String(body.address || '').trim(),
          address_detail: String(body.address_detail || '').trim(),
          bank_name: String(body.bank_name || '').trim(),
          bank_account: String(body.bank_account || '').trim(),
          hidden_brand_ids: [],
          brand_discount_rates: {},
          product_discount_rates: {},
          product_prices: {},
          created_at: nowStamp(),
        };
        if (!salon.bank_name) return { status: 400, error: '정산 받을 은행을 입력하세요' };
        if (!salon.bank_account) return { status: 400, error: '정산 받을 계좌번호를 입력하세요' };
        db.salons.push(salon);
        const designerNames = Array.isArray(body.designers) ? body.designers : [];
        designerNames.forEach((row) => {
          const rawName = typeof row === 'string' ? row : (row && row.designer_name);
          if (!rawName || !String(rawName).trim()) return;
          const phone = String((row && row.phone) || '').trim();
          if (!phoneDigits(phone) || phoneDigits(phone).length < 10) return;
          const name = String(rawName).includes('디자이너') ? String(rawName).trim() : String(rawName).trim() + ' 디자이너';
          db.designers.push({
            id: nextId(db.designers),
            salon_id: salonId,
            designer_name: name,
            phone,
            profile_img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(name),
            status: 'INVITED',
            invited_at: nowStamp(),
            commission_rate: 0.15,
            created_at: nowStamp(),
          });
        });
        // 1인샵이어도 고객 입장용 대표 담당은 항상 ACTIVE로 둠
        ensureOwnerDesigner(salon);
        user.name = salon.owner_name;
        user.phone = salon.owner_phone;
        user.current_salon_id = salonId;
        user.mapped_designer_id = null;
        save();
        return {
          data: { salon: publicSalon(salon), user: publicUser(user), designers: activeDesignersForSalon(salonId) },
          extra: { message: '매장이 개설되었습니다' },
        };
      }],
      ['POST', /^\/api\/salons$/, (req) => {
      const body = req.body || {};
      if (!body.salon_name || !body.owner_name || !body.owner_phone) return { status: 400, error: '필수 항목을 입력하세요' };
      const salonId = nextId(db.salons);
      const salon = {
        id: salonId,
        salon_name: body.salon_name,
        salon_code: uniqueSalonCode(body.salon_code || defaultSalonCode({ id: salonId }), salonId),
        logo_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(body.salon_name)}`,
        owner_name: body.owner_name,
        owner_phone: body.owner_phone,
        bank_name: body.bank_name || '',
        bank_account: body.bank_account || '',
        hidden_brand_ids: [],
        brand_discount_rates: {},
        product_discount_rates: {},
        product_prices: {},
        created_at: nowStamp(),
      };
      db.salons.push(salon);
      save();
      return { data: publicSalon(salon) };
    }],
    ['PUT', /^\/api\/salons\/(\d+)$/, (req, id) => {
      const salon = findSalon(id);
      if (!salon) return { status: 404, error: '살롱을 찾을 수 없습니다' };
      const body = req.body || {};
      ['salon_name', 'owner_name', 'owner_phone', 'bank_name', 'bank_account', 'address', 'address_detail'].forEach((key) => {
        if (body[key] !== undefined) salon[key] = String(body[key] == null ? '' : body[key]).trim();
      });
      if (body.salon_code !== undefined) {
        const raw = String(body.salon_code || '').trim();
        const code = normalizeSalonCode(raw);
        if (!code) {
          return { status: 400, error: raw ? '매장 코드는 6자리 숫자입니다' : '매장 코드를 입력해주세요' };
        }
        salon.salon_code = uniqueSalonCode(code, salon.id);
      }
      save();
      const fresh = findSalon(id);
      return { data: publicSalon(fresh || salon) };
    }],
    ['POST', /^\/api\/salons\/(\d+)\/hidden-brands$/, (req, id) => {
      const salon = findSalon(id);
      if (!salon) return { status: 404, error: '살롱을 찾을 수 없습니다' };
      const body = req.body || {};
      const brandId = Number(body.brand_id);
      const brand = db.brands.find((item) => item.id === brandId);
      if (!brand) return { status: 400, error: '브랜드를 찾을 수 없습니다' };
      salon.hidden_brand_ids = salon.hidden_brand_ids || [];
      if (body.hidden) {
        if (!salon.hidden_brand_ids.includes(brandId)) salon.hidden_brand_ids.push(brandId);
      } else {
        salon.hidden_brand_ids = salon.hidden_brand_ids.filter((item) => item !== brandId);
      }
      save();
      return { data: publicSalon(salon) };
    }],
    ['POST', /^\/api\/salons\/(\d+)\/prices$/, (req, id) => {
      const salon = findSalon(id);
      if (!salon) return { status: 404, error: '살롱을 찾을 수 없습니다' };
      ProductCatalog.ensureSalonPricing(salon);
      const body = req.body || {};
      if (body.brand_id != null && body.brand_id !== '') {
        const brandId = Number(body.brand_id);
        const brand = db.brands.find((item) => item.id === brandId);
        if (!brand) return { status: 400, error: '브랜드를 찾을 수 없습니다' };
        const rate = Number(body.discount_rate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 100 || rate % 5 !== 0) return { status: 400, error: '할인율은 5% 단위로 고르세요' };
        const key = String(brandId);
        if (rate === 0) delete salon.brand_discount_rates[key];
        else salon.brand_discount_rates[key] = Math.round(rate * 10) / 10;
        save();
        return { data: publicSalon(salon) };
      }
      if (body.product_id != null && body.product_id !== '') {
        const product = db.products.find((item) => item.id === Number(body.product_id));
        if (!product) return { status: 400, error: '상품을 찾을 수 없습니다' };
        const key = String(product.id);
        if (body.clear) {
          delete salon.product_prices[key];
          delete salon.product_discount_rates[key];
          save();
          return { data: publicSalon(salon) };
        }
        if (body.discount_rate != null && body.discount_rate !== '') {
          const checkedRate = ProductCatalog.validateDiscountRate(product, body.discount_rate);
          if (checkedRate.error) return { status: 400, error: checkedRate.error };
          salon.product_discount_rates[key] = checkedRate.rate;
          delete salon.product_prices[key];
          save();
          return { data: publicSalon(salon) };
        }
        const checked = ProductCatalog.validateStorePrice(product, body.price);
        if (checked.error) return { status: 400, error: checked.error };
        salon.product_prices[key] = checked.price;
        save();
        return { data: publicSalon(salon) };
      }
      return { status: 400, error: '저장할 가격이 없습니다' };
    }],
    ['GET', /^\/api\/salons\/(\d+)\/qr$/, (req, id) => {
      const salon = findSalon(id);
      if (!salon) return { status: 404, error: '살롱을 찾을 수 없습니다' };
      ensureOwnerDesigner(salon);
      const designers = db.designers
        .filter((d) => d.salon_id === salon.id)
        .map((d) => ({ id: d.id, designer_name: d.designer_name, profile_img: d.profile_img, status: d.status }));
      return {
        data: {
          salon: {
            id: salon.id,
            salon_name: salon.salon_name,
            salon_code: salon.salon_code,
            logo_url: salon.logo_url,
            owner_name: salon.owner_name,
          },
          designers,
          qr_url: `/scan?code=${encodeURIComponent(salon.salon_code || '')}`,
        },
      };
    }],
    ['GET', /^\/api\/salons\/(\d+)\/stats$/, (req, id) => {
      const salon = findSalon(id);
      if (!salon) return { status: 404, error: '살롱을 찾을 수 없습니다' };
      const orders = db.orders.filter((o) => o.salon_id === salon.id);
      const paid = orders.filter((o) => o.payment_status === 'PAID');
      const sum = (key) => paid.reduce((acc, o) => acc + (o[key] || 0), 0);
      return {
        data: {
          total_orders: orders.length,
          paid_orders: paid.length,
          total_revenue: sum('total_amount'),
          total_salon_commission: sum('salon_commission_amount'),
          total_designer_commission: sum('designer_commission_amount'),
          total_platform_amount: sum('platform_amount'),
          user_count: db.users.filter((u) => u.current_salon_id === salon.id).length,
        },
      };
    }],
    ['GET', /^\/api\/designers$/, (req) => {
      const salonId = req.query.get('salon_id');
      let designers = db.designers;
      if (salonId) designers = designers.filter((d) => d.salon_id === Number(salonId));
      return { data: designers.map(publicDesigner) };
    }],
    ['POST', /^\/api\/designers$/, (req) => {
      const body = req.body || {};
      if (!body.designer_name || !body.salon_id) return { status: 400, error: '필수 항목을 입력하세요' };
      if (!findSalon(body.salon_id)) return { status: 404, error: '살롱을 찾을 수 없습니다' };
      const phone = String(body.phone || '').trim();
      if (!phoneDigits(phone) || phoneDigits(phone).length < 10) {
        return { status: 400, error: '담당자 휴대폰번호를 입력해주세요' };
      }
      const name = String(body.designer_name).includes('디자이너') ? body.designer_name : `${body.designer_name} 디자이너`;
      const inviteOnly = body.invite !== false;
      const designer = {
        id: nextId(db.designers),
        salon_id: Number(body.salon_id),
        designer_name: name,
        phone,
        profile_img: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        status: inviteOnly ? 'INVITED' : 'ACTIVE',
        commission_rate: Number(body.commission_rate || 0.15),
        invited_at: inviteOnly ? nowStamp() : null,
        created_at: nowStamp(),
      };
      db.designers.push(designer);
      const matchUser = db.users.find((u) => phoneDigits(u.phone) === phoneDigits(phone));
      const salon = findSalon(designer.salon_id);
      let demoSms = '';
      let inviteUrl = '';
      if (designer.status === 'INVITED') {
        inviteUrl = inviteUrlFor(designer.id);
        demoSms = buildInviteSms(salon, designer, matchUser);
      }
      save();
      return {
        data: publicDesigner(designer),
        extra: {
          message: designer.status === 'INVITED' ? '담당자에게 초대 요청을 보냈습니다' : '담당자가 추가되었습니다',
          demo_sms: demoSms,
          invite_url: inviteUrl,
          existing_member: !!matchUser,
        },
      };
    }],
    ['GET', /^\/api\/designers\/(\d+)\/invite-info$/, (req, id) => {
      const designer = findDesigner(id);
      if (!designer) return { status: 404, error: '초대를 찾을 수 없습니다' };
      const salon = findSalon(designer.salon_id);
      const phone = phoneDigits(designer.phone);
      return {
        data: {
          id: designer.id,
          status: designer.status,
          designer_name: designer.designer_name,
          salon_id: designer.salon_id,
          salon_name: salon ? salon.salon_name : '',
          phone_hint: phone ? phone.slice(-4) : '',
          invite_url: inviteUrlFor(designer.id),
        },
      };
    }],
    ['POST', /^\/api\/designers\/(\d+)\/invite$/, (req, id) => {
      const designer = findDesigner(id);
      if (!designer) return { status: 404, error: '디자이너를 찾을 수 없습니다' };
      if (!phoneDigits(designer.phone)) return { status: 400, error: '담당자 휴대폰번호가 없습니다' };
      designer.status = 'INVITED';
      designer.invited_at = nowStamp();
      const salon = findSalon(designer.salon_id);
      const matchUser = db.users.find((u) => phoneDigits(u.phone) === phoneDigits(designer.phone));
      const demoSms = buildInviteSms(salon, designer, matchUser);
      save();
      return {
        data: publicDesigner(designer),
        extra: {
          message: '초대 문자를 다시 보냈습니다',
          demo_sms: demoSms,
          invite_url: inviteUrlFor(designer.id),
        },
      };
    }],
    ['POST', /^\/api\/designers\/(\d+)\/accept$/, (req, id) => {
      const designer = findDesigner(id);
      if (!designer) return { status: 404, error: '초대를 찾을 수 없습니다' };
      const user = db.users.find((u) => u.id === Number((req.body || {}).user_id));
      if (!user) return { status: 404, error: '사용자를 찾을 수 없습니다' };
      const result = activateStaffInvite(user, designer);
      if (result.error) return { status: 400, error: result.error };
      save();
      return {
        data: { user: publicUser(user), designer: publicDesigner(designer), resigned: result.resigned.map(publicDesigner) },
        extra: {
          message: result.resigned.length
            ? '새 매장 담당자로 등록되었고, 이전 매장 담당 소속은 해제되었습니다'
            : '담당자로 등록되었습니다',
        },
      };
    }],
    ['GET', /^\/api\/users\/(\d+)\/staff-invites$/, (req, id) => {
      const user = db.users.find((u) => u.id === Number(id));
      if (!user) return { status: 404, error: '사용자를 찾을 수 없습니다' };
      return { data: pendingStaffInvitesFor(user) };
    }],
    ['POST', /^\/api\/designers\/(\d+)\/resign$/, (req, id) => {
      const designer = findDesigner(id);
      if (!designer) return { status: 404, error: '디자이너를 찾을 수 없습니다' };
      designer.status = 'RESIGNED';
      designer.resigned_at = nowStamp();
      db.users.forEach((user) => {
        if (user.mapped_designer_id === designer.id) user.mapped_designer_id = null;
        if (Number(user.staff_designer_id) === designer.id) user.staff_designer_id = null;
      });
      save();
      return { data: publicDesigner(designer), extra: { message: '퇴사 처리되었습니다.' } };
    }],
    ['POST', /^\/api\/designers\/(\d+)\/reinstate$/, (req, id) => {
      const designer = findDesigner(id);
      if (!designer) return { status: 404, error: '디자이너를 찾을 수 없습니다' };
      designer.status = 'ACTIVE';
      save();
      return { data: publicDesigner(designer) };
    }],
    ['GET', /^\/api\/users$/, (req) => {
      const salonId = req.query.get('salon_id');
      let users = db.users;
      if (salonId) users = users.filter((u) => u.current_salon_id === Number(salonId));
      users = users.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return { data: users.map(publicUser) };
    }],
    ['POST', /^\/api\/auth\/otp\/send$/, (req) => {
      const phone = String((req.body || {}).phone || '').trim();
      const code = issueOtp(phone);
      if (!code) return { status: 400, error: '휴대폰번호를 정확히 입력해주세요' };
      return {
        data: { phone: phoneDigits(phone), expires_in: 300 },
        extra: {
          message: '인증번호를 발송했습니다',
          demo_code: code,
          demo_note: '데모: 실제 문자 대신 화면에 인증번호를 표시합니다',
        },
      };
    }],
    ['POST', /^\/api\/auth\/otp\/verify$/, (req) => {
      const body = req.body || {};
      if (!verifyOtp(body.phone, body.code)) {
        return { status: 400, error: '인증번호가 올바르지 않거나 만료되었습니다' };
      }
      return { data: { phone: phoneDigits(body.phone), verified: true }, extra: { message: '휴대폰 인증이 완료되었습니다' } };
    }],
    ['POST', /^\/api\/auth\/demo-owner$/, () => {
      ensureDemoOwnerUsers();
      const preferred = findSalon(1) || (db.salons || [])[0] || null;
      const ranked = (db.salons || []).slice().sort((a, b) => {
        if (preferred && Number(a.id) === Number(preferred.id)) return -1;
        if (preferred && Number(b.id) === Number(preferred.id)) return 1;
        const ta = String(a.created_at || '');
        const tb = String(b.created_at || '');
        if (ta !== tb) return tb.localeCompare(ta);
        return Number(b.id || 0) - Number(a.id || 0);
      });
      for (const salon of ranked) {
        const byPhone = (db.users || []).find((u) => phoneKey(u.phone) && phoneKey(u.phone) === phoneKey(salon.owner_phone));
        const byOwned = (db.users || []).find((u) => {
          const owned = ownedSalon(u);
          return owned && Number(owned.id) === Number(salon.id);
        });
        const user = byPhone || byOwned;
        if (!user) continue;
        user.auth_provider = user.auth_provider || 'kakao';
        if (!user.kakao_id) user.kakao_id = 'kakao_owner_' + salon.id;
        user.current_salon_id = salon.id;
        user.phone = salon.owner_phone || user.phone;
        user.name = salon.owner_name || user.name || '원장';
        user.phone_verified = true;
        if (!user.shipping_address) {
          user.shipping_address = '(06236) 서울 강남구 테헤란로 152 801호';
        }
        save();
        return {
          data: publicUser(user),
          extra: {
            message: (salon.salon_name || '매장') + ' 원장으로 로그인했습니다',
            salon_name: salon.salon_name || '',
            provider: user.auth_provider || 'kakao',
            auth_id: user.kakao_id || '',
          },
        };
      }
      return { status: 404, error: '개설된 원장 계정이 없습니다. 먼저 관리자로 매장을 만들어 주세요.' };
    }],
    ['POST', /^\/api\/auth\/social$/, (req) => {
      const body = req.body || {};
      const provider = String(body.provider || '').trim().toLowerCase();
      const authId = String(body.auth_id || body.kakao_id || '').trim();
      const allowed = ['kakao', 'google', 'naver', 'apple'];
      if (!allowed.includes(provider) || !authId) {
        return { status: 400, error: '소셜 로그인 정보가 올바르지 않습니다' };
      }
      const existing = db.users.find((item) => item.kakao_id === authId);
      if (existing) {
        existing.auth_provider = provider;
        const ownedExisting = ownedSalon(existing);
        if (ownedExisting && !existing.current_salon_id) existing.current_salon_id = ownedExisting.id;
        save();
        return {
          data: publicUser(existing),
          extra: {
            is_new: false,
            is_returning: true,
            salon_bound: !!(existing.current_salon_id && existing.mapped_designer_id),
          },
        };
      }
      if (!body.name || !body.phone || !body.shipping_address) {
        return {
          data: null,
          extra: { needs_profile: true, provider, auth_id: authId },
        };
      }
      if (!isPhoneVerified(body.phone)) {
        return { status: 400, error: '휴대폰 문자 인증을 완료해주세요' };
      }
      const owned = ownedSalon({ phone: body.phone });
      const user = {
        id: nextId(db.users),
        kakao_id: authId,
        auth_provider: provider,
        name: String(body.name).trim(),
        phone: String(body.phone).trim(),
        shipping_address: String(body.shipping_address).trim(),
        phone_verified: true,
        current_salon_id: owned ? owned.id : null,
        mapped_designer_id: null,
        created_at: nowStamp(),
      };
      const invited = acceptDesignerInvites(user);
      db.users.push(user);
      save();
      return {
        data: publicUser(user),
        extra: {
          is_new: true,
          is_returning: false,
          salon_bound: !!(user.current_salon_id && user.mapped_designer_id),
          staff_invites_accepted: invited.length,
          message: invited.length ? '담당자 초대가 수락되었습니다' : undefined,
        },
      };
    }],
    ['POST', /^\/api\/users$/, (req) => {
      const body = req.body || {};
      if (!body.name) return { status: 400, error: '이름을 입력해주세요' };
      const existing = body.kakao_id ? db.users.find((item) => item.kakao_id === body.kakao_id) : null;
      if (existing) {
        if (body.name) existing.name = body.name;
        if (body.phone) existing.phone = body.phone;
        if (body.shipping_address !== undefined) existing.shipping_address = String(body.shipping_address || '').trim();
        if (body.auth_provider) existing.auth_provider = body.auth_provider;
        const ownedExisting = ownedSalon(existing);
        if (ownedExisting && !existing.current_salon_id) existing.current_salon_id = ownedExisting.id;
        save();
        return { data: publicUser(existing) };
      }
      const owned = ownedSalon({ phone: body.phone });
      const user = {
        id: nextId(db.users),
        kakao_id: body.kakao_id || `kakao_${Date.now()}`,
        auth_provider: body.auth_provider || 'kakao',
        name: body.name,
        phone: body.phone || '',
        shipping_address: String(body.shipping_address || '').trim(),
        current_salon_id: owned ? owned.id : null,
        mapped_designer_id: null,
        created_at: nowStamp(),
      };
      db.users.push(user);
      save();
      return { data: publicUser(user) };
    }],
    ['GET', /^\/api\/users\/(\d+)$/, (req, id) => {
      const user = db.users.find((u) => u.id === Number(id));
      if (!user) return { status: 404, error: '고객을 찾을 수 없습니다' };
      return { data: { user: publicUser(user), orders: userOrders(user.id) } };
    }],
    ['PUT', /^\/api\/users\/(\d+)$/, (req, id) => {
      const user = db.users.find((u) => u.id === Number(id));
      if (!user) return { status: 404, error: '고객을 찾을 수 없습니다' };
      const body = req.body || {};
      const name = String(body.name != null ? body.name : user.name || '').trim();
      const phone = String(body.phone != null ? body.phone : user.phone || '').trim();
      const shipping = String(body.shipping_address != null ? body.shipping_address : user.shipping_address || '').trim();
      if (!name) return { status: 400, error: '이름을 입력해주세요' };
      if (!phone) return { status: 400, error: '휴대폰번호를 입력해주세요' };
      if (!shipping) return { status: 400, error: '배송주소를 입력해주세요' };
      const phoneChanged = phoneDigits(phone) !== phoneDigits(user.phone);
      if (phoneChanged && !isPhoneVerified(phone)) {
        return { status: 400, error: '휴대폰 번호 변경 시 문자 인증을 완료해주세요' };
      }
      user.name = name;
      user.phone = phone;
      user.shipping_address = shipping;
      if (phoneChanged) user.phone_verified = true;
      save();
      return { data: publicUser(user), extra: { message: '회원 정보를 저장했습니다' } };
    }],
    ['POST', /^\/api\/users\/(\d+)\/scan-qr$/, (req, id) => {
      const user = db.users.find((u) => u.id === Number(id));
      if (!user) return { status: 404, error: '고객을 찾을 수 없습니다' };
      const body = req.body || {};
      let salon = body.salon_id ? findSalon(body.salon_id) : null;
      if (!salon && body.salon_code) salon = findSalonByCode(body.salon_code);
      const designerId = body.designer_id ? Number(body.designer_id) : null;
      if (!salon) return { status: 404, error: '살롱을 찾을 수 없습니다' };
      if (!designerId) return { status: 400, error: '담당자를 선택해주세요' };
      // 고객 앱에 매장 이동 UX 없음. 소속이 바뀌는 경우에도 주문은 user_id로 유지(assignSalon이 주문 미수정).
      if (user.current_salon_id && Number(user.current_salon_id) !== Number(salon.id)) {
        return { status: 400, error: '이미 등록된 매장이 있습니다' };
      }
      const result = assignSalon(user, salon.id, designerId);
      if (result.error) return { status: 400, error: result.error };
      return { data: result.user, extra: { message: `${salon.salon_name} · 담당자 등록이 완료되었습니다` } };
    }],
    ['POST', /^\/api\/users\/(\d+)\/confirm-switch$/, () => ({
      status: 400,
      error: '매장 변경은 고객 앱에서 지원하지 않습니다',
    })],
    ['GET', /^\/api\/brands$/, () => ({ data: db.brands })],
    ['POST', /^\/api\/brands$/, (req) => {
      const body = req.body || {};
      if (!body.name) return { status: 400, error: '브랜드명을 입력하세요' };
      const brand = { id: nextId(db.brands), name: body.name, commission_rate: Number(body.commission_rate ?? 0.1), blocked_salon_ids: [], status: 'ACTIVE', created_at: nowStamp() };
      db.brands.push(brand);
      save();
      return { data: brand };
    }],
    ['PUT', /^\/api\/brands\/(\d+)$/, (req, id) => {
      const brand = db.brands.find((item) => item.id === Number(id));
      if (!brand) return { status: 404, error: '브랜드를 찾을 수 없습니다' };
      const body = req.body || {};
      if (body.name !== undefined) brand.name = body.name;
      if (body.commission_rate !== undefined) brand.commission_rate = Number(body.commission_rate);
      if (body.status !== undefined) brand.status = body.status;
      save();
      return { data: brand };
    }],
    ['POST', /^\/api\/brands\/(\d+)\/blocked-salons$/, (req, id) => {
      const brand = db.brands.find((item) => item.id === Number(id));
      if (!brand) return { status: 404, error: '브랜드를 찾을 수 없습니다' };
      const body = req.body || {};
      const salon = findSalon(body.salon_id);
      if (!salon) return { status: 400, error: '살롱을 찾을 수 없습니다' };
      brand.blocked_salon_ids = brand.blocked_salon_ids || [];
      const salonId = salon.id;
      if (body.blocked) {
        if (!brand.blocked_salon_ids.includes(salonId)) brand.blocked_salon_ids.push(salonId);
      } else {
        brand.blocked_salon_ids = brand.blocked_salon_ids.filter((item) => item !== salonId);
      }
      save();
      return { data: brand };
    }],
    ['GET', /^\/api\/coupons$/, () => ({ data: db.coupons })],
    ['POST', /^\/api\/coupons$/, (req) => {
      const body = req.body || {};
      if (!body.name) return { status: 400, error: '쿠폰명을 입력하세요' };
      const coupon = {
        id: nextId(db.coupons),
        name: body.name,
        code: body.code || `CP${nextId(db.coupons)}`,
        discount_type: body.discount_type === 'RATE' ? 'RATE' : 'AMOUNT',
        discount_value: Number(body.discount_value || 0),
        min_order_amount: Number(body.min_order_amount || 0),
        apply_scope: body.apply_scope === 'CATEGORY' || body.category
          ? 'CATEGORY'
          : (body.apply_scope === 'BRAND' || body.brand_id ? 'BRAND' : 'ALL'),
        category: body.category || null,
        brand_id: body.brand_id ? Number(body.brand_id) : null,
        issue_target: body.issue_target === 'ORDER_COUNT' ? 'ORDER_COUNT' : 'ALL',
        order_count_min: body.order_count_min === '' || body.order_count_min == null ? null : Number(body.order_count_min),
        order_count_max: body.order_count_max === '' || body.order_count_max == null ? null : Number(body.order_count_max),
        issued_count: Number(body.issued_count || 0),
        used_count: 0,
        starts_at: body.starts_at || nowStamp().slice(0, 10),
        ends_at: body.ends_at || '',
        status: 'ACTIVE',
      };
      db.coupons.push(coupon);
      save();
      return { data: coupon };
    }],
    ['DELETE', /^\/api\/coupons\/(\d+)$/, (req, id) => {
      const coupon = db.coupons.find((item) => item.id === Number(id));
      if (!coupon) return { status: 404, error: '쿠폰을 찾을 수 없습니다' };
      coupon.status = 'STOPPED';
      save();
      return { data: coupon };
    }],
    ['PUT', /^\/api\/coupons\/(\d+)$/, (req, id) => {
      const coupon = db.coupons.find((item) => item.id === Number(id));
      if (!coupon) return { status: 404, error: '쿠폰을 찾을 수 없습니다' };
      const body = req.body || {};
      if (body.name !== undefined) coupon.name = body.name;
      if (body.discount_type !== undefined) coupon.discount_type = body.discount_type === 'RATE' ? 'RATE' : 'AMOUNT';
      if (body.discount_value !== undefined) coupon.discount_value = Number(body.discount_value || 0);
      if (body.min_order_amount !== undefined) coupon.min_order_amount = Number(body.min_order_amount || 0);
      if (body.brand_id !== undefined) coupon.brand_id = body.brand_id ? Number(body.brand_id) : null;
      if (body.category !== undefined) coupon.category = body.category || null;
      if (body.apply_scope === 'CATEGORY' || coupon.category) {
        coupon.apply_scope = 'CATEGORY';
        coupon.brand_id = null;
      } else if (body.apply_scope === 'BRAND' || coupon.brand_id) {
        coupon.apply_scope = 'BRAND';
        coupon.category = null;
      } else {
        coupon.apply_scope = 'ALL';
        coupon.brand_id = null;
        coupon.category = null;
      }
      if (body.issue_target !== undefined) coupon.issue_target = body.issue_target === 'ORDER_COUNT' ? 'ORDER_COUNT' : 'ALL';
      if (body.starts_at !== undefined) coupon.starts_at = body.starts_at;
      if (body.ends_at !== undefined) coupon.ends_at = body.ends_at;
      if (body.issued_count !== undefined) coupon.issued_count = Number(body.issued_count || 0);
      save();
      return { data: coupon };
    }],
    ['GET', /^\/api\/points\/blocked$/, () => ({
      data: db.products.map((product) => ({ id: product.id, name: product.name, brand_id: product.brand_id, blocked: (db.point_blocked_ids || []).includes(product.id) })),
    })],
    ['POST', /^\/api\/points\/blocked$/, (req) => {
      const body = req.body || {};
      const id = Number(body.product_id);
      db.point_blocked_ids = db.point_blocked_ids || [];
      if (body.blocked) {
        if (!db.point_blocked_ids.includes(id)) db.point_blocked_ids.push(id);
      } else db.point_blocked_ids = db.point_blocked_ids.filter((item) => item !== id);
      save();
      return { data: db.point_blocked_ids };
    }],
    ['GET', /^\/api\/points$/, () => ({ data: db.point_grants.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) })],
    ['POST', /^\/api\/points$/, (req) => {
      const body = req.body || {};
      const ids = (body.user_ids && body.user_ids.length ? body.user_ids : [body.user_id]).map(Number).filter(Boolean);
      const users = db.users.filter((item) => ids.includes(item.id));
      if (!users.length) return { status: 400, error: '고객을 선택하세요' };
      const amount = Math.abs(Number(body.amount || 0));
      if (!amount) return { status: 400, error: '포인트를 입력하세요' };
      const signed = body.direction === 'DEDUCT' ? -amount : amount;
      const scheduled = body.timing === 'SCHEDULED';
      const grant = {
        id: nextId(db.point_grants),
        user_id: users.length === 1 ? users[0].id : null,
        user_ids: users.map((item) => item.id),
        user_name: users.length === 1 ? users[0].name : `${users[0].name} 외 ${users.length - 1}명`,
        target_summary: body.target_summary || (users.length === 1 ? users[0].name : `조건 ${users.length}명`),
        amount: signed,
        reason: body.reason || (signed > 0 ? '수동 지급' : '수동 차감'),
        expires_at: body.expires_at || '',
        created_by: 'Admin',
        status: scheduled ? 'SCHEDULED' : 'COMPLETED',
        created_at: body.scheduled_at || nowStamp(),
      };
      db.point_grants.push(grant);
      if (!scheduled) users.forEach((user) => { user.points = Math.max(0, (user.points || 0) + signed); });
      save();
      return { data: grant };
    }],
    ['GET', /^\/api\/banners$/, (req) => {
      const type = req.query.get('type');
      let banners = db.banners;
      if (type) banners = banners.filter((item) => item.banner_type === type);
      return { data: banners.slice().sort((a, b) => a.sort_order - b.sort_order) };
    }],
    ['POST', /^\/api\/banners$/, (req) => {
      const body = req.body || {};
      if (!body.title) return { status: 400, error: '배너 제목을 입력하세요' };
      const banner = { id: nextId(db.banners), banner_type: body.banner_type === 'MID' ? 'MID' : 'MAIN', title: body.title, image_url: body.image_url || '', starts_at: body.starts_at || nowStamp().slice(0, 10), ends_at: body.ends_at || '', sort_order: db.banners.length + 1, status: 'ACTIVE' };
      db.banners.push(banner);
      save();
      return { data: banner };
    }],
    ['DELETE', /^\/api\/banners\/(\d+)$/, (req, id) => {
      const banner = db.banners.find((item) => item.id === Number(id));
      if (!banner) return { status: 404, error: '배너를 찾을 수 없습니다' };
      banner.status = 'STOPPED';
      save();
      return { data: banner };
    }],
    ['GET', /^\/api\/settlements$/, (req) => {
      const months = recentSettlementMonths(18);
      const selected = req.query.get('month') || nowStamp().slice(0, 7);
      const salonId = req.query.get('salon_id');
      const salons = db.salons.slice().sort((a, b) => a.salon_name.localeCompare(b.salon_name, 'ko'));
      const focus = salonId && salonId !== 'ALL' ? salons.find((salon) => salon.id === Number(salonId)) : null;
      const rows = focus
        ? months.map((period) => salonPeriodRow(focus, period))
        : salons.map((salon) => salonPeriodRow(salon, selected));
      const summaryRows = focus ? rows.filter((row) => row.period === selected) : rows;
      return { data: { month: selected, months, range: monthBounds(selected), salon_id: focus ? focus.id : 'ALL', summary: summarizeSettlementRows(summaryRows), rows } };
    }],
    ['POST', /^\/api\/settlements\/status$/, (req) => {
      const body = req.body || {};
      const ids = body.ids && body.ids.length ? body.ids : (body.id ? [body.id] : []);
      if (!ids.length || !body.status) return { status: 400, error: '정산 상태가 없습니다' };
      ids.forEach((id) => {
        const current = db.settlement_overrides.find((item) => item.id === id);
        if (current) current.status = body.status;
        else db.settlement_overrides.push({ id, status: body.status });
      });
      save();
      return { data: { ids, status: body.status } };
    }],
    ['PUT', /^\/api\/orders\/(\d+)\/shipping$/, (req, id) => {
      const order = db.orders.find((item) => item.id === Number(id));
      if (!order) return { status: 404, error: '주문을 찾을 수 없습니다' };
      const next = req.body && req.body.shipping_status;
      if (!['READY', 'SHIPPING', 'DELIVERED'].includes(next)) return { status: 400, error: '배송 상태를 확인하세요' };
      order.shipping_status = next;
      save();
      return { data: publicOrder(order) };
    }],
    ['POST', /^\/api\/orders\/(\d+)\/cancel-request$/, (req, id) => {
      const order = db.orders.find((item) => item.id === Number(id));
      if (!order) return { status: 404, error: '주문을 찾을 수 없습니다' };
      const body = req.body || {};
      if (body.user_id && Number(body.user_id) !== Number(order.user_id)) {
        return { status: 403, error: '본인 주문만 취소 요청할 수 있습니다' };
      }
      const ship = order.shipping_status || 'READY';
      if (order.payment_status === 'CANCELLED' || order.payment_status === 'REFUNDED') {
        return { status: 400, error: '이미 취소된 주문입니다' };
      }
      if (ship !== 'READY') {
        return { status: 400, error: '배송이 시작된 주문은 취소 요청할 수 없습니다' };
      }
      if (order.cancel_requested) {
        return { data: publicOrder(order), extra: { message: '이미 취소 요청된 주문입니다' } };
      }
      order.cancel_requested = true;
      order.cancel_requested_at = nowStamp();
      save();
      return { data: publicOrder(order), extra: { message: '취소 요청이 접수되었습니다' } };
    }],
    ['GET', /^\/api\/orders\/stats$/, () => ({ data: orderStats() })],
    ['GET', /^\/api\/orders$/, (req) => {
      let orders = db.orders.slice();
      const userId = req.query.get('user_id');
      const salonId = req.query.get('salon_id');
      const status = req.query.get('status');
      if (userId) orders = orders.filter((o) => o.user_id === Number(userId));
      if (salonId) orders = orders.filter((o) => o.salon_id === Number(salonId));
      if (status) orders = orders.filter((o) => o.payment_status === status);
      orders.sort((a, b) => b.id - a.id);
      return { data: orders.map(publicOrder) };
    }],
    ['POST', /^\/api\/orders$/, (req) => {
      const body = req.body || {};
      const user = db.users.find((u) => u.id === Number(body.user_id));
      if (!user) return { status: 400, error: '고객 정보가 없습니다' };
      if (!user.current_salon_id) return { status: 400, error: '먼저 매장 코드를 등록해주세요' };
      const salon = findSalon(user.current_salon_id);
      if (!salon) return { status: 400, error: '등록된 살롱을 찾을 수 없습니다' };
      // 담당자는 매핑되어 있으면 귀속(퇴사여도 표시명과 일치). 없어도 주문은 진행.
      let designer = null;
      if (user.mapped_designer_id) {
        designer = db.designers.find((d) =>
          d.id === Number(user.mapped_designer_id) && Number(d.salon_id) === Number(salon.id)
          && d.status !== 'INVITED') || null;
      }
      const items = [];
      for (const item of body.items || []) {
        const product = db.products.find((p) => p.id === Number(item.product_id) && p.is_active);
        if (!product) return { status: 400, error: '상품을 찾을 수 없습니다' };
        const block = productSaleBlock(salon, product);
        if (block) return { status: 400, error: `${product.name}은 ${block}` };
        const qty = Number(item.qty || 1);
        if (product.stock_quantity < qty) return { status: 400, error: `${product.name} 재고가 부족합니다` };
        const price = ProductCatalog.storeSellingPrice(salon, product);
        const salonPrice = ProductCatalog.salonCost(product);
        items.push({
          product_id: product.id,
          name: product.name,
          qty,
          price,
          salon_price: salonPrice,
          supply_price: Number(product.supply_price) || 0,
          hq_price: ProductCatalog.hqPrice(product),
        });
      }
      if (!items.length) return { status: 400, error: '주문 상품이 없습니다' };
      const goodsTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      let couponDiscount = Math.max(0, Number(body.coupon_discount) || 0);
      let pointsUsed = Math.max(0, Math.floor(Number(body.points_used) || 0));
      if (!couponDiscount) {
        couponDiscount = (body.items || []).reduce((s, item) => s + (Number(item.coupon_discount) || 0), 0);
      }
      if (!pointsUsed) {
        pointsUsed = (body.items || []).reduce((s, item) => s + (Number(item.points_used) || 0), 0);
      }
      couponDiscount = Math.min(couponDiscount, goodsTotal);
      const afterCoupon = Math.max(0, goodsTotal - couponDiscount);
      pointsUsed = Math.min(pointsUsed, afterCoupon, Math.max(0, Number(user.points) || 0));
      const paidTotal = Math.max(0, afterCoupon - pointsUsed);
      const split = splitAmount(paidTotal, Boolean(designer));
      const storePayout = items.reduce((sum, item) => sum + (item.price - item.salon_price) * item.qty, 0);
      const pointsEarned = orderPointsEarned(items.map((item) => ({
        ...item,
        price: paidTotal > 0 && goodsTotal > 0
          ? Math.round(item.price * (paidTotal / goodsTotal))
          : item.price,
      })));
      items.forEach((item) => {
        const product = db.products.find((p) => p.id === item.product_id);
        product.stock_quantity -= item.qty;
      });
      user.points = Math.max(0, (Number(user.points) || 0) - pointsUsed + pointsEarned);
      const shippingAddress = String(body.shipping_address || user.shipping_address || '').trim();
      if (!shippingAddress) {
        return { status: 400, error: '배송주소를 등록한 뒤 주문할 수 있습니다' };
      }
      const order = {
        id: nextId(db.orders),
        user_id: user.id,
        salon_id: salon.id,
        designer_id: designer ? designer.id : null,
        total_amount: paidTotal,
        platform_amount: split.platform,
        salon_commission_amount: storePayout,
        designer_commission_amount: split.designer,
        points_earned: pointsEarned,
        points_used: pointsUsed,
        coupon_id: body.coupon_id ? Number(body.coupon_id) : null,
        coupon_discount: couponDiscount,
        payment_status: 'PAID',
        shipping_status: 'READY',
        shipping_name: user.name || '',
        shipping_phone: user.phone || '',
        shipping_address: shippingAddress,
        order_items: JSON.stringify(items),
        created_at: nowStamp(),
      };
      db.orders.push(order);
      save();
      return {
        data: publicOrder(order),
        extra: {
          message: pointsEarned > 0
            ? `주문이 완료되었습니다 · ${pointsEarned.toLocaleString()}P 적립`
            : '주문이 완료되었습니다',
          user: publicUser(user),
        },
      };
    }],
  ];

  function handle(url, body) {
    for (const [method, pattern, handler] of routes) {
      if (method !== (url.method || 'GET')) continue;
      const match = url.pathname.match(pattern);
      if (!match) continue;
      const result = handler({ query: url.searchParams, body }, ...match.slice(1)) || {};
      if (result.error) return { status: result.status || 400, body: { success: false, error: result.error } };
      return { status: 200, body: { success: true, data: result.data, ...(result.extra || {}) } };
    }
    return { status: 404, body: { success: false, error: 'API를 찾을 수 없습니다' } };
  }

    const ready = (async () => {
    const seedRes = await fetch(siteRoot() + 'data/seed.json');
    const seed = await seedRes.json();
    const saved = localStorage.getItem(STORAGE_KEY);
    db = saved ? JSON.parse(saved) : seed;
    db.brands = db.brands || [];
    (seed.brands || []).forEach((brand) => {
      if (!db.brands.some((item) => item.id === brand.id)) db.brands.push(brand);
    });
    (db.brands || []).forEach((brand) => {
      if (!Array.isArray(brand.blocked_salon_ids)) brand.blocked_salon_ids = [];
    });
    (db.salons || []).forEach((salon) => {
      if (!Array.isArray(salon.hidden_brand_ids)) salon.hidden_brand_ids = [];
      if (salon.address == null) salon.address = '';
      if (salon.address_detail == null) salon.address_detail = '';
      if (salon.bank_name == null) salon.bank_name = '';
      if (!salon.bank_name && salon.bank_account) {
        const matched = String(salon.bank_account).match(/^(.+?(?:은행|뱅크|증권))\s+(.+)$/);
        if (matched) {
          salon.bank_name = matched[1].trim();
          salon.bank_account = matched[2].trim();
        }
      }
      const seedSalon = (seed.salons || []).find((item) => item.id === salon.id);
      const fromSelf = normalizeSalonCode(salon.salon_code);
      const fromSeed = normalizeSalonCode(seedSalon && seedSalon.salon_code);
      salon.salon_code = fromSelf || fromSeed || defaultSalonCode(salon);
      if (seedSalon) {
        if (!salon.bank_name && seedSalon.bank_name) salon.bank_name = seedSalon.bank_name;
        if ((!salon.bank_account || /은행|뱅크/.test(String(salon.bank_account))) && seedSalon.bank_account) {
          if (seedSalon.bank_name) {
            salon.bank_name = salon.bank_name || seedSalon.bank_name;
            salon.bank_account = seedSalon.bank_account;
          }
        }
      }
      ProductCatalog.ensureSalonPricing(salon);
    });
    db.coupons = db.coupons || [];
    (seed.coupons || []).forEach((seedCoupon) => {
      const local = db.coupons.find((c) => Number(c.id) === Number(seedCoupon.id));
      if (!local) {
        db.coupons.push(JSON.parse(JSON.stringify(seedCoupon)));
        return;
      }
      if (seedCoupon.apply_scope && !local.apply_scope) local.apply_scope = seedCoupon.apply_scope;
      if (seedCoupon.category && !local.category) local.category = seedCoupon.category;
      if (seedCoupon.apply_scope === 'CATEGORY') {
        local.apply_scope = 'CATEGORY';
        local.category = seedCoupon.category || local.category;
        local.brand_id = null;
      }
      if (seedCoupon.status === 'ACTIVE' && local.status !== 'STOPPED') local.status = 'ACTIVE';
      if (seedCoupon.ends_at && (!local.ends_at || local.ends_at < seedCoupon.ends_at)) {
        local.ends_at = seedCoupon.ends_at;
      }
    });
    if (!db.coupons.length) db.coupons = JSON.parse(JSON.stringify(seed.coupons || []));
    db.point_grants = db.point_grants || seed.point_grants || [];
    db.banners = db.banners || seed.banners || [];
    db.banners.forEach((banner) => {
      if (banner.banner_type === 'MAIN' && !banner.image_url) banner.image_url = 'static/banner-sample.png';
    });
    db.settlement_overrides = db.settlement_overrides || [];
    db.point_blocked_ids = db.point_blocked_ids || [];
    (db.coupons || []).forEach((coupon) => {
      if (coupon.min_order_amount == null) coupon.min_order_amount = 0;
      if (!coupon.issue_target) coupon.issue_target = 'ALL';
      if (coupon.issued_count == null) coupon.issued_count = 0;
      if (coupon.used_count == null) coupon.used_count = 0;
      if (coupon.apply_scope === 'CATEGORY' && !coupon.category) coupon.category = '샴푸';
    });
    db.products.forEach((product) => ProductCatalog.fillProductDefaults(product));
    db.orders.forEach((order) => {
      if (!order.shipping_status) order.shipping_status = 'READY';
      if (order.points_earned == null) order.points_earned = 0;
      if (order.points_used == null) order.points_used = 0;
      if (order.coupon_discount == null) order.coupon_discount = 0;
      if (order.cancel_requested == null) order.cancel_requested = false;
      if (!order.designer_id) {
        const owner = (db.users || []).find((u) => Number(u.id) === Number(order.user_id));
        if (owner && owner.mapped_designer_id) order.designer_id = owner.mapped_designer_id;
      }
      if (!order.shipping_address) {
        const owner = (db.users || []).find((u) => Number(u.id) === Number(order.user_id));
        if (owner) {
          if (!order.shipping_name) order.shipping_name = owner.name || '';
          if (!order.shipping_phone) order.shipping_phone = owner.phone || '';
          if (!order.shipping_address) order.shipping_address = owner.shipping_address || '';
        }
      }
    });
    (db.users || []).forEach((user) => {
      if (user.points == null) user.points = 0;
    });
    ensureDemoOwnerUsers();
    // 시드 디자이너 휴대폰·상태 보강
    (function ensureDesignerSeedFields() {
      (seed.designers || []).forEach((seedDesigner) => {
        const local = (db.designers || []).find((d) => Number(d.id) === Number(seedDesigner.id));
        if (!local) return;
        if (!local.phone && seedDesigner.phone) local.phone = seedDesigner.phone;
        if (!local.created_at && seedDesigner.created_at) local.created_at = seedDesigner.created_at;
      });
    })();
    // 고객에게 아직 담당으로 매핑된 디자이너는 ACTIVE로 맞춤 (이수진 RESIGNED ↔ UI 표기 불일치 방지)
    (function ensureMappedDesignersActive() {
      (seed.designers || []).forEach((seedDesigner) => {
        const local = (db.designers || []).find((d) => Number(d.id) === Number(seedDesigner.id));
        if (!local) {
          db.designers.push(JSON.parse(JSON.stringify(seedDesigner)));
          return;
        }
        if (seedDesigner.status && local.status !== seedDesigner.status) {
          // 시드가 ACTIVE인데 로컬만 RESIGNED면 복구 (데모 담당 이수진)
          if (seedDesigner.status === 'ACTIVE' && local.status === 'RESIGNED') {
            local.status = 'ACTIVE';
            delete local.resigned_at;
          }
        }
      });
      (db.users || []).forEach((user) => {
        if (!user.mapped_designer_id) return;
        const d = (db.designers || []).find((row) => Number(row.id) === Number(user.mapped_designer_id));
        if (d && d.status === 'RESIGNED' && Number(d.salon_id) === Number(user.current_salon_id)) {
          d.status = 'ACTIVE';
          delete d.resigned_at;
        }
      });
    })();
    // 데모 소셜 계정(김민수 등)을 시드와 고정 auth_id로 맞춤 — 매번 신규가입 화면 방지
    (function ensureDemoSocialUsers() {
      const demos = [
        {
          kakao_id: 'kakao_demo_minsu',
          aliases: ['kakao_001'],
          name: '김민수',
          phone: '010-1111-2222',
          shipping_address: '(06236) 서울 강남구 테헤란로 152 301호',
          current_salon_id: 1,
          mapped_designer_id: 1,
        },
        {
          kakao_id: 'kakao_004',
          aliases: [],
          name: '이서연',
          phone: '010-7777-8888',
          shipping_address: '(06236) 서울 강남구 테헤란로 152 502호',
          current_salon_id: 1,
          mapped_designer_id: 3,
        },
      ];
      demos.forEach((demo) => {
        let user = (db.users || []).find((u) => u.kakao_id === demo.kakao_id);
        if (!user) {
          user = (db.users || []).find((u) => (demo.aliases || []).includes(u.kakao_id));
        }
        if (!user) {
          user = (db.users || []).find((u) => u.name === demo.name || (demo.name === '김민수' && u.name === '홍길동' && u.id === 1));
        }
        if (user) {
          user.kakao_id = demo.kakao_id;
          user.auth_provider = 'kakao';
          user.name = demo.name;
          if (!user.phone) user.phone = demo.phone;
          if (!user.shipping_address) user.shipping_address = demo.shipping_address;
          if (!user.current_salon_id) user.current_salon_id = demo.current_salon_id;
          // 데모 담당은 시드와 항상 맞춤 (이수진 등)
          user.mapped_designer_id = demo.mapped_designer_id;
          user.phone_verified = true;
          if (!Array.isArray(user.coupon_ids) || !user.coupon_ids.length) user.coupon_ids = [1];
          if (!(Number(user.points) > 0)) user.points = demo.name === '김민수' ? 12000 : 8000;
        } else {
          db.users.push({
            id: nextId(db.users),
            kakao_id: demo.kakao_id,
            auth_provider: 'kakao',
            name: demo.name,
            phone: demo.phone,
            shipping_address: demo.shipping_address,
            phone_verified: true,
            current_salon_id: demo.current_salon_id,
            mapped_designer_id: demo.mapped_designer_id,
            created_at: nowStamp(),
            points: demo.name === '김민수' ? 12000 : 8000,
            coupon_ids: [1],
          });
        }
      });
    })();
    save();
  })();

  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, location.origin);
    const method = ((init && init.method) || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    if (!url.pathname.startsWith('/api/')) return originalFetch(input, init);
    return ready.then(async () => {
      let body = {};
      if (init && init.body) {
        try { body = JSON.parse(init.body); } catch (error) { body = {}; }
      }
      const result = handle({ pathname: url.pathname, searchParams: url.searchParams, method }, body);
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  };
})();
