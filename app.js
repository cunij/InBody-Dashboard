const SETTINGS_KEY = "inbody-tracker-settings";
const LEGACY_RECORDS_KEY = "inbody-tracker-records";
const LEGACY_WORKOUTS_KEY = "inbody-workouts";
const LEGACY_PROFILE_KEY = "inbody-profile";
const LEGACY_MIGRATION_FLAG = "inbody-legacy-migrated";
const ALLOWED_MODELS = [
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1",
  "gpt-4o",
];
const DEFAULT_MODEL = "gpt-5";
const MAIN_WORKOUT_SPLITS = ["PULL", "PUSH", "LEG"];
const WORKOUT_TYPES = ["PULL", "PUSH", "LEG", "CARDIO"];
const WORKOUT_LOOKBACK_DAYS = 14;
const DEFAULT_PROFILE = `## 1. Basic Profile

- Height: 180 cm
- Weight: ~78 kg (벌크업 진행 중, 최근 75~78kg 변동)
- Skeletal Muscle Mass: 40.6 kg
- Goal: 근비대 중심 벌크업

## 2. Training Routine

- Training frequency: 거의 매일 웨이트 트레이닝
- Typical workout time: 약 1~1.5시간
- Training style:
  - 대부분 failure 근처까지 수행
  - 가슴: 약 12 sets
  - 어깨: 약 8 sets
  - 삼두: 약 5 sets
- Training time: 아침 운동

## 3. Daily Schedule

- Wake: 06:00
- Sleep: 22:00
- Meals: 하루 5끼
- Example:
  - 06:00: 밥 200g, 닭가슴살 100g, 카페인 200mg
  - 07:00-08:30: 웨이트 트레이닝
  - 09:00: 학식
  - 12:00: 학식
  - 18:00: 버거킹 와퍼 세트
  - 21:00: 밥 200g, 닭가슴살 100g

## 4. Nutrition Strategy

- 목표: 칼로리 surplus 유지
- 단백질: 충분히 섭취
- 탄수화물: 추가로 늘리는 중
- 식사 빈도: 5 meals/day

## 5. Supplements

- Creatine
- Beta-alanine
- Caffeine (pre-workout)
- Probiotics
- L-arginine (가끔)

## 6. Lifestyle Priorities

- 루틴 안정성을 매우 중요하게 생각함
- 운동 루틴 유지가 삶의 중심
- 수면 8시간 확보
- 사회 활동(술자리 등)은 선호하지 않음`;

const form = document.getElementById("inbody-form");
const historyBody = document.getElementById("history-body");
const latestSummary = document.getElementById("latest-summary");
const analysisOutput = document.getElementById("analysis-output");
const routineOutput = document.getElementById("routine-output");
const modelSelect = document.getElementById("model");
const serverStatus = document.getElementById("server-status");
const themeToggle = document.getElementById("theme-toggle");
const profileText = document.getElementById("profile-text");
const profileStatus = document.getElementById("profile-status");
const profilePanel = document.querySelector(".profile-panel");
const toggleProfileEditorButton = document.getElementById(
  "toggle-profile-editor",
);
const saveProfileButton = document.getElementById("save-profile");

const workoutSummary = document.getElementById("workout-summary");
const calendarMonth = document.getElementById("calendar-month");
const calendarGrid = document.getElementById("calendar-grid");
const calendarPrev = document.getElementById("calendar-prev");
const calendarNext = document.getElementById("calendar-next");
const selectedWorkoutDateLabel = document.getElementById(
  "selected-workout-date",
);
const workoutTypeButtons = Array.from(
  document.querySelectorAll("[data-workout-type]"),
);
const saveWorkoutButton = document.getElementById("save-workout");
const deleteWorkoutButton = document.getElementById("delete-workout");
const workoutEditorStatus = document.getElementById("workout-editor-status");

const chartModal = document.getElementById("chart-modal");
const chartModalBackdrop = document.getElementById("chart-modal-backdrop");
const chartModalClose = document.getElementById("close-chart-modal");
const chartModalTitle = document.getElementById("chart-modal-title");
const chartModalCanvas = document.getElementById("chart-modal-canvas");
const chartModalTooltip = document.getElementById("chart-modal-tooltip");
const chartModalStage = chartModalCanvas.parentElement;

const chartElements = {
  weight: {
    card: document.querySelector('[data-metric="weight"]'),
    stage: document.querySelector('[data-stage="weight"]'),
    canvas: document.getElementById("weight-chart"),
    tooltip: document.querySelector('[data-tooltip-for="weight"]'),
  },
  bodyFat: {
    card: document.querySelector('[data-metric="bodyFat"]'),
    stage: document.querySelector('[data-stage="bodyFat"]'),
    canvas: document.getElementById("bodyfat-chart"),
    tooltip: document.querySelector('[data-tooltip-for="bodyFat"]'),
  },
  muscle: {
    card: document.querySelector('[data-metric="muscle"]'),
    stage: document.querySelector('[data-stage="muscle"]'),
    canvas: document.getElementById("muscle-chart"),
    tooltip: document.querySelector('[data-tooltip-for="muscle"]'),
  },
};

const metricConfig = {
  weight: { label: "체중", unit: "kg", color: "#f59e0b" },
  bodyFat: { label: "체지방률", unit: "%", color: "#ef4444" },
  muscle: { label: "골격근량", unit: "kg", color: "#10b981" },
};

const ROUTINE_TEMPLATES = {
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
    { name: "리어 델트 플라이", sets: "3세트", reps: "12~15회" },
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
    { name: "복근 또는 코어 드릴", sets: "3세트", reps: "10~15회" },
  ],
};

let records = [];
let workouts = {};
let profileContent = DEFAULT_PROFILE;
let serverConfig = {
  hasApiKey: false,
  defaultModel: DEFAULT_MODEL,
};
let isProfileEditing = false;
let selectedWorkoutDate = getTodayLocalDate();
let currentCalendarDate = getMonthAnchor(selectedWorkoutDate);
let chartStates = {
  weight: createEmptyChartState("weight"),
  bodyFat: createEmptyChartState("bodyFat"),
  muscle: createEmptyChartState("muscle"),
};
let modalChartState = createEmptyChartState("");
let activeModalMetric = "";
let modalHideTimer = 0;

bootstrap();

async function bootstrap() {
  document.getElementById("date").value = getTodayLocalDate();
  applySavedTheme();
  renderServerStatus("loading");
  renderModelOptions(ALLOWED_MODELS, normalizeModel(loadSettings().model));
  renderProfile();
  renderAll();
  bindEvents();
  await loadServerConfig();
  await loadPersistedData();
  await loadModelOptions();
}

function bindEvents() {
  form.addEventListener("submit", handleSubmit);
  document
    .getElementById("reset-storage")
    .addEventListener("click", resetStorage);
  document
    .getElementById("save-model-settings")
    .addEventListener("click", saveSettings);
  document
    .getElementById("run-analysis")
    .addEventListener("click", generateAnalysis);
  themeToggle.addEventListener("click", toggleTheme);
  toggleProfileEditorButton.addEventListener("click", toggleProfileEditor);
  saveProfileButton.addEventListener("click", saveProfile);
  profileText.addEventListener("input", () => setProfileStatus("edited"));

  calendarPrev.addEventListener("click", () => shiftCalendarMonth(-1));
  calendarNext.addEventListener("click", () => shiftCalendarMonth(1));
  workoutTypeButtons.forEach((button) => {
    button.addEventListener("click", () =>
      toggleWorkoutType(button.dataset.workoutType),
    );
  });
  saveWorkoutButton.addEventListener("click", saveWorkoutEntry);
  deleteWorkoutButton.addEventListener("click", deleteWorkoutEntry);

  Object.entries(chartElements).forEach(([metricKey, elements]) => {
    elements.card.addEventListener("click", () => openChartModal(metricKey));
    elements.card.addEventListener("keydown", (event) =>
      handleChartKeydown(event, metricKey),
    );
    elements.canvas.addEventListener("pointermove", (event) =>
      handleChartPointerMove(metricKey, event),
    );
    elements.canvas.addEventListener("pointerleave", () =>
      hideTooltip(elements.tooltip),
    );
  });

  chartModalClose.addEventListener("click", () => closeChartModal());
  chartModalBackdrop.addEventListener("click", () => closeChartModal());
  chartModalCanvas.addEventListener("pointermove", handleModalPointerMove);
  chartModalCanvas.addEventListener("pointerleave", () =>
    hideTooltip(chartModalTooltip),
  );
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("resize", handleWindowResize);
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveSettingsData(nextSettings) {
  const merged = {
    ...loadSettings(),
    ...nextSettings,
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

async function loadPersistedData() {
  try {
    const payload = await apiFetchJson("/api/data");
    const remoteProfile =
      typeof payload.profile === "string" && payload.profile.trim()
        ? payload.profile
        : "";
    records = sanitizeRecords(payload.records);
    workouts = sanitizeWorkouts(payload.workouts);
    profileContent = remoteProfile || DEFAULT_PROFILE;
    if (
      records.length === 0 &&
      Object.keys(workouts).length === 0 &&
      !remoteProfile &&
      shouldRunLegacyMigration()
    ) {
      const migrated = await migrateLegacyLocalData();
      if (migrated) {
        return loadPersistedData();
      }
    }
    renderProfile();
    renderAll();
  } catch (error) {
    records = [];
    workouts = {};
    profileContent = DEFAULT_PROFILE;
    renderProfile();
    renderAll();
    analysisOutput.textContent = `저장된 데이터를 불러오지 못했습니다: ${error.message}`;
    console.error(error);
  }
}

async function apiFetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload;
}

function shouldRunLegacyMigration() {
  if (localStorage.getItem(LEGACY_MIGRATION_FLAG) === "done") {
    return false;
  }

  const legacyRecords = localStorage.getItem(LEGACY_RECORDS_KEY);
  const legacyWorkouts = localStorage.getItem(LEGACY_WORKOUTS_KEY);
  const legacyProfile = localStorage.getItem(LEGACY_PROFILE_KEY);

  return Boolean(legacyRecords || legacyWorkouts || legacyProfile);
}

async function migrateLegacyLocalData() {
  const legacyRecords = sanitizeRecords(readLegacyJson(LEGACY_RECORDS_KEY, []));
  const legacyWorkouts = sanitizeWorkouts(readLegacyJson(LEGACY_WORKOUTS_KEY, {}));
  const legacyProfile = String(localStorage.getItem(LEGACY_PROFILE_KEY) || "").trim();

  if (
    legacyRecords.length === 0 &&
    Object.keys(legacyWorkouts).length === 0 &&
    !legacyProfile
  ) {
    localStorage.setItem(LEGACY_MIGRATION_FLAG, "done");
    return false;
  }

  for (const record of legacyRecords) {
    await apiFetchJson("/api/records", {
      method: "POST",
      body: JSON.stringify(record),
    });
  }

  for (const [date, workout] of Object.entries(legacyWorkouts)) {
    await apiFetchJson(`/api/workouts/${encodeURIComponent(date)}`, {
      method: "PUT",
      body: JSON.stringify(workout),
    });
  }

  if (legacyProfile) {
    await apiFetchJson("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ profile: legacyProfile }),
    });
  }

  localStorage.setItem(LEGACY_MIGRATION_FLAG, "done");
  analysisOutput.textContent = "예전 브라우저 데이터를 DB로 옮겼습니다.";
  return true;
}

function readLegacyJson(key, fallbackValue) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallbackValue));
  } catch {
    return fallbackValue;
  }
}

function sanitizeRecords(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const normalizedDate = normalizeDateValue(entry.date);
      return {
        id: String(entry.id || "").trim(),
        date: normalizedDate,
        weight: Number(entry.weight),
        bodyFat: Number(entry.bodyFat),
        muscle: Number(entry.muscle),
        createdAt: Number.isFinite(Number(entry.createdAt))
          ? Number(entry.createdAt)
          : Date.now(),
      };
    })
    .filter(
      (entry) =>
        entry.id &&
        isDateString(entry.date) &&
        [entry.weight, entry.bodyFat, entry.muscle].every(Number.isFinite),
    )
    .sort(sortByDate);
}

function sanitizeWorkouts(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const normalized = {};
  Object.entries(raw).forEach(([date, entry]) => {
    const normalizedDate = normalizeDateValue(date);
    if (!normalizedDate || !entry || typeof entry !== "object") {
      return;
    }

    if (
      typeof entry.split === "string" &&
      MAIN_WORKOUT_SPLITS.includes(entry.split)
    ) {
      normalized[normalizedDate] = { mainSplit: entry.split, cardio: false };
      return;
    }

    const mainSplit =
      typeof entry.mainSplit === "string" &&
      MAIN_WORKOUT_SPLITS.includes(entry.mainSplit)
        ? entry.mainSplit
        : null;
    const cardio = Boolean(entry.cardio);

    if (!mainSplit && !cardio) {
      return;
    }

    normalized[normalizedDate] = { mainSplit, cardio };
  });

  return normalized;
}

function loadProfile() {
  return profileContent || DEFAULT_PROFILE;
}

async function saveProfile() {
  const nextProfile = profileText.value.trim() || DEFAULT_PROFILE;
  try {
    const payload = await apiFetchJson("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ profile: nextProfile }),
    });
    profileContent = payload.profile || nextProfile;
    profileText.value = profileContent;
    setProfileStatus("saved");
    setProfileEditing(false);
    analysisOutput.textContent = "생활 방식과 목표를 저장했습니다.";
  } catch (error) {
    analysisOutput.textContent = `프로필 저장 실패: ${error.message}`;
    console.error(error);
  }
}

function renderProfile() {
  profileText.value = loadProfile();
  setProfileEditing(false);
  setProfileStatus("saved");
}

function setProfileStatus(state) {
  if (state === "saved") {
    profileStatus.textContent = "저장됨";
    profileStatus.className = "save-state is-saved";
    return;
  }

  profileStatus.textContent = "수정 중";
  profileStatus.className = "save-state is-edited";
}

function toggleProfileEditor() {
  setProfileEditing(!isProfileEditing);
  if (isProfileEditing) {
    profileText.focus();
    profileText.setSelectionRange(
      profileText.value.length,
      profileText.value.length,
    );
  }
}

function setProfileEditing(nextEditing) {
  isProfileEditing = nextEditing;
  profilePanel.classList.toggle("is-editing", nextEditing);
  profileText.readOnly = !nextEditing;
  toggleProfileEditorButton.textContent = nextEditing ? "접기" : "수정하기";
}

function applySavedTheme() {
  const savedTheme = loadSettings().theme;
  const preferredTheme =
    savedTheme ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");

  applyTheme(preferredTheme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "화이트 모드" : "다크 모드";
}

function toggleTheme() {
  const currentTheme =
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  saveSettingsData({ theme: nextTheme, model: getSelectedModel() });
  renderCharts();
}

function saveSettings() {
  saveSettingsData({ model: getSelectedModel() });
  analysisOutput.textContent = "모델 설정을 저장했습니다.";
}

function renderServerStatus(status, message = "") {
  if (status === "connected") {
    serverStatus.innerHTML =
      '<span class="status-pill is-connected"><span class="status-icon">&#10003;</span><span>API 연결</span></span>';
    return;
  }

  if (status === "loading") {
    serverStatus.textContent = message || "서버 설정을 확인하고 있습니다...";
    return;
  }

  serverStatus.textContent = message;
}

async function loadServerConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) {
      throw new Error(`Config request failed: ${response.status}`);
    }

    serverConfig = await response.json();
    serverConfig.defaultModel = normalizeModel(serverConfig.defaultModel);
    renderModelOptions(ALLOWED_MODELS, normalizeModel(loadSettings().model));

    if (serverConfig.hasApiKey) {
      renderServerStatus("connected");
    } else {
      renderServerStatus(
        "disconnected",
        ".env에 OPENAI_API_KEY가 없습니다. AI 호출 대신 로컬 평가만 동작합니다.",
      );
    }
  } catch (error) {
    renderServerStatus(
      "error",
      "서버 설정을 읽지 못했습니다. 파일을 직접 열지 말고 Node 서버로 실행해야 합니다.",
    );
    console.error(error);
  }
}

async function loadModelOptions() {
  if (!serverConfig.hasApiKey) {
    renderModelOptions(ALLOWED_MODELS, normalizeModel(loadSettings().model));
    return;
  }

  try {
    const response = await fetch("/api/models");
    if (!response.ok) {
      throw new Error(`Models request failed: ${response.status}`);
    }

    const payload = await response.json();
    const models =
      Array.isArray(payload.models) && payload.models.length
        ? payload.models
        : ALLOWED_MODELS;
    renderModelOptions(models, normalizeModel(loadSettings().model, models));
    renderServerStatus("connected");
  } catch (error) {
    renderModelOptions(ALLOWED_MODELS, normalizeModel(loadSettings().model));
    renderServerStatus("connected");
    console.error(error);
  }
}

function renderModelOptions(models, selectedModel) {
  const options = uniqueModels(models).filter((model) =>
    ALLOWED_MODELS.includes(model),
  );
  const finalOptions = options.length ? options : ALLOWED_MODELS;

  modelSelect.innerHTML = finalOptions
    .map((model) => `<option value="${model}">${model}</option>`)
    .join("");

  modelSelect.value = normalizeModel(selectedModel, finalOptions);
}

function uniqueModels(models) {
  return [...new Set(models.filter(Boolean))];
}

function normalizeModel(candidate, allowedModels = ALLOWED_MODELS) {
  if (allowedModels.includes(candidate)) {
    return candidate;
  }

  if (allowedModels.includes(DEFAULT_MODEL)) {
    return DEFAULT_MODEL;
  }

  return allowedModels[0] || DEFAULT_MODEL;
}

function getSelectedModel() {
  return normalizeModel(
    modelSelect.value,
    Array.from(modelSelect.options).map((option) => option.value),
  );
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const entry = {
    id: crypto.randomUUID(),
    date: formData.get("date"),
    weight: Number(formData.get("weight")),
    bodyFat: Number(formData.get("bodyFat")),
    muscle: Number(formData.get("muscle")),
    createdAt: Date.now(),
  };

  if (
    !entry.date ||
    [entry.weight, entry.bodyFat, entry.muscle].some(Number.isNaN)
  ) {
    analysisOutput.textContent = "입력값을 다시 확인하세요.";
    return;
  }

  try {
    const payload = await apiFetchJson("/api/records", {
      method: "POST",
      body: JSON.stringify(entry),
    });
    records = [
      ...records.filter((record) => record.date !== payload.record.date),
      payload.record,
    ].sort(sortByDate);
    renderAll();
    form.reset();
    document.getElementById("date").value = getTodayLocalDate();
    analysisOutput.textContent =
      "기록을 저장했습니다. 평가 생성 버튼으로 최신 상태를 다시 확인하세요.";
  } catch (error) {
    analysisOutput.textContent = `기록 저장 실패: ${error.message}`;
    console.error(error);
  }
  return;

  records = [
    ...records.filter((record) => record.date !== entry.date),
    entry,
  ].sort(sortByDate);
  saveRecords();
  renderAll();
  form.reset();
  document.getElementById("date").value = getTodayLocalDate();
  analysisOutput.textContent =
    "기록을 저장했습니다. 평가 생성 버튼으로 해석을 확인할 수 있습니다.";
}

async function resetStorage() {
  const confirmed = window.confirm("저장된 모든 인바디 기록을 삭제할까요?");
  if (!confirmed) {
    return;
  }

  try {
    await apiFetchJson("/api/records", {
      method: "DELETE",
    });
    records = [];
    renderAll();
    closeChartModal({ immediate: true });
    analysisOutput.textContent = "모든 인바디 기록을 삭제했습니다.";
  } catch (error) {
    analysisOutput.textContent = `기록 전체 삭제 실패: ${error.message}`;
    console.error(error);
  }
  return;

  records = [];
  saveRecords();
  renderAll();
  closeChartModal({ immediate: true });
  analysisOutput.textContent = "모든 인바디 기록을 삭제했습니다.";
}

async function deleteRecord(id) {
  try {
    await apiFetchJson(`/api/records/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    records = records.filter((record) => record.id !== id);
    renderAll();
    analysisOutput.textContent = "선택한 기록을 삭제했습니다.";
  } catch (error) {
    analysisOutput.textContent = `기록 삭제 실패: ${error.message}`;
    console.error(error);
  }
  return;

  records = records.filter((record) => record.id !== id);
  saveRecords();
  renderAll();
  analysisOutput.textContent = "선택한 기록을 삭제했습니다.";
}

function renderAll() {
  renderLatestSummary();
  renderHistoryTable();
  renderWorkoutSummary();
  renderWorkoutCalendar();
  renderWorkoutEditor();
  renderCharts();
}

function renderLatestSummary() {
  if (records.length === 0) {
    latestSummary.className = "summary-content empty";
    latestSummary.textContent = "아직 기록이 없습니다. 첫 측정값을 입력하세요.";
    return;
  }

  const latest = getSortedRecordsDesc()[0];
  latestSummary.className = "summary-content";
  latestSummary.innerHTML = `
    <div class="summary-grid">
      <div class="summary-stat">
        <span>최근 날짜</span>
        <strong>${formatDate(latest.date)}</strong>
      </div>
      <div class="summary-stat">
        <span>체중</span>
        <strong>${latest.weight.toFixed(1)}kg</strong>
      </div>
      <div class="summary-stat">
        <span>체지방률</span>
        <strong>${latest.bodyFat.toFixed(1)}%</strong>
      </div>
      <div class="summary-stat">
        <span>골격근량</span>
        <strong>${latest.muscle.toFixed(1)}kg</strong>
      </div>
    </div>
  `;
}

function renderHistoryTable() {
  const sorted = getSortedRecordsDesc();
  if (sorted.length === 0) {
    historyBody.innerHTML =
      '<tr><td colspan="5" class="empty-row">저장된 기록이 없습니다.</td></tr>';
    return;
  }

  historyBody.innerHTML = sorted
    .map(
      (record) => `
        <tr>
          <td>${formatDate(record.date)}</td>
          <td>${record.weight.toFixed(1)}kg</td>
          <td>${record.bodyFat.toFixed(1)}%</td>
          <td>${record.muscle.toFixed(1)}kg</td>
          <td>
            <button type="button" class="ghost delete-row" data-id="${record.id}">삭제</button>
          </td>
        </tr>
      `,
    )
    .join("");

  historyBody.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.id));
  });
}

function renderWorkoutSummary() {
  const recent = getRecentWorkoutEntries(10);
  workoutSummary.textContent = `최근 10일 중 ${recent.length}일 운동`;
}

function renderWorkoutCalendar() {
  calendarMonth.textContent = formatMonthLabel(currentCalendarDate);

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const today = getTodayLocalDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInCurrentMonth) / 7) * 7;
  const cells = [];

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInCurrentMonth) {
      cells.push('<div class="calendar-day-empty" aria-hidden="true"></div>');
      continue;
    }

    const dateString = toDateString(new Date(year, month, dayNumber));
    const entry = workouts[dateString];
    const classes = ["calendar-day"];

    if (dateString === selectedWorkoutDate) {
      classes.push("is-selected");
    }

    if (dateString === today) {
      classes.push("is-today");
    }

    if (entry) {
      classes.push("is-workout");

      if (entry.mainSplit) {
        classes.push(`split-${entry.mainSplit.toLowerCase()}`);
      }

      if (entry.cardio) {
        classes.push("has-cardio");
      }

      if (!entry.mainSplit && entry.cardio) {
        classes.push("split-cardio");
      }
    }

    const label = entry
      ? `<span class="calendar-day-label">${getWorkoutDisplayLabel(entry)}</span>`
      : "";
    const ariaLabel = entry
      ? `${formatDate(dateString)}, 운동함, ${getWorkoutDisplayLabel(entry)}`
      : `${formatDate(dateString)}, 운동 기록 없음`;

    cells.push(`
      <button type="button" class="${classes.join(" ")}" data-date="${dateString}" aria-label="${ariaLabel}">
        <span class="calendar-day-number">${dayNumber}</span>
        ${label}
      </button>
    `);
  }

  calendarGrid.innerHTML = cells.join("");
  calendarGrid.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () =>
      selectWorkoutDate(button.dataset.date),
    );
  });
}

function renderWorkoutEditor() {
  selectedWorkoutDateLabel.textContent = formatDate(selectedWorkoutDate);
  const entry = workouts[selectedWorkoutDate];

  setWorkoutSelection(entry || { mainSplit: null, cardio: false });
  renderWorkoutEditorState();
}

function renderWorkoutEditorState() {
  const entry = workouts[selectedWorkoutDate];
  const selected = getSelectedWorkoutDraft();

  if (entry && areWorkoutsEqual(entry, selected)) {
    workoutEditorStatus.textContent = `${formatDate(selectedWorkoutDate)}에 ${getWorkoutDisplayLabel(entry)} 운동이 기록되어 있습니다.`;
    return;
  }

  if (selected.mainSplit || selected.cardio) {
    workoutEditorStatus.textContent = `${formatDate(selectedWorkoutDate)}에 ${getWorkoutDisplayLabel(selected)} 운동을 저장할 수 있습니다.`;
    return;
  }

  workoutEditorStatus.textContent = "";
}

function selectWorkoutDate(dateString) {
  selectedWorkoutDate = dateString;
  currentCalendarDate = getMonthAnchor(dateString);
  renderWorkoutCalendar();
  renderWorkoutEditor();
}

function shiftCalendarMonth(offset) {
  currentCalendarDate = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth() + offset,
    1,
  );
  selectedWorkoutDate = toDateString(currentCalendarDate);
  renderWorkoutSummary();
  renderWorkoutCalendar();
  renderWorkoutEditor();
}

async function saveWorkoutEntry() {
  const selected = getSelectedWorkoutDraft();

  if (!selected.mainSplit && !selected.cardio) {
    try {
      await apiFetchJson(`/api/workouts/${encodeURIComponent(selectedWorkoutDate)}`, {
        method: "DELETE",
      });
      delete workouts[selectedWorkoutDate];
      renderWorkoutSummary();
      renderWorkoutCalendar();
      renderWorkoutEditor();
      analysisOutput.textContent = `${formatDate(selectedWorkoutDate)}을 운동하지 않은 날로 저장했습니다.`;
    } catch (error) {
      analysisOutput.textContent = `운동 기록 저장 실패: ${error.message}`;
      console.error(error);
    }
    return;

    delete workouts[selectedWorkoutDate];
    saveWorkouts();
    renderWorkoutSummary();
    renderWorkoutCalendar();
    renderWorkoutEditor();
    analysisOutput.textContent = `${formatDate(selectedWorkoutDate)}를 운동하지 않은 날로 저장했습니다.`;
    return;
  }

  try {
    const payload = await apiFetchJson(`/api/workouts/${encodeURIComponent(selectedWorkoutDate)}`, {
      method: "PUT",
      body: JSON.stringify(selected),
    });
    workouts[selectedWorkoutDate] = payload.workout;
    renderWorkoutSummary();
    renderWorkoutCalendar();
    renderWorkoutEditor();
    analysisOutput.textContent = `${formatDate(selectedWorkoutDate)} ${getWorkoutDisplayLabel(payload.workout)} 운동 기록을 저장했습니다.`;
  } catch (error) {
    analysisOutput.textContent = `운동 기록 저장 실패: ${error.message}`;
    console.error(error);
  }
  return;

  workouts[selectedWorkoutDate] = selected;
  saveWorkouts();
  renderWorkoutSummary();
  renderWorkoutCalendar();
  renderWorkoutEditor();
  analysisOutput.textContent = `${formatDate(selectedWorkoutDate)} ${getWorkoutDisplayLabel(selected)} 운동 기록을 저장했습니다.`;
}

async function deleteWorkoutEntry() {
  if (!workouts[selectedWorkoutDate]) {
    workoutEditorStatus.textContent = `${formatDate(selectedWorkoutDate)}에는 삭제할 운동 기록이 없습니다.`;
    setWorkoutSelection({ mainSplit: null, cardio: false });
    renderWorkoutEditorState();
    return;
  }

  try {
    await apiFetchJson(`/api/workouts/${encodeURIComponent(selectedWorkoutDate)}`, {
      method: "DELETE",
    });
    delete workouts[selectedWorkoutDate];
    renderWorkoutSummary();
    renderWorkoutCalendar();
    renderWorkoutEditor();
    analysisOutput.textContent = `${formatDate(selectedWorkoutDate)} 운동 기록을 삭제했습니다.`;
  } catch (error) {
    analysisOutput.textContent = `운동 기록 삭제 실패: ${error.message}`;
    console.error(error);
  }
  return;

  delete workouts[selectedWorkoutDate];
  saveWorkouts();
  renderWorkoutSummary();
  renderWorkoutCalendar();
  renderWorkoutEditor();
  analysisOutput.textContent = `${formatDate(selectedWorkoutDate)} 운동 기록을 삭제했습니다.`;
}

function toggleWorkoutType(type) {
  if (!WORKOUT_TYPES.includes(type)) {
    return;
  }

  const selected = getSelectedWorkoutDraft();

  if (type === "CARDIO") {
    selected.cardio = !selected.cardio;
  } else {
    selected.mainSplit = selected.mainSplit === type ? null : type;
  }

  setWorkoutSelection(selected);
  renderWorkoutEditorState();
}

function setWorkoutSelection(entry) {
  workoutTypeButtons.forEach((button) => {
    const type = button.dataset.workoutType;
    const isPressed =
      type === "CARDIO" ? Boolean(entry.cardio) : entry.mainSplit === type;
    button.setAttribute("aria-pressed", isPressed ? "true" : "false");
  });
}

function getSelectedWorkoutDraft() {
  let mainSplit = null;

  workoutTypeButtons.forEach((button) => {
    const type = button.dataset.workoutType;
    if (type !== "CARDIO" && button.getAttribute("aria-pressed") === "true") {
      mainSplit = type;
    }
  });

  const cardio =
    workoutTypeButtons
      .find((button) => button.dataset.workoutType === "CARDIO")
      ?.getAttribute("aria-pressed") === "true";

  return { mainSplit, cardio };
}

function getWorkoutDisplayLabel(entry) {
  const parts = [];

  if (entry.mainSplit) {
    parts.push(entry.mainSplit);
  }

  if (entry.cardio) {
    parts.push("CARDIO");
  }

  return parts.join(" + ") || "휴식";
}

function areWorkoutsEqual(left, right) {
  return (
    left?.mainSplit === right?.mainSplit &&
    Boolean(left?.cardio) === Boolean(right?.cardio)
  );
}

function renderCharts() {
  Object.entries(chartElements).forEach(([metricKey, elements]) => {
    hideTooltip(elements.tooltip);
    chartStates[metricKey] = drawMetricChart(elements.canvas, metricKey, {
      curve: "smooth",
      ratio: 0.52,
      minHeight: 240,
      minWidth: 280,
      padding: { top: 22, right: 18, bottom: 32, left: 46 },
    });
    updateChartCardState(metricKey);
  });

  if (activeModalMetric) {
    if (chartStates[activeModalMetric]?.hasData) {
      requestAnimationFrame(() => renderActiveModalChart());
    } else {
      closeChartModal({ immediate: true });
    }
  }
}

function updateChartCardState(metricKey) {
  const elements = chartElements[metricKey];
  const isInteractive = chartStates[metricKey].hasData;

  elements.card.classList.toggle("is-interactive", isInteractive);
  elements.card.setAttribute("aria-disabled", isInteractive ? "false" : "true");
  elements.card.tabIndex = isInteractive ? 0 : -1;
}

function drawMetricChart(canvas, metricKey, options = {}) {
  const context = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(
    canvas.clientWidth || options.minWidth || 480,
    options.minWidth || 280,
  );
  const cssHeight =
    options.height ||
    Math.max(
      Math.round(cssWidth * (options.ratio ?? 0.5)),
      options.minHeight || 220,
    );
  const padding = options.padding || {
    top: 20,
    right: 16,
    bottom: 28,
    left: 42,
  };

  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = cssWidth;
  const height = cssHeight;
  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--muted")
    .trim();
  const panelStrong = getComputedStyle(document.documentElement)
    .getPropertyValue("--panel-strong")
    .trim();

  drawChartGrid(context, width, height, padding);

  const data = [...records].sort(sortByDate);
  if (data.length === 0) {
    context.fillStyle = textColor;
    context.font = '14px "SUIT", sans-serif';
    context.fillText("데이터가 없습니다.", 18, 30);
    return createEmptyChartState(metricKey);
  }

  const values = data.map((item) => item[metricKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const safeRange = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const lower = Math.max(0, min - safeRange * 0.2);
  const upper = max + safeRange * 0.2;
  const plotWidth = width - padding.left - padding.right;
  const stepX = data.length === 1 ? 0 : plotWidth / (data.length - 1);

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + stepX * index;
    const y = mapValue(
      item[metricKey],
      lower,
      upper,
      height - padding.bottom,
      padding.top,
    );
    return {
      x,
      y,
      date: item.date,
      value: item[metricKey],
      unit: metricConfig[metricKey].unit,
    };
  });

  if (points.length > 1) {
    context.strokeStyle = metricConfig[metricKey].color;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    drawLineSeries(context, points, options.curve === "smooth");
    context.stroke();
  }

  points.forEach((point) => {
    context.fillStyle = panelStrong;
    context.strokeStyle = metricConfig[metricKey].color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(point.x, point.y, 4.8, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  });

  context.fillStyle = textColor;
  context.font = '12px "SUIT", sans-serif';
  context.textAlign = "left";
  context.fillText(
    `${upper.toFixed(1)}${metricConfig[metricKey].unit}`,
    8,
    padding.top + 4,
  );
  context.fillText(
    `${lower.toFixed(1)}${metricConfig[metricKey].unit}`,
    8,
    height - padding.bottom + 4,
  );

  if (data.length === 1) {
    context.textAlign = "center";
    context.fillText(
      shortDate(data[0].date),
      padding.left + plotWidth / 2,
      height - 8,
    );
  } else {
    context.textAlign = "left";
    context.fillText(shortDate(data[0].date), padding.left, height - 8);
    context.textAlign = "right";
    context.fillText(
      shortDate(data[data.length - 1].date),
      width - padding.right,
      height - 8,
    );
  }

  context.textAlign = "left";

  return {
    metricKey,
    hasData: true,
    width,
    height,
    points,
  };
}

function drawChartGrid(context, width, height, padding) {
  const gridColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--line")
    .trim();
  const gridHeight = height - padding.top - padding.bottom;

  context.strokeStyle = gridColor;
  context.lineWidth = 1;

  for (let index = 0; index < 4; index += 1) {
    const y = padding.top + (gridHeight / 3) * index;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
  }
}

function drawLineSeries(context, points, smooth = false) {
  context.beginPath();

  if (points.length === 0) {
    return;
  }

  context.moveTo(points[0].x, points[0].y);

  if (!smooth || points.length < 3) {
    points.slice(1).forEach((point) => {
      context.lineTo(point.x, point.y);
    });
    return;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] || current;
    const afterNext = points[index + 2] || next;
    const controlPoint1X = current.x + (next.x - previous.x) / 6;
    const controlPoint1Y = current.y + (next.y - previous.y) / 6;
    const controlPoint2X = next.x - (afterNext.x - current.x) / 6;
    const controlPoint2Y = next.y - (afterNext.y - current.y) / 6;

    context.bezierCurveTo(
      controlPoint1X,
      controlPoint1Y,
      controlPoint2X,
      controlPoint2Y,
      next.x,
      next.y,
    );
  }
}

function handleChartPointerMove(metricKey, event) {
  const state = chartStates[metricKey];
  if (!state.hasData) {
    return;
  }

  const nearestPoint = findNearestPoint(
    state.points,
    event,
    chartElements[metricKey].canvas,
    18,
  );
  if (!nearestPoint) {
    hideTooltip(chartElements[metricKey].tooltip);
    return;
  }

  showTooltip(
    chartElements[metricKey].tooltip,
    chartElements[metricKey].stage,
    nearestPoint,
    metricKey,
  );
}

function handleModalPointerMove(event) {
  if (!activeModalMetric || !modalChartState.hasData) {
    return;
  }

  const nearestPoint = findNearestPoint(
    modalChartState.points,
    event,
    chartModalCanvas,
    24,
  );
  if (!nearestPoint) {
    hideTooltip(chartModalTooltip);
    return;
  }

  showTooltip(
    chartModalTooltip,
    chartModalStage,
    nearestPoint,
    activeModalMetric,
  );
}

function findNearestPoint(points, event, canvas, maxDistance) {
  const rect = canvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  let nearestPoint = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  points.forEach((point) => {
    const distance = Math.hypot(point.x - pointerX, point.y - pointerY);
    if (distance < nearestDistance) {
      nearestPoint = point;
      nearestDistance = distance;
    }
  });

  return nearestDistance <= maxDistance ? nearestPoint : null;
}

function showTooltip(tooltip, stage, point, metricKey) {
  tooltip.hidden = false;
  tooltip.classList.add("is-visible");
  tooltip.innerHTML = `
    <strong>${formatDate(point.date)}</strong>
    <span>${point.value.toFixed(1)}${metricConfig[metricKey].unit}</span>
  `;

  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  const maxLeft = Math.max(stage.clientWidth - tooltipWidth - 12, 12);
  const baseLeft = point.x + 14;
  const left = clamp(baseLeft, 12, maxLeft);
  const topAbove = point.y - tooltipHeight - 14;
  const topBelow = point.y + 14;
  const maxTop = Math.max(stage.clientHeight - tooltipHeight - 12, 12);
  const top = topAbove >= 12 ? topAbove : clamp(topBelow, 12, maxTop);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip(tooltip) {
  tooltip.hidden = true;
  tooltip.classList.remove("is-visible");
}

function hideAllChartTooltips() {
  Object.values(chartElements).forEach((elements) =>
    hideTooltip(elements.tooltip),
  );
  hideTooltip(chartModalTooltip);
}

function openChartModal(metricKey) {
  if (!chartStates[metricKey]?.hasData) {
    return;
  }

  clearTimeout(modalHideTimer);
  activeModalMetric = metricKey;
  chartModalTitle.textContent = `${metricConfig[metricKey].label} 그래프`;
  hideAllChartTooltips();
  chartModal.hidden = false;
  chartModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  requestAnimationFrame(() => {
    chartModal.classList.add("is-open");
    renderActiveModalChart();
    chartModalClose.focus();
  });
}

function renderActiveModalChart() {
  if (!activeModalMetric || chartModal.hidden) {
    return;
  }

  const availableWidth = Math.max(
    chartModalStage.clientWidth || window.innerWidth - 96,
    320,
  );
  const preferredHeight = Math.round(availableWidth * 0.5);
  const maxHeight = Math.max(window.innerHeight - 240, 260);
  const height = clamp(preferredHeight, 240, maxHeight);

  modalChartState = drawMetricChart(chartModalCanvas, activeModalMetric, {
    curve: "linear",
    height,
    minHeight: 240,
    minWidth: 0,
    padding: { top: 28, right: 24, bottom: 42, left: 58 },
  });
  hideTooltip(chartModalTooltip);
}

function closeChartModal({ immediate = false } = {}) {
  clearTimeout(modalHideTimer);
  hideTooltip(chartModalTooltip);
  chartModal.classList.remove("is-open");
  chartModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  activeModalMetric = "";
  modalChartState = createEmptyChartState("");

  if (immediate) {
    chartModal.hidden = true;
    clearCanvas(chartModalCanvas);
    return;
  }

  modalHideTimer = window.setTimeout(() => {
    chartModal.hidden = true;
    clearCanvas(chartModalCanvas);
  }, 240);
}

function handleChartKeydown(event, metricKey) {
  if (!chartStates[metricKey]?.hasData) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openChartModal(metricKey);
  }
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && !chartModal.hidden) {
    closeChartModal();
  }
}

function handleWindowResize() {
  renderWorkoutCalendar();
  renderCharts();
}

async function generateAnalysis() {
  if (records.length === 0) {
    analysisOutput.textContent = "평가할 기록이 없습니다.";
    renderRoutinePlaceholder(
      "평가를 생성하면 오늘 추천 운동 루틴이 여기에 표시됩니다.",
    );
    return;
  }

  analysisOutput.textContent = "평가를 생성하고 있습니다...";
  renderRoutineLoading();

  const latest = getSortedRecordsDesc()[0];
  const trend = buildTrendSummary();
  const profile = loadProfile();
  const recentWorkouts = getRecentWorkoutEntries(
    WORKOUT_LOOKBACK_DAYS,
    latest.date,
  );
  const fallbackRoutine = buildLocalRoutineRecommendation(
    latest,
    recentWorkouts,
  );

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getSelectedModel(),
        latest,
        trend,
        records: [...records].sort(sortByDate).slice(-8),
        profile,
        workouts: recentWorkouts,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.error ||
          errorPayload.message ||
          `Analysis request failed: ${response.status}`,
      );
    }

    const result = await response.json();
    analysisOutput.textContent = result.analysis;
    renderRoutineOutput(normalizeRoutine(result.routine) || fallbackRoutine);
  } catch (error) {
    analysisOutput.textContent = [
      `AI 호출 실패: ${error.message}`,
      "",
      buildLocalEvaluation(latest, trend),
      "",
      "서버 로그에서 같은 오류를 확인할 수 있습니다.",
    ].join("\n");
    renderRoutineOutput(fallbackRoutine, { fallback: true });
    console.error(error);
  }
}

function buildTrendSummary() {
  const data = [...records].sort(sortByDate);
  if (data.length === 1) {
    return "비교할 이전 기록이 없어 첫 기록 기준입니다.";
  }

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];

  return [
    describeDelta("체중", latest.weight - previous.weight, "kg"),
    describeDelta("체지방률", latest.bodyFat - previous.bodyFat, "%"),
    describeDelta("골격근량", latest.muscle - previous.muscle, "kg"),
  ].join(", ");
}

function buildLocalEvaluation(latest, trend) {
  const data = [...records].sort(sortByDate);
  const previous = data[data.length - 2];
  const lines = [];

  lines.push("1) 현재 상태");
  lines.push(
    `${formatDate(latest.date)} 기준 체중 ${latest.weight.toFixed(1)}kg, 체지방률 ${latest.bodyFat.toFixed(
      1,
    )}%, 골격근량 ${latest.muscle.toFixed(1)}kg입니다.`,
  );

  if (!previous) {
    lines.push("");
    lines.push("2) 추세 해석");
    lines.push("첫 기록이라 추세 판단은 아직 이릅니다.");
    lines.push("");
    lines.push("3) 다음 행동 제안");
    lines.push(
      "주 1회 같은 조건으로 3회 이상 추적하면 더 정확한 평가가 가능합니다.",
    );
    lines.push(
      "식단과 영양제 루틴도 함께 기록해두면 다음 평가에서 해석 정확도가 올라갑니다.",
    );
    return lines.join("\n");
  }

  const fatDelta = latest.bodyFat - previous.bodyFat;
  const muscleDelta = latest.muscle - previous.muscle;
  const weightDelta = latest.weight - previous.weight;

  lines.push("");
  lines.push("2) 추세 해석");
  lines.push(`${trend}.`);

  if (fatDelta < 0 && muscleDelta >= 0) {
    lines.push(
      "체지방률이 내려가고 근육량이 유지되거나 증가해 비교적 좋은 방향입니다.",
    );
  } else if (fatDelta > 0 && muscleDelta <= 0) {
    lines.push(
      "체지방률 상승과 근육량 하락이 함께 보여 관리 우선순위를 점검할 필요가 있습니다.",
    );
  } else if (Math.abs(weightDelta) < 0.3) {
    lines.push(
      "체중 변화는 작지만 체성분 비율 변화에 더 주목하는 편이 좋습니다.",
    );
  } else {
    lines.push(
      "한 번의 변화만으로 단정하기보다 다음 측정까지 같은 조건으로 추적하는 것이 안전합니다.",
    );
  }

  lines.push("");
  lines.push("3) 다음 행동 제안");
  if (muscleDelta < 0) {
    lines.push("단백질 섭취와 하체·전신 운동 빈도를 먼저 확인하세요.");
  } else if (fatDelta > 0) {
    lines.push("총 섭취 칼로리와 간식 패턴, 유산소 활동량을 함께 확인하세요.");
  } else {
    lines.push(
      "현재 패턴을 유지하면서 수면과 운동 강도의 일관성을 관리하세요.",
    );
  }
  lines.push(
    "프로필에 저장한 식단 전략과 영양제 루틴도 같이 점검하면 해석이 더 현실적입니다.",
  );

  return lines.join("\n");
}

function renderRoutineLoading() {
  routineOutput.textContent = "추천 루틴을 생성하고 있습니다...";
}

function renderRoutinePlaceholder(message) {
  routineOutput.textContent = message;
}

function renderRoutineOutput(routine, options = {}) {
  if (!routine) {
    renderRoutinePlaceholder("추천 가능한 루틴이 없습니다.");
    return;
  }

  const splitLabel = getRoutineSplitLabel(routine.recommendedSplit);
  const exercises = routine.exercises
    .map(
      (exercise) => `
        <div class="routine-item">
          <strong>${escapeHtml(exercise.name)}</strong>
          <span class="routine-item-meta">${escapeHtml(exercise.sets)} · ${escapeHtml(exercise.reps)}</span>
          ${exercise.note ? `<span class="routine-item-note">${escapeHtml(exercise.note)}</span>` : ""}
        </div>
      `
    )
    .join("");

  routineOutput.innerHTML = `
    <div class="routine-card">
      <div class="routine-head">
        <span class="routine-split">${splitLabel}</span>
        ${options.fallback ? '<span class="routine-split">로컬 추천</span>' : ""}
      </div>
      <p class="routine-reason">${escapeHtml(routine.reason)}</p>
      <div class="routine-exercises">${exercises}</div>
      ${routine.cardioNote ? `<p class="routine-cardio">${escapeHtml(routine.cardioNote)}</p>` : ""}
    </div>
  `;
}

function normalizeRoutine(routine) {
  if (!routine || typeof routine !== "object") {
    return null;
  }

  const split = normalizeRoutineSplit(routine.recommendedSplit);
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

  if (!split || !reason || exercises.length < 4) {
    return null;
  }

  return {
    recommendedSplit: split,
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

  if (candidate === "CARDIO") {
    return "RECOVERY";
  }

  return "";
}

function buildLocalRoutineRecommendation(latest, recentWorkouts) {
  const recommendedSplit = chooseRecommendedSplit(latest.date, recentWorkouts);
  const exercises = ROUTINE_TEMPLATES[recommendedSplit] || ROUTINE_TEMPLATES.PUSH;
  const recentMainSplits = recentWorkouts
    .map((workout) => workout.mainSplit)
    .filter(Boolean);
  const lastTwoSplits = recentMainSplits.slice(-2);
  const reason =
    recommendedSplit === "RECOVERY"
      ? "최근 운동 빈도가 높아 보여 강한 메인 분할보다 가벼운 회복 세션이 더 적절합니다."
      : lastTwoSplits.length
        ? `최근 ${lastTwoSplits.join(" / ")} 분할이 가까워 같은 부위를 반복하지 않는 방향으로 조정했습니다.`
        : "최근 분할 기록이 충분하지 않아 기본 벌크업 루틴 기준으로 균형 있게 추천합니다.";
  const cardioNote =
    recommendedSplit === "RECOVERY"
      ? "20~30분 정도의 가벼운 유산소와 모빌리티 위주로 마무리하세요."
      : recentWorkouts.some((workout) => workout.cardio)
        ? "마무리는 컨디션에 따라 10분 내외의 가벼운 유산소로 정리해도 됩니다."
        : "최근 유산소 기록이 적다면 마무리로 10~15분 정도의 가벼운 유산소를 추가해도 됩니다.";

  return {
    recommendedSplit,
    reason,
    exercises,
    cardioNote,
  };
}

function chooseRecommendedSplit(anchorDateString, recentWorkouts) {
  const lastFourDays = getRecentWorkoutEntries(4, anchorDateString);
  const lastThreeDays = getRecentWorkoutEntries(3, anchorDateString);

  if (lastFourDays.length >= 4 || lastThreeDays.length >= 3) {
    return "RECOVERY";
  }

  const recentMainSplits = recentWorkouts
    .map((workout) => workout.mainSplit)
    .filter(Boolean);
  const blocked = new Set(recentMainSplits.slice(-2));
  const preferredOrder = ["PUSH", "PULL", "LEG"];
  const candidate = preferredOrder.find((split) => !blocked.has(split));

  if (candidate) {
    return candidate;
  }

  return preferredOrder.find((split) => split !== recentMainSplits[recentMainSplits.length - 1]) || "PUSH";
}

function getRoutineSplitLabel(split) {
  if (split === "RECOVERY") {
    return "회복 / 가벼운 CARDIO";
  }

  return split;
}

function describeDelta(label, delta, unit) {
  const direction = delta > 0 ? "증가" : delta < 0 ? "감소" : "유지";
  const amount = Math.abs(delta).toFixed(1);
  return `${label} ${amount}${unit} ${direction}`;
}

function getRecentWorkoutEntries(days, anchorDateString = getTodayLocalDate()) {
  const anchorDate = parseDateString(anchorDateString);
  const cutoff = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    anchorDate.getDate() - (days - 1),
  );

  return Object.entries(workouts)
    .filter(([date]) => {
      const workoutDate = parseDateString(date);
      return workoutDate >= cutoff && workoutDate <= anchorDate;
    })
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, entry]) => ({
      date,
      mainSplit: entry.mainSplit,
      cardio: Boolean(entry.cardio),
      label: getWorkoutDisplayLabel(entry),
    }));
}

function createEmptyChartState(metricKey) {
  return {
    metricKey,
    hasData: false,
    width: 0,
    height: 0,
    points: [],
  };
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function formatMonthLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function getMonthAnchor(dateString) {
  const date = parseDateString(dateString);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDateString(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function normalizeDateValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (isDateString(trimmed)) {
    return trimmed;
  }

  const directDate = new Date(trimmed);
  if (!Number.isNaN(directDate.getTime())) {
    return toDateString(directDate);
  }

  return "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function mapValue(value, min, max, outMin, outMax) {
  if (max === min) {
    return (outMin + outMax) / 2;
  }

  return outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

function sortByDate(a, b) {
  return a.date.localeCompare(b.date);
}

function getSortedRecordsDesc() {
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
}

function formatDate(dateString) {
  return parseDateString(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shortDate(dateString) {
  const date = parseDateString(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getTodayLocalDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}
