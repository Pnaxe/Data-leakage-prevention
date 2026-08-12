import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"
});

let refreshPromise = null;

function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      clearSession();
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${api.defaults.baseURL}/auth/refresh/`, { refresh: refreshToken })
          .then((response) => {
            const access = response.data.access;
            localStorage.setItem("accessToken", access);
            if (response.data.refresh) {
              localStorage.setItem("refreshToken", response.data.refresh);
            }
            return access;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const accessToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      clearSession();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
