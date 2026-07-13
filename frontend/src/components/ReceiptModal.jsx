import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getReceipt } from "../services/api";
import Modal from "./Modal";
import LoadingSpinner from "./LoadingSpinner";
import { formatCurrency, formatDateTime } from "../utils/formatters";

// Standalone print stylesheet — used only inside the popped-out print window,
// kept separate from the app's global CSS so printed receipts stay
// consistent regardless of screen theme.
const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px;
    width: 420px;
    font-family: 'Courier New', Courier, monospace;
    color: #111;
  }
  .receipt__header { text-align: center; margin-bottom: 14px; }
  .receipt__hospital { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
  .receipt__sub { font-size: 12px; color: #555; margin-top: 3px; }
  .receipt__divider { border-top: 1px dashed #999; margin: 14px 0; }
  .receipt__row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; gap: 12px; }
  .receipt__row span:first-child { color: #555; }
  .receipt__row--lg { font-size: 17px; font-weight: 700; padding: 6px 0; }
  .receipt__row--lg span:first-child { color: #111; }
  .receipt__qr-block { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 18px 0 6px; }
  .receipt__qr { text-align: center; }
  .receipt__qr img { width: 150px; height: 150px; display: block; }
  .receipt__qr-missing {
    width: 150px; height: 150px;
    border: 1.5px dashed #ccc;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; color: #999; text-align: center; padding: 8px;
  }
  .receipt__qr-caption { font-size: 10px; color: #666; margin-top: 6px; text-align: center; }
  .receipt__stamp-box {
    width: 150px; height: 150px;
    border: 1.5px dashed #999;
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    text-align: center;
    font-size: 11px;
    color: #999;
    padding: 8px;
  }
  .receipt__auto-note {
    font-size: 10.5px;
    color: #555;
    text-align: center;
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px dashed #ccc;
    line-height: 1.5;
  }
  .receipt__footer { text-align: center; font-size: 12px; margin-top: 10px; color: #444; font-weight: 600; }
  .cell-mono { font-family: 'Courier New', monospace; }
  .fw-semibold { font-weight: 700; }
  .text-danger { color: #b91c1c; }
  .text-success { color: #15803d; }
  .tag { display: inline-block; border: 1px solid #ccc; padding: 2px 9px; border-radius: 10px; font-size: 11px; }
  @media print {
    body { padding: 0; }
  }
`;

export default function ReceiptModal({ paymentId, show, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => {
    if (show && paymentId) {
      loadReceipt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, paymentId]);

  const loadReceipt = async () => {
    setLoading(true);
    setReceipt(null);
    setQrFailed(false);
    try {
      const data = await getReceipt(paymentId);
      setReceipt(data);
    } catch (err) {
      toast.error(err.message || "Failed to load receipt");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printWindow = window.open("", "_blank", "width=520,height=760");
    if (!printWindow) {
      toast.error("Please allow pop-ups to print the receipt");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${receipt?.receipt_number || ""}</title>
          <style>${PRINT_STYLES}</style>
        </head>
        <body>${receiptRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    // Give images (QR code) a moment to load before the print dialog fires
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 350);
    };
  };

  const handleDownloadPdf = async () => {
    if (!receiptRef.current || !receipt) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");

      // A6-ish PDF, height auto-scaled to content so nothing gets cropped
      const pdfWidth = 105; // mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Receipt_${receipt.receipt_number}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF. If the QR code is on a different domain, it may need CORS enabled.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Payment Receipt"
      size="modal-md"
      footer={
        !loading && receipt ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn-outline-primary" onClick={handlePrint}>
              <i className="bi bi-printer me-2"></i>
              Print
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? (
                <span className="spinner-border spinner-border-sm me-2" role="status" />
              ) : (
                <i className="bi bi-download me-2"></i>
              )}
              Download PDF
            </button>
          </>
        ) : null
      }
    >
      {loading ? (
        <LoadingSpinner />
      ) : receipt ? (
        <>
          <style>{`
            .receipt-preview { font-family: 'Courier New', Courier, monospace; }
            .receipt-preview .receipt__header { text-align: center; margin-bottom: 14px; }
            .receipt-preview .receipt__hospital { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
            .receipt-preview .receipt__sub { font-size: 12px; color: #6b7280; margin-top: 3px; }
            .receipt-preview .receipt__divider { border-top: 1px dashed #cbd5e1; margin: 14px 0; }
            .receipt-preview .receipt__row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; gap: 12px; }
            .receipt-preview .receipt__row span:first-child { color: #6b7280; }
            .receipt-preview .receipt__row--lg { font-size: 17px; padding: 6px 0; }
            .receipt-preview .receipt__qr-block { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 18px 0 6px; flex-wrap: wrap; }
            .receipt-preview .receipt__qr { text-align: center; }
            .receipt-preview .receipt__qr img { width: 150px; height: 150px; display: block; }
            .receipt-preview .receipt__qr-missing {
              width: 150px; height: 150px;
              border: 1.5px dashed #e2e8f0;
              display: flex; align-items: center; justify-content: center;
              font-size: 10px; color: #9ca3af; text-align: center; padding: 8px;
              border-radius: 6px;
            }
            .receipt-preview .receipt__qr-caption { font-size: 10px; color: #6b7280; margin-top: 6px; }
            .receipt-preview .receipt__stamp-box {
              width: 150px; height: 150px;
              border: 1.5px dashed #cbd5e1;
              border-radius: 6px;
              display: flex; align-items: center; justify-content: center;
              text-align: center;
              font-size: 11px;
              color: #9ca3af;
              padding: 8px;
            }
            .receipt-preview .receipt__auto-note {
              font-size: 10.5px;
              color: #6b7280;
              text-align: center;
              margin-top: 16px;
              padding-top: 10px;
              border-top: 1px dashed #e2e8f0;
              line-height: 1.5;
            }
            .receipt-preview .receipt__footer { text-align: center; font-size: 12px; margin-top: 10px; color: #374151; font-weight: 600; }
          `}</style>
          <div className="receipt-preview p-4 border rounded" ref={receiptRef} style={{ maxWidth: 460, margin: "0 auto" }}>
            <div className="receipt__header">
              <div className="receipt__hospital">{receipt.hospital_name}</div>
              <div className="receipt__sub">Official Payment Receipt</div>
            </div>

            <div className="receipt__divider" />

            <div className="receipt__row">
              <span>Receipt #</span>
              <span className="cell-mono">{receipt.receipt_number}</span>
            </div>
            <div className="receipt__row">
              <span>Date</span>
              <span>{formatDateTime(receipt.paid_at)}</span>
            </div>
            {receipt.visit_number && (
              <div className="receipt__row">
                <span>Visit #</span>
                <span className="cell-mono">{receipt.visit_number}</span>
              </div>
            )}
            <div className="receipt__row">
              <span>Patient</span>
              <span>{receipt.patient_name}</span>
            </div>
            <div className="receipt__row">
              <span>Cashier</span>
              <span>{receipt.cashier || "—"}</span>
            </div>
            <div className="receipt__row">
              <span>Method</span>
              <span className="tag">{receipt.payment_method}</span>
            </div>

            <div className="receipt__divider" />

            <div className="receipt__row receipt__row--lg">
              <span>Amount Paid</span>
              <span className="fw-semibold">{formatCurrency(receipt.amount_paid)}</span>
            </div>
            <div className="receipt__row">
              <span>Balance Remaining</span>
              <span className={Number(receipt.invoice_balance) > 0 ? "text-danger fw-semibold" : "text-success"}>
                {formatCurrency(receipt.invoice_balance)}
              </span>
            </div>

            <div className="receipt__divider" />

            {/* QR code fetched from the payment record, next to an official stamp/signature box */}
            <div className="receipt__qr-block">
              <div className="receipt__qr">
                {receipt.qr_code_url && !qrFailed ? (
                  <img
                    src={receipt.qr_code_url}
                    alt="Receipt QR Code"
                    crossOrigin="anonymous"
                    onError={() => setQrFailed(true)}
                  />
                ) : (
                  <div className="receipt__qr-missing">
                    QR code unavailable
                  </div>
                )}
                <div className="receipt__qr-caption">Scan to verify this receipt</div>
              </div>
              <div className="receipt__stamp-box">
                Official Stamp / Signature
              </div>
            </div>

            <div className="receipt__auto-note">
              This is an automated receipt generated by the {receipt.hospital_name} Hospital Management
              Information System (HMIS). No handwritten signature is required for validity — authenticity
              can be verified by scanning the QR code above.
            </div>

            <div className="receipt__footer">Thank you for choosing {receipt.hospital_name}</div>
          </div>
        </>
      ) : (
        <div className="text-muted text-center py-4">Receipt not found.</div>
      )}
    </Modal>
  );
}