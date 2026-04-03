import User from './models/user';

export default async function seedAdminUser(): Promise<void> {
  const activeUsersCount = await User.countDocuments({ active: true });
  if (activeUsersCount > 0) return;

  await new User({
    email: 'admin@admin.com',
    password: '123456',
    name: 'Admin',
    lastName: 'User',
    phone: '1234567890',
    active: true,
    createdAt: new Date(),
  }).save();
}
