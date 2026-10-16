import { useState, useEffect, useRef } from "react";
import { api } from "./api";
import { message } from "./utils";
export function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function usePolling<T>(
  path: string,
  merge?: (previous: T | null, next: T) => T,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const mergeRef = useRef(merge);
  mergeRef.current = merge;
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const next = await api<T>(path);
        if (!disposed) {
          setData((previous) =>
            mergeRef.current ? mergeRef.current(previous, next) : next,
          );
          setError("");
        }
      } catch (error) {
        if (!disposed) setError(message(error));
      } finally {
        if (!disposed) timer = setTimeout(refresh, 1000);
      }
    };
    void refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [path]);
  return { data, setData, error };
}
