export type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

export type ListSortField = "id" | "createdAt" | "title";
export type ListSortOrder = "asc" | "desc";

export type ListQueryOptions = {
  q?: string;
  author?: string;
  limit?: number;
  page?: number;
  sort?: ListSortField;
  order?: ListSortOrder;
};

export type MediaCreateInput = {
  title: string;
  author: string;
};

export type MediaUpdateInput = {
  title?: string;
  author?: string;
};

type ValidateUpdateMediaInputOptions = {
  requireAtLeastOne?: boolean;
};

export const parsePositiveInt = (value: string): number | null => {
  const trimmedValue = value.trim();
  if (!/^[1-9]\d*$/.test(trimmedValue)) {
    return null;
  }

  const parsedValue = Number(trimmedValue);
  if (!Number.isSafeInteger(parsedValue)) {
    return null;
  }

  return parsedValue;
};

export const validateListQuery = (value: unknown): ValidationResult<ListQueryOptions> => {
  if (typeof value !== "object" || value === null) {
    return { ok: false, message: "クエリはオブジェクトで指定してください。" };
  }

  const candidate = value as Record<string, unknown>;
  const options: ListQueryOptions = {};

  if (typeof candidate.q === "string") {
    const trimmedValue = candidate.q.trim();
    if (trimmedValue.length > 0) {
      options.q = trimmedValue;
    }
  }

  if (typeof candidate.author === "string") {
    const trimmedAuthor = candidate.author.trim();
    if (trimmedAuthor.length > 0) {
      options.author = trimmedAuthor;
    }
  }

  if (candidate.limit !== undefined) {
    if (typeof candidate.limit !== "string") {
      return { ok: false, message: "limitは正の整数で指定してください。" };
    }

    const parsedLimit = parsePositiveInt(candidate.limit);
    if (parsedLimit === null || parsedLimit > 100) {
      return { ok: false, message: "limitは1から100の範囲で指定してください。" };
    }

    options.limit = parsedLimit;
  }

  if (candidate.page !== undefined) {
    if (typeof candidate.page !== "string") {
      return { ok: false, message: "pageは正の整数で指定してください。" };
    }

    const parsedPage = parsePositiveInt(candidate.page);
    if (parsedPage === null || parsedPage > 100000) {
      return { ok: false, message: "pageは1から100000の範囲で指定してください。" };
    }
    options.page = parsedPage;
  }

  if (options.page !== undefined && options.limit === undefined) {
    return { ok: false, message: "pageを指定する場合はlimitも指定してください。" };
  }

  if (candidate.sort !== undefined) {
    if (typeof candidate.sort !== "string") {
      return { ok: false, message: "sortはid, createdAt, titleのいずれかで指定してください。" };
    }

    if (candidate.sort !== "id" && candidate.sort !== "createdAt" && candidate.sort !== "title") {
      return { ok: false, message: "sortはid, createdAt, titleのいずれかで指定してください。" };
    }
    options.sort = candidate.sort;
  }

  if (candidate.order !== undefined) {
    if (typeof candidate.order !== "string") {
      return { ok: false, message: "orderはascまたはdescで指定してください。" };
    }

    if (candidate.order !== "asc" && candidate.order !== "desc") {
      return { ok: false, message: "orderはascまたはdescで指定してください。" };
    }
    options.order = candidate.order;
  }

  return { ok: true, value: options };
};

export const validateCreateMediaInput = (
  value: unknown
): ValidationResult<MediaCreateInput> => {
  if (typeof value !== "object" || value === null) {
    return { ok: false, message: "リクエストボディはオブジェクトで指定してください。" };
  }

  const candidate = value as Record<string, unknown>;
  const title = candidate.title;
  const author = candidate.author;

  if (typeof title !== "string" || title.trim() === "") {
    return { ok: false, message: "titleは必須で、空でない文字列で指定してください。" };
  }

  if (typeof author !== "string" || author.trim() === "") {
    return { ok: false, message: "authorは必須で、空でない文字列で指定してください。" };
  }

  return {
    ok: true,
    value: {
      title: title.trim(),
      author: author.trim(),
    },
  };
};

export const validateUpdateMediaInput = (
  value: unknown,
  options: ValidateUpdateMediaInputOptions = {}
): ValidationResult<MediaUpdateInput> => {
  const requireAtLeastOne = options.requireAtLeastOne ?? true;

  if (typeof value !== "object" || value === null) {
    return { ok: false, message: "リクエストボディはオブジェクトで指定してください。" };
  }

  const candidate = value as Record<string, unknown>;
  const result: MediaUpdateInput = {};

  if (candidate.title !== undefined) {
    if (typeof candidate.title !== "string" || candidate.title.trim() === "") {
      return { ok: false, message: "titleを指定する場合は空でない文字列にしてください。" };
    }
    result.title = candidate.title.trim();
  }

  if (candidate.author !== undefined) {
    if (typeof candidate.author !== "string" || candidate.author.trim() === "") {
      return { ok: false, message: "authorを指定する場合は空でない文字列にしてください。" };
    }
    result.author = candidate.author.trim();
  }

  if (requireAtLeastOne && Object.keys(result).length === 0) {
    return { ok: false, message: "titleまたはauthorのいずれかを指定してください。" };
  }

  return { ok: true, value: result };
};
