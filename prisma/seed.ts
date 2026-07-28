import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Use DATABASE_URL directly
const databaseUrl = process.env.DATABASE_URL;
console.log('DATABASE_URL:', databaseUrl?.substring(0, 30) + '...');

const prisma = new PrismaClient({
  datasourceUrl: databaseUrl,
});

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'elmokhber_salt').digest('hex');
}

async function main() {
  // Check if admin exists
  const existingAdmin = await prisma.admin.findFirst();
  
  if (existingAdmin) {
    console.log('Admin already exists:', existingAdmin.email);
    
    // Update password to make sure it's correct
    const hashedPassword = hashPassword('admin123');
    await prisma.admin.update({
      where: { id: existingAdmin.id },
      data: { password: hashedPassword, isActive: true }
    });
    console.log('✅ Password updated for existing admin!');
    console.log('📧 Email:', existingAdmin.email);
    console.log('🔑 Password: admin123');
    return;
  }

  // Create default super admin
  const defaultPassword = 'admin123';
  const hashedPassword = hashPassword(defaultPassword);

  const admin = await prisma.admin.create({
    data: {
      email: 'admin@elmokhber.com',
      name: 'المدير الرئيسي',
      password: hashedPassword,
      role: 'super_admin',
      permissions: JSON.stringify([
        'manage_users',
        'manage_rooms',
        'manage_games',
        'view_logs',
        'manage_admins'
      ]),
      isActive: true
    }
  });

  console.log('✅ Admin created successfully!');
  console.log('📧 Email:', admin.email);
  console.log('🔑 Password:', defaultPassword);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
