(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const API = "/api";
  const GLYPH = { Economy: "🚗", Midsize: "🚘", SUV: "🚙", Luxury: "🚕", Minivan: "🚐" };
  const TYPE_ORDER = ["Economy", "Midsize", "SUV", "Luxury", "Minivan"];

  let vehicles = [];
  let bookings = [];
  let invoices = [];
  let currentUser = null;

  // ---------- API helpers ----------
  async function api(path, opts = {}) {
    const headers = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...opts.headers,
    };
    const res = await fetch(API + path, { ...opts, headers, credentials: "include", cache: "no-store" });

    if (res.status === 401) {
      showLogin("Your session has ended. Please sign in again.");
      throw new Error("Authentication required");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Request failed (" + res.status + ")");
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ---------- Authentication ----------
  function showLogin(message) {
    currentUser = null;
    byId("admin-app").hidden = true;
    byId("auth-screen").hidden = false;
    const error = byId("login-error");
    error.textContent = message || "";
    error.hidden = !message;
    byId("login-password").value = "";
  }

  function showApp(user) {
    currentUser = user;
    byId("auth-screen").hidden = true;
    byId("admin-app").hidden = false;
    byId("account-label").textContent = (user.name || user.email) + " · " + (user.role === "admin" ? "Admin" : "Worker");

    const isAdmin = user.role === "admin";
    document.querySelectorAll(".admin-only").forEach((el) => { el.hidden = !isAdmin; });

    if (isAdmin) {
      loadUsers();
      loadActivity();
    }
  }

  async function boot() {
    try {
      const session = await api("/auth/me");
      showApp(session.user);
      await init();
    } catch (err) {
      if (!currentUser) showLogin("");
    }
  }

  async function loadVehicles() {
    vehicles = await api("/vehicles");
    return vehicles;
  }

  async function createVehicle(data) {
    const v = await api("/vehicles", {
      method: "POST",
      body: JSON.stringify(data),
    });
    vehicles.unshift(v);
    return v;
  }

  async function updateVehicle(id, data) {
    const v = await api("/vehicles?id=" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const idx = vehicles.findIndex((x) => x.id === v.id);
    if (idx >= 0) vehicles[idx] = v;
    return v;
  }

  async function deleteVehicle(id) {
    await api("/vehicles?id=" + id, { method: "DELETE" });
    vehicles = vehicles.filter((x) => x.id !== id);
  }

  async function loadBookings() {
    bookings = await api("/bookings");
    return bookings;
  }

  async function createBooking(data) {
    const b = await api("/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    });
    bookings.unshift(b);
    return b;
  }

  async function deleteBooking(id) {
    await api("/bookings?id=" + id, { method: "DELETE" });
    bookings = bookings.filter((x) => x.id !== id);
  }

  async function loadInvoices() {
    invoices = await api("/invoices");
    return invoices;
  }

  async function createInvoice(data) {
    const inv = await api("/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });
    invoices.unshift(inv);
    return inv;
  }

  async function updateInvoice(id, data) {
    const inv = await api("/invoices?id=" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const idx = invoices.findIndex((x) => x.id === inv.id);
    if (idx >= 0) invoices[idx] = inv;
    return inv;
  }

  async function deleteInvoice(id) {
    await api("/invoices?id=" + id, { method: "DELETE" });
    invoices = invoices.filter((x) => x.id !== id);
  }

  // ---------- Team & activity ----------
  async function loadUsers() {
    try {
      const data = await api("/admin/users");
      renderUsers(data.users || []);
    } catch (err) {
      toast(err.message);
    }
  }

  async function loadActivity() {
    try {
      const data = await api("/admin/activity");
      renderActivity(data.events || []);
    } catch (err) {
      toast(err.message);
    }
  }

  function renderUsers(users) {
    const tbody = byId("users-tbody");
    const empty = byId("users-empty");
    tbody.innerHTML = "";
    empty.hidden = users.length > 0;

    users.forEach((user) => {
      const row = document.createElement("tr");

      const name = document.createElement("td");
      name.textContent = user.full_name || "—";
      row.appendChild(name);

      const email = document.createElement("td");
      email.textContent = user.email;
      row.appendChild(email);

      const role = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "badge badge--" + (user.role === "admin" ? "available" : "upcoming");
      badge.textContent = user.role === "admin" ? "Admin" : "Worker";
      role.appendChild(badge);
      row.appendChild(role);

      const lastLogin = document.createElement("td");
      lastLogin.textContent = user.last_login_at ? fmtStamp(user.last_login_at) : "Never";
      row.appendChild(lastLogin);

      const access = document.createElement("td");
      access.textContent = user.is_active
        ? "Active" + (user.active_sessions ? " · " + user.active_sessions + " session" + (user.active_sessions > 1 ? "s" : "") : "")
        : "Disabled";
      row.appendChild(access);

      const actions = document.createElement("td");
      const resetBtn = document.createElement("button");
      resetBtn.className = "btn small edit";
      resetBtn.textContent = "Reset password";
      resetBtn.title = "Set a new password for this user";
      resetBtn.addEventListener("click", () => resetUserPassword(user));
      actions.appendChild(resetBtn);

      const roleBtn = document.createElement("button");
      roleBtn.className = "btn small archive";
      roleBtn.textContent = user.role === "admin" ? "Make worker" : "Make admin";
      roleBtn.title = "Change this user's role";
      roleBtn.addEventListener("click", () => changeUserRole(user));
      actions.appendChild(roleBtn);

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "btn small danger";
      toggleBtn.textContent = user.is_active ? "Disable" : "Enable";
      toggleBtn.title = user.is_active ? "Disable this account" : "Enable this account";
      toggleBtn.addEventListener("click", () => toggleUserActive(user));
      actions.appendChild(toggleBtn);

      row.appendChild(actions);
      tbody.appendChild(row);
    });
  }

  function renderActivity(events) {
    const tbody = byId("activity-tbody");
    const empty = byId("activity-empty");
    tbody.innerHTML = "";
    empty.hidden = events.length > 0;

    events.forEach((event) => {
      const row = document.createElement("tr");
      const when = document.createElement("td");
      when.textContent = fmtStamp(event.created_at);
      const who = document.createElement("td");
      who.textContent = event.actor_email || "System";
      const action = document.createElement("td");
      action.textContent = event.action;
      const details = document.createElement("td");
      details.textContent = event.entity + (event.details && Object.keys(event.details).length ? " · " + JSON.stringify(event.details) : "");
      row.append(when, who, action, details);
      tbody.appendChild(row);
    });
  }

  // ---------- Date helpers ----------
  function toISOLocal(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function todayStr() { return toISOLocal(new Date()); }
  function parseDate(s) {
    const parts = String(s || "").split("-").map(Number);
    const d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    return isNaN(d) ? null : d;
  }
  function fmtDate(s) {
    const d = parseDate(s);
    if (!d) return String(s);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function fmtStamp(s) {
    const d = new Date(s);
    if (isNaN(d)) return String(s || "—");
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function daysBetween(start, end) {
    const a = parseDate(start), b = parseDate(end);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000) + 1;
  }
  function isActive(b) {
    if (!b) return false;
    const today = parseDate(todayStr());
    return !!today && !!parseDate(b.start_date) && !!parseDate(b.end_date) && parseDate(b.start_date) <= today && today <= parseDate(b.end_date);
  }
  function bookingDisplayStatus(b) {
    if (isActive(b)) return "Active";
    const end = parseDate(b.end_date);
    const today = parseDate(todayStr());
    if (end && today && end < today) return "Completed";
    return "Upcoming";
  }
  function invoiceStatusLabel(inv) {
    if (inv.status === 'settled') return { label: 'Settled', badge: 'settled' };
    if (inv.status === 'overdue') return { label: 'Overdue', badge: 'overdue' };
    return { label: 'Pending', badge: 'pending' };
  }
  function addDays(s, n) {
    const d = parseDate(s);
    if (!d) return s;
    d.setDate(d.getDate() + n);
    return toISOLocal(d);
  }

  // ---------- Toast ----------
  function toast(message) {
    const el = byId("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("visible");
    setTimeout(() => el.classList.remove("visible"), 2600);
  }

  // ---------- Status & stats ----------
  function vehicleStatus(v) {
    if (v.status === "archived") return { label: "Archived", badge: "archived", note: "Hidden from the rental fleet." };
    const active = bookings.find((b) => b.vehicle_id === v.id && isActive(b));
    if (active) return { label: "Rented", badge: "rented", note: "Rented until " + fmtDate(active.end_date) };
    const upcoming = bookings.find((b) => b.vehicle_id === v.id && parseDate(b.start_date) > parseDate(todayStr()));
    if (upcoming) return { label: "Upcoming", badge: "upcoming", note: "Booked from " + fmtDate(upcoming.start_date) };
    return { label: "Available", badge: "available", note: "Ready for new bookings" };
  }

  function statTotals() {
    const nonArchived = vehicles.filter((v) => v.status !== "archived");
    const statuses = vehicles.map(vehicleStatus);
    const rented = statuses.filter((s) => s.label === "Rented").length;
    return {
      total: vehicles.length,
      rented,
      available: statuses.filter((s) => s.label === "Available").length,
      upcoming: statuses.filter((s) => s.label === "Upcoming").length,
      bookedDays: bookings.reduce((n, b) => n + daysBetween(b.start_date, b.end_date), 0),
      utilization: nonArchived.length ? Math.round((rented / nonArchived.length) * 100) : 0,
    };
  }

  // ---------- Rendering: stats ----------
  function renderStats() {
    const totals = statTotals();
    const items = [
      ["Total vehicles", totals.total],
      ["Rented now", totals.rented],
      ["Available", totals.available],
      ["Upcoming", totals.upcoming],
      ["Booked days", totals.bookedDays],
      ["Utilization", totals.utilization + "%"],
    ];
    const grid = byId("stats-grid");
    grid.innerHTML = "";
    items.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "stat-card";
      card.innerHTML = '<span class="stat-label">' + label + '</span><span class="stat-value">' + value + "</span>";
      grid.appendChild(card);
    });
  }

  // ---------- Rendering: vehicles ----------
  function renderVehicleGrid() {
    const grid = byId("vehicle-grid");
    grid.innerHTML = "";
    vehicles.forEach((v) => grid.appendChild(renderVehicleCard(v)));
    if (!vehicles.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No vehicles yet — add one above.";
      grid.appendChild(p);
    }
  }

  function renderVehicleCard(v) {
    const st = vehicleStatus(v);
    const card = document.createElement("article");
    card.className = "vehicle-card";

    const imgWrap = document.createElement("div");
    imgWrap.className = "vehicle-card-image";
    const ph = document.createElement("div");
    ph.className = "vehicle-placeholder card-img card-img--" + v.type.toLowerCase();
    const span = document.createElement("span");
    span.className = "car-glyph";
    span.textContent = GLYPH[v.type] || "🚗";
    ph.appendChild(span);
    imgWrap.appendChild(ph);

    const body = document.createElement("div");
    body.className = "vehicle-card-body";

    const head = document.createElement("div");
    head.className = "vehicle-head";
    const h3 = document.createElement("h3");
    h3.textContent = v.name;
    const badge = document.createElement("span");
    badge.className = "badge badge--" + st.badge;
    badge.textContent = st.label;
    head.append(h3, badge);

    const price = document.createElement("p");
    price.className = "vehicle-price";
    price.textContent = "KSh " + v.price + " / day";

    const note = document.createElement("p");
    note.className = "vehicle-note";
    note.textContent = st.note;

    const actions = document.createElement("div");
    actions.className = "vehicle-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn small edit";
    editBtn.textContent = "Edit";
    editBtn.title = "Edit this vehicle";
    editBtn.addEventListener("click", () => editVehicle(v));
    const archiveBtn = document.createElement("button");
    archiveBtn.className = "btn small archive";
    archiveBtn.textContent = v.status === "archived" ? "Restore" : "Archive";
    archiveBtn.title = v.status === "archived" ? "Restore this vehicle" : "Archive this vehicle";
    archiveBtn.addEventListener("click", () => archiveVehicle(v));
    const delBtn = document.createElement("button");
    delBtn.className = "btn small danger";
    delBtn.textContent = "Delete";
    delBtn.title = "Delete this vehicle";
    delBtn.addEventListener("click", () => deleteVehicleConfirm(v));
    actions.append(editBtn, archiveBtn, delBtn);

    body.append(head, price, note, actions);
    card.append(imgWrap, body);
    return card;
  }

  async function archiveVehicle(v) {
    try {
      await updateVehicle(v.id, { status: v.status === "archived" ? "available" : "archived" });
      toast(v.status === "archived" ? "Vehicle restored." : "Vehicle archived.");
      renderAll();
    } catch (err) {
      toast(err.message);
    }
  }

  async function deleteVehicleConfirm(v) {
    if (!confirm("Delete " + v.name + "?")) return;
    try {
      await deleteVehicle(v.id);
      toast("Vehicle deleted.");
      renderAll();
    } catch (err) {
      toast(err.message);
    }
  }

  function editVehicle(v) {
    byId("vehicle-id").value = v.id;
    byId("name").value = v.name;
    byId("type").value = v.type;
    byId("price").value = v.price;
    byId("status").value = v.status;
    byId("save-btn").textContent = "Save Vehicle";
    byId("cancel-btn").hidden = false;
    byId("vehicle-form").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---------- Rendering: bookings ----------
  function renderBookings() {
    const tbody = byId("bookings-tbody");
    const empty = byId("bookings-empty");
    tbody.innerHTML = "";
    empty.hidden = bookings.length > 0;
    bookings.forEach((b) => {
      const vehicle = vehicles.find((v) => v.id === b.vehicle_id);
      const row = document.createElement("tr");
      const cells = [
        vehicle ? vehicle.name : "Vehicle #" + b.vehicle_id,
        b.customer_name || "—",
        fmtDate(b.start_date) + " – " + fmtDate(b.end_date),
        daysBetween(b.start_date, b.end_date) + " days",
        bookingDisplayStatus(b),
      ];
      cells.forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        row.appendChild(td);
      });
      const actions = document.createElement("td");
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn small danger";
      cancelBtn.textContent = "Cancel";
      cancelBtn.title = "Cancel this booking";
      cancelBtn.addEventListener("click", () => cancelBooking(b));
      actions.appendChild(cancelBtn);
      row.appendChild(actions);
      tbody.appendChild(row);
    });
  }

  async function cancelBooking(b) {
    if (!confirm("Cancel booking for " + (b.customer_name) + "?")) return;
    try {
      await deleteBooking(b.id);
      toast("Booking cancelled.");
      renderAll();
    } catch (err) {
      toast(err.message);
    }
  }

  // ---------- Rendering: invoices ----------
  function renderInvoices() {
    const tbody = byId("invoices-tbody");
    const empty = byId("invoices-empty");
    tbody.innerHTML = "";
    empty.hidden = invoices.length > 0;
    invoices.forEach((inv) => {
      const booking = bookings.find((b) => b.id === inv.booking_id);
      const vehicle = booking ? vehicles.find((v) => v.id === booking.vehicle_id) : null;
      const st = invoiceStatusLabel(inv);
      const row = document.createElement("tr");
      const cells = [
        "INV-" + String(inv.id).padStart(4, "0"),
        vehicle ? vehicle.name : "Vehicle #" + (booking ? booking.vehicle_id : "-"),
        inv.customer_name || (booking ? booking.customer_name : "-"),
        "KSh " + inv.amount,
        fmtDate(inv.due_date),
        st.label,
      ];
      cells.forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        row.appendChild(td);
      });
      // status cell with toggle
      const statusTd = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "badge badge--" + st.badge;
      badge.textContent = st.label;
      const settleBtn = document.createElement("button");
      settleBtn.className = "btn small settle";
      settleBtn.textContent = inv.status === 'settled' ? 'Unsettle' : 'Mark Settled';
      settleBtn.title = inv.status === 'settled' ? 'Mark this invoice as unpaid' : 'Mark this invoice as paid';
      settleBtn.addEventListener("click", () => toggleSettled(inv));
      statusTd.append(badge, document.createElement("br"), settleBtn);
      row.appendChild(statusTd);

      const actions = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.className = "btn small danger";
      delBtn.textContent = "Delete";
      delBtn.title = "Delete this invoice";
      delBtn.addEventListener("click", () => deleteInvoiceConfirm(inv));
      actions.appendChild(delBtn);
      row.appendChild(actions);

      tbody.appendChild(row);
    });
  }

  async function toggleSettled(inv) {
    try {
      await updateInvoice(inv.id, { status: inv.status === 'settled' ? 'pending' : 'settled' });
      toast("Invoice " + (inv.status === 'settled' ? 'marked unsettled.' : 'marked settled.'));
      renderAll();
    } catch (err) {
      toast(err.message);
    }
  }

  async function deleteInvoiceConfirm(inv) {
    if (!confirm("Delete invoice INV-" + String(inv.id).padStart(4, "0") + "?")) return;
    try {
      await deleteInvoice(inv.id);
      toast("Invoice deleted.");
      renderAll();
    } catch (err) {
      toast(err.message);
    }
  }

  function renderBookingVehicleOptions() {
    const select = byId("booking-vehicle");
    select.innerHTML = '<option value="">— Choose a vehicle —</option>';
    vehicles.forEach((v) => {
      const o = document.createElement("option");
      o.value = v.id;
      o.textContent = v.name + (v.status === "archived" ? " (Archived)" : " — KSh " + v.price + "/day");
      select.appendChild(o);
    });
  }

  function renderAll() {
    renderStats();
    renderVehicleGrid();
    renderBookingVehicleOptions();
    renderInvoiceBookingOptions();
    renderBookings();
    renderInvoices();
  }

  async function resetUserPassword(user) {
    const password = window.prompt("New temporary password for " + (user.full_name || user.email) + " (at least 12 characters):");
    if (!password) return;
    if (password.length < 12) { toast("Use at least 12 characters."); return; }
    try {
      await api("/admin/users/password", { method: "POST", body: JSON.stringify({ user_id: user.id, new_password: password }) });
      toast("Password updated. " + (user.full_name || user.email) + " must sign in again.");
      loadActivity();
    } catch (err) {
      toast(err.message);
    }
  }

  async function changeUserRole(user) {
    const role = user.role === "admin" ? "worker" : "admin";
    if (!confirm("Make " + (user.full_name || user.email) + " a " + role + "?")) return;
    try {
      await api("/admin/users?id=" + user.id, { method: "PUT", body: JSON.stringify({ role }) });
      toast("Role updated.");
      loadUsers();
      loadActivity();
    } catch (err) {
      toast(err.message);
    }
  }

  async function toggleUserActive(user) {
    if (!confirm((user.is_active ? "Disable" : "Enable") + " access for " + (user.full_name || user.email) + "?")) return;
    try {
      await api("/admin/users?id=" + user.id, { method: "PUT", body: JSON.stringify({ is_active: !user.is_active }) });
      toast(user.is_active ? "Account disabled." : "Account enabled.");
      loadUsers();
      loadActivity();
    } catch (err) {
      toast(err.message);
    }
  }

  // ---------- State & init ----------
  let initialized = false;
  async function init() {
    try {
      await loadVehicles();
      await loadBookings();
      await loadInvoices();
      renderAll();
      initialized = true;
    } catch (err) {
      toast("Failed to load data: " + err.message);
      console.error(err);
    }
  }

  // ---------- Vehicle form ----------
  function resetVehicleForm() {
    byId("vehicle-id").value = "";
    byId("name").value = "";
    byId("type").value = "Economy";
    byId("price").value = "";
    byId("status").value = "available";
    byId("save-btn").textContent = "Add Vehicle";
    byId("cancel-btn").hidden = true;
  }

  byId("vehicle-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = byId("vehicle-id").value.trim();
    const name = byId("name").value.trim();
    const type = byId("type").value;
    const price = parseFloat(byId("price").value.trim());
    const status = byId("status").value;

    if (!name) { toast("Enter a vehicle name."); byId("name").focus(); return; }
    if (!Number.isFinite(price) || price < 0) { toast("Enter a valid price per day."); byId("price").focus(); return; }

    try {
      if (id) {
        await updateVehicle(id, { name, type, price, status });
        toast("Vehicle " + name + " saved.");
      } else {
        await createVehicle({ name, type, price, status });
        toast("Vehicle " + name + " added.");
      }
      resetVehicleForm();
      renderAll();
    } catch (err) {
      toast(err.message);
    }
  });

  byId("cancel-btn").addEventListener("click", () => resetVehicleForm());

  // ---------- Booking form ----------
  function setBookingDefaults() {
    byId("booking-start").value = todayStr();
    byId("booking-end").value = addDays(todayStr(), 3);
  }

  byId("booking-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const vehicleId = byId("booking-vehicle").value;
    const customer = byId("booking-customer").value.trim();
    const start = byId("booking-start").value;
    const end = byId("booking-end").value;

    if (!vehicleId) { toast("Choose a vehicle."); return; }
    if (customer.length < 2) { toast("Enter the customer's name."); byId("booking-customer").focus(); return; }
    if (!start || !end) { toast("Choose a start and return date."); return; }

    const startDate = parseDate(start), endDate = parseDate(end), today = parseDate(todayStr());
    if (!startDate || !endDate) { toast("Invalid dates."); return; }
    if (endDate < today) { toast("The return date is in the past."); return; }
    if (startDate > endDate) { toast("The start date must be before the return date."); return; }

    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const isActiveBooking = !!today && startDate <= today && endDate >= today;

    try {
      await createBooking({
        vehicle_id: parseInt(vehicleId, 10),
        customer_name: customer,
        start_date: start,
        end_date: end,
        status: isActiveBooking ? "active" : "upcoming",
      });
      toast("Booking created for " + vehicle.name + ".");
      byId("booking-form").reset();
      setBookingDefaults();
      renderAll();
    } catch (err) {
      toast(err.message);
    }
  });

  // ---------- Invoice form ----------
  function renderInvoiceBookingOptions() {
    const select = byId("invoice-booking");
    select.innerHTML = '<option value="">— Choose a booking —</option>';
    bookings.forEach((b) => {
      const vehicle = vehicles.find((v) => v.id === b.vehicle_id);
      const o = document.createElement("option");
      o.value = b.id;
      o.textContent = "Booking #" + String(b.id).padStart(4, "0") + " — " + (vehicle ? vehicle.name : "Vehicle") + " (" + fmtDate(b.start_date) + " to " + fmtDate(b.end_date) + ")";
      select.appendChild(o);
    });
  }

  byId("invoice-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const booking_id = parseInt(byId("invoice-booking").value, 10);
    const amount = parseFloat(byId("invoice-amount").value.trim());
    const status = byId("invoice-status").value;
    const due_date = byId("invoice-due").value;

    if (!booking_id) { toast("Choose a booking."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { toast("Enter a valid amount."); byId("invoice-amount").focus(); return; }
    if (!due_date) { toast("Choose a due date."); return; }

    try {
      await createInvoice({ booking_id, amount: Math.round(amount), status, due_date });
      toast("Invoice created.");
      byId("invoice-form").reset();
      renderInvoiceBookingOptions();
      renderAll();
    } catch (err) {
      toast(err.message);
    }
  });

  // ---------- Sign in / sign out ----------
  byId("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = byId("login-email").value.trim();
    const password = byId("login-password").value;
    const error = byId("login-error");
    error.hidden = true;
    error.textContent = "";
    const submit = byId("login-submit");
    submit.disabled = true;
    submit.textContent = "Signing in…";

    try {
      const res = await fetch(API + "/auth/login", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        error.textContent = data.error || "Sign in failed. Please try again.";
        error.hidden = false;
        return;
      }
      byId("login-password").value = "";
      showApp(data.user);
      await init();
    } catch (err) {
      error.textContent = "Could not reach the server. Check your connection.";
      error.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  });

  byId("logout-btn").addEventListener("click", async () => {
    try {
      await fetch(API + "/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
    } catch (err) {
      console.error(err);
    }
    vehicles = [];
    bookings = [];
    invoices = [];
    initialized = false;
    byId("password-section").hidden = true;
    showLogin("");
  });

  byId("change-password-btn").addEventListener("click", () => {
    const section = byId("password-section");
    section.hidden = !section.hidden;
    if (!section.hidden) section.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  byId("password-cancel").addEventListener("click", () => {
    byId("password-section").hidden = true;
    byId("password-form").reset();
  });

  byId("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = byId("current-password").value;
    const next = byId("new-password").value;
    const confirm = byId("confirm-password").value;
    if (next.length < 12) { toast("Use at least 12 characters."); return; }
    if (next !== confirm) { toast("The new passwords do not match."); return; }
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      byId("password-form").reset();
      byId("password-section").hidden = true;
      toast("Password updated.");
    } catch (err) {
      toast(err.message);
    }
  });

  byId("user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = byId("user-email").value.trim();
    const fullName = byId("user-name").value.trim();
    const role = byId("user-role").value;
    const password = byId("user-password").value;
    if (password.length < 12) { toast("Use at least 12 characters for the temporary password."); return; }
    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, full_name: fullName, role, password }),
      });
      byId("user-form").reset();
      toast("Account created.");
      loadUsers();
      loadActivity();
    } catch (err) {
      toast(err.message);
    }
  });

  // ---------- Boot ----------
  setBookingDefaults();
  boot();
})();
