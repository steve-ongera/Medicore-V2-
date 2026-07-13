// src/pages/billing/WalkInSale.jsx
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { searchMedicines, createOTCSale } from "../../services/api";
import { formatDateTime } from "../../utils/formatters";

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "MPESA", label: "M-Pesa" },
  { value: "CARD", label: "Card" },
];

// Page-specific layout primitives (split POS columns, search dropdown, qty
// stepper, summary lines) that don't have a home in main.css yet. Built
// entirely from the shared design tokens so it stays visually consistent —
// worth promoting into main.css if this pattern gets reused elsewhere.
function WalkInSaleStyles() {
  return (
    <style>{`
      .wis-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: var(--space-5);
        align-items: start;
      }
      @media (max-width: 960px) {
        .wis-layout {
          grid-template-columns: 1fr;
        }
      }

      .wis-results {
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        max-height: 280px;
        overflow-y: auto;
        box-shadow: var(--shadow-sm);
      }
      .wis-results__item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        width: 100%;
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--border-subtle);
        text-align: left;
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .wis-results__item:last-child {
        border-bottom: none;
      }
      .wis-results__item:hover:not(:disabled) {
        background: var(--surface-hover);
      }
      .wis-results__item:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .wis-stepper {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .wis-stepper button {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        color: var(--text-secondary);
        transition: background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard);
      }
      .wis-stepper button:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
      .wis-stepper span {
        width: 32px;
        text-align: center;
        font-family: var(--font-mono);
        font-size: var(--fs-sm);
        color: var(--text-primary);
      }

      .wis-summary-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) 0;
        font-size: var(--fs-sm);
      }
      .wis-summary-line--total {
        border-top: 1px solid var(--border-subtle);
        border-bottom: 1px solid var(--border-subtle);
        margin: var(--space-2) 0 var(--space-4);
        padding: var(--space-3) 0;
        font-weight: var(--fw-semibold);
        font-size: var(--fs-md);
        color: var(--text-primary);
      }
    `}</style>
  );
}

export default function WalkInSale() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const [cart, setCart] = useState([]); // [{ medicine, quantity }]
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchMedicines(query);
        setResults(Array.isArray(data) ? data : data?.results ?? []);
      } catch (err) {
        toast.error(err.message || "Failed to search medicines");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const addToCart = (medicine) => {
    setCart((current) => {
      const existing = current.find((item) => item.medicine.id === medicine.id);
      if (existing) {
        return current.map((item) =>
          item.medicine.id === medicine.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { medicine, quantity: 1 }];
    });
    setQuery("");
    setResults([]);
  };

  const updateQuantity = (medicineId, quantity) => {
    if (quantity < 1) return;
    setCart((current) =>
      current.map((item) => (item.medicine.id === medicineId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (medicineId) => {
    setCart((current) => current.filter((item) => item.medicine.id !== medicineId));
  };

  const subtotal = cart.reduce((sum, item) => sum + Number(item.medicine.unit_price) * item.quantity, 0);
  const discountValue = Number(discount) || 0;
  const total = Math.max(subtotal - discountValue, 0);

  const resetSale = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setDiscount("0");
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setAmountPaid("");
  };

  const handleCompleteSale = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error("Add at least one item to the cart");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        discount: discountValue,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        amount_paid: amountPaid === "" ? total : Number(amountPaid),
        items: cart.map((item) => ({ medicine: item.medicine.id, quantity: item.quantity })),
      };
      const sale = await createOTCSale(payload);
      toast.success(`Sale ${sale.sale_number} completed`);
      setReceipt(sale);
      resetSale();
    } catch (err) {
      toast.error(err.message || "Failed to complete sale");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <WalkInSaleStyles />

      <div className="page-header">
        <div>
          <div className="page-eyebrow">Pharmacy</div>
          <h1 className="page-title">Walk-in Sale</h1>
          <p className="page-subtitle">Sell medicine directly over the counter — no patient record required</p>
        </div>
      </div>

      <div className="wis-layout">
        <div>
          <div className="card mb-5">
            <div className="card-header">
              <h2 className="card-title">Find Medicine</h2>
            </div>
            <div className="card-body">
              <input
                className="input"
                placeholder="Search by medicine or generic name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />

              {searching && <p className="text-xs text-faint mt-2">Searching...</p>}

              {results.length > 0 && (
                <div className="wis-results mt-2">
                  {results.map((medicine) => (
                    <button
                      type="button"
                      key={medicine.id}
                      className="wis-results__item"
                      onClick={() => addToCart(medicine)}
                      disabled={medicine.current_stock <= 0}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{medicine.name}</div>
                        <div className="text-2xs text-faint truncate">
                          {medicine.generic_name || "—"} &middot; {medicine.current_stock} {medicine.unit}
                          {medicine.current_stock !== 1 ? "s" : ""} in stock
                        </div>
                      </div>
                      <span className="font-mono text-sm flex-shrink-0">
                        KES {Number(medicine.unit_price).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Cart</h2>
              <span className="text-xs text-faint">
                {cart.length} item{cart.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="card-body p-0">
              {cart.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">
                    <i className="bi bi-cart" style={{ fontSize: "1.25rem" }}></i>
                  </div>
                  <div className="empty-state__title">Cart is empty</div>
                  <div className="empty-state__desc">Search for a medicine above to add it to the sale.</div>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item) => (
                        <tr key={item.medicine.id}>
                          <td className="cell-primary">{item.medicine.name}</td>
                          <td>
                            <div className="wis-stepper">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.medicine.id, item.quantity - 1)}
                              >
                                <i className="bi bi-dash"></i>
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.medicine.id, item.quantity + 1)}
                              >
                                <i className="bi bi-plus"></i>
                              </button>
                            </div>
                          </td>
                          <td className="cell-mono">KES {Number(item.medicine.unit_price).toLocaleString()}</td>
                          <td className="cell-mono">
                            KES {(Number(item.medicine.unit_price) * item.quantity).toLocaleString()}
                          </td>
                          <td className="cell-actions">
                            <button
                              type="button"
                              className="btn-icon-only"
                              style={{ color: "var(--danger-strong)" }}
                              onClick={() => removeFromCart(item.medicine.id)}
                              title="Remove"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <form className="card" onSubmit={handleCompleteSale}>
            <div className="card-header">
              <h2 className="card-title">Order Summary</h2>
            </div>
            <div className="card-body">
              <div className="field">
                <label className="field-label">Customer name (optional)</label>
                <input
                  className="input"
                  placeholder="Walk-in customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label">Customer phone (optional)</label>
                <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>

              <div className="wis-summary-line">
                <span className="text-muted">Subtotal</span>
                <span className="font-mono">KES {subtotal.toLocaleString()}</span>
              </div>

              <div className="field">
                <label className="field-label">Discount (KES)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>

              <div className="wis-summary-line wis-summary-line--total">
                <span>Total</span>
                <span className="font-mono">KES {total.toLocaleString()}</span>
              </div>

              <div className="field">
                <label className="field-label">Payment method</label>
                <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {paymentMethod !== "CASH" && (
                <div className="field">
                  <label className="field-label">
                    {paymentMethod === "MPESA" ? "M-Pesa code" : "Card auth reference"}
                  </label>
                  <input className="input" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                </div>
              )}

              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Amount paid (KES)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  placeholder={total.toFixed(2)}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
            </div>
            <div className="card-footer" style={{ display: "block" }}>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting || cart.length === 0}>
                {submitting ? "Processing..." : `Complete Sale — KES ${total.toLocaleString()}`}
              </button>
            </div>
          </form>
        </div>
      </div>

      {receipt && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Sale Complete</h3>
                <p className="modal-desc">{receipt.sale_number}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setReceipt(null)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="receipt" style={{ width: "100%", padding: 0 }}>
                <div className="receipt__header">
                  <div className="receipt__logo">H</div>
                  <div className="receipt__org">City General Hospital</div>
                  <div className="receipt__meta">
                    {receipt.customer_name || "Walk-in Customer"} &middot; {formatDateTime(receipt.sold_at)}
                  </div>
                </div>

                <div className="receipt__divider" />

                {receipt.items.map((item) => (
                  <div className="receipt__row" key={item.id}>
                    <span className="label">
                      {item.medicine_name} &times; {item.quantity}
                    </span>
                    <span className="value">KES {Number(item.subtotal).toLocaleString()}</span>
                  </div>
                ))}

                <div className="receipt__total-row">
                  <span>Total Paid</span>
                  <span>KES {Number(receipt.total_amount).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setReceipt(null)}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                <i className="bi bi-printer" style={{ marginRight: "var(--space-2)" }}></i>
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}