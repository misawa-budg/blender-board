import { mockImages, type Image } from "../../mockObjects.js";

export type CreateImageInput = {
  title: string;
  author: string;
  filename: string;
};

export type UpdateImageInput = {
  title?: string;
  author?: string;
  filename?: string;
};

export type ListImagesOptions = {
  q?: string;
  limit?: number;
};

const images: Image[] = [...mockImages];
let nextImageId =
  images.reduce((currentMax, image) => Math.max(currentMax, image.id), 0) + 1;

export const listImages = (options: ListImagesOptions = {}): Image[] => {
  let result = [...images];

  if (options.q) {
    const loweredKeyword = options.q.toLowerCase();
    result = result.filter((image) => {
      return (
        image.title.toLowerCase().includes(loweredKeyword) ||
        image.author.toLowerCase().includes(loweredKeyword)
      );
    });
  }

  if (typeof options.limit === "number") {
    result = result.slice(0, options.limit);
  }

  return result;
};

export const findImageById = (id: number): Image | undefined => {
  return images.find((image) => image.id === id);
};

export const createImage = (input: CreateImageInput): Image => {
  const newImage: Image = {
    id: nextImageId,
    title: input.title,
    author: input.author,
    createdAt: new Date().toISOString(),
    filename: input.filename,
  };

  nextImageId += 1;
  images.push(newImage);
  return newImage;
};

export const updateImage = (id: number, input: UpdateImageInput): Image | undefined => {
  const image = findImageById(id);
  if (!image) {
    return undefined;
  }

  if (input.title !== undefined) {
    image.title = input.title;
  }
  if (input.author !== undefined) {
    image.author = input.author;
  }
  if (input.filename !== undefined) {
    image.filename = input.filename;
  }

  return image;
};

export const deleteImage = (id: number): boolean => {
  const targetIndex = images.findIndex((image) => image.id === id);
  if (targetIndex === -1) {
    return false;
  }

  images.splice(targetIndex, 1);
  return true;
};
