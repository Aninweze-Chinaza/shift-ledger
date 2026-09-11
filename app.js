// Storage Schema Keys
const STORAGE_KEYS = {
  ACTIVE: "shift_ledger_active",
  HISTORY: "shift_ledger_history",
  DEBTS: "shift_ledger_debts",
  MANAGER_PIN: "shift_ledger_manager_pin",
};

// Application State
let activeShift = null;
let shiftHistory = [];
let debts = [];
let auditModalInstance = null;
let managerPinModalInstance = null;
let changePinModalInstance = null;
let handoverModalInstance = null;
let pendingManagerAction = null;

// DOM Elements
const views = {
  open: document.getElementById("viewOpenShift"),
  active: document.getElementById("viewActiveShift"),
  badge: document.getElementById("navShiftBadge"),
};

const forms = {
  startShift: document.getElementById("formStartShift"),
  transaction: document.getElementById("formTransaction"),
  debt: document.getElementById("formDebt"),
};

const displays = {
  cashier: document.getElementById("displayShiftCashier"),
  totalIn: document.getElementById("displayTotalIn"),
  inCount: document.getElementById("displayInCount"),
  outCount: document.getElementById("displayOutCount"),
  expected: document.getElementById("displayExpectedDrawer"),
  transfers: document.getElementById("displayTotalTransfers"),
  posWithdrawals: document.getElementById("displayPosWithdrawals"),
  txCounter: document.getElementById("txListCounter"),
  reconcileExpected: document.getElementById("reconcileExpectedDisplay"),
  reconcileVariance: document.getElementById("reconcileVarianceDisplay"),
  reconcileBadge: document.getElementById("reconcileStatusBadge"),
  denominationTotal: document.getElementById("denominationTotal"),
  debtCount: document.getElementById("debtCount"),
  overdueDebtAlert: document.getElementById("overdueDebtAlert"),
  overdueDebtCount: document.getElementById("overdueDebtCount"),
  overdueDebtMessage: document.getElementById("overdueDebtMessage"),
};

const tables = {
  txBody: document.getElementById("txTableBody"),
  historyBody: document.getElementById("historyTableBody"),
  debtBody: document.getElementById("debtTableBody"),
};

const inputs = {
  cashierName: document.getElementById("inputCashierName"),
  shiftDate: document.getElementById("inputShiftDate"),
  openingCash: document.getElementById("inputOpeningCash"),
  txType: document.getElementById("inputTxType"),
  txAmount: document.getElementById("inputTxAmount"),
  txNote: document.getElementById("inputTxNote"),
  expenseCategory: document.getElementById("expenseCategorySelect"),
  expenseCategoryContainer: document.getElementById("expenseCategoryContainer"),
  debtCustomer: document.getElementById("inputDebtCustomer"),
  debtAmount: document.getElementById("inputDebtAmount"),
  debtDueDate: document.getElementById("inputDebtDueDate"),
  countedCash: document.getElementById("inputCountedCash"),
};

const managerPin = {
  modal: document.getElementById("managerPinModal"),
  form: document.getElementById("managerPinForm"),
  input: document.getElementById("managerPinInput"),
  action: document.getElementById("managerPinAction"),
  feedback: document.getElementById("managerPinFeedback"),
};

const changePin = {
  modal: document.getElementById("changePinModal"),
  form: document.getElementById("changePinForm"),
  current: document.getElementById("currentPinInput"),
  next: document.getElementById("newPinInput"),
  feedback: document.getElementById("changePinFeedback"),
};

const handover = {
  modal: document.getElementById("handoverModal"),
  form: document.getElementById("handoverForm"),
  carriedAmount: document.getElementById("handoverCarriedAmount"),
  incomingCashier: document.getElementById("incomingCashierName"),
  notes: document.getElementById("handoverNotes"),
};

const noteInputs = [
  {
    denomination: 1000,
    input: document.getElementById("inputNote1000"),
    subtotal: document.getElementById("subtotalNote1000"),
  },
  {
    denomination: 500,
    input: document.getElementById("inputNote500"),
    subtotal: document.getElementById("subtotalNote500"),
  },
  {
    denomination: 200,
    input: document.getElementById("inputNote200"),
    subtotal: document.getElementById("subtotalNote200"),
  },
  {
    denomination: 100,
    input: document.getElementById("inputNote100"),
    subtotal: document.getElementById("subtotalNote100"),
  },
  {
    denomination: 50,
    input: document.getElementById("inputNote50"),
    subtotal: document.getElementById("subtotalNote50"),
  },
];

// Utility Helpers
const formatCurrency = (val) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(Number(val) || 0);
};

const getToday = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split("T")[0];
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const computeTotals = (shift) => {
  const opening = Number(shift.openingCash) || 0;
  let totalSales = 0;
  let totalTopups = 0;
  let totalCashPayouts = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;
  let totalPosWithdrawals = 0;
  let totalDebtPayments = 0;

  shift.transactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === "cash_in") totalSales += amt;
    if (tx.type === "float_topup") totalTopups += amt;
    if (
      ["payout_live", "payout_cashout", "payout_cash", "payout"].includes(
        tx.type,
      )
    )
      totalCashPayouts += amt;
    if (tx.type === "expense") totalExpenses += amt;
    if (tx.type === "payout_transfer") totalTransfers += amt;
    if (tx.type === "pos_cashout") totalPosWithdrawals += amt;
    if (tx.type === "debt_payment") totalDebtPayments += amt;
  });

  const totalIn = totalSales + totalTopups + totalDebtPayments;
  const totalOut = totalCashPayouts + totalExpenses + totalPosWithdrawals;
  const expected = opening + totalIn - totalOut;
  return {
    opening,
    totalSales,
    totalTopups,
    totalCashPayouts,
    totalExpenses,
    totalTransfers,
    totalPosWithdrawals,
    totalDebtPayments,
    totalIn,
    totalOut,
    expected,
  };
};

const calculateCountedCash = () => {
  const total = noteInputs.reduce((sum, { denomination, input }) => {
    const count = Math.max(0, parseInt(input.value, 10) || 0);
    const subtotal = denomination * count;
    input.value = count || "";
    input.nextElementSibling.textContent = formatCurrency(subtotal);
    return sum + subtotal;
  }, 0);

  displays.denominationTotal.textContent = formatCurrency(total);
  return total;
};

const getDenominationCounts = () =>
  Object.fromEntries(
    noteInputs.map(({ denomination, input }) => [
      denomination,
      Math.max(0, parseInt(input.value, 10) || 0),
    ]),
  );

const restoreDenominationCounts = (counts = {}) => {
  noteInputs.forEach(({ denomination, input }) => {
    const count = Number(counts[denomination]) || 0;
    input.value = count || "";
  });
  calculateCountedCash();
};

// Storage Controllers
const loadStoredData = () => {
  try {
    const active = localStorage.getItem(STORAGE_KEYS.ACTIVE);
    activeShift = active ? JSON.parse(active) : null;

    const history = localStorage.getItem(STORAGE_KEYS.HISTORY);
    shiftHistory = history ? JSON.parse(history) : [];

    const storedDebts = localStorage.getItem(STORAGE_KEYS.DEBTS);
    debts = storedDebts ? JSON.parse(storedDebts) : [];
  } catch (err) {
    console.error("Failed reading localStorage", err);
    activeShift = null;
    shiftHistory = [];
    debts = [];
  }
};

const persistActiveShift = () => {
  if (activeShift) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(activeShift));
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE);
  }
};

const persistHistory = () => {
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(shiftHistory));
};

const getManagerPin = () =>
  localStorage.getItem(STORAGE_KEYS.MANAGER_PIN) || "1234";

const requestManagerAccess = (actionCallback, actionDescription) => {
  pendingManagerAction = actionCallback;
  managerPin.action.textContent = `Enter the manager PIN to ${actionDescription}.`;
  managerPin.input.value = "";
  managerPin.input.classList.remove("is-invalid");
  managerPin.feedback.textContent = "";

  if (!managerPinModalInstance) {
    managerPinModalInstance = new bootstrap.Modal(managerPin.modal);
  }
  managerPinModalInstance.show();
  managerPin.modal.addEventListener(
    "shown.bs.modal",
    () => managerPin.input.focus(),
    { once: true },
  );
};

managerPin.form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!managerPin.input.checkValidity()) {
    managerPin.input.classList.add("is-invalid");
    managerPin.feedback.textContent = "Enter a valid 4-digit numeric PIN.";
    managerPin.input.focus();
    return;
  }

  if (managerPin.input.value !== getManagerPin()) {
    managerPin.input.classList.add("is-invalid");
    managerPin.feedback.textContent = "Incorrect manager PIN.";
    managerPin.input.select();
    return;
  }

  const approvedAction = pendingManagerAction;
  pendingManagerAction = null;
  managerPin.input.classList.remove("is-invalid");
  managerPin.feedback.textContent = "";
  managerPinModalInstance.hide();
  if (approvedAction) approvedAction();
});

managerPin.modal.addEventListener("hidden.bs.modal", () => {
  pendingManagerAction = null;
  managerPin.form.reset();
  managerPin.input.classList.remove("is-invalid");
  managerPin.feedback.textContent = "";
});

const openChangePinModal = () => {
  changePin.form.reset();
  changePin.current.classList.remove("is-invalid");
  changePin.next.classList.remove("is-invalid");
  changePin.feedback.className = "small";
  changePin.feedback.textContent = "";

  if (!changePinModalInstance) {
    changePinModalInstance = new bootstrap.Modal(changePin.modal);
  }
  changePinModalInstance.show();
  changePin.modal.addEventListener(
    "shown.bs.modal",
    () => changePin.current.focus(),
    { once: true },
  );
};

document
  .getElementById("btnChangePin")
  .addEventListener("click", openChangePinModal);

changePin.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const currentPin = changePin.current.value;
  const newPin = changePin.next.value;
  const pinPattern = /^\d{4}$/;

  changePin.current.classList.remove("is-invalid");
  changePin.next.classList.remove("is-invalid");
  changePin.feedback.className = "small";
  changePin.feedback.textContent = "";

  if (currentPin !== getManagerPin()) {
    changePin.current.classList.add("is-invalid");
    changePin.feedback.classList.add("text-danger");
    changePin.feedback.textContent = "The current PIN is incorrect.";
    changePin.current.focus();
    return;
  }

  if (!pinPattern.test(newPin)) {
    changePin.next.classList.add("is-invalid");
    changePin.feedback.classList.add("text-danger");
    changePin.feedback.textContent = "The new PIN must be exactly 4 digits.";
    changePin.next.focus();
    return;
  }

  localStorage.setItem(STORAGE_KEYS.MANAGER_PIN, newPin);
  changePin.feedback.classList.add("text-success");
  changePin.feedback.textContent = "Manager PIN updated successfully.";
  window.setTimeout(() => changePinModalInstance.hide(), 1000);
});

const openHandoverModal = () => {
  const storedActiveShift = localStorage.getItem(STORAGE_KEYS.ACTIVE);
  const outgoingShift = storedActiveShift
    ? JSON.parse(storedActiveShift)
    : activeShift;

  if (!outgoingShift) {
    alert("There is no active shift to hand over.");
    return;
  }

  const carriedAmount =
    outgoingShift.countedCash !== undefined
      ? Number(outgoingShift.countedCash) || 0
      : Number(inputs.countedCash.value) || 0;
  handover.form.reset();
  handover.carriedAmount.value = carriedAmount.toFixed(2);

  if (!handoverModalInstance) {
    handoverModalInstance = new bootstrap.Modal(handover.modal);
  }
  handoverModalInstance.show();
  handover.modal.addEventListener(
    "shown.bs.modal",
    () => handover.incomingCashier.focus(),
    { once: true },
  );
};

document
  .getElementById("btnOpenHandover")
  .addEventListener("click", openHandoverModal);

handover.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const incomingCashier = handover.incomingCashier.value.trim();
  if (!incomingCashier) {
    handover.incomingCashier.focus();
    return;
  }

  const carriedAmount = Number(handover.carriedAmount.value) || 0;
  const outgoingShift = activeShift;
  if (!outgoingShift) return;

  const totals = computeTotals(outgoingShift);
  const outgoingRecord = {
    ...outgoingShift,
    status: "reconciled",
    openingCash: totals.opening,
    totalIn: totals.totalIn,
    totalOut: totals.totalOut,
    totalTransfers: totals.totalTransfers,
    totalPosWithdrawals: totals.totalPosWithdrawals,
    expected: totals.expected,
    counted: carriedAmount,
    countedCash: carriedAmount,
    handedOverTo: incomingCashier,
    handoverNotes: handover.notes.value.trim(),
    closedAt: new Date().toISOString(),
  };

  const incomingShift = {
    id: `shift_${Date.now()}`,
    cashierName: incomingCashier,
    shiftDate: getToday(),
    startingCash: carriedAmount,
    openingCash: carriedAmount,
    status: "open",
    transactions: [],
    denominationCounts: {},
    countedCash: 0,
    totalSales: 0,
    totalTopups: 0,
    totalCashPayouts: 0,
    totalExpenses: 0,
    totalDebtPayments: 0,
    totalIn: 0,
    totalOut: 0,
    totalTransfers: 0,
    totalPosWithdrawals: 0,
    expected: 0,
  };

  shiftHistory.push(outgoingRecord);
  activeShift = incomingShift;
  persistHistory();
  persistActiveShift();
  inputs.countedCash.value = "";
  handoverModalInstance.hide();
  renderApp();
});

// UI Renderers
const renderApp = () => {
  if (activeShift) {
    views.open.classList.add("d-none");
    views.active.classList.remove("d-none");
    views.badge.textContent = `Active Shift: ${activeShift.cashierName}`;
    views.badge.className =
      "badge bg-success-subtle text-success-emphasis border border-success-subtle";

    renderActiveShiftMetrics();
    renderTransactionsTable();
    renderDebtBook();
    restoreDenominationCounts(activeShift.denominationCounts);
    updateReconciliationDisplay();
  } else {
    views.open.classList.remove("d-none");
    views.active.classList.add("d-none");
    views.badge.textContent = "Cash Drawer Closed";
    views.badge.className =
      "badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle";

    inputs.shiftDate.value = new Date().toISOString().split("T")[0];
    forms.startShift.reset();
    inputs.shiftDate.value = new Date().toISOString().split("T")[0];
  }

  renderDebtBook();
  renderHistoryTable();
};

const renderDebtBook = () => {
  const outstandingDebts = debts.filter((debt) => debt.status === "unpaid");
  const overdueDebts = outstandingDebts.filter(
    (debt) => debt.dueDate < getToday(),
  );

  displays.debtCount.textContent = `${outstandingDebts.length} Outstanding`;
  displays.overdueDebtAlert.classList.toggle(
    "d-none",
    overdueDebts.length === 0,
  );
  displays.overdueDebtAlert.classList.toggle("d-flex", overdueDebts.length > 0);
  displays.overdueDebtCount.textContent = overdueDebts.length;
  displays.overdueDebtMessage.textContent = `${overdueDebts.length} Customer Bills are Overdue!`;
  tables.debtBody.innerHTML = "";

  if (outstandingDebts.length === 0) {
    tables.debtBody.innerHTML =
      '<tr><td colspan="4" class="empty-state py-3">No outstanding customer debts.</td></tr>';
    return;
  }

  outstandingDebts.forEach((debt) => {
    const isOverdue = debt.dueDate < getToday();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="fw-semibold">${escapeHtml(debt.customerName)}</td>
      <td class="small ${isOverdue ? "text-danger fw-semibold" : "text-secondary"}">${escapeHtml(debt.dueDate)}</td>
      <td class="text-end font-tabular">${formatCurrency(debt.amount)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-success" onclick="handleDebtPayment('${debt.id}')"><i class="bi bi-check2 me-1"></i> Paid</button>
        <button class="btn btn-sm btn-outline-danger ms-1" onclick="handleDeleteDebt('${debt.id}')" aria-label="Delete debt for ${escapeHtml(debt.customerName)}"><i class="bi bi-trash3"></i></button>
      </td>
    `;
    tables.debtBody.appendChild(row);
  });
};

const renderActiveShiftMetrics = () => {
  const { totalIn, totalTransfers, totalPosWithdrawals, expected } =
    computeTotals(activeShift);

  displays.cashier.textContent = `${activeShift.cashierName} • ${activeShift.shiftDate}`;
  displays.totalIn.textContent = formatCurrency(totalIn);
  displays.inCount.textContent = "Sales + topups";
  displays.transfers.textContent = formatCurrency(totalTransfers);
  displays.outCount.textContent = "Transfer ledger";
  displays.expected.textContent = formatCurrency(expected);
  displays.posWithdrawals.textContent = formatCurrency(totalPosWithdrawals);
  displays.reconcileExpected.textContent = formatCurrency(expected);
};

const renderTransactionsTable = () => {
  tables.txBody.innerHTML = "";
  displays.txCounter.textContent = `${activeShift.transactions.length} Entries`;

  if (activeShift.transactions.length === 0) {
    tables.txBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <i class="bi bi-inbox fs-3 d-block mb-1"></i>
          No transactions registered yet for this shift.
        </td>
      </tr>
    `;
    return;
  }

  activeShift.transactions
    .slice()
    .reverse()
    .forEach((tx) => {
      const transactionDetails = {
        cash_in: ["badge-cash-in", "Ticket Sale", "+"],
        float_topup: [
          "badge-cash-in",
          "Money Added to Cashier (+ Cash In)",
          "+",
        ],
        payout_live: [
          "badge-payout",
          "Live Bet Winning Paid (- Cash Out)",
          "-",
        ],
        payout_cashout: [
          "badge-payout",
          "Ticket Cashout Paid (- Cash Out)",
          "-",
        ],
        payout_cash: ["badge-payout", "Cash Paid to Winner (- Cash Out)", "-"],
        payout: ["badge-payout", "Cash Paid to Winner (- Cash Out)", "-"],
        payout_transfer: [
          "bg-info-subtle text-info-emphasis",
          "Transfer Sent to Winner (Bank Transfer)",
          "-",
        ],
        pos_cashout: [
          "bg-primary-subtle text-primary-emphasis",
          "POS Cash Given to Customer (- Cash Out)",
          "-",
        ],
        expense: ["badge-expense", "Shop Expense / Fuel (- Cash Out)", "-"],
        debt_issued: [
          "bg-warning-subtle text-warning-emphasis",
          "Customer Debt Issued (Note)",
          "",
        ],
        debt_payment: ["badge-cash-in", "Customer Debt Paid (+ Cash In)", "+"],
      }[tx.type] || ["badge-expense", tx.type, "-"];
      const [badgeClass, typeLabel, sign] = transactionDetails;
      const categoryBadge =
        tx.type === "expense" && tx.category
          ? `<span class="badge bg-secondary-subtle text-secondary-emphasis ms-1">${escapeHtml(tx.category)}</span>`
          : "";

      const row = document.createElement("tr");
      row.innerHTML = `
      <td class="font-tabular small text-secondary">${tx.time}</td>
      <td><span class="badge ${badgeClass}">${typeLabel}</span>${categoryBadge}</td>
      <td class="text-truncate" style="max-width: 200px;">${tx.note || '<span class="text-muted small">No note</span>'}</td>
      <td class="text-end font-tabular fw-semibold">${sign}${formatCurrency(tx.amount)}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-link text-secondary p-0" onclick="handleDeleteTx('${tx.id}')">
          <i class="bi bi-x-circle"></i>
        </button>
      </td>
    `;
      tables.txBody.appendChild(row);
    });
};

const updateReconciliationDisplay = () => {
  const { expected } = computeTotals(activeShift);
  const counted = Number(inputs.countedCash.value) || 0;
  const variance = counted - expected;

  displays.reconcileVariance.textContent =
    (variance > 0 ? "+" : "") + formatCurrency(variance);

  // Buffer minor floating-point jitter
  if (Math.abs(variance) < 0.01) {
    displays.reconcileBadge.className = "badge bg-success";
    displays.reconcileBadge.textContent = "Money Complete";
    displays.reconcileVariance.className =
      "fs-5 fw-bold font-tabular text-success";
  } else if (variance > 0) {
    displays.reconcileBadge.className = "badge bg-primary";
    displays.reconcileBadge.textContent = "Extra Money";
    displays.reconcileVariance.className =
      "fs-5 fw-bold font-tabular text-primary";
  } else {
    displays.reconcileBadge.className = "badge bg-danger";
    displays.reconcileBadge.textContent = "Money Missing";
    displays.reconcileVariance.className =
      "fs-5 fw-bold font-tabular text-danger";
  }
};

const renderHistoryTable = () => {
  tables.historyBody.innerHTML = "";

  if (shiftHistory.length === 0) {
    tables.historyBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <i class="bi bi-clock-history fs-3 d-block mb-1"></i>
          No previous shifts on record.
        </td>
      </tr>
    `;
    return;
  }

  shiftHistory
    .slice()
    .reverse()
    .forEach((item, index) => {
      const originalIndex = shiftHistory.length - 1 - index;
      const variance = item.counted - item.expected;
      const varianceColor =
        Math.abs(variance) < 0.01
          ? "text-success"
          : variance > 0
            ? "text-primary"
            : "text-danger";

      const row = document.createElement("tr");
      row.innerHTML = `
      <td class="font-tabular">${item.shiftDate}</td>
      <td class="fw-semibold">${item.cashierName}</td>
      <td class="text-end font-tabular">${formatCurrency(item.openingCash)}</td>
      <td class="text-end font-tabular text-success">+${formatCurrency(item.totalIn)}</td>
      <td class="text-end font-tabular text-danger">-${formatCurrency(item.totalOut)}</td>
      <td class="text-end font-tabular">${formatCurrency(item.expected)}</td>
      <td class="text-end font-tabular">${formatCurrency(item.counted)}</td>
      <td class="text-end font-tabular fw-bold ${varianceColor}">
        ${(variance > 0 ? "+" : "") + formatCurrency(variance)}
      </td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="showShiftAudit(${originalIndex})">
          <i class="bi bi-eye"></i>
        </button>
      </td>
    `;
      tables.historyBody.appendChild(row);
    });
};

// Handlers & Actions
inputs.txType.addEventListener("change", () => {
  const isExpense = inputs.txType.value === "expense";
  inputs.expenseCategoryContainer.classList.toggle("d-none", !isExpense);
  inputs.expenseCategory.disabled = !isExpense;
  inputs.expenseCategory.required = isExpense;
  if (!isExpense) inputs.expenseCategory.value = "";
});

forms.startShift.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = inputs.cashierName.value.trim();
  const date = inputs.shiftDate.value;
  const startingCash = parseFloat(inputs.openingCash.value);

  if (!name || isNaN(startingCash) || startingCash < 0) return;

  activeShift = {
    id: `shift_${Date.now()}`,
    cashierName: name,
    shiftDate: date,
    openingCash: startingCash,
    status: "open",
    transactions: [],
    denominationCounts: {},
  };

  persistActiveShift();
  inputs.countedCash.value = "";
  noteInputs.forEach(({ input }) => {
    input.value = "";
  });
  calculateCountedCash();
  renderApp();
});

forms.transaction.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!activeShift) return;

  const type = inputs.txType.value;
  const amount = parseFloat(inputs.txAmount.value);
  const note = inputs.txNote.value.trim();
  const selectedCategory = inputs.expenseCategory.value;

  if (isNaN(amount) || amount <= 0 || (type === "expense" && !selectedCategory))
    return;

  const newTx = {
    id: `tx_${Date.now()}`,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    type,
    amount,
    note,
    ...(type === "expense" ? { category: selectedCategory } : {}),
  };

  activeShift.transactions.push(newTx);
  persistActiveShift();

  inputs.txAmount.value = "";
  inputs.txNote.value = "";
  if (type === "expense") inputs.expenseCategory.value = "";
  inputs.txAmount.focus();

  renderActiveShiftMetrics();
  renderTransactionsTable();
  updateReconciliationDisplay();
});

forms.debt.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!activeShift) return;

  const customerName = inputs.debtCustomer.value.trim();
  const amount = parseFloat(inputs.debtAmount.value);
  const dueDate = inputs.debtDueDate.value;
  if (!customerName || isNaN(amount) || amount <= 0 || !dueDate) return;

  const debt = {
    id: `debt_${Date.now()}`,
    customerName,
    amount,
    dateIssued: getToday(),
    dueDate,
    status: "unpaid",
  };
  debts.push(debt);
  activeShift.transactions.push({
    id: `tx_${Date.now()}_debt`,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    type: "debt_issued",
    amount,
    note: `Debt issued to ${customerName}`,
  });
  localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(debts));
  persistActiveShift();
  forms.debt.reset();
  renderActiveShiftMetrics();
  renderTransactionsTable();
  renderDebtBook();
});

window.handleDebtPayment = (id) => {
  if (!activeShift) return;
  const debt = debts.find((item) => item.id === id && item.status === "unpaid");
  if (!debt) return;

  debt.status = "paid";
  activeShift.transactions.push({
    id: `tx_${Date.now()}_payment`,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    type: "debt_payment",
    amount: Number(debt.amount),
    note: `Payment received from ${debt.customerName}`,
  });
  localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(debts));
  persistActiveShift();
  renderActiveShiftMetrics();
  renderTransactionsTable();
  renderDebtBook();
  updateReconciliationDisplay();
};

window.handleDeleteTx = (id) => {
  if (!activeShift) return;
  requestManagerAccess(() => {
    activeShift.transactions = activeShift.transactions.filter(
      (t) => t.id !== id,
    );
    persistActiveShift();
    renderActiveShiftMetrics();
    renderTransactionsTable();
    updateReconciliationDisplay();
  }, "delete this transaction");
};

window.handleDeleteDebt = (id) => {
  const debt = debts.find((item) => item.id === id && item.status === "unpaid");
  if (!debt) return;

  requestManagerAccess(() => {
    debts = debts.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(debts));
    renderDebtBook();
  }, `delete the unpaid debt for ${debt.customerName}`);
};

noteInputs.forEach(({ input }) => {
  input.addEventListener("input", () => {
    calculateCountedCash();
    if (activeShift) {
      activeShift.denominationCounts = getDenominationCounts();
      persistActiveShift();
    }
  });
});

document
  .getElementById("btnApplyDenominations")
  .addEventListener("click", () => {
    const total = calculateCountedCash();
    inputs.countedCash.value = total.toFixed(2);
    if (activeShift) {
      activeShift.countedCash = total;
      persistActiveShift();
    }
    updateReconciliationDisplay();
  });

document.getElementById("btnCloseShift").addEventListener("click", () => {
  if (!activeShift) return;

  const counted = parseFloat(inputs.countedCash.value);
  if (isNaN(counted) || counted < 0) {
    alert("Please enter a valid cash amount counted in hand.");
    inputs.countedCash.focus();
    return;
  }

  const {
    opening,
    totalIn,
    totalOut,
    totalTransfers,
    totalPosWithdrawals,
    expected,
  } = computeTotals(activeShift);
  const variance = counted - expected;
  const statusSummary =
    Math.abs(variance) < 0.01
      ? "Money Complete"
      : variance > 0
        ? "Extra Money"
        : "Money Missing";

  const cashierName = prompt(
    `Re-enter cashier name to close this shift:\n\n${activeShift.cashierName}`,
  );
  if (cashierName === null) return;
  if (cashierName.trim() !== activeShift.cashierName.trim()) {
    alert("Cashier name does not match. Shift remains open.");
    return;
  }

  const confirmClose = confirm(
    `Finish the end of shift cash check for ${activeShift.cashierName}?\n\n` +
      `Cash that should be inside: ${formatCurrency(expected)}\n` +
      `Cash counted in hand: ${formatCurrency(counted)}\n` +
      `Result: ${statusSummary} (${formatCurrency(variance)})`,
  );

  if (!confirmClose) return;

  const closedRecord = {
    ...activeShift,
    status: "reconciled",
    openingCash: opening,
    totalIn,
    totalOut,
    totalTransfers,
    totalPosWithdrawals,
    expected,
    counted,
    denominationCounts: getDenominationCounts(),
    closedAt: new Date().toISOString(),
  };

  shiftHistory.push(closedRecord);
  activeShift = null;

  persistHistory();
  persistActiveShift();
  renderApp();
});

window.showShiftAudit = (index) => {
  const targetShift = shiftHistory[index];
  if (!targetShift) return;

  const modalList = document.getElementById("auditLogList");
  const denominationBreakdown = document.getElementById(
    "auditDenominationBreakdown",
  );
  modalList.innerHTML = "";

  if (targetShift.denominationCounts) {
    const denominationRows = [1000, 500, 200, 100, 50]
      .map((denomination) => {
        const count = Number(targetShift.denominationCounts[denomination]) || 0;
        return `<div class="d-flex justify-content-between small"><span>${formatCurrency(denomination)} notes</span><span class="font-tabular">${count} × ${formatCurrency(denomination)} = ${formatCurrency(count * denomination)}</span></div>`;
      })
      .join("");
    const total = [1000, 500, 200, 100, 50].reduce(
      (sum, denomination) =>
        sum +
        denomination *
          (Number(targetShift.denominationCounts[denomination]) || 0),
      0,
    );
    denominationBreakdown.classList.remove("d-none");
    denominationBreakdown.innerHTML = `
      <div class="small fw-semibold mb-2">Physical Cash Denominations</div>
      <div class="d-grid gap-1">${denominationRows}</div>
      <div class="d-flex justify-content-between border-top mt-2 pt-2 small fw-bold"><span>Total Counted</span><span class="font-tabular">${formatCurrency(total)}</span></div>
    `;
  } else {
    denominationBreakdown.classList.add("d-none");
    denominationBreakdown.innerHTML = "";
  }

  if (targetShift.transactions.length === 0) {
    modalList.innerHTML =
      '<li class="list-group-item text-secondary py-3 text-center">No transactions registered during this shift.</li>';
  } else {
    targetShift.transactions.forEach((tx) => {
      const item = document.createElement("li");
      item.className =
        "list-group-item d-flex justify-content-between align-items-center";
      const isPositive = ["cash_in", "float_topup", "debt_payment"].includes(
        tx.type,
      );
      const isNeutral = tx.type === "debt_issued";
      const typeLabels = {
        cash_in: "Ticket Sale",
        float_topup: "Money Added to Cashier (+ Cash In)",
        payout_live: "Live Bet Winning Paid (- Cash Out)",
        payout_cashout: "Ticket Cashout Paid (- Cash Out)",
        payout_cash: "Cash Paid to Winner (- Cash Out)",
        payout: "Cash Paid to Winner (- Cash Out)",
        payout_transfer: "Transfer Sent to Winner (Bank Transfer)",
        pos_cashout: "POS Cash Given to Customer (- Cash Out)",
        expense: "Shop Expense / Fuel (- Cash Out)",
        debt_issued: "Customer Debt Issued (Note)",
        debt_payment: "Customer Debt Paid (+ Cash In)",
      };
      item.innerHTML = `
        <div>
          <span class="badge ${isNeutral ? "bg-warning-subtle text-warning-emphasis" : isPositive ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"} me-2">
            ${typeLabels[tx.type] || tx.type}
          </span>
          <span class="small text-secondary">${tx.note || "No description"}</span>
          <div class="font-tabular small text-muted">${tx.time}</div>
        </div>
        <span class="font-tabular fw-semibold ${isNeutral ? "text-secondary" : isPositive ? "text-success" : "text-danger"}">
          ${isNeutral ? "" : isPositive ? "+" : "-"}${formatCurrency(tx.amount)}
        </span>
      `;
      modalList.appendChild(item);
    });
  }

  if (!auditModalInstance) {
    auditModalInstance = new bootstrap.Modal(
      document.getElementById("auditModal"),
    );
  }
  auditModalInstance.show();
};

const printShiftReceipt = () => {
  const shift = activeShift || shiftHistory[shiftHistory.length - 1];
  if (!shift) {
    alert("No active or completed shift is available to print.");
    return;
  }

  const totals = computeTotals(shift);
  const counted = activeShift
    ? Number(inputs.countedCash.value) || 0
    : Number(shift.counted) || 0;
  const variance = counted - totals.expected;
  const receiptTime = shift.closedAt ? new Date(shift.closedAt) : new Date();
  const receiptValues = {
    receiptCashier: shift.cashierName,
    receiptDate: shift.shiftDate,
    receiptTime: receiptTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    receiptOpeningCash: formatCurrency(totals.opening),
    receiptTotalIn: formatCurrency(totals.totalIn),
    receiptTotalOut: formatCurrency(totals.totalOut),
    receiptExpected: formatCurrency(totals.expected),
    receiptCounted: formatCurrency(counted),
    receiptVariance: `${variance > 0 ? "+" : ""}${formatCurrency(variance)}`,
  };

  Object.entries(receiptValues).forEach(([id, value]) => {
    document.getElementById(id).textContent = value;
  });

  window.print();
};

window.shareShiftViaWhatsApp = () => {
  const storedActiveShift = localStorage.getItem(STORAGE_KEYS.ACTIVE);
  let shift = null;

  try {
    shift = storedActiveShift ? JSON.parse(storedActiveShift) : null;
  } catch (error) {
    console.error("Failed reading active shift for WhatsApp summary", error);
  }

  if (!shift) {
    try {
      const storedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const history = storedHistory ? JSON.parse(storedHistory) : [];
      shift = Array.isArray(history) ? history[history.length - 1] : null;
    } catch (error) {
      console.error("Failed reading shift history for WhatsApp summary", error);
    }
  }

  const readDomAmount = (element) => {
    const rawValue = element?.value ?? element?.textContent ?? "";
    return (
      Number(
        String(rawValue)
          .replace(/[^0-9.-]/g, "")
          .replace(/,/g, ""),
      ) || 0
    );
  };

  let cashierName;
  let shiftDate;
  let opening;
  let totalIn;
  let totalOut;
  let expected;
  let counted;
  let totalTransfers;

  if (shift) {
    const totals = computeTotals(shift);
    const storedAmount = (value, fallback) =>
      value === undefined || value === null ? fallback : Number(value) || 0;
    cashierName = shift.cashierName;
    shiftDate = shift.shiftDate;
    opening = totals.opening;
    totalIn = storedAmount(shift.totalIn, totals.totalIn);
    totalOut = storedAmount(shift.totalOut, totals.totalOut);
    expected = storedAmount(shift.expected, totals.expected);
    counted =
      shift.countedCash !== undefined
        ? Number(shift.countedCash) || 0
        : Number(shift.counted) || Number(inputs.countedCash.value) || 0;
    totalTransfers = storedAmount(shift.totalTransfers, totals.totalTransfers);
  } else {
    cashierName = inputs.cashierName.value.trim() || "Not entered";
    shiftDate = inputs.shiftDate.value || getToday();
    opening = readDomAmount(inputs.openingCash);
    totalIn = readDomAmount(displays.totalIn);
    expected = readDomAmount(displays.expected);
    counted = readDomAmount(inputs.countedCash);
    totalOut = Math.max(0, opening + totalIn - expected);
    totalTransfers = readDomAmount(displays.transfers);
  }

  const variance = counted - expected;
  const reconciliationStatus =
    Math.abs(variance) < 0.01
      ? "✅ Balanced"
      : variance < 0
        ? "⚠️ Short"
        : "💰 Over";

  const storedDebts =
    localStorage.getItem("shift_ledger_debtors") ||
    localStorage.getItem(STORAGE_KEYS.DEBTS);
  let pendingDebts = [];
  try {
    pendingDebts = storedDebts ? JSON.parse(storedDebts) : [];
  } catch (error) {
    console.error("Failed reading customer debts for WhatsApp summary", error);
  }
  const outstandingDebts = pendingDebts.filter(
    (debt) => debt.status === "unpaid",
  );
  const outstandingDebtTotal = outstandingDebts.reduce(
    (sum, debt) => sum + (Number(debt.amount) || 0),
    0,
  );

  const summary = [
    "*SHIFT LEDGER DAILY SUMMARY*",
    "",
    `*Cashier:* ${cashierName}`,
    `*Date:* ${shiftDate}`,
    "",
    `• *Starting Float:* ${formatCurrency(opening)}`,
    `• *Total Cash In:* ${formatCurrency(totalIn)}`,
    `• *Total Cash Out:* ${formatCurrency(totalOut)}`,
    `• *Expected Drawer:* ${formatCurrency(expected)}`,
    `• *Counted Cash:* ${formatCurrency(counted)}`,
    `• *Variance:* ${variance > 0 ? "+" : ""}${formatCurrency(variance)}`,
    `• *Digital Transfers:* ${formatCurrency(totalTransfers)}`,
    `• *Reconciliation:* ${reconciliationStatus}`,
    "",
    `*Outstanding Credit:* ${formatCurrency(outstandingDebtTotal)} (${outstandingDebts.length} ${outstandingDebts.length === 1 ? "account" : "accounts"})`,
  ].join("\n");

  const encodedMessage = encodeURIComponent(summary);
  window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
};

document
  .getElementById("btnPrintSlip")
  .addEventListener("click", printShiftReceipt);

document.getElementById("btnExportCSV").addEventListener("click", () => {
  if (shiftHistory.length === 0) {
    alert("No past shift data available to export.");
    return;
  }

  const headers = [
    "ShiftID",
    "Date",
    "Cashier",
    "StartingCash",
    "TotalIn",
    "PhysicalCashOut",
    "TransfersPaidOut",
    "PosWithdrawalsDisbursed",
    "Expected",
    "Counted",
    "Variance",
    "ExpenseCategory",
  ];
  const csvRows = [headers.join(",")];

  shiftHistory.forEach((s) => {
    const variance = (s.counted - s.expected).toFixed(2);
    const row = [
      `"${s.id}"`,
      `"${s.shiftDate}"`,
      `"${s.cashierName.replace(/"/g, '""')}"`,
      s.openingCash.toFixed(2),
      s.totalIn.toFixed(2),
      s.totalOut.toFixed(2),
      (s.totalTransfers || 0).toFixed(2),
      (s.totalPosWithdrawals || 0).toFixed(2),
      s.expected.toFixed(2),
      s.counted.toFixed(2),
      variance,
      `"${(s.transactions || [])
        .filter((tx) => tx.type === "expense" && tx.category)
        .map((tx) => tx.category)
        .join("; ")
        .replace(/"/g, '""')}"`,
    ];
    csvRows.push(row.join(","));
  });

  const blob = new Blob([csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `shift_ledger_export_${new Date().toISOString().split("T")[0]}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

document.getElementById("btnClearHistory").addEventListener("click", () => {
  if (shiftHistory.length === 0) return;
  const confirmed = confirm(
    "Are you sure you want to permanently clear all historical shifts?",
  );
  if (!confirmed) return;

  requestManagerAccess(() => {
    shiftHistory = [];
    persistHistory();
    renderHistoryTable();
  }, "clear all past shift history");
});

// Initialization
loadStoredData();
renderApp();
