// ============================================================
// LYO - Database Seed Script
// ============================================================

import { prisma } from './src/config';
import { hashPassword } from './src/utils';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@lyo.com',
      passwordHash: adminPassword,
      displayName: 'Admin User',
      bio: 'Platform administrator',
      role: 'admin',
      isVerified: true,
    },
  });
  console.log(`✅ Admin created: ${admin.username}`);

  // Create test users
  const testUsers = [
    { username: 'alice', email: 'alice@example.com', displayName: 'Alice Johnson', bio: 'Photographer 📸 | Travel enthusiast' },
    { username: 'bob', email: 'bob@example.com', displayName: 'Bob Smith', bio: 'Developer 💻 | Coffee addict' },
    { username: 'charlie', email: 'charlie@example.com', displayName: 'Charlie Brown', bio: 'Designer 🎨 | Music lover' },
    { username: 'diana', email: 'diana@example.com', displayName: 'Diana Prince', bio: 'Writer ✍️ | Bookworm' },
    { username: 'eve', email: 'eve@example.com', displayName: 'Eve Davis', bio: 'Fitness coach 💪 | Healthy living' },
  ];

  const createdUsers = [];
  for (const userData of testUsers) {
    const password = await hashPassword('password123');
    const user = await prisma.user.upsert({
      where: { username: userData.username },
      update: {},
      create: {
        ...userData,
        passwordHash: password,
      },
    });
    createdUsers.push(user);
    console.log(`✅ User created: ${user.username}`);
  }

  // Create sample posts
  const samplePosts = [
    { content: 'Just launched my new photography portfolio! Check it out 📸 #photography #art', authorIdx: 0 },
    { content: 'Working on a new React project. Hooks are amazing! 💻 #coding #react', authorIdx: 1 },
    { content: 'Beautiful sunset at the beach today 🌅 #travel #nature', authorIdx: 0 },
    { content: 'New design system is coming together nicely 🎨 #design #ui', authorIdx: 2 },
    { content: 'Just finished an amazing book. Highly recommend! 📚 #reading', authorIdx: 3 },
    { content: 'Morning workout done! Feeling great 💪 #fitness #health', authorIdx: 4 },
    { content: 'Coffee and code - the perfect morning ☕ #developer #morning', authorIdx: 1 },
    { content: 'Exploring new hiking trails this weekend 🥾 #adventure #hiking', authorIdx: 0 },
  ];

  for (const postData of samplePosts) {
    const author = createdUsers[postData.authorIdx];
    const post = await prisma.post.create({
      data: {
        authorId: author.id,
        content: postData.content,
        visibility: 'public',
      },
    });
    await prisma.user.update({
      where: { id: author.id },
      data: { postCount: { increment: 1 } },
    });
    console.log(`✅ Post created by ${author.username}`);
  }

  // Create follows
  for (let i = 0; i < createdUsers.length; i++) {
    for (let j = 0; j < createdUsers.length; j++) {
      if (i !== j) {
        await prisma.follow.upsert({
          where: {
            followerId_followingId: {
              followerId: createdUsers[i].id,
              followingId: createdUsers[j].id,
            },
          },
          update: {},
          create: {
            followerId: createdUsers[i].id,
            followingId: createdUsers[j].id,
            status: 'accepted',
          },
        });
      }
    }
  }

  // Update follower counts
  for (const user of createdUsers) {
    const followers = await prisma.follow.count({
      where: { followingId: user.id, status: 'accepted' },
    });
    const following = await prisma.follow.count({
      where: { followerId: user.id, status: 'accepted' },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { followerCount: followers, followingCount: following },
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log('\nLogin credentials:');
  console.log('  Admin: admin@lyo.com / admin123');
  console.log('  Users: [username]@example.com / password123');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
