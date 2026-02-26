const bodyKind = document.body.dataset.kind;

const galleryConfig = {
  images: {
    endpoint: "/api/images",
    label: "Image",
  },
  models: {
    endpoint: "/api/models",
    label: "Model",
  },
};

const config = bodyKind ? galleryConfig[bodyKind] : undefined;
if (!config) {
  throw new Error("Invalid gallery page config.");
}

const gridElement = document.getElementById("items-grid");
const countElement = document.getElementById("items-count");
const emptyElement = document.getElementById("items-empty");
const uploadFormElement = document.getElementById("upload-form");
const submitButtonElement = document.getElementById("submit-button");
const formStatusElement = document.getElementById("form-status");

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const escapeHtml = (value) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const renderCard = (item) => {
  return `
    <article class="card">
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      <p class="meta">${config.label}</p>
      <p class="meta">by ${escapeHtml(item.author)}</p>
      <p class="meta">${formatDate(item.createdAt)}</p>
      <p class="meta">${escapeHtml(item.originalName)}</p>
      <a class="download-link" href="${item.downloadUrl}">Download</a>
    </article>
  `;
};

const renderItems = (items) => {
  countElement.textContent = `${items.length} items`;
  if (items.length === 0) {
    gridElement.innerHTML = "";
    emptyElement.classList.remove("hidden");
    return;
  }

  emptyElement.classList.add("hidden");
  gridElement.innerHTML = items.map((item) => renderCard(item)).join("");
};

const renderError = (message) => {
  countElement.textContent = "error";
  emptyElement.classList.remove("hidden");
  emptyElement.textContent = message;
  gridElement.innerHTML = "";
};

const setFormStatus = (message, type) => {
  if (!(formStatusElement instanceof HTMLElement)) {
    return;
  }

  if (message === "") {
    formStatusElement.textContent = "";
    formStatusElement.classList.add("hidden");
    formStatusElement.classList.remove("status-success", "status-error");
    return;
  }

  formStatusElement.textContent = message;
  formStatusElement.classList.remove("hidden");
  formStatusElement.classList.remove("status-success", "status-error");
  formStatusElement.classList.add(type === "success" ? "status-success" : "status-error");
};

const loadItems = async () => {
  try {
    const response = await fetch(`${config.endpoint}?limit=36`);
    if (!response.ok) {
      throw new Error(`Failed to load items: ${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    renderItems(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load items.";
    renderError(message);
  }
};

if (
  uploadFormElement instanceof HTMLFormElement &&
  submitButtonElement instanceof HTMLButtonElement
) {
  uploadFormElement.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(uploadFormElement);
    const title = formData.get("title");
    const author = formData.get("author");
    const file = formData.get("file");

    if (typeof title !== "string" || title.trim() === "") {
      setFormStatus("Title is required.", "error");
      return;
    }
    if (typeof author !== "string" || author.trim() === "") {
      setFormStatus("Author is required.", "error");
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setFormStatus("File is required.", "error");
      return;
    }

    submitButtonElement.disabled = true;
    setFormStatus("Uploading...", "success");

    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Upload failed: ${response.status}`;
        try {
          const payload = await response.json();
          if (payload && typeof payload.error === "string") {
            errorMessage = payload.error;
          }
        } catch {
          // Keep the HTTP-based fallback message.
        }
        throw new Error(errorMessage);
      }

      uploadFormElement.reset();
      setFormStatus("Upload completed.", "success");
      await loadItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setFormStatus(message, "error");
    } finally {
      submitButtonElement.disabled = false;
    }
  });
}

void loadItems();
