# TRUTH CONFIG

## Types

- `UserInfo`
  - User profile structure with name, business unit, position, navigation state, unique ID, and optional persistence fields like notification/check timestamps and preferences.

- `StatusKey`
  - Type alias for valid attendance status keys derived from `ATTENDANCE_STATUS_COLORS`.

---

## Core app truth variables

- `APP_VERSION`
  - App version identifier.

- `TRIP_GROUPS`
  - Trip group definitions with ID, label, and color metadata.

- `STATUS_COLORS`
  - UI color mapping for trip progress states.

- `GPS_STATUS_EMOJIS`
  - Status-to-emoji mapping for GPS fleet state.

- `GPS_STATUS_COLOR`
  - GPS fleet status styling with color, label, and shadow.

- `ATTENDANCE_STATUS_COLORS`
  - Attendance status styling definitions with background, text, border, label, and trip metadata.

- `ATTENDANCE_SERVED_COUNTS_INITIAL`
  - Initial attended count label sequence.

- `SPECIAL_POSITIONS`
  - Positions that bypass normal access whitelist.

- `NAV_DESTINATIONS`
  - Navigation items with label, path, whitelist, special-access rules, and hidden flag.

- `BUSINESS_UNITS`
  - Business unit definitions with title, assignment, and type.

- `TRIP_PROGRESS`
  - Ordered trip progress states with index, label, color, selection, and exclusion flags.

- `TRIP_STATUSES`
  - Trip status definitions with status code, alias, progress mapping, dispatch status, and optional metadata.

- `ATTENDANCE_STATUSES`
  - Attendance status rows with sequencing, alias, onduty flag, and sort order.

- `IR_TYPES`
  - Incident report type options.

- `FETCH_LOADING_KEYS`
  - Fetch operation keys used for loading states.

- `GSDC_NAVIGATE_TO_TRIP_key`
  - Navigation key identifier for trip linking.

- `GSDC_SEND_TO_CHAT_key`
  - Chat key identifier for sending data.

- `FR_REQUEST_CATEGORY`
  - Fuel request category options with first-time-only metadata.

- `FR_OE_STATUS`
  - Fuel request OE status options with type metadata.

- `loaderTypeOptions`
  - Loader/unloader type options with trip count and multiplier metadata.

---

## Table and UI configuration exports

- `LIVE_DMS_TABLE_CONFIG`
  - Table module configuration for live DMS data, including columns, filters, renderers, and row styles.

- `orderStatuses`
  - Order status option list.

- `cementTypeOptions`
  - Cement type filter option list.

- `NEW_TRIPS_UNFILTERED_TABLE_CONFIG`
  - Table module configuration for new trip list display.

- `PAIRING_LIST_TABLE_CONFIG`
  - Table module configuration for pairing list display and interaction.

- `cardFields`
  - Card field configuration for summary cards, including title, status element, and render rules.

- `frStatuses`
  - Fuel request status definitions used for table styling.

- `FUEL_REQUESTS_TABLE_CONFIG`
  - Table module configuration for fuel request display.

---

## Incident and log-related exports

- `IR_REPORT_TYPES`
  - Incident report type dropdown options.

- `IR_ACTION_OPTIONS`
  - Incident action option definitions with color metadata.

- `SHORT_BAGS_LIMIT`
  - Numeric limit constant for short bag incident handling.

- `INCIDENT_TABLE_MODULE`
  - Table module configuration for incident report display.

- `TRIP_CONTEXT_TYPES`
  - Trip context/log type list strings.

---

## Endpoint and user ID exports

- `DMS_ATTACHMENTS_ENDPOINT`
  - Power Automate endpoint for fetching attachments.

- `PRINT_DMS_ENDPOINT`
  - Power Automate endpoint for printing.

- `UPLOAD_ATTACHMENTS_ENDPOINT`
  - Power Automate endpoint for uploading attachments.

- `ERROR_EMAIL_ENDPOINT`
  - Power Automate endpoint for sending error emails.

- `GSDC_ANNOUNCEMENT_ENDPOINT`
  - Power Automate endpoint for announcements.

- `DEVBOT_USERID`
  - Developer bot user ID.

- `ITDEV_USERID`
  - IT developer user ID.
