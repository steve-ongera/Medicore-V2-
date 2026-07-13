import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdmissions } from "../../services/api";

export default function AdmissionList() {
  const [admissions, setAdmissions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ADMITTED");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAdmissions();
  }, [statusFilter]);

  const loadAdmissions = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { search };
      if (statusFilter) params.status = statusFilter;
      const data = await getAdmissions(params);
      setAdmissions(data.results ?? data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAdmissions();
  };

  return (
    <div>
      <h1>Admissions</h1>

      <form onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Search by patient name / hospital number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="ADMITTED">Admitted</option>
          <option value="DISCHARGED">Discharged</option>
          <option value="TRANSFERRED_OUT">Transferred Out</option>
          <option value="DECEASED">Deceased</option>
          <option value="ABSCONDED">Absconded</option>
        </select>
        <button type="submit">Search</button>
      </form>

      <Link to="/inpatient/admit">
        <button type="button">+ Admit Patient</button>
      </Link>

      {error && <p>Error: {error}</p>}
      {loading ? (
        <p>Loading admissions...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Admission #</th>
              <th>Patient</th>
              <th>Hospital #</th>
              <th>Ward / Bed</th>
              <th>Doctor</th>
              <th>Type</th>
              <th>Status</th>
              <th>Admitted</th>
              <th>LOS (days)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {admissions.map((a) => (
              <tr key={a.id}>
                <td>{a.admission_number}</td>
                <td>{a.patient_name}</td>
                <td>{a.hospital_number}</td>
                <td>{a.ward_name} / {a.bed_number}</td>
                <td>{a.attending_doctor_name}</td>
                <td>{a.admission_type}</td>
                <td>{a.status}</td>
                <td>{new Date(a.admission_date).toLocaleString()}</td>
                <td>{a.length_of_stay_days}</td>
                <td>
                  <Link to={`/inpatient/admissions/${a.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && admissions.length === 0 && <p>No admissions found.</p>}
    </div>
  );
}