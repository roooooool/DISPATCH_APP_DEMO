import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
//@ts-ignore
import { GSDC_AccountsService } from "../generated/services/GSDC_AccountsService";
import { getApiUrl } from "../api/config";

import { type UserInfo, mandatoryLogout } from '../truth.config';

import "./css/Login.css";
import "../theme.css";

import ImageCarousel from "../components/imgHighlights";

// --- ASSET IMPORTS ---
import gsdcLogo from "../../public/gsdc_logo.png";
import truckBg from "../../public/images/trucks.jpg"; // Import the background image


import { useUser } from '../utils/useUser';
import { AuthService } from "../api/AuthService.ts";


export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const { user, updateUser } = useUser();
  useEffect(() => {
    // Only redirect if a user actually exists in the hook's state
    if (user) {
      const destination = user.CurrentNav || "/landing";
      navigate(destination, { state: { user: user } });
    }
  }, [user, navigate]);

  /*useEffect(() => {
    const savedUser = localStorage.getItem("gsdc_user");
    if (savedUser) {
      const userInfo = JSON.parse(savedUser);
      navigate(userInfo.CurrentNav, { state: { user: userInfo } });
    }
  }, [navigate]);*/

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const APP_KEY = import.meta.env.VITE_APP_KEY;
      const APP_SECRET = import.meta.env.VITE_APP_SECRET;

      // 1. Try existing access token / refresh token first
      let accessToken = await AuthService.ensureValidToken();

      // 2. No existing session -> authenticate the application
      if (!accessToken) {
        const session = await AuthService.login(APP_KEY, APP_SECRET);
        accessToken = session.access_token;
      }


      if (!accessToken) {
        throw new Error("Unable to authenticate with the server");
      }

      const selectFields = [
        "ID", "UserName", "FirstName", "MiddleName", "LastName",
        "Role", "Position", "BusinessUnit", "BusinessUnit2",
        "FleetGroup", "Location", "microsoftEmail", "PassWord"
      ].join(",");

      const filterQuery = `UserName eq '${username}'`;

      const endpoint = `/api/SHAREPOINT_DATA/table/gsdc_accounts?$filter=${encodeURIComponent(filterQuery)}&$select=${encodeURIComponent(selectFields)}&$top=1`;
      const url = getApiUrl(endpoint);

      console.log("f url: ", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const result = await response.json();
      console.log("fetched account: ", result);

      const account = result.value?.[0];

      if (!account) {
        setError("User not found");
      } else if (account.PassWord !== password) {
        setError("Incorrect password");
      } else {
        const userInfo: UserInfo = {
          FirstName: account.FirstName || "",
          MiddleName: account.MiddleName || "",
          LastName: account.LastName || "",
          FullName: `${account.LastName}, ${account.FirstName}${account.MiddleName ? ` (${account.MiddleName})` : ""}`,
          BusinessUnit: account.BusinessUnit || "",
          Position: account.Position || "",
          id: String(account.ID) || "",
          CurrentNav: "/dash"
        };

        if (userInfo?.id) {
          localStorage.setItem(`lastLogout_${userInfo.id}`, mandatoryLogout);
        }

        updateUser(userInfo);
        setIsLeaving(true);

        setTimeout(() => {
          navigate("/dash", { state: { user: userInfo } });
        }, 500);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Error logging in. Please try again. ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`login-container ${isLeaving ? "fade-out" : ""}`}>
      {/* Left Side - Login */}
      <div className="login-left">
        <img
          src={gsdcLogo} // Corrected
          alt="GSDC Logo"
          className="logo"
        />
        <h1 className="login-title">TRIP DISPATCH APP</h1>
        <form className="login-form" onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="gradient-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="gradient-input"
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>

      {/* Right Side - Company Info */}
      <div
        className="login-right"
        style={{ backgroundImage: `url(${truckBg})` }} // Corrected: Uses the imported variable
      >
        <ImageCarousel />

        <div className="gradient-overlay"></div>

        <div className="company-info-panel">
          <div className="company-info-inner">
            <div className="company-badge">
              <img src={gsdcLogo} alt="GSDC" /> {/* Corrected */}
              <span>GSDC Dispatch</span>
            </div>

            <h2>Great Sierra Development Corporation</h2>
            <p className="company-tagline">
              Smart, secure, and scalable transportation operations in one centralized app.
            </p>

            <ul className="feature-list">
              <li>Optimized dispatch workflows</li>
              <li>Real-time trip tracking</li>
              <li>Role-based access control</li>
              <li>Built for logistics professionals</li>
            </ul>

            <div className="company-info-footer">
              <span>Version 1.0</span>
              <span>© GSDC IT Projects & Development</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}