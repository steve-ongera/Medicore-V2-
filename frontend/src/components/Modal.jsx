//src/components/Modal.jsx
export default function Modal({ show, onClose, title, description, children, footer, size = "" }) {
  if (!show) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h5 className="modal-title">{title}</h5>
            {description && <p className="modal-desc">{description}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}