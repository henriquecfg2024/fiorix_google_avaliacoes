const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check the Role enum type
  const enums = await p.$queryRawUnsafe(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'Role'`
  );
  console.log('=== Role enum values ===');
  for (const e of enums) {
    console.log(`  ${e.enumlabel}`);
  }

  // Try update with cast
  try {
    const result = await p.$executeRawUnsafe(
      `UPDATE public."User" SET role = $1::"Role" WHERE id = 'nonexistent'`,
      'COLABORADOR'
    );
    console.log('\n✅ Role cast works');
  } catch(e) {
    console.log(`\n❌ Role cast error: ${e.message?.substring(0, 200)}`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
