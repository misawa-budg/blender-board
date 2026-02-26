const tabImagesElement = document.getElementById("tab-images");
const tabModelsElement = document.getElementById("tab-models");
const imagesSectionElement = document.getElementById("images-section");
const modelsSectionElement = document.getElementById("models-section");

const imagesGridElement = document.getElementById("images-grid");
const imagesCountElement = document.getElementById("images-count");
const imagesEmptyElement = document.getElementById("images-empty");

const modelsGridElement = document.getElementById("models-grid");
const modelsCountElement = document.getElementById("models-count");
const modelsEmptyElement = document.getElementById("models-empty");

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const renderCard = (item, kindLabel) => {
  return `
    <article class="card">
      <h3 class="card-title">${item.title}</h3>
      <p class="meta">${kindLabel}</p>
      <p class="meta">by ${item.author}</p>
      <p class="meta">${formatDate(item.createdAt)}</p>
      <p class="meta">${item.originalName}</p>
      <a class="download-link" href="${item.downloadUrl}">Download</a>
    </article>
  `;
};

const renderItems = ({ items, kindLabel, gridElement, countElement, emptyElement }) => {
  countElement.textContent = `${items.length} items`;
  if (items.length === 0) {
    gridElement.innerHTML = "";
    emptyElement.classList.remove("hidden");
    return;
  }

  emptyElement.classList.add("hidden");
  gridElement.innerHTML = items.map((item) => renderCard(item, kindLabel)).join("");
};

const renderError = ({ message, countElement, emptyElement, gridElement }) => {
  countElement.textContent = "error";
  emptyElement.classList.remove("hidden");
  emptyElement.textContent = message;
  gridElement.innerHTML = "";
};

const loadItems = async ({ endpoint, kindLabel, gridElement, countElement, emptyElement }) => {
  try {
    const response = await fetch(`${endpoint}?limit=36`);
    if (!response.ok) {
      throw new Error(`Failed to load ${kindLabel.toLowerCase()}: ${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    renderItems({ items, kindLabel, gridElement, countElement, emptyElement });
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to load ${kindLabel}.`;
    renderError({ message, countElement, emptyElement, gridElement });
  }
};

const activateImagesTab = () => {
  tabImagesElement.classList.add("is-active");
  tabModelsElement.classList.remove("is-active");
  imagesSectionElement.classList.remove("hidden");
  modelsSectionElement.classList.add("hidden");
};

const activateModelsTab = () => {
  tabModelsElement.classList.add("is-active");
  tabImagesElement.classList.remove("is-active");
  modelsSectionElement.classList.remove("hidden");
  imagesSectionElement.classList.add("hidden");
};

tabImagesElement.addEventListener("click", activateImagesTab);
tabModelsElement.addEventListener("click", activateModelsTab);

loadItems({
  endpoint: "/images",
  kindLabel: "Image",
  gridElement: imagesGridElement,
  countElement: imagesCountElement,
  emptyElement: imagesEmptyElement,
});

loadItems({
  endpoint: "/models",
  kindLabel: "Model",
  gridElement: modelsGridElement,
  countElement: modelsCountElement,
  emptyElement: modelsEmptyElement,
});
