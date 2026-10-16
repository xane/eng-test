import { createContext } from "react";
import type { User } from "../../shared/contracts";
export const Auth = createContext<{
  user: User | null;
  setUser: (user: User | null) => void;
}>({ user: null, setUser: () => {} });
