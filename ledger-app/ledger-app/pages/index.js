import Link from 'next/link';

export default function Home() {
  return (
    <div className="centered-shell">
      <h1>Ledger</h1>
      <p className="sub">Case file portal</p>
      <Link href="/agent/login"><button className="btn" style={{ marginBottom: 10 }}>Agent login</button></Link>
      <Link href="/client/login"><button className="btn secondary">Client login</button></Link>
    </div>
  );
}
