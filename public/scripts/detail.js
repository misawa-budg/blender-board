const pathMatch = /^\/(images|models)\/(\d+)$/.exec(window.location.pathname);

const detailConfigMap = {
  images: {
    endpoint: "/api/images",
    listPath: "/images",
    label: "画像",
    fileAccept: ".png,.jpg,.jpeg,.webp,.gif",
  },
  models: {
    endpoint: "/api/models",
    listPath: "/models",
    label: "モデル",
    fileAccept: ".obj,.fbx,.blend,.glb,.gltf,.stl,.ply",
  },
};

const detailStatusElement = document.getElementById("detail-status");
const actionStatusElement = document.getElementById("action-status");
const detailCardElement = document.getElementById("detail-card");
const detailPreviewElement = document.getElementById("detail-preview");
const detailPreviewImageElement = document.getElementById("detail-preview-image");
const detailPreviewModelElement = document.getElementById("detail-preview-model");
const detailPreviewNoteElement = document.getElementById("detail-preview-note");
const detailHeadingElement = document.getElementById("detail-heading");
const detailDescriptionElement = document.getElementById("detail-description");
const backLinkElement = document.getElementById("back-link");
const downloadLinkElement = document.getElementById("download-link");
const tabImagesElement = document.getElementById("tab-images");
const tabModelsElement = document.getElementById("tab-models");

const itemIdElement = document.getElementById("item-id");
const itemTitleElement = document.getElementById("item-title");
const itemAuthorElement = document.getElementById("item-author");
const itemCreatedElement = document.getElementById("item-created");
const itemOriginalNameElement = document.getElementById("item-original-name");
const itemMimeTypeElement = document.getElementById("item-mime-type");
const itemFileSizeElement = document.getElementById("item-file-size");

const relatedModelsSectionElement = document.getElementById("related-models-section");
const relatedModelsListElement = document.getElementById("related-models-list");
const relatedImagesSectionElement = document.getElementById("related-images-section");
const relatedImagesListElement = document.getElementById("related-images-list");

const editFormElement = document.getElementById("edit-form");
const editTitleElement = document.getElementById("edit-title");
const editAuthorElement = document.getElementById("edit-author");
const editModelIdsFieldElement = document.getElementById("edit-model-ids-field");
const editModelPickerElement = document.getElementById("edit-model-picker");
const editModelPickerSearchElement = document.getElementById("edit-model-picker-search");
const editModelPickerHintElement = document.getElementById("edit-model-picker-hint");
const editModelPickerOptionsElement = document.getElementById("edit-model-picker-options");
const editFileElement = document.getElementById("edit-file");
const editPreviewFileFieldElement = document.getElementById("edit-preview-file-field");
const editPreviewFileElement = document.getElementById("edit-preview-file");
const editThumbnailFileFieldElement = document.getElementById("edit-thumbnail-file-field");
const editThumbnailFileElement = document.getElementById("edit-thumbnail-file");
const saveButtonElement = document.getElementById("save-button");
const deleteButtonElement = document.getElementById("delete-button");

const deleteConfirmOverlayElement = document.getElementById("delete-confirm-overlay");
const deleteConfirmMessageElement = document.getElementById("delete-confirm-message");
const deleteCancelButtonElement = document.getElementById("delete-cancel-button");
const deleteConfirmButtonElement = document.getElementById("delete-confirm-button");

let originalItemState = null;
let deleteConfirmResolver = null;
const editModelPickerState = {
  selectedIds: new Set(),
  models: [],
  loading: false,
  requestToken: 0,
};

const showStatus = (message, type) => {
  if (!(detailStatusElement instanceof HTMLElement)) {
    return;
  }
  detailStatusElement.textContent = message;
  detailStatusElement.classList.remove("hidden", "status-success", "status-error");
  detailStatusElement.classList.add(type === "success" ? "status-success" : "status-error");
};

const hideStatus = () => {
  if (!(detailStatusElement instanceof HTMLElement)) {
    return;
  }
  detailStatusElement.textContent = "";
  detailStatusElement.classList.add("hidden");
  detailStatusElement.classList.remove("status-success", "status-error");
};

const showActionStatus = (message, type) => {
  if (!(actionStatusElement instanceof HTMLElement)) {
    return;
  }

  if (message === "") {
    actionStatusElement.textContent = "";
    actionStatusElement.classList.add("hidden");
    actionStatusElement.classList.remove("status-success", "status-error");
    return;
  }

  actionStatusElement.textContent = message;
  actionStatusElement.classList.remove("hidden", "status-success", "status-error");
  actionStatusElement.classList.add(type === "success" ? "status-success" : "status-error");
};

const setActionPending = (pending) => {
  if (saveButtonElement instanceof HTMLButtonElement) {
    saveButtonElement.disabled = pending;
  }
  if (deleteButtonElement instanceof HTMLButtonElement) {
    deleteButtonElement.disabled = pending;
  }
};

const escapeHtml = (value) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const formatFileSize = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "-";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const kib = value / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }
  return `${(kib / 1024).toFixed(1)} MiB`;
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
  return typeof item.previewUrl === "string" && item.previewUrl !== "";
};

const withCacheBust = (url) => {
  if (typeof url !== "string" || url === "") {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}r=${Date.now()}`;
};

const normalizeModelIds = (ids) => {
  return [...ids]
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b)
    .join(",");
};

const setEditModelPickerHint = (message) => {
  if (!(editModelPickerHintElement instanceof HTMLElement)) {
    return;
  }
  editModelPickerHintElement.textContent = message;
};

const getEditModelPickerSummaryElement = () => {
  if (!(editModelPickerElement instanceof HTMLDetailsElement)) {
    return null;
  }
  const summary = editModelPickerElement.querySelector("summary");
  return summary instanceof HTMLElement ? summary : null;
};

const renderEditModelPickerSummary = () => {
  if (kind !== "images") {
    return;
  }
  const summaryElement = getEditModelPickerSummaryElement();
  if (!summaryElement) {
    return;
  }

  const selectedCount = editModelPickerState.selectedIds.size;
  summaryElement.textContent =
    selectedCount > 0 ? `モデルを選択（${selectedCount}件選択中）` : "モデルを選択";
};

const renderEditModelPickerOptions = () => {
  if (kind !== "images") {
    return;
  }
  if (!(editModelPickerOptionsElement instanceof HTMLElement)) {
    return;
  }
  if (!(editAuthorElement instanceof HTMLInputElement)) {
    return;
  }

  const author = editAuthorElement.value.trim();
  if (author === "") {
    editModelPickerOptionsElement.innerHTML = "";
    setEditModelPickerHint("投稿者を入力すると過去モデルを選択できます。");
    renderEditModelPickerSummary();
    return;
  }

  if (editModelPickerState.loading) {
    editModelPickerOptionsElement.innerHTML = "";
    setEditModelPickerHint("候補を読み込み中です...");
    renderEditModelPickerSummary();
    return;
  }

  if (editModelPickerState.models.length === 0) {
    editModelPickerOptionsElement.innerHTML = '<li class="picker-empty">候補がありません。</li>';
    setEditModelPickerHint("検索条件に一致するモデルがありません。");
    renderEditModelPickerSummary();
    return;
  }

  setEditModelPickerHint("チェックを入れると使用モデルとして関連付けます。");
  editModelPickerOptionsElement.innerHTML = editModelPickerState.models
    .map((model) => {
      const checked = editModelPickerState.selectedIds.has(model.id) ? "checked" : "";
      return `
        <li>
          <label class="picker-option">
            <input type="checkbox" data-model-id="${model.id}" ${checked} />
            <span>${escapeHtml(model.title)} (#${model.id})<br /><small>${escapeHtml(model.originalName)}</small></span>
          </label>
        </li>
      `;
    })
    .join("");
  renderEditModelPickerSummary();
};

const loadEditModelCandidates = async () => {
  if (kind !== "images") {
    return;
  }
  if (!(editAuthorElement instanceof HTMLInputElement)) {
    return;
  }
  if (!(editModelPickerSearchElement instanceof HTMLInputElement)) {
    return;
  }

  const author = editAuthorElement.value.trim();
  editModelPickerState.requestToken += 1;
  const currentToken = editModelPickerState.requestToken;

  if (author === "") {
    editModelPickerState.models = [];
    editModelPickerState.loading = false;
    renderEditModelPickerOptions();
    return;
  }

  editModelPickerState.loading = true;
  renderEditModelPickerOptions();

  const searchKeyword = editModelPickerSearchElement.value.trim();
  const params = new URLSearchParams();
  params.set("author", author);
  params.set("limit", "30");
  params.set("sort", "createdAt");
  params.set("order", "desc");
  if (searchKeyword !== "") {
    params.set("q", searchKeyword);
  }

  try {
    const response = await fetch(`/api/models?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`候補取得に失敗しました: ${response.status}`);
    }

    const payload = await response.json();
    if (currentToken !== editModelPickerState.requestToken) {
      return;
    }
    const items = payload && typeof payload === "object" && Array.isArray(payload.items)
      ? payload.items
      : [];
    editModelPickerState.models = items
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: Number(item.id),
        title: typeof item.title === "string" ? item.title : "モデル",
        originalName: typeof item.originalName === "string" ? item.originalName : "",
      }))
      .filter((item) => Number.isInteger(item.id) && item.id > 0);
    editModelPickerState.loading = false;
    renderEditModelPickerOptions();
  } catch (error) {
    if (currentToken !== editModelPickerState.requestToken) {
      return;
    }
    editModelPickerState.loading = false;
    editModelPickerState.models = [];
    renderEditModelPickerOptions();
    const message =
      error instanceof Error ? error.message : "候補モデルの取得に失敗しました。";
    setEditModelPickerHint(message);
  }
};

let editModelPickerDebounceTimer;
const queueLoadEditModelCandidates = () => {
  if (editModelPickerDebounceTimer !== undefined) {
    window.clearTimeout(editModelPickerDebounceTimer);
  }
  editModelPickerDebounceTimer = window.setTimeout(() => {
    void loadEditModelCandidates();
  }, 220);
};

if (!pathMatch) {
  showStatus("詳細ページのURLが不正です。", "error");
  throw new Error("詳細ページのURLが不正です。");
}

const kind = pathMatch[1];
const itemId = pathMatch[2];
const config = detailConfigMap[kind];
if (!config) {
  showStatus("詳細ページの設定が不正です。", "error");
  throw new Error("詳細ページの設定が不正です。");
}

if (detailHeadingElement instanceof HTMLElement) {
  detailHeadingElement.textContent = `${config.label}の詳細`;
}
if (detailDescriptionElement instanceof HTMLElement) {
  detailDescriptionElement.textContent = `${config.label}のメタデータ確認とダウンロードができます。`;
}
if (backLinkElement instanceof HTMLAnchorElement) {
  backLinkElement.href = config.listPath;
}
if (tabImagesElement instanceof HTMLElement) {
  tabImagesElement.classList.toggle("is-active", kind === "images");
}
if (tabModelsElement instanceof HTMLElement) {
  tabModelsElement.classList.toggle("is-active", kind === "models");
}
if (editFileElement instanceof HTMLInputElement) {
  editFileElement.accept = config.fileAccept;
}
if (editModelIdsFieldElement instanceof HTMLElement) {
  editModelIdsFieldElement.classList.toggle("hidden", kind !== "images");
}
if (editPreviewFileFieldElement instanceof HTMLElement) {
  editPreviewFileFieldElement.classList.toggle("hidden", kind !== "models");
}
if (editThumbnailFileFieldElement instanceof HTMLElement) {
  editThumbnailFileFieldElement.classList.toggle("hidden", kind !== "models");
}

const closeDeleteConfirm = (confirmed) => {
  if (!(deleteConfirmOverlayElement instanceof HTMLElement) || deleteConfirmResolver === null) {
    return;
  }
  deleteConfirmOverlayElement.classList.add("hidden");
  const resolver = deleteConfirmResolver;
  deleteConfirmResolver = null;
  resolver(confirmed);
};

const requestDeleteConfirmation = () => {
  if (!(deleteConfirmOverlayElement instanceof HTMLElement)) {
    return Promise.resolve(
      window.confirm(`この${config.label}を削除しますか？この操作は取り消せません。`)
    );
  }

  if (deleteConfirmMessageElement instanceof HTMLElement) {
    deleteConfirmMessageElement.textContent = `この${config.label}を削除しますか？この操作は取り消せません。`;
  }

  deleteConfirmOverlayElement.classList.remove("hidden");
  return new Promise((resolve) => {
    deleteConfirmResolver = resolve;
  });
};

const renderRelatedModels = (relatedModels) => {
  if (!(relatedModelsSectionElement instanceof HTMLElement) || !(relatedModelsListElement instanceof HTMLElement)) {
    return;
  }

  if (kind !== "images") {
    relatedModelsSectionElement.classList.add("hidden");
    relatedModelsListElement.innerHTML = "";
    return;
  }

  relatedModelsSectionElement.classList.remove("hidden");
  if (!Array.isArray(relatedModels) || relatedModels.length === 0) {
    relatedModelsListElement.innerHTML = "<li>関連モデルはありません。</li>";
    return;
  }

  relatedModelsListElement.innerHTML = relatedModels
    .map((relatedModel) => {
      const modelId = relatedModel && typeof relatedModel.id === "number" ? relatedModel.id : 0;
      const title =
        relatedModel && typeof relatedModel.title === "string" ? relatedModel.title : "モデル";
      const downloadUrl =
        relatedModel && typeof relatedModel.downloadUrl === "string" ? relatedModel.downloadUrl : "#";
      return `<li><a href="/models/${modelId}">${escapeHtml(title)}</a> <a class="download-link" href="${downloadUrl}">ダウンロード</a></li>`;
    })
    .join("");
};

const renderRelatedImages = (relatedImages) => {
  if (!(relatedImagesSectionElement instanceof HTMLElement) || !(relatedImagesListElement instanceof HTMLElement)) {
    return;
  }

  if (kind !== "models") {
    relatedImagesSectionElement.classList.add("hidden");
    relatedImagesListElement.innerHTML = "";
    return;
  }

  relatedImagesSectionElement.classList.remove("hidden");
  if (!Array.isArray(relatedImages) || relatedImages.length === 0) {
    relatedImagesListElement.innerHTML = "<li>関連画像はありません。</li>";
    return;
  }

  relatedImagesListElement.innerHTML = relatedImages
    .map((relatedImage) => {
      const imageId = relatedImage && typeof relatedImage.id === "number" ? relatedImage.id : 0;
      const title =
        relatedImage && typeof relatedImage.title === "string" ? relatedImage.title : "画像";
      return `<li><a href="/images/${imageId}">${escapeHtml(title)}</a></li>`;
    })
    .join("");
};

const renderPreview = (item) => {
  if (
    !(detailPreviewElement instanceof HTMLElement) ||
    !(detailPreviewImageElement instanceof HTMLImageElement) ||
    !(detailPreviewModelElement instanceof HTMLElement) ||
    !(detailPreviewNoteElement instanceof HTMLElement)
  ) {
    return;
  }

  detailPreviewImageElement.classList.add("hidden");
  detailPreviewModelElement.classList.add("hidden");
  detailPreviewNoteElement.classList.add("hidden");
  detailPreviewImageElement.src = "";
  detailPreviewModelElement.setAttribute("src", "");
  detailPreviewNoteElement.textContent = "";

  if (kind === "images" && typeof item.previewUrl === "string") {
    detailPreviewImageElement.src = withCacheBust(item.previewUrl);
    detailPreviewImageElement.alt =
      typeof item.title === "string" ? `${item.title} のプレビュー` : "画像プレビュー";
    detailPreviewImageElement.classList.remove("hidden");
    detailPreviewElement.classList.remove("hidden");
    return;
  }

  if (kind === "models") {
    if (canRenderModelPreview(item)) {
      detailPreviewModelElement.setAttribute("src", withCacheBust(item.previewUrl));
      detailPreviewModelElement.classList.remove("hidden");
    } else {
      detailPreviewNoteElement.textContent =
        "この形式はWebプレビュー未対応です。glb/gltfで投稿すると3D表示できます。";
      detailPreviewNoteElement.classList.remove("hidden");
    }
    detailPreviewElement.classList.remove("hidden");
    return;
  }

  detailPreviewElement.classList.add("hidden");
};

const loadItem = async () => {
  showStatus("読み込み中...", "success");

  try {
    const response = await fetch(`${config.endpoint}/${itemId}`, { cache: "no-store" });
    if (!response.ok) {
      let errorMessage = `詳細の取得に失敗しました: ${response.status}`;
      try {
        const errorPayload = await response.json();
        if (errorPayload && typeof errorPayload.error === "string") {
          errorMessage = errorPayload.error;
        }
      } catch {
        // keep fallback message
      }
      throw new Error(errorMessage);
    }

    const payload = await response.json();
    const item = payload && typeof payload === "object" ? payload.item : null;
    if (!item || typeof item !== "object") {
      throw new Error("詳細レスポンスが不正です。");
    }

    if (itemTitleElement instanceof HTMLElement) {
      itemTitleElement.textContent = typeof item.title === "string" ? item.title : "-";
    }
    if (itemIdElement instanceof HTMLElement) {
      itemIdElement.textContent = String(item.id ?? "-");
    }
    if (itemAuthorElement instanceof HTMLElement) {
      itemAuthorElement.textContent = typeof item.author === "string" ? item.author : "-";
    }
    if (itemCreatedElement instanceof HTMLElement) {
      itemCreatedElement.textContent =
        typeof item.createdAt === "string" ? formatDate(item.createdAt) : "-";
    }
    if (itemOriginalNameElement instanceof HTMLElement) {
      itemOriginalNameElement.textContent =
        typeof item.originalName === "string" ? item.originalName : "-";
    }
    if (itemMimeTypeElement instanceof HTMLElement) {
      itemMimeTypeElement.textContent = typeof item.mimeType === "string" ? item.mimeType : "-";
    }
    if (itemFileSizeElement instanceof HTMLElement) {
      itemFileSizeElement.textContent = formatFileSize(item.fileSize);
    }
    if (downloadLinkElement instanceof HTMLAnchorElement) {
      downloadLinkElement.href = typeof item.downloadUrl === "string" ? item.downloadUrl : "#";
    }

    renderPreview(item);

    const relatedModels =
      payload && typeof payload === "object" && Array.isArray(payload.relatedModels)
        ? payload.relatedModels
        : [];
    renderRelatedModels(relatedModels);

    const relatedImages =
      payload && typeof payload === "object" && Array.isArray(payload.relatedImages)
        ? payload.relatedImages
        : [];
    renderRelatedImages(relatedImages);

    if (editTitleElement instanceof HTMLInputElement) {
      editTitleElement.value = typeof item.title === "string" ? item.title : "";
    }
    if (editAuthorElement instanceof HTMLInputElement) {
      editAuthorElement.value = typeof item.author === "string" ? item.author : "";
    }
    const modelIds = Array.isArray(relatedModels)
      ? relatedModels
          .map((relatedModel) =>
            relatedModel && typeof relatedModel.id === "number" ? relatedModel.id : null
          )
          .filter((id) => typeof id === "number")
      : [];
    editModelPickerState.selectedIds = new Set(modelIds);
    renderEditModelPickerSummary();
    if (kind === "images") {
      queueLoadEditModelCandidates();
    }
    if (editFileElement instanceof HTMLInputElement) {
      editFileElement.value = "";
    }
    if (editPreviewFileElement instanceof HTMLInputElement) {
      editPreviewFileElement.value = "";
    }
    if (editThumbnailFileElement instanceof HTMLInputElement) {
      editThumbnailFileElement.value = "";
    }

    if (detailCardElement instanceof HTMLElement) {
      detailCardElement.classList.remove("hidden");
    }

    originalItemState = {
      title: typeof item.title === "string" ? item.title : "",
      author: typeof item.author === "string" ? item.author : "",
      modelIds: kind === "images" ? normalizeModelIds(modelIds) : "",
    };

    hideStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : "詳細の取得に失敗しました。";
    showStatus(message, "error");
  }
};

if (
  editFormElement instanceof HTMLFormElement &&
  editTitleElement instanceof HTMLInputElement &&
  editAuthorElement instanceof HTMLInputElement
) {
  editFormElement.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = editTitleElement.value.trim();
    const author = editAuthorElement.value.trim();
    const modelIdsInput = kind === "images" ? normalizeModelIds(editModelPickerState.selectedIds) : "";
    const replacementFile =
      editFileElement instanceof HTMLInputElement && editFileElement.files
        ? editFileElement.files[0]
        : undefined;
    const replacementPreviewFile =
      editPreviewFileElement instanceof HTMLInputElement && editPreviewFileElement.files
        ? editPreviewFileElement.files[0]
        : undefined;
    const replacementThumbnailFile =
      editThumbnailFileElement instanceof HTMLInputElement && editThumbnailFileElement.files
        ? editThumbnailFileElement.files[0]
        : undefined;

    if (title === "") {
      showActionStatus("タイトルは必須です。", "error");
      return;
    }
    if (author === "") {
      showActionStatus("投稿者は必須です。", "error");
      return;
    }

    const hasReplacementFile = replacementFile instanceof File;
    const hasReplacementPreviewFile = replacementPreviewFile instanceof File;
    const hasReplacementThumbnailFile = replacementThumbnailFile instanceof File;
    const isSameAsOriginal =
      originalItemState !== null &&
      title === originalItemState.title &&
      author === originalItemState.author &&
      modelIdsInput === originalItemState.modelIds;

    if (
      isSameAsOriginal &&
      !hasReplacementFile &&
      !hasReplacementPreviewFile &&
      !hasReplacementThumbnailFile
    ) {
      showActionStatus("変更内容がありません。", "error");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("author", author);
    if (kind === "images") {
      formData.append("modelIds", modelIdsInput);
    }
    if (replacementFile) {
      formData.append("file", replacementFile);
    }
    if (replacementPreviewFile && kind === "models") {
      formData.append("previewFile", replacementPreviewFile);
    }
    if (replacementThumbnailFile && kind === "models") {
      formData.append("thumbnailFile", replacementThumbnailFile);
    }

    setActionPending(true);
    showActionStatus("保存中...", "success");

    try {
      const response = await fetch(`${config.endpoint}/${itemId}`, {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `保存に失敗しました: ${response.status}`;
        try {
          const errorPayload = await response.json();
          if (errorPayload && typeof errorPayload.error === "string") {
            errorMessage = errorPayload.error;
          }
        } catch {
          // keep fallback message
        }
        throw new Error(errorMessage);
      }

      showActionStatus("保存しました。", "success");
      await loadItem();
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存に失敗しました。";
      showActionStatus(message, "error");
    } finally {
      setActionPending(false);
    }
  });
}

if (
  kind === "images" &&
  editAuthorElement instanceof HTMLInputElement &&
  editModelPickerSearchElement instanceof HTMLInputElement &&
  editModelPickerOptionsElement instanceof HTMLElement
) {
  renderEditModelPickerSummary();
  renderEditModelPickerOptions();

  editAuthorElement.addEventListener("input", () => {
    editModelPickerState.selectedIds.clear();
    queueLoadEditModelCandidates();
  });
  editAuthorElement.addEventListener("blur", () => {
    queueLoadEditModelCandidates();
  });
  editModelPickerSearchElement.addEventListener("input", () => {
    queueLoadEditModelCandidates();
  });
  editModelPickerOptionsElement.addEventListener("change", (event) => {
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
      editModelPickerState.selectedIds.add(modelId);
    } else {
      editModelPickerState.selectedIds.delete(modelId);
    }
    renderEditModelPickerSummary();
  });
  if (editModelPickerElement instanceof HTMLDetailsElement) {
    editModelPickerElement.addEventListener("toggle", () => {
      if (editModelPickerElement.open) {
        queueLoadEditModelCandidates();
      }
    });
  }
}

if (deleteButtonElement instanceof HTMLButtonElement) {
  deleteButtonElement.addEventListener("click", async () => {
    const shouldDelete = await requestDeleteConfirmation();
    if (!shouldDelete) {
      return;
    }

    setActionPending(true);
    showActionStatus("削除中...", "success");

    try {
      const response = await fetch(`${config.endpoint}/${itemId}`, { method: "DELETE" });
      if (!response.ok) {
        let errorMessage = `削除に失敗しました: ${response.status}`;
        try {
          const errorPayload = await response.json();
          if (errorPayload && typeof errorPayload.error === "string") {
            errorMessage = errorPayload.error;
          }
        } catch {
          // keep fallback message
        }
        throw new Error(errorMessage);
      }

      window.location.assign(config.listPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "削除に失敗しました。";
      showActionStatus(message, "error");
      setActionPending(false);
    }
  });
}

if (deleteCancelButtonElement instanceof HTMLButtonElement) {
  deleteCancelButtonElement.addEventListener("click", () => {
    closeDeleteConfirm(false);
  });
}

if (deleteConfirmButtonElement instanceof HTMLButtonElement) {
  deleteConfirmButtonElement.addEventListener("click", () => {
    closeDeleteConfirm(true);
  });
}

if (deleteConfirmOverlayElement instanceof HTMLElement) {
  deleteConfirmOverlayElement.addEventListener("click", (event) => {
    if (event.target === deleteConfirmOverlayElement) {
      closeDeleteConfirm(false);
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (!(deleteConfirmOverlayElement instanceof HTMLElement)) {
    return;
  }
  if (deleteConfirmOverlayElement.classList.contains("hidden")) {
    return;
  }
  closeDeleteConfirm(false);
});

void loadItem();
