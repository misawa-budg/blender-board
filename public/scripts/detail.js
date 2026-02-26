const pathMatch = /^\/(images|models)\/(\d+)$/.exec(window.location.pathname);

const detailConfigMap = {
  images: {
    endpoint: "/api/images",
    listPath: "/images",
    label: "Image",
    fileAccept: ".png,.jpg,.jpeg,.webp,.gif",
  },
  models: {
    endpoint: "/api/models",
    listPath: "/models",
    label: "Model",
    fileAccept: ".obj,.fbx,.blend,.glb,.gltf,.stl,.ply",
  },
};

const detailStatusElement = document.getElementById("detail-status");
const actionStatusElement = document.getElementById("action-status");
const detailCardElement = document.getElementById("detail-card");
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
const editFormElement = document.getElementById("edit-form");
const editTitleElement = document.getElementById("edit-title");
const editAuthorElement = document.getElementById("edit-author");
const editFileElement = document.getElementById("edit-file");
const saveButtonElement = document.getElementById("save-button");
const deleteButtonElement = document.getElementById("delete-button");

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

if (!pathMatch) {
  showStatus("Invalid detail path.", "error");
  throw new Error("Invalid detail path.");
}

const kind = pathMatch[1];
const itemId = pathMatch[2];
const config = detailConfigMap[kind];
if (!config) {
  showStatus("Invalid detail path.", "error");
  throw new Error("Invalid detail config.");
}

if (detailHeadingElement instanceof HTMLElement) {
  detailHeadingElement.textContent = `${config.label} Detail`;
}
if (detailDescriptionElement instanceof HTMLElement) {
  detailDescriptionElement.textContent = `View metadata and download this ${config.label.toLowerCase()}.`;
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

const setActionPending = (pending) => {
  if (saveButtonElement instanceof HTMLButtonElement) {
    saveButtonElement.disabled = pending;
  }
  if (deleteButtonElement instanceof HTMLButtonElement) {
    deleteButtonElement.disabled = pending;
  }
};

const loadItem = async () => {
  showStatus("Loading...", "success");
  try {
    const response = await fetch(`${config.endpoint}/${itemId}`);
    if (!response.ok) {
      let errorMessage = `Failed to load item: ${response.status}`;
      try {
        const errorPayload = await response.json();
        if (errorPayload && typeof errorPayload.error === "string") {
          errorMessage = errorPayload.error;
        }
      } catch {
        // Keep fallback message.
      }
      throw new Error(errorMessage);
    }

    const payload = await response.json();
    const item = payload && typeof payload === "object" ? payload.item : null;
    if (!item || typeof item !== "object") {
      throw new Error("Invalid detail response.");
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
      const downloadUrl = typeof item.downloadUrl === "string" ? item.downloadUrl : "#";
      downloadLinkElement.href = downloadUrl;
    }
    if (editTitleElement instanceof HTMLInputElement) {
      editTitleElement.value = typeof item.title === "string" ? item.title : "";
    }
    if (editAuthorElement instanceof HTMLInputElement) {
      editAuthorElement.value = typeof item.author === "string" ? item.author : "";
    }
    if (editFileElement instanceof HTMLInputElement) {
      editFileElement.value = "";
    }
    if (detailCardElement instanceof HTMLElement) {
      detailCardElement.classList.remove("hidden");
    }

    hideStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load detail.";
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
    const replacementFile =
      editFileElement instanceof HTMLInputElement && editFileElement.files
        ? editFileElement.files[0]
        : undefined;

    if (title === "") {
      showActionStatus("Title is required.", "error");
      return;
    }
    if (author === "") {
      showActionStatus("Author is required.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("author", author);
    if (replacementFile) {
      formData.append("file", replacementFile);
    }

    setActionPending(true);
    showActionStatus("Saving...", "success");

    try {
      const response = await fetch(`${config.endpoint}/${itemId}`, {
        method: "PATCH",
        body: formData,
      });
      if (!response.ok) {
        let errorMessage = `Save failed: ${response.status}`;
        try {
          const errorPayload = await response.json();
          if (errorPayload && typeof errorPayload.error === "string") {
            errorMessage = errorPayload.error;
          }
        } catch {
          // Keep fallback message.
        }
        throw new Error(errorMessage);
      }

      showActionStatus("Saved.", "success");
      await loadItem();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      showActionStatus(message, "error");
    } finally {
      setActionPending(false);
    }
  });
}

if (deleteButtonElement instanceof HTMLButtonElement) {
  deleteButtonElement.addEventListener("click", async () => {
    const shouldDelete = window.confirm(
      `Delete this ${config.label.toLowerCase()}? This cannot be undone.`
    );
    if (!shouldDelete) {
      return;
    }

    setActionPending(true);
    showActionStatus("Deleting...", "success");

    try {
      const response = await fetch(`${config.endpoint}/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let errorMessage = `Delete failed: ${response.status}`;
        try {
          const errorPayload = await response.json();
          if (errorPayload && typeof errorPayload.error === "string") {
            errorMessage = errorPayload.error;
          }
        } catch {
          // Keep fallback message.
        }
        throw new Error(errorMessage);
      }

      window.location.assign(config.listPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      showActionStatus(message, "error");
      setActionPending(false);
    }
  });
}

void loadItem();
