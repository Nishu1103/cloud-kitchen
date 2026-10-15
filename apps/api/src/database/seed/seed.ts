/* eslint-disable no-console */
import {
  ALL_PERMISSIONS,
  COUPON_TYPE,
  DEFAULT_ROLE_PERMISSIONS,
  DIET_TYPE,
  FEATURE_FLAGS,
  SYSTEM_ROLES,
  USER_STATUS,
  VENDOR_STATUS,
  rupeesToPaise as rupees,
} from '@ck/types';
import mongoose, { Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { loadAppConfig } from '@/config/load';
import { hashPassword } from '@/modules/auth/password.util';
import {
  BannerSchema,
  CampusSchema,
  CategorySchema,
  CmsPageSchema,
  CouponSchema,
  DeliveryProfileSchema,
  FeatureFlagSchema,
  ProductSchema,
  RoleSchema,
  SettingSchema,
  UserSchema,
  VendorSchema,
} from '@/database/schemas';

/** Real food photography (not placeholders). Keys match S3 folders kitchens will upload into. */
const photo = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

const PHOTOS = {
  sharmaCover: photo('photo-1631452180519-c014fe946bcc'),
  anitaCover: photo('photo-1626700051175-6818013e1d4f'),
  paneer: photo('photo-1631452180519-c014fe946bcc', 800),
  dal: photo('photo-1546833999-b9f581a1996d', 800),
  naan: photo('photo-1601050690597-df0568f70950', 800),
  chicken: photo('photo-1603894584373-5ac82b2ae398', 800),
  gulab: photo('photo-1666190024375-6c02976c9d4d', 800),
  eggRoll: photo('photo-1626700051175-6818013e1d4f', 800),
  paneerRoll: photo('photo-1565299624946-b28f40a0ae38', 800),
  vegMomos: photo('photo-1534422298391-e4f8c172dddb', 800),
  chickenMomos: photo('photo-1496116218417-1a781b1c416c', 800),
  coffee: photo('photo-1511920170033-f8396924c348', 800),
  specialBanner: photo('photo-1585937421612-70a008356fbe', 1400),
};

/**
 * Seeds one campus with roles, staff, kitchens and a menu so every portal has something
 * to show on first run.
 *
 * Safe to re-run: everything is upserted by natural key. The demo password comes from the
 * environment and the script refuses to touch a production database - seed data with
 * known credentials must never reach a real deployment.
 */
async function seed(): Promise<void> {
  const config = loadAppConfig();

  if (config.isProduction) {
    throw new Error('The seed script must never run against a production database.');
  }

  const demoPassword = process.env.SEED_PASSWORD ?? 'ChangeMe!2026';
  if (demoPassword.length < 10) {
    throw new Error('SEED_PASSWORD must be at least 10 characters.');
  }

  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB');

  const Campus = mongoose.model('Campus', CampusSchema);
  const Role = mongoose.model('Role', RoleSchema);
  const User = mongoose.model('User', UserSchema);
  const Vendor = mongoose.model('Vendor', VendorSchema);
  const Category = mongoose.model('Category', CategorySchema);
  const Product = mongoose.model('Product', ProductSchema);
  const Coupon = mongoose.model('Coupon', CouponSchema);
  const FeatureFlag = mongoose.model('FeatureFlag', FeatureFlagSchema);
  const Setting = mongoose.model('Setting', SettingSchema);
  const CmsPage = mongoose.model('CmsPage', CmsPageSchema);
  const Banner = mongoose.model('Banner', BannerSchema);
  const DeliveryProfile = mongoose.model('DeliveryProfile', DeliveryProfileSchema);

  // ------------------------------------------------------------------ campus
  const campus = await Campus.findOneAndUpdate(
    { slug: 'iit-kharagpur' },
    {
      $set: {
        name: 'IIT Kharagpur',
        city: 'Kharagpur',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        themeColor: '#FF5A1F',
        emailDomains: ['iitkgp.ac.in', 'kgpian.iitkgp.ac.in'],
        supportEmail: 'support@campuskitchen.in',
        isActive: true,
        branding: { tagline: 'Hostel food, without the wait' },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  const campusId = campus._id as Types.ObjectId;

  // Zones live on the campus document; they are always read together with it.
  const zoneDefinitions = [
    { name: 'Hall Zone A', deliveryFee: rupees(15), etaMinutes: 25 },
    { name: 'Hall Zone B', deliveryFee: rupees(20), etaMinutes: 35 },
    { name: 'Academic Area', deliveryFee: rupees(25), etaMinutes: 40 },
  ];
  for (const zone of zoneDefinitions) {
    const existing = campus.get('zones') as Array<{ name: string }> | undefined;
    if (!existing?.some((entry) => entry.name === zone.name)) {
      await Campus.updateOne(
        { _id: campusId },
        { $push: { zones: { ...zone, isActive: true } } },
      );
    }
  }
  const seededCampus = await Campus.findById(campusId).select('zones').lean();
  const zones = (seededCampus?.zones ?? []) as Array<{ _id: Types.ObjectId; name: string }>;
  console.log(`Campus: ${String(campus.get('name'))} with ${zones.length} delivery zones`);

  // ------------------------------------------------------------------- roles
  const roles = new Map<string, Types.ObjectId>();
  for (const role of Object.values(SYSTEM_ROLES)) {
    const permissions =
      role === SYSTEM_ROLES.SUPER_ADMIN
        ? ALL_PERMISSIONS
        : [...(DEFAULT_ROLE_PERMISSIONS[role] ?? [])];

    const document = await Role.findOneAndUpdate(
      { slug: role, campusId: null },
      {
        $set: {
          name: role
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '),
          permissions,
          isSystem: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    roles.set(role, document._id as Types.ObjectId);
  }
  console.log(`Roles: ${roles.size} system roles`);

  // ------------------------------------------------------------------- users
  // Hashed through the same helper the login path verifies with, so a change to the
  // algorithm or the pepper construction can never lock the seeded accounts out.
  const passwordHash = await hashPassword(demoPassword, config.auth.passwordPepper);

  async function upsertUser(params: { name: string; email: string; phone: string; role: string }) {
    return User.findOneAndUpdate(
      { campusId, email: params.email },
      {
        $set: {
          name: params.name,
          phone: params.phone,
          passwordHash,
          status: USER_STATUS.ACTIVE,
          emailVerified: true,
          phoneVerified: true,
          roleIds: [roles.get(params.role)],
          referralCode: randomBytes(4).toString('hex').toUpperCase().slice(0, 8),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  const superAdmin = await upsertUser({
    name: 'Platform Owner',
    email: 'owner@campuskitchen.in',
    phone: '9000000001',
    role: SYSTEM_ROLES.SUPER_ADMIN,
  });

  await upsertUser({
    name: 'Campus Admin',
    email: 'admin@campuskitchen.in',
    phone: '9000000002',
    role: SYSTEM_ROLES.CAMPUS_ADMIN,
  });

  const vendorOwner = await upsertUser({
    name: 'Sharma Ji',
    email: 'vendor@campuskitchen.in',
    phone: '9000000003',
    role: SYSTEM_ROLES.VENDOR_OWNER,
  });

  const secondVendorOwner = await upsertUser({
    name: 'Anita Das',
    email: 'vendor2@campuskitchen.in',
    phone: '9000000004',
    role: SYSTEM_ROLES.VENDOR_OWNER,
  });

  const partner = await upsertUser({
    name: 'Rahul Delivery',
    email: 'delivery@campuskitchen.in',
    phone: '9000000005',
    role: SYSTEM_ROLES.DELIVERY_PARTNER,
  });

  const student = await upsertUser({
    name: 'Aarav Student',
    email: 'student@campuskitchen.in',
    phone: '9000000006',
    role: SYSTEM_ROLES.CUSTOMER,
  });

  await User.updateOne(
    { _id: student._id },
    {
      $set: {
        walletBalance: rupees(500),
        addresses: [
          {
            label: 'Hostel room',
            line1: 'Nehru Hall of Residence',
            hostel: 'Nehru Hall',
            roomNumber: 'C-214',
            contactName: 'Aarav Student',
            contactPhone: '9000000006',
            campusZoneId: zones[0]?._id,
            isDefault: true,
          },
        ],
      },
    },
  );

  await DeliveryProfile.findOneAndUpdate(
    { userId: partner._id },
    { $set: { campusId, isOnline: false, vehicle: 'cycle', maxConcurrentOrders: 2 } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  console.log('Users: super admin, campus admin, 2 vendors, 1 partner, 1 student');

  // ----------------------------------------------------------------- vendors
  const operatingHours = Array.from({ length: 7 }, (_, day) => ({
    day,
    open: '09:00',
    close: '23:00',
    isClosed: false,
  }));

  const kitchens = [
    {
      owner: vendorOwner._id as Types.ObjectId,
      name: 'Sharma Ji Ka Dhaba',
      slug: 'sharma-ji-ka-dhaba',
      tagline: 'Thalis that taste like home',
      cuisines: ['North Indian', 'Punjabi'],
      description: 'Hearty North Indian thalis, rotis fresh off the tawa.',
      coverUrl: PHOTOS.sharmaCover,
      menu: [
        {
          name: 'Paneer Butter Masala',
          price: 180,
          compareAt: 225,
          diet: DIET_TYPE.VEG,
          category: 'Main Course',
          imageUrl: PHOTOS.paneer,
        },
        { name: 'Dal Makhani', price: 140, diet: DIET_TYPE.VEG, category: 'Main Course', imageUrl: PHOTOS.dal },
        { name: 'Butter Naan', price: 35, diet: DIET_TYPE.VEG, category: 'Breads', imageUrl: PHOTOS.naan },
        { name: 'Chicken Curry', price: 220, diet: DIET_TYPE.NON_VEG, category: 'Main Course', imageUrl: PHOTOS.chicken },
        { name: 'Gulab Jamun', price: 60, diet: DIET_TYPE.VEG, category: 'Desserts', imageUrl: PHOTOS.gulab },
      ],
    },
    {
      owner: secondVendorOwner._id as Types.ObjectId,
      name: 'Anita Rolls & Momos',
      slug: 'anita-rolls-momos',
      tagline: 'Open till the last lab ends',
      cuisines: ['Street Food', 'Tibetan'],
      description: 'Late-night rolls and steamed momos.',
      coverUrl: PHOTOS.anitaCover,
      menu: [
        { name: 'Egg Roll', price: 70, diet: DIET_TYPE.EGG, category: 'Rolls', imageUrl: PHOTOS.eggRoll },
        { name: 'Paneer Roll', price: 90, diet: DIET_TYPE.VEG, category: 'Rolls', imageUrl: PHOTOS.paneerRoll },
        { name: 'Veg Momos', price: 100, diet: DIET_TYPE.VEG, category: 'Momos', imageUrl: PHOTOS.vegMomos },
        { name: 'Chicken Momos', price: 130, diet: DIET_TYPE.NON_VEG, category: 'Momos', imageUrl: PHOTOS.chickenMomos },
        { name: 'Cold Coffee', price: 80, diet: DIET_TYPE.VEG, category: 'Beverages', imageUrl: PHOTOS.coffee },
      ],
    },
  ];

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  for (const kitchen of kitchens) {
    const vendor = await Vendor.findOneAndUpdate(
      { campusId, slug: kitchen.slug },
      {
        $set: {
          ownerId: kitchen.owner,
          name: kitchen.name,
          tagline: kitchen.tagline,
          description: kitchen.description,
          cuisines: kitchen.cuisines,
          status: VENDOR_STATUS.APPROVED,
          isOpen: true,
          acceptsDelivery: true,
          acceptsPickup: true,
          operatingHours,
          commissionPercent: 12,
          packagingFee: rupees(10),
          deliveryFee: rupees(20),
          minOrderAmount: rupees(99),
          avgPrepMinutes: kitchen.slug.includes('anita') ? 18 : 32,
          rating: kitchen.slug.includes('anita') ? 4.7 : 4.9,
          ratingCount: kitchen.slug.includes('anita') ? 186 : 428,
          coverUrl: kitchen.coverUrl,
          logoUrl: kitchen.coverUrl,
          contactName: kitchen.name,
          contactPhone: '9000000010',
          approvedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await User.updateOne({ _id: kitchen.owner }, { $set: { vendorId: vendor._id } });

    const categoryNames = [...new Set(kitchen.menu.map((item) => item.category))];
    const categoryIds = new Map<string, Types.ObjectId>();

    for (const [index, name] of categoryNames.entries()) {
      const category = await Category.findOneAndUpdate(
        { campusId, vendorId: vendor._id, slug: slugify(name) },
        { $set: { name, sortOrder: index, isActive: true } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      categoryIds.set(name, category._id as Types.ObjectId);
    }

    for (const [index, item] of kitchen.menu.entries()) {
      await Product.findOneAndUpdate(
        { campusId, vendorId: vendor._id, slug: slugify(item.name) },
        {
          $set: {
            categoryId: categoryIds.get(item.category),
            name: item.name,
            description: `${item.name} prepared fresh at ${kitchen.name}.`,
            basePrice: rupees(item.price),
            compareAtPrice:
              'compareAt' in item && typeof (item as { compareAt?: number }).compareAt === 'number'
                ? rupees((item as { compareAt: number }).compareAt)
                : undefined,
            imageUrl: item.imageUrl,
            diet: item.diet,
            isAvailable: true,
            sortOrder: index,
            prepMinutes: 15,
            flags: index === 0 ? ['bestseller', 'chef_special'] : [],
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }

    console.log(`Kitchen: ${kitchen.name} with ${kitchen.menu.length} items`);
  }

  // ----------------------------------------------------------------- coupons
  const in90Days = new Date(Date.now() + 90 * 86_400_000);

  await Coupon.findOneAndUpdate(
    { campusId, code: 'WELCOME50' },
    {
      $set: {
        title: '₹50 off your first order',
        type: COUPON_TYPE.FLAT,
        value: rupees(50),
        minOrderAmount: rupees(199),
        maxDiscount: rupees(50),
        firstOrderOnly: true,
        usageLimitPerUser: 1,
        usageLimitTotal: 1000,
        isActive: true,
        validFrom: new Date(),
        validTo: in90Days,
        createdBy: superAdmin._id,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  await Coupon.findOneAndUpdate(
    { campusId, code: 'LATENIGHT20' },
    {
      $set: {
        title: '20% off after 10pm',
        type: COUPON_TYPE.PERCENTAGE,
        value: 20,
        minOrderAmount: rupees(149),
        maxDiscount: rupees(80),
        usageLimitPerUser: 5,
        isActive: true,
        validFrom: new Date(),
        validTo: in90Days,
        createdBy: superAdmin._id,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  await Coupon.findOneAndUpdate(
    { campusId, code: 'ONEF25' },
    {
      $set: {
        title: 'Flat 25% OFF',
        type: COUPON_TYPE.PERCENTAGE,
        value: 25,
        minOrderAmount: rupees(199),
        maxDiscount: rupees(120),
        usageLimitPerUser: 3,
        isActive: true,
        validFrom: new Date(),
        validTo: in90Days,
        createdBy: superAdmin._id,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  await Coupon.findOneAndUpdate(
    { campusId, code: 'FREEDEL' },
    {
      $set: {
        title: 'Free Delivery',
        type: COUPON_TYPE.FREE_DELIVERY,
        value: 0,
        minOrderAmount: rupees(149),
        usageLimitPerUser: 5,
        isActive: true,
        validFrom: new Date(),
        validTo: in90Days,
        createdBy: superAdmin._id,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  // ----------------------------------------------------- flags and settings
  // Core ordering is on from day one; growth campaigns ship dark.
  const enabledFlags = new Set(['cash_on_delivery', 'live_tracking', 'wallet_topup', 'referral']);

  for (const flag of FEATURE_FLAGS) {
    await FeatureFlag.findOneAndUpdate(
      { campusId: null, key: flag },
      {
        $set: {
          description: `Runtime toggle for ${flag}`,
          enabled: enabledFlags.has(flag),
          rolloutPercent: 100,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }

  const settings: Array<[string, string, unknown, boolean]> = [
    ['platform', 'taxPercent', 5, false],
    ['platform', 'platformFeePaise', rupees(4), false],
    ['delivery', 'partnerEarningPaise', rupees(20), true],
    ['delivery', 'baseFeePaise', rupees(15), false],
    ['delivery', 'freeAbovePaise', rupees(499), false],
    ['wallet', 'maxBalancePaise', rupees(10_000), true],
    ['order', 'cancelWindowSeconds', 120, false],
    ['vendor', 'promoNotificationsPerDay', 2, true],
  ];

  for (const [group, key, value, isSensitive] of settings) {
    await Setting.findOneAndUpdate(
      { campusId, group, key },
      { $set: { value, isSensitive } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }

  // --------------------------------------------------------------- content
  await CmsPage.findOneAndUpdate(
    { campusId, slug: 'terms' },
    {
      $set: {
        title: 'Terms of Service',
        contentHtml:
          '<h2>Terms of Service</h2><p>Be kind to the kitchens and the delivery partners.</p>',
        status: 'published',
        publishedAt: new Date(),
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  await Banner.findOneAndUpdate(
    { campusId, title: 'Welcome offer' },
    {
      $set: {
        subtitle: 'Flat ₹50 off your first order',
        imageUrl: PHOTOS.specialBanner,
        deepLink: '/offers',
        placement: 'home_hero',
        sortOrder: 0,
        isActive: true,
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  console.log('\nSeed complete.\n');
  console.log('  Super admin   owner@campuskitchen.in');
  console.log('  Campus admin  admin@campuskitchen.in');
  console.log('  Vendor        vendor@campuskitchen.in');
  console.log('  Vendor 2      vendor2@campuskitchen.in');
  console.log('  Delivery      delivery@campuskitchen.in');
  console.log('  Student       student@campuskitchen.in');
  console.log(`  Password      ${demoPassword}   (override with SEED_PASSWORD)`);

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
