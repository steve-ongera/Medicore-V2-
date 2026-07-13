import { formatCurrency, formatDateTime } from "../utils/formatters.js";

export default function PrintableReceipt({
  receiptNumber,
  patientName,
  visitNumber,
  cashierName,
  paymentMethod,
  amountPaid,
  invoiceBalance,
  qrCodeUrl,
  paidAt,
  hospitalName = "City General Hospital",
}) {
  return (
    <div className="receipt" id="receipt-print">
      <div className="receipt__header">
        <div className="receipt__logo">H</div>
        <div className="receipt__org">{hospitalName}</div>
        <div className="receipt__meta">P.O. Box 12345, Nairobi</div>
        <div className="receipt__meta">Tel: +254 700 123 456</div>
      </div>

      <div className="receipt__divider" />

      <div className="receipt__row">
        <span className="label">Receipt #</span>
        <span className="value">{receiptNumber}</span>
      </div>
      <div className="receipt__row">
        <span className="label">Date</span>
        <span className="value">{formatDateTime(paidAt)}</span>
      </div>

      <div className="receipt__divider" />

      <div className="receipt__row">
        <span className="label">Patient</span>
        <span className="value">{patientName}</span>
      </div>
      {visitNumber && (
        <div className="receipt__row">
          <span className="label">Visit #</span>
          <span className="value">{visitNumber}</span>
        </div>
      )}
      <div className="receipt__row">
        <span className="label">Cashier</span>
        <span className="value">{cashierName || "—"}</span>
      </div>
      <div className="receipt__row">
        <span className="label">Method</span>
        <span className="value">{paymentMethod}</span>
      </div>

      <div className="receipt__divider" />

      <div className="receipt__row">
        <span className="label">Amount Paid</span>
        <span className="value">{formatCurrency(amountPaid)}</span>
      </div>
      <div className="receipt__row">
        <span className="label">Balance</span>
        <span className="value">{formatCurrency(invoiceBalance)}</span>
      </div>

      <div className="receipt__total-row">
        <span>TOTAL PAID</span>
        <span>{formatCurrency(amountPaid)}</span>
      </div>

      {qrCodeUrl && (
        <div className="receipt__qr">
          <img src={qrCodeUrl} alt="Payment QR Code" />
        </div>
      )}

      <div className="receipt__divider" />

      <div className="receipt__footer">
        Thank you for choosing {hospitalName}
        <br />
        <small>This is a system-generated receipt</small>
      </div>
    </div>
  );
}