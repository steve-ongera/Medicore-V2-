import { useEffect, useState } from "react";
import { getWardOccupancy } from "../../services/api";

export default function WardBoard() {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadOccupancy();
  }, []);

  const loadOccupancy = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getWardOccupancy();
      setWards(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading ward board...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Ward Board</h1>

      <table>
        <thead>
          <tr>
            <th>Ward</th>
            <th>Type</th>
            <th>Capacity</th>
            <th>Occupied</th>
            <th>Available</th>
          </tr>
        </thead>
        <tbody>
          {wards.map((w) => (
            <tr key={w.id}>
              <td>{w.name}</td>
              <td>{w.ward_type}</td>
              <td>{w.capacity}</td>
              <td>{w.occupied}</td>
              <td>{w.available}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {wards.length === 0 && <p>No wards configured yet.</p>}
    </div>
  );
}