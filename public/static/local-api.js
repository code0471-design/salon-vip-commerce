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

  function nextId(list) {
    return list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
  }

  function nowStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function findSalon(id) {
    return db.salons.find((s) => s.id === Number(id));
  }

  function findDesigner(id) {
    return db.designers.find((d) => d.id === Number(id));
  }

  function publicUser(user) {
    const salon = findSalon(user.current_salon_id);
    const designer = findDesigner(user.mapped_designer_id);
    return {
      ...user,
      salon_name: salon ? salon.salon_name : null,
      designer_name: designer ? designer.designer_name : null,
      designer_img: designer ? designer.profile_img : null,
    };
  }

  function publicOrder(order) {
    const user = db.users.find((u) => u.id === order.user_id);
    const salon = findSalon(order.salon_id);
    const designer = findDesigner(order.designer_id);
    return {
      ...order,
      user_name: user ? user.name : '',
      salon_name: salon ? salon.salon_name : '',
      designer_name: designer ? designer.designer_name : null,
      designer_status: designer ? designer.status : null,
      shipping_status: order.shipping_status || 'READY',
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
      bySalon.set(order.salon_id, row);
      gmv += amount;
    }
    const salonBreakdown = [...bySalon.values()]
      .map((row) => ({ ...row, commission: Math.round(row.revenue * 0.3) }))
      .sort((a, b) => b.revenue - a.revenue);
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
    let designer = null;
    if (designerId) {
      designer = db.designers.find((d) => d.id === Number(designerId) && d.salon_id === salon.id && d.status === 'ACTIVE');
    }
    user.current_salon_id = salon.id;
    user.mapped_designer_id = designer ? designer.id : null;
    save();
    return { user: publicUser(user) };
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
    const sales = paid.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const pointsUsed = paid.reduce((sum, order) => sum + (order.points_used || 0), 0);
    const couponDiscount = paid.reduce((sum, order) => sum + (order.coupon_discount || 0), 0);
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
      sales,
      paid_amount: Math.max(0, sales - pointsUsed - couponDiscount),
      cancelled_amount: cancelledAmount,
      points_used: pointsUsed,
      coupon_discount: couponDiscount,
      shipping_fee: shippingFee,
      payout: Math.round(sales * 0.3),
      designer_payout: 0,
      status: settlementStatusFor(id, period),
      lines: paid.map(publicOrder).map((order) => ({
        order_id: order.id,
        created_at: order.created_at,
        user_name: order.user_name,
        designer_name: order.designer_name,
        designer_status: order.designer_status,
        sales: order.total_amount,
        designer_payout: 0,
      })),
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
      let products = db.products.filter((p) => p.is_active);
      if (best) products = products.filter((p) => p.is_best);
      return { data: products };
    }],
    ['POST', /^\/api\/products$/, (req) => {
      const body = req.body || {};
      if (!body.name || !body.original_price || !body.vip_discount_price) return { status: 400, error: '필수 항목을 입력하세요' };
      const product = {
        id: nextId(db.products),
        name: body.name,
        category: body.category || '기타',
        original_price: Number(body.original_price),
        vip_discount_price: Number(body.vip_discount_price),
        image_url: body.image_url || '',
        description: body.description || '',
        stock_quantity: Number(body.stock_quantity ?? 50),
        is_active: 1,
        is_best: 0,
        brand_id: body.brand_id ? Number(body.brand_id) : 1,
        rating: 0,
        review_count: 0,
        created_at: nowStamp(),
      };
      db.products.push(product);
      save();
      return { data: product };
    }],
    ['PUT', /^\/api\/products\/(\d+)$/, (req, id) => {
      const product = db.products.find((p) => p.id === Number(id));
      if (!product) return { status: 404, error: '상품을 찾을 수 없습니다' };
      const body = req.body || {};
      ['name', 'category', 'image_url', 'description'].forEach((key) => {
        if (body[key] !== undefined) product[key] = body[key];
      });
      ['original_price', 'vip_discount_price', 'stock_quantity', 'is_active', 'is_best', 'brand_id'].forEach((key) => {
        if (body[key] !== undefined && body[key] !== null && body[key] !== '') product[key] = Number(body[key]);
      });
      save();
      return { data: product };
    }],
    ['DELETE', /^\/api\/products\/(\d+)$/, (req, id) => {
      const product = db.products.find((p) => p.id === Number(id));
      if (!product) return { status: 404, error: '상품을 찾을 수 없습니다' };
      product.is_active = 0;
      save();
      return { data: { id: product.id, is_active: 0 } };
    }],
    ['GET', /^\/api\/salons$/, () => ({ data: db.salons.map(publicSalon) })],
    ['POST', /^\/api\/salons$/, (req) => {
      const body = req.body || {};
      if (!body.salon_name || !body.owner_name || !body.owner_phone) return { status: 400, error: '필수 항목을 입력하세요' };
      const salon = {
        id: nextId(db.salons),
        salon_name: body.salon_name,
        logo_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(body.salon_name)}`,
        owner_name: body.owner_name,
        owner_phone: body.owner_phone,
        bank_account: body.bank_account || '',
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
      ['salon_name', 'owner_name', 'owner_phone', 'bank_account'].forEach((key) => {
        if (body[key] !== undefined) salon[key] = body[key];
      });
      save();
      return { data: publicSalon(salon) };
    }],
    ['GET', /^\/api\/salons\/(\d+)\/qr$/, (req, id) => {
      const salon = findSalon(id);
      if (!salon) return { status: 404, error: '살롱을 찾을 수 없습니다' };
      const designers = db.designers
        .filter((d) => d.salon_id === salon.id)
        .map((d) => ({ id: d.id, designer_name: d.designer_name, profile_img: d.profile_img, status: d.status }));
      return { data: { salon: { id: salon.id, salon_name: salon.salon_name, logo_url: salon.logo_url }, designers, qr_url: `/scan?salon=${salon.id}` } };
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
      const name = String(body.designer_name).includes('디자이너') ? body.designer_name : `${body.designer_name} 디자이너`;
      const designer = {
        id: nextId(db.designers),
        salon_id: Number(body.salon_id),
        designer_name: name,
        profile_img: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nextId(db.designers)}`,
        status: 'ACTIVE',
        commission_rate: Number(body.commission_rate || 0.15),
        created_at: nowStamp(),
      };
      db.designers.push(designer);
      save();
      return { data: publicDesigner(designer) };
    }],
    ['POST', /^\/api\/designers\/(\d+)\/resign$/, (req, id) => {
      const designer = findDesigner(id);
      if (!designer) return { status: 404, error: '디자이너를 찾을 수 없습니다' };
      designer.status = 'RESIGNED';
      db.users.forEach((user) => {
        if (user.mapped_designer_id === designer.id) user.mapped_designer_id = null;
      });
      save();
      return { data: publicDesigner(designer), extra: { message: '퇴사 처리되었습니다. 이후 커미션은 살롱 오너에게 귀속됩니다.' } };
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
    ['POST', /^\/api\/users$/, (req) => {
      const body = req.body || {};
      if (!body.name) return { status: 400, error: '이름을 입력해주세요' };
      const user = {
        id: nextId(db.users),
        kakao_id: body.kakao_id || `kakao_${Date.now()}`,
        name: body.name,
        phone: body.phone || '',
        current_salon_id: null,
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
    ['POST', /^\/api\/users\/(\d+)\/scan-qr$/, (req, id) => {
      const user = db.users.find((u) => u.id === Number(id));
      if (!user) return { status: 404, error: '고객을 찾을 수 없습니다' };
      const salonId = Number(req.body.salon_id);
      const designerId = req.body.designer_id ? Number(req.body.designer_id) : null;
      const salon = findSalon(salonId);
      if (!salon) return { status: 404, error: '살롱을 찾을 수 없습니다' };
      if (user.current_salon_id && user.current_salon_id !== salon.id) {
        const from = findSalon(user.current_salon_id);
        return {
          data: null,
          extra: {
            requires_confirmation: true,
            switch_info: {
              from_salon: from ? from.salon_name : '',
              to_salon: salon.salon_name,
              to_salon_id: salon.id,
              designer_id: designerId,
            },
          },
        };
      }
      const result = assignSalon(user, salon.id, designerId);
      if (result.error) return { status: 400, error: result.error };
      return { data: result.user, extra: { message: `${salon.salon_name} 살롱으로 등록되었습니다` } };
    }],
    ['POST', /^\/api\/users\/(\d+)\/confirm-switch$/, (req, id) => {
      const user = db.users.find((u) => u.id === Number(id));
      if (!user) return { status: 404, error: '고객을 찾을 수 없습니다' };
      const result = assignSalon(user, req.body.to_salon_id, req.body.designer_id);
      if (result.error) return { status: 400, error: result.error };
      return { data: result.user, extra: { message: '메인 살롱이 변경되었습니다' } };
    }],
    ['GET', /^\/api\/brands$/, () => ({ data: db.brands })],
    ['POST', /^\/api\/brands$/, (req) => {
      const body = req.body || {};
      if (!body.name) return { status: 400, error: '브랜드명을 입력하세요' };
      const brand = { id: nextId(db.brands), name: body.name, commission_rate: Number(body.commission_rate ?? 0.1), status: 'ACTIVE', created_at: nowStamp() };
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
        apply_scope: body.apply_scope === 'BRAND' || body.brand_id ? 'BRAND' : 'ALL',
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
      coupon.apply_scope = coupon.brand_id ? 'BRAND' : 'ALL';
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
      const salon = findSalon(body.salon_id);
      if (!user || !salon) return { status: 400, error: '고객 또는 살롱 정보가 없습니다' };
      if (!user.current_salon_id) return { status: 400, error: '먼저 살롱을 등록해주세요' };
      const items = [];
      for (const item of body.items || []) {
        const product = db.products.find((p) => p.id === Number(item.product_id) && p.is_active);
        if (!product) return { status: 400, error: '상품을 찾을 수 없습니다' };
        const qty = Number(item.qty || 1);
        if (product.stock_quantity < qty) return { status: 400, error: `${product.name} 재고가 부족합니다` };
        items.push({ product_id: product.id, name: product.name, qty, price: product.vip_discount_price });
      }
      if (!items.length) return { status: 400, error: '주문 상품이 없습니다' };
      const designer = db.designers.find((d) => d.id === Number(body.designer_id) && d.salon_id === salon.id && d.status === 'ACTIVE');
      const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const split = splitAmount(total, Boolean(designer));
      items.forEach((item) => {
        const product = db.products.find((p) => p.id === item.product_id);
        product.stock_quantity -= item.qty;
      });
      const order = {
        id: nextId(db.orders),
        user_id: user.id,
        salon_id: salon.id,
        designer_id: designer ? designer.id : null,
        total_amount: total,
        platform_amount: split.platform,
        salon_commission_amount: split.salon,
        designer_commission_amount: split.designer,
        payment_status: 'PAID',
        shipping_status: 'READY',
        order_items: JSON.stringify(items),
        created_at: nowStamp(),
      };
      db.orders.push(order);
      save();
      return { data: publicOrder(order), extra: { message: '주문이 완료되었습니다' } };
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
    db.brands = db.brands && db.brands.length ? db.brands : (seed.brands || []);
    db.coupons = db.coupons || seed.coupons || [];
    db.point_grants = db.point_grants || seed.point_grants || [];
    db.banners = db.banners || seed.banners || [];
    db.settlement_overrides = db.settlement_overrides || [];
    db.point_blocked_ids = db.point_blocked_ids || [];
    (db.coupons || []).forEach((coupon) => {
      if (coupon.min_order_amount == null) coupon.min_order_amount = 0;
      if (!coupon.issue_target) coupon.issue_target = 'ALL';
      if (coupon.issued_count == null) coupon.issued_count = 0;
      if (coupon.used_count == null) coupon.used_count = 0;
    });
    db.products.forEach((product) => { if (!product.brand_id) product.brand_id = 1; });
    db.orders.forEach((order) => { if (!order.shipping_status) order.shipping_status = 'READY'; });
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
