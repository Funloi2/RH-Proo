import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, GlobalRole, Language } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Seeding database...');

    // ==========================================================================
    // CREATE ADMIN USER
    // ==========================================================================

    const adminPassword = await bcrypt.hash('Admin12345678', 12);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@hr-proo.com' },
        update: {},
        create: {
            email: 'admin@hr-proo.com',
            name: 'Admin',
            surname: 'HR-Proo',
            passwordHash: adminPassword,
            globalRole: GlobalRole.ADMIN,
            language: Language.FR,
            isActive: true,
            isDeleted: false,
        },
    });

    console.log(`Admin user created: ${admin.email} (password: Admin12345678)`);

    // ==========================================================================
    // CREATE DEFAULT LEAVE TYPES
    // ==========================================================================

    const leaveTypes = [
        {
            name: 'annual_leave',
            labelEn: 'Annual Leave',
            labelFr: 'Congé Annuel',
            color: '#3B82F6', // blue
            isDeductible: true,
            sortOrder: 1,
        },
        {
            name: 'sick_leave',
            labelEn: 'Sick Leave',
            labelFr: 'Congé Maladie',
            color: '#EF4444', // red
            isDeductible: false,
            sortOrder: 2,
        },
        {
            name: 'personal_leave',
            labelEn: 'Personal Leave',
            labelFr: 'Congé Personnel',
            color: '#F59E0B', // amber
            isDeductible: true,
            sortOrder: 3,
        },
        {
            name: 'unpaid_leave',
            labelEn: 'Unpaid Leave',
            labelFr: 'Congé Sans Solde',
            color: '#6B7280', // gray
            isDeductible: false,
            sortOrder: 4,
        },
        {
            name: 'family_emergency',
            labelEn: 'Family Emergency',
            labelFr: 'Urgence Familiale',
            color: '#8B5CF6', // purple
            isDeductible: false,
            sortOrder: 5,
        },
    ];

    for (const lt of leaveTypes) {
        await prisma.leaveType.upsert({
            where: { name: lt.name },
            update: {},
            create: lt,
        });
    }

    console.log(`Created ${leaveTypes.length} default leave types`);

    // ==========================================================================
    // CREATE LEAVE BALANCE FOR CURRENT YEAR
    // ==========================================================================

    const currentYear = new Date().getFullYear();

    await prisma.leaveBalance.upsert({
        where: {
            userId_year: {
                userId: admin.id,
                year: currentYear,
            },
        },
        update: {},
        create: {
            userId: admin.id,
            year: currentYear,
            totalAllowance: 25,
            additionalDays: 0,
        },
    });

    console.log(`Leave balance created for admin (${currentYear})`);

    console.log('Seeding complete!');
}

main()
    .catch((e) => {
        console.error('Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });