import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

export default function LoginLayout({ logoSrc, backgroundSrc, onLogin, loading = false, error = "" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    onLogin(username, password);
  }

  return (
    <div className="min-h-screen bg-[#2b1b62] font-[Nunito] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden lg:block">
          <img src={backgroundSrc} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#160f36]/85 via-[#2b1b62]/70 to-[#12091f]/80" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-white">
            <p className="text-sm font-extrabold uppercase tracking-[0.3em] text-violet-200">Insider Shield</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight">
              Insider-Driven Data Leakage Detection and Prevention System
            </h1>
            <p className="mt-4 max-w-xl text-base font-semibold text-slate-200">
              Secure document access, detect suspicious activity, and preserve investigation-ready audit trails.
            </p>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-200 px-5 py-10">
          <img src={backgroundSrc} alt="" className="absolute inset-0 h-full w-full object-cover lg:hidden" />
          <div className="absolute inset-0 bg-black/55 lg:hidden" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#160f36]/85 via-[#2b1b62]/70 to-[#12091f]/80 lg:hidden" />
          <div className="relative z-10 w-full max-w-md">
            <div className="mb-8 flex flex-col items-center text-center">
              <img src={logoSrc} alt="Insider Shield logo" className="mb-5 h-36 w-36 object-contain" />
              <h2 className="text-3xl font-extrabold text-white lg:text-[#2b1b62]">Welcome back please login</h2>
            </div>

            <form onSubmit={handleSubmit} className="rounded-sm border border-slate-200 bg-white p-6 shadow-lg">
              <label className="block text-sm font-extrabold text-slate-700">Username</label>
              <input
                  className="mt-2 w-full rounded-sm border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#7c4dff] focus:ring-2 focus:ring-violet-100"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />

              <label className="mt-5 block text-sm font-extrabold text-slate-700">Password</label>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-sm border border-slate-300 bg-white px-3 py-3 pr-11 text-sm font-semibold text-slate-900 outline-none focus:border-[#7c4dff] focus:ring-2 focus:ring-violet-100"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-900"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {error && <p className="mt-4 rounded-sm bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>}

              <button
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-[#7c4dff] px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-[#6d28d9] disabled:opacity-60"
              >
                <LockKeyhole className="h-4 w-4" />
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
