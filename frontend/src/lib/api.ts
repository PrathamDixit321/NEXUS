const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch(path: string, options: FetchOptions = {}): Promise<Response> {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  
  const headers = new Headers(options.headers);
  
  if (!options.skipAuth) {
    const accessToken = localStorage.getItem("access_token");
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && !options.skipAuth) {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          localStorage.setItem("access_token", tokens.access_token);
          localStorage.setItem("refresh_token", tokens.refresh_token);

          headers.set("Authorization", `Bearer ${tokens.access_token}`);
          return fetch(url, {
            ...options,
            headers,
          });
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
      }
    }
    
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register") && window.location.pathname !== "/") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }

  return response;
}
