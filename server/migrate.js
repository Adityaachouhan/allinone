import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  sequelize,
  connectDb,
  User,
  Profile,
  Category,
  Product,
  Banner,
  DeliverySetting,
} from './models/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('Connecting to PostgreSQL via Sequelize...');
  await connectDb();

  // Apply raw SQL for extensions, indexes, and triggers that Sequelize sync doesn't cover.
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await sequelize.query(schema);
  console.log('Schema applied.');

  // Ensure models match existing tables (safe — no force/drop).
  await sequelize.sync();
  console.log('Sequelize models synced.');

  const categoryCount = await Category.count();
  if (categoryCount === 0) {
    console.log('Seeding data...');
    await seedData();
    console.log('Seed data inserted.');
  } else {
    console.log('Data already seeded, skipping.');
  }

  console.log('Migration complete.');
  await sequelize.close();
}

async function seedData() {
  await Category.bulkCreate([
    { name: 'Fruits & Vegetables', slug: 'fruits-vegetables', icon_name: 'Apple', sort_order: 1 },
    { name: 'Dairy & Bakery', slug: 'dairy-bakery', icon_name: 'Milk', sort_order: 2 },
    { name: 'Grains & Staples', slug: 'grains-staples', icon_name: 'Wheat', sort_order: 3 },
    { name: 'Snacks & Beverages', slug: 'snacks-beverages', icon_name: 'Cookie', sort_order: 4 },
    { name: 'Personal Care', slug: 'personal-care', icon_name: 'Spa', sort_order: 5 },
    { name: 'Household Items', slug: 'household-items', icon_name: 'Home', sort_order: 6 },
  ], { ignoreDuplicates: true });

  const categories = await Category.findAll();
  const cat = Object.fromEntries(categories.map((r) => [r.slug, r.id]));
  const fv = cat['fruits-vegetables'];
  const db = cat['dairy-bakery'];
  const gs = cat['grains-staples'];
  const sb = cat['snacks-beverages'];
  const pc = cat['personal-care'];
  const hh = cat['household-items'];

  await Product.bulkCreate([
    { category_id: fv, name: 'Fresh Red Apples', slug: 'fresh-red-apples', description: 'Crisp sweet red apples.', price: 180, mrp: 220, unit: 'kg', stock_quantity: 40, brand: 'Farm Fresh', image_url: 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.5 },
    { category_id: fv, name: 'Bananas', slug: 'bananas', description: 'Ripe yellow bananas.', price: 50, mrp: 60, unit: 'dozen', stock_quantity: 60, brand: 'Farm Fresh', image_url: 'https://images.pexels.com/photos/2872755/pexels-photo-2872755.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.2 },
    { category_id: fv, name: 'Tomatoes', slug: 'tomatoes', description: 'Farm-fresh tomatoes.', price: 40, mrp: 55, unit: 'kg', stock_quantity: 35, brand: 'Local Farm', image_url: 'https://images.pexels.com/photos/533280/pexels-photo-533280.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.0 },
    { category_id: fv, name: 'Onions', slug: 'onions', description: 'Fresh onions.', price: 35, mrp: 45, unit: 'kg', stock_quantity: 80, brand: 'Local Farm', image_url: 'https://images.pexels.com/photos/1306554/pexels-photo-1306554.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.1 },
    { category_id: fv, name: 'Green Capsicum', slug: 'green-capsicum', description: 'Crunchy bell peppers.', price: 60, mrp: 80, unit: 'kg', stock_quantity: 25, brand: 'Farm Fresh', image_url: 'https://images.pexels.com/photos/1596077/pexels-photo-1596077.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.3 },
    { category_id: fv, name: 'Carrots', slug: 'carrots', description: 'Fresh carrots.', price: 45, mrp: 60, unit: 'kg', stock_quantity: 30, brand: 'Local Farm', image_url: 'https://images.pexels.com/photos/143133/pexels-photo-143133.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.2 },
    { category_id: db, name: 'Amul Full Cream Milk', slug: 'amul-full-cream-milk', description: 'Full cream milk 1L.', price: 68, mrp: 72, unit: 'litre', stock_quantity: 50, brand: 'Amul', image_url: 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.6 },
    { category_id: db, name: 'Brown Bread', slug: 'brown-bread', description: 'Whole wheat bread.', price: 45, mrp: 50, unit: 'pack', stock_quantity: 20, brand: 'Modern Bakery', image_url: 'https://images.pexels.com/photos/209206/pexels-photo-209206.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.4 },
    { category_id: db, name: 'Paneer', slug: 'paneer', description: 'Fresh paneer 200g.', price: 90, mrp: 110, unit: 'pack', stock_quantity: 15, brand: 'Amul', image_url: 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.5 },
    { category_id: db, name: 'Butter', slug: 'butter', description: 'Salted butter 100g.', price: 52, mrp: 55, unit: 'pack', stock_quantity: 18, brand: 'Amul', image_url: 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.3 },
    { category_id: db, name: 'Eggs', slug: 'eggs', description: 'Farm eggs pack of 6.', price: 60, mrp: 72, unit: 'pack', stock_quantity: 40, brand: 'Farm Fresh', image_url: 'https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.5 },
    { category_id: gs, name: 'Basmati Rice', slug: 'basmati-rice', description: 'Premium basmati 1kg.', price: 120, mrp: 150, unit: 'kg', stock_quantity: 50, brand: 'India Gate', image_url: 'https://images.pexels.com/photos/743251/pexels-photo-743251.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.7 },
    { category_id: gs, name: 'Toor Dal', slug: 'toor-dal', description: 'Yellow split peas 1kg.', price: 130, mrp: 160, unit: 'kg', stock_quantity: 45, brand: 'Tata Sampann', image_url: 'https://images.pexels.com/photos/1393382/pexels-photo-1393382.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.3 },
    { category_id: gs, name: 'Wheat Flour', slug: 'wheat-flour', description: 'Whole wheat atta 2kg.', price: 85, mrp: 95, unit: 'pack', stock_quantity: 60, brand: 'Aashirvaad', image_url: 'https://images.pexels.com/photos/743251/pexels-photo-743251.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.4 },
    { category_id: gs, name: 'Sunflower Oil', slug: 'sunflower-oil', description: 'Cooking oil 1L.', price: 165, mrp: 190, unit: 'litre', stock_quantity: 30, brand: 'Fortune', image_url: 'https://images.pexels.com/photos/33783/olive-oil-salad-dressing-cooking-olive.jpg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.2 },
    { category_id: gs, name: 'Sugar', slug: 'sugar', description: 'White sugar 1kg.', price: 48, mrp: 52, unit: 'kg', stock_quantity: 70, brand: 'Madhur', image_url: 'https://images.pexels.com/photos/2664216/pexels-photo-2664216.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.0 },
    { category_id: sb, name: 'Lays Classic Salted', slug: 'lays-classic-salted', description: 'Potato chips 52g.', price: 20, mrp: 25, unit: 'pack', stock_quantity: 100, brand: 'Lays', image_url: 'https://images.pexels.com/photos/7874593/pexels-photo-7874593.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.4 },
    { category_id: sb, name: 'Coca-Cola', slug: 'coca-cola', description: 'Cola 750ml.', price: 40, mrp: 45, unit: 'pack', stock_quantity: 80, brand: 'Coca-Cola', image_url: 'https://images.pexels.com/photos/2983100/pexels-photo-2983100.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.3 },
    { category_id: sb, name: 'Dark Chocolate', slug: 'dark-chocolate', description: 'Dark chocolate 80g.', price: 120, mrp: 150, unit: 'pack', stock_quantity: 25, brand: 'Amul', image_url: 'https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.6 },
    { category_id: sb, name: 'Green Tea', slug: 'green-tea', description: 'Green tea 25 bags.', price: 140, mrp: 180, unit: 'pack', stock_quantity: 35, brand: 'Lipton', image_url: 'https://images.pexels.com/photos/1417945/pexels-photo-1417945.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.2 },
    { category_id: sb, name: 'Mixed Nuts', slug: 'mixed-nuts', description: 'Roasted nuts 200g.', price: 220, mrp: 260, unit: 'pack', stock_quantity: 20, brand: 'Act II', image_url: 'https://images.pexels.com/photos/1295572/pexels-photo-1295572.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.5 },
    { category_id: pc, name: 'Shampoo', slug: 'shampoo', description: 'Anti-dandruff 340ml.', price: 175, mrp: 220, unit: 'pack', stock_quantity: 40, brand: 'Head & Shoulders', image_url: 'https://images.pexels.com/photos/3997383/pexels-photo-3997383.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.3 },
    { category_id: pc, name: 'Toothpaste', slug: 'toothpaste', description: 'Mint toothpaste 150g.', price: 95, mrp: 110, unit: 'pack', stock_quantity: 60, brand: 'Colgate', image_url: 'https://images.pexels.com/photos/33832/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.4 },
    { category_id: pc, name: 'Bathing Soap', slug: 'bathing-soap', description: 'Bathing soap pack of 3.', price: 105, mrp: 120, unit: 'pack', stock_quantity: 50, brand: 'Dove', image_url: 'https://images.pexels.com/photos/4202325/pexels-photo-4202325.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.5 },
    { category_id: pc, name: 'Hand Wash', slug: 'hand-wash', description: 'Hand wash 200ml.', price: 110, mrp: 130, unit: 'pack', stock_quantity: 30, brand: 'Dettol', image_url: 'https://images.pexels.com/photos/3997383/pexels-photo-3997383.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.2 },
    { category_id: hh, name: 'Dishwash Gel', slug: 'dishwash-gel', description: 'Dishwash gel 750ml.', price: 85, mrp: 105, unit: 'pack', stock_quantity: 45, brand: 'Vim', image_url: 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.3 },
    { category_id: hh, name: 'Laundry Detergent', slug: 'laundry-detergent', description: 'Detergent 2kg.', price: 245, mrp: 300, unit: 'pack', stock_quantity: 35, brand: 'Surf Excel', image_url: 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: true, is_out_of_stock: false, rating: 4.4 },
    { category_id: hh, name: 'Toilet Cleaner', slug: 'toilet-cleaner', description: 'Toilet cleaner 500ml.', price: 75, mrp: 90, unit: 'pack', stock_quantity: 28, brand: 'Harpic', image_url: 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.1 },
    { category_id: hh, name: 'Garbage Bags', slug: 'garbage-bags', description: 'Garbage bags 30 pack.', price: 120, mrp: 150, unit: 'pack', stock_quantity: 0, brand: 'Glad', image_url: 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: true, rating: 3.9 },
    { category_id: hh, name: 'Floor Cleaner', slug: 'floor-cleaner', description: 'Floor cleaner 1L.', price: 95, mrp: 115, unit: 'pack', stock_quantity: 22, brand: 'Lizol', image_url: 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', is_featured: false, is_out_of_stock: false, rating: 4.2 },
  ]);

  await Banner.bulkCreate([
    { title: 'Fresh Fruits & Veggies', subtitle: 'Farm-fresh produce delivered to your door.', image_url: 'https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb&w=1200', cta_label: 'Shop Fresh', cta_link: '/category/fruits-vegetables', sort_order: 1 },
    { title: 'Stock Up Your Pantry', subtitle: 'Grains, oils & staples at the best prices.', image_url: 'https://images.pexels.com/photos/4198015/pexels-photo-4198015.jpeg?auto=compress&cs=tinysrgb&w=1200', cta_label: 'Shop Staples', cta_link: '/category/grains-staples', sort_order: 2 },
    { title: 'Snack Time Favourites', subtitle: 'Chips, chocolates & beverages.', image_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200', cta_label: 'Shop Snacks', cta_link: '/category/snacks-beverages', sort_order: 3 },
  ]);

  await DeliverySetting.bulkCreate([
    { pincode: '110001', area_name: 'Central Delhi', delivery_charge: 30, min_order_for_free_delivery: 499 },
    { pincode: '110002', area_name: 'Karol Bagh', delivery_charge: 40, min_order_for_free_delivery: 499 },
  ]);

  const adminEmail = 'admin@allinone.shop';
  const existing = await User.findOne({ where: { email: adminEmail } });
  if (!existing) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const admin = await User.create({ email: adminEmail, password_hash: adminHash });
    await Profile.create({
      id: admin.id,
      full_name: 'Store Admin',
      phone: '9999999999',
      email: adminEmail,
      app_role: 'admin',
    });
    console.log('Admin user created: admin@allinone.shop / admin123');
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
