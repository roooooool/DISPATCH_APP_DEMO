import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
//@ts-ignore
import { type UserInfo, mandatoryLogout } from "../truth.config";
import "./css/Login.css";
import "../theme.css";
import ImageCarousel from "../components/imgHighlights";
import gsdcLogo from "../../public/gsdc_logo.png";
import truckBg from "../../public/images/trucks.jpg";
import { useUser } from "../utils/useUser";

export default function Login() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("test");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const { user, updateUser } = useUser();
  useEffect(() => {
    // Only redirect if a user actually exists in the hook's state
    if (user) {
      const destination = user.CurrentNav || "/landing";
      navigate(destination, { state: { user: user } });
    }
  }, [user, navigate]);

  const [username, setUsername] = useState("test");

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUsername(e.target.value);
  }

  async function loginApi(username: string, password: string) {
    if (username !== "test" || password !== "test") {
      return null;
    }

    return {
      BusinessUnit: "SBUO-1A",
      avatar_url: null,
      branch: "BRANCH_SAMPLE",
      branch_id: "7582535B-F31A-4A28-952D-7E20DABA3C55",
      cost_center: "BS-IT/PROJECTS",
      department: "TEST DEPARTMENT",
      department_id: "91A392FA-846D-451C-927F-A3933E742B0C",
      display_name: "TEST USER",
      division: "DIVISION ABC",
      email: "test@sample.com.ph",
      employee_id: "GS-0565",
      name: "Juan",
      position: "TEST POSITION",
      rank: "ASSOCIATE",
      roles: ["Developer"],
      surname: "Dela Cruz",
      team: null,
      unit: "TEST UNIT",
      user_id: "BB2D2A51-1D2F-4C3C-A534-EA95ADF62E1A",
      username: "test",
    };
  }


  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);

    try {
      const account = await loginApi(username.trim(), password);

      if (!account) {
        setError("Invalid username or password.");
        return;
      }

      const fn = account.name || "";
      const mn = "";
      const ln = account.surname || "";
      const userInfo: UserInfo = {
        FirstName: fn,
        MiddleName: mn,
        LastName: ln,
        FullName: `${ln}, ${fn}`,
        BusinessUnit: account.BusinessUnit || "",
        Position: account.roles?.[0] || "",
        id: String(account.user_id || ""),
        CurrentNav: "/dash",
        email: account.email || username.trim(),
      };

      // if (userInfo.id) {
      //   localStorage.setItem(`lastLogout_${userInfo.id}`, mandatoryLogout);
      // }
      if (userInfo?.email) {
        localStorage.setItem("user_email", userInfo.email);
      }
      localStorage.setItem("user_email", userInfo.email || '');




      updateUser(userInfo);
      setIsLeaving(true);
      setTimeout(() => navigate("/dash", { state: { user: userInfo } }), 500);
    } catch (err: any) {
      console.error(err);
      setError(`Error logging in. ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`login-container ${isLeaving ? "fade-out" : ""}`}>
      {/* Left Side - Login */}
      <div className="login-left">
        <img src={gsdcLogo} alt="GSDC Logo" className="logo" />
        <h1 className="login-title">LOG IN</h1>

        <form className="login-form" onSubmit={handleLogin}>
          {/* Gradient Wrapper Pattern for Inputs */}
          <div className="gradient-input-wrapper">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={handleUsernameChange}
              className="gradient-input"
              autoComplete="username"
              required
            />
          </div>
          <div className={`gradient-input-wrapper ${password ? "has-value" : ""}`}>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="gradient-input password-input"
                autoComplete="current-password"
                required
                disabled
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled
              >
                {showPassword ? (
                  /* Eye Off Icon */
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* Eye Icon */
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          {/* Primary Action Button */}
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
              <span>DEMO Dispatch</span>
            </div>

            <h2>Sample Trucking Corporation</h2>
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
              <span>© Ewul IT Projects & Development</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}