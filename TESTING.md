# Testing Manual — Wykonczymy

## Prerequisites

```bash
docker compose up -d      # Postgres
pnpm dev                  # http://localhost:3000
```

## 1. Login

Go to **http://localhost:3000/zaloguj**

Seed account: `admin@wykonczymy.pl` / `admin123`

To properly test, create users via the admin panel (**http://localhost:3000/admin**):
- 1 OWNER or MANAGER account (management flows)
- 1 EMPLOYEE account (employee-only flows)

---

## 2. Setup Data (Admin Panel)

Before testing business flows, create reference data at `/admin`:

1. **Cash Registers** → Create at least 1 (e.g. "Kasa główna")
2. **Investments** → Create at least 1 with status "active" (e.g. "Remont Kowalski")
3. **Users** → Create an EMPLOYEE user (e.g. "Jan Kowalski", role: EMPLOYEE)

---

## 3. Test Flows (as MANAGER/OWNER/ADMIN)

### 3a. Dashboard — `/`

- Shows cash register balances, active investments count, recent transactions
- Verify all stat cards render

### 3b. Create a Transaction — Sidebar "Nowa transakcja" button

- Select type **Zaliczka (ADVANCE)** → worker field appears, investment hidden
- Select type **Wydatek inwestycyjny** → investment field appears, worker hidden
- Select type **Wydatek pracowniczy** → both worker + investment appear
- Select type **Inne** → otherCategory field appears
- Attach invoice file OR fill invoice note (both empty = error)
- Submit → toast confirms, appears in `/transakcje`

### 3c. Transactions List — `/transakcje`

- Verify filters: type, cash register, date range
- Pagination works if >20 transactions
- "Nowa transakcja" button in header

### 3d. Investments — `/inwestycje`

- List of all investments with totalCosts
- Click → detail page `/inwestycje/[id]` with transaction history

### 3e. Cash Registers — `/kasa`

- List with balance per register
- Click → detail `/kasa/[id]` with transaction history

### 3f. Users — `/uzytkownicy`

- List of all users with roles
- Click → detail `/uzytkownicy/[id]` with saldo + transactions

### 3g. Zero Saldo — `/uzytkownicy/[id]`

1. First create an **ADVANCE** transaction for an employee (gives them saldo > 0)
2. Go to that employee's detail page
3. **"Zeruj saldo"** button should appear next to the saldo card
4. Click → dialog opens, select investment, cash register, payment method
5. Confirm → saldo becomes 0, new EMPLOYEE_EXPENSE appears in their transactions

### 3h. Settlement — `/rozliczenia`

1. Select an employee → their saldo loads below the dropdown
2. Fill: investment, date, cash register, payment method
3. Add line items:
   - Row 1: "Farba biała 10L" — 150
   - Row 2: "Pędzle 3szt" — 45
   - Row 3: "Folia malarska" — 25
4. Running total should show **220,00 zł**
5. Summary card shows: current saldo, settlement total, new saldo after
6. Attach invoice file or write note
7. Submit → toast "Utworzono 3 transakcji"
8. Redirects to `/transakcje` → 3 new EMPLOYEE_EXPENSE rows visible
9. Go back to employee's detail page → saldo decreased by 220

---

## 4. Test as EMPLOYEE

Log in as the EMPLOYEE user.

- **Sidebar**: only "Kokpit" and "Transakcje" visible
- **Dashboard** `/`: shows personal saldo + month selector with own transactions
- **Transactions** `/transakcje`: only own transactions visible (auto-filtered)
- Navigating to `/inwestycje`, `/kasa`, `/uzytkownicy`, `/rozliczenia` → redirects to `/`

---

## 5. Sidebar Navigation Check

| Link | Icon | Visible to |
|------|------|-----------|
| Kokpit | LayoutDashboard | all |
| Transakcje | ArrowLeftRight | all |
| Inwestycje | Building2 | management |
| Kasa | Wallet | management |
| Użytkownicy | Users | management |
| Rozliczenia | Receipt | management |
