//src/services/api.js
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// ---------------------------------------------------------------------------
// Axios instance + interceptors
// ---------------------------------------------------------------------------
const client = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  refreshQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't try to refresh on the login/refresh endpoints themselves
    const isAuthRoute = originalRequest.url?.includes("/auth/login") || originalRequest.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh: refreshToken });
        localStorage.setItem("access_token", data.access);
        client.defaults.headers.Authorization = `Bearer ${data.access}`;
        processQueue(null, data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Normalizes DRF's {success, status_code, errors} shape into a plain Error with .message
const unwrap = (promise) =>
  promise.then((res) => res.data).catch((err) => {
    const payload = err.response?.data;
    const message =
      payload?.errors?.detail ||
      (typeof payload?.errors === "string" ? payload.errors : null) ||
      (payload?.errors && JSON.stringify(payload.errors)) ||
      err.message ||
      "Something went wrong";
    const wrapped = new Error(message);
    wrapped.status = err.response?.status;
    wrapped.errors = payload?.errors;
    throw wrapped;
  });

// Turns { page: 2, search: 'john', status: 'PAID' } into a query string, skipping empties
const qs = (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
};

// ===========================================================================
// AUTH
// ===========================================================================
export const login = (username, password) => unwrap(client.post("/auth/login/", { username, password }));
export const logout = (refresh) => unwrap(client.post("/auth/logout/", { refresh }));
export const getMe = () => unwrap(client.get("/auth/me/"));
export const changePassword = (payload) => unwrap(client.post("/auth/change-password/", payload));

// ===========================================================================
// USERS (Super Admin)
// ===========================================================================
export const getUsers = (params) => unwrap(client.get(`/users/${qs(params)}`));
export const getUser = (id) => unwrap(client.get(`/users/${id}/`));
export const createUser = (payload) => unwrap(client.post("/users/", payload));
export const updateUser = (id, payload) => unwrap(client.patch(`/users/${id}/`, payload));
export const deleteUser = (id) => unwrap(client.delete(`/users/${id}/`));

// ===========================================================================
// DEPARTMENTS
// ===========================================================================
export const getDepartments = (params) => unwrap(client.get(`/departments/${qs(params)}`));
export const createDepartment = (payload) => unwrap(client.post("/departments/", payload));
export const updateDepartment = (id, payload) => unwrap(client.patch(`/departments/${id}/`, payload));
export const deleteDepartment = (id) => unwrap(client.delete(`/departments/${id}/`));

// ===========================================================================
// PATIENTS
// ===========================================================================
export const getPatients = (params) => unwrap(client.get(`/patients/${qs(params)}`));
export const getPatient = (id) => unwrap(client.get(`/patients/${id}/`));
export const createPatient = (payload) => unwrap(client.post("/patients/", payload));
export const updatePatient = (id, payload) => unwrap(client.patch(`/patients/${id}/`, payload));
export const deletePatient = (id) => unwrap(client.delete(`/patients/${id}/`));
export const searchPatient = (query) => unwrap(client.get(`/patients/search/${qs({ q: query })}`));
export const getPatientVisits = (id) => unwrap(client.get(`/patients/${id}/visits/`));
export const getPatientSummary = (id) => unwrap(client.get(`/patients/${id}/summary/`));

export const createAllergy = (payload) => unwrap(client.post("/allergies/", payload));
export const deleteAllergy = (id) => unwrap(client.delete(`/allergies/${id}/`));
export const createMedicalHistoryNote = (payload) => unwrap(client.post("/medical-history/", payload));
export const deleteMedicalHistoryNote = (id) => unwrap(client.delete(`/medical-history/${id}/`));

// ===========================================================================
// VISITS
// ===========================================================================
export const getVisits = (params) => unwrap(client.get(`/visits/${qs(params)}`));
export const getVisit = (id) => unwrap(client.get(`/visits/${id}/`));
export const registerVisit = (payload) => unwrap(client.post("/visits/", payload));
export const updateVisit = (id, payload) => unwrap(client.patch(`/visits/${id}/`, payload));

// ===========================================================================
// BILLING
// ===========================================================================
export const getInvoices = (params) => unwrap(client.get(`/invoices/${qs(params)}`));
export const getInvoice = (id) => unwrap(client.get(`/invoices/${id}/`));

export const getPayments = (params) => unwrap(client.get(`/payments/${qs(params)}`));
export const createPayment = (payload) => unwrap(client.post("/payments/", payload));
export const getReceipt = (paymentId) => unwrap(client.get(`/payments/${paymentId}/receipt/`));

// ===========================================================================
// QUEUE
// ===========================================================================
export const getQueue = (params) => unwrap(client.get(`/queue/${qs(params)}`));
export const getMyQueue = (queueType) => unwrap(client.get(`/queue/my-queue/${qs({ queue_type: queueType })}`));
export const callNextInQueue = (id) => unwrap(client.post(`/queue/${id}/call-next/`));
export const updateQueueEntry = (id, payload) => unwrap(client.patch(`/queue/${id}/`, payload));

// ===========================================================================
// NURSE / TRIAGE (VITALS)
// ===========================================================================
export const getVitals = (params) => unwrap(client.get(`/vitals/${qs(params)}`));
export const saveVitals = (payload) => unwrap(client.post("/vitals/", payload));

// ===========================================================================
// ICD-10
// ===========================================================================
export const lookupIcd10 = (query) => unwrap(client.get(`/icd10/lookup/${qs({ q: query })}`));

// ===========================================================================
// DOCTOR / CONSULTATION
// ===========================================================================
export const getConsultations = (params) => unwrap(client.get(`/consultations/${qs(params)}`));
export const getConsultation = (id) => unwrap(client.get(`/consultations/${id}/`));
export const startConsultation = (payload) => unwrap(client.post("/consultations/", payload));
export const saveConsultation = (id, payload) => unwrap(client.patch(`/consultations/${id}/`, payload));
export const deleteConsultation = (id) => unwrap(client.delete(`/consultations/${id}/`));
export const addDiagnosis = (id, payload) => unwrap(client.post(`/consultations/${id}/add-diagnosis/`, payload));
export const pauseConsultation = (id, payload) => unwrap(client.post(`/consultations/${id}/pause/`, payload));
export const resumeConsultation = (id) => unwrap(client.post(`/consultations/${id}/resume/`));
export const completeConsultation = (id) => unwrap(client.post(`/consultations/${id}/complete/`));

export const getPrescriptions = (params) => unwrap(client.get(`/prescriptions/${qs(params)}`));
export const createPrescription = (payload) => unwrap(client.post("/prescriptions/", payload));
export const searchMedicines = (query) => unwrap(client.get(`/medicines/autocomplete/${qs({ q: query })}`));

// ===========================================================================
// LABORATORY
// ===========================================================================
export const getLabTestCatalog = (params) => unwrap(client.get(`/lab-tests-catalog/${qs(params)}`));
export const createLabTest = (payload) => unwrap(client.post("/lab-tests-catalog/", payload));
export const updateLabTest = (id, payload) => unwrap(client.patch(`/lab-tests-catalog/${id}/`, payload));
export const deleteLabTest = (id) => unwrap(client.delete(`/lab-tests-catalog/${id}/`));

export const getLabOrders = (params) => unwrap(client.get(`/lab-orders/${qs(params)}`));
export const getPendingLabOrders = () => unwrap(client.get("/lab-orders/pending/"));
export const createLabOrder = (payload) => unwrap(client.post("/lab-orders/", payload));
export const collectLabOrder = (id) => unwrap(client.post(`/lab-orders/${id}/collect/`));
export const uploadLabResults = (payload) => {
  const form = toFormData(payload);
  return unwrap(client.post("/lab-results/", form, { headers: { "Content-Type": "multipart/form-data" } }));
};

// ===========================================================================
// RADIOLOGY
// ===========================================================================
export const getRadiologyTestCatalog = (params) => unwrap(client.get(`/radiology-tests-catalog/${qs(params)}`));
export const createRadiologyTest = (payload) => unwrap(client.post("/radiology-tests-catalog/", payload));
export const updateRadiologyTest = (id, payload) => unwrap(client.patch(`/radiology-tests-catalog/${id}/`, payload));
export const deleteRadiologyTest = (id) => unwrap(client.delete(`/radiology-tests-catalog/${id}/`));

export const getRadiologyOrders = (params) => unwrap(client.get(`/radiology-orders/${qs(params)}`));
export const getPendingRadiologyOrders = () => unwrap(client.get("/radiology-orders/pending/"));
export const createRadiologyOrder = (payload) => unwrap(client.post("/radiology-orders/", payload));
export const uploadRadiologyReport = (payload) => {
  const form = toFormData(payload);
  return unwrap(client.post("/radiology-results/", form, { headers: { "Content-Type": "multipart/form-data" } }));
};

// ===========================================================================
// PHARMACY / INVENTORY
// ===========================================================================
export const getMedicines = (params) => unwrap(client.get(`/medicines/${qs(params)}`));
export const createMedicine = (payload) => unwrap(client.post("/medicines/", payload));
export const updateMedicine = (id, payload) => unwrap(client.patch(`/medicines/${id}/`, payload));
export const getLowStockMedicines = () => unwrap(client.get("/medicines/low-stock/"));

export const getSuppliers = (params) => unwrap(client.get(`/suppliers/${qs(params)}`));
export const createSupplier = (payload) => unwrap(client.post("/suppliers/", payload));
export const updateSupplier = (id, payload) => unwrap(client.patch(`/suppliers/${id}/`, payload));
export const deleteSupplier = (id) => unwrap(client.delete(`/suppliers/${id}/`));

export const getMedicineBatches = (params) => unwrap(client.get(`/medicine-batches/${qs(params)}`));
export const createMedicineBatch = (payload) => unwrap(client.post("/medicine-batches/", payload));

export const getStockTransactions = (params) => unwrap(client.get(`/stock-transactions/${qs(params)}`));
export const createStockTransaction = (payload) => unwrap(client.post("/stock-transactions/", payload));

export const dispenseMedicine = (payload) => unwrap(client.post("/pharmacy-dispenses/", payload));
export const getDispenses = (params) => unwrap(client.get(`/pharmacy-dispenses/${qs(params)}`));

// ---------------------------------------------------------------------------
// Walk-in / OTC Sales (POS) — no patient record required
// ---------------------------------------------------------------------------
export const getOTCSales = (params) => unwrap(client.get(`/otc-sales/${qs(params)}`));
export const createOTCSale = (payload) => unwrap(client.post("/otc-sales/", payload));
export const getOTCSaleReceipt = (id) => unwrap(client.get(`/otc-sales/${id}/receipt/`));

// ===========================================================================
// DASHBOARD / REPORTS
// ===========================================================================
export const getDashboard = () => unwrap(client.get("/dashboard/"));
export const getReports = (type, params) => unwrap(client.get(`/reports/${qs({ type, ...params })}`));

// ===========================================================================
// AUDIT LOG
// ===========================================================================
export const getAuditLogs = (params) => unwrap(client.get(`/audit-logs/${qs(params)}`));
export const getAllTransactions = (params) => unwrap(client.get(`/transactions/${qs(params)}`));

// ---------------------------------------------------------------------------
// Helper: build multipart FormData for endpoints that accept file uploads
// ---------------------------------------------------------------------------
function toFormData(obj) {
  const form = new FormData();
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, value);
  });
  return form;
}

export default client;