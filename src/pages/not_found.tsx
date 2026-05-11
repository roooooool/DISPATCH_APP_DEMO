import { useNavigate } from "react-router-dom";
import "../theme.css";

export default function NotFound() {
  const navigate = useNavigate();

  const handleGoBack = () => {
  
    const savedUser = localStorage.getItem("gsdc_user");
    
    if (savedUser) {
      const userInfo = JSON.parse(savedUser);
      userInfo.CurrentNav = "/dash";
      localStorage.setItem("gsdc_user", JSON.stringify(userInfo));

      navigate("/dash", { state: { user: userInfo } });
    } else {
      navigate("/dash");
    }
  };

  

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.code}>404</h1>

        <h2 style={styles.title}>Page Not Found</h2>

        <p style={styles.message}>
          The page you are looking for does not exist or has been moved.
        </p>

        <button style={styles.button} onClick={handleGoBack}>
          Go Back Home
        </button>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    height: "100vh",
    width: "100%",
    backgroundColor: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Segoe UI, sans-serif",
  },

  card: {
    textAlign: "center",
    padding: "40px",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
    maxWidth: "400px",
    width: "100%",
  },

  code: {
    fontSize: "80px",
    margin: "0",
    color: "rgba(9,33,98,1)", // blue
  },

  title: {
    margin: "10px 0",
    color: "rgba(9,33,98,1)",
  },

  message: {
    color: "#555",
    marginBottom: "30px",
  },

  button: {
    backgroundColor: "red",
    color: "#fff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
};