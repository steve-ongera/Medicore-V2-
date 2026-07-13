import { useState, useCallback } from "react";

export function usePagination(initialPage = 1, initialPageSize = 20) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(0);

  const resetPagination = useCallback(() => {
    setPage(initialPage);
  }, [initialPage]);

  const goToPage = useCallback((newPage) => {
    setPage(Math.max(1, newPage));
  }, []);

  const nextPage = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const changePageSize = useCallback((newSize) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  const getParams = useCallback(() => {
    return {
      page,
      page_size: pageSize,
    };
  }, [page, pageSize]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    setTotal,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    resetPagination,
    getParams,
  };
}