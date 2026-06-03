
# Below is a ready-to-save markdown draft for your repo.

---

# Web App Project Structure, Components, Theme, and Design Philosophy

## 1) Project Overview

This project is a **React + TypeScript + Vite** web application, built with **Power Apps integration**, **Tailwind CSS**, and a large set of **custom business components** for fleet, dispatch, chat, monitoring, incidents, and admin workflows.

### Core stack
- **React 19**
- **TypeScript**
- **Vite**
- **React Router**
- **Tailwind CSS 4**
- **Lucide icons**
- **Power Apps Code Apps** integration
- **MapLibre / react-map-gl**
- **Recharts**
- **dnd-kit**

---

## 2) High-Level App Structure

### Main entry and routing
The app is structured around a top-level router and layered providers/guards.

**`src/App.tsx`**
- Uses `HashRouter`
- Wraps the app in:
  - `NotificationProvider`
  - `TaskWorkerProvider`
  - `MaintenanceChecker`
  - `NotificationFetcher`
  - `ErrorChecker`
  - `VersionGuard`
- Defines the route map for:
  - login
  - dashboard
  - order management
  - fleet monitoring
  - developer/admin pages
  - loading / maintenance / error / update pages

### Route flow
```tsx
<Route path="/" element={<Navigate to="/loading" replace />} />
<Route path="/login" element={<Login />} />
<Route path="/dash" element={<ProtectedRoute><DASHPage/></ProtectedRoute>} />
<Route path="/order" element={<ProtectedRoute><ORDER_MANAGEMENT/></ProtectedRoute>} />
<Route path="/fleet" element={<ProtectedRoute><FleetMonitoring/></ProtectedRoute>} />
<Route path="/maintenance" element={<MaintenancePage details={{}} />} />
<Route path="/loading" element={<LoadingPage />} />
<Route path="/error" element={<ErrorPage />} />
<Route path="*" element={<Not_Found />} />
```

### Architecture pattern
The app follows a **provider + guard + route-based page composition** pattern:
1. Global providers manage shared state.
2. Wrappers validate app health/version/maintenance.
3. Pages are protected based on auth/role.
4. Components handle focused UI behavior.

---

## 3) Folder/Feature Structure

## `src/pages`
Primary route-level views such as:
- login
- dashboard
- order management
- fleet monitoring
- loading
- maintenance
- developer
- error
- incident management

## `src/components`
Reusable and feature-specific UI components.

### Major groups
- **Navigation / layout**
  - `Navbar`
  - `NotificationBell`
  - `SettingsModal`
  - `ChatBox`
- **Forms / inputs**
  - `SearchableDropdown`
  - `ModernTimestampInput`
  - `DropFile`
  - `GradientRadioOption`
- **Operational tools**
  - `FleetPairManager`
  - `FuelRequestManager`
  - `IncidentReportForm`
  - `OrderDistributionForm`
- **Monitoring / system**
  - `maintenanceChecker`
  - `errorChecker`
  - `versionChecker`
  - `loaderMask`
- **EWUL-prefixed reusable modules**
  - `ewul_Modal`
  - `ewul_TableFlex`
  - `ewul_DateRangePicker`
  - `ewul_Maps`
  - `ewul_TripTaskTracker`
  - `ewul_CardGallery`
  - etc.

## `src/generated`
Auto-generated service/model layer for backend data access:
- `models/`
- `services/`

This suggests the app is driven by strongly typed backend entities and service wrappers.

## `src/utils`
Shared helpers and contexts:
- notification state
- task worker state
- user state hooks
- data fetching helpers
- formatting utilities

## `src/components/comp_css`
Component-scoped CSS files, one per component or feature area.

---

## 4) Custom and Reusable Components

Below are the most notable reusable/custom components and how they are used.

---

## 4.1 `Navbar`

**File:** `src/components/Navbar.tsx`

### Purpose
The main application navigation bar. It handles:
- user profile menu
- theme switching
- settings modal
- notification bell
- chat shortcut
- task tracker shortcut
- mobile navigation
- role-based nav visibility

### Key features
- Uses `forwardRef` + imperative handle to expose error navigation
- Reads navigation destinations from `truth.config`
- Filters navigation by user position
- Persists theme to `localStorage`
- Listens for custom browser events to navigate to tasks

### How to use
```tsx
<Navbar user={user} onNavigate={handleNavigate} />
```

### Notable behavior
- Theme state is stored in `localStorage` under `gsdc_theme`
- Applies theme via:
```tsx
document.documentElement.setAttribute("data-theme", theme);
```

### Design note
This component is more than navigation; it is a **control center** for global app actions.

---

## 4.2 `ChatBox`

**File:** `src/components/ChatBox.tsx`

### Purpose
A draggable, rich chat window with:
- multi-channel messaging
- unread message counting
- markdown rendering
- message status state
- event-based sending
- minimized/maximized UI

### Key features
- `react-draggable` for movement
- `ReactDOM` for portal-style rendering
- `react-markdown` for formatted messages
- exposes an imperative API:
  - `fetchTotalUnread()`
  - `sendMessage()`

### How to use
```tsx
const chatRef = useRef<ChatBoxHandle>(null);

<ChatBox
  ref={chatRef}
  isOpen={isOpen}
  onClose={() => setOpen(false)}
  onOpen={() => setOpen(true)}
  user={user}
/>
```

### Example sending from outside
```tsx
await chatRef.current?.sendMessage("Hello team", "Dispatch");
```

### Special behavior
Supports custom message tokens:
- `[TRIP:OE123]`
- `[THINK:loading]`

These are rendered as clickable trip mentions or loading indicators.

---

## 4.3 `SearchableDropdown`

**File:** `src/components/SearchableDropdown.tsx`

### Purpose
A flexible dropdown supporting:
- search
- multi-select
- card-style options
- custom styling overrides

### Props
- `options`
- `value`
- `onChange`
- `placeholder`
- `allowSearch`
- `allowMultiple`
- `label`
- `disabled`
- `className`
- `styleOverrides`

### How to use
Single select:
```tsx
<SearchableDropdown
  options={[
    { value: "dispatch", label: "Dispatch" },
    { value: "fleet", label: "Fleet" }
  ]}
  value={selected}
  onChange={setSelected}
  placeholder="Select a department"
/>
```

Multi-select:
```tsx
<SearchableDropdown
  options={options}
  value={selectedValues}
  onChange={setSelectedValues}
  allowMultiple
/>
```

### Card option example
```tsx
{
  value: "truck-1",
  label: "Truck 1",
  type: "card",
  cardConfig: [
    [
      { label: "Unit", value: "Truck 1" },
      { label: "Status", value: "Active", color: "green" }
    ]
  ]
}
```

### Design note
This is a **highly reusable selection primitive** designed to work across simple lists and complex records.

---

## 4.4 `SettingsModal`

**File:** `src/components/SettingsModal.tsx`

### Purpose
Centralized user settings UI with tabs for:
- Appearance
- Debug
- Developer

### What it manages
- theme toggling
- hidden navigation toggle for developers
- custom cursor toggle
- clearing timestamps / notification metadata
- developer navigation

### How to use
```tsx
<SettingsModal
  isOpen={isOpen}
  onClose={() => setOpen(false)}
  theme={theme}
  toggleTheme={toggleTheme}
  hiddenNav={hiddenNav}
  toggleHiddenNav={toggleHiddenNav}
  user={user}
  updateUser={updateUser}
/>
```

### Why it matters
This component demonstrates the app’s philosophy:
- user preferences are first-class
- debug tools are built into the app
- developer-only tools are conditionally exposed

---

## 4.5 `ProtectedRoute`

**File:** `src/components/ewul_ProtectedRoute.tsx`

### Purpose
Route access guard.

### Usage
```tsx
<Route
  path="/dash"
  element={<ProtectedRoute><DASHPage /></ProtectedRoute>}
/>
```

### Role
Ensures certain pages are only accessible after authentication/validation.

---

## 4.6 System/utility components

These are not “visual widgets” only; many act like runtime services.

### `maintenanceChecker`
Redirects or blocks access when the system is in maintenance mode.

### `errorChecker`
Wraps app flow with error detection/reporting behavior.

### `versionChecker`
Checks app version and can force update-required behavior.

### `loaderMask`
Shows a full-screen loading overlay during startup.

### `fetch_notifications`
Starts polling/refresh behavior for notifications.

### `NotificationBell`
Shows unread notifications and notification UX.

---

## 5) Theme System

The app uses a simple but effective **light/dark theme system**.

### Theme storage
Theme is persisted in:
```ts
localStorage.getItem("gsdc_theme")
```

### Theme application
Theme is applied at the document root:
```tsx
document.documentElement.setAttribute("data-theme", theme);
```

This implies the CSS is likely driven by attribute selectors such as:
```css
:root[data-theme="light"] { ... }
:root[data-theme="dark"] { ... }
```

### Where it is controlled
- Theme toggle exists in `Navbar`
- Theme switch is also exposed in `SettingsModal`

### Design implication
The theme system is:
- global
- persistent
- lightweight
- CSS-driven rather than component-heavy

### Practical usage
To respect theme in new components:
1. use theme-aware CSS variables
2. avoid hardcoding colors
3. rely on `data-theme`

---

## 6) Design Philosophy

This app follows a **business dashboard / operations control center** philosophy.

### 6.1 Role-aware UX
Many UI elements are filtered by user position.
- Developers see more tools
- Regular users see only permitted navigation
- Hidden nav can be toggled for developer workflows

### 6.2 Operational first
The app is built for real workflow execution:
- fleet monitoring
- dispatch/order handling
- incidents
- chat coordination
- task tracking
- notifications

### 6.3 Dense but structured
The UI is feature-rich, but components are separated by concern:
- nav
- forms
- dialogs
- overlays
- runtime guards
- data-driven widgets

### 6.4 Stateful components with real-world behavior
Components often include:
- polling
- localStorage persistence
- event listeners
- imperative refs
- backend service calls
- optimistic updates

This is a practical enterprise UI, not a purely presentational app.

### 6.5 Reusable building blocks with specialized variants
The project favors reusable primitives like:
- dropdowns
- modals
- tables
- date inputs
- overlays

Then wraps them in domain-specific feature components.

---

## 7) Usage Guides

## Guide: Add a new page
1. Create a file in `src/pages/`.
2. Import it into `src/App.tsx`.
3. Add a route.
4. Wrap it in `ProtectedRoute` if needed.

Example:
```tsx
import ReportsPage from "./pages/ReportsPage";

<Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
```

---

## Guide: Add a new nav item
Navigation is driven by `truth.config`.
To add a destination:
1. add the destination config
2. provide path, label, whitelist, and hidden flags
3. `Navbar` will render it automatically

---

## Guide: Create a reusable component
Use the existing pattern:
- typed props
- CSS module file under `comp_css`
- optional imperative handle if needed
- theme-aware styling

Example structure:
```txt
src/components/MyWidget.tsx
src/components/comp_css/MyWidget.css
```

Example component:
```tsx
interface MyWidgetProps {
  title: string;
}

export default function MyWidget({ title }: MyWidgetProps) {
  return <div className="my-widget">{title}</div>;
}
```

---

## Guide: Use theme-aware styling
Avoid fixed colors where possible. Prefer:
- CSS variables
- `data-theme`
- inherited styles

Example:
```css
.my-panel {
  background: var(--panel-bg);
  color: var(--text-color);
}
```

---

## Guide: Use the dropdown
Single select:
```tsx
const [value, setValue] = useState("");

<SearchableDropdown
  options={options}
  value={value}
  onChange={setValue}
/>
```

Multiple select:
```tsx
const [values, setValues] = useState<string[]>([]);

<SearchableDropdown
  options={options}
  value={values}
  onChange={setValues}
  allowMultiple
/>
```

---

## Guide: Open settings modal
```tsx
const [settingsOpen, setSettingsOpen] = useState(false);

<SettingsModal
  isOpen={settingsOpen}
  onClose={() => setSettingsOpen(false)}
  theme={theme}
  toggleTheme={toggleTheme}
  hiddenNav={hiddenNav}
  toggleHiddenNav={toggleHiddenNav}
  user={user}
  updateUser={updateUser}
/>
```

---

## Guide: Use ChatBox imperatively
```tsx
const chatRef = useRef<ChatBoxHandle>(null);

await chatRef.current?.sendMessage("Please review this issue", "IT Support");
const unread = await chatRef.current?.fetchTotalUnread();
```

---

## 8) Example Integration Pattern

A typical feature page may look like this:

```tsx
export default function ExamplePage() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Navbar user={user} onNavigate={handleNavigate} />
      <button onClick={() => setOpen(true)}>Open Settings</button>

      <SettingsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        theme={theme}
        toggleTheme={toggleTheme}
        hiddenNav={hiddenNav}
        toggleHiddenNav={toggleHiddenNav}
        user={user}
        updateUser={updateUser}
      />
    </div>
  );
}
```

---

## 9) Recommended Conventions for New Work

- Put route-level screens in `src/pages`
- Put reusable widgets in `src/components`
- Keep component CSS in `src/components/comp_css`
- Use typed props
- Prefer `forwardRef` only when imperative control is needed
- Use `localStorage` only for lightweight user preferences
- Respect `data-theme`
- Keep role-based access logic centralized

---

If you want, I can turn this into a polished file like:

- `PROJECT_STRUCTURE.md`
- `COMPONENT_GUIDE.md`
- `DESIGN_SYSTEM.md`

and format it as a single documentation page or split it into multiple docs.