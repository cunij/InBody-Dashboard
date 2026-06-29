const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Pool } = require("pg");

const rootDir = __dirname;
const publicFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
]);
const DEFAULT_MODEL = "gpt-5-mini";
const MAIN_SPLITS = ["PUSH", "PULL", "LEG"];
const CARDIO_DISTANCE_MAX_KM = 999.99;

loadEnv(path.join(rootDir, ".env"));

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const defaultModel = DEFAULT_MODEL;
const database = createDatabasePool(process.env.DATABASE_URL);
let databaseInitError = null;
const databaseReadyPromise = database
  ? initializeDatabase(database).catch((error) => {
      databaseInitError = error;
      console.error("Database initialization failed:", error);
    })
  : Promise.resolve();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/config") {
      return sendJson(response, 200, {
        hasApiKey: Boolean(process.env.OPENAI_API_KEY),
        hasDatabase: Boolean(database),
        defaultModel,
      });
    }

    if (request.method === "GET" && url.pathname === "/api/data") {
      return handleData(response);
    }

    if (request.method === "POST" && url.pathname === "/api/records") {
      return handleUpsertRecord(request, response);
    }

    if (request.method === "DELETE" && url.pathname === "/api/records") {
      return handleDeleteAllRecords(response);
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/records/")) {
      return handleDeleteRecord(response, decodeURIComponent(url.pathname.slice("/api/records/".length)));
    }

    if (request.method === "PUT" && url.pathname === "/api/profile") {
      return handleSaveProfile(request, response);
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/workouts/")) {
      return handleSaveWorkout(
        request,
        response,
        decodeURIComponent(url.pathname.slice("/api/workouts/".length))
      );
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/workouts/")) {
      return handleDeleteWorkout(response, decodeURIComponent(url.pathname.slice("/api/workouts/".length)));
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/routines/")) {
      return handleSaveRoutine(
        request,
        response,
        decodeURIComponent(url.pathname.slice("/api/routines/".length))
      );
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/routines/")) {
      return handleDeleteRoutine(response, decodeURIComponent(url.pathname.slice("/api/routines/".length)));
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === "POST" && url.pathname === "/api/analyze") {
      return handleAnalyze(request, response);
    }

    if (request.method === "GET") {
      return serveStatic(url.pathname, response);
    }

    return sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Server error" });
  }
});

server.listen(port, host, () => {
  console.log("InBody tracker server running at:");
  console.log(`- Local:   http://localhost:${port}`);
  getLocalIPv4Addresses().forEach((address) => {
    console.log(`- Network: http://${address}:${port}`);
  });
});

async function handleData(response) {
  const db = await requireDatabase(response);
  if (!db) {
    return;
  }

  const [recordsResult, workoutsResult, profileResult, routinesResult] = await Promise.all([
    db.query(
      `SELECT id, record_date, weight, body_fat, muscle, extract(epoch FROM created_at) * 1000 AS created_at
       FROM inbody_records
       ORDER BY record_date ASC`
    ),
    db.query(
      `SELECT workout_date, main_split, cardio, cardio_distance_km
       FROM workout_entries
       ORDER BY workout_date ASC`
    ),
    db.query(
      `SELECT content
       FROM profile_store
       WHERE key = 'default'
       LIMIT 1`
    ),
    db.query(
      `SELECT routine_date, split, failure_set_ratio, items
       FROM daily_routines
       ORDER BY routine_date ASC`
    ),
  ]);

  const records = recordsResult.rows.map(formatRecordRow);
  const workouts = workoutsResult.rows.reduce((accumulator, row) => {
    accumulator[row.workout_date] = {
      mainSplit: row.main_split || null,
      cardio: Boolean(row.cardio),
      cardioDistanceKm: Number(row.cardio_distance_km || 0),
    };
    return accumulator;
  }, {});
  const dailyRoutines = routinesResult.rows.reduce((accumulator, row) => {
    const routine = formatDailyRoutineRow(row);
    accumulator[routine.date] = routine;
    return accumulator;
  }, {});
  const profile = profileResult.rows[0]?.content || "";

  return sendJson(response, 200, { records, workouts, dailyRoutines, profile });
}

async function handleUpsertRecord(request, response) {
  const db = await requireDatabase(response);
  if (!db) {
    return;
  }

  const body = await readJsonBody(request);
  const record = sanitizeRecordInput(body);
  if (!record) {
    return sendJson(response, 400, { error: "Invalid record payload" });
  }

  const nextId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : crypto.randomUUID();
  const createdAt = Number.isFinite(Number(body.createdAt)) ? Number(body.createdAt) : Date.now();
  const result = await db.query(
    `INSERT INTO inbody_records (id, record_date, weight, body_fat, muscle, created_at)
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
     ON CONFLICT (record_date)
     DO UPDATE SET
       weight = EXCLUDED.weight,
       body_fat = EXCLUDED.body_fat,
       muscle = EXCLUDED.muscle
     RETURNING id, record_date, weight, body_fat, muscle, extract(epoch FROM created_at) * 1000 AS created_at`,
    [nextId, record.date, record.weight, record.bodyFat, record.muscle, createdAt]
  );

  return sendJson(response, 200, {
    record: formatRecordRow(result.rows[0]),
  });
}

async function handleDeleteAllRecords(response) {
  const db = await requireDatabase(response);
  if (!db) {
    return;
  }

  await db.query("DELETE FROM inbody_records");
  return sendJson(response, 200, { ok: true });
}

async function handleDeleteRecord(response, id) {
  const db = await requireDatabase(response);
  if (!db) {
    return;
  }

  if (!id) {
    return sendJson(response, 400, { error: "Record id is required" });
  }

  await db.query("DELETE FROM inbody_records WHERE id = $1", [id]);
  return sendJson(response, 200, { ok: true });
}

async function handleSaveProfile(request, response) {
  const db = await requireDatabase(response);
  if (!db) {
    return;
  }

  const body = await readJsonBody(request);
  const content = typeof body.profile === "string" && body.profile.trim() ? body.profile.trim() : "";
  const nextProfile = content || DEFAULT_PROFILE_TEXT;

  await db.query(
    `INSERT INTO profile_store (key, content)
     VALUES ('default', $1)
     ON CONFLICT (key)
     DO UPDATE SET
       content = EXCLUDED.content,
       updated_at = now()`,
    [nextProfile]
  );

  return sendJson(response, 200, { profile: nextProfile });
}

async function handleSaveWorkout(request, response, dateString) {
  const db = await requireDatabase(response);
  if (!db) {
    return;
  }

  if (!isDateString(dateString)) {
    return sendJson(response, 400, { error: "Invalid workout date" });
  }

  const body = await readJsonBody(request);
  const workout = sanitizeWorkoutInput(body);
  if (!workout || (!workout.mainSplit && !workout.cardio)) {
    return sendJson(response, 400, { error: "Invalid workout payload" });
  }

  const result = await db.query(
    `INSERT INTO workout_entries (workout_date, main_split, cardio, cardio_distance_km)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workout_date)
     DO UPDATE SET
       main_split = EXCLUDED.main_split,
       cardio = EXCLUDED.cardio,
       cardio_distance_km = EXCLUDED.cardio_distance_km,
       updated_at = now()
     RETURNING workout_date, main_split, cardio, cardio_distance_km`,
    [
      dateString,
      workout.mainSplit,
      workout.cardio,
      workout.cardioDistanceKm,
    ]
  );

  return sendJson(response, 200, {
    workout: formatWorkoutRow(result.rows[0]),
  });
}

async function handleDeleteWorkout(response, dateString) {
  const db = await requireDatabase(response);
  if (!db) {
    return;
  }

  if (!isDateString(dateString)) {
    return sendJson(response, 400, { error: "Invalid workout date" });
  }

  await db.query("DELETE FROM workout_entries WHERE workout_date = $1", [dateString]);
  return sendJson(response, 200, { ok: true });
}

async function handleSaveRoutine(request, response, dateString) {
  const db = await requireDatabase(response);
  if (!db) {
    return;
  }

  if (!isDateString(dateString)) {
    return sendJson(response, 400, { error: "Invalid routine date" });
  }

  const body = await readJsonBody(request);
  const routine = sanitizeDailyRoutineInput({ ...body, date: dateString });
  if (!routine) {
    return sendJson(response, 400, { error: "Invalid routine payload" });
  }

  const result = await db.query(
    `INSERT INTO daily_routines (routine_date, split, failure_set_ratio, items)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (routine_date)
     DO UPDATE SET
       split = EXCLUDED.split,
       failure_set_ratio = EXCLUDED.failure_set_ratio,
       items = EXCLUDED.items,
       updated_at = now()
     RETURNING routine_date, split, failure_set_ratio, items`,
    [
      routine.date,
      routine.split,
      routine.failureSetRatio,
      JSON.stringify(routine.items),
    ]
  );

  return sendJson(response, 200, {
    routine: formatDailyRoutineRow(result.rows[0]),
  });
}

async function handleDeleteRoutine(response, dateString) {
  const db = await requireDatabase(response);
  if (!db) {
    return;
  }

  if (!isDateString(dateString)) {
    return sendJson(response, 400, { error: "Invalid routine date" });
  }

  await db.query("DELETE FROM daily_routines WHERE routine_date = $1", [dateString]);
  return sendJson(response, 200, { ok: true });
}

async function handleAnalyze(request, response) {
  const body = await readJsonBody(request);
  const latest = sanitizeLatestRecord(body.latest);
  const analysisDate = isDateString(body.analysisDate) ? body.analysisDate : latest?.date || "";
  const trend = typeof body.trend === "string" ? body.trend.trim() : "";
  const records = Array.isArray(body.records) ? body.records.map(sanitizeLatestRecord).filter(Boolean) : [];
  const workouts = Array.isArray(body.workouts) ? body.workouts.map(sanitizeAnalysisWorkout).filter(Boolean) : [];
  const profile = typeof body.profile === "string" ? body.profile.trim() : "";
  const routineDate = isDateString(body.routineDate) ? body.routineDate : "";
  const routine = sanitizeAnalysisRoutine(body.routine);
  const failureSetRatio = sanitizeFailureSetRatio(body.failureSetRatio);
  const userQuery = typeof body.userQuery === "string" ? body.userQuery.trim() : "";

  if (!latest || !trend) {
    return sendJson(response, 400, { error: "latest and trend are required" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(response, 503, { error: "OPENAI_API_KEY is missing in .env" });
  }

  const prompt = buildPrompt(
    analysisDate,
    latest,
    trend,
    records,
    profile,
    workouts,
    routineDate,
    routine,
    failureSetRatio,
    userQuery
  );

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        input: prompt,
      }),
    });

    const payload = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      const details = [payload.error?.type, payload.error?.code, payload.error?.message]
        .filter(Boolean)
        .join(" | ");
      const message = details || `OpenAI request failed with status ${apiResponse.status}`;

      console.error("OpenAI API error:", payload);
      return sendJson(response, apiResponse.status, { error: message, details: payload });
    }

    const rawText = extractResponseText(payload);
    if (!rawText) {
      console.error("OpenAI API empty response:", payload);
      return sendJson(response, 502, {
        error: "OpenAI returned an empty analysis",
        details: payload,
      });
    }

    return sendJson(response, 200, {
      analysis: rawText,
    });
  } catch (error) {
    console.error("OpenAI network error:", error);
    return sendJson(response, 502, {
      error: `OpenAI network error: ${error.message}`,
    });
  }
}

function buildPrompt(
  analysisDate,
  latest,
  trend,
  records,
  profile,
  workouts,
  routineDate,
  routine,
  failureSetRatio,
  userQuery
) {
  const recordLines = records.length
    ? records
        .map(
          (record) =>
            `- ${record.date}: 체중 ${record.weight}kg, 체지방률 ${record.bodyFat}%, 골격근량 ${record.muscle}kg`
        )
        .join("\n")
    : "- 기록 없음";
  const workoutSummary = summarizeWorkouts(workouts);
  const workoutLines = workouts.length
    ? workouts.map((workout) => `- ${workout.date}: ${formatWorkoutLabel(workout)}`).join("\n")
    : "";
  const routineLines = routine
    ? routine.items
        .map(
          (item) =>
            `- ${item.name}: 세트 ${item.sets}, 횟수 ${item.reps}${item.weight ? `, 중량 ${item.weight}` : ""}${
              item.note ? `, 메모 ${item.note}` : ""
            }`
        )
        .join("\n")
    : "- 저장된 루틴 없음";
  const routineSummary = routine
    ? `루틴 날짜 ${routineDate}, 분할 ${routine.split}, 실패지점 수행 세트 비율 ${
        failureSetRatio === null ? "미지정" : `${failureSetRatio}%`
      }`
    : `루틴 날짜 ${routineDate || analysisDate || latest.date}, 저장된 루틴 없음`;

  const sections = [
    "You evaluate InBody trends for a bodybuilding-focused dashboard.",
    "Respond in Korean.",
    "Return a short, direct answer focused only on the user's query.",
    "Keep the answer concise and high-signal, usually within 2 to 5 short sentences.",
    "Do not force a fixed template or numbered sections.",
    "Split the answer into 2 or 3 short paragraphs with blank lines when it improves readability.",
    "If the user provides an additional query, prioritize answering that query directly.",
    "If the user query is broad or empty, give only the most important summary and next point.",
    "When profile information includes diet, calorie surplus, protein intake, meal frequency, or supplements, reflect them directly in the analysis.",
    "When relevant, evaluate the saved workout routine for exercise selection, volume, repetition targets, and the failure-set ratio.",
    "If no saved routine exists for the selected calendar date, explicitly say that the routine is missing and explain what information should be added.",
    "When useful, include one concrete action about training execution or nutrition.",
    "Do not use markdown, bullet lists, or JSON.",
    `Selected calendar date: ${analysisDate || latest.date}`,
    analysisDate && analysisDate !== latest.date
      ? `No InBody record exists on the selected calendar date. Use ${latest.date} as the latest previous body-composition record while evaluating the routine and workouts around ${analysisDate}.`
      : `The selected calendar date and body-composition reference date are both ${latest.date}.`,
    `최신 기록: 날짜 ${latest.date}, 체중 ${latest.weight}kg, 체지방률 ${latest.bodyFat}%, 골격근량 ${latest.muscle}kg`,
    `직전 변화 요약: ${trend}`,
  ];

  if (profile) {
    sections.push("사용자 생활 방식 & 목표:");
    sections.push(profile);
  }

  if (userQuery) {
    sections.push(`사용자 추가 쿼리: ${userQuery}`);
  }

  if (workoutSummary) {
    sections.push(`최근 운동 요약: ${workoutSummary}`);
    sections.push("최근 운동 기록:");
    sections.push(workoutLines);
  }

  sections.push(`저장된 루틴 요약: ${routineSummary}`);
  sections.push("저장된 루틴 상세:");
  sections.push(routineLines);

  sections.push("최근 기록 목록:");
  sections.push(recordLines);

  return sections.join("\n");
}

function summarizeWorkouts(workouts) {
  if (!Array.isArray(workouts) || workouts.length === 0) {
    return "";
  }

  const counts = { PULL: 0, PUSH: 0, LEG: 0, CARDIO: 0 };
  workouts.forEach((workout) => {
    if (counts[workout.mainSplit] !== undefined) {
      counts[workout.mainSplit] += 1;
    }

    if (workout.cardio) {
      counts.CARDIO += 1;
    }
  });

  const cardioDistanceKm = workouts.reduce(
    (total, workout) => total + sanitizeCardioDistanceKm(workout.cardioDistanceKm),
    0
  );

  return `최근 ${workouts.length}회 운동, PUSH ${counts.PUSH}회 / PULL ${counts.PULL}회 / LEG ${counts.LEG}회 / CARDIO ${counts.CARDIO}회 / 유산소 ${formatCardioDistanceKm(cardioDistanceKm)}`;
}

function formatWorkoutLabel(workout) {
  const parts = [];

  if (typeof workout.mainSplit === "string" && workout.mainSplit) {
    parts.push(workout.mainSplit);
  }

  if (workout.cardio) {
    const distance = sanitizeCardioDistanceKm(workout.cardioDistanceKm);
    parts.push(distance > 0 ? `CARDIO ${formatCardioDistanceKm(distance)}` : "CARDIO");
  }

  return parts.join(" + ") || "운동 기록";
}

function buildRoutineFallback(latest, workouts) {
  const anchorDateString = latest?.date || getTodayLocalDateString();
  const recentTenDays = getRecentWorkoutsWithinDays(workouts, 10, anchorDateString);
  const recentMainSplits = recentTenDays.map((workout) => workout.mainSplit).filter(Boolean);
  const recommendedSplit = chooseRoutineSplit(anchorDateString, workouts);
  const exercises = getRoutineTemplate(recommendedSplit);
  const lastTwoSplits = recentMainSplits.slice(0, 2);
  const reason =
    recommendedSplit === "RECOVERY"
      ? "최근 10일 운동 빈도가 높아 보여 강한 메인 분할보다 회복 중심 세션이 더 적절합니다."
      : lastTwoSplits.length
        ? `최근 ${lastTwoSplits.join(" / ")} 직후라 같은 부위 반복을 피하고 균형 있게 다음 분할을 추천합니다.`
        : "최근 분할 기록이 많지 않아 벌크업 기준의 기본 PPL 흐름으로 추천합니다.";
  const cardioNote =
    recommendedSplit === "RECOVERY"
      ? "20~30분 정도의 가벼운 유산소와 가동성 위주로 마무리하세요."
      : recentTenDays.some((workout) => workout.cardio)
        ? "이미 유산소를 병행 중이면 오늘은 10분 안팎의 가벼운 마무리 정도로 충분합니다."
        : "필요하면 마무리로 10~15분 정도의 가벼운 유산소를 추가하세요.";

  return {
    recommendedSplit,
    reason,
    exercises,
    cardioNote,
  };
}

function chooseRoutineSplit(anchorDateString, workouts) {
  const recentTenDays = getRecentWorkoutsWithinDays(workouts, 10, anchorDateString);
  const recentFourDays = getRecentWorkoutsWithinDays(workouts, 4, anchorDateString);
  const recentThreeDays = getRecentWorkoutsWithinDays(workouts, 3, anchorDateString);

  if (recentTenDays.length >= 8 || recentFourDays.length >= 4 || recentThreeDays.length >= 3) {
    return "RECOVERY";
  }

  const counts = { PUSH: 0, PULL: 0, LEG: 0 };
  recentTenDays.forEach((workout) => {
    if (counts[workout.mainSplit] !== undefined) {
      counts[workout.mainSplit] += 1;
    }
  });

  const recentMainSplits = recentTenDays.map((workout) => workout.mainSplit).filter(Boolean);
  const blocked = new Set(recentMainSplits.slice(0, 2));
  const order = ["PUSH", "PULL", "LEG"];
  const preferredOrder = [...order].sort((left, right) => {
    return counts[left] - counts[right] || order.indexOf(left) - order.indexOf(right);
  });

  return preferredOrder.find((split) => !blocked.has(split)) || preferredOrder[0] || "PUSH";
}

function getRecentWorkoutsWithinDays(workouts, days, anchorDateString = getTodayLocalDateString()) {
  if (!Array.isArray(workouts) || workouts.length === 0) {
    return [];
  }

  const anchorDate = parseDateString(anchorDateString);
  if (!anchorDate) {
    return [];
  }

  const cutoff = new Date(anchorDate);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  return workouts
    .filter((workout) => typeof workout?.date === "string")
    .filter((workout) => {
      const workoutDate = parseDateString(workout.date);
      return workoutDate && workoutDate >= cutoff && workoutDate <= anchorDate;
    })
    .sort((left, right) => right.date.localeCompare(left.date));
}

function getRoutineTemplate(split) {
  const templates = {
    PUSH: [
      { name: "인클라인 덤벨 프레스", sets: "4세트", reps: "8~10회" },
      { name: "머신 체스트 프레스", sets: "3세트", reps: "10~12회" },
      { name: "시티드 숄더 프레스", sets: "3세트", reps: "8~10회" },
      { name: "덤벨 레터럴 레이즈", sets: "4세트", reps: "12~15회" },
      { name: "케이블 푸시다운", sets: "3세트", reps: "10~15회" },
    ],
    PULL: [
      { name: "랫풀다운", sets: "4세트", reps: "8~12회" },
      { name: "체스트 서포티드 로우", sets: "3세트", reps: "8~10회" },
      { name: "원암 케이블 로우", sets: "3세트", reps: "10~12회" },
      { name: "리어델트 플라이", sets: "3세트", reps: "12~15회" },
      { name: "이지바 컬", sets: "3세트", reps: "10~12회" },
    ],
    LEG: [
      { name: "레그 프레스", sets: "4세트", reps: "10~12회" },
      { name: "루마니안 데드리프트", sets: "4세트", reps: "8~10회" },
      { name: "레그 익스텐션", sets: "3세트", reps: "12~15회" },
      { name: "레그 컬", sets: "3세트", reps: "10~12회" },
      { name: "스탠딩 카프 레이즈", sets: "4세트", reps: "12~20회" },
    ],
    RECOVERY: [
      { name: "가벼운 사이클", sets: "1세션", reps: "20~30분" },
      { name: "고관절/흉추 모빌리티", sets: "2라운드", reps: "각 5~8분" },
      { name: "밴드 풀어파트", sets: "3세트", reps: "15~20회" },
      { name: "복압 또는 코어 드릴", sets: "3세트", reps: "10~15회" },
    ],
  };

  return templates[split] || templates.PUSH;
}

function parseDateString(dateString) {
  if (!isDateString(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getTodayLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function serveStatic(pathname, response) {
  const fileName = publicFiles.get(pathname);
  if (!fileName) {
    return sendText(response, 404, "Not found", "text/plain; charset=utf-8");
  }

  const filePath = path.join(rootDir, fileName);
  const file = fs.readFileSync(filePath);
  return sendBinary(response, 200, file, contentType(fileName), {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/u, "$1");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function createDatabasePool(databaseUrl) {
  if (!databaseUrl) {
    return null;
  }

  return new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseDatabaseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });
}

async function initializeDatabase(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS inbody_records (
      id text PRIMARY KEY,
      record_date date NOT NULL UNIQUE,
      weight double precision NOT NULL,
      body_fat double precision NOT NULL,
      muscle double precision NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS workout_entries (
      workout_date date PRIMARY KEY,
      main_split text,
      cardio boolean NOT NULL DEFAULT false,
      cardio_distance_km double precision NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT workout_entries_main_split_check
        CHECK (main_split IS NULL OR main_split IN ('PUSH', 'PULL', 'LEG')),
      CONSTRAINT workout_entries_cardio_distance_check
        CHECK (cardio_distance_km >= 0 AND cardio_distance_km <= 999.99)
    );
  `);

  await db.query(`
    ALTER TABLE workout_entries
    ADD COLUMN IF NOT EXISTS cardio_distance_km double precision;
  `);

  await db.query(`
    UPDATE workout_entries
    SET cardio_distance_km = 0
    WHERE cardio_distance_km IS NULL;
  `);

  await db.query(`
    ALTER TABLE workout_entries
    ALTER COLUMN cardio_distance_km SET DEFAULT 0,
    ALTER COLUMN cardio_distance_km SET NOT NULL;
  `);

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'workout_entries_cardio_distance_check'
      ) THEN
        ALTER TABLE workout_entries
        ADD CONSTRAINT workout_entries_cardio_distance_check
        CHECK (cardio_distance_km >= 0 AND cardio_distance_km <= 999.99);
      END IF;
    END $$;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS profile_store (
      key text PRIMARY KEY,
      content text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
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
}

async function requireDatabase(response) {
  if (!database) {
    sendJson(response, 503, { error: "DATABASE_URL is missing" });
    return null;
  }

  await databaseReadyPromise;
  if (databaseInitError) {
    sendJson(response, 503, {
      error: `Database initialization failed: ${databaseInitError.message}`,
    });
    return null;
  }

  return database;
}

function shouldUseDatabaseSsl(databaseUrl) {
  if (!databaseUrl) {
    return false;
  }

  const lower = databaseUrl.toLowerCase();
  if (lower.includes("sslmode=disable")) {
    return false;
  }

  return !lower.includes("localhost") && !lower.includes("127.0.0.1");
}

function sanitizeRecordInput(input) {
  const date = typeof input?.date === "string" ? input.date : "";
  const weight = Number(input?.weight);
  const bodyFat = Number(input?.bodyFat);
  const muscle = Number(input?.muscle);

  if (!isDateString(date) || [weight, bodyFat, muscle].some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    date,
    weight,
    bodyFat,
    muscle,
  };
}

function sanitizeLatestRecord(input) {
  const record = sanitizeRecordInput(input);
  if (!record) {
    return null;
  }

  return {
    date: record.date,
    weight: Number(record.weight.toFixed(1)),
    bodyFat: Number(record.bodyFat.toFixed(1)),
    muscle: Number(record.muscle.toFixed(1)),
  };
}

function sanitizeWorkoutInput(input) {
  const mainSplit =
    typeof input?.mainSplit === "string" && MAIN_SPLITS.includes(input.mainSplit.toUpperCase())
      ? input.mainSplit.toUpperCase()
      : null;
  const cardio = Boolean(input?.cardio);
  const cardioDistanceKm = cardio
    ? sanitizeCardioDistanceKm(
        input?.cardioDistanceKm ??
          input?.cardioKm ??
          input?.distanceKm ??
          input?.km
      )
    : 0;

  if (cardioDistanceKm === null || (!mainSplit && !cardio)) {
    return null;
  }

  return {
    mainSplit,
    cardio,
    cardioDistanceKm: cardio ? cardioDistanceKm : 0,
  };
}

function sanitizeCardioDistanceKm(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Number(value);
  if (
    !Number.isFinite(numeric) ||
    numeric < 0 ||
    numeric > CARDIO_DISTANCE_MAX_KM
  ) {
    return null;
  }

  return Math.round(numeric * 100) / 100;
}

function sanitizeDailyRoutineInput(input) {
  if (!input || typeof input !== "object" || !isDateString(input.date)) {
    return null;
  }

  const split =
    typeof input.split === "string" && MAIN_SPLITS.includes(input.split.toUpperCase())
      ? input.split.toUpperCase()
      : "";
  const failureSetRatio = sanitizeFailureSetRatio(input.failureSetRatio);
  const items = sanitizeRoutineItems(input.items);

  if (!split || failureSetRatio === null || items.length === 0) {
    return null;
  }

  return {
    date: input.date,
    split,
    failureSetRatio,
    items,
  };
}

function sanitizeAnalysisRoutine(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const split =
    typeof input.split === "string" && MAIN_SPLITS.includes(input.split.toUpperCase())
      ? input.split.toUpperCase()
      : "";
  const items = sanitizeRoutineItems(input.items);

  if (!split || items.length === 0) {
    return null;
  }

  return {
    split,
    items,
  };
}

function sanitizeRoutineItems(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
      name: String(item.name || "").trim(),
      sets: String(item.sets || "").trim(),
      reps: String(item.reps || "").trim(),
      weight: String(item.weight || "").trim(),
      note: String(item.note || "").trim(),
    }))
    .filter((item) => item.name && item.sets && item.reps);
}

function sanitizeFailureSetRatio(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100 || numeric % 5 !== 0) {
    return null;
  }

  return numeric;
}

function sanitizeAnalysisWorkout(input) {
  if (!input || typeof input !== "object" || !isDateString(input.date)) {
    return null;
  }

  const workout = sanitizeWorkoutInput(input);
  if (!workout) {
    return null;
  }

  return {
    date: input.date,
    mainSplit: workout.mainSplit,
    cardio: workout.cardio,
    cardioDistanceKm: workout.cardioDistanceKm,
  };
}

function formatRecordRow(row) {
  return {
    id: row.id,
    date: row.record_date,
    weight: Number(row.weight),
    bodyFat: Number(row.body_fat),
    muscle: Number(row.muscle),
    createdAt: Number(row.created_at),
  };
}

function formatWorkoutRow(row) {
  return {
    date: row.workout_date,
    mainSplit: row.main_split || null,
    cardio: Boolean(row.cardio),
    cardioDistanceKm: Number(row.cardio_distance_km || 0),
  };
}

function formatCardioDistanceKm(value) {
  const distance = sanitizeCardioDistanceKm(value);
  return `${(distance || 0).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  })}km`;
}

function formatDailyRoutineRow(row) {
  return {
    date: row.routine_date,
    split: row.split,
    failureSetRatio: Number(row.failure_set_ratio),
    items: sanitizeRoutineItems(row.items),
  };
}

function isDateString(dateString) {
  return typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(dateString);
}

function contentType(fileName) {
  if (fileName.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (fileName.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (fileName.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }

  return "application/octet-stream";
}

function extractResponseText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  const text = payload.output
    .filter((item) => item?.type === "message" && Array.isArray(item.content))
    .flatMap((item) => item.content)
    .filter((part) => part?.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n");

  return text.trim();
}

function extractStructuredResponse(text) {
  const parsed = parseJsonObject(text);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const analysis = typeof parsed.analysis === "string" ? parsed.analysis.trim() : "";
  const routine = normalizeRoutine(parsed.routine);

  if (!analysis) {
    return null;
  }

  return {
    analysis,
    routine,
  };
}

function parseJsonObject(text) {
  if (typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const candidates = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue.
    }
  }

  return null;
}

function normalizeRoutine(routine) {
  if (!routine || typeof routine !== "object") {
    return null;
  }

  const recommendedSplit = normalizeRoutineSplit(routine.recommendedSplit);
  const reason = typeof routine.reason === "string" ? routine.reason.trim() : "";
  const exercises = Array.isArray(routine.exercises)
    ? routine.exercises
        .filter((exercise) => exercise && typeof exercise === "object")
        .map((exercise) => ({
          name: String(exercise.name || "").trim(),
          sets: String(exercise.sets || "").trim(),
          reps: String(exercise.reps || "").trim(),
          note: String(exercise.note || "").trim(),
        }))
        .filter((exercise) => exercise.name && exercise.sets && exercise.reps)
        .slice(0, 6)
    : [];
  const cardioNote = typeof routine.cardioNote === "string" ? routine.cardioNote.trim() : "";

  if (!recommendedSplit || !reason || exercises.length < 4) {
    return null;
  }

  return {
    recommendedSplit,
    reason,
    exercises,
    cardioNote,
  };
}

function normalizeRoutineSplit(split) {
  const candidate = String(split || "").trim().toUpperCase();
  if (["PUSH", "PULL", "LEG", "RECOVERY"].includes(candidate)) {
    return candidate;
  }

  if (
    candidate === "CARDIO" ||
    candidate.includes("RECOVERY") ||
    candidate.includes("CARDIO") ||
    candidate.includes("REST")
  ) {
    return "RECOVERY";
  }

  return "";
}

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry && entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    });
  });

  return [...new Set(addresses)].sort();
}

function sendJson(response, statusCode, payload) {
  return sendText(response, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function sendText(response, statusCode, body, type, headers = {}) {
  response.writeHead(statusCode, { "Content-Type": type, ...headers });
  response.end(body);
}

function sendBinary(response, statusCode, body, type, headers = {}) {
  response.writeHead(statusCode, { "Content-Type": type, ...headers });
  response.end(body);
}

const DEFAULT_PROFILE_TEXT = `## 1. Basic Profile

- Height: 180 cm
- Weight: ~78 kg
- Skeletal Muscle Mass: 40.6 kg
- Goal: 근비대 중심 벌크업

## 2. Training Routine

- Training frequency: 거의 매일 웨이트 트레이닝
- Typical workout time: 약 1~1.5시간
- Training style: failure 근처까지 수행
- Training time: 아침 운동

## 3. Nutrition Strategy

- 목표: calorie surplus 유지
- 단백질: 충분히 섭취
- 탄수화물: 추가로 늘리는 중
- 식사 빈도: 하루 5끼

## 4. Supplements

- Creatine
- Beta-alanine
- Caffeine
- Probiotics
- L-arginine
`;
