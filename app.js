const SETTINGS_KEY = "inbody-tracker-settings";
const LEGACY_RECORDS_KEY = "inbody-tracker-records";
const LEGACY_WORKOUTS_KEY = "inbody-workouts";
const LEGACY_PROFILE_KEY = "inbody-profile";
const LEGACY_MIGRATION_FLAG = "inbody-legacy-migrated";
const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_FAILURE_SET_RATIO = 70;
const MAIN_WORKOUT_SPLITS = ["PULL", "PUSH", "LEG"];
const WORKOUT_TYPES = ["PULL", "PUSH", "LEG", "CARDIO"];
const WORKOUT_LOOKBACK_DAYS = 14;
const EXERCISE_LIBRARY_BY_SPLIT = {
  PULL: [
    "랫풀다운",
    "랫풀다운 (패러렐)",
    "풀업",
    "친업",
    "바벨 로우",
    "시티드 케이블 로우",
    "체스트 서포티드 로우",
    "원암 덤벨 로우",
    "페이스풀",
    "바벨 컬",
    "덤벨 컬",
    "시티드 컬",
  ],
  PUSH: [
    "벤치프레스",
    "인클라인 벤치프레스",
    "덤벨 프레스",
    "인클라인 덤벨 프레스",
    "체스트프레스",
    "바벨 숄더프레스",
    "덤벨 숄더프레스",
    "레터럴 레이즈",
    "케이블 플라이",
    "딥스",
    "트라이셉스 푸시다운",
    "오버헤드 익스텐션",
  ],
  LEG: [
    "백 스쿼트",
    "레그프레스",
    "핵스쿼트",
    "루마니안 데드리프트",
    "불가리안 스플릿 스쿼트",
    "런지",
    "레그 익스텐션",
    "레그 컬",
    "카프 레이즈",
  ],
};
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
const dateInput = document.getElementById("date");
const datePickerButton = document.getElementById("date-picker-button");
const datePickerProxy = document.getElementById("date-picker-proxy");
const historyBody = document.getElementById("history-body");
const latestSummary = document.getElementById("latest-summary");
const analysisOutput = document.getElementById("analysis-output");
const serverStatus = document.getElementById("server-status");
const analysisModelBadge = document.getElementById("analysis-model");
const analysisQueryInput = document.getElementById("analysis-query");
const themeToggle = document.getElementById("theme-toggle");
const heroStack = document.getElementById("hero-stack");
const routineDateLabel = document.getElementById("routine-date-label");
const routineBuilder = document.getElementById("routine-builder");
const routineSearchInput = document.getElementById("routine-search");
const routineSearchResults = document.getElementById("routine-search-results");
const routineItems = document.getElementById("routine-items");
const routineSummary = document.getElementById("routine-summary");
const routineEditorStatus = document.getElementById("routine-editor-status");
const editRoutineButton = document.getElementById("edit-routine");
const saveRoutineButton = document.getElementById("save-routine");
const deleteRoutineButton = document.getElementById("delete-routine");
const failureSetRatioInput = document.getElementById("failure-set-ratio");
const failureSetRatioValue = document.getElementById("failure-set-ratio-value");
const routineSplitButtons = Array.from(
  document.querySelectorAll("[data-routine-split]"),
);
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
const reducedMotionMedia = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

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
let dailyRoutines = {};
let profileContent = DEFAULT_PROFILE;
let serverConfig = {
  hasApiKey: false,
};
let isProfileEditing = false;
let selectedWorkoutDate = getTodayLocalDate();
let currentCalendarDate = getMonthAnchor(selectedWorkoutDate);
let routineDraftDate = "";
let routineDraft = createRoutineDraft({ date: selectedWorkoutDate });
let isRoutineSummaryCollapsed = false;
let chartStates = {
  weight: createEmptyChartState("weight"),
  bodyFat: createEmptyChartState("bodyFat"),
  muscle: createEmptyChartState("muscle"),
};
let modalChartState = createEmptyChartState("");
let activeModalMetric = "";
let modalHideTimer = 0;
let heroSceneFrame = 0;

bootstrap();

async function bootstrap() {
  setDateInputValue();
  applySavedTheme();
  if (analysisModelBadge) {
    analysisModelBadge.textContent = "GPT-5 mini";
  }
  if (analysisQueryInput) {
    const savedAnalysisQuery = loadSettings().analysisQuery;
    analysisQueryInput.value =
      typeof savedAnalysisQuery === "string" ? savedAnalysisQuery : "";
  }
  renderServerStatus("loading");
  renderProfile();
  renderAll();
  bindEvents();
  syncHeroScrollScene();
  await loadServerConfig();
  await loadPersistedData();
}

function bindEvents() {
  form.addEventListener("submit", handleSubmit);
  dateInput.addEventListener("blur", normalizeDateInput);
  dateInput.addEventListener("input", clearDateInputValidity);
  if (datePickerButton) {
    datePickerButton.addEventListener("click", openDatePicker);
  }
  if (datePickerProxy) {
    datePickerProxy.addEventListener("change", syncDateFromPicker);
  }
  document
    .getElementById("reset-storage")
    .addEventListener("click", resetStorage);
  document
    .getElementById("run-analysis")
    .addEventListener("click", generateAnalysis);
  if (analysisQueryInput) {
    analysisQueryInput.addEventListener("input", () =>
      saveSettingsData({ analysisQuery: analysisQueryInput.value }),
    );
  }
  themeToggle.addEventListener("click", toggleTheme);
  routineSplitButtons.forEach((button) => {
    button.addEventListener("click", () =>
      setRoutineDraftSplit(button.dataset.routineSplit),
    );
  });
  if (routineSearchInput) {
    routineSearchInput.addEventListener("input", renderRoutineSearchResults);
  }
  if (routineSearchResults) {
    routineSearchResults.addEventListener("click", handleRoutineSearchClick);
  }
  if (routineItems) {
    routineItems.addEventListener("input", handleRoutineItemInput);
    routineItems.addEventListener("click", handleRoutineItemClick);
  }
  if (failureSetRatioInput) {
    failureSetRatioInput.addEventListener("input", handleFailureSetRatioInput);
  }
  if (saveRoutineButton) {
    saveRoutineButton.addEventListener("click", saveDailyRoutine);
  }
  if (editRoutineButton) {
    editRoutineButton.addEventListener("click", openRoutineEditor);
  }
  if (deleteRoutineButton) {
    deleteRoutineButton.addEventListener("click", deleteDailyRoutine);
  }
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
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("resize", handleWindowResize);
  if (typeof reducedMotionMedia.addEventListener === "function") {
    reducedMotionMedia.addEventListener("change", syncHeroScrollScene);
  } else if (typeof reducedMotionMedia.addListener === "function") {
    reducedMotionMedia.addListener(syncHeroScrollScene);
  }
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
    dailyRoutines = sanitizeDailyRoutines(payload.dailyRoutines);
    profileContent = remoteProfile || DEFAULT_PROFILE;
    routineDraftDate = "";
    if (
      records.length === 0 &&
      Object.keys(workouts).length === 0 &&
      Object.keys(dailyRoutines).length === 0 &&
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
    dailyRoutines = {};
    profileContent = DEFAULT_PROFILE;
    routineDraftDate = "";
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
  const legacyWorkouts = sanitizeWorkouts(
    readLegacyJson(LEGACY_WORKOUTS_KEY, {}),
  );
  const legacyProfile = String(
    localStorage.getItem(LEGACY_PROFILE_KEY) || "",
  ).trim();

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
    return JSON.parse(
      localStorage.getItem(key) || JSON.stringify(fallbackValue),
    );
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

function sanitizeDailyRoutines(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const normalized = {};
  Object.entries(raw).forEach(([date, entry]) => {
    const normalizedDate = normalizeDateValue(date);
    if (!normalizedDate || !entry || typeof entry !== "object") {
      return;
    }

    const routine = sanitizeRoutineValue({
      date: normalizedDate,
      split: entry.split,
      failureSetRatio: entry.failureSetRatio,
      items: entry.items,
    });
    if (!routine) {
      return;
    }

    normalized[normalizedDate] = routine;
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
  saveSettingsData({ theme: nextTheme });
  renderCharts();
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

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const normalizedDate = normalizeDateValue(formData.get("date"));
  if (!normalizedDate) {
    dateInput.setCustomValidity("Use YYYY-MM-DD.");
    dateInput.reportValidity();
    analysisOutput.textContent = "Enter the date as YYYY-MM-DD.";
    return;
  }

  clearDateInputValidity();
  setDateInputValue(normalizedDate);
  const entry = {
    id: crypto.randomUUID(),
    date: normalizedDate,
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
    setDateInputValue();
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
  setDateInputValue();
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
  renderRoutinePanel();
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
      ? `<span class="calendar-day-label">${getCalendarWorkoutLabel(entry)}</span>`
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

function renderRoutinePanel() {
  if (
    !routineDateLabel ||
    !routineBuilder ||
    !routineSearchInput ||
    !routineSearchResults ||
    !routineItems ||
    !routineSummary ||
    !routineEditorStatus ||
    !failureSetRatioInput ||
    !failureSetRatioValue
  ) {
    return;
  }

  syncRoutineDraftWithSelectedDate();
  const savedRoutine = dailyRoutines[selectedWorkoutDate] || null;
  const isSavedDraft =
    Boolean(savedRoutine) && areRoutinesEqual(savedRoutine, routineDraft);
  const showSummary = isSavedDraft && isRoutineSummaryCollapsed;

  routineDateLabel.textContent = formatDate(selectedWorkoutDate);
  routineSearchInput.placeholder = `${routineDraft.split} 운동 검색`;
  failureSetRatioInput.value = String(routineDraft.failureSetRatio);
  failureSetRatioValue.textContent = `${routineDraft.failureSetRatio}%`;
  routineBuilder.hidden = showSummary;
  routineSummary.hidden = !showSummary;

  if (editRoutineButton) {
    editRoutineButton.hidden = !showSummary;
  }

  if (saveRoutineButton) {
    saveRoutineButton.hidden = showSummary;
  }

  routineSplitButtons.forEach((button) => {
    const isActive = button.dataset.routineSplit === routineDraft.split;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  if (showSummary) {
    renderRoutineSummary(savedRoutine);
  } else {
    routineSummary.innerHTML = "";
    renderRoutineSearchResults();
    renderRoutineItems();
  }

  renderRoutineEditorState();
}

function renderRoutineSearchResults() {
  if (!routineSearchResults) {
    return;
  }

  const query = routineSearchInput.value.trim().toLowerCase();
  const library = EXERCISE_LIBRARY_BY_SPLIT[routineDraft.split] || [];
  const matches = library
    .filter((name) => !query || name.toLowerCase().includes(query))
    .slice(0, 12);

  if (matches.length === 0) {
    routineSearchResults.innerHTML =
      '<p class="routine-search-empty">검색 결과가 없습니다.</p>';
    return;
  }

  routineSearchResults.innerHTML = matches
    .map(
      (name) => `
        <button type="button" class="routine-search-item ghost" data-add-exercise="${escapeHtml(name)}">
          <span>${escapeHtml(name)}</span>
          <span>추가</span>
        </button>
      `,
    )
    .join("");
}

function renderRoutineItems() {
  if (routineDraft.items.length === 0) {
    routineItems.innerHTML =
      '<p class="routine-empty">운동을 검색해서 하나씩 추가하세요.</p>';
    return;
  }

  routineItems.innerHTML = routineDraft.items
    .map(
      (item) => `
        <article class="routine-editor-item" data-routine-item="${item.id}">
          <div class="routine-editor-head">
            <strong data-routine-title>${escapeHtml(item.name) || "새 운동"}</strong>
            <button type="button" class="ghost routine-delete-button" data-delete-routine-item="${item.id}">삭제</button>
          </div>
          <div class="routine-editor-grid">
            <label>
              세트
              <input type="text" data-routine-field="sets" data-routine-id="${item.id}" placeholder="예: 4세트" value="${escapeHtml(item.sets)}" />
            </label>
            <label>
              횟수
              <input type="text" data-routine-field="reps" data-routine-id="${item.id}" placeholder="예: 8~10회" value="${escapeHtml(item.reps)}" />
            </label>
            <label>
              중량
              <input type="text" data-routine-field="weight" data-routine-id="${item.id}" placeholder="예: 60kg" value="${escapeHtml(item.weight)}" />
            </label>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderRoutineSummary(routine) {
  if (!routineSummary || !routine) {
    return;
  }

  const items = routine.items
    .map(
      (item) => `
        <article class="routine-summary-item">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(formatRoutineItemSummary(item))}</span>
        </article>
      `,
    )
    .join("");

  routineSummary.innerHTML = `
    <div class="routine-summary-head">
      <span class="routine-summary-pill">${escapeHtml(routine.split)}</span>
      <span class="routine-summary-pill">실패지점 세트 ${routine.failureSetRatio}%</span>
      <span class="routine-summary-pill">${routine.items.length}개 종목</span>
    </div>
    <div class="routine-summary-list">
      ${items}
    </div>
  `;
}

function formatRoutineItemSummary(item) {
  const parts = [item.sets, item.reps];
  if (item.weight) {
    parts.push(item.weight);
  }

  return parts.filter(Boolean).join(" · ");
}

function renderRoutineEditorState() {
  const savedRoutine = dailyRoutines[selectedWorkoutDate] || null;

  if (!savedRoutine && routineDraft.items.length === 0) {
    routineEditorStatus.textContent = `${formatDate(selectedWorkoutDate)} 루틴이 아직 없습니다.`;
    return;
  }

  if (!savedRoutine) {
    routineEditorStatus.textContent = `${formatDate(selectedWorkoutDate)} 루틴을 저장할 수 있습니다.`;
    return;
  }

  if (areRoutinesEqual(savedRoutine, routineDraft)) {
    routineEditorStatus.textContent = `${formatDate(selectedWorkoutDate)} 루틴이 저장되어 있습니다.`;
    return;
  }

  routineEditorStatus.textContent = `${formatDate(selectedWorkoutDate)} 루틴 수정 사항을 저장할 수 있습니다.`;
}

function syncRoutineDraftWithSelectedDate() {
  if (routineDraftDate === selectedWorkoutDate) {
    return;
  }

  loadRoutineDraft(selectedWorkoutDate);
}

function loadRoutineDraft(dateString) {
  routineDraftDate = dateString;
  if (routineSearchInput) {
    routineSearchInput.value = "";
  }
  const savedRoutine = dailyRoutines[dateString];
  if (savedRoutine) {
    routineDraft = cloneRoutine(savedRoutine);
    isRoutineSummaryCollapsed = true;
    saveSettingsData({ activeRoutineSplit: savedRoutine.split });
    return;
  }

  isRoutineSummaryCollapsed = false;
  routineDraft = createRoutineDraft({
    split: getPreferredRoutineSplit(),
  });
}

function setRoutineDraftSplit(split) {
  if (!MAIN_WORKOUT_SPLITS.includes(split)) {
    return;
  }

  syncRoutineDraftWithSelectedDate();
  isRoutineSummaryCollapsed = false;
  routineDraft.split = split;
  saveSettingsData({ activeRoutineSplit: split });
  renderRoutinePanel();
}

function openRoutineEditor() {
  isRoutineSummaryCollapsed = false;
  renderRoutinePanel();
}

function handleRoutineSearchClick(event) {
  const button = event.target.closest("[data-add-exercise]");
  if (!button) {
    return;
  }

  syncRoutineDraftWithSelectedDate();
  isRoutineSummaryCollapsed = false;
  routineDraft.items.push(createRoutineItem(button.dataset.addExercise));
  routineSearchInput.value = "";
  renderRoutinePanel();
}

function handleRoutineItemInput(event) {
  const field = event.target.dataset.routineField;
  const itemId = event.target.dataset.routineId;
  if (!field || !itemId) {
    return;
  }

  syncRoutineDraftWithSelectedDate();
  isRoutineSummaryCollapsed = false;
  const item = routineDraft.items.find((candidate) => candidate.id === itemId);
  if (!item) {
    return;
  }

  item[field] = String(event.target.value || "").trim();
  renderRoutineEditorState();
}

function handleRoutineItemClick(event) {
  const button = event.target.closest("[data-delete-routine-item]");
  if (!button) {
    return;
  }

  syncRoutineDraftWithSelectedDate();
  isRoutineSummaryCollapsed = false;
  routineDraft.items = routineDraft.items.filter(
    (item) => item.id !== button.dataset.deleteRoutineItem,
  );
  renderRoutinePanel();
}

function handleFailureSetRatioInput() {
  syncRoutineDraftWithSelectedDate();
  isRoutineSummaryCollapsed = false;
  routineDraft.failureSetRatio = Number(failureSetRatioInput.value);
  failureSetRatioValue.textContent = `${routineDraft.failureSetRatio}%`;
  renderRoutineEditorState();
}

async function saveDailyRoutine() {
  syncRoutineDraftWithSelectedDate();
  const hasIncompleteItems = routineDraft.items.some(
    (item) => !item.name.trim() || !item.sets.trim() || !item.reps.trim(),
  );
  if (hasIncompleteItems) {
    routineEditorStatus.textContent =
      "모든 운동에 종목명, 세트, 횟수를 채운 뒤 저장하세요.";
    return;
  }

  const payload = sanitizeRoutineValue({
    date: selectedWorkoutDate,
    split: routineDraft.split,
    failureSetRatio: routineDraft.failureSetRatio,
    items: routineDraft.items,
  });

  if (!payload) {
    routineEditorStatus.textContent =
      "분할을 선택하고, 세트와 횟수가 채워진 운동을 한 개 이상 추가하세요.";
    return;
  }

  try {
    const response = await apiFetchJson(
      `/api/routines/${encodeURIComponent(selectedWorkoutDate)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          split: payload.split,
          failureSetRatio: payload.failureSetRatio,
          items: payload.items,
        }),
      },
    );
    dailyRoutines[selectedWorkoutDate] = sanitizeRoutineValue(response.routine);
    loadRoutineDraft(selectedWorkoutDate);
    isRoutineSummaryCollapsed = true;
    renderRoutinePanel();
    analysisOutput.textContent = `${formatDate(selectedWorkoutDate)} 루틴을 저장했습니다.`;
  } catch (error) {
    routineEditorStatus.textContent = `루틴 저장 실패: ${error.message}`;
    console.error(error);
  }
}

async function deleteDailyRoutine() {
  const savedRoutine = dailyRoutines[selectedWorkoutDate];
  if (!savedRoutine) {
    isRoutineSummaryCollapsed = false;
    loadRoutineDraft(selectedWorkoutDate);
    renderRoutinePanel();
    return;
  }

  try {
    await apiFetchJson(
      `/api/routines/${encodeURIComponent(selectedWorkoutDate)}`,
      {
        method: "DELETE",
      },
    );
    delete dailyRoutines[selectedWorkoutDate];
    isRoutineSummaryCollapsed = false;
    loadRoutineDraft(selectedWorkoutDate);
    renderRoutinePanel();
    analysisOutput.textContent = `${formatDate(selectedWorkoutDate)} 루틴을 삭제했습니다.`;
  } catch (error) {
    routineEditorStatus.textContent = `루틴 삭제 실패: ${error.message}`;
    console.error(error);
  }
}

function selectWorkoutDate(dateString) {
  selectedWorkoutDate = dateString;
  currentCalendarDate = getMonthAnchor(dateString);
  renderWorkoutCalendar();
  renderWorkoutEditor();
  renderRoutinePanel();
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
  renderRoutinePanel();
}

async function saveWorkoutEntry() {
  const selected = getSelectedWorkoutDraft();

  if (!selected.mainSplit && !selected.cardio) {
    try {
      await apiFetchJson(
        `/api/workouts/${encodeURIComponent(selectedWorkoutDate)}`,
        {
          method: "DELETE",
        },
      );
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
    const payload = await apiFetchJson(
      `/api/workouts/${encodeURIComponent(selectedWorkoutDate)}`,
      {
        method: "PUT",
        body: JSON.stringify(selected),
      },
    );
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
    await apiFetchJson(
      `/api/workouts/${encodeURIComponent(selectedWorkoutDate)}`,
      {
        method: "DELETE",
      },
    );
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

function getCalendarWorkoutLabel(entry) {
  if (!entry) {
    return "";
  }

  if (entry.mainSplit && entry.cardio) {
    return `${entry.mainSplit}+C`;
  }

  if (entry.mainSplit) {
    return entry.mainSplit;
  }

  if (entry.cardio) {
    return "CARDIO";
  }

  return "";
}

function areWorkoutsEqual(left, right) {
  return (
    left?.mainSplit === right?.mainSplit &&
    Boolean(left?.cardio) === Boolean(right?.cardio)
  );
}

function createRoutineDraft(source = {}) {
  return {
    date: source.date || selectedWorkoutDate,
    split:
      normalizeRoutineSplitValue(source.split) || getPreferredRoutineSplit(),
    failureSetRatio:
      normalizeFailureSetRatio(source.failureSetRatio) ??
      DEFAULT_FAILURE_SET_RATIO,
    items: sanitizeRoutineItemsClient(source.items),
  };
}

function createRoutineItem(name = "") {
  return {
    id: crypto.randomUUID(),
    name,
    sets: "",
    reps: "",
    weight: "",
  };
}

function cloneRoutine(routine) {
  return {
    date: routine.date,
    split: routine.split,
    failureSetRatio: routine.failureSetRatio,
    items: routine.items.map((item) => ({ ...item })),
  };
}

function sanitizeRoutineValue(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const date =
    typeof value.date === "string" ? normalizeDateValue(value.date) : "";
  const split = normalizeRoutineSplitValue(value.split);
  const failureSetRatio = normalizeFailureSetRatio(value.failureSetRatio);
  const items = sanitizeRoutineItemsClient(value.items);

  if (!date || !split || failureSetRatio === null || items.length === 0) {
    return null;
  }

  return {
    date,
    split,
    failureSetRatio,
    items,
  };
}

function sanitizeRoutineItemsClient(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || crypto.randomUUID()),
      name: String(item.name || "").trim(),
      sets: String(item.sets || "").trim(),
      reps: String(item.reps || "").trim(),
      weight: String(item.weight || "").trim(),
    }))
    .filter((item) => item.name && item.sets && item.reps);
}

function normalizeRoutineSplitValue(value) {
  const candidate = String(value || "")
    .trim()
    .toUpperCase();
  return MAIN_WORKOUT_SPLITS.includes(candidate) ? candidate : "";
}

function normalizeFailureSetRatio(value) {
  const numeric = Number(value);
  if (
    !Number.isInteger(numeric) ||
    numeric < 0 ||
    numeric > 100 ||
    numeric % 5 !== 0
  ) {
    return null;
  }

  return numeric;
}

function areRoutinesEqual(left, right) {
  if (!left || !right) {
    return false;
  }

  if (
    left.date !== (right.date || left.date) ||
    left.split !== right.split ||
    left.failureSetRatio !== right.failureSetRatio ||
    left.items.length !== right.items.length
  ) {
    return false;
  }

  return left.items.every((item, index) => {
    const candidate = right.items[index];
    return (
      item.name === String(candidate?.name || "").trim() &&
      item.sets === String(candidate?.sets || "").trim() &&
      item.reps === String(candidate?.reps || "").trim() &&
      item.weight === String(candidate?.weight || "").trim()
    );
  });
}

function getPreferredRoutineSplit() {
  const candidate = String(loadSettings().activeRoutineSplit || "")
    .trim()
    .toUpperCase();
  return MAIN_WORKOUT_SPLITS.includes(candidate)
    ? candidate
    : MAIN_WORKOUT_SPLITS[0];
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

function handleWindowScroll() {
  if (!heroStack || !heroStack.classList.contains("is-scroll-scene")) {
    return;
  }

  queueHeroSceneUpdate();
}

function syncHeroScrollScene() {
  if (!heroStack) {
    return;
  }

  const enableScene = !reducedMotionMedia.matches;
  heroStack.classList.toggle("is-scroll-scene", enableScene);

  if (!enableScene) {
    if (heroSceneFrame) {
      cancelAnimationFrame(heroSceneFrame);
      heroSceneFrame = 0;
    }
    applyHeroSceneProgress(0);
    return;
  }

  queueHeroSceneUpdate();
}

function queueHeroSceneUpdate() {
  if (heroSceneFrame) {
    return;
  }

  heroSceneFrame = requestAnimationFrame(() => {
    heroSceneFrame = 0;
    updateHeroScrollScene();
  });
}

function updateHeroScrollScene() {
  if (!heroStack || !heroStack.classList.contains("is-scroll-scene")) {
    return;
  }

  const rect = heroStack.getBoundingClientRect();
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const scrollTop = window.scrollY || window.pageYOffset || 0;
  const sceneStart = scrollTop + rect.top;
  const sceneTravel = Math.max(rect.height * 0.58, viewportHeight * 0.52);
  const rawProgress = clamp((scrollTop - sceneStart) / sceneTravel, 0, 1);
  const titleProgress = easeOutCubic(rawProgress * 0.95);

  applyHeroSceneProgress(titleProgress);
}

function applyHeroSceneProgress(titleProgress) {
  if (!heroStack) {
    return;
  }

  heroStack.style.setProperty(
    "--hero-title-shift",
    `${Math.round(mapValue(titleProgress, 0, 1, 0, -72))}px`,
  );
}

function easeOutCubic(value) {
  return 1 - (1 - clamp(value, 0, 1)) ** 3;
}

function handleWindowResize() {
  syncHeroScrollScene();
  renderWorkoutCalendar();
  renderCharts();
}

async function generateAnalysis() {
  if (records.length === 0) {
    analysisOutput.textContent = "평가할 인바디 기록이 없습니다.";
    return;
  }

  const analysisContext = getSelectedAnalysisContext();
  if (!analysisContext) {
    analysisOutput.textContent = `${formatDate(selectedWorkoutDate)} 기준으로 평가할 인바디 기록이 없습니다. 선택 날짜 이전에 저장한 인바디 기록을 먼저 남겨주세요.`;
    return;
  }

  analysisOutput.textContent = `${formatDate(selectedWorkoutDate)} 기준 평가를 생성하고 있습니다...`;

  const { analysisDate, latest, trend, analysisRecords, recentWorkouts, routine } =
    analysisContext;
  const profile = loadProfile();
  const userQuery = analysisQueryInput?.value.trim() || "";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        analysisDate,
        latest,
        trend,
        records: analysisRecords,
        profile,
        workouts: recentWorkouts,
        routineDate: analysisDate,
        routine: routine
          ? {
              split: routine.split,
              items: routine.items,
            }
          : null,
        failureSetRatio: routine?.failureSetRatio ?? null,
        userQuery,
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
  } catch (error) {
    analysisOutput.textContent = buildLocalEvaluation({
      analysisDate,
      latest,
      trend,
      routine,
      errorMessage: error.message,
      userQuery,
    });
    console.error(error);
  }
}

function buildTrendSummaryForRecords(sortedRecords) {
  if (!sortedRecords.length) {
    return "";
  }

  if (sortedRecords.length === 1) {
    return "비교할 이전 기록이 없어 첫 기록 기준입니다.";
  }

  const latest = sortedRecords[sortedRecords.length - 1];
  const previous = sortedRecords[sortedRecords.length - 2];

  return [
    describeDelta("체중", latest.weight - previous.weight, "kg"),
    describeDelta("체지방률", latest.bodyFat - previous.bodyFat, "%"),
    describeDelta("골격근량", latest.muscle - previous.muscle, "kg"),
  ].join(", ");
}

function getSelectedAnalysisContext() {
  const analysisRecords = [...records]
    .sort(sortByDate)
    .filter((record) => record.date <= selectedWorkoutDate);
  if (!analysisRecords.length) {
    return null;
  }

  return {
    analysisDate: selectedWorkoutDate,
    latest: analysisRecords[analysisRecords.length - 1],
    trend: buildTrendSummaryForRecords(analysisRecords),
    analysisRecords: analysisRecords.slice(-8),
    recentWorkouts: getRecentWorkoutEntries(
      WORKOUT_LOOKBACK_DAYS,
      selectedWorkoutDate,
    ),
    routine: dailyRoutines[selectedWorkoutDate] || null,
  };
}

function buildLocalEvaluation({
  analysisDate,
  latest,
  trend,
  routine,
  errorMessage = "",
  userQuery = "",
}) {
  const data = [...records]
    .sort(sortByDate)
    .filter((record) => record.date <= analysisDate);
  const previous = data[data.length - 2];
  const lines = [];
  const usesPreviousRecord = latest.date !== analysisDate;

  lines.push("1) 현재 상태");
  lines.push(`${formatDate(analysisDate)} 기준 평가입니다.`);
  if (usesPreviousRecord) {
    lines.push(
      `선택 날짜 인바디 기록이 없어 ${formatDate(latest.date)} 기록을 기준 수치로 사용했습니다.`,
    );
  }
  lines.push(
    `${formatDate(latest.date)} 기록 기준 체중 ${latest.weight.toFixed(1)}kg, 체지방률 ${latest.bodyFat.toFixed(
      1,
    )}%, 골격근량 ${latest.muscle.toFixed(1)}kg입니다.`,
  );
  if (trend) {
    lines.push(`직전 변화: ${trend}.`);
  }
  if (userQuery) {
    lines.push(`추가 요청: ${userQuery}`);
  }

  if (!previous) {
    lines.push("");
    lines.push("2) 루틴 평가");
    if (routine) {
      lines.push(
        `${formatDate(analysisDate)} 저장 루틴은 ${routine.split} 분할, ${routine.items.length}개 종목, 실패지점 세트 비율 ${routine.failureSetRatio}%입니다.`,
      );
    } else {
      lines.push(
        `${formatDate(analysisDate)}에 저장된 루틴이 없어 루틴 평가는 제한적입니다.`,
      );
    }
    lines.push("");
    lines.push("3) 다음 행동 제안");
    lines.push(
      "선택 날짜 전후로 같은 조건의 인바디 기록을 2회 이상 더 남기면 변화 해석이 더 정확해집니다.",
    );
    lines.push(
      "식단과 영양제 루틴도 함께 기록해두면 다음 평가에서 해석 정확도가 올라갑니다.",
    );
    if (!routine) {
      lines.push(
        `${formatDate(analysisDate)} 루틴도 함께 저장하면 운동 구성까지 같이 볼 수 있습니다.`,
      );
    }
    if (errorMessage) {
      lines.push(`AI 호출 실패: ${errorMessage}`);
    }
    return lines.join("\n");
  }

  const fatDelta = latest.bodyFat - previous.bodyFat;
  const muscleDelta = latest.muscle - previous.muscle;

  lines.push("");
  lines.push("2) 루틴 평가");
  if (routine) {
    lines.push(
      `${formatDate(analysisDate)} 저장 루틴은 ${routine.split} 분할 ${routine.items.length}개 종목, 실패지점 수행 세트 비율 ${routine.failureSetRatio}%입니다.`,
    );
    lines.push(
      "세트 수와 반복 수, 중량이 꾸준히 기록되면 체성분 변화와 루틴 적합도를 더 명확하게 해석할 수 있습니다.",
    );
  } else {
    lines.push(
      `${formatDate(analysisDate)}에 저장된 루틴이 없어 루틴 평가는 제한적입니다.`,
    );
  }

  lines.push("");
  lines.push("3) 다음 행동 제안");
  if (muscleDelta < 0) {
    lines.push("회복 상태와 하체 포함 전체 훈련 빈도를 먼저 점검하세요.");
  } else if (fatDelta > 0) {
    lines.push("총 섭취 칼로리와 간식 빈도, 유산소 수행량을 함께 점검하세요.");
  } else {
    lines.push("현재 흐름을 유지하되 수면과 운동 강도의 일관성을 관리하세요.");
  }
  if (!routine) {
    lines.push(
      `${formatDate(analysisDate)} 루틴을 함께 저장해두면 다음 평가에서 운동 구성까지 같이 볼 수 있습니다.`,
    );
  }
  lines.push(
    "프로필에 저장한 식단 전략과 영양제 루틴도 같이 점검하면 해석이 더 현실적입니다.",
  );
  if (errorMessage) {
    lines.push(`AI 호출 실패: ${errorMessage}`);
  }

  return lines.join("\n");
}

function normalizeRoutine(routine) {
  if (!routine || typeof routine !== "object") {
    return null;
  }

  const split = normalizeRoutineSplit(routine.recommendedSplit);
  const reason =
    typeof routine.reason === "string" ? routine.reason.trim() : "";
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
  const cardioNote =
    typeof routine.cardioNote === "string" ? routine.cardioNote.trim() : "";

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
  const candidate = String(split || "")
    .trim()
    .toUpperCase();
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
  const exercises =
    ROUTINE_TEMPLATES[recommendedSplit] || ROUTINE_TEMPLATES.PUSH;
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

  return (
    preferredOrder.find(
      (split) => split !== recentMainSplits[recentMainSplits.length - 1],
    ) || "PUSH"
  );
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

function setDateInputValue(dateString = getTodayLocalDate()) {
  dateInput.value = dateString;
  if (datePickerProxy) {
    datePickerProxy.value = isDateString(dateString) ? dateString : "";
  }
  clearDateInputValidity();
}

function clearDateInputValidity() {
  dateInput.setCustomValidity("");
}

function normalizeDateInput() {
  const normalized = normalizeDateValue(dateInput.value);
  if (!normalized) {
    return;
  }

  setDateInputValue(normalized);
}

function openDatePicker() {
  if (!datePickerProxy) {
    return;
  }

  const normalized = normalizeDateValue(dateInput.value);
  datePickerProxy.value =
    normalized || datePickerProxy.value || getTodayLocalDate();

  if (typeof datePickerProxy.showPicker === "function") {
    datePickerProxy.showPicker();
    return;
  }

  datePickerProxy.focus();
  datePickerProxy.click();
}

function syncDateFromPicker() {
  if (!datePickerProxy || !datePickerProxy.value) {
    return;
  }

  setDateInputValue(datePickerProxy.value);
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

  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/u);
  if (compactMatch) {
    return buildDateString(
      Number(compactMatch[1]),
      Number(compactMatch[2]),
      Number(compactMatch[3]),
    );
  }

  const looseMatch = trimmed
    .replace(/[./]/gu, "-")
    .replace(/\s+/gu, "")
    .replace(/년/gu, "-")
    .replace(/월/gu, "-")
    .replace(/일/gu, "")
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/u);
  if (looseMatch) {
    return buildDateString(
      Number(looseMatch[1]),
      Number(looseMatch[2]),
      Number(looseMatch[3]),
    );
  }

  const directDate = new Date(trimmed);
  if (!Number.isNaN(directDate.getTime())) {
    return toDateString(directDate);
  }

  return "";
}

function buildDateString(year, month, day) {
  if (![year, month, day].every(Number.isInteger)) {
    return "";
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }

  return toDateString(date);
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

