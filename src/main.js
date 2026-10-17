"use strict";

/*
 * LifeOS 2.5
 * Keeps the existing lifeos-data-v1 key. If an older lifeos-v1 backup
 * exists in localStorage, it is migrated without deleting the old key.
 */
const STORAGE_KEY = "lifeos-data-v1";
const OLD_KEYS = ["lifeos-v1", "lifeos-data"];
const THEME_KEY = "lifeos-theme-v1";
const app = document.getElementById("app");
const toastNode = document.getElementById("toast");

const today = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const shiftDate = (days, base = new Date()) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return today(d);
};
const emptyData = () => ({tasks: [], habits: [], meals: [], workouts: [], expenses: [], weightLogs: []});
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
let page = "dashboard";
let toastTimer;

function normalizeData(input) {
  const out = emptyData();
  if (!input || typeof input !== "object") return out;
  for (const key of Object.keys(out)) {
    if (Array.isArray(input[key])) out[key] = input[key].filter(x => x && typeof x === "object" && !Array.isArray(x)).map(x => ({...x, id:String(x.id || uid())}));
  }
  out.habits.forEach(h => { if (!Array.isArray(h.doneDates)) h.doneDates = []; });
  out.tasks.forEach(t => { t.done = Boolean(t.done); });
  return out;
}
function loadData() {
  for (const key of [STORAGE_KEY, ...OLD_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const source = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
      const normalized = normalizeData(source);
      const hasAny = Object.values(normalized).some(arr => arr.length);
      if (key === STORAGE_KEY || hasAny) {
        if (key !== STORAGE_KEY) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          console.info(`LifeOS migrated data from ${key}; original data was preserved.`);
        }
        return normalized;
      }
    } catch (err) {
      console.warn("Could not read saved LifeOS data from", key, err);
    }
  }
  return emptyData();
}
let data = loadData();
let theme = localStorage.getItem(THEME_KEY) || document.documentElement.dataset.theme || "dark";
if (!["dark", "light"].includes(theme)) theme = "dark";

function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function money(value) { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(num(value)); }
function dateLabel(value, options = {weekday:"short", day:"numeric"}) {
  if (!value) return "";
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, options);
}
function notify(message) {
  toastNode.textContent = message;
  toastNode.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove("show"), 2400);
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render();
  } catch (err) {
    console.error(err);
    notify("Storage failed. Export a backup and check device storage.");
  }
}
function addRecord(collection, record) {
  data[collection].push({id:uid(), ...record});
  persist();
  notify("Entry saved");
}
function field(label, name, type = "text", opts = {}) {
  const required = opts.required === false ? "" : "required";
  const value = opts.value !== undefined ? `value="${escapeHTML(opts.value)}"` : "";
  const min = opts.min !== undefined ? `min="${opts.min}"` : "";
  const step = opts.step ? `step="${opts.step}"` : "";
  const placeholder = opts.placeholder ? `placeholder="${escapeHTML(opts.placeholder)}"` : "";
  const full = opts.full ? " full" : "";
  let control;
  if (type === "select") control = `<select name="${name}" ${required}>${opts.choices.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("")}</select>`;
  else if (type === "textarea") control = `<textarea name="${name}" rows="2" ${required} ${placeholder}></textarea>`;
  else control = `<input name="${name}" type="${type}" ${required} ${value} ${min} ${step} ${placeholder}>`;
  return `<label class="field${full}"><span>${escapeHTML(label)}</span>${control}</label>`;
}
function formCard(title, formName, fields, submitLabel) {
  return `<section class="card"><h2>${title}</h2><form data-form="${formName}"><div class="form-grid">${fields.join("")}</div><div class="actions"><button class="btn primary" type="submit">＋ ${submitLabel}</button></div></form></section>`;
}
function heading(title, subtitle, right = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${right}</div>`;
}
const ICONS = {
  "✓": '<path d="m5 12 4 4L19 6"/>',
  "◉": '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  "✳": '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8m0-12.8L5.6 18.4"/>',
  "₹": '<path d="M5 5h14M5 9h14M8 5c7 0 7 7 0 7l8 7"/>',
  "↗": '<path d="M7 17 17 7M8 7h9v9"/>',
  "📦": '<path d="m12 3 8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10"/>',
  "＋": '<path d="M12 5v14M5 12h14"/>'
};
function icon(symbol, extraClass = "") {
  const path = ICONS[symbol] || ICONS["✓"];
  return `<svg class="ui-icon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}
function stat(title, value, foot, symbol) {
  return `<section class="card stat-card"><div class="stat-top"><span class="stat-icon">${icon(symbol)}</span><span class="stat-label">${title}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></section>`;
}
function empty(message) { return `<div class="empty">${message}</div>`; }
function list(items, content, collection, actions = "") {
  if (!items.length) return empty("Nothing here yet. Add your first entry above.");
  return `<div class="list">${items.slice().reverse().map(item => `<div class="list-item ${item.done ? "done" : ""}"><div class="item-main">${content(item)}</div><div class="item-actions">${actions ? actions(item) : ""}<button class="btn small danger" type="button" data-delete="${collection}" data-id="${escapeHTML(item.id)}">Delete</button></div></div>`).join("")}</div>`;
}
function taskList(items) {
  return list(items, x => `<div class="item-title">${escapeHTML(x.title)}</div><div class="item-meta">${escapeHTML(x.date || "")}${x.time ? " · " + escapeHTML(x.time) : ""}${x.note ? " · " + escapeHTML(x.note) : ""}</div>`, "tasks", x => `<button class="btn small" data-toggle-task="${escapeHTML(x.id)}" type="button">${x.done ? "Undo" : "✓ Done"}</button>`);
}
function habitList(items) {
  const day = today();
  return list(items, x => {
    const done = Array.isArray(x.doneDates) && x.doneDates.includes(day);
    return `<div class="item-title">${escapeHTML(x.title)}</div><div class="item-meta">${done ? "Completed today ✓" : "Daily habit"} · ${escapeHTML(x.category || "Personal")}</div>`;
  }, "habits", x => `<button class="btn small" data-toggle-habit="${escapeHTML(x.id)}" type="button">${Array.isArray(x.doneDates) && x.doneDates.includes(day) ? "Undo" : "✓ Done today"}</button>`);
}
function mealList(items) {
  return list(items, x => `<div class="item-title">${escapeHTML(x.name)}</div><div class="item-meta">${escapeHTML(x.date || "")} · ${Math.round(num(x.calories))} kcal · ${num(x.protein)} g protein</div>`, "meals");
}
function workoutList(items) {
  return list(items, x => `<div class="item-title">${escapeHTML(x.exercise)}</div><div class="item-meta">${escapeHTML(x.date || "")} · ${num(x.sets)} sets · ${num(x.reps)} reps${x.note ? " · " + escapeHTML(x.note) : ""}</div>`, "workouts");
}
function expenseList(items) {
  return list(items, x => `<div class="item-title">${escapeHTML(x.title)} <span class="pill">${escapeHTML(x.category || "Other")}</span></div><div class="item-meta">${escapeHTML(x.date || "")} · ${money(x.amount)}</div>`, "expenses");
}

function lastDays(count = 7) {
  return Array.from({length:count}, (_, i) => {
    const date = shiftDate(i - (count - 1));
    return {date, label:dateLabel(date,{weekday:"short"}), short:date.slice(8,10)};
  });
}
function groupByDate(items, dates, key) {
  return dates.map(d => items.filter(x => x.date === d.date).reduce((sum, x) => sum + (key ? num(x[key]) : 1), 0));
}
function svgBars(values, labels, options = {}) {
  const width = 440, height = 190, left = 30, right = 8, top = 18, bottom = 28;
  const plotW = width-left-right, plotH = height-top-bottom;
  const maxVal = Math.max(1, ...values);
  const step = plotW / values.length, barW = Math.min(28, step * .55);
  let out = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(options.aria || "Bar chart")}">`;
  for (let i=0;i<4;i++) {
    const y = top + plotH * i/3;
    out += `<line class="gridline" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/>`;
  }
  values.forEach((v,i) => {
    const h = (v/maxVal) * (plotH-8), x = left + i*step + (step-barW)/2, y = top+plotH-h;
    out += `<rect class="bar ${options.alt ? "alt" : ""}" x="${x}" y="${y}" width="${barW}" height="${Math.max(0,h)}" rx="5"><title>${escapeHTML(labels[i])}: ${options.format ? options.format(v) : v}</title></rect>`;
    out += `<text x="${x+barW/2}" y="${height-9}" text-anchor="middle">${escapeHTML(labels[i])}</text>`;
  });
  out += `</svg>`;
  return out;
}
function svgLine(values, labels, options = {}) {
  const width=440,height=190,left=34,right=10,top=18,bottom=28,plotW=width-left-right,plotH=height-top-bottom;
  const maxVal=Math.max(1,...values), step=values.length>1?plotW/(values.length-1):plotW;
  let out=`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(options.aria || "Line chart")}">`;
  for(let i=0;i<4;i++){const y=top+plotH*i/3;out+=`<line class="gridline" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/>`;}
  const pts=values.map((v,i)=>({x:left+(values.length>1?i*step:plotW/2),y:top+plotH-(v/maxVal)*(plotH-8)}));
  if(pts.length) out+=`<polyline class="line" points="${pts.map(p=>`${p.x},${p.y}`).join(" ")}"/>`;
  pts.forEach((p,i)=>{out+=`<circle class="dot" cx="${p.x}" cy="${p.y}" r="4"><title>${escapeHTML(labels[i])}: ${options.format?options.format(values[i]):values[i]}</title></circle>`;});
  labels.forEach((label,i)=>{const x=left+(values.length>1?i*step:plotW/2);out+=`<text x="${x}" y="${height-9}" text-anchor="middle">${escapeHTML(label)}</text>`;});
  return out+"</svg>";
}
function categoryBars(items) {
  const sums = {};
  items.forEach(x => {const key=x.category || "Other"; sums[key]=(sums[key]||0)+num(x.amount);});
  const entries=Object.entries(sums).sort((a,b)=>b[1]-a[1]);
  if(!entries.length) return empty("Add expenses to see category breakdown.");
  const max=Math.max(1,...entries.map(x=>x[1]));
  return `<div class="bar-list">${entries.map(([label,value])=>`<div class="bar-row"><span>${escapeHTML(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${value/max*100}%"></div></div><span class="bar-amount">${money(value)}</span></div>`).join("")}</div>`;
}
function dashboard() {
  const days=lastDays(7), day=today(), tasks=todayItems(data.tasks,day), doneTasks=tasks.filter(x=>x.done).length;
  const todaysMeals=todayItems(data.meals,day), calories=todaysMeals.reduce((s,x)=>s+num(x.calories),0), protein=todaysMeals.reduce((s,x)=>s+num(x.protein),0);
  const monthExpenses=monthItems(data.expenses), spent=monthExpenses.reduce((s,x)=>s+num(x.amount),0);
  const habitDone=data.habits.filter(x=>Array.isArray(x.doneDates)&&x.doneDates.includes(day)).length;
  const weeklyCalories=groupByDate(data.meals,days,"calories"), weeklyProtein=groupByDate(data.meals,days,"protein");
  const weeklyWorkouts=groupByDate(data.workouts,days,null), weeklyTasks=days.map(d=>data.tasks.filter(x=>x.date===d.date&&x.done).length);
  const weeklyExpenses=groupByDate(data.expenses,days,"amount");
  const habitRate=data.habits.length ? Math.round(habitDone/data.habits.length*100) : 0;
  const weekSpent=weeklyExpenses.reduce((s,x)=>s+x,0);
  return `${heading("Your progress","A clear picture of your week, built from your own entries.")}
    <div class="grid stats-grid">
      ${stat("Tasks today",`${doneTasks}/${tasks.length}`,"Completed today","✓")}
      ${stat("Calories today",`${Math.round(calories)} kcal`,`${Math.round(protein)} g protein logged`,"◉")}
      ${stat("Habits completed",`${habitDone}/${data.habits.length}`,`${habitRate}% of habits today`,"✳")}
      ${stat("Spent this month",money(spent),`${monthExpenses.length} recorded expenses`,"₹")}
    </div>
    <div class="grid two-col">
      <section class="card chart-card"><div class="chart-title-row"><div><h2>🍽️ Calories this week</h2><div class="small-text">Daily logged calories · kcal</div></div></div>
        ${svgBars(weeklyCalories,days.map(d=>d.label),{aria:"Calories by day"})}
        <div class="metric-row"><span>7-day total</span><strong>${Math.round(weeklyCalories.reduce((s,x)=>s+x,0)).toLocaleString()} kcal</strong></div>
        <div class="metric-row"><span>Daily average</span><strong>${Math.round(weeklyCalories.reduce((s,x)=>s+x,0)/7)} kcal</strong></div>
      </section>
      <section class="card chart-card"><div class="chart-title-row"><div><h2>💪 Workout activity</h2><div class="small-text">Workout entries logged per day</div></div></div>
        ${svgBars(weeklyWorkouts,days.map(d=>d.label),{aria:"Workout entries by day",alt:true})}
        <div class="metric-row"><span>Workout entries this week</span><strong>${weeklyWorkouts.reduce((s,x)=>s+x,0)}</strong></div>
        <div class="metric-row"><span>Days with workouts</span><strong>${weeklyWorkouts.filter(x=>x>0).length}/7</strong></div>
      </section>
      <section class="card chart-card"><div class="chart-title-row"><div><h2>💸 Daily spending</h2><div class="small-text">Last seven days · INR</div></div></div>
        ${svgLine(weeklyExpenses,days.map(d=>d.label),{aria:"Daily expenses",format:money})}
        <div class="metric-row"><span>Last seven days</span><strong>${money(weekSpent)}</strong></div>
      </section>
      <section class="card chart-card"><div class="chart-title-row"><div><h2>✓ Task completion</h2><div class="small-text">Completed tasks by day</div></div></div>
        ${svgBars(weeklyTasks,days.map(d=>d.label),{aria:"Completed tasks by day"})}
        <div class="metric-row"><span>Completed this week</span><strong>${weeklyTasks.reduce((s,x)=>s+x,0)}</strong></div>
      </section>
      <section class="card"><h2>📊 Expense categories this month</h2><p class="small-text">Based on the category you selected for each expense.</p>${categoryBars(monthExpenses)}</section>
      <section class="card"><h2>🥚 Protein this week</h2><p class="small-text">Daily protein recorded in your food log.</p>
        ${svgBars(weeklyProtein,days.map(d=>d.label),{aria:"Protein grams by day",alt:true})}
        <div class="metric-row"><span>7-day protein total</span><strong>${Math.round(weeklyProtein.reduce((s,x)=>s+x,0))} g</strong></div>
      </section>
    </div>
    <div class="grid two-col section-gap">
      <section class="card"><h2>📅 Today's schedule</h2>${tasks.length?`<div class="progress"><span style="width:${doneTasks/tasks.length*100}%"></span></div>`:""}${taskList(tasks)}<div class="actions"><button class="btn" data-goto="schedule" type="button">Manage schedule →</button></div></section>
      <section class="card"><h2>✳ Daily habits</h2>${habitList(data.habits)}<div class="actions"><button class="btn" data-goto="habits" type="button">Manage habits →</button></div></section>
    </div>`;
}
function todayItems(items, date=today()){return items.filter(x=>x.date===date);}
function monthItems(items){return items.filter(x=>String(x.date||"").startsWith(today().slice(0,7)));}

function schedulePage() {
  return `${heading("Schedule","Plan your day and mark tasks complete.")}${formCard("＋ Add a task","task",[
    field("Task","title","text",{placeholder:"e.g. Study machine learning",full:true}),field("Date","date","date",{value:today()}),
    field("Time (optional)","time","time",{required:false}),field("Note (optional)","note","text",{required:false,placeholder:"Extra details",full:true})
  ],"Add task")}<section class="card section-gap"><h2>All tasks</h2>${taskList(data.tasks.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")))}</section>`;
}
function habitsPage() {
  return `${heading("Habits","Build consistency by checking in every day.")}${formCard("＋ Create a habit","habit",[
    field("Habit name","title","text",{placeholder:"e.g. Read for 20 minutes",full:true}),field("Category","category","select",{choices:["Health","Learning","Fitness","Personal","Other"]})
  ],"Create habit")}<section class="card section-gap"><h2>Your habits · ${today()}</h2>${habitList(data.habits)}</section><p class="notice section-gap">Completion is saved by date. Your past check-ins contribute to progress records.</p>`;
}
function foodPage() {
  const todays=todayItems(data.meals), kcal=todays.reduce((s,x)=>s+num(x.calories),0), prot=todays.reduce((s,x)=>s+num(x.protein),0);
  return `${heading("Food & calories","Type a food and quantity to estimate calories and protein automatically.")}<div class="grid stats-grid">${stat("Today's calories",`${Math.round(kcal)} kcal`,"Logged meals","◉")}${stat("Today's protein",`${Math.round(prot)} g`,"Logged meals","↗")}</div>
  <section class="card"><h2>＋ Log food</h2><form data-form="meal"><div class="form-grid">
    <label class="field full"><span>Food name</span><input name="name" id="foodName" list="foodSuggestions" placeholder="e.g. banana, cooked rice, egg, oats" required autocomplete="off"><datalist id="foodSuggestions"><option value="Oats"><option value="Milk"><option value="Cooked rice"><option value="Chapati"><option value="Egg"><option value="Banana"><option value="Chicken breast cooked"><option value="Dal cooked"><option value="Idli"><option value="Dosa"><option value="Peanut butter"><option value="Curd"><option value="Apple"><option value="Bread"><option value="Potato boiled"><option value="Paneer"><option value="Almonds"><option value="Whey protein"></datalist></label>
    ${field("Quantity (grams)","quantity","number",{min:1,step:"1",value:100})}
    ${field("Date","date","date",{value:today()})}
    <label class="field"><span>Estimated calories (kcal)</span><input name="calories" id="foodCalories" type="number" min="0" step="1" required readonly></label>
    <label class="field"><span>Estimated protein (g)</span><input name="protein" id="foodProtein" type="number" min="0" step="0.1" required readonly></label>
    </div><p id="nutritionHint" class="notice section-gap" aria-live="polite">Choose a common food from the suggestions or type its name. Values are estimates per 100 g, scaled to your quantity.</p><div class="actions"><button class="btn primary" type="submit">＋ Add meal</button></div></form></section>
    <section class="card section-gap"><h2>Food history</h2>${mealList(data.meals.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")))}</section><p class="notice section-gap">Nutrition values are estimates and can vary by brand, recipe, cooking method and serving size. For mixed meals, add each ingredient separately for a better estimate.</p>`;
}

// Approximate nutrition per 100 g of prepared food. This works offline; it is not a medical database.
const FOOD_NUTRITION = [
  {names:["oats","rolled oats"],label:"Oats",kcal:389,protein:16.9},
  {names:["milk","cow milk","nandini milk","goodlife milk"],label:"Milk",kcal:61,protein:3.2},
  {names:["cooked rice","white rice","rice cooked","rice"],label:"Cooked rice",kcal:130,protein:2.7},
  {names:["chapati","chapathi","roti","wheat roti"],label:"Chapati / roti",kcal:297,protein:9.0},
  {names:["egg","boiled egg","whole egg"],label:"Whole egg",kcal:155,protein:13},
  {names:["banana"],label:"Banana",kcal:89,protein:1.1},
  {names:["chicken breast cooked","cooked chicken","chicken"],label:"Cooked chicken",kcal:165,protein:31},
  {names:["dal cooked","cooked dal","dal","lentils cooked"],label:"Cooked dal",kcal:116,protein:9},
  {names:["idli","idly"],label:"Idli",kcal:146,protein:4.5},
  {names:["dosa","plain dosa"],label:"Plain dosa",kcal:168,protein:4},
  {names:["peanut butter"],label:"Peanut butter",kcal:588,protein:25},
  {names:["curd","yogurt","plain yogurt"],label:"Curd / yogurt",kcal:61,protein:3.5},
  {names:["apple"],label:"Apple",kcal:52,protein:0.3},
  {names:["bread","white bread"],label:"Bread",kcal:266,protein:8.9},
  {names:["potato boiled","boiled potato","potato"],label:"Boiled potato",kcal:87,protein:1.9},
  {names:["paneer"],label:"Paneer",kcal:265,protein:18.3},
  {names:["almonds","almond"],label:"Almonds",kcal:579,protein:21.2},
  {names:["whey protein","protein powder"],label:"Whey protein powder",kcal:400,protein:80}
];
function nutritionForFood(name, quantity) {
  const clean=String(name||"").toLowerCase().trim().replace(/\s+/g," ");
  if(!clean) return null;
  const match=FOOD_NUTRITION.find(food=>food.names.some(alias=>clean===alias || clean.includes(alias)));
  if(!match) return null;
  const factor=Math.max(0,num(quantity))/100;
  return {label:match.label,calories:Math.round(match.kcal*factor),protein:Math.round(match.protein*factor*10)/10};
}
function updateFoodEstimate(form) {
  const name=form.querySelector('[name="name"]')?.value||"";
  const quantity=form.querySelector('[name="quantity"]')?.value||0;
  const calories=form.querySelector('[name="calories"]'), protein=form.querySelector('[name="protein"]'), hint=form.querySelector('#nutritionHint');
  const result=nutritionForFood(name,quantity);
  if(result) {
    calories.value=result.calories; protein.value=result.protein;
    hint.textContent=`Estimated for ${quantity} g of ${result.label}: ${result.calories} kcal and ${result.protein} g protein. Adjust the food name or quantity to recalculate.`;
  } else {
    calories.value=""; protein.value="";
    hint.textContent=name.trim()?"Food not in the offline list yet. Try a common food such as oats, milk, cooked rice, chapati, egg, banana, chicken, dal, idli or dosa.":"Enter a food name and quantity to calculate an estimate.";
  }
}
function workoutsPage() {
  return `${heading("Workouts","Record exercises and review your training.")}${formCard("＋ Log exercise","workout",[
    field("Exercise","exercise","text",{placeholder:"e.g. Dumbbell curl",full:true}),field("Date","date","date",{value:today()}),
    field("Sets","sets","number",{min:0,step:"1"}),field("Reps per set","reps","number",{min:0,step:"1"}),
    field("Notes (optional)","note","text",{required:false,placeholder:"Weight, duration, etc.",full:true})
  ],"Add exercise")}<section class="card section-gap"><h2>Workout history</h2>${workoutList(data.workouts.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")))}</section>`;
}
function weightPage() {
  const logs=data.weightLogs.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const latest=logs[logs.length-1], previous=logs.length>1?logs[logs.length-2]:null;
  const change=latest&&previous?latest.weight-previous.weight:null;
  const recent=logs.slice(-30), vals=recent.map(x=>num(x.weight)), labels=recent.map(x=>dateLabel(x.date,{month:"short",day:"numeric"}));
  const chart=recent.length>1?svgLine(vals,labels,{aria:"Body weight trend in kilograms",format:v=>`${v.toFixed(1)} kg`}):empty("Log at least two weigh-ins to see your trend chart.");
  const history=logs.length?`<div class="list">${logs.slice().reverse().map(x=>`<div class="list-item"><div class="item-main"><div class="item-title">${num(x.weight).toFixed(1)} kg</div><div class="item-meta">${escapeHTML(dateLabel(x.date,{weekday:"short",year:"numeric",month:"short",day:"numeric"}))}${x.note?" · "+escapeHTML(x.note):""}</div></div><div class="item-actions"><button class="btn small danger" type="button" data-delete="weightLogs" data-id="${escapeHTML(x.id)}">Delete</button></div></div>`).join("")}</div>`:empty("No weigh-ins yet. Add your first body weight above.");
  return `${heading("Body weight","Track your weigh-ins and see your progress over time.")}
    <div class="grid stats-grid">${stat("Latest weight",latest?`${num(latest.weight).toFixed(1)} kg`:"—",latest?dateLabel(latest.date):"Add your first weigh-in","◉")}${stat("Change since previous",change===null?"—":`${change>0?"+":""}${change.toFixed(1)} kg`,change===null?"Log another weigh-in":change<0?"Down since previous entry":change>0?"Up since previous entry":"No change","↗")}${stat("Total weigh-ins",logs.length,"Saved records","✓")}${stat("30-day entries",recent.length,"Recent weigh-ins","✳")}</div>
    <section class="card"><h2>＋ Log body weight</h2><form data-form="weight"><div class="form-grid">${field("Weight (kg)","weight","number",{min:1,step:"0.1",placeholder:"e.g. 59.7"})}${field("Date","date","date",{value:today()})}${field("Note (optional)","note","text",{required:false,placeholder:"e.g. morning, before breakfast",full:true})}</div><p class="notice section-gap">For consistent comparisons, weigh yourself at a similar time each day, ideally in the morning after using the bathroom and before eating.</p><div class="actions"><button class="btn primary" type="submit">＋ Save weigh-in</button></div></form></section>
    <section class="card section-gap"><h2>Weight trend</h2><p class="small-text">Latest ${recent.length} records · kilograms</p>${chart}</section>
    <section class="card section-gap"><h2>Weight history</h2>${history}</section>`;
}

function expensesPage() {
  const month=monthItems(data.expenses), spent=month.reduce((s,x)=>s+num(x.amount),0);
  return `${heading("Expenses","Know where your money goes.")}<div class="grid stats-grid">${stat("Spent this month",money(spent),"All categories","₹")}${stat("Transactions",month.length,"This month","↗")}</div>${formCard("＋ Add expense","expense",[
    field("Expense","title","text",{placeholder:"e.g. Lunch",full:true}),field("Amount (₹)","amount","number",{min:0,step:"0.01"}),
    field("Date","date","date",{value:today()}),field("Category","category","select",{choices:["Food","Rent","Transport","Shopping","Bills","Education","Health","Other"]}),
    field("Note (optional)","note","text",{required:false,full:true})
  ],"Add expense")}<section class="card section-gap"><h2>Expense history</h2>${expenseList(data.expenses.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")))}</section>`;
}
function backupPage() {
  const count=Object.values(data).reduce((s,a)=>s+a.length,0);
  return `${heading("Backup & settings","Protect your records and manage appearance.")}<section class="card">
    <h2>📦 Your data</h2><p class="muted">Entries stored on this device: <strong>${count}</strong></p>
    <div class="actions"><button class="btn primary" id="exportBtn" type="button">↓ Export backup</button><button class="btn" id="importBtn" type="button">↑ Import backup</button></div>
    <hr><h2>Appearance</h2><p class="muted">Switch between dark and light modes using the sun/moon button in the top bar.</p>
    <hr><h2>Storage and privacy</h2><p class="notice">Entries are stored locally in this browser on this device. The website code is hosted publicly, but your personal entries are not uploaded by this app. Export backups regularly. Clearing browser storage or uninstalling the app may erase local entries.</p>
    <hr><h2>Reset data</h2><p class="muted">This permanently deletes all LifeOS entries in this browser. Export a backup first.</p><button class="btn danger" id="resetBtn" type="button">Delete all LifeOS data</button>
  </section>`;
}
function render() {
  document.documentElement.dataset.theme=theme;
  const themeMeta=$('meta[name="theme-color"]');
  if(themeMeta) themeMeta.content=theme==="dark"?"#10131c":"#f4f6fb";
  $("#themeToggle").innerHTML=theme==="dark"
    ? '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
    : '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.7 8.7 0 1 0 20.5 14.2Z"/></svg>';
  $("#themeToggle").setAttribute("aria-label",theme==="dark"?"Switch to light mode":"Switch to dark mode");
  $("#todayLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
  const pages={dashboard,schedule:schedulePage,habits:habitsPage,food:foodPage,workouts:workoutsPage,weight:weightPage,expenses:expensesPage,backup:backupPage};
  app.innerHTML=(pages[page]||dashboard)();
  $$("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
}
function submitForm(event) {
  const form=event.target.closest("form[data-form]");
  if(!form) return;
  event.preventDefault();
  if(!form.reportValidity()) return;
  const v=Object.fromEntries(new FormData(form).entries());
  switch(form.dataset.form) {
    case "task": addRecord("tasks",{title:v.title.trim(),date:v.date,time:v.time,note:(v.note||"").trim(),done:false}); break;
    case "habit": addRecord("habits",{title:v.title.trim(),category:v.category,doneDates:[]}); break;
    case "meal": {
      const estimate=nutritionForFood(v.name,v.quantity);
      if(!estimate) { notify("Food not recognised. Try a food in the suggestions."); return; }
      addRecord("meals",{name:`${v.name.trim()} (${num(v.quantity)} g)`,quantity:num(v.quantity),date:v.date,calories:estimate.calories,protein:estimate.protein});
      break;
    }
    case "workout": addRecord("workouts",{exercise:v.exercise.trim(),date:v.date,sets:num(v.sets),reps:num(v.reps),note:(v.note||"").trim()}); break;
    case "weight": {
      const existing=data.weightLogs.find(x=>x.date===v.date);
      if(existing){if(!confirm(`A weight entry already exists for ${v.date}. Replace it?`)) return; existing.weight=num(v.weight); existing.note=(v.note||"").trim(); persist(); notify("Weight entry updated");}
      else addRecord("weightLogs",{weight:num(v.weight),date:v.date,note:(v.note||"").trim()});
      break;
    }
    case "expense": addRecord("expenses",{title:v.title.trim(),amount:num(v.amount),date:v.date,category:v.category,note:(v.note||"").trim()}); break;
  }
}
function downloadBackup() {
  const backup={app:"LifeOS",version:2,exportedAt:new Date().toISOString(),data};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=`lifeos-backup-${today()}.json`;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify("Backup exported");
}
function importBackup(file) {
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const parsed=JSON.parse(reader.result),incoming=parsed.data||parsed;
      const keys=Object.keys(emptyData());
      if(!incoming||!keys.every(k=>Array.isArray(incoming[k]))) throw new Error("This file does not contain all LifeOS data lists.");
      const clean=normalizeData(incoming);
      if(!confirm("Import this backup and REPLACE the entries currently on this device? Export your current data first if you need it.")) return;
      data=clean;persist();notify("Backup imported");
    } catch(err) { alert("Could not import backup: "+err.message); }
    finally { $("#importFile").value=""; }
  };
  reader.readAsText(file);
}
document.addEventListener("input",event=>{
  const form=event.target.closest('form[data-form="meal"]');
  if(form && ["name","quantity"].includes(event.target.name)) updateFoodEstimate(form);
});
document.addEventListener("change",event=>{
  const form=event.target.closest('form[data-form="meal"]');
  if(form && ["name","quantity"].includes(event.target.name)) updateFoodEstimate(form);
});
document.addEventListener("submit",submitForm);
document.addEventListener("click",event=>{
  const nav=event.target.closest("[data-page]");
  if(nav){page=nav.dataset.page;render();window.scrollTo({top:0,behavior:"smooth"});return;}
  const goto=event.target.closest("[data-goto]");
  if(goto){page=goto.dataset.goto;render();window.scrollTo({top:0,behavior:"smooth"});return;}
  const del=event.target.closest("[data-delete]");
  if(del){
    const collection=del.dataset.delete,id=del.dataset.id;
    if(!Object.hasOwn(data,collection))return;
    if(confirm("Delete this entry?")){data[collection]=data[collection].filter(x=>x.id!==id);persist();notify("Entry deleted");}
    return;
  }
  const taskBtn=event.target.closest("[data-toggle-task]");
  if(taskBtn){const t=data.tasks.find(x=>x.id===taskBtn.dataset.toggleTask);if(t){t.done=!t.done;persist();}return;}
  const habitBtn=event.target.closest("[data-toggle-habit]");
  if(habitBtn){const h=data.habits.find(x=>x.id===habitBtn.dataset.toggleHabit);if(h){if(!Array.isArray(h.doneDates))h.doneDates=[];const d=today();h.doneDates=h.doneDates.includes(d)?h.doneDates.filter(x=>x!==d):[...h.doneDates,d];persist();}return;}
  if(event.target.closest("#themeToggle")){theme=theme==="dark"?"light":"dark";localStorage.setItem(THEME_KEY,theme);render();return;}
  if(event.target.closest("#exportBtn")){downloadBackup();return;}
  if(event.target.closest("#importBtn")){$("#importFile").click();return;}
  if(event.target.closest("#resetBtn")&&confirm("Delete ALL LifeOS entries from this browser? This cannot be undone without a backup.")){data=emptyData();persist();notify("LifeOS data reset");}
});
$("#importFile").addEventListener("change",e=>{const file=e.target.files&&e.target.files[0];if(file)importBackup(file);});
if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")) {
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("Offline caching unavailable:",err)));
}
render();
