(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const STORAGE_KEY = "aurora_admin_data";
  const GLYPH = { Economy: "🚗", Midsize: "🚘", SUV: "🚙", Luxury: "🚕", Minivan: "🚐" };
  const TYPE_ORDER = ["Economy", "Midsize", "SUV", "Luxury", "Minivan"];

  // ---------- Data ----------
  function seedData() {
    return {
      vehicles: [
        { id: "v1", name: "Economy", type: "Economy", pricePerDay: 29, images: [], archived: false, createdAt: "2026-11-01" },
        { id: "v2", name: "Midsize", type: "Midsize", pricePerDay: 39, images: [], archived: false, createdAt: "2026-11-01" },
        { id: "v3", name: "SUV", type: "SUV", pricePerDay: 59, images: [], archived: false, createdAt: "2026-11-01" },
        { id: "v4", name: "Luxury", type: "Luxury", pricePerDay: 89, images: [], archived: false, createdAt: "2026-11-01" },
        { id: "v5", name: "Minivan", type: "Minivan", pricePerDay: 49, images: [], archived: false, createdAt: "2026-11-01" },
      ],
      bookings: [
        { id: "b1", vehicleId: "v1", start: "2026-11-20", end: "2026-11-27", status: "active", createdAt: "2026-11-18" },
        { id: "b2", vehicleId: "v2", start: "2026-11-18", end: "2026-11-21", status: "active", createdAt: "2026-11-19" },
        { id: "b3", vehicleId: "v4", start: "2026-11-25", end: "2026-11-27", status: "upcoming", createdAt: "2026-11-24" },
      ],
      nextVehicleId: 6,
      nextBookingId: 4,
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to seed */ }
    const data = seedData();
    saveData(data);
    return data;
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      toast("Could not save data — is storage available?");
      return false;
    }
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
  function daysBetween(start, end) {
    const a = parseDate(start), b = parseDate(end);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000) + 1;
  }
  function isActive(b) {
    if (!b) return false;
    const today = parseDate(todayStr());
    return !!today && !!parseDate(b.start) && !!parseDate(b.end) && parseDate(b.start) <= today && today <= parseDate(b.end);
  }
  function bookingDisplayStatus(b) {
    if (isActive(b)) return "Active";
    const end = parseDate(b.end);
    const today = parseDate(todayStr());
    if (end && today && end < today) return "Completed";
    return "Upcoming";
  }
  function addDays(s, n) {
    const d = parseDate(s);
    if (!d) return s;
    d.setDate(d.getDate() + n);
    return toISOLocal(d);
  }
  function readFilesAsDataURLs(files) {
    return Promise.all(Array.from(files).map((file) => new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error("read failed"));
      r.readAsDataURL(file);
    })));
  }

  // ---------- Status & stats ----------
  function vehicleStatus(vehicle, data) {
    if (vehicle.archived) return { label: "Archived", badge: "archived", note: "Hidden from the rental fleet." };
    const active = data.bookings.find((b) => b.vehicleId === vehicle.id && isActive(b));
    if (active) return { label: "Rented", badge: "rented", note: "Rented until " + fmtDate(active.end) };
    const upcoming = data.bookings.find((b) => b.vehicleId === vehicle.id && parseDate(b.start) > parseDate(todayStr()));
    if (upcoming) return { label: "Upcoming", badge: "upcoming", note: "Booked from " + fmtDate(upcoming.start) };
    return { label: "Available", badge: "available", note: "Ready for new bookings" };
  }

  function utilizationType(type, data) {
    const ofType = data.vehicles.filter((v) => v.type === type && !v.archived);
    const busy = ofType.filter((v) => vehicleStatus(v, data).label === "Rented");
    if (!ofType.length) return { pct: 0, busy: 0, total: 0 };
    return { pct: Math.round((busy.length / ofType.length) * 100), busy: busy.length, total: ofType.length };
  }

  function statTotals(data) {
    const statuses = data.vehicles.map((v) => vehicleStatus(v, data));
    const nonArchived = data.vehicles.filter((v) => !v.archived).length;
    const rented = statuses.filter((s) => s.label === "Rented").length;
    return {
      total: data.vehicles.length,
      rented,
      available: statuses.filter((s) => s.label === "Available").length,
      upcoming: statuses.filter((s) => s.label === "Upcoming").length,
      bookedDays: data.bookings.reduce((n, b) => n + daysBetween(b.start, b.end), 0),
      utilization: nonArchived ? Math.round((rented / nonArchived) * 100) : 0,
    };
  }

  // ---------- Toast ----------
  function toast(message) {
    const el = byId("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("visible");
    setTimeout(() => el.classList.remove("visible"), 2600);
  }

  // ---------- Rendering: stats ----------
  function renderStats(data) {
    const totals = statTotals(data);
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
  function renderVehicleGrid(data) {
    const grid = byId("vehicle-grid");
    grid.innerHTML = "";
    data.vehicles.forEach((v) => grid.appendChild(renderVehicleCard(v, data)));
    if (!data.vehicles.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No vehicles yet — add one above.";
      grid.appendChild(p);
    }
  }

  function renderVehicleCard(v, data) {
    const st = vehicleStatus(v, data);
    const card = document.createElement("article");
    card.className = "vehicle-card";

    const imgWrap = document.createElement("div");
    imgWrap.className = "vehicle-card-image";
    if (v.images && v.images.length) {
      const img = document.createElement("img");
      img.src = v.images[0];
      img.alt = v.name + " photo";
      imgWrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "vehicle-placeholder card-img card-img--" + v.type.toLowerCase();
      const span = document.createElement("span");
      span.className = "car-glyph";
      span.textContent = GLYPH[v.type] || "🚗";
      ph.appendChild(span);
      imgWrap.appendChild(ph);
    }

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
    price.textContent = "$" + v.pricePerDay + " / day";

    const note = document.createElement("p");
    note.className = "vehicle-note";
    note.textContent = st.note;

    const actions = document.createElement("div");
    actions.className = "vehicle-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn small edit";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editVehicle(v));
    const archiveBtn = document.createElement("button");
    archiveBtn.className = "btn small archive";
    archiveBtn.textContent = v.archived ? "Restore" : "Archive";
    archiveBtn.addEventListener("click", () => archiveVehicle(v));
    actions.append(editBtn, archiveBtn);

    body.append(head, price, note, actions);
    card.append(imgWrap, body);
    return card;
  }

  function archiveVehicle(v) {
    v.archived = !v.archived;
    if (saveData(state.data)) {
      toast(v.archived ? "Vehicle archived." : "Vehicle restored.");
      renderAll();
    }
  }

  function editVehicle(v) {
    state.formState.vehicleId = v.id;
    byId("name").value = v.name;
    byId("type").value = v.type;
    byId("price").value = v.pricePerDay;
    byId("status").value = v.archived ? "archived" : "available";
    state.formImages = v.images.slice();
    byId("save-btn").textContent = "Save Vehicle";
    byId("cancel-btn").hidden = false;
    renderImagePreviews();
    byId("vehicle-form").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---------- Rendering: bookings ----------
  function renderBookings(data) {
    const tbody = byId("bookings-tbody");
    const empty = byId("bookings-empty");
    tbody.innerHTML = "";
    empty.hidden = data.bookings.length > 0;
    const rows = data.bookings.map((b) => {
      const vehicle = data.vehicles.find((v) => v.id === b.vehicleId);
      const row = document.createElement("tr");
      const cells = [
        vehicle ? vehicle.name : b.vehicleId,
        fmtDate(b.start) + " – " + fmtDate(b.end),
        daysBetween(b.start, b.end) + " days",
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
      cancelBtn.addEventListener("click", () => {
        data.bookings = data.bookings.filter((x) => x.id !== b.id);
        if (saveData(data)) {
          toast("Booking cancelled.");
          renderAll();
        }
      });
      actions.appendChild(cancelBtn);
      row.appendChild(actions);
      return row;
    });
    tbody.append(...rows);
  }

  // ---------- Rendering: utilization ----------
  function renderUtilization(data) {
    const list = byId("utilization-list");
    list.innerHTML = "";
    TYPE_ORDER.filter((t) => data.vehicles.some((v) => v.type === t)).forEach((t) => {
      const u = utilizationType(t, data);
      const item = document.createElement("div");
      item.className = "util-item";
      const head = document.createElement("div");
      head.className = "util-head";
      const name = document.createElement("span");
      name.className = "util-name";
      name.textContent = t;
      const label = document.createElement("span");
      label.className = "util-pct";
      label.textContent = u.busy + " / " + u.total + " booked";
      const pct = document.createElement("span");
      pct.className = "util-num";
      pct.textContent = u.pct + "%";
      head.append(name, label, pct);
      const bar = document.createElement("div");
      bar.className = "util-bar";
      const fill = document.createElement("div");
      fill.className = "util-fill";
      fill.style.width = u.pct + "%";
      bar.appendChild(fill);
      item.append(head, bar);
      list.appendChild(item);
    });
  }

  function renderBookingVehicleOptions(data) {
    const select = byId("booking-vehicle");
    select.innerHTML = '<option value="">— Choose a vehicle —</option>';
    data.vehicles.forEach((v) => {
      const o = document.createElement("option");
      o.value = v.id;
      o.textContent = v.name + (v.archived ? " (Archived)" : " — $" + v.pricePerDay + "/day");
      select.appendChild(o);
    });
  }

  function renderAll() {
    const data = state.data;
    renderStats(data);
    renderVehicleGrid(data);
    renderBookingVehicleOptions(data);
    renderBookings(data);
    renderUtilization(data);
  }

  // ---------- State ----------
  const state = { data: loadData(), formState: { vehicleId: null }, formImages: [] };

  // ---------- Vehicle form ----------
  function resetVehicleForm() {
    byId("name").value = "";
    byId("type").value = "Economy";
    byId("price").value = "";
    byId("status").value = "available";
    state.formImages = [];
    state.formState.vehicleId = null;
    byId("save-btn").textContent = "Add Vehicle";
    byId("cancel-btn").hidden = true;
    renderImagePreviews();
  }

  byId("vehicle-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = byId("name").value.trim();
    const type = byId("type").value;
    const priceText = byId("price").value.trim();
    const price = parseFloat(priceText);
    if (!name) { toast("Enter a vehicle name."); byId("name").focus(); return; }
    if (!priceText) { toast("Enter a price per day."); byId("price").focus(); return; }
    if (!Number.isFinite(price) || price < 0) { toast("Enter a valid price per day."); byId("price").focus(); return; }

    if (state.formState.vehicleId) {
      const vehicle = state.data.vehicles.find((v) => v.id === state.formState.vehicleId);
      if (vehicle) {
        vehicle.name = name;
        vehicle.type = type;
        vehicle.pricePerDay = price;
        vehicle.archived = byId("status").value === "archived";
        vehicle.images = state.formImages;
      }
    } else {
      const id = "v" + state.data.nextVehicleId++;
      state.data.vehicles.push({
        id, name, type, pricePerDay: price, images: state.formImages.slice(),
        archived: byId("status").value === "archived", createdAt: todayStr(),
      });
    }
    if (saveData(state.data)) {
      toast("Vehicle " + name + " saved.");
      resetVehicleForm();
      renderAll();
    }
  });

  byId("cancel-btn").addEventListener("click", () => resetVehicleForm());

  // Upload images
  byId("upload-btn").addEventListener("click", () => byId("vehicle-image-input").click());
  byId("vehicle-image-input").addEventListener("change", async (e) => {
    const input = e.target;
    const files = input.files;
    if (!files || !files.length) return;
    const urls = await readFilesAsDataURLs(files);
    state.formImages.push(...urls);
    input.value = "";
    renderImagePreviews();
    toast("Added " + urls.length + " image(s).");
  });

  function renderImagePreviews() {
    const container = byId("image-previews");
    container.innerHTML = "";
    state.formImages.forEach((url, i) => {
      const wrap = document.createElement("div");
      wrap.className = "image-preview";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Vehicle photo " + (i + 1);
      wrap.appendChild(img);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "preview-remove";
      remove.textContent = "✕";
      remove.title = "Remove this image";
      remove.addEventListener("click", () => {
        state.formImages.splice(i, 1);
        renderImagePreviews();
      });
      wrap.appendChild(remove);
      container.appendChild(wrap);
    });
  }

  // ---------- Booking form ----------
  function setBookingDefaults() {
    byId("booking-start").value = todayStr();
    byId("booking-end").value = addDays(todayStr(), 3);
  }

  byId("booking-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const vehicleId = byId("booking-vehicle").value;
    const start = byId("booking-start").value;
    const end = byId("booking-end").value;
    const vehicle = state.data.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) { toast("Choose a vehicle."); return; }
    const startDate = parseDate(start), endDate = parseDate(end), today = parseDate(todayStr());
    if (!startDate || !endDate) { toast("Choose a start and return date."); return; }
    if (endDate < today) { toast("The return date is in the past."); return; }
    if (startDate > endDate) { toast("The start date must be before the return date."); return; }
    const isActiveBooking = !!today && startDate <= today && endDate >= today;
    state.data.bookings.push({
      id: "b" + state.data.nextBookingId++,
      vehicleId: vehicle.id,
      start, end,
      status: isActiveBooking ? "active" : "upcoming",
      createdAt: todayStr(),
    });
    if (saveData(state.data)) {
      toast("Booking created for " + vehicle.name + ".");
      byId("booking-form").reset();
      setBookingDefaults();
      renderAll();
    }
  });

  // ---------- Init ----------
  renderAll();
  setBookingDefaults();
})();
