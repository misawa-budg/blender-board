import { mockModels, type Model } from "../../mockObjects.js";

export type CreateModelInput = {
  title: string;
  author: string;
  filename: string;
};

export type UpdateModelInput = {
  title?: string;
  author?: string;
  filename?: string;
};

export type ListModelsOptions = {
  q?: string;
  limit?: number;
};

const models: Model[] = [...mockModels];
let nextModelId =
  models.reduce((currentMax, model) => Math.max(currentMax, model.id), 0) + 1;

export const listModels = (options: ListModelsOptions = {}): Model[] => {
  let result = [...models];

  if (options.q) {
    const loweredKeyword = options.q.toLowerCase();
    result = result.filter((model) => {
      return (
        model.title.toLowerCase().includes(loweredKeyword) ||
        model.author.toLowerCase().includes(loweredKeyword)
      );
    });
  }

  if (typeof options.limit === "number") {
    result = result.slice(0, options.limit);
  }

  return result;
};

export const findModelById = (id: number): Model | undefined => {
  return models.find((model) => model.id === id);
};

export const createModel = (input: CreateModelInput): Model => {
  const newModel: Model = {
    id: nextModelId,
    title: input.title,
    author: input.author,
    createdAt: new Date().toISOString(),
    filename: input.filename,
  };

  nextModelId += 1;
  models.push(newModel);
  return newModel;
};

export const updateModel = (id: number, input: UpdateModelInput): Model | undefined => {
  const model = findModelById(id);
  if (!model) {
    return undefined;
  }

  if (input.title !== undefined) {
    model.title = input.title;
  }
  if (input.author !== undefined) {
    model.author = input.author;
  }
  if (input.filename !== undefined) {
    model.filename = input.filename;
  }

  return model;
};

export const deleteModel = (id: number): boolean => {
  const targetIndex = models.findIndex((model) => model.id === id);
  if (targetIndex === -1) {
    return false;
  }

  models.splice(targetIndex, 1);
  return true;
};
