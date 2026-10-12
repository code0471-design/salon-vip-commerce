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
    const totalEarned = db.orders
      .filter((o) => o.designer_id === designer.id && o.payment_status === 'PAID')
      .reduce((sum, o) => sum + (o.designer_commission_amount || 0), 0);
    return {
      ...designer,
      salon_name: salon ? salon.salon_name : '',
      mapped_user_count: db.users.filter((u) => u.mapped_designer_id === designer.id).length,
      total_earned: totalEarned,
    };
  }

  function userOrders(userId) {
    return db.orders
      .filter((o) => o.user_id === Number(userId))
      .sort((a, b) => b.id - a.id)
      .map(publicOrder);
  }

  function splitAmount(total, hasDesigner) {
    const platform = Math.round(total * 0.4);
    const designer = hasDesigner ? Math.round(total * 0.15) : 0;
    const salon = hasDesigner ? Math.round(total * 0.15) : Math.round(total * 0.3);
    return { platform, designer, salon };
  }

  function orderStats() {
    const paid = db.orders.filter((o) => o.payment_status === 'PAID');
    const sum = (key) => paid.reduce((acc, o) => acc + (o[key] || 0), 0);
    const bySalon = new Map();
    for (const order of paid) {
      const salon = findSalon(order.salon_id);
      const row = bySalon.get(order.salon_id) || {
        id: order.salon_id,
        salon_name: salon ? salon.salon_name : '',
        orders: 0,
        revenue: 0,
        commission: 0,
      };
      row.orders += 1;
      row.revenue += order.total_amount || 0;
      row.commission += order.salon_commission_amount || 0;
      bySalon.set(order.salon_id, row);
    }
    return {
      total_orders: db.orders.length,
      paid_orders: paid.length,
      total_gmv: sum('total_amount'),
      platform_revenue: sum('platform_amount'),
      total_salon_commission: sum('salon_commission_amount'),
      total_designer_commission: sum('designer_commission_amount'),
      salonBreakdown: [...bySalon.values()].sort((a, b) => b.revenue - a.revenue),
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
      ['original_price', 'vip_discount_price', 'stock_quantity', 'is_active', 'is_best'].forEach((key) => {
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
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      db = JSON.parse(saved);
      return;
    }
    const res = await fetch(siteRoot() + 'data/seed.json');
    db = await res.json();
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
