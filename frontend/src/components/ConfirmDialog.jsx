import Modal from "./Modal.jsx";

export default function ConfirmDialog({
  show,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger", // danger, warning, info
  loading = false,
}) {
  const variantMap = {
    danger: { bg: "bg-danger", text: "text-danger", icon: "bi-exclamation-triangle" },
    warning: { bg: "bg-warning", text: "text-warning", icon: "bi-exclamation-circle" },
    info: { bg: "bg-info", text: "text-info", icon: "bi-info-circle" },
  };

  const v = variantMap[variant] || variantMap.danger;

  const footer = (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onClose}
        disabled={loading}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        className={`btn btn-${variant}`}
        onClick={onConfirm}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Processing...
          </>
        ) : (
          confirmLabel
        )}
      </button>
    </>
  );

  return (
    <Modal show={show} onClose={onClose} title={title} footer={footer} size="modal-sm">
      <div className="text-center py-3">
        <div className={`${v.bg} bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3`}
             style={{ width: 56, height: 56 }}>
          <i className={`${v.icon} ${v.text} fs-2`}></i>
        </div>
        <p className="text-muted mb-0">{message}</p>
      </div>
    </Modal>
  );
}