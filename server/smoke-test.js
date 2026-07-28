async function req(path, opts = {}) {
  const { headers: extraHeaders, ...rest } = opts;
  const res = await fetch('http://localhost:3001/api' + path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const results = [];
function ok(name, pass, detail) {
  results.push(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  let r;

  r = await req('/health');
  ok('Health', r.status === 200 && r.data.ok, JSON.stringify(r.data));

  r = await req('/categories?activeOnly=true');
  ok('Categories', r.status === 200 && r.data.length === 6, `count=${r.data?.length}`);

  r = await req('/products');
  ok('Products', r.status === 200 && r.data.length >= 30 && r.data[0].category, `count=${r.data.length}`);
  const product = r.data[0];

  r = await req('/banners?activeOnly=true');
  ok('Banners', r.status === 200 && r.data.length === 3, `count=${r.data.length}`);

  r = await req('/delivery-settings?activeOnly=true');
  ok('Delivery', r.status === 200 && r.data.length === 2, `count=${r.data.length}`);

  r = await req('/products/slug/fresh-red-apples');
  ok('Product by slug', r.status === 200 && r.data?.slug === 'fresh-red-apples', r.data?.name);

  // Admin login
  r = await req('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@allinone.shop', password: 'admin123' }),
  });
  ok('Admin login', r.status === 200 && !!r.data.token, r.status === 200 ? 'token ok' : JSON.stringify(r.data));
  const adminToken = r.data?.token;

  r = await req('/auth/me', { headers: { Authorization: 'Bearer ' + adminToken } });
  ok('Admin profile', r.status === 200 && r.data.profile?.app_role === 'admin', r.data.profile?.app_role);

  // Customer signup
  const email = `test_${Date.now()}@example.com`;
  r = await req('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'test1234', full_name: 'Test User', phone: '9876543210' }),
  });
  ok('Customer signup', r.status === 200 && !!r.data.token, email);
  const custToken = r.data?.token;

  r = await req('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'test1234', full_name: 'Test User' }),
  });
  ok('Duplicate signup blocked', r.status === 400, r.data?.error);

  r = await req('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'wrong' }),
  });
  ok('Bad login rejected', r.status === 401, r.data?.error);

  // Empty address should 400, not crash
  r = await req('/addresses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + custToken },
    body: JSON.stringify({}),
  });
  ok('Empty address rejected', r.status === 400, r.data?.error);

  // Health still up after bad request
  r = await req('/health');
  ok('API still alive after error', r.status === 200 && r.data.ok, JSON.stringify(r.data));

  r = await req('/addresses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + custToken },
    body: JSON.stringify({
      label: 'Home',
      full_name: 'Test User',
      phone: '9876543210',
      line1: '123 Main St',
      line2: null,
      city: 'Delhi',
      pincode: '110001',
      is_default: true,
    }),
  });
  ok('Create address', r.status === 200 && !!r.data.id, r.status === 200 ? r.data?.id : JSON.stringify(r.data));
  const addrId = r.data?.id;

  r = await req('/addresses', { headers: { Authorization: 'Bearer ' + custToken } });
  ok('List addresses', r.status === 200 && r.data.length === 1, `count=${r.data?.length}`);

  const orderNumber = 'TEST' + Date.now();
  r = await req('/orders', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + custToken },
    body: JSON.stringify({
      order: {
        order_number: orderNumber,
        status: 'placed',
        subtotal: product.price,
        delivery_charge: 30,
        discount: 0,
        total: product.price + 30,
        payment_mode: 'cod',
        payment_status: 'pay_on_delivery',
        address_snapshot: {
          full_name: 'Test User',
          phone: '9876543210',
          line1: '123 Main St',
          city: 'Delhi',
          pincode: '110001',
        },
        delivery_slot: 'Today, 6 PM – 8 PM',
        notes: null,
      },
      items: [
        {
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url,
          unit: product.unit,
          price: product.price,
          quantity: 1,
          subtotal: product.price,
        },
      ],
    }),
  });
  ok('Place order', r.status === 200 && r.data.order_number === orderNumber, r.status === 200 ? r.data?.order_number : JSON.stringify(r.data));
  const orderId = r.data?.id;

  r = await req('/orders/by-number/' + orderNumber, {
    headers: { Authorization: 'Bearer ' + custToken },
  });
  ok('Get order by number', r.status === 200 && !!r.data?.id && r.data.id === orderId, r.data?.status || JSON.stringify(r.data));

  r = await req('/order-items?orderId=' + orderId, {
    headers: { Authorization: 'Bearer ' + custToken },
  });
  ok('Order items', r.status === 200 && Array.isArray(r.data) && r.data.length === 1, `count=${r.data?.length}`);

  r = await req('/orders', { headers: { Authorization: 'Bearer ' + custToken } });
  ok('Customer orders', r.status === 200 && r.data.length >= 1, `count=${r.data?.length}`);

  r = await req('/orders', { headers: { Authorization: 'Bearer ' + adminToken } });
  ok('Admin see all orders', r.status === 200 && r.data.length >= 1, `count=${r.data?.length}`);

  r = await req('/orders/' + orderId, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + adminToken },
    body: JSON.stringify({ status: 'packed' }),
  });
  ok('Admin update status', r.status === 200 && r.data.status === 'packed', r.status === 200 ? r.data?.status : JSON.stringify(r.data));

  r = await req('/customers', { headers: { Authorization: 'Bearer ' + adminToken } });
  ok('Admin customers', r.status === 200 && r.data.length >= 1, `count=${r.data?.length}`);

  r = await req('/products/' + product.id, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + adminToken },
    body: JSON.stringify({ is_featured: true }),
  });
  ok('Admin update product', r.status === 200 && r.data.is_featured === true, `featured=${r.data?.is_featured}`);

  r = await req('/customers', { headers: { Authorization: 'Bearer ' + custToken } });
  ok('Customer blocked from admin', r.status === 403, r.data?.error);

  r = await req('/profiles/me', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + custToken },
    body: JSON.stringify({ full_name: 'Updated Name', phone: '1111111111' }),
  });
  ok('Update profile', r.status === 200 && r.data.full_name === 'Updated Name', r.status === 200 ? r.data?.full_name : JSON.stringify(r.data));

  r = await req('/addresses/' + addrId, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + custToken },
  });
  ok('Delete address', r.status === 200, JSON.stringify(r.data));

  // Vite proxy
  const proxy = await fetch('http://localhost:5173/api/health');
  const proxyData = await proxy.json();
  ok('Vite proxy to API', proxy.ok && proxyData.ok, JSON.stringify(proxyData));

  const home = await fetch('http://localhost:5173/');
  ok('Frontend homepage', home.ok, `status=${home.status}`);

  console.log(results.join('\n'));
  const fails = results.filter((x) => x.startsWith('FAIL'));
  console.log(`\n--- ${results.length - fails.length}/${results.length} passed ---`);
  if (fails.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
