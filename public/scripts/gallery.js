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
const paginationElement = document.getElementById("pagination");
const pageInfoElement = document.getElementById("page-info");
const prevPageButtonElement = document.getElementById("prev-page-button");
const nextPageButtonElement = document.getElementById("next-page-button");
const pageJumpFormElement = document.getElementById("page-jump-form");
const pageJumpInputElement = document.getElementById("page-jump-input");
const pageJumpButtonElement = document.getElementById("page-jump-button");
const uploadFormElement = document.getElementById("upload-form");
const submitButtonElement = document.getElementById("submit-button");
const formStatusElement = document.getElementById("form-status");
const authorInputElement = document.getElementById("author-input");
const modelPickerElement = document.getElementById("model-picker");
const modelPickerSearchElement = document.getElementById("model-picker-search");
const modelPickerHintElement = document.getElementById("model-picker-hint");
const modelPickerOptionsElement = document.getElementById("model-picker-options");
const galleryHeadElement = document.querySelector(".section-head");

const modelPickerState = {
  selectedIds: new Set(),
  models: [],
  loading: false,
  requestToken: 0,
};

const paginationState = {
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 1,
};

const createSkeletonCardHtml = () => {
  return `
    <article class="card card-skeleton" aria-hidden="true">
      <div class="skeleton-box skeleton-preview"></div>
      <div class="skeleton-box skeleton-line skeleton-line-title"></div>
      <div class="skeleton-box skeleton-line"></div>
      <div class="skeleton-box skeleton-line"></div>
      <div class="skeleton-box skeleton-line skeleton-line-short"></div>
    </article>
  `;
};

const parsePageQuery = () => {
  const params = new URLSearchParams(window.location.search);
  const rawPage = params.get("page");
  return rawPage === null ? 1 : parsePositivePage(rawPage) ?? 1;
};

const parsePositivePage = (value) => {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const parsedPage = Number(value);
  if (!Number.isSafeInteger(parsedPage) || parsedPage < 1) {
    return null;
  }
  return parsedPage;
};

const syncPageToUrl = (page, options = {}) => {
  const replace = options.replace ?? false;
  const params = new URLSearchParams(window.location.search);
  if (page <= 1) {
    params.delete("page");
  } else {
    params.set("page", String(page));
  }
  const nextSearch = params.toString();
  const nextPath = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextPath === currentPath) {
    return;
  }
  if (replace) {
    window.history.replaceState(null, "", nextPath);
    return;
  }
  window.history.pushState(null, "", nextPath);
};

const scrollToGalleryHead = () => {
  if (!(galleryHeadElement instanceof HTMLElement)) {
    return;
  }
  galleryHeadElement.scrollIntoView({ behavior: "smooth", block: "start" });
};

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
  return typeof item.previewUrl === "string" && item.previewUrl !== "";
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
    } else if (typeof item.thumbnailUrl === "string" && item.thumbnailUrl !== "") {
      previewHtml = `
        <div class="card-preview">
          <img class="card-preview-image" src="${item.thumbnailUrl}" alt="${escapeHtml(item.title)} のサムネイル" loading="lazy" decoding="async" />
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

const renderPagination = () => {
  if (
    !(paginationElement instanceof HTMLElement) ||
    !(pageInfoElement instanceof HTMLElement) ||
    !(prevPageButtonElement instanceof HTMLButtonElement) ||
    !(nextPageButtonElement instanceof HTMLButtonElement) ||
    !(pageJumpInputElement instanceof HTMLInputElement) ||
    !(pageJumpButtonElement instanceof HTMLButtonElement)
  ) {
    return;
  }

  const hasMultiplePages = paginationState.totalPages > 1;
  paginationElement.classList.toggle("hidden", !hasMultiplePages);
  pageInfoElement.textContent = `${paginationState.page} / ${paginationState.totalPages} ページ`;
  prevPageButtonElement.disabled = paginationState.page <= 1;
  nextPageButtonElement.disabled = paginationState.page >= paginationState.totalPages;
  pageJumpInputElement.disabled = !hasMultiplePages;
  pageJumpButtonElement.disabled = !hasMultiplePages;
  pageJumpInputElement.min = "1";
  pageJumpInputElement.max = String(paginationState.totalPages);
  pageJumpInputElement.value = String(paginationState.page);
};

const renderLoadingState = (targetPage) => {
  countElement.textContent = "読み込み中...";
  emptyElement.classList.add("hidden");
  gridElement.classList.add("is-loading");
  gridElement.innerHTML = Array.from({ length: paginationState.limit }, () => createSkeletonCardHtml()).join("");

  if (
    paginationElement instanceof HTMLElement &&
    pageInfoElement instanceof HTMLElement &&
    prevPageButtonElement instanceof HTMLButtonElement &&
    nextPageButtonElement instanceof HTMLButtonElement
  ) {
    paginationElement.classList.remove("hidden");
    pageInfoElement.textContent = `${targetPage} ページを読み込み中...`;
    prevPageButtonElement.disabled = true;
    nextPageButtonElement.disabled = true;
    if (pageJumpInputElement instanceof HTMLInputElement) {
      pageJumpInputElement.disabled = true;
    }
    if (pageJumpButtonElement instanceof HTMLButtonElement) {
      pageJumpButtonElement.disabled = true;
    }
  }
};

const renderItems = (items) => {
  gridElement.classList.remove("is-loading");
  countElement.textContent = `${paginationState.total} 件`;
  if (items.length === 0) {
    gridElement.innerHTML = "";
    emptyElement.textContent =
      paginationState.total === 0
        ? `${config.label}投稿はまだありません。`
        : "このページには投稿がありません。";
    emptyElement.classList.remove("hidden");
    renderPagination();
    return;
  }

  emptyElement.classList.add("hidden");
  gridElement.innerHTML = items.map((item) => renderCard(item)).join("");
  renderPagination();
};

const renderError = (message) => {
  gridElement.classList.remove("is-loading");
  countElement.textContent = "エラー";
  emptyElement.classList.remove("hidden");
  emptyElement.textContent = message;
  gridElement.innerHTML = "";
  if (paginationElement instanceof HTMLElement) {
    paginationElement.classList.add("hidden");
  }
  if (pageJumpInputElement instanceof HTMLInputElement) {
    pageJumpInputElement.setCustomValidity("");
  }
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

const normalizeAuthor = () => {
  if (!(authorInputElement instanceof HTMLInputElement)) {
    return "";
  }
  return authorInputElement.value.trim();
};

const setModelPickerHint = (message) => {
  if (!(modelPickerHintElement instanceof HTMLElement)) {
    return;
  }
  modelPickerHintElement.textContent = message;
};

const getModelPickerSummaryElement = () => {
  if (!(modelPickerElement instanceof HTMLDetailsElement)) {
    return null;
  }
  const summary = modelPickerElement.querySelector("summary");
  return summary instanceof HTMLElement ? summary : null;
};

const renderModelPickerSummary = () => {
  if (config !== galleryConfig.images) {
    return;
  }
  const summaryElement = getModelPickerSummaryElement();
  if (!summaryElement) {
    return;
  }

  const selectedCount = modelPickerState.selectedIds.size;
  summaryElement.textContent =
    selectedCount > 0 ? `モデルを選択（${selectedCount}件選択中）` : "モデルを選択";
};

const renderModelPickerOptions = () => {
  if (!(modelPickerOptionsElement instanceof HTMLElement)) {
    return;
  }

  const author = normalizeAuthor();
  if (author === "") {
    modelPickerOptionsElement.innerHTML = "";
    setModelPickerHint("投稿者を入力すると過去モデルを選択できます。");
    renderModelPickerSummary();
    return;
  }

  if (modelPickerState.loading) {
    modelPickerOptionsElement.innerHTML = "";
    setModelPickerHint("候補を読み込み中です...");
    renderModelPickerSummary();
    return;
  }

  if (modelPickerState.models.length === 0) {
    modelPickerOptionsElement.innerHTML = '<li class="picker-empty">候補がありません。</li>';
    setModelPickerHint("検索条件に一致するモデルがありません。");
    renderModelPickerSummary();
    return;
  }

  setModelPickerHint("チェックを入れると使用モデルとして関連付けます。");
  modelPickerOptionsElement.innerHTML = modelPickerState.models
    .map((model) => {
      const checked = modelPickerState.selectedIds.has(model.id) ? "checked" : "";
      const safeTitle = escapeHtml(model.title);
      const safeName = escapeHtml(model.originalName);
      return `
        <li>
          <label class="picker-option">
            <input type="checkbox" data-model-id="${model.id}" ${checked} />
            <span>${safeTitle} (#${model.id})<br /><small>${safeName}</small></span>
          </label>
        </li>
      `;
    })
    .join("");
  renderModelPickerSummary();
};

const loadAuthorModels = async () => {
  if (config !== galleryConfig.images) {
    return;
  }
  if (!(modelPickerSearchElement instanceof HTMLInputElement)) {
    return;
  }

  const author = normalizeAuthor();
  modelPickerState.requestToken += 1;
  const currentToken = modelPickerState.requestToken;

  if (author === "") {
    modelPickerState.models = [];
    modelPickerState.loading = false;
    renderModelPickerOptions();
    return;
  }

  modelPickerState.loading = true;
  renderModelPickerOptions();
  const searchKeyword = modelPickerSearchElement.value.trim();

  try {
    const params = new URLSearchParams();
    params.set("author", author);
    params.set("limit", "30");
    params.set("sort", "createdAt");
    params.set("order", "desc");
    if (searchKeyword !== "") {
      params.set("q", searchKeyword);
    }

    const response = await fetch(`/api/models?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`候補取得に失敗しました: ${response.status}`);
    }

    const payload = await response.json();
    if (currentToken !== modelPickerState.requestToken) {
      return;
    }
    const items = payload && typeof payload === "object" && Array.isArray(payload.items)
      ? payload.items
      : [];
    modelPickerState.models = items
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: Number(item.id),
        title: typeof item.title === "string" ? item.title : "モデル",
        originalName: typeof item.originalName === "string" ? item.originalName : "",
      }))
      .filter((item) => Number.isInteger(item.id) && item.id > 0);
    modelPickerState.loading = false;
    renderModelPickerOptions();
  } catch (error) {
    if (currentToken !== modelPickerState.requestToken) {
      return;
    }
    modelPickerState.loading = false;
    modelPickerState.models = [];
    renderModelPickerOptions();
    const message =
      error instanceof Error ? error.message : "候補モデルの取得に失敗しました。";
    setModelPickerHint(message);
  }
};

let modelPickerDebounceTimer;
const queueLoadAuthorModels = () => {
  if (modelPickerDebounceTimer !== undefined) {
    window.clearTimeout(modelPickerDebounceTimer);
  }
  modelPickerDebounceTimer = window.setTimeout(() => {
    void loadAuthorModels();
  }, 220);
};

const loadItems = async (targetPage = paginationState.page, options = {}) => {
  const updateUrl = options.updateUrl ?? true;
  const replaceUrl = options.replaceUrl ?? false;
  const scrollAfterLoad = options.scrollAfterLoad ?? false;

  renderLoadingState(targetPage);

  try {
    const params = new URLSearchParams();
    params.set("limit", String(paginationState.limit));
    params.set("page", String(targetPage));
    params.set("sort", "createdAt");
    params.set("order", "desc");

    const response = await fetch(`${config.endpoint}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`一覧の取得に失敗しました: ${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    const meta = payload && typeof payload === "object" ? payload.meta : null;
    const totalFromMeta =
      meta && typeof meta === "object" && typeof meta.total === "number" ? meta.total : items.length;
    const limitFromMeta =
      meta && typeof meta === "object" && typeof meta.limit === "number"
        ? meta.limit
        : paginationState.limit;
    const pageFromMeta =
      meta && typeof meta === "object" && typeof meta.page === "number" ? meta.page : targetPage;

    paginationState.total = Number.isFinite(totalFromMeta) && totalFromMeta >= 0 ? totalFromMeta : items.length;
    paginationState.limit = Number.isFinite(limitFromMeta) && limitFromMeta > 0 ? limitFromMeta : paginationState.limit;
    paginationState.page = Number.isFinite(pageFromMeta) && pageFromMeta > 0 ? pageFromMeta : targetPage;
    paginationState.totalPages = Math.max(1, Math.ceil(paginationState.total / paginationState.limit));

    if (
      items.length === 0 &&
      paginationState.total > 0 &&
      paginationState.page > paginationState.totalPages
    ) {
      await loadItems(paginationState.totalPages, options);
      return;
    }

    renderItems(items);
    if (updateUrl) {
      syncPageToUrl(paginationState.page, { replace: replaceUrl });
    }
    if (scrollAfterLoad) {
      scrollToGalleryHead();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "一覧の取得に失敗しました。";
    renderError(message);
  }
};

const submitJumpPage = () => {
  if (!(pageJumpInputElement instanceof HTMLInputElement)) {
    return;
  }

  const rawValue = pageJumpInputElement.value.trim();
  const parsedPage = parsePositivePage(rawValue);

  pageJumpInputElement.setCustomValidity("");
  if (parsedPage === null) {
    pageJumpInputElement.setCustomValidity("1以上の整数を入力してください。");
    pageJumpInputElement.reportValidity();
    return;
  }

  if (parsedPage > paginationState.totalPages) {
    pageJumpInputElement.setCustomValidity(`1〜${paginationState.totalPages}の範囲で入力してください。`);
    pageJumpInputElement.reportValidity();
    return;
  }

  if (parsedPage === paginationState.page) {
    scrollToGalleryHead();
    return;
  }

  void loadItems(parsedPage, { scrollAfterLoad: true });
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
  prevPageButtonElement instanceof HTMLButtonElement &&
  nextPageButtonElement instanceof HTMLButtonElement
) {
  prevPageButtonElement.addEventListener("click", () => {
    if (paginationState.page <= 1) {
      return;
    }
    void loadItems(paginationState.page - 1, { scrollAfterLoad: true });
  });

  nextPageButtonElement.addEventListener("click", () => {
    if (paginationState.page >= paginationState.totalPages) {
      return;
    }
    void loadItems(paginationState.page + 1, { scrollAfterLoad: true });
  });
}

if (
  pageJumpFormElement instanceof HTMLFormElement &&
  pageJumpInputElement instanceof HTMLInputElement
) {
  pageJumpFormElement.addEventListener("submit", (event) => {
    event.preventDefault();
    submitJumpPage();
  });

  pageJumpInputElement.addEventListener("input", () => {
    pageJumpInputElement.setCustomValidity("");
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

    if (config === galleryConfig.images && modelPickerState.selectedIds.size > 0) {
      formData.append(
        "modelIds",
        [...modelPickerState.selectedIds].sort((a, b) => a - b).join(",")
      );
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
      modelPickerState.selectedIds.clear();
      modelPickerState.models = [];
      renderModelPickerOptions();
      setFormStatus("投稿が完了しました。", "success");
      await loadItems(1, { replaceUrl: true, scrollAfterLoad: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "アップロードに失敗しました。";
      setFormStatus(message, "error");
    } finally {
      submitButtonElement.disabled = false;
    }
  });
}

if (
  config === galleryConfig.images &&
  authorInputElement instanceof HTMLInputElement &&
  modelPickerSearchElement instanceof HTMLInputElement &&
  modelPickerOptionsElement instanceof HTMLElement
) {
  renderModelPickerOptions();

  authorInputElement.addEventListener("input", () => {
    modelPickerState.selectedIds.clear();
    queueLoadAuthorModels();
  });
  authorInputElement.addEventListener("blur", () => {
    queueLoadAuthorModels();
  });
  modelPickerSearchElement.addEventListener("input", () => {
    queueLoadAuthorModels();
  });
  modelPickerOptionsElement.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    if (event.target.type !== "checkbox") {
      return;
    }

    const modelIdRaw = event.target.dataset.modelId;
    const modelId = Number(modelIdRaw);
    if (!Number.isInteger(modelId) || modelId <= 0) {
      return;
    }

    if (event.target.checked) {
      modelPickerState.selectedIds.add(modelId);
    } else {
      modelPickerState.selectedIds.delete(modelId);
    }
    renderModelPickerSummary();
  });
  if (modelPickerElement instanceof HTMLDetailsElement) {
    modelPickerElement.addEventListener("toggle", () => {
      if (modelPickerElement.open) {
        queueLoadAuthorModels();
      }
    });
  }
}

window.addEventListener("popstate", () => {
  const pageFromUrl = parsePageQuery();
  paginationState.page = pageFromUrl;
  void loadItems(pageFromUrl, { updateUrl: false });
});

const initialPage = parsePageQuery();
paginationState.page = initialPage;
void loadItems(initialPage, { replaceUrl: true });
