import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const timer = setTimeout(() => {
      setReady(current => {
        if (!current) setInvalid(true);
        return current;
      });
    }, 2500);
    return () => {
      listener?.subscription?.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/agent/login'), 2000);
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="auth-quote">
          <h2>Set a new password</h2>
          <p>Choose a new password for your agent account to get back into your case file dashboard.</p>
        </div>
        <div className="auth-foot">&copy; 2026 Gold Edge Ventures. Agent access only.</div>
      </div>
      <div className="auth-form-side">
        <div className="centered-shell">
          <div className="shell-eyebrow">Agent Portal</div>
          <h1>Reset password</h1>
          {done ? (
            <p className="success-text">Password updated. Redirecting to sign in&hellip;</p>
          ) : invalid ? (
            <>
              <p className="sub">This reset link is invalid or has expired.</p>
              <p className="error-text">Please request a new reset link from the sign-in page.</p>
            </>
          ) : !ready ? (
            <p className="sub">Verifying your reset link&hellip;</p>
          ) : (
            <>
              <p className="sub">Enter a new password for your account</p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>New password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
                </div>
                <div className="field">
                  <label>Confirm password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                </div>
                <button className="btn" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Set new password'}</button>
                {error && <p className="error-text">{error}</p>}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
