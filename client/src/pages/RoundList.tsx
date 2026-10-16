import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Auth } from "../auth-context";
import { api } from "../api";
import type { Round } from "../../../shared/contracts";
import { usePolling } from "../hooks";
import { labels, date, message } from "../utils";
import { Goose } from "../components/Goose";
import { Header } from "../components/Header";
export function RoundList() {
  const { user } = useContext(Auth);
  const navigate = useNavigate();
  const { data, error } = usePolling<Round[]>("/rounds");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  async function create() {
    setCreating(true);
    setCreateError("");
    try {
      const round = await api<Round>("/rounds", {});
      navigate(`/rounds/${round.id}`);
    } catch (error) {
      setCreateError(message(error));
    } finally {
      setCreating(false);
    }
  }
  return (
    <div className="shell">
      <Header />
      <main>
        <div className="page-heading">
          <div>
            <span className="section-index">02 / ОПЕРАЦИИ</span>
            <h1>На связи, {user?.username}.</h1>
            <p className="muted">Выберите раунд. Гусь сам себя не натапает.</p>
          </div>
          {user?.role === "admin" && (
            <button
              className="primary create"
              onClick={() => void create()}
              disabled={creating}
            >
              {creating ? "Создаём…" : "Создать раунд"} <span>＋</span>
            </button>
          )}
        </div>
        {(error || createError) && (
          <p role="alert" className="error">
            {error || createError}
          </p>
        )}
        <div className="list-meta">
          <span>ДОСТУПНЫЕ РАУНДЫ</span>
          <span>{data?.length ?? "—"} ОПЕРАЦИЙ · АВТООБНОВЛЕНИЕ</span>
        </div>
        {!data && !error && <p className="empty">Ищем активные сигналы…</p>}
        {data?.length === 0 && (
          <div className="empty">
            <Goose />
            <h2>Пока тихо.</h2>
            <p className="muted">
              {user?.role === "admin"
                ? "Создайте первый раунд и пригласите выживших."
                : "Администратор ещё не объявил новый раунд. Он появится здесь автоматически."}
            </p>
          </div>
        )}
        <div className="round-grid">
          {data?.map((round) => {
            const status = round.status;
            return (
              <Link
                to={`/rounds/${round.id}`}
                className="round-card"
                key={round.id}
              >
                <div className="card-top">
                  <span className={`badge ${status}`}>● {labels[status]}</span>
                  <span className="card-arrow">↗</span>
                </div>
                <h2>Операция G-42</h2>
                <p className="round-id">{round.id}</p>
                <dl>
                  <div>
                    <dt>Начало</dt>
                    <dd>{date(round.startsAt)}</dd>
                  </div>
                  <div>
                    <dt>Завершение</dt>
                    <dd>{date(round.endsAt)}</dd>
                  </div>
                </dl>
                <div className="card-bottom">
                  <span>Войти в раунд</span>
                  <span>→</span>
                </div>
              </Link>
            );
          })}
        </div>
        <aside className="field-note">
          <span>ПОЛЕВАЯ ЗАМЕТКА</span>
          <p>
            Каждый одиннадцатый тап приносит <b>10 очков</b>. Держите ритм.
          </p>
          <span>✳</span>
        </aside>
      </main>
      <footer>
        THE LAST OF GUSS <span>СЛЕДИТЕ ЗА ГУСЕМ / G-42</span>
      </footer>
    </div>
  );
}
