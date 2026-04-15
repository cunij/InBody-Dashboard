BEGIN;

CREATE TABLE IF NOT EXISTS inbody_records (
  id text PRIMARY KEY,
  record_date date NOT NULL UNIQUE,
  weight double precision NOT NULL,
  body_fat double precision NOT NULL,
  muscle double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_entries (
  workout_date date PRIMARY KEY,
  main_split text,
  cardio boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_entries_main_split_check
    CHECK (main_split IS NULL OR main_split IN ('PUSH', 'PULL', 'LEG'))
);

CREATE TABLE IF NOT EXISTS profile_store (
  key text PRIMARY KEY,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('b33e46e9-b258-45c3-a98b-b45f28407a5d', '2025-08-03', 75.2, 10.5, 38.5, to_timestamp(1773370707835 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('04cebc34-bf30-43cb-bb45-26a03b5a1f9a', '2025-09-30', 75.2, 10.5, 38.5, to_timestamp(1773370793592 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('f003fe20-ebf8-468b-a826-99f584b902e5', '2025-10-01', 74.6, 9.2, 38.9, to_timestamp(1773370816349 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('8e1722c2-0b79-43f8-aaa1-2860d9d2fa97', '2025-12-01', 78.2, 10, 40.6, to_timestamp(1773370835984 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('3f32f165-e234-4aa7-93c7-28ce44c30aa3', '2026-03-13', 77.2, 9.2, 40.4, to_timestamp(1773404920722 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('68efbcf0-6eb9-4f5f-ab18-b7dbbe795482', '2025-02-17', 66.3, 10.1, 33.8, to_timestamp(1774154701917 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('3098dbe9-3e99-4ab2-8313-0799c9ad4263', '2025-03-17', 69.1, 11.5, 34.9, to_timestamp(1774154730831 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('bab82853-b2e6-4dcb-8de6-7a5b4a17bd5e', '2025-04-03', 70, 10.5, 35.7, to_timestamp(1774154751062 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('0e93ce24-3c53-4184-a152-865f40f040ba', '2025-04-16', 70, 11.5, 35.3, to_timestamp(1774154812322 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('b4bb96e0-0b8e-4d3f-a776-b98e2fe0a1c1', '2025-04-30', 71.1, 8.4, 37.3, to_timestamp(1774154833359 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('101b10b6-d003-43a5-8ddd-b28f25108fd0', '2025-09-05', 75.2, 10.5, 38.5, to_timestamp(1774154866802 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
VALUES ('6e574782-bf37-4f09-ae89-4dddb63f0c94', '2026-03-24', 78.8, 9.1, 41.3, to_timestamp(1774302414752 / 1000.0))
ON CONFLICT (record_date)
DO UPDATE SET
  id = EXCLUDED.id,
  weight = EXCLUDED.weight,
  body_fat = EXCLUDED.body_fat,
  muscle = EXCLUDED.muscle;

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-11', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-05', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-06', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-07', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-09', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-10', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-01', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-02-21', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-02-22', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-02-23', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-02-25', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-02-26', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-02-27', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-13', NULL, true)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-15', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-16', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-17', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-19', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-20', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-21', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-23', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-24', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-25', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-28', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-29', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-30', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-04-01', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-04-02', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-04-04', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-04-07', 'LEG', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-04-05', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-03-02', 'PUSH', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

INSERT INTO workout_entries (workout_date, main_split, cardio)
VALUES ('2026-04-08', 'PULL', false)
ON CONFLICT (workout_date)
DO UPDATE SET
  main_split = EXCLUDED.main_split,
  cardio = EXCLUDED.cardio,
  updated_at = now();

COMMIT;
