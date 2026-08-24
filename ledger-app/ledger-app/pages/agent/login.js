import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function AgentLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/agent/agent_dashboard');
  }

  async function handleResetRequest(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.goldedgeventures.com/agent/reset-password',
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="brand-mark">Gold Edge Ventures</div>
        <div className="auth-quote">
          <h2>Every case file, organized and audit-ready.</h2>
          <p>Track documentation, run net worth cross-checks, and move each file to the carrier and financing lender the moment it&rsquo;s complete.</p>
        </div>
        <div className="auth-foot">&copy; 2026 Gold Edge Ventures. Agent access only.</div>
      </div>
      <div className="auth-form-side">
        <div className="centered-shell">
          <div className="shell-eyebrow">Agent Portal</div>
          {resetMode ? (
            <>
              <h1>Reset password</h1>
              <p className="sub">Enter your email and we&rsquo;ll send you a link to set a new password</p>
              {resetSent ? (
                <p className="success-text">Check your email for a reset link, then set your new password there.</p>
              ) : (
                <form onSubmit={handleResetRequest}>
                  <div className="field">
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                  </div>
                  <button className="btn" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
                  {error && <p className="error-text">{error}</p>}
                </form>
              )}
              <div className="auth-switch">
                <a onClick={() => { setResetMode(false); setResetSent(false); setError(''); }} style={{ cursor: 'pointer', color: 'var(--gold)', fontWeight: 600 }}>Back to sign in</a>
              </div>
            </>
          ) : (
            <>
              <h1>Sign in</h1>
              <p className="sub">Access your case file dashboard</p>
              <form onSubmit={handleLogin}>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
                {error && <p className="error-text">{error}</p>}
              </form>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <a onClick={() => { setResetMode(true); setError(''); }} style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--ink-soft)', textDecoration: 'underline' }}>Forgot password?</a>
              </div>
              <div className="auth-switch">
                Client, not an agent? <Link href="/client/login">Go to client login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
