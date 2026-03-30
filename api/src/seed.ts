import User from './models/user';

const SEED_EMAIL = 'admin@admin.com';
const SEED_PASSWORD = '123456';

export default async function seedAdminUser(): Promise<void> {
  const existing = await User.findOne({ email: SEED_EMAIL }).lean();
  if (existing) return;
  await new User({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    name: 'Admin',
    lastName: 'User',
    phone: 1234567890,
    active: true,
    createdAt: new Date(),
  }).save();
}
