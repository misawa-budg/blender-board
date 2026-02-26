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

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const renderCard = (item) => {
  return `
    <article class="card">
      <h3 class="card-title">${item.title}</h3>
      <p class="meta">${config.label}</p>
      <p class="meta">by ${item.author}</p>
      <p class="meta">${formatDate(item.createdAt)}</p>
      <p class="meta">${item.originalName}</p>
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

void loadItems();
