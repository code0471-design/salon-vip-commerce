(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProductCatalog = api;
})(typeof window !== 'undefined' ? window : global, function () {
  const CATEGORIES = ['샴푸', '컨디셔너', '트리트먼트', '오일/세럼', '스프레이', '컬크림', '왁스/젤'];

  const CATEGORY_ALIAS = {
    '오일&세럼': '오일/세럼',
    '오일·세럼': '오일/세럼',
    '에센스·오일': '오일/세럼',
    '왁스·젤·스프레이': '왁스/젤',
    '로션·크림': '컬크림',
  };

  const UNLIMITED_STOCK = 9999;

  function canonicalCategory(value) {
    const raw = String(value || '').trim();
    if (CATEGORIES.indexOf(raw) >= 0) return raw;
    if (CATEGORY_ALIAS[raw]) return CATEGORY_ALIAS[raw];
    return raw;
  }

  function normalizeCategory(product) {
    const raw = canonicalCategory(product && (product.category_sub || product.category));
    if (CATEGORIES.indexOf(raw) >= 0) return raw;
    const name = String((product && product.name) || '');
    if (name.indexOf('왁스') >= 0 || name.indexOf('젤') >= 0) return '왁스/젤';
    if (name.indexOf('크림') >= 0) return '컬크림';
    if (name.indexOf('스프레이') >= 0 || name.indexOf('무스') >= 0) return '스프레이';
    if (name.indexOf('오일') >= 0 || name.indexOf('세럼') >= 0) return '오일/세럼';
    if (name.indexOf('트리트') >= 0) return '트리트먼트';
    if (name.indexOf('컨디셔너') >= 0) return '컨디셔너';
    if (name.indexOf('샴푸') >= 0) return '샴푸';
    return raw;
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
    if (product.salon_price == null || product.salon_price === '') {
      product.salon_price = Math.round((Number(product.vip_discount_price) || 0) * 0.7);
    }
    if (product.min_order_quantity == null) product.min_order_quantity = 1;
    if (product.purchase_unit == null) product.purchase_unit = 1;
    if (product.max_purchase_quantity === undefined) product.max_purchase_quantity = null;
    if (product.earn_points_rate == null) product.earn_points_rate = 0;
    if (product.point_use_disabled == null) product.point_use_disabled = 0;
    if (!product.sale_start_at) product.sale_start_at = '';
    if (!product.sale_end_at) product.sale_end_at = '';
    if (!Array.isArray(product.detail_image_urls)) product.detail_image_urls = [];
    product.category = normalizeCategory(product);
    product.category_main = '';
    product.category_sub = '';
    if (!product.discount_type) {
      const discount = inferDiscount(product.original_price, product.vip_discount_price);
      product.discount_type = discount.type;
      product.discount_value = discount.value;
    }
    if (!product.product_number && product.id) product.product_number = String(100000 + Number(product.id));
    if (product.deleted_at == null) product.deleted_at = '';
    if (!product.sale_status) {
      product.sale_status = !product.is_active ? 'STOP' : (Number(product.stock_quantity) === 0 ? 'SOLDOUT' : 'SELLING');
    }
    return product;
  }

  function readProductBody(body) {
    const name = String((body && body.name) || '').trim();
    const brandId = Number(body && body.brand_id);
    const normal = Number(body && body.original_price);
    const selling = Number(body && body.vip_discount_price);
    const supply = Number(body && body.supply_price);
    const salon = Number(body && body.salon_price);
    const category = canonicalCategory(body && body.category);
    const statuses = ['WAITING', 'SELLING', 'SOLDOUT', 'STOP'];
    const saleStatus = statuses.indexOf(body && body.sale_status) >= 0 ? body.sale_status : 'SELLING';
    if (!name) return { error: '상품명을 입력하세요' };
    if (!brandId) return { error: '브랜드를 선택하세요' };
    if (!category || CATEGORIES.indexOf(category) < 0) return { error: '카테고리를 선택하세요' };
    if (body.supply_price === '' || body.supply_price == null || Number.isNaN(supply)) return { error: '공급가를 입력하세요' };
    if (body.salon_price === '' || body.salon_price == null || Number.isNaN(salon)) return { error: '살롱가를 입력하세요' };
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
        category_main: '',
        category_sub: '',
        category: category,
        supply_price: supply,
        salon_price: salon,
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
        detail_image_urls: (Array.isArray(body.detail_image_urls) ? body.detail_image_urls : []).filter(Boolean).slice(0, 8),
        description: body.description || '',
        options: options,
        sale_status: saleStatus,
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
    CATEGORIES: CATEGORIES,
    UNLIMITED_STOCK: UNLIMITED_STOCK,
    canonicalCategory: canonicalCategory,
    normalizeCategory: normalizeCategory,
    computeSellingPrice: computeSellingPrice,
    inferDiscount: inferDiscount,
    fillProductDefaults: fillProductDefaults,
    readProductBody: readProductBody,
    syncPointBlock: syncPointBlock,
  };
});
