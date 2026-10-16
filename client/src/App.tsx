import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Auth } from "./auth-context";
import { api, ApiError } from "./api";
import type { User } from "../../shared/contracts";
import { message } from "./utils";
import { Protected } from "./components/Protected";
import { Login } from "./pages/Login";
import { RoundList } from "./pages/RoundList";
import { RoundRoute } from "./pages/RoundPage";
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<User>("/auth/me")
      .then((value) => {
        if (alive) {
          setUser(value);
          setError("");
        }
      })
      .catch((error) => {
        if (alive) {
          if (error instanceof ApiError && error.status === 401) {
            setError("");
            setUser(null);
          } else setError(message(error));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  if (loading) return <main className="boot">Подключаемся к станции…</main>;
  if (error)
    return (
      <main className="boot">
        <p role="alert">{error}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>
          Повторить подключение
        </button>
      </main>
    );
  return (
    <Auth.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/"
            element={
              <Protected>
                <RoundList />
              </Protected>
            }
          />
          <Route
            path="/rounds/:id"
            element={
              <Protected>
                <RoundRoute />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Auth.Provider>
  );
}
