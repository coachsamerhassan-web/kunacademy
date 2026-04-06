# Database Backup & Restore Procedure

## Automatic Backups
- **Provider:** Supabase managed backups
- **Project:** tusqnndlmdaooxivefza
- **Frequency:** Daily automatic
- **Retention:** 7 days (Pro plan)
- **Dashboard:** https://supabase.com/dashboard/project/tusqnndlmdaooxivefza/database/backups

## Restore Procedure (Point-in-Time)

### Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/tusqnndlmdaooxivefza/database/backups
2. Sign in with the project owner account
3. Select the desired backup point

### Step 2: Restore to Staging (ALWAYS test first)
1. Create a new Supabase project for testing
2. Restore the backup to the test project
3. Verify data integrity:
   - Check profile count: `SELECT COUNT(*) FROM profiles;`
   - Check payment count: `SELECT COUNT(*) FROM payments WHERE status = 'completed';`
   - Check enrollment count: `SELECT COUNT(*) FROM enrollments;`
   - Verify recent data exists: `SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;`

### Step 3: Restore to Production (if needed)
1. Put site into maintenance mode (update DNS or add maintenance flag)
2. Notify team via Telegram
3. Restore backup through Supabase dashboard
4. Verify all tables accessible
5. Run verification queries from Step 2
6. Remove maintenance mode
7. Post-restore: clear any application caches

## Manual Backup (Before Risky Operations)
Before migrations, bulk operations, or data imports:
```bash
# Export current database
pg_dump "postgresql://postgres:[password]@db.tusqnndlmdaooxivefza.supabase.co:5432/postgres" > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Emergency Contacts
- Supabase support: support@supabase.io
- Project owner: Samer Hassan
