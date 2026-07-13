import { useEffect, useState } from "react";
import { getWards, getBeds, createBed, updateBed } from "../../services/api";

export default function BedManagement() {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [selectedWard, setSelectedWard] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newBedNumber, setNewBedNumber] = useState("");
  const [newBedRate, setNewBedRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWards();
  }, []);

  useEffect(() => {
    loadBeds();
  }, [selectedWard]);

  const loadWards = async () => {
    try {
      const data = await getWards();
      setWards(data.results ?? data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadBeds = async () => {
    setLoading(true);
    setError("");
    try {
      const params = selectedWard ? { ward: selectedWard } : {};
      const data = await getBeds(params);
      setBeds(data.results ?? data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBed = async (e) => {
    e.preventDefault();
    if (!selectedWard || !newBedNumber) return;
    setSubmitting(true);
    setError("");
    try {
      await createBed({
        ward: selectedWard,
        bed_number: newBedNumber,
        daily_rate_override: newBedRate || null,
      });
      setNewBedNumber("");
      setNewBedRate("");
      loadBeds();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (bedId, status) => {
    try {
      await updateBed(bedId, { status });
      loadBeds();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1>Bed Management</h1>

      {error && <p>Error: {error}</p>}

      <div>
        <label>Filter by ward: </label>
        <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}>
          <option value="">All Wards</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      <h2>Add Bed</h2>
      <form onSubmit={handleAddBed}>
        <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)} required>
          <option value="">Select ward</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Bed number"
          value={newBedNumber}
          onChange={(e) => setNewBedNumber(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Daily rate override (optional)"
          value={newBedRate}
          onChange={(e) => setNewBedRate(e.target.value)}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Adding..." : "Add Bed"}
        </button>
      </form>

      <h2>Beds</h2>
      {loading ? (
        <p>Loading beds...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ward</th>
              <th>Bed #</th>
              <th>Status</th>
              <th>Daily Rate</th>
              <th>Current Patient</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {beds.map((b) => (
              <tr key={b.id}>
                <td>{b.ward_name}</td>
                <td>{b.bed_number}</td>
                <td>{b.status}</td>
                <td>{b.daily_rate}</td>
                <td>{b.current_patient ? b.current_patient.patient_name : "-"}</td>
                <td>
                  <select value={b.status} onChange={(e) => handleStatusChange(b.id, e.target.value)}>
                    <option value="AVAILABLE">Available</option>
                    <option value="OCCUPIED">Occupied</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="RESERVED">Reserved</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && beds.length === 0 && <p>No beds found.</p>}
    </div>
  );
}