import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginLayout from "../components/LoginLayout";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function handleLogin(username, password) {
    setError("");
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch {
      setError("Invalid credentials or server is unavailable.");
    }
  }

  return (
    <LoginLayout
      logoSrc="/ll.png"
      backgroundSrc="/picture.jpg"
      loading={loading}
      error={error}
      onLogin={(username, password) => {
        handleLogin(username, password);
      }}
    />
  );
}
