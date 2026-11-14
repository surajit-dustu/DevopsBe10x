const TX_KEY = "pocketwise.transactions.v1";
const BUDGET_KEY = "pocketwise.budgets.v1";
const categories = {
  expense: ["Food & dining", "Rent", "Transport", "Bills & utilities", "Shopping", "Health", "Entertainment", "Education", "Travel", "Other"],
  income: ["Salary", "Freelance", "Investment", "Gift", "Other income"],
};
const budgets = [
  { category: "Food & dining", limit: 12000, icon: "◉" },
  { category: "Shopping", limit: 8000, icon: "▣" },
  { category: "Transport", limit: 5000, icon: "↗" },
  { category: "Bills & utilities", limit: 7000, icon: "⌁" },
];
const openings = { "Everyday account": 142500, "Cash wallet": 2500, "Savings account": 80000 };
const colors = ["#4c9367", "#93c9a1", "#f0bb83", "#b7afd9", "#dfece0"];
const pad = (n) => String(n).padStart(2, "0");
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (date) => date.slice(0, 7);
const offsetDate = (days) => { const date = new Date(); date.setDate(date.getDate() - days); return localDate(date); };
const monthName = (key, options = { month: "long", year: "numeric" }) => {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", options).format(new Date(year, month - 1, 1));
};
const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.round(amount || 0));
const safe = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const seed = [
  { id: "seed-1", name: "Monthly salary", category: "Salary", date: offsetDate(3), account: "Everyday account", amount: 85000, type: "income", note: "Monthly salary" },
  { id: "seed-2", name: "Blue Tokai Coffee", category: "Food & dining", date: offsetDate(2), account: "Everyday account", amount: 420, type: "expense", note: "Coffee" },
  { id: "seed-3", name: "Uber ride", category: "Transport", date: offsetDate(2), account: "Everyday account", amount: 285, type: "expense", note: "Cab home" },
  { id: "seed-4", name: "Monthly rent", category: "Rent", date: offsetDate(4), account: "Everyday account", amount: 22000, type: "expense", note: "Apartment rent" },
  { id: "seed-5", name: "Grocery run", category: "Food & dining", date: offsetDate(1), account: "Cash wallet", amount: 1840, type: "expense", note: "Weekly groceries" },
  { id: "seed-6", name: "Spotify Premium", category: "Entertainment", date: offsetDate(5), account: "Everyday account", amount: 119, type: "expense", note: "Monthly subscription" },
  { id: "seed-7", name: "Electricity bill", category: "Bills & utilities", date: offsetDate(6), account: "Everyday account", amount: 1650, type: "expense", note: "Electricity" },
  { id: "seed-8", name: "Weekend brunch", category: "Food & dining", date: offsetDate(8), account: "Everyday account", amount: 960, type: "expense", note: "Brunch with friends" },
];
function loadList(key, fallback) {
  try { const data = localStorage.getItem(key); if (data === null) return fallback; const parsed = JSON.parse(data); return Array.isArray(parsed) ? parsed : fallback; }
  catch (error) { console.error(`Could not read ${key} from this device.`, error); return fallback; }
}
let transactions = loadList(TX_KEY, seed);
const storedBudgets = loadList(BUDGET_KEY, null);
if (storedBudgets) budgets.forEach((item) => { const saved = storedBudgets.find((entry) => entry.category === item.category); if (saved && Number.isFinite(saved.limit) && saved.limit > 0) item.limit = saved.limit; });
let selectedMonth = localDate(new Date()).slice(0, 7);
let activeType = "expense";
let toastTimer;
let csvHeaders = [];
let csvRows = [];
let csvMapping = {};
const $ = (selector) => document.querySelector(selector);

function saveTransactions() {
  try { localStorage.setItem(TX_KEY, JSON.stringify(transactions)); }
  catch (error) { console.error("Could not save transactions.", error); toast("Couldn't save changes on this device."); }
}
function getMonth(key = selectedMonth) { return transactions.filter((item) => monthKey(item.date) === key); }
function accounts() {
  const result = { ...openings };
  transactions.forEach((item) => { if (item.account in result) result[item.account] += item.type === "income" ? item.amount : -item.amount; });
  return result;
}
function toast(message) {
  const node = $("#toast"); node.textContent = message; node.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
}
function renderMonths() {
  const options = [];
  for (let offset = -5; offset <= 0; offset++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); const key = localDate(d).slice(0, 7); options.push({ key, label: monthName(key) }); }
  if (!options.some((item) => item.key === selectedMonth)) options.push({ key: selectedMonth, label: monthName(selectedMonth) });
  $("#monthSelect").innerHTML = options.map((item) => `<option value="${item.key}">${item.label}</option>`).join("");
  $("#monthSelect").value = selectedMonth;
}
function renderSummary() {
  const rows = getMonth();
  const income = rows.filter((x) => x.type === "income").reduce((n, x) => n + x.amount, 0);
  const expense = rows.filter((x) => x.type === "expense").reduce((n, x) => n + x.amount, 0);
  $("#welcomeMonth").textContent = monthName(selectedMonth, { month: "long" });
  $("#totalBalance").textContent = money(Object.values(accounts()).reduce((a, b) => a + b, 0));
  $("#incomeTotal").textContent = money(income);
  $("#expenseTotal").textContent = money(expense);
  $("#savingsTotal").textContent = money(income - expense);
  $("#savingsRate").textContent = `${income ? Math.round((income - expense) / income * 100) : 0}% saved`;
  $("#chartSavings").textContent = money(Math.max(0, income - expense));
  $("#donutTotal").textContent = money(expense);
  $("#breakdownMonth").textContent = monthName(selectedMonth, { month: "short", year: "numeric" });
}
function renderCashflow() {
  const months = [];
  for (let offset = -5; offset <= 0; offset++) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
    const key = localDate(d).slice(0, 7); const rows = getMonth(key);
    months.push({ key, label: monthName(key, { month: "short" }), income: rows.filter((x) => x.type === "income").reduce((n, x) => n + x.amount, 0), expense: rows.filter((x) => x.type === "expense").reduce((n, x) => n + x.amount, 0) });
  }
  const max = Math.max(1, ...months.flatMap((x) => [x.income, x.expense]));
  $("#cashflowChart").innerHTML = months.map((x) => `<div class="chart-month" title="${safe(x.label)}: ${money(x.income)} income, ${money(x.expense)} expenses"><div class="bars"><span class="bar" style="height:${Math.max(3, x.income / max * 100)}%"></span><span class="bar expense" style="height:${Math.max(3, x.expense / max * 100)}%"></span></div><span class="chart-label">${safe(x.label)}</span></div>`).join("");
}
function renderSpending() {
  const totals = {};
  getMonth().filter((x) => x.type === "expense").forEach((x) => { totals[x.category] = (totals[x.category] || 0) + x.amount; });
  const list = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sum = list.reduce((n, x) => n + x[1], 0);
  let end = 0;
  const slices = list.map(([, amount], i) => { const start = end; end += sum ? amount / sum * 100 : 0; return `${colors[i]} ${start}% ${end}%`; });
  $("#donut").style.background = `conic-gradient(${slices.length ? slices.join(",") : "#edf1ec 0 100%"})`;
  $("#categoryLegend").innerHTML = list.length ? list.map(([name, amount], i) => `<div class="legend-row"><i style="background:${colors[i]}"></i><span>${safe(name)}</span><strong>${Math.round(amount / sum * 100)}%</strong></div>`).join("") : "<small>No spending to show yet.</small>";
}
function iconClass(category, type) {
  if (type === "income") return "income";
  if (/rent/i.test(category)) return "home";
  if (/transport|travel/i.test(category)) return "transport";
  return "";
}
function dateLabel(date) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)); }
function renderTransactions() {
  const search = $("#searchInput").value.trim().toLowerCase(); const category = $("#categoryFilter").value;
  const rows = getMonth().filter((x) => `${x.name} ${x.note || ""} ${x.category} ${x.account}`.toLowerCase().includes(search) && (category === "all" || x.category === category)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  $("#transactionRows").innerHTML = rows.map((x) => `<tr class="transaction-row"><td><div class="transaction-cell"><span class="tx-icon ${iconClass(x.category, x.type)}">${x.type === "income" ? "↙" : /rent/i.test(x.category) ? "⌂" : /transport/i.test(x.category) ? "↗" : "♨"}</span><span class="tx-copy"><strong>${safe(x.name)}</strong><small>${safe(x.note || x.category)}</small></span></div></td><td>${safe(x.category)}</td><td>${dateLabel(x.date)}</td><td>${safe(x.account)}</td><td class="amount ${x.type}">${x.type === "income" ? "+" : "−"}${money(x.amount)}</td><td><button class="delete-row" data-delete="${safe(x.id)}" aria-label="Delete ${safe(x.name)}">×</button></td></tr>`).join("");
  $("#emptyState").hidden = rows.length > 0;
}
function renderBudgets() {
  const spent = {};
  getMonth().filter((x) => x.type === "expense").forEach((x) => { spent[x.category] = (spent[x.category] || 0) + x.amount; });
  const total = budgets.reduce((n, x) => n + x.limit, 0);
  const amountSpent = Object.values(spent).reduce((a, b) => a + b, 0);
  $("#budgetTotal").textContent = money(total);
  const remaining = total - amountSpent;
  $("#budgetRemaining").textContent = remaining >= 0 ? `${money(remaining)} left` : `${money(-remaining)} over`;
  $("#budgetList").innerHTML = budgets.map((x) => {
    const value = spent[x.category] || 0; const ratio = value / x.limit; const state = ratio > 1 ? "over" : ratio >= .8 ? "warning" : "";
    return `<div class="budget-item"><div class="budget-item-head"><span>${x.icon} &nbsp;${safe(x.category)}</span><strong>${money(value)} <span>/ ${money(x.limit)}</span></strong></div><div class="track" role="progressbar" aria-label="${safe(x.category)} budget" aria-valuenow="${Math.min(100, Math.round(ratio * 100))}" aria-valuemin="0" aria-valuemax="100"><div class="fill ${state}" style="width:${Math.min(100, ratio * 100)}%"></div></div><div class="budget-foot"><span>${ratio > 1 ? "Over budget" : ratio >= .8 ? "Almost there" : "On track"}</span><strong>${Math.round(ratio * 100)}% used</strong></div></div>`;
  }).join("");
}
function renderAccounts() {
  const balances = accounts(); const types = { "Everyday account": ["▤", "Bank account"], "Cash wallet": ["◉", "Cash"], "Savings account": ["◷", "Savings"] };
  $("#accountList").innerHTML = Object.entries(types).map(([name, info]) => `<div class="account"><span class="account-icon">${info[0]}</span><span class="account-copy"><strong>${name}</strong><small>${info[1]}</small></span><strong class="account-balance">${money(balances[name])}</strong></div>`).join("");
}
function populateCategories() {
  const all = [...new Set([...Object.values(categories).flat(), ...transactions.map((x) => x.category)])];
  $("#categoryInput").innerHTML = categories.expense.map((x) => `<option>${safe(x)}</option>`).join("");
  $("#categoryFilter").innerHTML = `<option value="all">All categories</option>${all.map((x) => `<option value="${safe(x)}">${safe(x)}</option>`).join("")}`;
}
function render() { renderSummary(); renderCashflow(); renderSpending(); renderTransactions(); renderBudgets(); renderAccounts(); }
function openModal(id) {
  $(`#${id}`).hidden = false;
  if (id === "transactionModal") { $("#dateInput").value = localDate(new Date()); $("#amountInput").focus(); }
}
function closeModal(id) { $(`#${id}`).hidden = true; }
function exportCsv() {
  const fields = ["date", "amount", "type", "category", "account", "note"];
  const csv = [fields, ...transactions.map((x) => fields.map((f) => x[f] || ""))].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.href = url; link.download = "pocketwise-transactions.csv"; link.click(); URL.revokeObjectURL(url); toast("Your transactions are ready to export.");
}
function parseCsv(text) {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { value += '"'; i++; } else if (c === '"') quoted = false; else value += c; }
    else if (c === '"' && !value) quoted = true;
    else if (c === ",") { row.push(value); value = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(value); rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (quoted) throw new Error("CSV contains an unfinished quoted field.");
  if (value || row.length) { row.push(value); rows.push(row); }
  if (rows[0] && rows[0][0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  return rows;
}
const importFields = [{ key: "date", aliases: ["date", "transaction date"], required: true }, { key: "amount", aliases: ["amount", "value"], required: true }, { key: "type", aliases: ["type", "transaction type"] }, { key: "category", aliases: ["category"] }, { key: "account", aliases: ["account"] }, { key: "note", aliases: ["note", "description", "merchant", "memo"] }];
function readCell(row, field) { const i = csvMapping[field]; return i === "" || i === undefined ? "" : String(row[Number(i)] || "").trim(); }
function parseDate(value) {
  let m = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return localDate(new Date(+m[1], +m[2] - 1, +m[3]));
  m = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return m ? localDate(new Date(+m[3], +m[2] - 1, +m[1])) : "";
}
function mappedImport() {
  if (csvMapping.date === "" || csvMapping.amount === "") return [];
  return csvRows.map((row, i) => {
    const date = parseDate(readCell(row, "date")); const amount = Number(readCell(row, "amount").replace(/[₹,\s]/g, ""));
    const typeText = readCell(row, "type").toLowerCase(); const type = /income|credit|deposit|salary/.test(typeText) ? "income" : "expense";
    const note = readCell(row, "note"); const category = readCell(row, "category") || (type === "income" ? "Other income" : "Other");
    return { id: `import-${Date.now()}-${i}`, date, amount, type, category, account: readCell(row, "account") || "Everyday account", note, name: note || category };
  }).filter((x) => x.date && Number.isFinite(x.amount) && x.amount > 0);
}
function drawPreview() {
  const items = mappedImport();
  $("#previewCount").textContent = `${items.length} valid row${items.length === 1 ? "" : "s"} · showing ${Math.min(5, items.length)}`;
  $("#previewHead").innerHTML = "<tr><th>Date</th><th>Amount</th><th>Type</th><th>Category</th><th>Note</th></tr>";
  $("#previewBody").innerHTML = items.slice(0, 5).map((x) => `<tr><td>${dateLabel(x.date)}</td><td>${money(x.amount)}</td><td>${x.type}</td><td>${safe(x.category)}</td><td>${safe(x.note || "—")}</td></tr>`).join("");
  $("#confirmImport").disabled = !items.length;
  $("#confirmImport").textContent = items.length ? `Import ${items.length} transaction${items.length === 1 ? "" : "s"}` : "No valid rows to import";
}
function setup() {
  $("#addButton").addEventListener("click", () => openModal("transactionModal"));
  $("#quickButton").addEventListener("click", () => openModal("transactionModal"));
  $("#importButton").addEventListener("click", () => openModal("importModal"));
  $("#exportButton").addEventListener("click", exportCsv);
  $("#monthSelect").addEventListener("change", (e) => { selectedMonth = e.target.value; render(); });
  $("#searchInput").addEventListener("input", renderTransactions);
  $("#categoryFilter").addEventListener("change", renderTransactions);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
  document.querySelectorAll(".backdrop").forEach((modal) => modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(modal.id); }));
  document.querySelectorAll(".type-toggle button").forEach((button) => button.addEventListener("click", () => {
    activeType = button.dataset.type;
    document.querySelectorAll(".type-toggle button").forEach((x) => x.classList.toggle("selected", x === button));
    $("#categoryInput").innerHTML = categories[activeType].map((x) => `<option>${safe(x)}</option>`).join("");
  }));
  $("#transactionForm").addEventListener("submit", (e) => {
    e.preventDefault(); const data = new FormData(e.currentTarget); const amount = Number(data.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) return $("#amountInput").focus();
    const category = String(data.get("category")); const note = String(data.get("note") || "");
    transactions.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: note || category, category, date: String(data.get("date")), account: String(data.get("account")), amount: Math.round(amount * 100) / 100, type: activeType, note });
    saveTransactions(); populateCategories(); selectedMonth = monthKey(String(data.get("date"))); renderMonths(); render(); e.currentTarget.reset();
    activeType = "expense"; document.querySelectorAll(".type-toggle button").forEach((x) => x.classList.toggle("selected", x.dataset.type === "expense"));
    $("#categoryInput").innerHTML = categories.expense.map((x) => `<option>${safe(x)}</option>`).join("");
    closeModal("transactionModal"); toast("Transaction saved.");
  });
  $("#transactionRows").addEventListener("click", (e) => { const button = e.target.closest("[data-delete]"); if (!button) return; transactions = transactions.filter((x) => x.id !== button.dataset.delete); saveTransactions(); render(); toast("Transaction deleted."); });
  $("#viewAll").addEventListener("click", () => { $("#searchInput").value = ""; $("#categoryFilter").value = "all"; renderTransactions(); });
  $("#manageBudgets").addEventListener("click", budgetDialog); $("#editBudgets").addEventListener("click", budgetDialog);
  $("#budgetForm").addEventListener("submit", (e) => {
    e.preventDefault(); const values = budgets.map((_, i) => Number($(`#budget-${i}`).value));
    if (values.some((x) => !Number.isFinite(x) || x <= 0)) return toast("Enter a positive amount for each budget.");
    budgets.forEach((x, i) => { x.limit = Math.round(values[i] * 100) / 100; });
    try { localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets)); } catch (error) { console.error("Could not save budgets.", error); return toast("Couldn't save budgets on this device."); }
    renderBudgets(); closeModal("budgetModal"); toast("Your budgets have been updated.");
  });
  $("#csvFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const records = parseCsv(await file.text());
      if (records.length < 2) throw new Error("CSV must include headers and transaction rows.");
      csvHeaders = records[0].map((x, i) => x.trim() || `Column ${i + 1}`); csvRows = records.slice(1).filter((x) => x.some((cell) => cell.trim())); csvMapping = {};
      if (!csvRows.length) throw new Error("No transactions found in this CSV.");
      importFields.forEach((field) => { const i = csvHeaders.findIndex((h) => field.aliases.includes(h.toLowerCase())); csvMapping[field.key] = i < 0 ? "" : String(i); });
      $("#mappingFields").innerHTML = importFields.map((field) => `<label>${field.key[0].toUpperCase() + field.key.slice(1)}${field.required ? " *" : ""}<select data-map="${field.key}"><option value="">Not mapped</option>${csvHeaders.map((h, i) => `<option value="${i}" ${csvMapping[field.key] === String(i) ? "selected" : ""}>${safe(h)}</option>`).join("")}</select></label>`).join("");
      $("#importFileStep").hidden = true; $("#importMappingStep").hidden = false; drawPreview();
    } catch (error) { console.error("Could not read CSV.", error); toast(error.message); e.target.value = ""; }
  });
  $("#mappingFields").addEventListener("change", (e) => { const select = e.target.closest("[data-map]"); if (!select) return; csvMapping[select.dataset.map] = select.value; drawPreview(); });
  $("#cancelImport").addEventListener("click", () => { $("#csvFile").value = ""; $("#importFileStep").hidden = false; $("#importMappingStep").hidden = true; });
  $("#confirmImport").addEventListener("click", () => {
    const items = mappedImport(); if (!items.length) return toast("Map valid date and amount columns.");
    const seen = new Set(transactions.map((x) => `${x.date}|${x.amount}|${(x.note || "").toLowerCase()}`)); let skipped = 0;
    const accepted = items.filter((x) => { const key = `${x.date}|${x.amount}|${(x.note || "").toLowerCase()}`; if (!$("#keepDuplicates").checked && seen.has(key)) { skipped++; return false; } seen.add(key); return true; });
    transactions = [...accepted, ...transactions]; saveTransactions(); populateCategories(); selectedMonth = monthKey((accepted[0] || items[0]).date); renderMonths(); render(); closeModal("importModal"); toast(`Imported ${accepted.length}; skipped ${skipped} duplicates.`);
  });
  $("#menuButton").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => { document.querySelectorAll(".nav-link").forEach((x) => x.classList.remove("active")); link.classList.add("active"); $("#sidebar").classList.remove("open"); }));
  document.addEventListener("keydown", (e) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;
    if (e.key === "Escape") document.querySelectorAll(".backdrop:not([hidden])").forEach((modal) => closeModal(modal.id));
    if (!typing && e.key.toLowerCase() === "q" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openModal("transactionModal"); }
  });
}
function budgetDialog() {
  $("#budgetFields").innerHTML = budgets.map((x, i) => `<label class="budget-field">${safe(x.category)} · INR/month<input id="budget-${i}" type="number" min="1" step="1" value="${x.limit}" required></label>`).join("");
  openModal("budgetModal");
}
renderMonths(); populateCategories(); setup(); render();