// Storage Schema Keys
const STORAGE_KEYS = {
  ACTIVE: "shift_ledger_active",
  HISTORY: "shift_ledger_history",
  DEBTS: "shift_ledger_debts",
};

// Application State
let activeShift = null;
let shiftHistory = [];
let debts = [];
let auditModalInstance = null;

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
  debtCustomer: document.getElementById("inputDebtCustomer"),
  debtAmount: document.getElementById("inputDebtAmount"),
  debtDueDate: document.getElementById("inputDebtDueDate"),
  countedCash: document.getElementById("inputCountedCash"),
};

const noteInputs = [
  { denomination: 1000, input: document.getElementById("inputNote1000") },
  { denomination: 500, input: document.getElementById("inputNote500") },
  { denomination: 200, input: document.getElementById("inputNote200") },
  { denomination: 100, input: document.getElementById("inputNote100") },
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
    return sum + denomination * count;
  }, 0);

  inputs.countedCash.value = total.toFixed(2);
  return total;
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
      <td class="text-end"><button class="btn btn-sm btn-outline-success" onclick="handleDebtPayment('${debt.id}')"><i class="bi bi-check2 me-1"></i> Paid</button></td>
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

      const row = document.createElement("tr");
      row.innerHTML = `
      <td class="font-tabular small text-secondary">${tx.time}</td>
      <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
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
  };

  persistActiveShift();
  inputs.countedCash.value = "";
  noteInputs.forEach(({ input }) => {
    input.value = "";
  });
  renderApp();
});

forms.transaction.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!activeShift) return;

  const type = inputs.txType.value;
  const amount = parseFloat(inputs.txAmount.value);
  const note = inputs.txNote.value.trim();

  if (isNaN(amount) || amount <= 0) return;

  const newTx = {
    id: `tx_${Date.now()}`,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    type,
    amount,
    note,
  };

  activeShift.transactions.push(newTx);
  persistActiveShift();

  inputs.txAmount.value = "";
  inputs.txNote.value = "";
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
  activeShift.transactions = activeShift.transactions.filter(
    (t) => t.id !== id,
  );
  persistActiveShift();
  renderActiveShiftMetrics();
  renderTransactionsTable();
  updateReconciliationDisplay();
};

noteInputs.forEach(({ input }) => {
  input.addEventListener("input", () => {
    calculateCountedCash();
    updateReconciliationDisplay();
  });
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
  modalList.innerHTML = "";

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
  if (confirmed) {
    shiftHistory = [];
    persistHistory();
    renderHistoryTable();
  }
});

// Initialization
loadStoredData();
renderApp();
