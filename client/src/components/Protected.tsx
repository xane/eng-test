import { useContext, type ReactNode } from "react";
import { Navigate } from "react-router";
import { Auth } from "../auth-context";
export function Protected({ children }: { children: ReactNode }) {
  return useContext(Auth).user ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace />
  );
}
