// src/pages/auth/Login.jsx
import { useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/AuthContext";
import medicoreLogo from "../../assets/medicore_logo.png";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      toast.success("Welcome back!");
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="auth-card" style={{ maxWidth: 500, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-5)'
        }}>
          <img 
            src={medicoreLogo} 
            alt="Medicore HMIS" 
            style={{ 
              height: 120,
              width: 'auto',
              maxWidth: 240,
              display: 'block'
            }} 
          />
        </div>
        <h1 className="auth-card__title">Welcome back</h1>
        <p className="auth-card__subtitle">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="username">
            Username
          </label>
          <div className="input-icon-wrap">
            <i className="bi bi-person icon" aria-hidden="true" />
            <input
              id="username"
              type="text"
              className="input"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <div className="input-icon-wrap" style={{ position: "relative" }}>
            <i className="bi bi-lock icon" aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
              style={{ paddingRight: "40px" }}
            />
            <i
              className={`bi bi-eye${showPassword ? "-slash" : ""}`}
              onClick={togglePasswordVisibility}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
                color: "var(--text-tertiary)",
                zIndex: 10,
                fontSize: "1.2rem"
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
              role="button"
              tabIndex={0}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block btn-lg"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner spinner-sm" style={{ 
                display: 'inline-block', 
                width: '16px', 
                height: '16px',
                marginRight: 'var(--space-2)' 
              }}></span>
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className="auth-card__footer">
        <small>Secure · Hospital Management Information System</small>
      </div>
    </div>
  );
}