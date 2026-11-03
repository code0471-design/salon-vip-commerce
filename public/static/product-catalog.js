(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProductCatalog = api;
})(typeof window !== 'undefined' ? window : global, function () {
  const CATEGORY_TREE = {
    '염모제': ['염모제', '산화제', '매니큐어·코팅', '헤나·천연염모제', '탈색약'],
    '펌제': ['일반펌', '매직·스트레이트', '다운펌·볼륨', '열펌·아이롱펌', '중화제'],
    '헤어케어': ['샴푸', '트리트먼트', '컨디셔너', '클리닉', '두피·스칼프'],
    '스타일링': ['에센스·오일', '오일&세럼', '왁스·젤·스프레이', '로션·크림'],
    '기구': ['드라이기', '아이롱·매직기', '클리퍼·바리깡', '가위·레자기', '살롱기기'],
    '소품': ['브러시·빗', '펌 소품(롯드·클립)', '염색 소품(볼·브러시)', '분무기·용기', '살롱 소품'],
    '위생·의류': ['가운·유니폼', '앞치마·커트보', '위생용품'],
    '기타': ['기타', '교재·도서', '마네킹·교육용'],
  };

  const LEGACY_CATEGORY = {
    '샴푸': ['헤어케어', '샴푸'],
    '트리트먼트': ['헤어케어', '트리트먼트'],
    '컨디셔너': ['헤어케어', '컨디셔너'],
    '오일&세럼': ['스타일링', '오일&세럼'],
    '스타일링': ['스타일링', ''],
  };

  const UNLIMITED_STOCK = 9999;

  function locateCategory(product) {
    if (product.category_main) return { main: product.category_main, sub: product.category_sub || '' };
    const legacy = LEGACY_CATEGORY[product.category];
    if (legacy) return { main: legacy[0], sub: legacy[1] };
    const entries = Object.keys(CATEGORY_TREE);
    for (let i = 0; i < entries.length; i += 1) {
      const main = entries[i];
      if (CATEGORY_TREE[main].indexOf(product.category) >= 0) return { main: main, sub: product.category };
      if (main === product.category) return { main: main, sub: '' };
    }
    return { main: '', sub: '' };
  }

  function computeSellingPrice(normalPrice, source, rate, amount) {
    const normal = Number(normalPrice) || 0;
    const rateNum = Number(rate) || 0;
    const amountNum = Number(amount) || 0;
    if (source === 'RATE' && rateNum > 0) return Math.max(0, Math.round((normal * (100 - rateNum)) / 100));
    if (source === 'AMOUNT' && amountNum > 0) return Math.max(0, normal - amountNum);
    if (rateNum > 0) return Math.max(0, Math.round((normal * (100 - rateNum)) / 100));
    if (amountNum > 0) return Math.max(0, normal - amountNum);
    return normal;
  }

  function inferDiscount(original, selling) {
    const normal = Number(original) || 0;
    const price = Number(selling);
    if (!normal || Number.isNaN(price) || price >= normal) return { type: 'NONE', value: 0 };
    const rate = Math.round((1 - price / normal) * 1000) / 10;
    const fromRate = Math.max(0, Math.round((normal * (100 - rate)) / 100));
    if (fromRate === price) return { type: 'RATE', value: rate };
    return { type: 'AMOUNT', value: normal - price };
  }

  function fillProductDefaults(product) {
    if (!product.brand_id) product.brand_id = 1;
    if (!Array.isArray(product.options)) product.options = [];
    if (product.supply_price == null) product.supply_price = 0;
    if (product.min_order_quantity == null) product.min_order_quantity = 1;
    if (product.purchase_unit == null) product.purchase_unit = 1;
    if (product.max_purchase_quantity === undefined) product.max_purchase_quantity = null;
    if (product.earn_points_rate == null) product.earn_points_rate = 0;
    if (product.point_use_disabled == null) product.point_use_disabled = 0;
    if (!product.sale_start_at) product.sale_start_at = '';
    if (!product.sale_end_at) product.sale_end_at = '';
    if (!product.category_main) {
      const located = locateCategory(product);
      product.category_main = located.main;
      product.category_sub = located.sub;
    }
    if (!product.discount_type) {
      const discount = inferDiscount(product.original_price, product.vip_discount_price);
      product.discount_type = discount.type;
      product.discount_value = discount.value;
    }
    return product;
  }

  function readProductBody(body) {
    const name = String((body && body.name) || '').trim();
    const brandId = Number(body && body.brand_id);
    const normal = Number(body && body.original_price);
    const selling = Number(body && body.vip_discount_price);
    const supply = Number(body && body.supply_price);
    const main = String((body && body.category_main) || '').trim();
    const sub = String((body && body.category_sub) || '').trim();
    if (!name) return { error: '상품명을 입력하세요' };
    if (!brandId) return { error: '브랜드를 선택하세요' };
    if (!main || !sub) return { error: '카테고리를 선택하세요' };
    if (!supply) return { error: '공급가를 입력하세요' };
    if (!normal) return { error: '정가를 입력하세요' };
    if (!body || body.vip_discount_price === '' || body.vip_discount_price == null || Number.isNaN(selling)) {
      return { error: '판매가를 확인하세요' };
    }
    const stockRaw = body.stock_quantity;
    const stock = stockRaw === '' || stockRaw == null ? UNLIMITED_STOCK : Number(stockRaw);
    const maxRaw = body.max_purchase_quantity;
    const options = (Array.isArray(body.options) ? body.options : [])
      .filter((option) => String(option.name || '').trim())
      .map((option) => {
        const additional = Number(option.additional_selling_price || 0);
        const optionStock = option.stock === '' || option.stock == null ? UNLIMITED_STOCK : Number(option.stock);
        return {
          id: option.id || ('opt-' + Math.random().toString(36).slice(2, 8)),
          name: String(option.name).trim(),
          value: String(option.name).trim(),
          supply_price: Number(option.supply_price != null && option.supply_price !== '' ? option.supply_price : supply),
          additional_selling_price: additional,
          selling_price: Math.max(0, selling + additional),
          stock: optionStock,
          sold_out: !!option.sold_out,
          expected_restock_at: option.sold_out ? (option.expected_restock_at || '') : '',
        };
      });
    return {
      fields: {
        name: name,
        brand_id: brandId,
        category_main: main,
        category_sub: sub,
        category: sub,
        supply_price: supply,
        original_price: normal,
        discount_type: body.discount_type || 'NONE',
        discount_value: Number(body.discount_value || 0),
        vip_discount_price: selling,
        stock_quantity: stock,
        min_order_quantity: Math.max(1, Number(body.min_order_quantity || 1)),
        purchase_unit: Math.max(1, Number(body.purchase_unit || 1)),
        max_purchase_quantity: maxRaw === '' || maxRaw == null ? null : Number(maxRaw),
        earn_points_rate: Math.min(100, Math.max(0, Number(body.earn_points_rate || 0))),
        point_use_disabled: body.point_use_disabled ? 1 : 0,
        sale_start_at: body.sale_period === 'CUSTOM' ? (body.sale_start_at || '') : '',
        sale_end_at: body.sale_period === 'CUSTOM' ? (body.sale_end_at || '') : '',
        image_url: body.image_url || '',
        description: body.description || '',
        options: options,
      },
    };
  }

  function syncPointBlock(db, product) {
    db.point_blocked_ids = db.point_blocked_ids || [];
    if (product.point_use_disabled) {
      if (db.point_blocked_ids.indexOf(product.id) < 0) db.point_blocked_ids.push(product.id);
    } else {
      db.point_blocked_ids = db.point_blocked_ids.filter((item) => item !== product.id);
    }
  }

  return {
    CATEGORY_TREE: CATEGORY_TREE,
    UNLIMITED_STOCK: UNLIMITED_STOCK,
    locateCategory: locateCategory,
    computeSellingPrice: computeSellingPrice,
    inferDiscount: inferDiscount,
    fillProductDefaults: fillProductDefaults,
    readProductBody: readProductBody,
    syncPointBlock: syncPointBlock,
  };
});
