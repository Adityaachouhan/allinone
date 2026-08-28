import 'dotenv/config';
import { Sequelize, DataTypes } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'allinone',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      freezeTableName: true,
      timestamps: false,
    },
  },
);

export const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.TEXT, allowNull: false, unique: true },
    password_hash: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'users' },
);

export const Profile = sequelize.define(
  'Profile',
  {
    id: { type: DataTypes.UUID, primaryKey: true },
    full_name: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    phone: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    email: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    app_role: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'customer' },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'profiles' },
);

export const Category = sequelize.define(
  'Category',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    slug: { type: DataTypes.TEXT, allowNull: false, unique: true },
    icon_name: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'ShoppingBag' },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'categories' },
);

export const Product = sequelize.define(
  'Product',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    category_id: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    slug: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    mrp: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    unit: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'piece' },
    stock_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    brand: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    image_url: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_out_of_stock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    rating: { type: DataTypes.DECIMAL(2, 1), allowNull: false, defaultValue: 4.0 },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'products' },
);

export const Address = sequelize.define(
  'Address',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    label: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'Home' },
    full_name: { type: DataTypes.TEXT, allowNull: false },
    phone: { type: DataTypes.TEXT, allowNull: false },
    line1: { type: DataTypes.TEXT, allowNull: false },
    line2: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.TEXT, allowNull: false },
    pincode: { type: DataTypes.TEXT, allowNull: false },
    is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'addresses' },
);

export const Order = sequelize.define(
  'Order',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    order_number: { type: DataTypes.TEXT, allowNull: false, unique: true },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'placed' },
    subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    delivery_charge: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    discount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    payment_mode: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'cod' },
    payment_status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'unpaid' },
    address_snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    delivery_slot: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'orders' },
);

export const OrderItem = sequelize.define(
  'OrderItem',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    order_id: { type: DataTypes.UUID, allowNull: false },
    product_id: { type: DataTypes.UUID, allowNull: true },
    product_name: { type: DataTypes.TEXT, allowNull: false },
    product_image: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    unit: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  },
  { tableName: 'order_items' },
);

export const Banner = sequelize.define(
  'Banner',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.TEXT, allowNull: false },
    subtitle: { type: DataTypes.TEXT, allowNull: true },
    image_url: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    cta_label: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'Shop Now' },
    cta_link: { type: DataTypes.TEXT, allowNull: false, defaultValue: '/' },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'banners' },
);

export const DeliverySetting = sequelize.define(
  'DeliverySetting',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    pincode: { type: DataTypes.TEXT, allowNull: false },
    area_name: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    delivery_charge: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    min_order_for_free_delivery: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'delivery_settings' },
);

// Associations
User.hasOne(Profile, { foreignKey: 'id', as: 'profile' });
Profile.belongsTo(User, { foreignKey: 'id', as: 'user' });

Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Order.belongsTo(Profile, { foreignKey: 'user_id', as: 'profile' });

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'order_items' });

export async function connectDb() {
  await sequelize.authenticate();
}

export default {
  sequelize,
  User,
  Profile,
  Category,
  Product,
  Address,
  Order,
  OrderItem,
  Banner,
  DeliverySetting,
  connectDb,
};
