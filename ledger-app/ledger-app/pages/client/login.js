import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ClientLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend(e) {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/client/portal` : undefined },
    });
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="centered-shell">
      <h1>Client login</h1>
      <p className="sub">Enter your email and we'll send you a secure link</p>
      {sent ? (
        <p className="success-text">Check your email for a login link. You can close this tab.</p>
      ) : (
        <form onSubmit={handleSend}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <button className="btn" type="submit">Send login link</button>
          {error && <p className="error-text">{error}</p>}
        </form>
      )}
    </div>
  );
}
