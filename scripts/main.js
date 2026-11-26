(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);

  const TYPE_META = {
    economy: {
      image: "assets/fleet-economy.jpg",
      tag: "City runs",
      features: ["Air conditioning", "Easy to park", "Fuel efficient", "Free fuel policy"],
      specs: { Passengers: "4", Luggage: "3 bags", Transmission: "Automatic", Mileage: "Unlimited" },
      blurb: "A fuel-efficient pick for Nairobi city runs, quick errands and everyday commutes."
    },
    midsize: {
      image: "assets/fleet-midsize.jpg",
      tag: "Cruising comfort",
      features: ["Roomy cabin and trunk", "Automatic transmission", "Bluetooth audio", "Free fuel policy"],
      specs: { Passengers: "5", Luggage: "4 bags", Transmission: "Automatic", Mileage: "Unlimited" },
      blurb: "Solid for couples, friends or small families — passenger room and a trunk that holds your gear."
    },
    suv: {
      image: "assets/fleet-suv.jpg",
      tag: "Upcountry ready",
      features: ["High clearance", "Roof rails", "Extra cargo room", "Free fuel policy"],
      specs: { Passengers: "5", Luggage: "6 bags", Transmission: "Automatic", Mileage: "Unlimited" },
      blurb: "Taller ride height for rougher roads. Great for family trips and mountain getaways."
    },
    luxury: {
      image: "assets/fleet-luxury.jpg",
      tag: "Premium ride",
      features: ["Premium interior", "Premium sound", "Driver assistance", "Climate control"],
      specs: { Passengers: "4", Luggage: "5 bags", Transmission: "Automatic", Mileage: "Unlimited" },
      blurb: "Refined materials and comfort features that make every mile feel effortless."
    },
    minivan: {
      image: "assets/fleet-minivan.jpg",
      tag: "Group travel",
      features: ["Seats up to 7", "Sliding side doors", "ISOFIX anchors", "USB charging"],
      specs: { Passengers: "7", Luggage: "8 bags", Transmission: "Automatic", Mileage: "Unlimited" },
      blurb: "Roomy family option with easy loading — ideal for groups and airport transfers."
    }
  };

  const FALLBACK_FLEET = [
    { id: "economy", name: "Toyota Vitz", type: "Economy", price: 2500 },
    { id: "midsize", name: "Nissan Tiida", type: "Midsize", price: 3800 },
    { id: "suv", name: "Toyota RAV4", type: "SUV", price: 7500 },
    { id: "luxury", name: "Toyota Prado", type: "Luxury", price: 12000 },
    { id: "minivan", name: "Toyota Hiace", type: "Minivan", price: 8500 }
  ];

  function normalizeType(type) {
    return String(type || "economy").toLowerCase().trim();
  }

  function formatPrice(price) {
    const n = Number(price) || 0;
    return "KSh " + n.toLocaleString("en-KE");
  }

  function updateWhatsAppLinks(message) {
    const url = "https://wa.me/254722461400?text=" + encodeURIComponent(message);
    document.querySelectorAll('a[href^="https://wa.me/254722461400"]').forEach((link) => {
      link.href = url;
    });
  }

  function toast(message) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    el.setAttribute("role", "status");
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("visible"));
    setTimeout(() => el.classList.remove("visible"), 2800);
    setTimeout(() => el.remove(), 3200);
  }

  function metaFor(type) {
    return TYPE_META[normalizeType(type)] || TYPE_META.economy;
  }

  function buildCard(vehicle) {
    const type = normalizeType(vehicle.type);
    const meta = metaFor(type);
    const priceLabel = formatPrice(vehicle.price);
    const article = document.createElement("article");
    article.className = "car-card reveal";
    article.dataset.card = type;
    article.dataset.name = vehicle.name;

    const specsHtml = Object.entries(meta.specs)
      .map(([label, value]) =>
        '<div class="spec"><span class="spec-label">' + label + "</span><strong>" + value + "</strong></div>"
      )
      .join("");

    const featuresHtml = meta.features
      .map((f) => "<li>" + f + "</li>")
      .join("");

    article.innerHTML =
      '<div class="card-img">' +
        '<img src="' + meta.image + '" alt="' + vehicle.name + '" width="1200" height="825" loading="lazy" />' +
        '<span class="card-badge">' + meta.tag + "</span>" +
      "</div>" +
      '<div class="card-body">' +
        "<h3>" + vehicle.name + "</h3>" +
        '<p class="card-price">' + priceLabel + ' <span class="card-price-unit">/ day</span></p>' +
        '<ul class="card-features">' + featuresHtml + "</ul>" +
        '<div class="card-details">' +
          '<div class="card-details-specs">' + specsHtml + "</div>" +
          '<p class="card-details-text">' + meta.blurb + "</p>" +
        "</div>" +
        '<div class="card-actions">' +
          '<button class="card-toggle" type="button">Details</button>' +
          '<a class="card-rent btn btn-primary" href="#contact" data-car="' + vehicle.name + '" data-price="' + priceLabel + '">Rent this car</a>' +
        "</div>" +
      "</div>";

    return article;
  }

  function bindCardInteractions(root) {
    root.querySelectorAll(".car-card").forEach((card) => {
      const btn = card.querySelector(".card-toggle");
      if (btn) {
        btn.addEventListener("click", () => {
          const open = card.classList.toggle("expanded");
          btn.textContent = open ? "Hide details" : "Details";
        });
      }
    });

    root.querySelectorAll(".card-rent").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const car = link.getAttribute("data-car") || "";
        const price = link.getAttribute("data-price") || "";
        const message =
          "I’d like to rent the " + car + " (" + price + "/day) in Nairobi. Please share availability and booking steps.";
        updateWhatsAppLinks(message);
        const textarea = byId("contact-message");
        if (textarea) {
          textarea.value = message;
          textarea.focus();
        }
        const contact = byId("contact");
        if (contact) contact.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  function observeReveals(scope) {
    if (!("IntersectionObserver" in window)) {
      scope.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    scope.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
  }

  function renderFleet(vehicles) {
    const grid = byId("fleet-grid");
    const status = byId("fleet-status");
    if (!grid) return;

    grid.innerHTML = "";
    vehicles.forEach((v) => grid.appendChild(buildCard(v)));
    bindCardInteractions(grid);
    observeReveals(grid);

    if (status) {
      status.textContent =
        vehicles.length + " vehicle" + (vehicles.length === 1 ? "" : "s") + " available to enquire.";
    }
  }

  async function loadFleet() {
    const status = byId("fleet-status");
    if (status) status.textContent = "Loading fleet…";

    try {
      const response = await fetch("/api/vehicles");
      if (!response.ok) throw new Error("Fleet unavailable");
      const rows = await response.json();
      const available = (Array.isArray(rows) ? rows : []).filter(
        (v) => String(v.status || "available").toLowerCase() !== "unavailable"
      );
      if (!available.length) throw new Error("Empty fleet");
      renderFleet(available);
    } catch (_) {
      renderFleet(FALLBACK_FLEET);
      if (status) status.textContent = "Showing our core Nairobi fleet.";
    }
  }

  // Filters
  const filters = byId("fleet-filters");
  if (filters) {
    filters.addEventListener("click", (e) => {
      const chip = e.target.closest(".filter-chip");
      if (!chip) return;
      const filter = chip.dataset.filter || "all";
      filters.querySelectorAll(".filter-chip").forEach((c) => {
        const active = c === chip;
        c.classList.toggle("is-active", active);
        c.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll(".car-card").forEach((card) => {
        const show = filter === "all" || card.dataset.card === filter;
        card.classList.toggle("is-hidden", !show);
      });
    });
  }

  // Mobile navigation
  const hamburger = byId("hamburger");
  const mobileNav = byId("mobile-nav");
  if (hamburger && mobileNav) {
    const close = () => {
      mobileNav.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
      mobileNav.setAttribute("aria-hidden", "true");
    };
    const toggle = () => {
      const open = mobileNav.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
      mobileNav.setAttribute("aria-hidden", open ? "false" : "true");
    };
    hamburger.addEventListener("click", toggle);
    document.addEventListener("click", (e) => {
      if (mobileNav.classList.contains("open") && !hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
        close();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
    mobileNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  }

  // Sticky header
  const header = byId("site-header");
  const updateHeader = () => {
    if (header) header.classList.toggle("scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  // Scroll reveal for static sections
  observeReveals(document);

  // Hero search form
  const searchForm = byId("search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pickup = byId("pickup").value.trim();
      const ret = byId("return").value.trim();
      const location = byId("location").value;
      const carType = normalizeType(byId("carType").value || "all");

      if (!pickup || !ret) {
        toast("Pick a pickup and return date to search cars.");
        (pickup ? byId("return") : byId("pickup")).focus();
        return;
      }
      if (new Date(ret) <= new Date(pickup)) {
        toast("Your return date must be after your pickup date.");
        byId("return").focus();
        return;
      }
      if (!location) {
        toast("Choose a pickup location.");
        byId("location").focus();
        return;
      }

      if (filters) {
        const chip = filters.querySelector('[data-filter="' + (carType === "all" ? "all" : carType) + '"]')
          || filters.querySelector('[data-filter="all"]');
        if (chip) chip.click();
      }

      document.querySelectorAll(".car-card").forEach((c) => c.classList.remove("selected"));
      const match = carType === "all"
        ? document.querySelector(".car-card:not(.is-hidden)")
        : document.querySelector('.car-card[data-card="' + carType + '"]:not(.is-hidden)');
      if (match) match.classList.add("selected");

      const selectedLabel = match ? match.dataset.name || match.querySelector("h3")?.textContent : "a car";
      updateWhatsAppLinks(
        "Hi Aurora, I’d like to check availability for " +
          selectedLabel +
          " from " +
          pickup +
          " to " +
          ret +
          " in " +
          location +
          "."
      );
      toast("Showing " + (carType === "all" ? "available" : carType) + " cars for your dates.");
      const fleet = byId("fleet");
      if (fleet) fleet.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Contact form
  const contactForm = byId("contact-form");
  const status = byId("form-status");
  if (contactForm && status) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(contactForm));
      if (data.website) return;
      if (!data.name || !data.phone || !data.message) {
        status.textContent = "Please fill in your name, phone number and message.";
        return;
      }
      const submit = contactForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      status.textContent = "Sending your enquiry…";

      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          phone: data.phone.trim(),
          email: (data.email || "").trim(),
          message: data.message.trim()
        })
      })
        .then(async (response) => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || "Unable to send enquiry");
          status.textContent = "Thanks, " + data.name + "! We’ll contact you shortly on WhatsApp or phone.";
          contactForm.reset();
        })
        .catch((error) => {
          status.textContent = error.message + ". Please use WhatsApp for a faster reply.";
        })
        .finally(() => {
          if (submit) submit.disabled = false;
        });
    });
  }

  loadFleet();
})();
