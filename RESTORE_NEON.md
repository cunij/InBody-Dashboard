# Restore To Neon

This project already uses PostgreSQL through `pg`, so Neon works without app code changes.

## 1. Set your Neon connection string

Put your Neon connection string in `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

## 2. Parse the `.dat` dumps

Run:

```bash
npm run restore:dat -- --records-file "<path-to-3407.dat>" --workouts-file "<path-to-3406.dat>"
```

This creates:

- `recovered-backup.json`
- `recovered-backup.sql`

## 3. Import into Neon

After `DATABASE_URL` points to Neon:

```bash
npm run restore:dat -- --records-file "<path-to-3407.dat>" --workouts-file "<path-to-3406.dat>" --import
```

The script creates missing tables and upserts the recovered rows.

## Notes

- The script auto-detects file type, so the two file arguments can be swapped
- In the provided dump, `3406.dat` maps to `inbody_records`
- In the provided dump, `3407.dat` maps to `workout_entries`
- No dump file for `profile_store` or `daily_routines` was provided, so they are not restored by this script
