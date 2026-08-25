import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import BrandMark from '../../components/BrandMark';

export default function ClientLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://www.goldedgeventures.com/client/client_portal' },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <BrandMark height={92} />
        <div className="auth-quote">
          <h2>Your case file, in one secure place.</h2>
          <p>Upload documents, e-sign what&rsquo;s required, and track exactly what&rsquo;s still needed &mdash; no paperwork to print or mail.</p>
        </div>
        <div className="auth-foot">&copy; 2026 Gold Edge Ventures. Secure client access.</div>
      </div>
      <div className="auth-form-side">
        <div className="centered-shell">
          <div className="shell-eyebrow">Client Portal</div>
          <h1>Client login</h1>
          <p className="sub">Enter your email and we&rsquo;ll send you a secure sign-in link &mdash; no password needed</p>
          {sent ? (
            <p className="success-text">Check your email for a login link. You can close this tab.</p>
          ) : (
            <form onSubmit={handleSend}>
              <div className="field">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>
              <button className="btn" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send login link'}</button>
              {error && <p className="error-text">{error}</p>}
            </form>
          )}
          <div className="auth-switch">
            Agent, not a client? <Link href="/agent/login">Go to agent login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
