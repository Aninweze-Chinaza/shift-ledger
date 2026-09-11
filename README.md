# ⚡ Shift Ledger — Front-Counter Cash Reconciliation

[![Status](https://img.shields.io/badge/Status-Production--Ready-success?style=flat-square)](#)
[![Stack](https://img.shields.io/badge/Stack-HTML5%20%7C%20Bootstrap%205%20%7C%20Vanilla%20JS-blue?style=flat-square)](#)
[![Storage](https://img.shields.io/badge/Storage-Browser%20LocalStorage-orange?style=flat-square)](#)


> An offline-first, client-side bookkeeping workspace tailored for commercial sports betting shops, agency banking hubs, and cash-heavy retail counters. Eliminates daily paper sheets, prevents drawer leakage, and automates closing reconciliation.

---

## 📌 Problem & Motivation

In fast-paced retail and wagering retail outlets, shift accounting often relies on scribbled paper receipts, leading to common operational pitfalls:

- Unaccounted cash payouts made in haste during live match events.
- Confusion when a cashier uses personal/store bank transfer apps to pay large winner claims due to low drawer liquidity.
- Unbalanced books caused by blending customer POS card withdrawals into standard cash sales.
- Time wasted performing manual arithmetic at close of business.

**Shift Ledger** introduces structured event-based bookkeeping that isolates physical till float from electronic transfers while providing real-time visibility into drawer variance.

---

## 💼 Transaction Matrix & Ledger Logic

The engine separates **Physical Drawer Cash** from **Electronic Bank Settlements** across every transaction type:

| Transaction Flow | Classification | Physical Till Impact | Bank/Electronic Impact | Context |
| :--- | :--- | :---: | :---: | :--- |
| **Ticket Sale** | Cash In | **+ Increase** | Neutral | Customer pays physical cash for a game slip. |
| **Money Added (Top-Up)** | Cash In | **+ Increase** | Neutral | Manager delivers physical notes to increase cashier float. |
| **Live Bet Winning Paid** | Cash Out | **− Decrease** | Neutral | Instant physical payout for concluded live events. |
| **Ticket Cashout Paid** | Cash Out | **− Decrease** | Neutral | Early settlement payout before bet events finish. |
| **POS Cash Given to Customer** | Cash Out | **− Decrease** | **+ Credited** | Customer withdraws cash via shop POS terminal. |
| **Shop Expense / Fuel** | Cash Out | **− Decrease** | Neutral | Out-of-pocket cash spent on diesel, print rolls, or supplies. |
| **Transfer Sent to Winner** | Digital Out | **Neutral (0)** | **− Debited** | Bank transfer sent to a customer when drawer cash is low. |

---

## 🧮 Reconciliation Mathematics

### 1. Physical Drawer Equation
$$\text{Expected Drawer} = \text{Starting Float} + \sum \text{Cash In} - \sum \text{Cash Out}$$

Where:
* $\sum \text{Cash In} = \text{Ticket Sales} + \text{Money Added to Cashier}$
* $\sum \text{Cash Out} = \text{Live Bet Winnings} + \text{Ticket Cashouts} + \text{POS Cash Given Out} + \text{Expenses}$

### 2. Variance Computation
$$\text{Variance} = \text{Actual Counted Cash} - \text{Expected Drawer}$$

* $\text{Variance} = 0 \longrightarrow$ **Balanced** (Money is complete)
* $\text{Variance} > 0 \longrightarrow$ **Over** (Surplus cash inside drawer)
* $\text{Variance} < 0 \longrightarrow$ **Short** (Drawer deficit / missing cash)

> *Note: Bank Transfers Sent are audited separately in the digital summary feed and do not influence physical drawer expectations.*

---

## ✨ Core Features (v1.0 Production)

* **Denomination Calculator:** Built-in physical cash breakdown (₦1,000, ₦500, ₦200, ₦100, ₦50 notes) that auto-tallies drawer cash directly into closing reconciliation.
* **Thermal POS Slip Layout (`@media print`):** Formatted specifically for standard 58mm and 80mm thermal receipt printers with cashier and manager signature blocks.
* **Manager PIN Operational Guardrail:** 4-digit PIN verification intercepting sensitive actions (record deletion, history wiping) with in-app PIN updates.
* **Shift Handover Protocol:** Carry forward closing counted cash directly into the next cashier's opening float with transfer audit notes.
* **WhatsApp Daily Summary Card:** One-tap export opening WhatsApp Web/App pre-loaded with a formatted daily variance breakdown for store owners.
* **Granular Expense Tagging:** Dynamic categorization (Fuel/Generator, Thermal Rolls, NEPA/Power Tokens, Maintenance, Welfare) logged directly into records.
* **Customer Debt Ledger & Overdue Alerts:** Track unpaid customer tickets with payback dates and real-time visual alerts for overdue debts.
* **State Persistence Across Refreshes:** Active shift state resides in `shift_ledger_active` to safeguard unsaved entries during power cuts or accidental browser tab closures.
* **Spreadsheet Portability:** Export full shift logs into structured `.csv` files ready for Microsoft Excel or Google Sheets.
* **Zero Network Footprint:** Runs entirely client-side without databases, API keys, or an active internet connection.

---

## 📂 Project Architecture

```text
shift-ledger/
├── index.html        # App structure, forms, data-binding targets, audit modal
├── style.css         # Typography, custom variables, and tabular numeric alignment
├── app.js            # State machine, math engine, storage controllers, event handlers
└── README.md         # Operational handbook and technical manual
```

##  Roadmap & Future Enhancements(v2.0 & Scalability)

- **Backend-as-a-Service Integration (Supabase / PocketBase):** Migrate from LocalStorage to a cloud database for real-time multi-terminal syncing across shop counters.
- **Role-Based Authentication (RBAC):** True server-side JWT authentication separating Cashier entry permissions from Manager deletion privileges.
- **IndexedDB Migration:** Browser offline storage expansion for retail outlets handling months of heavy transaction volume without browser memory limits.
-  **Analytics Dashboard:** Graphical trend charts displaying daily turnover, fuel consumption patterns, and peak winning payout hours.

## 👩‍💻 Author

**Chinaza Aninweze**  
*Frontend Engineering & Financial Data Tooling*

[![GitHub](https://img.shields.io/badge/GitHub-Profile-181717?style=flat-square&logo=github)](https://github.com/Aninweze-Chinaza)