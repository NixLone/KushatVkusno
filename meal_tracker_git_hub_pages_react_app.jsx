import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Plus, Calendar as CalendarIcon, Trophy, Upload, Download, History, RefreshCw, Droplets, Coffee, ChefHat, BookOpen, Settings } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ====== Types ======
const DAYS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;

const MEAL_SLOTS = [
  { id: "breakfast", label: "Завтрак" },
  { id: "snack1", label: "Перекус" },
  { id: "lunch", label: "Обед" },
  { id: "snack2", label: "Полдник" },
  { id: "dinner", label: "Ужин" },
  { id: "late", label: "Перед сном" },
] as const;

type DayId = typeof DAYS[number];

type Category = "Блюдо" | "Напиток" | "Овощи/Фрукты" | "Прочее";

type LibraryItem = {
  id: string;
  name: string;
  category: Category;
};

type MealEntry = {
  planned?: string; // из шаблона
  chosen?: string; // выбранная альтернатива/новое
  eaten: boolean;
  notes?: string;
  category?: Category;
};

type DayMeals = Record<(typeof MEAL_SLOTS)[number]["id"], MealEntry> & {
  water: number; // 0..8
};

type WeekData = Record<DayId, DayMeals> & {
  meta: {
    weekKey: string; // ISO week key like 2025-W38
    createdAt: string;
  };
};

// ====== Utilities ======
function startOfISOWeek(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=Mon
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function getISOWeekKey(date = new Date()) {
  const tmp = new Date(date);
  // Thursday in current week decides the year.
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const weekNo =
    1 + Math.round(((+tmp - +week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function cls(...arr: (string | false | null | undefined)[]) {
  return arr.filter(Boolean).join(" ");
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ====== Default Template (from earlier plan) ======
const TEMPLATE: Record<DayId, Partial<Record<(typeof MEAL_SLOTS)[number]["id"], string>>> = {
  Понедельник: {
    breakfast: "Омлет с брокколи и зеленью",
    snack1: "Миндаль + яблоко",
    lunch: "Куриная грудка на гриле + салат + киноа",
    snack2: "Творог с ягодами",
    dinner: "Лосось запечённый + тушёные кабачки и шпинат",
  },
  Вторник: {
    breakfast: "Гречка на воде + варёное яйцо",
    snack1: "Йогурт без сахара + чиа",
    lunch: "Индейка + овощное рагу",
    snack2: "Грецкие орехи + груша",
    dinner: "Треска с лимоном + салат из капусты",
  },
  Среда: {
    breakfast: "Творог + малина + льняные семена",
    snack1: "Авокадо + 1/2 яйца",
    lunch: "Говядина тушёная с овощами",
    snack2: "Овощные палочки + орехи",
    dinner: "Котлеты куриные на пару + цветная капуста",
  },
  Четверг: {
    breakfast: "Омлет с грибами и зеленью",
    snack1: "Фундук + яблоко",
    lunch: "Суп-пюре из брокколи + куриная грудка",
    snack2: "Кефир/йогурт",
    dinner: "Хек тушёный + салат из огурцов и шпината",
  },
  Пятница: {
    breakfast: "Творожная запеканка без сахара",
    snack1: "Семена тыквы + груша",
    lunch: "Индейка в духовке + салат + булгур",
    snack2: "Йогурт с корицей",
    dinner: "Стейк лосося + запечённые овощи",
  },
  Суббота: {
    breakfast: "Гречневые блины без сахара",
    snack1: "Авокадо + огурец",
    lunch: "Куриный суп с овощами",
    snack2: "Творог с ягодами",
    dinner: "Рыба запечённая + тушёная капуста",
  },
  Воскресенье: {
    breakfast: "Омлет с шпинатом и помидорами",
    snack1: "Миндаль + яблоко",
    lunch: "Говядина тушёная с брокколи и цветной капустой",
    snack2: "Кефир/йогурт",
    dinner: "Курица запечённая с кабачками и морковью",
  },
};

const DEFAULT_LIBRARY: LibraryItem[] = [
  { id: uid(), name: "Омлет", category: "Блюдо" },
  { id: uid(), name: "Творог 5%", category: "Блюдо" },
  { id: uid(), name: "Йогурт без сахара", category: "Напиток" },
  { id: uid(), name: "Гречка", category: "Блюдо" },
  { id: uid(), name: "Лосось", category: "Блюдо" },
  { id: uid(), name: "Треска", category: "Блюдо" },
  { id: uid(), name: "Салат овощной", category: "Овощи/Фрукты" },
  { id: uid(), name: "Кофе без сахара", category: "Напиток" },
  { id: uid(), name: "Вода", category: "Напиток" },
];

// ====== Persistence ======
const LS_KEYS = {
  week: (key: string) => `mealweek:${key}`,
  lib: "meal-library",
  xp: "meal-xp",
  streak: "meal-streak",
};

function loadLibrary(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(LS_KEYS.lib);
    return raw ? JSON.parse(raw) : DEFAULT_LIBRARY;
  } catch {
    return DEFAULT_LIBRARY;
  }
}

function saveLibrary(lib: LibraryItem[]) {
  localStorage.setItem(LS_KEYS.lib, JSON.stringify(lib));
}

function newWeekData(weekKey: string): WeekData {
  const base: any = {};
  for (const day of DAYS) {
    const dm: any = { water: 0 };
    for (const slot of MEAL_SLOTS) {
      dm[slot.id] = {
        planned: TEMPLATE[day][slot.id as keyof typeof TEMPLATE[typeof day]] || undefined,
        eaten: false,
      } as MealEntry;
    }
    base[day] = dm as DayMeals;
  }
  base.meta = { weekKey, createdAt: new Date().toISOString() };
  return base as WeekData;
}

function loadWeek(weekKey: string): WeekData {
  const raw = localStorage.getItem(LS_KEYS.week(weekKey));
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const w = newWeekData(weekKey);
  localStorage.setItem(LS_KEYS.week(weekKey), JSON.stringify(w));
  return w;
}

function saveWeek(w: WeekData) {
  localStorage.setItem(LS_KEYS.week(w.meta.weekKey), JSON.stringify(w));
}

function addXP(delta: number) {
  const cur = Number(localStorage.getItem(LS_KEYS.xp) || 0);
  const next = Math.max(0, cur + delta);
  localStorage.setItem(LS_KEYS.xp, String(next));
  return next;
}

function getXP() { return Number(localStorage.getItem(LS_KEYS.xp) || 0); }

function updateStreak(todayDone: boolean) {
  const key = LS_KEYS.streak;
  const raw = localStorage.getItem(key);
  let obj = raw ? JSON.parse(raw) : { last: null as string | null, count: 0 };
  const todayKey = new Date().toDateString();
  if (todayDone) {
    if (obj.last !== todayKey) {
      if (obj.last && new Date(todayKey).getTime() - new Date(obj.last).getTime() > 86400000 * 1.5) {
        obj.count = 0; // сброс, если пропущен день
      }
      obj.count += 1;
      obj.last = todayKey;
    }
  }
  localStorage.setItem(key, JSON.stringify(obj));
  return obj.count as number;
}

function getStreak() {
  const raw = localStorage.getItem(LS_KEYS.streak);
  return raw ? (JSON.parse(raw).count as number) : 0;
}

// ====== UI Helpers ======
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cls("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100", className)}>
      {children}
    </span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cls("rounded-2xl shadow-sm bg-white p-4 border", className)}>{children}</div>;
}

function Button({ children, onClick, icon: Icon, className }: { children?: React.ReactNode; onClick?: () => void; icon?: any; className?: string }) {
  return (
    <button onClick={onClick} className={cls("inline-flex items-center gap-2 rounded-2xl px-3 py-2 border hover:shadow-sm active:scale-[0.99]", className)}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

// ====== Main App ======
export default function MealTrackerApp() {
  const [weekKey, setWeekKey] = useState(getISOWeekKey());
  const [week, setWeek] = useState<WeekData>(() => loadWeek(weekKey));
  const [library, setLibrary] = useState<LibraryItem[]>(() => loadLibrary());
  const [showLib, setShowLib] = useState(false);
  const [newItem, setNewItem] = useState<{ name: string; category: Category }>({ name: "", category: "Блюдо" });
  const [filterCat, setFilterCat] = useState<Category | "Все">("Все");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    const key = getISOWeekKey();
    if (key !== weekKey) {
      setWeekKey(key);
    }
  }, []);

  useEffect(() => {
    const w = loadWeek(weekKey);
    setWeek(w);
  }, [weekKey]);

  useEffect(() => {
    saveLibrary(library);
  }, [library]);

  useEffect(() => {
    saveWeek(week);
  }, [week]);

  const stats = useMemo(() => computeStats(week), [week]);

  // Gamification metrics
  const xp = getXP();
  const streak = getStreak();

  // Chart data
  const chartData = DAYS.map((d) => ({ day: d.slice(0, 2), value: stats.dayDoneCounts[d] || 0 }));

  function toggleEaten(day: DayId, slotId: (typeof MEAL_SLOTS)[number]["id"]) {
    setWeek((w) => {
      const next = { ...w } as WeekData;
      const entry = { ...next[day][slotId] } as MealEntry;
      entry.eaten = !entry.eaten;
      next[day] = { ...next[day], [slotId]: entry } as DayMeals;
      if (entry.eaten) {
        addXP(5);
        const doneToday = Object.values(next[day]).filter((v: any) => v && typeof v === "object" && "eaten" in v && v.eaten).length;
        if (doneToday >= 4) updateStreak(true);
      }
      return next;
    });
  }

  function chooseAlternative(day: DayId, slotId: (typeof MEAL_SLOTS)[number]["id"], itemName: string, category: Category) {
    setWeek((w) => {
      const next = { ...w } as WeekData;
      const entry = { ...next[day][slotId] } as MealEntry;
      entry.chosen = itemName;
      entry.category = category;
      next[day] = { ...next[day], [slotId]: entry } as DayMeals;
      return next;
    });
  }

  function addWater(day: DayId, delta: number) {
    setWeek((w) => {
      const next = { ...w } as WeekData;
      const v = next[day].water + delta;
      next[day].water = Math.max(0, Math.min(8, v));
      if (delta > 0) addXP(1);
      return next;
    });
  }

  function addToLibrary() {
    const name = newItem.name.trim();
    if (!name) return;
    const item: LibraryItem = { id: uid(), name, category: newItem.category };
    setLibrary((lib) => [item, ...lib]);
    setNewItem({ name: "", category: "Блюдо" });
  }

  function filteredLibrary(cat: Category | "Все") {
    return (cat === "Все" ? library : library.filter((l) => l.category === cat)).slice(0, 200);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ week, library, xp: getXP(), streak: getStreak() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meal-tracker-${week.meta.weekKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file: File) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(String(fr.result));
        if (data.library) setLibrary(data.library);
        if (data.week && data.week.meta?.weekKey) {
          setWeekKey(data.week.meta.weekKey);
          setWeek(data.week);
        }
        if (typeof data.xp === "number") localStorage.setItem(LS_KEYS.xp, String(data.xp));
        if (typeof data.streak === "number") localStorage.setItem(LS_KEYS.streak, JSON.stringify({ last: null, count: data.streak }));
      } catch (e) {
        alert("Не удалось импортировать файл");
      }
    };
    fr.readAsText(file);
  }

  function resetWeekToTemplate() {
    if (!confirm("Сбросить неделю к шаблону?")) return;
    const fresh = newWeekData(weekKey);
    setWeek(fresh);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <ChefHat className="shrink-0" />
          <div>
            <h1 className="text-xl font-bold">Трекер питания • {week.meta.weekKey}</h1>
            <p className="text-sm text-slate-600">Отмечайте, что съели. Меняйте блюда. Добавляйте свои. Смотрите прогресс по неделям.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button icon={History} onClick={() => setWeekKey(prevWeek(weekKey))}>Пред. неделя</Button>
            <Button icon={CalendarIcon} onClick={() => setWeekKey(getISOWeekKey())}>
              Текущая неделя
            </Button>
            <Button icon={RefreshCw} onClick={() => setWeekKey(nextWeek(weekKey))}>След. неделя</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Days Grid */}
        <section className="space-y-4">
          {DAYS.map((day) => (
            <Card key={day}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{day}</h2>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-50 text-emerald-800">Выполнено: {stats.dayDoneCounts[day] || 0}/6</Badge>
                  <Badge className="bg-sky-50 text-sky-800 inline-flex gap-1"><Droplets size={14}/>Вода: {week[day].water}/8</Badge>
                  <Button icon={Plus} onClick={() => addWater(day, 1)} className="text-sky-700">+ вода</Button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {MEAL_SLOTS.map((slot) => (
                  <MealRow
                    key={slot.id}
                    day={day}
                    slotId={slot.id}
                    label={slot.label}
                    entry={week[day][slot.id]}
                    onToggle={() => toggleEaten(day, slot.id)}
                    onChoose={(name, category) => chooseAlternative(day, slot.id, name, category)}
                    library={library}
                    setLibrary={setLibrary}
                    setShowLib={setShowLib}
                  />
                ))}
              </div>
            </Card>
          ))}
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-2"><Trophy /><h3 className="font-semibold">Прогресс</h3></div>
            <div className="flex gap-2 mb-2">
              <Badge className="bg-amber-50 text-amber-800">XP: {xp}</Badge>
              <Badge className="bg-violet-50 text-violet-800">Серия дней: {streak}</Badge>
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, 6]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-sm text-slate-600">Чем больше отмечаете, тем больше очков. Бонус за овощи и воду!</div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2"><BookOpen /><h3 className="font-semibold">Библиотека продуктов</h3></div>
            <div className="flex items-center gap-2 mb-2">
              <select className="border rounded-xl px-2 py-1" value={filterCat} onChange={(e) => setFilterCat(e.target.value as any)}>
                {(["Все", "Блюдо", "Напиток", "Овощи/Фрукты", "Прочее"] as const).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Button icon={Plus} onClick={() => setShowLib(true)}>Добавить</Button>
            </div>
            <div className="max-h-48 overflow-auto text-sm">
              {filteredLibrary(filterCat).map((i) => (
                <div key={i.id} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span>{i.name}</span>
                  <Badge>{i.category}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2"><Settings /><h3 className="font-semibold">Данные</h3></div>
            <div className="flex flex-wrap gap-2">
              <Button icon={Download} onClick={exportData}>Экспорт JSON</Button>
              <label className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 border hover:shadow-sm cursor-pointer">
                <Upload size={16} /> Импорт JSON
                <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files && importData(e.target.files[0])} />
              </label>
              <Button icon={RefreshCw} onClick={resetWeekToTemplate}>Сбросить неделю</Button>
            </div>
          </Card>

          <Card>
            <div className="text-sm text-slate-600">
              <p className="mb-2">Недели считаются по ISO (Пн–Вс). Можно листать прошлые/следующие недели, данные сохраняются в браузере (localStorage).</p>
              <p>Для размещения на GitHub Pages используйте любой шаблон React/Vite. Этот компонент — <em>по умолчанию экспорт</em> и готов к вставке.</p>
            </div>
          </Card>
        </aside>
      </main>

      {/* Library Modal */}
      <AnimatePresence>
        {showLib && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 grid place-items-center p-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="bg-white rounded-2xl p-4 w-full max-w-md">
              <h3 className="font-semibold mb-3">Добавить в библиотеку</h3>
              <div className="space-y-2">
                <input className="w-full border rounded-xl px-3 py-2" placeholder="Название" value={newItem.name} onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))} />
                <select className="w-full border rounded-xl px-3 py-2" value={newItem.category} onChange={(e) => setNewItem((s) => ({ ...s, category: e.target.value as Category }))}>
                  {(["Блюдо", "Напиток", "Овощи/Фрукты", "Прочее"] as const).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-2 pt-2">
                  <Button icon={X} onClick={() => setShowLib(false)}>Отмена</Button>
                  <Button icon={Plus} className="bg-slate-900 text-white border-slate-900" onClick={() => { addToLibrary(); setShowLib(false); }}>Добавить</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function prevWeek(key: string) {
  const [y, w] = key.split("-W").map(Number);
  const d = isoWeekToDate(y, w);
  d.setDate(d.getDate() - 7);
  return getISOWeekKey(d);
}

function nextWeek(key: string) {
  const [y, w] = key.split("-W").map(Number);
  const d = isoWeekToDate(y, w);
  d.setDate(d.getDate() + 7);
  return getISOWeekKey(d);
}

function isoWeekToDate(year: number, week: number) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4)
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
}

function computeStats(week: WeekData) {
  const dayDoneCounts: Record<string, number> = {};
  let total = 0;
  for (const day of DAYS) {
    const dm = week[day];
    const count = MEAL_SLOTS.reduce((acc, s) => acc + (dm[s.id].eaten ? 1 : 0), 0);
    dayDoneCounts[day] = count;
    total += count;
  }
  return { dayDoneCounts, total };
}

function MealRow({ day, slotId, label, entry, onToggle, onChoose, library, setLibrary, setShowLib }: {
  day: DayId;
  slotId: (typeof MEAL_SLOTS)[number]["id"];
  label: string;
  entry: MealEntry;
  onToggle: () => void;
  onChoose: (name: string, category: Category) => void;
  library: LibraryItem[];
  setLibrary: React.Dispatch<React.SetStateAction<LibraryItem[]>>;
  setShowLib: (v: boolean) => void;
}) {
  const [expand, setExpand] = useState(false);
  const planned = entry.planned;

  const displayed = entry.chosen || planned || "—";

  const altItems = library.slice(0, 100);

  function addCustom() {
    const name = prompt("Введите название блюда/продукта");
    if (!name) return;
    const category = (prompt("Категория: Блюдо / Напиток / Овощи/Фрукты / Прочее", "Блюдо") as Category) || "Прочее";
    const newItem = { id: uid(), name, category } as LibraryItem;
    setLibrary((lib) => [newItem, ...lib]);
    onChoose(name, category);
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="font-medium">{displayed}</div>
          {entry.chosen && planned && entry.chosen !== planned && (
            <div className="text-xs text-slate-500">(вместо: {planned})</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={cls(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 border",
              entry.eaten ? "bg-emerald-600 text-white border-emerald-600" : "hover:bg-emerald-50"
            )}
            title="Отметить съедено"
          >
            {entry.eaten ? <Check size={16} /> : <Check size={16} />}
            {entry.eaten ? "Съедено" : "Отметить"}
          </button>
          <button onClick={() => setExpand((e) => !e)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border hover:bg-slate-50" title="Заменить/выбрать другое">
            Выбрать
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expand && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {altItems.slice(0, 8).map((it) => (
                <button key={it.id} onClick={() => onChoose(it.name, it.category)} className="text-sm rounded-full px-3 py-1 border hover:bg-slate-50">
                  {it.name}
                </button>
              ))}
              <button onClick={() => setShowLib(true)} className="text-sm rounded-full px-3 py-1 border hover:bg-slate-50 inline-flex items-center gap-1">
                <Plus size={14}/> Открыть библиотеку
              </button>
              <button onClick={addCustom} className="text-sm rounded-full px-3 py-1 border hover:bg-slate-50 inline-flex items-center gap-1">
                <Plus size={14}/> Добавить новое
              </button>
            </div>
            <div className="text-xs text-slate-500">Подсказка: библиотеку можно пополнять в правой панели. Новые позиции запоминаются и будут доступны на следующих неделях.</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
