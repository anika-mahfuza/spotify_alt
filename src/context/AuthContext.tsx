import { createContext, ReactNode } from 'react';

export interface AuthContextType {
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AuthContext.Provider value={{ isAuthenticated: true }}>
      {children}
    </AuthContext.Provider>
  );
};
