import { useState } from "react";
import "../theme.css";
import { GSDC_AccountsService } from "../generated/services/GSDC_AccountsService";
import type { GSDC_AccountsRead } from "../generated/models/GSDC_AccountsModel";

export default function LoginDebug() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultTable, setResultTable] = useState<GSDC_AccountsRead[] | null>(null);

  const handleLogin: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    if (!username) {
      setError("Please enter username");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const normalizedUsername = username.trim().toLowerCase();

      // TEMP DEBUG: remove top 1 to see all matching records
      const result = await GSDC_AccountsService.getAll({
        filter: `UserName eq '${normalizedUsername.trim()}'`,
        select: ['ID', 'UserName', 'fullName', 'LastName', 'Role', 'Position',
                 'BusinessUnit', 'BusinessUnit2', 'FleetGroup', 'Location', 'microsoftEmail', 'PassWord'],
        //top: 1,
      });

      console.log("Full fetched result:", result);
      setResultTable(result.data); // Display all returned rows

      // Temporarily do NOT navigate anywhere
    } catch (err: any) {
      console.error(err);
      setError("Error fetching user data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center full-height">
      <form className="card" style={{ width: "500px" }} onSubmit={handleLogin}>
        <h1 className="text-center" style={{ color: "rgba(9,33,98,1)" }}>Login Debug</h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input mt-2"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mt-1"
        />

        {error && (
          <p style={{ color: "red", textAlign: "center", marginTop: "10px" }}>{error}</p>
        )}

        <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
          {loading ? "Fetching..." : "Fetch User Data"}
        </button>
      </form>

      {/* Display fetched table */}
      {resultTable && (
        <div style={{ marginTop: "30px" }}>
          <h3>Fetched Records</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {Object.keys(resultTable[0]).map((key) => (
                  <th key={key} style={{ border: "1px solid #ccc", padding: "5px" }}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultTable.map((row, idx) => (
                <tr key={idx}>
                  {Object.keys(row).map((key) => (
                    <td key={key} style={{ border: "1px solid #ccc", padding: "5px" }}>
                      {JSON.stringify((row as any)[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}