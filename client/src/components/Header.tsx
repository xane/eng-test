import { useContext, useState } from "react";
import { Link } from "react-router";
import { Auth } from "../auth-context";
import { api } from "../api";
import { message } from "../utils";
export function Header() {
  const { user, setUser } = useContext(Auth);
  const [error, setError] = useState("");
  return (
    <>
      <header>
        <Link className="brand" to="/">
          <span className="brand-mark">G</span> THE LAST OF GUSS
          <span className="brand-sub">FIELD STATION / 042</span>
        </Link>
        <div className="identity">
          <span className="user-dot" />
          {user?.username}
          <button
            className="text-button"
            onClick={() => {
              void api("/auth/logout", {})
                .then(() => setUser(null))
                .catch((error) => setError(message(error)));
            }}
          >
            Выйти
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
