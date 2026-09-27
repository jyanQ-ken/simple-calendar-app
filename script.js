const STORAGE_KEY = "simpleCalendarData";
const MARK_DEFS = [
  { key: "circle", symbol: "〇" },
  { key: "cross", symbol: "×" },
  { key: "heart", symbol: "♥" },
  { key: "star", symbol: "★" },
];

/* ---------- 日本の祝日を計算する ---------- */
/* 通信を行わず、この端末の中だけで祝日を判定します */
function vernalEquinoxDay(year) {
  if (year <= 1979) return 20;
  if (year <= 2099) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return 21;
}
function autumnalEquinoxDay(year) {
  if (year <= 1979) return 23;
  if (year <= 2099) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return 24;
}
function nthMonday(year, month, n) {
  const first = new Date(year, month, 1);
  const firstMonday = 1 + ((8 - first.getDay()) % 7);
  return firstMonday + (n - 1) * 7;
}

function getHolidaysForYear(year) {
  const map = {};
  const add = (month, day, name) => {
    map[dateKey(year, month, day)] = name;
  };

  add(0, 1, "元日");
  add(1, 11, "建国記念の日");
  add(1, 23, "天皇誕生日");
  add(3, 29, "昭和の日");
  add(4, 3, "憲法記念日");
  add(4, 4, "みどりの日");
  add(4, 5, "こどもの日");
  add(7, 11, "山の日");
  add(10, 3, "文化の日");
  add(10, 23, "勤労感謝の日");

  add(0, nthMonday(year, 0, 2), "成人の日");
  add(6, nthMonday(year, 6, 3), "海の日");
  add(8, nthMonday(year, 8, 3), "敬老の日");
  add(9, nthMonday(year, 9, 2), "スポーツの日");

  add(2, vernalEquinoxDay(year), "春分の日");
  add(8, autumnalEquinoxDay(year), "秋分の日");

  // 国民の休日: 前日と翌日がともに祝日で、その日自体が祝日でも日曜でもない場合、休日にする
  const baseKeys = Object.keys(map);
  baseKeys.forEach(key => {
    const d = new Date(key);
    const between = new Date(d);
    between.setDate(between.getDate() + 1);
    const betweenKey = dateKey(between.getFullYear(), between.getMonth(), between.getDate());
    const after = new Date(between);
    after.setDate(after.getDate() + 1);
    const afterKey = dateKey(after.getFullYear(), after.getMonth(), after.getDate());
    if (!map[betweenKey] && map[afterKey] && between.getDay() !== 0) {
      map[betweenKey] = "国民の休日";
    }
  });

  // 振替休日: 祝日が日曜のとき、次の平日を休日にする
  Object.keys(map).forEach(key => {
    const d = new Date(key);
    if (d.getDay() === 0) {
      let next = new Date(d);
      do {
        next.setDate(next.getDate() + 1);
      } while (map[dateKey(next.getFullYear(), next.getMonth(), next.getDate())]);
      map[dateKey(next.getFullYear(), next.getMonth(), next.getDate())] = "振替休日";
    }
  });

  return map;
}

const holidayCache = {};
function holidayNameFor(key) {
  const year = Number(key.slice(0, 4));
  if (!holidayCache[year]) holidayCache[year] = getHolidaysForYear(year);
  return holidayCache[year][key] || null;
}

/* ---------- データ保存 ---------- */
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function dateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
function getDayData(data, key) {
  const raw = data[key] || {};
  const marks = {};
  MARK_DEFS.forEach(def => { marks[def.key] = !!(raw.marks && raw.marks[def.key]); });
  return { memo: raw.memo || "", marks };
}

/* ---------- カレンダー表示 ---------- */
let currentYear, currentMonth, selectedKey = null;

const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

function renderCalendar() {
  monthLabel.textContent = `${currentYear}年 ${currentMonth + 1}月`;
  calendarGrid.innerHTML = "";

  const data = loadData();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  for (let i = 0; i < firstDayOfWeek; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKey(currentYear, currentMonth, day);
    const dow = new Date(currentYear, currentMonth, day).getDay();
    const holidayName = holidayNameFor(key);
    const dayData = getDayData(data, key);

    const cell = document.createElement("div");
    cell.className = "day-cell"
      + (dow === 0 ? " sunday" : "")
      + (dow === 6 ? " saturday" : "")
      + (holidayName ? " holiday" : "")
      + (key === todayKey ? " today" : "");

    const numberEl = document.createElement("div");
    numberEl.className = "day-number";
    numberEl.textContent = day;
    cell.appendChild(numberEl);

    if (holidayName) {
      const label = document.createElement("div");
      label.className = "holiday-label";
      label.textContent = holidayName;
      cell.appendChild(label);
    }

    const activeMarks = MARK_DEFS.filter(def => dayData.marks[def.key]);
    if (activeMarks.length > 0) {
      const markLine = document.createElement("div");
      markLine.className = "mark-line";
      markLine.textContent = activeMarks.map(def => def.symbol).join("");
      cell.appendChild(markLine);
    }

    if (dayData.memo && dayData.memo.trim() !== "") {
      const dot = document.createElement("div");
      dot.className = "memo-dot";
      cell.appendChild(dot);
    }

    cell.addEventListener("click", () => openPanel(key));
    calendarGrid.appendChild(cell);
  }
}

prevMonthBtn.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});
nextMonthBtn.addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

/* ---------- 日付詳細パネル ---------- */
const overlay = document.getElementById("overlay");
const panel = document.getElementById("panel");
const panelDate = document.getElementById("panelDate");
const panelHoliday = document.getElementById("panelHoliday");
const closePanelBtn = document.getElementById("closePanel");
const markBtns = document.querySelectorAll(".mark-btn");
const memoText = document.getElementById("memoText");
const saveMemoBtn = document.getElementById("saveMemoBtn");
const deleteDayBtn = document.getElementById("deleteDayBtn");

function openPanel(key) {
  selectedKey = key;
  const data = loadData();
  const dayData = getDayData(data, key);
  const holidayName = holidayNameFor(key);

  panelDate.textContent = key;
  if (holidayName) {
    panelHoliday.textContent = `祝日: ${holidayName}`;
    panelHoliday.classList.remove("hidden");
  } else {
    panelHoliday.classList.add("hidden");
  }

  markBtns.forEach(btn => {
    btn.classList.toggle("active", dayData.marks[btn.dataset.mark]);
  });
  memoText.value = dayData.memo;

  overlay.classList.remove("hidden");
  panel.classList.remove("hidden");
}

function closePanel() {
  overlay.classList.add("hidden");
  panel.classList.add("hidden");
  selectedKey = null;
  renderCalendar();
}
closePanelBtn.addEventListener("click", closePanel);
overlay.addEventListener("click", closePanel);

markBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!selectedKey) return;
    btn.classList.toggle("active");
    const data = loadData();
    const dayData = getDayData(data, selectedKey);
    dayData.marks[btn.dataset.mark] = btn.classList.contains("active");
    data[selectedKey] = dayData;
    saveData(data);
  });
});

saveMemoBtn.addEventListener("click", () => {
  if (!selectedKey) return;
  const data = loadData();
  const dayData = getDayData(data, selectedKey);
  dayData.memo = memoText.value;
  data[selectedKey] = dayData;
  saveData(data);
  saveMemoBtn.textContent = "保存しました";
  setTimeout(() => { saveMemoBtn.textContent = "保存する"; }, 1000);
});

deleteDayBtn.addEventListener("click", () => {
  if (!selectedKey) return;
  const ok = confirm(`${selectedKey} のマークとメモをすべて消します。元に戻せませんが、よろしいですか?`);
  if (!ok) return;
  const data = loadData();
  delete data[selectedKey];
  saveData(data);
  closePanel();
});

/* ---------- 一覧・書き出し ---------- */
const openExportBtn = document.getElementById("openExportBtn");
const exportOverlay = document.getElementById("exportOverlay");
const exportPanel = document.getElementById("exportPanel");
const closeExportPanelBtn = document.getElementById("closeExportPanel");
const exportText = document.getElementById("exportText");
const copyExportBtn = document.getElementById("copyExportBtn");
const exportCheckboxes = document.querySelectorAll("#exportChecks input[data-export]");

function buildExportText() {
  const data = loadData();
  const keys = Object.keys(data).sort();
  const checked = key => {
    const cb = document.querySelector(`#exportChecks input[data-export="${key}"]`);
    return cb ? cb.checked : true;
  };

  const lines = [];

  if (checked("memo")) {
    const memoLines = keys
      .filter(key => data[key].memo && data[key].memo.trim() !== "")
      .map(key => `${key}: ${data[key].memo.trim()}`);
    lines.push("【予定・メモがある日】");
    lines.push(...(memoLines.length ? memoLines : ["(なし)"]));
  }

  MARK_DEFS.forEach(def => {
    if (!checked(def.key)) return;
    const markKeys = keys.filter(key => data[key].marks && data[key].marks[def.key]);
    if (lines.length > 0) lines.push("");
    lines.push(`【${def.symbol} の日】`);
    lines.push(...(markKeys.length ? markKeys : ["(なし)"]));
  });

  return lines.length ? lines.join("\n") : "(表示する項目が選ばれていません)";
}

function refreshExportText() {
  exportText.value = buildExportText();
}

exportCheckboxes.forEach(cb => cb.addEventListener("change", refreshExportText));

openExportBtn.addEventListener("click", () => {
  refreshExportText();
  exportOverlay.classList.remove("hidden");
  exportPanel.classList.remove("hidden");
});

function closeExportPanel() {
  exportOverlay.classList.add("hidden");
  exportPanel.classList.add("hidden");
}
closeExportPanelBtn.addEventListener("click", closeExportPanel);
exportOverlay.addEventListener("click", closeExportPanel);

copyExportBtn.addEventListener("click", async () => {
  exportText.select();
  try {
    await navigator.clipboard.writeText(exportText.value);
  } catch (e) {
    document.execCommand("copy");
  }
  copyExportBtn.textContent = "コピーしました";
  setTimeout(() => { copyExportBtn.textContent = "コピーする"; }, 1200);
});

/* ---------- 初期化 ---------- */
function init() {
  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();
  renderCalendar();
}
init();
