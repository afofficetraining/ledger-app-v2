import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function AgentLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
          <div className="auth-switch">
            Client, not an agent? <Link href="/client/login">Go to client login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
