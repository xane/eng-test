import { useContext, useState, type FormEvent } from "react";
import { Auth } from "../auth-context";
import { api } from "../api";
import type { User } from "../../../shared/contracts";
import { message } from "../utils";
import { Goose } from "../components/Goose";
export function Login() {
  const { setUser } = useContext(Auth);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      setUser(
        await api<User>("/auth/login", {
          username: form.get("username"),
          password: form.get("password"),
        }),
      );
    } catch (error) {
      setError(message(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-art">
        <div className="eyebrow">
          ПОЛЕВАЯ СТАНЦИЯ 042 <span>● НА СВЯЗИ</span>
        </div>
        <div>
          <p className="kicker">ПРОТОКОЛ ВЫЖИВАНИЯ</p>
          <h1>
            The Last
            <br />
            of <em>Guss.</em>
          </h1>
          <p className="intro">
            Мутация G-42 обнаружена.
            <br />
            Один гусь. Много тапов. Один победитель.
          </p>
        </div>
        <div className="specimen">
          <span className="specimen-label">
            ОБЪЕКТ № 042
            <br />
            ANSER / МУТАЦИЯ G-42
          </span>
          <Goose />
          <span className="specimen-stamp">
            ОСТОРОЖНО
            <br />
            ГУСЬ
          </span>
        </div>
        <div className="art-footer">
          НЕ ПОДДАВАЙТЕСЬ ПАНИКЕ. ПРОСТО ТАПАЙТЕ.<span>↗</span>
        </div>
      </div>
      <main className="login-form">
        <div className="form-inner">
          <span className="section-index">01 / ИДЕНТИФИКАЦИЯ</span>
          <h2>Вы в деле?</h2>
          <p className="muted">
            Войдите на станцию. Если вы здесь впервые,
            <br className="desktop" /> мы автоматически создадим вам аккаунт.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="username">Имя выжившего</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="Как вас зовут?"
              required
              maxLength={40}
            />
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Ваш секретный код"
              required
              maxLength={128}
            />
            <button className="primary" disabled={pending}>
              {pending ? "Подключаемся…" : "Войти на станцию"} <span>↗</span>
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
          <div className="rules">
            <span>ПРАВИЛА ПРОСТЫ</span>
            <p>
              <b>1 тап = 1 очко.</b> Каждый 11-й — сразу 10.
              <br />
              Успейте набрать больше всех до конца раунда.
            </p>
          </div>
        </div>
        <div className="form-footer">
          G-42 RESEARCH DIVISION <span>2026 ©</span>
        </div>
      </main>
    </div>
  );
}
