"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department?: string;
  company_name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; full_name: string; department?: string; company_name?: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  async function fetchProfile() {
    try {
      const response = await apiFetch("/api/v1/auth/profile");
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setUser(null);
    }
  }

  useEffect(() => {
    const accessToken = localStorage.getItem("access_token");
    if (accessToken) {
      Promise.resolve().then(() => {
        fetchProfile().finally(() => setIsLoading(false));
      });
    } else {
      Promise.resolve().then(() => {
        setIsLoading(false);
      });
    }
  }, []);


  async function login(email: string, password: string) {
    setIsLoading(true);
    try {
      const response = await apiFetch("/api/v1/auth/login", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail ?? "Authentication failed");
      }

      const tokens = await response.json();
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      
      await fetchProfile();
    } finally {
      setIsLoading(false);
    }
  }

  async function register(payload: { email: string; password: string; full_name: string; department?: string; company_name?: string }) {
    setIsLoading(true);
    try {
      const response = await apiFetch("/api/v1/auth/register", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail ?? "Registration failed");
      }

      const tokens = await response.json();
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      
      await fetchProfile();
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      apiFetch("/api/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch((e) => console.error("Error calling logout endpoint:", e));
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    router.replace("/login");
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
