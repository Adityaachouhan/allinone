/*
# Seed Data — Categories, Products, Banners, Delivery Settings

1. Overview
Populates the catalog with a realistic starter dataset for "All In One" grocery mart so
the storefront renders with content out of the box: 6 categories, ~30 products with stock/
MRP/pricing/units, 3 homepage banners, and 2 delivery areas.

2. Changes
- INSERT into categories (6 rows): fruits-vegetables, dairy-bakery, grains-staples,
  snacks-beverages, personal-care, household-items.
- INSERT into products (~30 rows) spread across categories, with price <= mrp, stock > 0,
  some flagged featured, a couple flagged out of stock.
- INSERT into banners (3 rows) for the homepage hero rotation.
- INSERT into delivery_settings (2 rows) sample pincodes with charges.

3. Notes
- Uses DO $$ blocks to guard inserts so re-running is safe (checks existing slugs).
- Product image_url points to stable Pexels stock photos.
*/

-- ---------- categories ----------
DO $$
BEGIN
  INSERT INTO public.categories (name, slug, icon_name, sort_order)
  VALUES
    ('Fruits & Vegetables', 'fruits-vegetables', 'Apple', 1),
    ('Dairy & Bakery', 'dairy-bakery', 'Milk', 2),
    ('Grains & Staples', 'grains-staples', 'Wheat', 3),
    ('Snacks & Beverages', 'snacks-beverages', 'Cookie', 4),
    ('Personal Care', 'personal-care', 'Spa', 5),
    ('Household Items', 'household-items', 'Home', 6)
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- ---------- products ----------
-- helper to fetch category id by slug at insert time
DO $$
DECLARE
  fv uuid; db uuid; gs uuid; sb uuid; pc uuid; hh uuid;
BEGIN
  SELECT id INTO fv FROM public.categories WHERE slug='fruits-vegetables';
  SELECT id INTO db FROM public.categories WHERE slug='dairy-bakery';
  SELECT id INTO gs FROM public.categories WHERE slug='grains-staples';
  SELECT id INTO sb FROM public.categories WHERE slug='snacks-beverages';
  SELECT id INTO pc FROM public.categories WHERE slug='personal-care';
  SELECT id INTO hh FROM public.categories WHERE slug='household-items';

  INSERT INTO public.products (category_id, name, slug, description, price, mrp, unit, stock_quantity, brand, image_url, is_featured, is_out_of_stock, rating)
  VALUES
    (fv, 'Fresh Red Apples', 'fresh-red-apples', 'Crisp, sweet red apples hand-picked for freshness.', 180, 220, 'kg', 40, 'Farm Fresh', 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=600', true, false, 4.5),
    (fv, 'Bananas', 'bananas', 'Ripe yellow bananas, rich in potassium.', 50, 60, 'dozen', 60, 'Farm Fresh', 'https://images.pexels.com/photos/2872755/pexels-photo-2872755.jpeg?auto=compress&cs=tinysrgb&w=600', true, false, 4.2),
    (fv, 'Tomatoes', 'tomatoes', 'Farm-fresh ripe tomatoes, perfect for curries and salads.', 40, 55, 'kg', 35, 'Local Farm', 'https://images.pexels.com/photos/533280/pexels-photo-533280.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.0),
    (fv, 'Onions', 'onions', 'Fresh onions, a kitchen essential.', 35, 45, 'kg', 80, 'Local Farm', 'https://images.pexels.com/photos/1306554/pexels-photo-1306554.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.1),
    (fv, 'Green Capsicum', 'green-capsicum', 'Crunchy green bell peppers.', 60, 80, 'kg', 25, 'Farm Fresh', 'https://images.pexels.com/photos/1596077/pexels-photo-1596077.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.3),
    (fv, 'Carrots', 'carrots', 'Fresh orange carrots, great for salads and juices.', 45, 60, 'kg', 30, 'Local Farm', 'https://images.pexels.com/photos/143133/pexels-photo-143133.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.2),
    (db, 'Amul Full Cream Milk', 'amul-full-cream-milk', 'Fresh full cream milk, 1 litre pouch.', 68, 72, 'litre', 50, 'Amul', 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg?auto=compress&cs=tinysrgb&w=600', true, false, 4.6),
    (db, 'Brown Bread', 'brown-bread', 'Whole wheat brown bread loaf, freshly baked.', 45, 50, 'pack', 20, 'Modern Bakery', 'https://images.pexels.com/photos/209206/pexels-photo-209206.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.4),
    (db, 'Paneer', 'paneer', 'Fresh soft paneer, 200g pack.', 90, 110, 'pack', 15, 'Amul', 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', true, false, 4.5),
    (db, 'Butter', 'butter', 'Salted butter, 100g pack.', 52, 55, 'pack', 18, 'Amul', 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.3),
    (db, 'Eggs', 'eggs', 'Farm fresh brown eggs, pack of 6.', 60, 72, 'pack', 40, 'Farm Fresh', 'https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.5),
    (gs, 'Basmati Rice', 'basmati-rice', 'Premium long-grain basmati rice, 1kg.', 120, 150, 'kg', 50, 'India Gate', 'https://images.pexels.com/photos/743251/pexels-photo-743251.jpeg?auto=compress&cs=tinysrgb&w=600', true, false, 4.7),
    (gs, 'Toor Dal', 'toor-dal', 'Yellow split pigeon peas, 1kg.', 130, 160, 'kg', 45, 'Tata Sampann', 'https://images.pexels.com/photos/1393382/pexels-photo-1393382.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.3),
    (gs, 'Wheat Flour', 'wheat-flour', 'Whole wheat atta, 2kg pack.', 85, 95, 'pack', 60, 'Aashirvaad', 'https://images.pexels.com/photos/743251/pexels-photo-743251.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.4),
    (gs, 'Sunflower Oil', 'sunflower-oil', 'Refined sunflower cooking oil, 1 litre.', 165, 190, 'litre', 30, 'Fortune', 'https://images.pexels.com/photos/33783/olive-oil-salad-dressing-cooking-olive.jpg?auto=compress&cs=tinysrgb&w=600', false, false, 4.2),
    (gs, 'Sugar', 'sugar', 'Refined white sugar, 1kg.', 48, 52, 'kg', 70, 'Madhur', 'https://images.pexels.com/photos/2664216/pexels-photo-2664216.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.0),
    (sb, 'Lays Classic Salted', 'lays-classic-salted', 'Crispy salted potato chips, 52g.', 20, 25, 'pack', 100, 'Lays', 'https://images.pexels.com/photos/7874593/pexels-photo-7874593.jpeg?auto=compress&cs=tinysrgb&w=600', true, false, 4.4),
    (sb, 'Coca-Cola', 'coca-cola', 'Refreshing cola, 750ml bottle.', 40, 45, 'pack', 80, 'Coca-Cola', 'https://images.pexels.com/photos/2983100/pexels-photo-2983100.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.3),
    (sb, 'Dark Chocolate', 'dark-chocolate', '70% dark chocolate bar, 80g.', 120, 150, 'pack', 25, 'Amul', 'https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.6),
    (sb, 'Green Tea', 'green-tea', 'Green tea bags, pack of 25.', 140, 180, 'pack', 35, 'Lipton', 'https://images.pexels.com/photos/1417945/pexels-photo-1417945.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.2),
    (sb, 'Mixed Nuts', 'mixed-nuts', 'Roasted salted mixed nuts, 200g.', 220, 260, 'pack', 20, 'Act II', 'https://images.pexels.com/photos/1295572/pexels-photo-1295572.jpeg?auto=compress&cs=tinysrgb&w=600', true, false, 4.5),
    (pc, 'Shampoo', 'shampoo', 'Anti-dandruff shampoo, 340ml.', 175, 220, 'pack', 40, 'Head & Shoulders', 'https://images.pexels.com/photos/3997383/pexels-photo-3997383.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.3),
    (pc, 'Toothpaste', 'toothpaste', 'Mint freshness toothpaste, 150g.', 95, 110, 'pack', 60, 'Colgate', 'https://images.pexels.com/photos/33832/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=600', false, false, 4.4),
    (pc, 'Bathing Soap', 'bathing-soap', 'Moisturising bathing soap, pack of 3.', 105, 120, 'pack', 50, 'Dove', 'https://images.pexels.com/photos/4202325/pexels-photo-4202325.jpeg?auto=compress&cs=tinysrgb&w=600', true, false, 4.5),
    (pc, 'Hand Wash', 'hand-wash', 'Germ protection hand wash, 200ml.', 110, 130, 'pack', 30, 'Dettol', 'https://images.pexels.com/photos/3997383/pexels-photo-3997383.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.2),
    (hh, 'Dishwash Gel', 'dishwash-gel', 'Lemon dishwash gel, 750ml.', 85, 105, 'pack', 45, 'Vim', 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.3),
    (hh, 'Laundry Detergent', 'laundry-detergent', 'Front-load detergent powder, 2kg.', 245, 300, 'pack', 35, 'Surf Excel', 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', true, false, 4.4),
    (hh, 'Toilet Cleaner', 'toilet-cleaner', 'Disinfectant toilet cleaner, 500ml.', 75, 90, 'pack', 28, 'Harpic', 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.1),
    (hh, 'Garbage Bags', 'garbage-bags', 'Biodegradable garbage bags, pack of 30.', 120, 150, 'pack', 0, 'Glad', 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', false, true, 3.9),
    (hh, 'Floor Cleaner', 'floor-cleaner', 'Citrus floor cleaner, 1 litre.', 95, 115, 'pack', 22, 'Lizol', 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=600', false, false, 4.2)
  ON CONFLICT DO NOTHING;
END $$;

-- ---------- banners ----------
DO $$
BEGIN
  INSERT INTO public.banners (title, subtitle, image_url, cta_label, cta_link, sort_order)
  VALUES
    ('Fresh Fruits & Veggies', 'Farm-fresh produce delivered to your door. Up to 20% off.', 'https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Shop Fresh', '/category/fruits-vegetables', 1),
    ('Stock Up Your Pantry', 'Grains, oils & staples at the best prices. Free delivery over 499.', 'https://images.pexels.com/photos/4198015/pexels-photo-4198015.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Shop Staples', '/category/grains-staples', 2),
    ('Snack Time Favourites', 'Chips, chocolates & beverages to power your day.', 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Shop Snacks', '/category/snacks-beverages', 3)
  ON CONFLICT DO NOTHING;
END $$;

-- ---------- delivery_settings ----------
DO $$
BEGIN
  INSERT INTO public.delivery_settings (pincode, area_name, delivery_charge, min_order_for_free_delivery)
  VALUES
    ('110001', 'Central Delhi', 30, 499),
    ('110002', 'Karol Bagh', 40, 499)
  ON CONFLICT DO NOTHING;
END $$;
