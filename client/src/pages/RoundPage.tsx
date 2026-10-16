import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router";
import { api } from "../api";
import type { RoundDetail, TapResult } from "../../../shared/contracts";
import { usePolling, useNow } from "../hooks";
import { labels, statusAt, countdown, message } from "../utils";
import { Goose } from "../components/Goose";
import { Header } from "../components/Header";
export function RoundRoute() {
  const { id } = useParams();
  return <RoundPage key={id} id={id!} />;
}
function mergeDetail(
  previous: RoundDetail | null,
  next: RoundDetail,
): RoundDetail {
  return previous
    ? {
        ...next,
        totalScore: Math.max(previous.totalScore, next.totalScore),
        mine: next.mine.taps >= previous.mine.taps ? next.mine : previous.mine,
      }
    : next;
}
function RoundPage({ id }: { id: string }) {
  const {
    data: round,
    setData,
    error,
  } = usePolling<RoundDetail>(`/rounds/${id}`, mergeDetail);
  const [tapError, setTapError] = useState("");
  const [pulse, setPulse] = useState(0);
  const now = useNow();
  const [offset, setOffset] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (round) setOffset(Date.parse(round.serverNow) - Date.now());
  }, [round?.serverNow]);
  const serverNow = now + offset;
  const status = round ? statusAt(round, serverNow) : "scheduled";
  async function tap() {
    if (status !== "active") return;
    setPulse((value) => value + 1);
    try {
      const result = await api<TapResult>(`/rounds/${id}/taps`, {});
      if (!alive.current) return;
      setTapError("");
      setData((previous) =>
        previous
          ? {
              ...previous,
              mine:
                result.taps >= previous.mine.taps
                  ? { taps: result.taps, score: result.score }
                  : previous.mine,
              totalScore: Math.max(previous.totalScore, result.totalScore),
            }
          : previous,
      );
    } catch (error) {
      if (alive.current) setTapError(message(error));
    }
  }
  return (
    <div className="shell">
      <Header />
      <main className="round-main">
        <Link to="/" className="back">
          ← Все раунды
        </Link>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!round && !error && <p className="empty">Подключаемся к раунду…</p>}
        {round && (
          <>
            <div className="arena-heading">
              <span className="section-index">03 / ОПЕРАЦИЯ G-42</span>
              <span className={`badge ${status}`}>● {labels[status]}</span>
            </div>
            <h1 className="arena-title">
              {status === "scheduled"
                ? "Приготовьтесь."
                : status === "active"
                  ? "Время действовать."
                  : "Гусь может выдохнуть."}
            </h1>
            <p className="arena-sub muted">
              {status === "scheduled"
                ? "Раунд скоро начнётся. Держите палец наготове."
                : status === "active"
                  ? "Тапайте по гусю. Каждый одиннадцатый тап — бонусный."
                  : "Операция завершена. Результаты зафиксированы."}
            </p>
            <div className="arena">
              <div className="arena-timer">
                <span>
                  {status === "scheduled"
                    ? "ДО НАЧАЛА"
                    : status === "active"
                      ? "ДО КОНЦА РАУНДА"
                      : "РАУНД ЗАВЕРШЁН"}
                </span>
                <strong>
                  {status === "finished"
                    ? "00:00"
                    : countdown(
                        status === "scheduled" ? round.startsAt : round.endsAt,
                        serverNow,
                      )}
                </strong>
              </div>
              <div className="goose-zone">
                <span className="orbit orbit-one" />
                <span className="orbit orbit-two" />
                <button
                  className={`goose-button ${status === "active" ? "is-active" : ""}`}
                  disabled={status !== "active"}
                  aria-label="Тапнуть по гусю"
                  onClick={() => void tap()}
                >
                  <Goose key={pulse} className={pulse ? "tap-animation" : ""} />
                </button>
                <span className="goose-caption">
                  {status === "active"
                    ? "↑ ТАПАЙТЕ ЗДЕСЬ"
                    : "ОБЪЕКТ № 042 / G-42"}
                </span>
              </div>
              <div className="scoreboard">
                <div>
                  <span>МОИ ОЧКИ</span>
                  <strong data-testid="my-score">
                    {round.mine.score.toLocaleString("ru-RU")}
                  </strong>
                </div>
                <div>
                  <span>ВСЕГО В РАУНДЕ</span>
                  <strong data-testid="total-score">
                    {round.totalScore.toLocaleString("ru-RU")}
                  </strong>
                </div>
              </div>
              {tapError && (
                <p className="error" role="alert">
                  {tapError} При обрыве связи проверьте счёт перед повтором.
                </p>
              )}
              {status === "finished" && (
                <div className="winner">
                  <span>
                    ✳ {round.winner ? "ПОБЕДИТЕЛЬ ОПЕРАЦИИ" : "ИТОГИ ОПЕРАЦИИ"}
                  </span>
                  <h2>
                    {round.status !== "finished"
                      ? "Фиксируем результаты…"
                      : (round.winner?.username ?? "Нет победителя")}
                  </h2>
                  <p>
                    {round.status !== "finished"
                      ? "Ожидаем подтверждения станции."
                      : round.winner
                        ? `${round.winner.score.toLocaleString("ru-RU")} очков · Отличная работа, выживший.`
                        : "В этом раунде никто не набрал очков."}
                  </p>
                </div>
              )}
            </div>
            <div className="round-footer">
              <span className="round-id">ID: {round.id}</span>
              <span>1 ТАП = 1 ОЧКО / 11-Й = 10 ОЧКОВ</span>
            </div>
          </>
        )}
      </main>
      <footer>
        THE LAST OF GUSS <span>НЕ ПОДДАВАЙТЕСЬ ПАНИКЕ</span>
      </footer>
    </div>
  );
}
