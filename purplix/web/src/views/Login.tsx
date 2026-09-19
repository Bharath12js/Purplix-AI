import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo, Mark } from '../brand/Logo'

/**
 * Login.
 *
 * Split layout: the brand owns the left, the form owns the right. The form
 * side stays deliberately plain — a login form with decorative flourishes
 * reads as consumer software, and this is a security console.
 *
 * No auth behind it yet. Any submit lands you in the app, which is honest for
 * a preview build and keeps the demo path short.
 */
export function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('sohan.k@purplix.ai')
  const [password, setPassword] = useState('demo-preview')
  const [busy, setBusy] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setTimeout(() => nav('/dashboard'), 420)
  }

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------------------------------------------------- brand */}
      <aside className="relative hidden overflow-hidden bg-surface lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-mesh" />
        {/* the engine gradient, top and bottom */}
        <div className="absolute inset-x-0 top-0 h-1 bg-engine-grad" />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-16">
          <div className="animate-float">
            <Logo size={186} stack glow />
          </div>

          <p className="mx-auto mt-12 max-w-md text-center text-[15px] leading-relaxed text-body">
            Continuous red, blue and purple teaming for models, agents and
            AI applications — where every number resolves down to the
            transcript that produced it.
          </p>

          <div className="mx-auto mt-12 grid w-full max-w-md grid-cols-3 gap-3">
            <Pillar hue="crimson" name="Red" line="Attack" />
            <Pillar hue="brand" name="Purple" line="Assure" />
            <Pillar hue="steel" name="Blue" line="Defend" />
          </div>
        </div>

        <footer className="relative z-10 px-16 pb-8 text-center text-[11px] text-faint">
          Attack corpus authored in-house · records signed Ed25519
        </footer>
      </aside>

      {/* ----------------------------------------------------------- form */}
      <main className="flex items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-[380px]">
          {/* Mark repeats on small screens, where the brand panel is hidden. */}
          <div className="mb-10 flex justify-center lg:hidden">
            <Logo size={64} stack />
          </div>

          <div className="mb-8">
            <h1 className="font-brand text-[26px] font-bold leading-tight tracking-[-0.02em]">
              Sign in
            </h1>
            <p className="mt-1.5 text-[13.5px] text-body">
              Use your Purplix directory account.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label mb-1.5 block">Work email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                autoComplete="username"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="password" className="label">Password</label>
                <button type="button" className="text-[11.5px] font-medium text-brand hover:text-brand-deep">
                  Forgot?
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-border text-brand focus:ring-brand-300"
              />
              <span className="text-[12.5px] text-body">Keep me signed in for 8 hours</span>
            </label>

            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-[14px]">
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-pill border-2 border-white/40 border-t-white" />
                  Signing in
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-faint">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button onClick={() => nav('/dashboard')} className="btn-ghost w-full py-2.5">
            <Mark size={17} />
            Continue with Purplix SSO
          </button>

          <p className="mt-8 text-center text-[11.5px] leading-relaxed text-faint">
            Preview build. Targets are tenant-scoped and require proof of
            ownership before any attack runs.
          </p>
        </div>
      </main>
    </div>
  )
}

function Pillar({ hue, name, line }: {
  hue: 'crimson' | 'brand' | 'steel'; name: string; line: string
}) {
  const cls = {
    crimson: 'border-crimson-200 bg-crimson-50 text-crimson',
    brand: 'border-brand-200 bg-brand-50 text-brand-deep',
    steel: 'border-steel-200 bg-steel-50 text-steel',
  }[hue]
  const dot = { crimson: 'bg-crimson', brand: 'bg-brand', steel: 'bg-steel' }[hue]

  return (
    <div className={`rounded-2xl border px-3 py-3 text-center backdrop-blur-sm ${cls}`}>
      <span className={`mx-auto mb-2 block h-1.5 w-1.5 rounded-pill ${dot}`} />
      <div className="font-brand text-[13px] font-bold">{name}</div>
      <div className="mt-0.5 text-[10.5px] font-medium opacity-70">{line}</div>
    </div>
  )
}
