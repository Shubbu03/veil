export interface PaginationResult<T> {
  currentPage: number;
  totalPages: number;
  pageItems: T[];
  pageNumbers: number[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): PaginationResult<T> {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const currentPage = clampPage(page, totalPages);
  const startIndex = (currentPage - 1) * safePageSize;

  return {
    currentPage,
    totalPages,
    pageItems: items.slice(startIndex, startIndex + safePageSize),
    pageNumbers: buildPageNumbers(currentPage, totalPages),
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };
}

function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.min(Math.trunc(page), totalPages);
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  const windowSize = 5;
  const halfWindow = Math.floor(windowSize / 2);
  const startPage = Math.max(1, Math.min(currentPage - halfWindow, totalPages - windowSize + 1));
  const endPage = Math.min(totalPages, startPage + windowSize - 1);

  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
}
