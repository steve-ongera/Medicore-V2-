import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4000;

const ICONS = {
  success: "bi-check-circle-fill",
  danger: "bi-x-circle-fill",
  warning: "bi-exclamation-triangle-fill",
  info: "bi-info-circle-fill",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = "info", title, description, duration = DEFAULT_DURATION }) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, type, title, description }]);

      if (duration !== 0) {
        setTimeout(() => removeToast(id), duration);
      }
      return id;
    },
    [removeToast]
  );

  // Convenience shorthands so callers can do toast.success("Saved") instead of
  // toast.show({ type: "success", title: "Saved" }).
  const toast = useMemo(
    () => ({
      show: addToast,
      success: (title, description, opts) => addToast({ type: "success", title, description, ...opts }),
      danger: (title, description, opts) => addToast({ type: "danger", title, description, ...opts }),
      error: (title, description, opts) => addToast({ type: "danger", title, description, ...opts }),
      warning: (title, description, opts) => addToast({ type: "warning", title, description, ...opts }),
      info: (title, description, opts) => addToast({ type: "info", title, description, ...opts }),
      dismiss: removeToast,
    }),
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast tone-${t.type}`} role="status">
            <i className={`bi ${ICONS[t.type] || ICONS.info} toast__icon`} aria-hidden="true" />
            <div>
              {t.title && <div className="toast__title">{t.title}</div>}
              {t.description && <div className="toast__desc">{t.description}</div>}
            </div>
            <button
              type="button"
              className="toast__close"
              aria-label="Dismiss notification"
              onClick={() => removeToast(t.id)}
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}