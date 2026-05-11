# GSDC Dispatch App - Conversation Summary - April 15, 2026

This document summarizes the development session focusing on improving the data fetching mechanisms in the `OrderManagement.tsx` component.

---

## Feature: Fetch Throttling and Cooldown

- **Objective:** Prevent API abuse and unnecessary server load by limiting how often fetch functions can be called.

- **Implementation:**
  - A `canFetch` helper function was created to check if a 5-second cooldown has passed since the last call.
  - This check was integrated into `fetchNewOrders`, `fetchTrips`, `fetchTruckList`, and `fetchDriverHelperList`.
  - The logic was later refined to check for a valid date range *before* initiating the cooldown check to avoid wasting a fetch cycle.

---

## Feature: Centralized and Conditional Startup Fetch

- **Objective:** Consolidate all on-mount data fetching into a single, manageable block and ensure it only runs when necessary.

- **Implementation:**
  - A `handleRefresh` function was created to encapsulate all primary data fetching logic (`fetchTruckList`, `fetchDriverHelperList`, `fetchTrips`, etc.).
  - The initial `useEffect` hook now calls `handleRefresh` and is dependent on `selectedRange`, ensuring that fetches only run after a date range is available.

---

## Feature: Manual and Scheduled Refresh

- **Objective:** Provide both a manual refresh button and an automatic, time-based refresh to keep data current.

- **Implementation:**
  - The main "Refresh" button in the header is now connected to the `handleRefresh` function.
  - A new `useEffect` hook was added to set up a `setInterval` that calls `handleRefresh` every 60 seconds.
  - A cleanup function is included to clear the interval when the component unmounts, preventing memory leaks.

---
