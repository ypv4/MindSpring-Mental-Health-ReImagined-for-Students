document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("page-ready");

  setActiveNav();
  initPageTransitions();
  initSupportToggle();
  initServiceModal();
  initResourceLibrary();
  initSignupForm();
});

function setActiveNav() {
  const page = document.body.dataset.page;
  if (!page) {
    return;
  }

  const matchingLinks = document.querySelectorAll(`[data-nav="${page}"]`);
  matchingLinks.forEach((link) => {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  });
}

function initPageTransitions() {
  const links = document.querySelectorAll("a.js-page-link[href]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || reducedMotion) {
        return;
      }

      const url = new URL(href, window.location.href);
      const isInternal = url.origin === window.location.origin;
      const openNewTab = event.metaKey || event.ctrlKey || event.shiftKey || link.target === "_blank";

      if (!isInternal || openNewTab) {
        return;
      }

      event.preventDefault();
      document.body.classList.add("page-exit");
      window.setTimeout(() => {
        window.location.href = url.href;
      }, 180);
    });
  });
}

function initSupportToggle() {
  const toggleButton = document.getElementById("supportToggle");
  const statusText = document.getElementById("supportStatus");

  if (!toggleButton || !statusText) {
    return;
  }

  let chatOnline = true;

  toggleButton.addEventListener("click", () => {
    chatOnline = !chatOnline;

    if (chatOnline) {
      statusText.textContent = "Live peer chat opens daily from 8 AM to 11 PM.";
    } else {
      statusText.textContent = "After-hours mode is active. We will text you first thing in the morning.";
    }
  });
}

function initServiceModal() {
  const modalElement = document.getElementById("serviceModal");
  const detailButtons = document.querySelectorAll(".service-detail-btn");

  if (!modalElement || detailButtons.length === 0 || !window.bootstrap) {
    return;
  }

  const modalTitle = document.getElementById("serviceModalLabel");
  const modalBody = document.getElementById("serviceModalBody");
  const modal = new window.bootstrap.Modal(modalElement);

  detailButtons.forEach((button) => {
    button.addEventListener("click", () => {
      modalTitle.textContent = button.dataset.title || "Service details";
      modalBody.textContent = button.dataset.detail || "No additional details available.";
      modal.show();
    });
  });
}

function initResourceLibrary() {
  const grid = document.getElementById("resourceGrid");
  const filterButtons = document.querySelectorAll(".resource-filter-btn");
  const searchInput = document.getElementById("resourceSearch");
  const modalElement = document.getElementById("resourceModal");

  if (!grid) {
    return;
  }

  const items = Array.from(grid.querySelectorAll("[data-category]"));
  let currentFilter = "all";

  const applyFilters = () => {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    items.forEach((item) => {
      const category = item.dataset.category;
      const card = item.querySelector(".resource-card");
      const text = card ? card.textContent.toLowerCase() : "";

      const categoryMatch = currentFilter === "all" || category === currentFilter;
      const textMatch = !query || text.includes(query);

      item.classList.toggle("resource-hidden", !(categoryMatch && textMatch));
    });
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter || "all";
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      applyFilters();
    });
  });

  searchInput?.addEventListener("input", applyFilters);

  if (modalElement && window.bootstrap) {
    const modalTitle = document.getElementById("resourceModalLabel");
    const modalBody = document.getElementById("resourceModalBody");
    const modal = new window.bootstrap.Modal(modalElement);
    const cards = grid.querySelectorAll(".resource-card");

    cards.forEach((card) => {
      const open = () => {
        modalTitle.textContent = card.dataset.title || "Resource details";
        modalBody.textContent = card.dataset.detail || "No extra details available.";
        modal.show();
      };

      card.addEventListener("click", open);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  }

  applyFilters();
}

function initSignupForm() {
  const form = document.getElementById("signupForm");
  if (!form) {
    return;
  }

  const status = document.getElementById("signupStatus");

  const fields = {
    fullName: {
      input: document.getElementById("fullName"),
      error: document.getElementById("fullNameError"),
      validate: (value) => (value.trim().length >= 2 ? "" : "Please enter your full name.")
    },
    emailAddress: {
      input: document.getElementById("emailAddress"),
      error: document.getElementById("emailAddressError"),
      validate: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? "" : "Please enter a valid email.")
    },
    schoolName: {
      input: document.getElementById("schoolName"),
      error: document.getElementById("schoolNameError"),
      validate: (value) => (value.trim().length >= 2 ? "" : "Please add your school name.")
    },
    roleType: {
      input: document.getElementById("roleType"),
      error: document.getElementById("roleTypeError"),
      validate: (value) => (value ? "" : "Please choose your role.")
    },
    helpTopic: {
      input: document.getElementById("helpTopic"),
      error: document.getElementById("helpTopicError"),
      validate: (value) => (value.trim().length >= 12 ? "" : "Please share a little more so we can help.")
    },
    consentCheck: {
      input: document.getElementById("consentCheck"),
      error: document.getElementById("consentCheckError"),
      validate: (_, input) => (input.checked ? "" : "Consent is required to continue.")
    }
  };

  const validateField = (field) => {
    if (!field.input || !field.error) {
      return false;
    }

    const value = field.input.type === "checkbox" ? "checked" : field.input.value;
    const message = field.validate(value, field.input);

    field.error.textContent = message;

    if (field.input.type !== "checkbox") {
      field.input.classList.toggle("is-invalid", Boolean(message));
      field.input.classList.toggle("is-valid-field", !message && field.input.value.trim() !== "");
    }

    return !message;
  };

  Object.values(fields).forEach((field) => {
    if (!field.input) {
      return;
    }

    const eventName = field.input.tagName.toLowerCase() === "select" || field.input.type === "checkbox" ? "change" : "input";
    field.input.addEventListener(eventName, () => {
      validateField(field);
      if (status) {
        status.textContent = "";
      }
    });

    if (field.input.type !== "checkbox") {
      field.input.addEventListener("blur", () => validateField(field));
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const isValid = Object.values(fields).every((field) => validateField(field));
    if (!isValid) {
      if (status) {
        status.textContent = "Please correct the highlighted fields.";
        status.className = "small text-danger";
      }
      return;
    }

    const payload = {
      fullName: fields.fullName.input.value.trim(),
      emailAddress: fields.emailAddress.input.value.trim(),
      schoolName: fields.schoolName.input.value.trim(),
      roleType: fields.roleType.input.value,
      helpTopic: fields.helpTopic.input.value.trim(),
      consent: fields.consentCheck.input.checked
    };

    const success = await submitSignup(payload);

    if (success) {
      form.reset();

      Object.values(fields).forEach((field) => {
        if (field.input && field.input.type !== "checkbox") {
          field.input.classList.remove("is-invalid", "is-valid-field");
        }
        if (field.error) {
          field.error.textContent = "";
        }
      });

      if (status) {
        status.textContent = "Thanks! Your request was submitted successfully.";
        status.className = "small text-success";
      }
    } else if (status) {
      status.textContent = "We could not send right now. Your request was saved locally and will be retried.";
      status.className = "small text-warning";
    }
  });
}

async function submitSignup(payload) {
  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return true;
    }

    saveOfflineSubmission(payload);
    return false;
  } catch {
    saveOfflineSubmission(payload);
    return false;
  }
}

function saveOfflineSubmission(payload) {
  const key = "mindspring_offline_submissions";

  try {
    const current = JSON.parse(localStorage.getItem(key) || "[]");
    current.push({ ...payload, savedAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(current));
  } catch {
    localStorage.setItem(key, JSON.stringify([{ ...payload, savedAt: new Date().toISOString() }]));
  }
}
