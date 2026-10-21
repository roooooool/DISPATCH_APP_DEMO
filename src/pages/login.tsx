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
import { msalInstance, msalInitPromise } from "../api/msalConfig";


export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
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

  useEffect(() => {
    let mounted = true;

    async function processMicrosoftRedirect() {
      try {
        await msalInitPromise;

        const loginRequested =
          sessionStorage.getItem("msal_login_requested") === "true";

        if (!loginRequested) {
          return;
        }

        const result = await msalInstance.handleRedirectPromise();

        if (!mounted) return;

        // Consume the flag so a normal visit to /login
        // won't authenticate again.
        sessionStorage.removeItem("msal_login_requested");

        if (!result) {
          return;
        }

        console.log("Microsoft redirect result:", result);

        if (result.account) {
          msalInstance.setActiveAccount(result.account);
        }

        if (!result.idToken) {
          throw new Error("Microsoft ID token was not returned.");
        }

        await completeMicrosoftLogin(result.idToken);

      } catch (err: any) {
        console.error("MICROSOFT REDIRECT ERROR:", err);

        sessionStorage.removeItem("msal_login_requested");

        if (!mounted) return;

        setError(
          err.message || "Microsoft authentication failed."
        );

        setLoading(false);
      }
    }

    processMicrosoftRedirect();

    return () => {
      mounted = false;
    };
  }, []);



  /*useEffect(() => {
    const savedUser = localStorage.getItem("gsdc_user");
    if (savedUser) {
      const userInfo = JSON.parse(savedUser);
      navigate(userInfo.CurrentNav, { state: { user: userInfo } });
    }
  }, [navigate]);*/

  // Standard RFC 5322 compliant regex pattern
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  function validateEmail(val: string): boolean {
    if (!val.trim()) {
      setEmailError("Email address is required.");
      return false;
    }
    if (!EMAIL_REGEX.test(val.trim())) {
      setEmailError("Please enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setEmail(value);
    if (emailError) {
      validateEmail(value); // Clear/update error as user types once triggered
    }
  }

  function validateEmailOnBlur() {
    if (email) {
      validateEmail(email);
    }
  }

  //@ts-ignore
  // src/pages/Login.tsx


  async function handleMicrosoftLogin() {
    if (loading) return;

    try {
      setError("");
      setLoading(true);

      await msalInitPromise;

      // Remember that WE initiated a Microsoft login.
      sessionStorage.setItem("msal_login_requested", "true");

      await msalInstance.loginRedirect({
        scopes: ["openid", "profile", "email"],
        prompt: "select_account",
      });

    } catch (err: any) {
      console.error("MICROSOFT LOGIN ERROR:", err);

      sessionStorage.removeItem("msal_login_requested");

      const errorCode = err.errorCode || err.code;

      if (
        errorCode === "user_cancelled" ||
        err.message?.includes("user_cancelled")
      ) {
        clearMsalInteractionStorage();
        setError("Login was cancelled.");
      } else if (errorCode === "interaction_in_progress") {
        clearMsalInteractionStorage();
        setError("A Microsoft login is already in progress.");
      } else {
        setError(err.message || "Microsoft login failed");
      }

      setLoading(false);
    }
  }

  async function completeMicrosoftLogin(microsoftToken: string) {
    try {
      setError("");
      setLoading(true);

      const APP_KEY = import.meta.env.VITE_APP_KEY;
      const APP_SECRET = import.meta.env.VITE_APP_SECRET;

      // Authenticate the application with your backend
      const session = await AuthService.login(APP_KEY, APP_SECRET, email);
      const accessToken = session.access_token;

      if (!accessToken) {
        throw new Error("Unable to authenticate with the server");
      }

      // Authenticate the Microsoft user with your new endpoint
      const account = await loginMicrosoftApi(
        accessToken,
        microsoftToken
      );

      console.log("Microsoft authenticated user:", account);

      if (!account) {
        throw new Error("User account was not found.");
      }

      const fn = account.FirstName || account.name || "";
      const mn = account.MiddleName || account.middlename || "";
      const ln = account.LastName || account.surname || "";

      const userInfo: UserInfo = {
        FirstName: fn,
        MiddleName: mn,
        LastName: ln,
        FullName: `${ln}, ${fn}${mn ? ` (${mn})` : ""}`,
        BusinessUnit: account.BusinessUnit || "",
        Position: account.Position || account.roles?.[0] || "",
        id: String(account.ID || ""),
        CurrentNav: "/dash",
        email: email,
      };

      if (userInfo.id) {
        localStorage.setItem(
          `lastLogout_${userInfo.id}`,
          mandatoryLogout
        );
      }

      console.log("Final userInfo:", userInfo);

      updateUser(userInfo);
      setIsLeaving(true);

      setTimeout(() => {
        navigate(userInfo.CurrentNav || "/dash", {
          state: { user: userInfo }
        });
      }, 500);

    } catch (err: any) {
      console.error("MICROSOFT BACKEND LOGIN ERROR:", err);

      setError(
        `Microsoft login failed. ${err.message || err}`
      );

    } finally {
      setLoading(false);
    }
  }





  // Helper to safely remove temporary MSAL interaction lock keys
  function clearMsalInteractionStorage() {
    const clearStorageKeys = (storage: Storage) => {
      Object.keys(storage).forEach((key) => {
        if (
          key.startsWith("msal.") &&
          (key.includes("interaction") || key.includes("request"))
        ) {
          storage.removeItem(key);
        }
      });
    };

    clearStorageKeys(sessionStorage);
    clearStorageKeys(localStorage);
  }

  async function loginApi(accessToken: string) {
    // 2. Call user login endpoint
    const response = await fetch(
      getApiUrl("/api/auth/login"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        credentials: "include",
        body: JSON.stringify({
          email: email,
          password: password,
        })
      }
    );

    const result = await response.json();

    console.log("LOGIN STATUS:", response.status);
    console.log("LOGIN RESPONSE:", result);

    if (!response.ok) {
      throw new Error(
        result.error || `Login failed with status ${response.status}`
      );
    }

    return result.user
  }


  //@ts-ignore
  async function loginMicrosoftApi(
    accessToken: string,
    microsoftToken: string
  ) {
    const response = await fetch(
      getApiUrl("/api/auth/microsoft"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        credentials: "include",
        body: JSON.stringify({
          id_token: microsoftToken
        })
      }
    );

    const result = await response.json();

    console.log("MICROSOFT LOGIN STATUS:", response.status);
    console.log("MICROSOFT LOGIN RESPONSE:", result);

    if (!response.ok) {
      throw new Error(
        result.error || `Microsoft login failed with status ${response.status}`
      );
    }

    return result.user;
  }




  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const username = email;

    const isEmailValid = validateEmail(email);
    if (!isEmailValid) {
      return;
    }

    if (!password) {
      setError("Please enter your password.");
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
      if (!accessToken || true) {
        const session = await AuthService.login(APP_KEY, APP_SECRET, username);
        accessToken = session.access_token;
      }


      if (!accessToken) {
        throw new Error("Unable to authenticate with the server");
      }

      console.log('username: ', username, ' password: ', password);

      const user = await loginApi(accessToken);

      console.log("fetched account: ", user);

      const account = user;

      const fn = account.FirstName || account.name || "";
      const mn = account.MiddleName || account.middlename || "";
      const ln = account.LastName || account.surname || "";

      if (!account) {
        setError("User not found");
        // } else if (account.PassWord !== password) {
        //   setError("Incorrect password");
      } else {
        const userInfo: UserInfo = {
          FirstName: fn,
          MiddleName: mn,
          LastName: ln,
          FullName: `${ln}, ${fn}${mn ? ` (${mn})` : ""}`,
          BusinessUnit: account.BusinessUnit || "",
          Position: account.Position || account.roles[0] || "",
          id: String(account.ID) || "",
          CurrentNav: "/dash",
          email: username,
        };

        if (userInfo?.id) {
          localStorage.setItem(`lastLogout_${userInfo.id}`, mandatoryLogout);
        }

        if (userInfo?.email) {
          localStorage.setItem("user_email", userInfo.email);
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
        <img src={gsdcLogo} alt="GSDC Logo" className="logo" />
        <h1 className="login-title">TRIP DISPATCH APP</h1>

        <form className="login-form" onSubmit={handleLogin}>
          {/* Gradient Wrapper Pattern for Inputs */}
          <div className={`gradient-input-wrapper ${emailError ? "input-error" : ""}`}>
            <input
              type="email"
              placeholder="Email Address (e.g. user@company.com)"
              value={email}
              onChange={handleEmailChange}
              onBlur={validateEmailOnBlur}
              className="gradient-input"
              autoComplete="email"
              required
            />
          </div>
          {emailError && <p className="field-error-text">{emailError}</p>}

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
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
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

          {/* Visual Divider */}
          <div className="login-divider">
            <span>OR</span>
          </div>

          {/* Microsoft SSO Button with Gradient Outline */}
          <button
            type="button"
            className="btn-microsoft"
            onClick={() => handleMicrosoftLogin()}
            disabled={loading}
          >
            <div className="btn-microsoft-inner">
              <svg
                className="ms-logo"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 23 23"
                width="18"
                height="18"
              >
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              <span>Sign in with Microsoft</span>
            </div>
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