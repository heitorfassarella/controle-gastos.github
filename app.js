const STORAGE_KEY = "controleGastosLocal.v1";
const REMINDER_KEY = "controleGastosLocal.backupReminderWeek";
const APP_VERSION = "1.2.0";

const CATEGORIES = [
  "Alimentação",
  "Mercado",
  "Educação",
  "Saúde",
  "Lazer",
  "Assinaturas",
  "Compras",
  "Cartão",
  "Transporte",
  "Investimento",
  "Salário",
  "Freelancer",
  "Dívidas",
  "Outros"
];

const CATEGORY_MIGRATIONS = {
  "Faculdade": "Educação",
  "Investimentos": "Investimento",
  "Moradia": "Outros",
  "Freelance": "Freelancer"
};

const CATEGORY_COLORS = {
  "Alimentação": "#E0CB51",
  "Mercado": "#C98A3A",
  "Educação": "#4048FF",
  "Saúde": "#CCE958",
  "Lazer": "#E858E5",
  "Assinaturas": "#58E8B9",
  "Compras": "#FF7920",
  "Cartão": "#AE21FF",
  "Transporte": "#2F80ED",
  "Investimento": "#52B362",
  "Salário": "#00C853",
  "Freelancer": "#00ACC1",
  "Dívidas": "#B20000",
  "Outros": "#4F4F4F"
};

const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Débito",
  "Cartão de crédito",
  "VR",
  "Boleto",
  "Transferência",
  "Outro"
];

let state = createInitialState();
let toastTimer = null;

function createInitialState() {
  return {
    transactions: [],
    fixedBills: [],
    cards: [],
    debts: [],
    goals: [],
    settings: {
      appVersion: APP_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthISO(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function parseDateISO(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day || 1);
}

function dateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date, months) {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(value) {
  if (!value) return "-";
  return parseDateISO(value).toLocaleDateString("pt-BR");
}

function formatMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sum(list, selector) {
  return list.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível ler os dados locais. Um estado vazio foi carregado.");
    return createInitialState();
  }
}

function normalizeState(data) {
  const initial = createInitialState();
  const normalized = {
    transactions: Array.isArray(data.transactions) ? data.transactions.map(normalizeTransaction) : [],
    fixedBills: Array.isArray(data.fixedBills) ? data.fixedBills.map(normalizeFixedBill) : [],
    cards: Array.isArray(data.cards) ? data.cards.map(normalizeCard) : [],
    debts: Array.isArray(data.debts) ? data.debts.map(normalizeDebt) : [],
    goals: Array.isArray(data.goals) ? data.goals.map(normalizeGoal) : [],
    settings: {
      ...initial.settings,
      ...(data.settings || {}),
      appVersion: APP_VERSION
    }
  };
  recalculateLinkedBalances(normalized);
  return normalized;
}

function normalizeCategory(category) {
  if (CATEGORIES.includes(category)) return category;
  return CATEGORY_MIGRATIONS[category] || "Outros";
}

function getCategoryColor(category) {
  return CATEGORY_COLORS[normalizeCategory(category)] || CATEGORY_COLORS.Outros;
}

function normalizeTransaction(transaction) {
  return {
    ...transaction,
    amount: normalizeNumber(transaction.amount),
    category: normalizeCategory(transaction.category),
    status: transaction.status || "pending",
    cardId: transaction.cardId || "",
    debtId: transaction.debtId || "",
    goalId: transaction.goalId || ""
  };
}

function normalizeFixedBill(bill) {
  return {
    ...bill,
    amount: normalizeNumber(bill.amount),
    category: normalizeCategory(bill.category),
    cardId: bill.cardId || "",
    debtId: bill.debtId || "",
    goalId: bill.goalId || ""
  };
}

function normalizeCard(card) {
  return {
    ...card,
    type: ["credit", "vr", "other"].includes(card.type) ? card.type : "credit",
    limit: normalizeNumber(card.limit),
    closingDay: Math.min(31, Math.max(1, Number(card.closingDay || 1))),
    dueDay: Math.min(31, Math.max(1, Number(card.dueDay || 1)))
  };
}

function normalizeDebt(debt) {
  const totalAmount = normalizeNumber(debt.totalAmount);
  const manualPaidAmount = Math.min(totalAmount, normalizeNumber(debt.manualPaidAmount ?? debt.paidAmount));
  return {
    ...debt,
    totalAmount,
    manualPaidAmount,
    paidAmount: Math.min(totalAmount, normalizeNumber(debt.paidAmount ?? manualPaidAmount)),
    status: debt.status === "paid" ? "paid" : "open"
  };
}

function normalizeGoal(goal) {
  const target = normalizeNumber(goal.target);
  const manualSaved = Math.min(target, normalizeNumber(goal.manualSaved ?? goal.saved));
  return {
    ...goal,
    target,
    manualSaved,
    saved: Math.min(target, normalizeNumber(goal.saved ?? manualSaved))
  };
}

function saveState() {
  recalculateLinkedBalances();
  state.settings.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateBackupPreview();
}

function populateSelect(select, options, includeAll = false) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = "";
  if (includeAll) {
    const option = document.createElement("option");
    option.value = "all";
    option.textContent = includeAll;
    select.appendChild(option);
  }
  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
  if (current && Array.from(select.options).some((option) => option.value === current)) {
    select.value = current;
  }
}

function populateCardSelect(select = $("#transactionCard")) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Selecione um cartão</option>';
  state.cards.forEach((card) => {
    const option = document.createElement("option");
    option.value = card.id;
    option.textContent = `${card.name} · ${cardTypeLabel(card.type)}`;
    select.appendChild(option);
  });
  select.value = state.cards.some((card) => card.id === current) ? current : "";
}

function populateDebtSelect(select = $("#transactionDebt")) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Selecione uma dívida</option>';
  state.debts.forEach((debt) => {
    const option = document.createElement("option");
    option.value = debt.id;
    option.textContent = `${debt.creditor} · ${debt.description}`;
    select.appendChild(option);
  });
  select.value = state.debts.some((debt) => debt.id === current) ? current : "";
}

function populateGoalSelect(select = $("#transactionGoal")) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Sem meta vinculada</option>';
  state.goals.forEach((goal) => {
    const option = document.createElement("option");
    option.value = goal.id;
    option.textContent = goal.name;
    select.appendChild(option);
  });
  select.value = state.goals.some((goal) => goal.id === current) ? current : "";
}

function populateLinkedSelects() {
  [$("#transactionCard"), $("#fixedCard")].forEach(populateCardSelect);
  [$("#transactionDebt"), $("#fixedDebt")].forEach(populateDebtSelect);
  [$("#transactionGoal"), $("#fixedGoal")].forEach(populateGoalSelect);
}

function initializeSelects() {
  populateSelect($("#transactionCategory"), CATEGORIES);
  populateSelect($("#fixedCategory"), CATEGORIES);
  populateSelect($("#filterCategory"), CATEGORIES, "Todas as categorias");
  populateSelect($("#transactionPayment"), PAYMENT_METHODS);
  populateSelect($("#fixedPayment"), PAYMENT_METHODS);
  populateLinkedSelects();
}

function setDefaultFields() {
  $("#referenceMonth").value = monthISO();
  $("#transactionDate").value = todayISO();
  $("#debtDueDate").value = todayISO();
  $("#goalDeadline").value = todayISO();
}

function getPeriod() {
  const reference = $("#referenceMonth").value || monthISO();
  const [year, month] = reference.split("-").map(Number);
  const type = $("#periodType").value;
  let start;
  let end;
  let label;

  if (type === "quarter") {
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3;
    start = new Date(year, quarterStartMonth, 1);
    end = new Date(year, quarterStartMonth + 3, 1);
    label = `${Math.floor((month - 1) / 3) + 1}º trimestre de ${year}`;
  } else if (type === "semester") {
    const semesterStartMonth = month <= 6 ? 0 : 6;
    start = new Date(year, semesterStartMonth, 1);
    end = new Date(year, semesterStartMonth + 6, 1);
    label = `${month <= 6 ? "1º" : "2º"} semestre de ${year}`;
  } else if (type === "year") {
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
    label = `ano de ${year}`;
  } else {
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 1);
    label = formatMonth(reference);
  }

  return { start, end, label, type };
}

function isInsidePeriod(dateValue, period = getPeriod()) {
  const date = parseDateISO(dateValue);
  return date >= period.start && date < period.end;
}

function getPeriodTransactions() {
  const period = getPeriod();
  return state.transactions.filter((transaction) => isInsidePeriod(transaction.date, period));
}

function updatePeriodTitle() {
  const period = getPeriod();
  $("#periodTitle").textContent = `Resumo: ${period.label}`;
}

function renderAll() {
  recalculateLinkedBalances();
  updatePeriodTitle();
  populateLinkedSelects();
  renderDashboard();
  renderTransactions();
  renderFixedBills();
  renderCards();
  renderDebts();
  renderGoals();
  updateBackupPreview();
}

function renderDashboard() {
  const transactions = getPeriodTransactions();
  const income = sum(transactions.filter((item) => item.type === "income"), (item) => item.amount);
  const expenses = sum(transactions.filter((item) => item.type === "expense"), (item) => item.amount);
  const pending = sum(transactions.filter((item) => item.status === "pending"), (item) => item.amount);
  const openDebt = sum(state.debts.filter((debt) => debt.status !== "paid"), (debt) => Math.max(0, debt.totalAmount - debt.paidAmount));
  const goalProgress = state.goals.length
    ? sum(state.goals, (goal) => goal.target ? Math.min(100, (goal.saved / goal.target) * 100) : 0) / state.goals.length
    : 0;

  $("#statIncome").textContent = formatCurrency(income);
  $("#statExpense").textContent = formatCurrency(expenses);
  $("#statBalance").textContent = formatCurrency(income - expenses);
  $("#statPending").textContent = formatCurrency(pending);
  $("#statDebt").textContent = formatCurrency(openDebt);
  $("#statGoal").textContent = `${Math.round(goalProgress)}%`;

  const categoryData = renderCategoryChart(transactions);
  renderCategoryPieChart(categoryData);
  renderDailyChart(transactions);
  renderCardsSummary(transactions);
  renderStatusSummary(transactions);
}

function renderCategoryChart(transactions) {
  const container = $("#categoryChart");
  const expenses = transactions.filter((item) => item.type === "expense");
  const grouped = groupBySum(expenses, "category");
  renderBarChart(container, grouped, { colorResolver: getCategoryColor });
  return grouped;
}

function renderCategoryPieChart(grouped) {
  const container = $("#categoryPieChart");
  if (!container) return;
  renderPieChart(container, grouped);
}

function renderDailyChart(transactions) {
  const container = $("#dailyChart");
  const start = $("#dailyStart")?.value || "";
  const end = $("#dailyEnd")?.value || "";
  const minValue = normalizeNumber($("#dailyMin")?.value || 0);
  const maxValueRaw = $("#dailyMax")?.value || "";
  const maxValue = maxValueRaw ? normalizeNumber(maxValueRaw) : null;
  const sortMode = $("#dailySort")?.value || "date-asc";

  const expenses = transactions
    .filter((item) => item.type === "expense")
    .filter((item) => (!start || item.date >= start) && (!end || item.date <= end))
    .filter((item) => Number(item.amount || 0) >= minValue)
    .filter((item) => maxValue === null || Number(item.amount || 0) <= maxValue);

  let grouped = groupBySum(expenses, "date");
  grouped.sort((a, b) => {
    if (sortMode === "date-desc") return b.label.localeCompare(a.label);
    if (sortMode === "value-asc") return a.value - b.value;
    if (sortMode === "value-desc") return b.value - a.value;
    return a.label.localeCompare(b.label);
  });

  grouped = grouped.map((item) => ({
    ...item,
    label: formatDate(item.label)
  }));

  renderBarChart(container, grouped);
}

function groupBySum(list, key) {
  const map = new Map();
  list.forEach((item) => {
    const label = item[key] || "Sem categoria";
    map.set(label, (map.get(label) || 0) + Number(item.amount || 0));
  });
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function renderBarChart(container, data, options = {}) {
  if (!data.length) {
    container.className = "bar-chart empty-state";
    container.textContent = "Sem dados no período.";
    return;
  }

  const max = Math.max(...data.map((item) => item.value));
  const colorResolver = options.colorResolver || (() => "var(--primary)");
  container.className = "bar-chart";
  container.innerHTML = data
    .slice(0, 12)
    .map((item) => {
      const width = max ? Math.max(3, (item.value / max) * 100) : 0;
      const color = colorResolver(item.label, item);
      return `
        <div class="chart-row">
          <span class="chart-label" title="${escapeHTML(item.label)}">${escapeHTML(item.label)}</span>
          <span class="chart-track"><span class="chart-fill" style="width: ${width}%; background: ${color}"></span></span>
          <span class="chart-value">${formatCurrency(item.value)}</span>
        </div>
      `;
    })
    .join("");
}

function renderPieChart(container, data) {
  if (!data.length) {
    container.className = "pie-chart empty-state";
    container.textContent = "Sem dados no período.";
    return;
  }

  const total = sum(data, (item) => item.value);
  let accumulated = 0;
  const segmentData = data.map((item) => {
    const start = (accumulated / total) * 360;
    accumulated += item.value;
    const end = (accumulated / total) * 360;
    return {
      ...item,
      start,
      end,
      color: getCategoryColor(item.label),
      percent: total ? (item.value / total) * 100 : 0
    };
  });
  const segments = segmentData
    .map((item) => `${item.color} ${item.start.toFixed(2)}deg ${item.end.toFixed(2)}deg`)
    .join(", ");

  container.className = "pie-chart";
  container.innerHTML = `
    <div class="pie-wrapper">
      <div class="pie-visual" style="background: conic-gradient(${segments});" aria-label="Gráfico de pizza de gastos por categoria"></div>
      <div class="pie-tooltip hidden" role="status"></div>
    </div>
    <p class="pie-help">Passe o mouse sobre o gráfico para ver categoria, valor e percentual.</p>
  `;

  const visual = container.querySelector(".pie-visual");
  const tooltip = container.querySelector(".pie-tooltip");
  const wrapper = container.querySelector(".pie-wrapper");

  visual.addEventListener("mousemove", (event) => {
    const rect = visual.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dx = x - rect.width / 2;
    const dy = y - rect.height / 2;
    const radius = rect.width / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > radius || distance < radius * 0.22) {
      tooltip.classList.add("hidden");
      return;
    }

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    const segment = segmentData.find((item) => angle >= item.start && angle < item.end) || segmentData[segmentData.length - 1];
    if (!segment) return;

    tooltip.innerHTML = `
      <strong>${escapeHTML(segment.label)}</strong>
      <span>${formatCurrency(segment.value)} · ${segment.percent.toFixed(1)}%</span>
    `;
    const wrapperRect = wrapper.getBoundingClientRect();
    tooltip.style.left = `${event.clientX - wrapperRect.left + 12}px`;
    tooltip.style.top = `${event.clientY - wrapperRect.top + 12}px`;
    tooltip.classList.remove("hidden");
  });

  visual.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));
}

function renderCardsSummary(transactions) {
  const container = $("#cardsSummary");
  if (!state.cards.length) {
    container.className = "summary-list empty-state";
    container.textContent = "Nenhum cartão cadastrado.";
    return;
  }

  container.className = "summary-list";
  container.innerHTML = state.cards
    .map((card) => {
      const used = sum(
        transactions.filter((transaction) => transaction.cardId === card.id && transaction.type === "expense"),
        (transaction) => transaction.amount
      );
      const percent = card.limit > 0 ? Math.min(100, (used / card.limit) * 100) : 0;
      return `
        <div class="summary-row">
          <div>
            <strong>${escapeHTML(card.name)}</strong>
            <div class="row-meta">Fechamento dia ${card.closingDay} · Vencimento dia ${card.dueDay}</div>
            <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${percent}%"></div></div>
          </div>
          <strong>${formatCurrency(used)} / ${formatCurrency(card.limit)}</strong>
        </div>
      `;
    })
    .join("");
}

function renderStatusSummary(transactions) {
  const container = $("#statusSummary");
  if (!transactions.length) {
    container.className = "summary-list empty-state";
    container.textContent = "Sem dados no período.";
    return;
  }

  const paid = sum(transactions.filter((item) => item.status === "paid"), (item) => item.amount);
  const pending = sum(transactions.filter((item) => item.status === "pending"), (item) => item.amount);
  const income = sum(transactions.filter((item) => item.type === "income"), (item) => item.amount);
  const expenses = sum(transactions.filter((item) => item.type === "expense"), (item) => item.amount);

  container.className = "summary-list";
  container.innerHTML = `
    <div class="summary-row"><span>Total pago/confirmado</span><strong>${formatCurrency(paid)}</strong></div>
    <div class="summary-row"><span>Total pendente</span><strong>${formatCurrency(pending)}</strong></div>
    <div class="summary-row"><span>Receitas</span><strong>${formatCurrency(income)}</strong></div>
    <div class="summary-row"><span>Gastos</span><strong>${formatCurrency(expenses)}</strong></div>
  `;
}

function getFilteredTransactions() {
  const search = $("#searchInput").value.trim().toLowerCase();
  const type = $("#filterType").value;
  const category = $("#filterCategory").value;
  const status = $("#filterStatus").value;
  const start = $("#filterStart").value;
  const end = $("#filterEnd").value;

  return state.transactions
    .filter((transaction) => {
      const text = `${transaction.description} ${transaction.notes || ""}`.toLowerCase();
      const date = transaction.date;
      return (
        (!search || text.includes(search)) &&
        (type === "all" || transaction.type === type) &&
        (category === "all" || transaction.category === category) &&
        (status === "all" || transaction.status === status) &&
        (!start || date >= start) &&
        (!end || date <= end)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function renderTransactions() {
  const tbody = $("#transactionsTable");
  const transactions = getFilteredTransactions();

  if (!transactions.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">Nenhuma movimentação encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions
    .map((transaction) => {
      const installment = transaction.installmentTotal > 1
        ? `<div class="row-meta">Parcela ${transaction.installmentNumber}/${transaction.installmentTotal}</div>`
        : "";
      const fixed = transaction.fixedBillId ? `<div class="row-meta">Gerada de conta fixa</div>` : "";
      const linkedCard = transaction.cardId ? `<div class="row-meta">Cartão: ${escapeHTML(getCardName(transaction.cardId) || "cartão removido")}</div>` : "";
      const linkedDebt = transaction.debtId ? `<div class="row-meta">Dívida: ${escapeHTML(getDebtName(transaction.debtId) || "dívida removida")}</div>` : "";
      const linkedGoal = transaction.goalId ? `<div class="row-meta">Meta: ${escapeHTML(getGoalName(transaction.goalId) || "meta removida")}</div>` : "";
      const categoryColor = getCategoryColor(transaction.category);
      return `
        <tr class="category-row" style="--category-color: ${categoryColor}">
          <td>${formatDate(transaction.date)}</td>
          <td>
            <div class="row-title">${escapeHTML(transaction.description)}</div>
            ${installment}
            ${fixed}
            ${linkedCard}
            ${linkedDebt}
            ${linkedGoal}
            ${transaction.notes ? `<div class="row-note">${escapeHTML(transaction.notes)}</div>` : ""}
          </td>
          <td><span class="badge ${transaction.type === "income" ? "badge-income" : "badge-expense"}">${transaction.type === "income" ? "Receita" : "Gasto"}</span></td>
          <td><span class="category-pill" style="--category-color: ${getCategoryColor(transaction.category)}">${escapeHTML(transaction.category)}</span></td>
          <td><strong>${formatCurrency(transaction.amount)}</strong><div class="row-meta">${escapeHTML(transaction.paymentMethod)}</div></td>
          <td><span class="badge ${transaction.status === "paid" ? "badge-paid" : "badge-pending"}">${transaction.status === "paid" ? "Pago" : "Pendente"}</span></td>
          <td>
            <div class="action-group">
              <button class="btn btn-secondary btn-mini" data-action="edit-transaction" data-id="${transaction.id}">Editar</button>
              <button class="btn btn-ghost btn-mini" data-action="duplicate-transaction" data-id="${transaction.id}">Duplicar</button>
              <button class="btn btn-primary btn-mini" data-action="pay-transaction" data-id="${transaction.id}">${transaction.status === "paid" ? "Pendente" : "Pagar"}</button>
              <button class="btn btn-danger btn-mini" data-action="delete-transaction" data-id="${transaction.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function requiresCardLink(category, paymentMethod) {
  return category === "Cartão" || paymentMethod === "Cartão de crédito" || paymentMethod === "VR";
}

function requiresDebtLink(category) {
  return category === "Dívidas";
}

function getCardName(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  return card ? card.name : "";
}

function getCardById(cardId) {
  return state.cards.find((item) => item.id === cardId) || null;
}

function cardTypeLabel(type) {
  const labels = {
    credit: "Crédito",
    vr: "VR",
    other: "Outro"
  };
  return labels[type] || "Crédito";
}

function getDebtName(debtId) {
  const debt = state.debts.find((item) => item.id === debtId);
  return debt ? `${debt.creditor} · ${debt.description}` : "";
}

function getGoalName(goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  return goal ? goal.name : "";
}

function getLinkedDebtPaidTotal(debtId, sourceState = state) {
  return sum(
    sourceState.transactions.filter((transaction) => transaction.debtId === debtId && transaction.status === "paid" && transaction.type === "expense"),
    (transaction) => transaction.amount
  );
}

function getLinkedGoalSavedTotal(goalId, sourceState = state) {
  return sum(
    sourceState.transactions.filter((transaction) => transaction.goalId === goalId && transaction.status === "paid"),
    (transaction) => transaction.amount
  );
}

function recalculateLinkedBalances(sourceState = state) {
  sourceState.debts = sourceState.debts.map((debt) => {
    const totalAmount = normalizeNumber(debt.totalAmount);
    const manualPaidAmount = Math.min(totalAmount, normalizeNumber(debt.manualPaidAmount ?? debt.paidAmount));
    const linkedPaidAmount = getLinkedDebtPaidTotal(debt.id, sourceState);
    const paidAmount = Math.min(totalAmount, manualPaidAmount + linkedPaidAmount);
    return {
      ...debt,
      totalAmount,
      manualPaidAmount,
      paidAmount,
      status: paidAmount >= totalAmount && totalAmount > 0 ? "paid" : "open"
    };
  });

  sourceState.goals = sourceState.goals.map((goal) => {
    const target = normalizeNumber(goal.target);
    const manualSaved = Math.min(target, normalizeNumber(goal.manualSaved ?? goal.saved));
    const linkedSaved = getLinkedGoalSavedTotal(goal.id, sourceState);
    const saved = Math.min(target, manualSaved + linkedSaved);
    return {
      ...goal,
      target,
      manualSaved,
      saved
    };
  });
}

function splitAmountIntoInstallments(totalAmount, installments, index) {
  const totalCents = Math.round(normalizeNumber(totalAmount) * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainder = totalCents % installments;
  const cents = baseCents + (index < remainder ? 1 : 0);
  return cents / 100;
}

function validateLinkedFields(payload) {
  if (requiresCardLink(payload.category, payload.paymentMethod)) {
    if (!state.cards.length) {
      showToast("Cadastre um cartão antes de usar a categoria ou pagamento Cartão.");
      return false;
    }
    if (!payload.cardId) {
      showToast("Selecione o cartão vinculado.");
      return false;
    }
    if (payload.paymentMethod === "VR" && getCardById(payload.cardId)?.type !== "vr") {
      showToast("Para pagamento VR, selecione um cartão do tipo VR.");
      return false;
    }
  }

  if (requiresDebtLink(payload.category)) {
    if (!state.debts.length) {
      showToast("Cadastre uma dívida antes de usar a categoria Dívidas.");
      return false;
    }
    if (!payload.debtId) {
      showToast("Selecione a dívida vinculada.");
      return false;
    }
  }

  return true;
}

function transactionFromForm() {
  const category = $("#transactionCategory").value;
  const paymentMethod = $("#transactionPayment").value;
  return {
    type: $("#transactionType").value,
    description: $("#transactionDescription").value.trim(),
    amount: normalizeNumber($("#transactionAmount").value),
    category,
    date: $("#transactionDate").value,
    paymentMethod,
    status: $("#transactionStatus").value,
    cardId: requiresCardLink(category, paymentMethod) ? $("#transactionCard").value : "",
    debtId: requiresDebtLink(category) ? $("#transactionDebt").value : "",
    goalId: $("#transactionGoal").value || "",
    notes: $("#transactionNotes").value.trim()
  };
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  const id = $("#transactionId").value;
  const payload = transactionFromForm();
  const installments = Math.max(1, Number($("#transactionInstallments").value || 1));

  if (!payload.description || !payload.amount || !payload.date) {
    showToast("Preencha descrição, valor e data.");
    return;
  }

  if (!validateLinkedFields(payload)) return;

  if (id) {
    const index = state.transactions.findIndex((item) => item.id === id);
    if (index !== -1) {
      state.transactions[index] = {
        ...state.transactions[index],
        ...payload,
        updatedAt: new Date().toISOString()
      };
    }
    resetTransactionForm();
    showToast("Movimentação atualizada.");
  } else if (installments > 1 && payload.type === "expense") {
    const parentInstallmentId = uid("installment");
    const baseDate = parseDateISO(payload.date);
    const items = Array.from({ length: installments }, (_, index) => ({
      ...payload,
      id: uid("transaction"),
      amount: splitAmountIntoInstallments(payload.amount, installments, index),
      purchaseTotalAmount: payload.amount,
      date: dateToISO(addMonths(baseDate, index)),
      description: `${payload.description} (${index + 1}/${installments})`,
      parentInstallmentId,
      installmentNumber: index + 1,
      installmentTotal: installments,
      fixedBillId: "",
      fixedBillOccurrenceKey: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    state.transactions.push(...items);
    resetTransactionForm();
    showToast(`${installments} parcelas criadas.`);
  } else {
    state.transactions.push({
      ...payload,
      id: uid("transaction"),
      parentInstallmentId: "",
      installmentNumber: 1,
      installmentTotal: 1,
      fixedBillId: "",
      fixedBillOccurrenceKey: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    resetTransactionForm();
    showToast("Movimentação salva.");
  }

  saveState();
  renderAll();
}

function resetTransactionForm() {
  $("#transactionForm").reset();
  $("#transactionId").value = "";
  $("#transactionDate").value = todayISO();
  $("#transactionInstallments").value = 1;
  $("#transactionInstallments").disabled = false;
  $("#transactionFormTitle").textContent = "Nova movimentação";
  $("#cancelTransactionEdit").classList.add("hidden");
  updateTransactionLinkedFields();
}

function editTransaction(id) {
  const item = state.transactions.find((transaction) => transaction.id === id);
  if (!item) return;
  activateTab("movements");
  $("#transactionId").value = item.id;
  $("#transactionType").value = item.type;
  $("#transactionDescription").value = item.description;
  $("#transactionAmount").value = item.amount;
  $("#transactionCategory").value = item.category;
  $("#transactionDate").value = item.date;
  $("#transactionPayment").value = item.paymentMethod;
  $("#transactionStatus").value = item.status;
  $("#transactionNotes").value = item.notes || "";
  $("#transactionInstallments").value = item.installmentTotal || 1;
  $("#transactionInstallments").disabled = true;
  updateTransactionLinkedFields();
  $("#transactionCard").value = item.cardId || "";
  $("#transactionDebt").value = item.debtId || "";
  $("#transactionGoal").value = item.goalId || "";
  $("#transactionFormTitle").textContent = "Editar movimentação";
  $("#cancelTransactionEdit").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function duplicateTransaction(id) {
  const item = state.transactions.find((transaction) => transaction.id === id);
  if (!item) return;
  state.transactions.push({
    ...item,
    id: uid("transaction"),
    description: `${item.description} (cópia)`,
    fixedBillOccurrenceKey: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  saveState();
  renderAll();
  showToast("Movimentação duplicada.");
}

function toggleTransactionPayment(id) {
  const item = state.transactions.find((transaction) => transaction.id === id);
  if (!item) return;
  item.status = item.status === "paid" ? "pending" : "paid";
  item.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
  showToast("Status atualizado.");
}

function deleteTransaction(id) {
  const item = state.transactions.find((transaction) => transaction.id === id);
  if (!item) return;
  const confirmMessage = item.parentInstallmentId
    ? "Excluir esta parcela? As demais parcelas não serão removidas."
    : "Excluir esta movimentação?";
  if (!confirm(confirmMessage)) return;
  state.transactions = state.transactions.filter((transaction) => transaction.id !== id);
  saveState();
  renderAll();
  showToast("Movimentação excluída.");
}

function fixedBillFromForm() {
  const category = $("#fixedCategory").value;
  const paymentMethod = $("#fixedPayment").value;
  return {
    description: $("#fixedDescription").value.trim(),
    amount: normalizeNumber($("#fixedAmount").value),
    category,
    dueDay: Math.min(31, Math.max(1, Number($("#fixedDueDay").value || 1))),
    paymentMethod,
    status: $("#fixedStatus").value,
    active: $("#fixedActive").value === "true",
    cardId: requiresCardLink(category, paymentMethod) ? $("#fixedCard").value : "",
    debtId: requiresDebtLink(category) ? $("#fixedDebt").value : "",
    goalId: $("#fixedGoal").value || "",
    notes: $("#fixedNotes").value.trim()
  };
}

function handleFixedSubmit(event) {
  event.preventDefault();
  const id = $("#fixedId").value;
  const payload = fixedBillFromForm();
  if (!payload.description || !payload.amount) {
    showToast("Preencha descrição e valor da conta fixa.");
    return;
  }

  if (!validateLinkedFields(payload)) return;

  if (id) {
    const index = state.fixedBills.findIndex((item) => item.id === id);
    if (index !== -1) {
      state.fixedBills[index] = { ...state.fixedBills[index], ...payload, updatedAt: new Date().toISOString() };
    }
    showToast("Conta fixa atualizada.");
  } else {
    state.fixedBills.push({ ...payload, id: uid("fixed"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    showToast("Conta fixa salva.");
  }
  resetFixedForm();
  saveState();
  renderAll();
}

function renderFixedBills() {
  const container = $("#fixedList");
  if (!state.fixedBills.length) {
    container.className = "item-list empty-state";
    container.textContent = "Nenhuma conta fixa cadastrada.";
    return;
  }
  container.className = "item-list";
  container.innerHTML = state.fixedBills
    .map((bill) => `
      <article class="item-card category-bordered" style="--category-color: ${getCategoryColor(bill.category)}">
        <div class="item-card-header">
          <div>
            <h4>${escapeHTML(bill.description)}</h4>
            <p><span class="category-pill" style="--category-color: ${getCategoryColor(bill.category)}">${escapeHTML(bill.category)}</span> · vencimento dia ${bill.dueDay} · ${escapeHTML(bill.paymentMethod)}</p>
            ${bill.cardId ? `<p>Cartão: ${escapeHTML(getCardName(bill.cardId) || "cartão removido")}</p>` : ""}
            ${bill.debtId ? `<p>Dívida: ${escapeHTML(getDebtName(bill.debtId) || "dívida removida")}</p>` : ""}
            ${bill.goalId ? `<p>Meta: ${escapeHTML(getGoalName(bill.goalId) || "meta removida")}</p>` : ""}
          </div>
          <span class="badge ${bill.active ? "badge-active" : "badge-neutral"}">${bill.active ? "Ativa" : "Inativa"}</span>
        </div>
        <div class="item-metrics">
          <div class="metric-box"><span>Valor</span><strong>${formatCurrency(bill.amount)}</strong></div>
          <div class="metric-box"><span>Status ao gerar</span><strong>${bill.status === "paid" ? "Pago" : "Pendente"}</strong></div>
          <div class="metric-box"><span>Criada em</span><strong>${formatDate((bill.createdAt || todayISO()).slice(0, 10))}</strong></div>
        </div>
        ${bill.notes ? `<p>${escapeHTML(bill.notes)}</p>` : ""}
        <div class="action-group">
          <button class="btn btn-secondary btn-mini" data-action="edit-fixed" data-id="${bill.id}">Editar</button>
          <button class="btn btn-danger btn-mini" data-action="delete-fixed" data-id="${bill.id}">Excluir</button>
        </div>
      </article>
    `)
    .join("");
}

function editFixedBill(id) {
  const bill = state.fixedBills.find((item) => item.id === id);
  if (!bill) return;
  activateTab("fixed");
  $("#fixedId").value = bill.id;
  $("#fixedDescription").value = bill.description;
  $("#fixedAmount").value = bill.amount;
  $("#fixedCategory").value = bill.category;
  $("#fixedDueDay").value = bill.dueDay;
  $("#fixedPayment").value = bill.paymentMethod;
  updateFixedLinkedFields();
  $("#fixedCard").value = bill.cardId || "";
  $("#fixedDebt").value = bill.debtId || "";
  $("#fixedGoal").value = bill.goalId || "";
  $("#fixedStatus").value = bill.status;
  $("#fixedActive").value = String(bill.active);
  $("#fixedNotes").value = bill.notes || "";
  $("#fixedFormTitle").textContent = "Editar conta fixa";
  $("#cancelFixedEdit").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetFixedForm() {
  $("#fixedForm").reset();
  $("#fixedId").value = "";
  $("#fixedFormTitle").textContent = "Nova conta fixa";
  $("#cancelFixedEdit").classList.add("hidden");
  updateFixedLinkedFields();
}

function deleteFixedBill(id) {
  if (!confirm("Excluir esta conta fixa? Os lançamentos já gerados permanecerão salvos.")) return;
  state.fixedBills = state.fixedBills.filter((bill) => bill.id !== id);
  saveState();
  renderAll();
  showToast("Conta fixa excluída.");
}

function generateFixedBillsForPeriod() {
  const activeBills = state.fixedBills.filter((bill) => bill.active);
  if (!activeBills.length) {
    showToast("Nenhuma conta fixa ativa para gerar.");
    return;
  }

  const months = getMonthsInPeriod(getPeriod());
  let created = 0;

  activeBills.forEach((bill) => {
    months.forEach((month) => {
      const occurrenceKey = `${bill.id}_${month}`;
      const alreadyExists = state.transactions.some((transaction) => transaction.fixedBillOccurrenceKey === occurrenceKey);
      if (alreadyExists) return;

      const [year, monthNumber] = month.split("-").map(Number);
      const lastDay = new Date(year, monthNumber, 0).getDate();
      const dueDate = `${month}-${String(Math.min(bill.dueDay, lastDay)).padStart(2, "0")}`;

      state.transactions.push({
        id: uid("transaction"),
        type: "expense",
        description: bill.description,
        amount: bill.amount,
        category: bill.category,
        date: dueDate,
        paymentMethod: bill.paymentMethod,
        status: bill.status,
        cardId: bill.cardId || "",
        debtId: bill.debtId || "",
        goalId: bill.goalId || "",
        notes: bill.notes || "",
        parentInstallmentId: "",
        installmentNumber: 1,
        installmentTotal: 1,
        fixedBillId: bill.id,
        fixedBillOccurrenceKey: occurrenceKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      created += 1;
    });
  });

  saveState();
  renderAll();
  showToast(created ? `${created} lançamento(s) fixo(s) gerado(s).` : "Nenhum novo lançamento. Já estavam gerados.");
}

function getMonthsInPeriod(period) {
  const months = [];
  const cursor = new Date(period.start);
  while (cursor < period.end) {
    months.push(monthISO(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function cardFromForm() {
  return {
    name: $("#cardName").value.trim(),
    type: $("#cardType").value || "credit",
    limit: normalizeNumber($("#cardLimit").value),
    closingDay: Math.min(31, Math.max(1, Number($("#cardClosingDay").value || 1))),
    dueDay: Math.min(31, Math.max(1, Number($("#cardDueDay").value || 1))),
    notes: $("#cardNotes").value.trim()
  };
}

function handleCardSubmit(event) {
  event.preventDefault();
  const id = $("#cardId").value;
  const payload = cardFromForm();
  if (!payload.name) {
    showToast("Preencha o nome do cartão.");
    return;
  }
  if (id) {
    const index = state.cards.findIndex((card) => card.id === id);
    if (index !== -1) {
      state.cards[index] = { ...state.cards[index], ...payload, updatedAt: new Date().toISOString() };
    }
    showToast("Cartão atualizado.");
  } else {
    state.cards.push({ ...payload, id: uid("card"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    showToast("Cartão salvo.");
  }
  resetCardForm();
  saveState();
  renderAll();
}

function renderCards() {
  const container = $("#cardList");
  if (!state.cards.length) {
    container.className = "item-list empty-state";
    container.textContent = "Nenhum cartão cadastrado.";
    return;
  }

  const periodTransactions = getPeriodTransactions();
  container.className = "item-list";
  container.innerHTML = state.cards
    .map((card) => {
      const periodPurchases = periodTransactions.filter((transaction) => transaction.cardId === card.id && transaction.type === "expense");
      const allPurchases = state.transactions
        .filter((transaction) => transaction.cardId === card.id && transaction.type === "expense")
        .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
      const used = sum(periodPurchases, (transaction) => transaction.amount);
      const totalLinked = sum(allPurchases, (transaction) => transaction.amount);
      const available = Math.max(0, card.limit - used);
      const percent = card.limit ? Math.min(100, (used / card.limit) * 100) : 0;
      return `
        <article class="item-card">
          <div class="item-card-header">
            <div>
              <h4>${escapeHTML(card.name)}</h4>
              <p>${cardTypeLabel(card.type)} · fecha dia ${card.closingDay} · vence dia ${card.dueDay}</p>
            </div>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
          <div class="item-metrics">
            <div class="metric-box"><span>${card.type === "vr" ? "Saldo/limite" : "Limite"}</span><strong>${formatCurrency(card.limit)}</strong></div>
            <div class="metric-box"><span>Usado no período</span><strong>${formatCurrency(used)}</strong></div>
            <div class="metric-box"><span>Disponível no período</span><strong>${formatCurrency(available)}</strong></div>
            <div class="metric-box"><span>Total vinculado</span><strong>${formatCurrency(totalLinked)}</strong></div>
          </div>
          ${card.notes ? `<p>${escapeHTML(card.notes)}</p>` : ""}
          <div class="linked-history">
            <h5>Histórico de compras vinculadas</h5>
            ${renderCardPurchaseHistory(allPurchases)}
          </div>
          <div class="action-group">
            <button class="btn btn-secondary btn-mini" data-action="edit-card" data-id="${card.id}">Editar</button>
            <button class="btn btn-danger btn-mini" data-action="delete-card" data-id="${card.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCardPurchaseHistory(purchases) {
  if (!purchases.length) {
    return '<div class="mini-empty">Nenhuma compra vinculada a este cartão.</div>';
  }

  return `
    <div class="history-list">
      ${purchases.slice(0, 30).map((transaction) => {
        const installment = transaction.installmentTotal > 1
          ? ` · Parcela ${transaction.installmentNumber}/${transaction.installmentTotal}`
          : "";
        return `
          <div class="history-row">
            <div>
              <strong>${escapeHTML(transaction.description)}</strong>
              <span>${formatDate(transaction.date)} · ${escapeHTML(transaction.category)}${installment}</span>
            </div>
            <div class="history-value">
              <strong>${formatCurrency(transaction.amount)}</strong>
              <span class="badge ${transaction.status === "paid" ? "badge-paid" : "badge-pending"}">${transaction.status === "paid" ? "Pago" : "Pendente"}</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
    ${purchases.length > 30 ? `<div class="row-meta">Mostrando as 30 compras mais recentes.</div>` : ""}
  `;
}

function editCard(id) {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;
  activateTab("cards");
  $("#cardId").value = card.id;
  $("#cardName").value = card.name;
  $("#cardType").value = card.type || "credit";
  $("#cardLimit").value = card.limit;
  $("#cardClosingDay").value = card.closingDay;
  $("#cardDueDay").value = card.dueDay;
  $("#cardNotes").value = card.notes || "";
  $("#cardFormTitle").textContent = "Editar cartão";
  $("#cancelCardEdit").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetCardForm() {
  $("#cardForm").reset();
  $("#cardId").value = "";
  $("#cardType").value = "credit";
  $("#cardFormTitle").textContent = "Novo cartão";
  $("#cancelCardEdit").classList.add("hidden");
}

function deleteCard(id) {
  const hasTransactions = state.transactions.some((transaction) => transaction.cardId === id);
  const message = hasTransactions
    ? "Excluir este cartão? As movimentações vinculadas ficarão sem cartão."
    : "Excluir este cartão?";
  if (!confirm(message)) return;
  state.cards = state.cards.filter((card) => card.id !== id);
  state.transactions = state.transactions.map((transaction) => transaction.cardId === id ? { ...transaction, cardId: "" } : transaction);
  state.fixedBills = state.fixedBills.map((bill) => bill.cardId === id ? { ...bill, cardId: "" } : bill);
  saveState();
  renderAll();
  showToast("Cartão excluído.");
}

function debtFromForm() {
  const totalAmount = normalizeNumber($("#debtTotal").value);
  const manualPaidAmount = Math.min(totalAmount, normalizeNumber($("#debtPaid").value));
  return {
    creditor: $("#debtCreditor").value.trim(),
    description: $("#debtDescription").value.trim(),
    totalAmount,
    manualPaidAmount,
    paidAmount: manualPaidAmount,
    dueDate: $("#debtDueDate").value,
    status: $("#debtStatus").value,
    notes: $("#debtNotes").value.trim()
  };
}

function handleDebtSubmit(event) {
  event.preventDefault();
  const id = $("#debtId").value;
  const payload = debtFromForm();
  if (!payload.creditor || !payload.description || !payload.totalAmount) {
    showToast("Preencha credor, descrição e valor total.");
    return;
  }
  if (payload.status === "paid") {
    payload.manualPaidAmount = payload.totalAmount;
    payload.paidAmount = payload.totalAmount;
  }
  if (payload.manualPaidAmount >= payload.totalAmount) payload.status = "paid";
  if (payload.status !== "paid") payload.status = "open";

  if (id) {
    const index = state.debts.findIndex((debt) => debt.id === id);
    if (index !== -1) {
      state.debts[index] = { ...state.debts[index], ...payload, updatedAt: new Date().toISOString() };
    }
    showToast("Dívida atualizada.");
  } else {
    state.debts.push({ ...payload, id: uid("debt"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    showToast("Dívida salva.");
  }
  resetDebtForm();
  saveState();
  renderAll();
}

function renderDebts() {
  const container = $("#debtList");
  if (!state.debts.length) {
    container.className = "item-list empty-state";
    container.textContent = "Nenhuma dívida cadastrada.";
    return;
  }

  container.className = "item-list";
  container.innerHTML = state.debts
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((debt) => {
      const linkedPaidAmount = getLinkedDebtPaidTotal(debt.id);
      const remaining = Math.max(0, debt.totalAmount - debt.paidAmount);
      const percent = debt.totalAmount ? Math.min(100, (debt.paidAmount / debt.totalAmount) * 100) : 0;
      return `
        <article class="item-card">
          <div class="item-card-header">
            <div>
              <h4>${escapeHTML(debt.creditor)} · ${escapeHTML(debt.description)}</h4>
              <p>Vencimento: ${formatDate(debt.dueDate)}</p>
            </div>
            <span class="badge ${debt.status === "paid" ? "badge-paid" : "badge-pending"}">${debt.status === "paid" ? "Quitada" : "Aberta"}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
          <div class="item-metrics">
            <div class="metric-box"><span>Total</span><strong>${formatCurrency(debt.totalAmount)}</strong></div>
            <div class="metric-box"><span>Pago total</span><strong>${formatCurrency(debt.paidAmount)}</strong></div>
            <div class="metric-box"><span>Pago vinculado</span><strong>${formatCurrency(linkedPaidAmount)}</strong></div>
            <div class="metric-box"><span>Restante</span><strong>${formatCurrency(remaining)}</strong></div>
          </div>
          ${debt.notes ? `<p>${escapeHTML(debt.notes)}</p>` : ""}
          <div class="action-group">
            <button class="btn btn-secondary btn-mini" data-action="edit-debt" data-id="${debt.id}">Editar</button>
            <button class="btn btn-primary btn-mini" data-action="pay-debt" data-id="${debt.id}">Quitar</button>
            <button class="btn btn-danger btn-mini" data-action="delete-debt" data-id="${debt.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function editDebt(id) {
  const debt = state.debts.find((item) => item.id === id);
  if (!debt) return;
  activateTab("debts");
  $("#debtId").value = debt.id;
  $("#debtCreditor").value = debt.creditor;
  $("#debtDescription").value = debt.description;
  $("#debtTotal").value = debt.totalAmount;
  $("#debtPaid").value = debt.manualPaidAmount || 0;
  $("#debtDueDate").value = debt.dueDate;
  $("#debtStatus").value = debt.status === "paid" ? "paid" : "open";
  $("#debtNotes").value = debt.notes || "";
  $("#debtFormTitle").textContent = "Editar dívida";
  $("#cancelDebtEdit").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetDebtForm() {
  $("#debtForm").reset();
  $("#debtId").value = "";
  $("#debtDueDate").value = todayISO();
  $("#debtFormTitle").textContent = "Nova dívida";
  $("#cancelDebtEdit").classList.add("hidden");
}

function payDebt(id) {
  const debt = state.debts.find((item) => item.id === id);
  if (!debt) return;
  debt.manualPaidAmount = debt.totalAmount;
  debt.paidAmount = debt.totalAmount;
  debt.status = "paid";
  debt.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
  showToast("Dívida marcada como quitada.");
}

function deleteDebt(id) {
  const hasLinks = state.transactions.some((transaction) => transaction.debtId === id) || state.fixedBills.some((bill) => bill.debtId === id);
  const message = hasLinks
    ? "Excluir esta dívida? As movimentações e contas fixas vinculadas ficarão sem dívida."
    : "Excluir esta dívida?";
  if (!confirm(message)) return;
  state.debts = state.debts.filter((debt) => debt.id !== id);
  state.transactions = state.transactions.map((transaction) => transaction.debtId === id ? { ...transaction, debtId: "" } : transaction);
  state.fixedBills = state.fixedBills.map((bill) => bill.debtId === id ? { ...bill, debtId: "" } : bill);
  saveState();
  renderAll();
  showToast("Dívida excluída.");
}

function goalFromForm() {
  const target = normalizeNumber($("#goalTarget").value);
  const manualSaved = Math.min(target, normalizeNumber($("#goalSaved").value));
  return {
    name: $("#goalName").value.trim(),
    target,
    manualSaved,
    saved: manualSaved,
    deadline: $("#goalDeadline").value,
    notes: $("#goalNotes").value.trim()
  };
}

function handleGoalSubmit(event) {
  event.preventDefault();
  const id = $("#goalId").value;
  const payload = goalFromForm();
  if (!payload.name || !payload.target) {
    showToast("Preencha nome e valor alvo da meta.");
    return;
  }

  if (id) {
    const index = state.goals.findIndex((goal) => goal.id === id);
    if (index !== -1) {
      state.goals[index] = { ...state.goals[index], ...payload, updatedAt: new Date().toISOString() };
    }
    showToast("Meta atualizada.");
  } else {
    state.goals.push({ ...payload, id: uid("goal"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    showToast("Meta salva.");
  }
  resetGoalForm();
  saveState();
  renderAll();
}

function renderGoals() {
  const container = $("#goalList");
  if (!state.goals.length) {
    container.className = "item-list empty-state";
    container.textContent = "Nenhuma meta cadastrada.";
    return;
  }

  container.className = "item-list";
  container.innerHTML = state.goals
    .slice()
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((goal) => {
      const linkedSaved = getLinkedGoalSavedTotal(goal.id);
      const remaining = Math.max(0, goal.target - goal.saved);
      const percent = goal.target ? Math.min(100, (goal.saved / goal.target) * 100) : 0;
      return `
        <article class="item-card">
          <div class="item-card-header">
            <div>
              <h4>${escapeHTML(goal.name)}</h4>
              <p>Prazo: ${formatDate(goal.deadline)}</p>
            </div>
            <span class="badge ${percent >= 100 ? "badge-paid" : "badge-neutral"}">${Math.round(percent)}%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
          <div class="item-metrics">
            <div class="metric-box"><span>Alvo</span><strong>${formatCurrency(goal.target)}</strong></div>
            <div class="metric-box"><span>Guardado total</span><strong>${formatCurrency(goal.saved)}</strong></div>
            <div class="metric-box"><span>Vinculado</span><strong>${formatCurrency(linkedSaved)}</strong></div>
            <div class="metric-box"><span>Falta</span><strong>${formatCurrency(remaining)}</strong></div>
          </div>
          ${goal.notes ? `<p>${escapeHTML(goal.notes)}</p>` : ""}
          <div class="action-group">
            <button class="btn btn-secondary btn-mini" data-action="edit-goal" data-id="${goal.id}">Editar</button>
            <button class="btn btn-danger btn-mini" data-action="delete-goal" data-id="${goal.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function editGoal(id) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return;
  activateTab("goals");
  $("#goalId").value = goal.id;
  $("#goalName").value = goal.name;
  $("#goalTarget").value = goal.target;
  $("#goalSaved").value = goal.manualSaved || 0;
  $("#goalDeadline").value = goal.deadline;
  $("#goalNotes").value = goal.notes || "";
  $("#goalFormTitle").textContent = "Editar meta";
  $("#cancelGoalEdit").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetGoalForm() {
  $("#goalForm").reset();
  $("#goalId").value = "";
  $("#goalDeadline").value = todayISO();
  $("#goalFormTitle").textContent = "Nova meta";
  $("#cancelGoalEdit").classList.add("hidden");
}

function deleteGoal(id) {
  const hasLinks = state.transactions.some((transaction) => transaction.goalId === id) || state.fixedBills.some((bill) => bill.goalId === id);
  const message = hasLinks
    ? "Excluir esta meta? As movimentações e contas fixas vinculadas ficarão sem meta."
    : "Excluir esta meta?";
  if (!confirm(message)) return;
  state.goals = state.goals.filter((goal) => goal.id !== id);
  state.transactions = state.transactions.map((transaction) => transaction.goalId === id ? { ...transaction, goalId: "" } : transaction);
  state.fixedBills = state.fixedBills.map((bill) => bill.goalId === id ? { ...bill, goalId: "" } : bill);
  saveState();
  renderAll();
  showToast("Meta excluída.");
}

function exportJSON(markReminder = false) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "Controle de Gastos Local",
    version: APP_VERSION,
    data: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `controle-gastos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  if (markReminder) markBackupReminderDone();
  showToast("Backup JSON exportado.");
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedData = parsed.data || parsed;
      const normalized = normalizeState(importedData);
      if (!confirm("Importar este JSON substituirá os dados atuais deste navegador. Continuar?")) return;
      state = normalized;
      saveState();
      renderAll();
      showToast("Backup importado com sucesso.");
    } catch (error) {
      console.error(error);
      showToast("Arquivo JSON inválido.");
    } finally {
      $("#importJsonInput").value = "";
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm("Apagar todos os dados locais? Esta ação não pode ser desfeita sem um backup JSON.")) return;
  state = createInitialState();
  localStorage.removeItem(STORAGE_KEY);
  saveState();
  renderAll();
  showToast("Dados locais apagados.");
}

function updateBackupPreview() {
  const preview = $("#backupPreview");
  if (!preview) return;
  const summary = {
    version: APP_VERSION,
    updatedAt: state.settings.updatedAt,
    totals: {
      movimentacoes: state.transactions.length,
      contasFixas: state.fixedBills.length,
      cartoes: state.cards.length,
      dividas: state.debts.length,
      metas: state.goals.length
    }
  };
  preview.textContent = JSON.stringify(summary, null, 2);
}

function getWeekKey(date = new Date()) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function checkBackupReminder() {
  const currentWeek = getWeekKey();
  const lastReminder = localStorage.getItem(REMINDER_KEY);
  if (lastReminder === currentWeek) return;
  $("#backupBanner").classList.remove("hidden");
  $("#backupModal").classList.add("show");
  $("#backupModal").setAttribute("aria-hidden", "false");
}

function markBackupReminderDone() {
  localStorage.setItem(REMINDER_KEY, getWeekKey());
  $("#backupBanner").classList.add("hidden");
  $("#backupModal").classList.remove("show");
  $("#backupModal").setAttribute("aria-hidden", "true");
}

function updateLinkedFieldGroup(groupSelector, selectSelector, shouldShow) {
  const group = $(groupSelector);
  const select = $(selectSelector);
  if (!group || !select) return;
  if (shouldShow) {
    group.classList.remove("hidden");
  } else {
    group.classList.add("hidden");
    select.value = "";
  }
}

function updateTransactionLinkedFields() {
  const category = $("#transactionCategory").value;
  const paymentMethod = $("#transactionPayment").value;
  updateLinkedFieldGroup("#transactionCardGroup", "#transactionCard", requiresCardLink(category, paymentMethod));
  updateLinkedFieldGroup("#transactionDebtGroup", "#transactionDebt", requiresDebtLink(category));
}

function updateFixedLinkedFields() {
  const category = $("#fixedCategory").value;
  const paymentMethod = $("#fixedPayment").value;
  updateLinkedFieldGroup("#fixedCardGroup", "#fixedCard", requiresCardLink(category, paymentMethod));
  updateLinkedFieldGroup("#fixedDebtGroup", "#fixedDebt", requiresDebtLink(category));
}

function toggleCardField() {
  updateTransactionLinkedFields();
}

function activateTab(tab) {
  $$(".nav-btn").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tab}`));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function handleDocumentClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;

  const actions = {
    "edit-transaction": editTransaction,
    "duplicate-transaction": duplicateTransaction,
    "pay-transaction": toggleTransactionPayment,
    "delete-transaction": deleteTransaction,
    "edit-fixed": editFixedBill,
    "delete-fixed": deleteFixedBill,
    "edit-card": editCard,
    "delete-card": deleteCard,
    "edit-debt": editDebt,
    "pay-debt": payDebt,
    "delete-debt": deleteDebt,
    "edit-goal": editGoal,
    "delete-goal": deleteGoal
  };

  if (actions[action]) actions[action](id);
}

function bindEvents() {
  $$(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  $("#periodType").addEventListener("change", renderAll);
  $("#referenceMonth").addEventListener("change", renderAll);

  $("#transactionForm").addEventListener("submit", handleTransactionSubmit);
  $("#fixedForm").addEventListener("submit", handleFixedSubmit);
  $("#cardForm").addEventListener("submit", handleCardSubmit);
  $("#debtForm").addEventListener("submit", handleDebtSubmit);
  $("#goalForm").addEventListener("submit", handleGoalSubmit);

  $("#cancelTransactionEdit").addEventListener("click", resetTransactionForm);
  $("#cancelFixedEdit").addEventListener("click", resetFixedForm);
  $("#cancelCardEdit").addEventListener("click", resetCardForm);
  $("#cancelDebtEdit").addEventListener("click", resetDebtForm);
  $("#cancelGoalEdit").addEventListener("click", resetGoalForm);

  $("#transactionPayment").addEventListener("change", updateTransactionLinkedFields);
  $("#transactionCategory").addEventListener("change", updateTransactionLinkedFields);
  $("#fixedPayment").addEventListener("change", updateFixedLinkedFields);
  $("#fixedCategory").addEventListener("change", updateFixedLinkedFields);
  $("#transactionType").addEventListener("change", () => {
    const isIncome = $("#transactionType").value === "income";
    $("#transactionInstallments").disabled = isIncome;
    if (isIncome) $("#transactionInstallments").value = 1;
  });

  ["#searchInput", "#filterType", "#filterCategory", "#filterStatus", "#filterStart", "#filterEnd"].forEach((selector) => {
    $(selector).addEventListener("input", renderTransactions);
    $(selector).addEventListener("change", renderTransactions);
  });

  ["#dailyStart", "#dailyEnd", "#dailyMin", "#dailyMax", "#dailySort"].forEach((selector) => {
    const field = $(selector);
    if (!field) return;
    field.addEventListener("input", renderDashboard);
    field.addEventListener("change", renderDashboard);
  });

  $("#generateFixedBtn").addEventListener("click", generateFixedBillsForPeriod);
  $("#exportJsonBtn").addEventListener("click", () => exportJSON(false));
  $("#bannerExportBtn").addEventListener("click", () => exportJSON(true));
  $("#modalExportBackup").addEventListener("click", () => exportJSON(true));
  $("#dismissBackupBanner").addEventListener("click", markBackupReminderDone);
  $("#modalDismissBackup").addEventListener("click", markBackupReminderDone);
  $("#clearDataBtn").addEventListener("click", clearAllData);
  $("#importJsonInput").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importJSON(file);
  });

  document.addEventListener("click", handleDocumentClick);
}

function init() {
  state = loadState();
  initializeSelects();
  setDefaultFields();
  bindEvents();
  updateTransactionLinkedFields();
  updateFixedLinkedFields();
  renderAll();
  checkBackupReminder();
}

document.addEventListener("DOMContentLoaded", init);

// PWA / iOS Home Screen support.
// Service workers require http://localhost or HTTPS; file:// is intentionally ignored.
if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app still works without the service worker; localStorage remains available.
    });
  });
}
