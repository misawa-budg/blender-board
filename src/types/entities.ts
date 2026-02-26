type MediaEntity = {
  id: number;
  title: string;
  author: string;
  createdAt: string;
  storedPath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

export type Model = MediaEntity & {
  previewStoredPath: string | null;
  previewOriginalName: string | null;
  previewMimeType: string | null;
  previewFileSize: number | null;
};
export type Image = MediaEntity;
