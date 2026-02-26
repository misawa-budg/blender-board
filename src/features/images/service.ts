import { mockImages, type Image } from "../../mockObjects.js";

export type CreateImageInput = {
  title: string;
  author: string;
  filename: string;
};

const images: Image[] = [...mockImages];
let nextImageId =
  images.reduce((currentMax, image) => Math.max(currentMax, image.id), 0) + 1;

export const listImages = (): Image[] => {
  return [...images];
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
