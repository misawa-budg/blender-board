const bodyKind = document.body.dataset.kind;

const galleryConfig = {
  images: {
    endpoint: "/api/images",
    label: "画像",
    detailPrefix: "/images",
    showImagePreview: true,
    showModelPreview: false,
  },
  models: {
    endpoint: "/api/models",
    label: "モデル",
    detailPrefix: "/models",
    showImagePreview: false,
    showModelPreview: true,
  },
};

const config = bodyKind ? galleryConfig[bodyKind] : undefined;
if (!config) {
  throw new Error("ギャラリーページ設定が不正です。");
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

const getFileExtension = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const index = value.lastIndexOf(".");
  if (index < 0) {
    return "";
  }
  return value.slice(index).toLowerCase();
};

const canRenderModelPreview = (item) => {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  if (typeof item.previewUrl !== "string") {
    return false;
  }
  const extension = getFileExtension(item.originalName);
  return extension === ".glb" || extension === ".gltf";
};

const renderCard = (item) => {
  const detailUrl = `${config.detailPrefix}/${item.id}`;
  let previewHtml =
    config.showImagePreview && typeof item.previewUrl === "string"
      ? `
      <div class="card-preview">
        <img class="card-preview-image" src="${item.previewUrl}" alt="${escapeHtml(item.title)} のプレビュー" loading="lazy" decoding="async" />
      </div>
    `
      : "";

  if (config.showModelPreview) {
    if (canRenderModelPreview(item)) {
      previewHtml = `
        <div class="card-preview">
          <model-viewer
            class="card-preview-model"
            src="${item.previewUrl}"
            camera-controls
            interaction-prompt="none"
            loading="lazy"
            reveal="auto"
          ></model-viewer>
        </div>
      `;
    } else {
      previewHtml = `
        <div class="card-preview card-preview-unsupported">
          <p class="card-preview-note">この形式はWebプレビュー未対応です（glb/gltf推奨）</p>
        </div>
      `;
    }
  }
  return `
    <article class="card card-clickable" data-detail-url="${detailUrl}" tabindex="0" role="link" aria-label="詳細を開く: ${escapeHtml(item.title)}">
      ${previewHtml}
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      <p class="meta">${config.label}</p>
      <p class="meta">投稿者: ${escapeHtml(item.author)}</p>
      <p class="meta">${formatDate(item.createdAt)}</p>
      <p class="meta">${escapeHtml(item.originalName)}</p>
      <div class="card-actions">
        <a class="download-link" href="${item.downloadUrl}">ダウンロード</a>
      </div>
    </article>
  `;
};

const renderItems = (items) => {
  countElement.textContent = `${items.length} 件`;
  if (items.length === 0) {
    gridElement.innerHTML = "";
    emptyElement.classList.remove("hidden");
    return;
  }

  emptyElement.classList.add("hidden");
  gridElement.innerHTML = items.map((item) => renderCard(item)).join("");
};

const renderError = (message) => {
  countElement.textContent = "エラー";
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
      throw new Error(`一覧の取得に失敗しました: ${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    renderItems(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "一覧の取得に失敗しました。";
    renderError(message);
  }
};

if (gridElement instanceof HTMLElement) {
  gridElement.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    if (event.target.closest("a, button, input, textarea, select, label")) {
      return;
    }

    const cardElement = event.target.closest(".card-clickable");
    if (!(cardElement instanceof HTMLElement)) {
      return;
    }
    const detailUrl = cardElement.dataset.detailUrl;
    if (!detailUrl) {
      return;
    }

    window.location.assign(detailUrl);
  });

  gridElement.addEventListener("keydown", (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    if (!event.target.classList.contains("card-clickable")) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    const detailUrl = event.target.dataset.detailUrl;
    if (!detailUrl) {
      return;
    }
    window.location.assign(detailUrl);
  });
}

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
      setFormStatus("タイトルは必須です。", "error");
      return;
    }
    if (typeof author !== "string" || author.trim() === "") {
      setFormStatus("投稿者は必須です。", "error");
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setFormStatus("ファイルは必須です。", "error");
      return;
    }

    submitButtonElement.disabled = true;
    setFormStatus("アップロード中...", "success");

    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `アップロードに失敗しました: ${response.status}`;
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
      setFormStatus("投稿が完了しました。", "success");
      await loadItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "アップロードに失敗しました。";
      setFormStatus(message, "error");
    } finally {
      submitButtonElement.disabled = false;
    }
  });
}

void loadItems();
