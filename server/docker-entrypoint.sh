#!/bin/sh
set -e

echo "[doselynx] Running database migrations..."
./node_modules/.bin/prisma migrate deploy

AUTO_SEED_MODE="${AUTO_SEED:-if_empty}"
if [ "$AUTO_SEED_MODE" = "true" ]; then
  echo "[doselynx] AUTO_SEED=true: seeding database..."
  node prisma/seed.js
elif [ "$AUTO_SEED_MODE" = "if_empty" ]; then
  USER_COUNT=$(node --input-type=module - <<'EOF'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const count = await prisma.user.count();
  console.log(count);
} finally {
  await prisma.$disconnect();
}
EOF
)
  if [ "${USER_COUNT:-0}" = "0" ]; then
    echo "[doselynx] Empty database detected — seeding initial data..."
    node prisma/seed.js
  else
    echo "[doselynx] Existing users detected (${USER_COUNT}) — skipping auto-seed."
  fi
else
  echo "[doselynx] AUTO_SEED=${AUTO_SEED_MODE} — skipping seed."
fi

echo "[doselynx] Starting API & Web server..."
exec node src/index.js
