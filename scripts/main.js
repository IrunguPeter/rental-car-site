(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);

  function updateWhatsAppLinks(message) {
    const url = "https://wa.me/254722461400?text=" + encodeURIComponent(message);
    document.querySelectorAll('a[href^="https://wa.me/254722461400"]').forEach((link) => {
      link.href = url;
    });
  }

  // Toast
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

  // Mobile navigation
  const hamburger = byId("hamburger");
  const mobileNav = byId("mobile-nav");
  if (hamburger && mobileNav) {
    const close = () => {
      mobileNav.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    };
    const toggle = () => {
      const open = mobileNav.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
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
  }

  // Sticky header
  const header = byId("site-header");
  const updateHeader = () => { if (header) header.classList.toggle("scrolled", window.scrollY > 60); };
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  // Scroll reveal
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-visible"); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
  }

  // Fleet card details
  document.querySelectorAll(".car-card").forEach((card) => {
    const btn = card.querySelector(".card-toggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const open = card.classList.toggle("expanded");
        btn.textContent = open ? "Details ▲" : "Details ▼";
      });
    }
  });

  // Hero search form
  const searchForm = byId("search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pickup = byId("pickup").value.trim();
      const ret = byId("return").value.trim();
      const location = byId("location").value;
      const carType = byId("carType").value || "economy";
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
      const match = document.querySelector('.car-card[data-card="' + carType + '"]');
      document.querySelectorAll(".car-card").forEach((c) => c.classList.remove("selected"));
      if (match) match.classList.add("selected");
      const selectedLabel = match ? match.querySelector("h3")?.textContent : "a car";
      updateWhatsAppLinks("Hi Aurora, I’d like to check availability for " + selectedLabel + " from " + pickup + " to " + ret + " in " + location + ".");
      toast("Searching " + carType + " cars — pick your dates and rent.");
      if (match) match.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // Rent This Car -> prefill contact form
  document.querySelectorAll(".card-rent").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const car = link.getAttribute("data-car") || "";
      const price = link.getAttribute("data-price") || "";
      const message = "I’d like to rent the " + car + " (" + price + "/day) in Nairobi. Please share availability and booking steps.";
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
          email: data.email.trim(),
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
})();
