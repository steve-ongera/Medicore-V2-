import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

export function useApi(apiFunction, options = {}) {
  const {
    immediate = true,
    onSuccess = null,
    onError = null,
    showSuccessToast = false,
    showErrorToast = true,
    successMessage = "Operation successful",
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction(...args);
      setData(result);

      if (showSuccessToast) {
        toast.success(successMessage);
      }

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (err) {
      setError(err);
      
      if (showErrorToast) {
        toast.error(err.message || "Something went wrong");
      }

      if (onError) {
        onError(err);
      }

      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, onSuccess, onError, showSuccessToast, showErrorToast, successMessage]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}