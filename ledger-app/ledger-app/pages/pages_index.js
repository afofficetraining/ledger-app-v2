import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand-mark">Ledger Advisory</div>
          <nav className="site-nav">
            <a href="#services">Services</a>
            <a href="#process">How It Works</a>
            <a href="#qualify">Who Qualifies</a>
          </nav>
          <div className="header-actions">
            <Link href="/client/login"><button className="btn-outline">Client Login</button></Link>
            <Link href="/agent/login"><button className="btn-solid">Agent Login</button></Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">Indexed Universal Life &middot; Premium Financing</div>
          <h1>Substantial coverage,<br/>without disrupting your capital.</h1>
          <p className="hero-sub">
            We design indexed universal life strategies for high-net-worth individuals and family
            offices, and arrange premium financing so your policy is funded without drawing down
            liquidity you need elsewhere.
          </p>
          <div className="hero-actions">
            <a href="mailto:info@example.com" className="btn-solid large">Speak With Our Insurance Specialists</a>
          </div>
        </div>
      </section>

      <section id="services" className="section">
        <div className="section-inner">
          <div className="section-eyebrow">What We Do</div>
          <h2>A coordinated approach to coverage and capital</h2>
          <div className="card-grid">
            <div className="info-card">
              <h3>Policy Design</h3>
              <p>Our insurance specialists structure an indexed universal life policy around your coverage and planning goals.</p>
            </div>
            <div className="info-card">
              <h3>Premium Financing</h3>
              <p>Premiums are funded through our financing partner, keeping your own capital available for investments and operations.</p>
            </div>
            <div className="info-card">
              <h3>Ongoing Case Management</h3>
              <p>We manage your file end to end &mdash; documentation, underwriting, and coordination with the lender &mdash; through a secure client portal.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="process" className="section alt">
        <div className="section-inner">
          <div className="section-eyebrow">The Process</div>
          <h2>A straightforward path from design to issue</h2>
          <div className="steps-row">
            <div className="step-card"><span className="step-num">01</span><h3>Design</h3><p>We structure the policy to fit your coverage and planning objectives.</p></div>
            <div className="step-card"><span className="step-num">02</span><h3>Document</h3><p>You complete your file securely through our client portal &mdash; no paperwork to mail.</p></div>
            <div className="step-card"><span className="step-num">03</span><h3>Finance</h3><p>Our financing partner funds the premium payments on the policy.</p></div>
            <div className="step-card"><span className="step-num">04</span><h3>In Force</h3><p>Coverage is issued and your policy begins accumulating value.</p></div>
          </div>
        </div>
      </section>

      <section id="qualify" className="section">
        <div className="section-inner">
          <div className="section-eyebrow">Eligibility</div>
          <h2>Who this is designed for</h2>
          <ul className="qualify-list">
            <li>Net worth of $5M or greater</li>
            <li>A need for significant life insurance coverage</li>
            <li>A desire to preserve liquidity and capital efficiency</li>
            <li>Estate, business, or succession planning objectives</li>
          </ul>
        </div>
      </section>

      <section className="cta-section">
        <div className="section-inner cta-inner">
          <h2>Let&rsquo;s discuss your coverage strategy</h2>
          <p>Reach out to begin, or if you&rsquo;re already a client, sign in to your secure portal below.</p>
          <div className="hero-actions">
            <a href="mailto:info@example.com" className="btn-solid large">Contact Our Insurance Specialists</a>
            <Link href="/client/login"><button className="btn-outline large">Client Login</button></Link>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="section-inner">
          <p className="disclosure">
            This information is provided for general purposes and does not constitute tax, legal, or investment advice.
            Premium financing involves risk, including the risk that policy performance may be insufficient to service
            the loan. Consult your own advisors before entering any insurance or financing arrangement.
          </p>
          <p className="footer-bottom">&copy; 2026 Ledger Advisory. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
