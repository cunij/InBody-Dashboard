const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function parseArgs(argv) {
  const options = {
    outJson: "recovered-backup.json",
    outSql: "recovered-backup.sql",
    import: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    if (key === "import") {
      options.import = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    options[key] = value;
    index += 1;
  }

  return options;
}

function requireOption(options, key) {
  if (!options[key]) {
    throw new Error(`--${key} is required`);
  }
  return options[key];
}

function readDatLines(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\uFEFF/u, "").trimEnd())
    .filter((line) => line && line !== "\\.");
}

function parseNullable(value) {
  return value === "\\N" ? null : value;
}

function parseBooleanFlag(value) {
  if (value === "t") {
    return true;
  }
  if (value === "f") {
    return false;
  }
  throw new Error(`Invalid boolean flag: ${value}`);
}

function parseCardioDistanceKm(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`Invalid cardio distance: ${value}`);
  }

  return Math.round(numeric * 100) / 100;
}

function parseTimestampMs(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return timestamp;
}

function detectDatKind(filePath) {
  const firstLine = readDatLines(filePath)[0];
  if (!firstLine) {
    throw new Error(`No data rows found in ${filePath}`);
  }

  const columnCount = firstLine.split(/\t/u).length;
  if (columnCount === 6) {
    return "records";
  }
  if (columnCount === 4 || columnCount === 5) {
    return "workouts";
  }

  throw new Error(`Unsupported .dat shape in ${filePath}`);
}

function parseRecords(filePath) {
  return readDatLines(filePath).map((line, index) => {
    const columns = line.split(/\t/u);
    if (columns.length !== 6) {
      throw new Error(`Unexpected record column count on line ${index + 1} in ${filePath}`);
    }

    const [id, date, weight, bodyFat, muscle, createdAt] = columns.map(parseNullable);
    return {
      id,
      date,
      weight: Number(weight),
      bodyFat: Number(bodyFat),
      muscle: Number(muscle),
      createdAt: parseTimestampMs(createdAt),
    };
  });
}

function parseWorkouts(filePath) {
  return readDatLines(filePath).reduce((accumulator, line, index) => {
    const columns = line.split(/\t/u);
    if (columns.length !== 4 && columns.length !== 5) {
      throw new Error(`Unexpected workout column count on line ${index + 1} in ${filePath}`);
    }

    const [date, mainSplit, cardio, cardioDistanceKm] = columns.map(parseNullable);
    accumulator[date] = {
      mainSplit,
      cardio: parseBooleanFlag(cardio),
      cardioDistanceKm: parseCardioDistanceKm(cardioDistanceKm),
    };
    return accumulator;
  }, {});
}

function sqlString(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function buildBackup(records, workouts) {
  return {
    records,
    workouts,
    dailyRoutines: {},
    profile: "",
  };
}

function collectBackupFromFiles(filePaths) {
  let records = null;
  let workouts = null;

  for (const filePath of filePaths) {
    const kind = detectDatKind(filePath);
    if (kind === "records") {
      records = parseRecords(filePath);
      continue;
    }
    if (kind === "workouts") {
      workouts = parseWorkouts(filePath);
    }
  }

  if (!records) {
    throw new Error("No inbody_records dump was detected");
  }
  if (!workouts) {
    throw new Error("No workout_entries dump was detected");
  }

  return buildBackup(records, workouts);
}

function buildSql(backup) {
  const statements = [];

  statements.push("BEGIN;");
  statements.push(`
CREATE TABLE IF NOT EXISTS inbody_records (
  id text PRIMARY KEY,
  record_date date NOT NULL UNIQUE,
  weight double precision NOT NULL,
  body_fat double precision NOT NULL,
  muscle double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);`.trim());
  statements.push(`
CREATE TABLE IF NOT EXISTS workout_entries (
  workout_date date PRIMARY KEY,
  main_split text,
  cardio boolean NOT NULL DEFAULT false,
  cardio_distance_km double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_entries_main_split_check
    CHECK (main_split IS NULL OR main_split IN ('PUSH', 'PULL', 'LEG')),
  CONSTRAINT workout_entries_cardio_distance_check
    CHECK (cardio_distance_km >= 0)
);`.trim());
  statements.push(`
ALTER TABLE workout_entries
ADD COLUMN IF NOT EXISTS cardio_distance_km double precision;`.trim());
  statements.push(`
UPDATE workout_entries
SET cardio_distance_km = 0
WHERE cardio_distance_km IS NULL;`.trim());
  statements.push(`
ALTER TABLE workout_entries
ALTER COLUMN cardio_distance_km SET DEFAULT 0,
ALTER COLUMN cardio_distance_km SET NOT NULL;`.trim());
  statements.push(`
CREATE TABLE IF NOT EXISTS profile_store (
  key text PRIMARY KEY,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);`.trim());
  statements.push(`
CREATE TABLE IF NOT EXISTS daily_routines (
  routine_date date PRIMARY KEY,
  split text NOT NULL,
  failure_set_ratio integer NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_routines_split_check
    CHECK (split IN ('PULL', 'PUSH', 'LEG')),
  CONSTRAINT daily_routines_failure_ratio_check
    CHECK (
      failure_set_ratio >= 0
      AND failure_set_ratio <= 100
      AND failure_set_ratio % 5 = 0
    )
);`.trim());

  for (const record of backup.records) {
    statements.push(`
INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES (${sqlString(record.id)}, ${sqlString(record.date)}, ${record.weight}, ${record.bodyFat}, ${record.muscle}, to_timestamp(${record.createdAt} / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;
`.trim());
  }

  for (const [date, workout] of Object.entries(backup.workouts)) {
    statements.push(`
INSERT INTO workout_entries (workout_date, main_split, cardio, cardio_distance_km)
VALUES (${sqlString(date)}, ${sqlString(workout.mainSplit)}, ${workout.cardio ? "true" : "false"}, ${parseCardioDistanceKm(workout.cardioDistanceKm)})
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  cardio_distance_km = EXCLUDED.cardio_distance_km,
  updated_at = now();
`.trim());
  }

  statements.push("COMMIT;");
  return `${statements.join("\n\n")}\n`;
}

async function importBackup(databaseUrl, backup) {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("neon.") || databaseUrl.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS inbody_records (
        id text PRIMARY KEY,
        record_date date NOT NULL UNIQUE,
        weight double precision NOT NULL,
        body_fat double precision NOT NULL,
        muscle double precision NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workout_entries (
        workout_date date PRIMARY KEY,
        main_split text,
        cardio boolean NOT NULL DEFAULT false,
        cardio_distance_km double precision NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT workout_entries_main_split_check
          CHECK (main_split IS NULL OR main_split IN ('PUSH', 'PULL', 'LEG')),
        CONSTRAINT workout_entries_cardio_distance_check
          CHECK (cardio_distance_km >= 0)
      );
    `);
    await client.query(`
      ALTER TABLE workout_entries
      ADD COLUMN IF NOT EXISTS cardio_distance_km double precision;
    `);
    await client.query(`
      UPDATE workout_entries
      SET cardio_distance_km = 0
      WHERE cardio_distance_km IS NULL;
    `);
    await client.query(`
      ALTER TABLE workout_entries
      ALTER COLUMN cardio_distance_km SET DEFAULT 0,
      ALTER COLUMN cardio_distance_km SET NOT NULL;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS profile_store (
        key text PRIMARY KEY,
        content text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_routines (
        routine_date date PRIMARY KEY,
        split text NOT NULL,
        failure_set_ratio integer NOT NULL,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT daily_routines_split_check
          CHECK (split IN ('PULL', 'PUSH', 'LEG')),
        CONSTRAINT daily_routines_failure_ratio_check
          CHECK (
            failure_set_ratio >= 0
            AND failure_set_ratio <= 100
            AND failure_set_ratio % 5 = 0
          )
      );
    `);

    for (const record of backup.records) {
      await client.query(
        `
        INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
        VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
        ON CONFLICT (record_date)
        DO UPDATE SET
          id = EXCLUDED.id,
          weight = EXCLUDED.weight,
          body_fat = EXCLUDED.body_fat,
          muscle = EXCLUDED.muscle
        `,
        [record.id, record.date, record.weight, record.bodyFat, record.muscle, record.createdAt]
      );
    }

    for (const [date, workout] of Object.entries(backup.workouts)) {
      await client.query(
        `
        INSERT INTO workout_entries (workout_date, main_split, cardio, cardio_distance_km)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (workout_date)
        DO UPDATE SET
          main_split = EXCLUDED.main_split,
          cardio = EXCLUDED.cardio,
          cardio_distance_km = EXCLUDED.cardio_distance_km,
          updated_at = now()
        `,
        [
          date,
          workout.mainSplit,
          workout.cardio,
          parseCardioDistanceKm(workout.cardioDistanceKm),
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const recordsFile = requireOption(options, "records-file");
  const workoutsFile = requireOption(options, "workouts-file");
  const backup = collectBackupFromFiles([
    path.resolve(recordsFile),
    path.resolve(workoutsFile),
  ]);

  const jsonOutputPath = path.resolve(options["out-json"] || options.outJson);
  const sqlOutputPath = path.resolve(options["out-sql"] || options.outSql);

  fs.writeFileSync(jsonOutputPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");
  fs.writeFileSync(sqlOutputPath, buildSql(backup), "utf8");

  if (options.import) {
    const databaseUrl = options["database-url"] || process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL or --database-url is required when using --import");
    }
    await importBackup(databaseUrl, backup);
  }

  console.log(
    `Recovered ${backup.records.length} records and ${Object.keys(backup.workouts).length} workouts.`
  );
  console.log(`JSON: ${jsonOutputPath}`);
  console.log(`SQL: ${sqlOutputPath}`);
  if (options.import) {
    console.log("Database import completed.");
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
