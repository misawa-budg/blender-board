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

export type Model = MediaEntity;
export type Image = MediaEntity;
