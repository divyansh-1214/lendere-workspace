export const positiveIntegerQuery = (value: string | null, fallback: number, maximum?: number) => {
  if (value === null || value.trim() === "") return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("page and pageSize must be positive integers");
  }

  return maximum ? Math.min(parsed, maximum) : parsed;
};

export const optionalNumberQuery = (value: string | null, name: string, minimum = 0) => {
  if (value === null || value.trim() === "") return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`${name} must be a number greater than or equal to ${minimum}`);
  }
  const maximum = name === "age" ? 120 : undefined;
  return maximum ? Math.min(parsed, maximum) : parsed;
};

export const optionalTextQuery = (value: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listQuery = (query: URLSearchParams, name: string) =>
  query.getAll(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

export const sortQuery = (value: string | undefined): Record<string, 1 | -1> => {
  switch (value) {
    case "oldest":
      return { "metadata.createdAt": 1, _id: 1 };
    case "highestCreditScore":
      return { "credit.creditScore": -1, "metadata.createdAt": -1, _id: -1 };
    case "highestIncome":
      return { "employment.income": -1, "metadata.createdAt": -1, _id: -1 };
    case undefined:
    case "newest":
      return { "metadata.createdAt": -1, _id: -1 };
    default:
      throw new Error("sort must be newest, oldest, highestCreditScore, or highestIncome");
  }
};