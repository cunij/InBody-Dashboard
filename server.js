const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rootDir = __dirname;
const publicFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
]);
const ALLOWED_MODELS = ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4o"];
const DEFAULT_MODEL = "gpt-5";

loadEnv(path.join(rootDir, ".env"));

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const defaultModel = normalizeModel(process.env.OPENAI_MODEL);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/config") {
      return sendJson(response, 200, {
        hasApiKey: Boolean(process.env.OPENAI_API_KEY),
        defaultModel,
      });
    }

    if (request.method === "GET" && url.pathname === "/api/models") {
      return handleModels(response);
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

async function handleAnalyze(request, response) {
  const body = await readJsonBody(request);
  const latest = body.latest;
  const trend = body.trend;
  const records = Array.isArray(body.records) ? body.records : [];
  const workouts = Array.isArray(body.workouts) ? body.workouts : [];
  const model = normalizeModel(body.model);
  const profile = typeof body.profile === "string" ? body.profile.trim() : "";

  if (!latest || !trend) {
    return sendJson(response, 400, { error: "latest and trend are required" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(response, 503, { error: "OPENAI_API_KEY is missing in .env" });
  }

  const prompt = buildPrompt(latest, trend, records, profile, workouts);
  const fallbackRoutine = buildRoutineFallback(latest, workouts);

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
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

    const parsed = extractStructuredResponse(rawText);
    if (parsed) {
      return sendJson(response, 200, {
        analysis: parsed.analysis,
        routine: parsed.routine || fallbackRoutine,
      });
    }

    return sendJson(response, 200, {
      analysis: rawText,
      routine: fallbackRoutine,
    });
  } catch (error) {
    console.error("OpenAI network error:", error);
    return sendJson(response, 502, {
      error: `OpenAI network error: ${error.message}`,
    });
  }
}

async function handleModels(response) {
  if (!process.env.OPENAI_API_KEY) {
    return sendJson(response, 200, { models: [] });
  }

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    const payload = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      const message =
        payload.error?.message || `OpenAI model list request failed with status ${apiResponse.status}`;
      console.error("OpenAI models error:", payload);
      return sendJson(response, apiResponse.status, { error: message, details: payload });
    }

    const availableModelIds = new Set(
      Array.isArray(payload.data) ? payload.data.map((entry) => entry.id).filter(Boolean) : []
    );
    const models = ALLOWED_MODELS.filter((modelName) => availableModelIds.has(modelName));

    return sendJson(response, 200, { models });
  } catch (error) {
    console.error("OpenAI models network error:", error);
    return sendJson(response, 502, {
      error: `OpenAI models network error: ${error.message}`,
    });
  }
}

function buildPrompt(latest, trend, records, profile, workouts) {
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

  const sections = [
    "You evaluate InBody trends for a bodybuilding-focused dashboard.",
    "Respond in Korean.",
    'The analysis field must be a single string with exactly these three numbered sections: "1) 현재 상태", "2) 추세 해석", "3) 다음 행동 제안".',
    "When profile information includes diet, calorie surplus, protein intake, meal frequency, or supplements, reflect them directly in the analysis.",
    "The next-action section must include at least one concrete note about diet or supplements when that information is available.",
    "Create one practical workout routine for today in the routine field.",
    "Prefer avoiding the same main split as the most recent one or two main split workouts.",
    "If recent workout frequency is very high, you may set recommendedSplit to RECOVERY.",
    "CARDIO is supplementary only and must not replace the main split unless recommendedSplit is RECOVERY.",
    "Return JSON only. Do not use markdown or code fences.",
    'JSON schema: {"analysis":"string","routine":{"recommendedSplit":"PUSH|PULL|LEG|RECOVERY","reason":"string","exercises":[{"name":"string","sets":"string","reps":"string","note":"string optional"}],"cardioNote":"string optional"}}',
    "Provide 4 to 6 exercises in routine.exercises.",
    `최신 기록: 날짜 ${latest.date}, 체중 ${latest.weight}kg, 체지방률 ${latest.bodyFat}%, 골격근량 ${latest.muscle}kg`,
    `직전 변화 요약: ${trend}`,
  ];

  if (profile) {
    sections.push("사용자 생활 방식 & 목표:");
    sections.push(profile);
  }

  if (workoutSummary) {
    sections.push(`최근 운동 요약: ${workoutSummary}`);
    sections.push("최근 운동 기록:");
    sections.push(workoutLines);
  }

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

  return `최근 ${workouts.length}회 운동, PUSH ${counts.PUSH}회 / PULL ${counts.PULL}회 / LEG ${counts.LEG}회 / CARDIO ${counts.CARDIO}회`;
}

function formatWorkoutLabel(workout) {
  const parts = [];

  if (typeof workout.mainSplit === "string" && workout.mainSplit) {
    parts.push(workout.mainSplit);
  }

  if (workout.cardio) {
    parts.push("CARDIO");
  }

  return parts.join(" + ") || "운동 기록";
}

function buildRoutineFallback(latest, workouts) {
  const anchorDateString = latest?.date || getTodayLocalDateString();
  const recentTenDays = getRecentWorkoutsWithinDays(workouts, 10, anchorDateString);
  const recentMainSplits = recentTenDays
    .map((workout) => workout.mainSplit)
    .filter(Boolean);
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

  const recentMainSplits = recentTenDays
    .map((workout) => workout.mainSplit)
    .filter(Boolean);
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
  if (typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(dateString)) {
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

function serveStatic(pathname, response) {
  const fileName = publicFiles.get(pathname);
  if (!fileName) {
    return sendText(response, 404, "Not found", "text/plain; charset=utf-8");
  }

  const filePath = path.join(rootDir, fileName);
  const file = fs.readFileSync(filePath);
  return sendBinary(response, 200, file, contentType(fileName));
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
    if (key) {
      process.env[key] = value;
    }
  }
}

function normalizeModel(candidate) {
  return ALLOWED_MODELS.includes(candidate) ? candidate : DEFAULT_MODEL;
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
      // Continue to next parse candidate.
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

  if (candidate === "CARDIO" || candidate.includes("RECOVERY") || candidate.includes("CARDIO") || candidate.includes("REST")) {
    return "RECOVERY";
  }

  return "";
}

function sendJson(response, statusCode, payload) {
  return sendText(response, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function sendText(response, statusCode, body, type) {
  response.writeHead(statusCode, { "Content-Type": type });
  response.end(body);
}

function sendBinary(response, statusCode, body, type) {
  response.writeHead(statusCode, { "Content-Type": type });
  response.end(body);
}
