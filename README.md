# PCMC — Property Collection Management Center

A web-based platform for managing condominium billing, resident communication via Telegram, and accounts receivable. Built for property management teams handling multiple condo locations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 19, PrimeNG 20, TypeScript |
| Backend | ASP.NET Core (.NET 9), C# |
| Database | PostgreSQL via Entity Framework Core (Npgsql) |
| Realtime | SignalR (QR code streaming, Telegram events) |
| Messaging | Telegram MTProto (TDLib sessions) |
| Auth | JWT Bearer tokens |

---

## Project Structure

```
PCMC/
├── Backend/
│   ├── Library/           # Shared models (EF entities, DTOs)
│   ├── TelegramEngine/    # EF DbContext, SignalR hub, Telegram session logic
│   └── TelegramRoom/      # ASP.NET Core API (controllers, migrations)
└── FrontendAngular/       # Angular SPA
    └── src/app/
        ├── libs/          # Services, models, shared modules
        ├── shared/        # Reusable components (theme switcher, etc.)
        └── views/         # One folder per menu page
```

---

## Running the App

**Backend**
```bash
cd Backend/TelegramRoom
dotnet run
```

**Frontend**
```bash
cd FrontendAngular
npm install
ng serve
```

Apply pending migrations before the first run:
```bash
cd Backend/TelegramRoom
dotnet ef database update
```

---

## Menu Features

### Dashboard

Summary view of the entire portfolio. Filterable by location via a dropdown. Shows:
- Total outstanding balance across all non-Paid bills
- Count of residents with unpaid bills
- Count of overdue bills
- Pending message queue count
- Per-location breakdown cards

### Telegram Accounts

Manage the Telegram bot/user sessions that send messages to residents.

- View all connected and disconnected sessions
- Connect a new account by scanning a QR code (streamed live via SignalR)
- Each account shows name, username, phone, and connection status
- Badge on the sidebar item shows the count of currently connected sessions

### Locations

Manage condo properties (called "locations") and their resident chat assignments.

- Left panel: searchable list of all condo properties. Create, edit, or delete a property.
- Right panel: resident chat list for the selected location. Search by name or Telegram handle.
- Import Chats dialog: bulk-import Telegram contacts to a location from the contact list
- Per-location color coding for visual differentiation

### Units

Manage unit/room records within each property.

- Searchable and filterable by location
- Add or edit a unit (code, floor, building, note)
- Bulk import units from an Excel (.xlsx) file — preview rows before confirming
- Inline confirmation dialog before deleting an active unit

### Residents

Directory of all residents across all properties.

- Searchable by name, code, unit, or Telegram handle
- Filter by location or bill status (Paid / Due / Overdue)
- Read-only list view; resident records are managed through the Locations screen

### Services

Configure the billable service types (e.g. "Monthly Fee", "Maintenance").

- Add, edit, or delete service definitions
- Each service has a name, description, and a Telegram reminder message template
- Template editor supports token insertion: `{name}`, `{service}`, `{amount}`, `{dueDate}`, `{unit}`

### Accounts Receivable (AR)

Core billing workflow. Badge on the sidebar shows the current overdue count.

**Bill list**
- Filter by location, status (Preparing / Due / Overdue / Paid), or service
- Inline editing of any bill field (unit, resident, service, amount, due date, auto-send toggle)
- Mark a bill as Paid via inline action
- Delete a bill with confirmation
- Status is **system-computed** on every GET request based on the bill rule thresholds — it is not editable by the user (except to mark Paid)

**Status lifecycle**
| Status | Meaning |
|---|---|
| Preparing | Due date is in the future |
| Due | Past due date, within the overdue grace window |
| Overdue | Grace window exceeded |
| Paid | Manually confirmed by staff |

Each status transition is recorded as a log entry on the bill.

**Add bill**
- Form row at the top of the table
- Resident resolved by code or name; unit and service picked from dropdowns

**Status Logs tab**
- Full audit trail of status transitions for all bills
- Timestamps, outcome, and optional reason per entry

**Import tab**
- Bulk import bills from an Excel (.xlsx) file
- Preview parsed rows before submitting
- Unmatched units can be created on-the-fly ("new" unit status)
- Import errors reported per-row without blocking the successful rows

### Reminder Scheduler

Configure automated Telegram reminder jobs that run on a schedule.

- List of reminder configurations (one per schedule slot)
- Enable or disable each reminder independently
- Edit the message template inline using the same token system as Services
- Shows how many reminders are currently active

### Message Center

Monitor the outbound Telegram message queue. Badge on the sidebar shows pending count.

- Filter by location, status (Pending / Sent / Delivered / Failed), or search by resident/unit
- Select a message to view its full content and delivery detail
- Read-only — messages are enqueued automatically by the reminder system

### Reports

Financial summary across the entire portfolio.

- Total paid, total outstanding, total overdue amounts
- Overdue bill count
- Per-location breakdown: resident count, bill count, paid vs. outstanding totals

### Administration

System configuration panel with a collapsible left-menu sidebar (PrimeNG PanelMenu). Currently contains:

**Bill Management → Bill Rules**
- Configure the two global thresholds that drive bill status computation:
  - **Preparing Days** — how many days before the due date a bill enters "Preparing"
  - **Overdue Days** — grace period after the due date before a bill becomes "Overdue"
- Settings stored as a JSON blob in the `PcmcUtilityConfigs` table under the key `bill_rule`
- Shows last-updated timestamp

**User Management → Users / User Roles** *(placeholder — not yet implemented)*

**System → System Info** *(placeholder — not yet implemented)*

---

## Data Model Highlights

| Table | Purpose |
|---|---|
| `PcmcProperties` | Condo locations |
| `PcmcUnits` | Rooms/units within a property |
| `PcmcCustomers` | Residents |
| `PcmcCustomerLocations` | Resident ↔ location assignments |
| `PcmcServices` | Billable service types |
| `PcmcBills` | Individual bill records |
| `PcmcBillStatusLogs` | Audit log of bill status transitions |
| `PcmcUtilityConfigs` | Generic JSON config store (e.g. `bill_rule`) |
| `PcmcReminderConfigs` | Reminder schedule and template definitions |
| `TelegramSessions` | Active Telegram account sessions |
| `TelegramMessageLogs` | Outbound message queue and delivery state |

---

## Key Design Decisions

- **Bill status is backend-computed.** Every `GET /bill` call runs a status interceptor that re-evaluates all non-Paid bills against the current bill rule and writes a status log on any transition. The frontend never sends a status value except `"Paid"`.
- **`PcmcUtilityConfigs` as a generic config store.** Instead of dedicated tables per configurable value, all system preferences are stored as JSON blobs identified by a `name` key. New configuration types can be added without schema migrations.
- **Multi-session Telegram.** Multiple Telegram accounts can be connected simultaneously. Each session is keyed by `instanceId` on connect and by `sessionId` thereafter; the system is not gated on a single "current" session.
