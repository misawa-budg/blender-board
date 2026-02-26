const imagesGridElement = document.getElementById("images-grid");
const imagesCountElement = document.getElementById("images-count");
const imagesEmptyElement = document.getElementById("images-empty");

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const renderImageCard = (image) => {
  return `
    <article class="card">
      <h3 class="card-title">${image.title}</h3>
      <p class="meta">by ${image.author}</p>
      <p class="meta">${formatDate(image.createdAt)}</p>
      <p class="meta">${image.originalName}</p>
      <a class="download-link" href="${image.downloadUrl}">Download</a>
    </article>
  `;
};

const renderImages = (items) => {
  imagesCountElement.textContent = `${items.length} items`;
  if (items.length === 0) {
    imagesGridElement.innerHTML = "";
    imagesEmptyElement.classList.remove("hidden");
    return;
  }

  imagesEmptyElement.classList.add("hidden");
  imagesGridElement.innerHTML = items.map(renderImageCard).join("");
};

const renderError = (message) => {
  imagesCountElement.textContent = "error";
  imagesEmptyElement.classList.remove("hidden");
  imagesEmptyElement.textContent = message;
  imagesGridElement.innerHTML = "";
};

const loadImages = async () => {
  try {
    const response = await fetch("/images?limit=36");
    if (!response.ok) {
      throw new Error(`Failed to load images: ${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    renderImages(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load images.";
    renderError(message);
  }
};

loadImages();
