// Deterministic homepage builder. Currently specialized for law-firm domain
// but produces a valid premium homepage shell for any project.

export interface HomepageBuilderInput {
  project: { id: string; name: string; description?: string | null };
  domain?: string | null;
}

export interface HomepageBuildOutput {
  indexHtml: string;
  stylesCss: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

export function buildLawFirmHomepage(input: HomepageBuilderInput): HomepageBuildOutput {
  const name = escapeHtml(input.project.name || "Pillar & Co.");
  const tagline = escapeHtml(
    input.project.description ||
      "Premium AI-assisted legal counsel for founders, operators, and families.",
  );

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="yawb-artifact" content="homepage" />
  <meta name="yawb-artifact-type" content="homepage" />
  <meta name="yawb-domain" content="law-firm" />
  <title>${name} — AI-powered legal counsel</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <header class="site-nav">
    <div class="nav-inner">
      <a class="brand" href="#top">
        <span class="brand-mark">§</span>
        <span class="brand-name">${name}</span>
      </a>
      <nav class="nav-links" aria-label="Primary">
        <a href="#practice">Practice Areas</a>
        <a href="#attorneys">Attorneys</a>
        <a href="#intake">Case Intake</a>
        <a href="#pricing">Pricing</a>
        <a href="#contact">Contact</a>
      </nav>
      <a class="nav-cta cta" href="#intake">Book consultation</a>
    </div>
  </header>

  <main id="top">
    <section class="hero" data-section="hero">
      <div class="hero-inner">
        <p class="eyebrow">AI-powered legal counsel</p>
        <h1>Premium representation,<br/>without the friction.</h1>
        <p class="lede">${tagline}</p>
        <div class="hero-ctas">
          <a class="cta cta-primary" href="#intake">Get a free consultation</a>
          <a class="cta cta-ghost" href="#practice">Explore practice areas</a>
        </div>
      </div>
    </section>

    <section class="trust-bar" aria-label="Trust">
      <ul>
        <li><strong>SOC 2</strong><span>Compliance & secure client portal</span></li>
        <li><strong>AI-assisted</strong><span>Case review in hours, not weeks</span></li>
        <li><strong>30+ yrs</strong><span>Combined courtroom experience</span></li>
        <li><strong>4.9 / 5</strong><span>Verified client outcomes</span></li>
      </ul>
    </section>

    <section id="practice" class="practice-areas">
      <header class="section-head">
        <p class="eyebrow">Practice Areas</p>
        <h2>Counsel across every chapter of your business and life.</h2>
      </header>
      <div class="services-grid practice-grid">
        ${["Corporate", "Litigation", "Family", "Immigration", "Real Estate", "Employment"]
          .map(
            (p) => `<article class="practice-card">
            <h3>${p}</h3>
            <p>Strategic ${p.toLowerCase()} counsel led by senior partners and supported by our AI case-review engine.</p>
            <a href="#contact">Talk to a ${p.toLowerCase()} attorney →</a>
          </article>`,
          )
          .join("\n        ")}
      </div>
    </section>

    <section id="intake" class="intake">
      <div class="intake-grid">
        <div class="intake-copy">
          <p class="eyebrow">Client Intake</p>
          <h2>Tell us about your matter.</h2>
          <p>Submit the basics in 2 minutes. A partner reviews every intake within one business day.</p>
          <ul class="intake-bullets">
            <li>Encrypted, attorney–client privileged</li>
            <li>Free first consultation</li>
            <li>No obligation to retain</li>
          </ul>
        </div>
        <form class="intake-form" aria-label="Case intake preview" onsubmit="event.preventDefault();">
          <label>Full name<input type="text" placeholder="Jane Doe" /></label>
          <label>Email<input type="email" placeholder="jane@example.com" /></label>
          <label>Practice area
            <select><option>Corporate</option><option>Litigation</option><option>Family</option><option>Immigration</option><option>Real Estate</option><option>Employment</option></select>
          </label>
          <label>Brief description<textarea rows="4" placeholder="Tell us what's going on…"></textarea></label>
          <button class="cta cta-primary" type="submit">Request consultation</button>
        </form>
      </div>
    </section>

    <section class="workflow">
      <header class="section-head">
        <p class="eyebrow">How we work</p>
        <h2>From intake to resolution — clearly mapped.</h2>
      </header>
      <ol class="workflow-steps">
        <li><span class="step-num">01</span><strong>Intake</strong><p>Share your matter; we triage within a day.</p></li>
        <li><span class="step-num">02</span><strong>Review</strong><p>AI-assisted research distilled by a partner.</p></li>
        <li><span class="step-num">03</span><strong>Documents</strong><p>Drafting, filing, and secure exchange.</p></li>
        <li><span class="step-num">04</span><strong>Billing</strong><p>Flat or hourly — transparent from day one.</p></li>
      </ol>
    </section>

    <section id="attorneys" class="attorneys">
      <header class="section-head">
        <p class="eyebrow">Our team</p>
        <h2>Senior counsel on every matter.</h2>
      </header>
      <div class="team-grid">
        ${[
          { n: "Margaret Hsu", r: "Managing Partner — Corporate" },
          { n: "David Okafor", r: "Partner — Litigation" },
          { n: "Elena Rossi", r: "Partner — Immigration" },
          { n: "Samuel Park", r: "Senior Counsel — Family" },
        ]
          .map(
            (a) => `<article class="team-card">
            <div class="team-avatar" aria-hidden="true">${a.n.split(" ").map((p) => p[0]).join("")}</div>
            <h3>${a.n}</h3>
            <p>${a.r}</p>
          </article>`,
          )
          .join("\n        ")}
      </div>
    </section>

    <section id="pricing" class="pricing">
      <header class="section-head">
        <p class="eyebrow">Pricing</p>
        <h2>Consultation packages with no surprises.</h2>
      </header>
      <div class="pricing-grid">
        <article class="price-card">
          <h3>Consultation</h3>
          <p class="price">$0<span>/ first call</span></p>
          <ul><li>30-minute partner call</li><li>Initial assessment</li><li>Written next steps</li></ul>
          <a class="cta cta-ghost" href="#intake">Book free</a>
        </article>
        <article class="price-card price-card--featured">
          <h3>Engagement</h3>
          <p class="price">$2,400<span>/ matter</span></p>
          <ul><li>Dedicated partner</li><li>Document drafting</li><li>Filing & negotiation</li></ul>
          <a class="cta cta-primary" href="#intake">Start engagement</a>
        </article>
        <article class="price-card">
          <h3>Retainer</h3>
          <p class="price">$4,800<span>/ month</span></p>
          <ul><li>Ongoing counsel</li><li>Priority response</li><li>Quarterly review</li></ul>
          <a class="cta cta-ghost" href="#contact">Talk to us</a>
        </article>
      </div>
    </section>

    <section class="testimonials">
      <header class="section-head">
        <p class="eyebrow">Client outcomes</p>
        <h2>Trusted by founders, families, and operators.</h2>
      </header>
      <div class="testimonial-grid">
        <blockquote><p>“Saved our acquisition. Margaret negotiated terms we never thought possible.”</p><cite>— Founder, Series B SaaS</cite></blockquote>
        <blockquote><p>“Clear, fast, and humane. The AI summaries made every meeting count.”</p><cite>— Family law client</cite></blockquote>
        <blockquote><p>“Outstanding immigration counsel. We had a green card in nine months.”</p><cite>— Engineering leader</cite></blockquote>
      </div>
    </section>

    <section id="contact" class="contact-cta">
      <div class="contact-inner">
        <h2>Speak to a partner this week.</h2>
        <p>Free consultation, no obligation. We respond to every intake within one business day.</p>
        <a class="cta cta-primary" href="#intake">Book your free consultation</a>
      </div>
    </section>
  </main>

  <footer class="site-foot">
    <p>© ${new Date().getFullYear()} ${name}. Attorney advertising. Prior results do not guarantee similar outcomes.</p>
  </footer>
</body>
</html>`;

  const stylesCss = `:root{
  --navy:#0b1a33;
  --navy-2:#13294b;
  --ivory:#f6f1e7;
  --ivory-2:#ece4d2;
  --gold:#c9a14a;
  --gold-2:#e6c277;
  --ink:#1a1f2c;
  --muted:#6a7388;
  --line:rgba(11,26,51,.10);
  --radius:14px;
  --max:1180px;
  font-synthesis:none;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--ivory);color:var(--ink);font-family:"Inter",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:"Playfair Display","Source Serif Pro",Georgia,serif;letter-spacing:-0.01em;color:var(--navy);margin:0 0 .5rem}
h1{font-size:clamp(2.4rem,5vw,4rem);line-height:1.05}
h2{font-size:clamp(1.6rem,3vw,2.4rem);line-height:1.15}
h3{font-size:1.15rem;line-height:1.3}
p{margin:0 0 1rem}
a{color:var(--navy);text-decoration:none}
.eyebrow{text-transform:uppercase;letter-spacing:.22em;font-size:.72rem;color:var(--gold);margin:0 0 .75rem;font-weight:600}
section{padding:5rem 1.25rem}
.section-head{max-width:var(--max);margin:0 auto 2.5rem;text-align:center}
.cta{display:inline-flex;align-items:center;gap:.5rem;padding:.85rem 1.4rem;border-radius:999px;font-weight:600;font-size:.95rem;transition:transform .15s ease,box-shadow .15s ease;border:1px solid transparent;cursor:pointer}
.cta-primary{background:var(--navy);color:var(--ivory);box-shadow:0 10px 24px -16px rgba(11,26,51,.6)}
.cta-primary:hover{transform:translateY(-1px);box-shadow:0 14px 28px -16px rgba(11,26,51,.7)}
.cta-ghost{background:transparent;color:var(--navy);border-color:var(--navy)}
.cta-ghost:hover{background:var(--navy);color:var(--ivory)}

/* Nav */
.site-nav{position:sticky;top:0;background:rgba(246,241,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);z-index:5}
.nav-inner{max-width:var(--max);margin:0 auto;padding:1rem 1.25rem;display:flex;align-items:center;gap:1.5rem}
.brand{display:flex;align-items:center;gap:.55rem;font-family:"Playfair Display",Georgia,serif;font-size:1.15rem;color:var(--navy)}
.brand-mark{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--navy);color:var(--gold);font-weight:700}
.nav-links{display:flex;gap:1.25rem;margin-left:auto;flex-wrap:wrap}
.nav-links a{font-size:.92rem;color:var(--ink);opacity:.8}
.nav-links a:hover{opacity:1;color:var(--navy)}
.nav-cta{padding:.55rem 1rem;font-size:.85rem}

/* Hero */
.hero{background:linear-gradient(180deg,var(--ivory) 0%,var(--ivory-2) 100%);padding-top:5.5rem;padding-bottom:5rem;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;inset:auto -10% -40% auto;width:60%;height:80%;background:radial-gradient(closest-side,rgba(201,161,74,.18),transparent);pointer-events:none}
.hero-inner{max-width:var(--max);margin:0 auto;text-align:left}
.hero h1{max-width:18ch}
.lede{font-size:1.15rem;color:var(--muted);max-width:54ch;margin-top:1rem}
.hero-ctas{display:flex;gap:.75rem;margin-top:1.75rem;flex-wrap:wrap}

/* Trust bar */
.trust-bar{background:var(--navy);color:var(--ivory);padding:2rem 1.25rem}
.trust-bar ul{max-width:var(--max);margin:0 auto;list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1.25rem}
.trust-bar li{display:flex;flex-direction:column;gap:.15rem;border-left:2px solid var(--gold);padding-left:1rem}
.trust-bar strong{font-family:"Playfair Display",Georgia,serif;font-size:1.4rem;color:var(--gold-2)}
.trust-bar span{font-size:.85rem;opacity:.85}

/* Practice */
.practice-areas{background:var(--ivory)}
.practice-grid,.services-grid{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.25rem}
.practice-card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:1.5rem;transition:transform .15s ease,box-shadow .2s ease}
.practice-card:hover{transform:translateY(-2px);box-shadow:0 18px 40px -28px rgba(11,26,51,.35)}
.practice-card h3{margin-bottom:.5rem}
.practice-card p{color:var(--muted);font-size:.95rem}
.practice-card a{color:var(--navy);font-weight:600;font-size:.9rem;border-bottom:1px solid var(--gold);padding-bottom:2px}

/* Intake */
.intake{background:linear-gradient(180deg,#fff 0%,var(--ivory) 100%)}
.intake-grid{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center}
.intake-copy h2{margin-bottom:1rem}
.intake-bullets{list-style:none;padding:0;margin:1.25rem 0 0;display:grid;gap:.5rem}
.intake-bullets li{padding-left:1.5rem;position:relative;color:var(--muted)}
.intake-bullets li::before{content:"§";position:absolute;left:0;color:var(--gold);font-weight:700}
.intake-form{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:1.75rem;display:grid;gap:.85rem;box-shadow:0 18px 40px -28px rgba(11,26,51,.25)}
.intake-form label{display:grid;gap:.35rem;font-size:.85rem;color:var(--navy);font-weight:600}
.intake-form input,.intake-form select,.intake-form textarea{font:inherit;padding:.7rem .85rem;border:1px solid var(--line);border-radius:10px;background:var(--ivory);color:var(--ink);width:100%}
.intake-form button{justify-self:start;margin-top:.25rem}

/* Workflow */
.workflow{background:var(--navy);color:var(--ivory)}
.workflow .section-head h2,.workflow .eyebrow{color:var(--ivory)}
.workflow .eyebrow{color:var(--gold-2)}
.workflow-steps{max-width:var(--max);margin:0 auto;list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.25rem}
.workflow-steps li{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius);padding:1.5rem}
.step-num{font-family:"Playfair Display",Georgia,serif;color:var(--gold-2);font-size:1.5rem;display:block;margin-bottom:.5rem}
.workflow-steps strong{display:block;color:var(--ivory);margin-bottom:.35rem;font-family:"Playfair Display",Georgia,serif;font-size:1.1rem}
.workflow-steps p{color:rgba(246,241,231,.75);font-size:.9rem;margin:0}

/* Team */
.attorneys{background:var(--ivory-2)}
.team-grid{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.25rem}
.team-card{background:#fff;border-radius:var(--radius);padding:1.5rem;text-align:center;border:1px solid var(--line)}
.team-avatar{width:72px;height:72px;border-radius:50%;margin:0 auto .85rem;background:var(--navy);color:var(--gold-2);display:grid;place-items:center;font-family:"Playfair Display",Georgia,serif;font-size:1.4rem}
.team-card h3{margin-bottom:.25rem}
.team-card p{color:var(--muted);font-size:.85rem;margin:0}

/* Pricing */
.pricing{background:#fff}
.pricing-grid{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.25rem}
.price-card{border:1px solid var(--line);border-radius:var(--radius);padding:1.75rem;background:var(--ivory);display:flex;flex-direction:column;gap:1rem}
.price-card--featured{background:var(--navy);color:var(--ivory);border-color:var(--navy);transform:translateY(-4px)}
.price-card--featured h3,.price-card--featured .price{color:var(--ivory)}
.price{font-family:"Playfair Display",Georgia,serif;font-size:2rem;color:var(--navy);margin:0}
.price span{font-size:.85rem;color:var(--muted);margin-left:.25rem;font-family:inherit}
.price-card--featured .price span{color:rgba(246,241,231,.7)}
.price-card ul{list-style:none;padding:0;margin:0;display:grid;gap:.4rem;font-size:.92rem;color:var(--muted)}
.price-card--featured ul{color:rgba(246,241,231,.85)}
.price-card .cta{align-self:flex-start;margin-top:auto}

/* Testimonials */
.testimonials{background:var(--ivory)}
.testimonial-grid{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.25rem}
.testimonials blockquote{margin:0;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:1.5rem;display:grid;gap:.75rem}
.testimonials blockquote p{font-family:"Playfair Display",Georgia,serif;color:var(--navy);margin:0;font-size:1.05rem}
.testimonials cite{color:var(--muted);font-style:normal;font-size:.85rem}

/* Final CTA */
.contact-cta{background:linear-gradient(135deg,var(--navy) 0%,var(--navy-2) 100%);color:var(--ivory);text-align:center}
.contact-cta h2{color:var(--ivory)}
.contact-inner{max-width:720px;margin:0 auto}
.contact-inner p{color:rgba(246,241,231,.8);margin-bottom:1.5rem}

/* Footer */
.site-foot{padding:1.5rem 1.25rem;text-align:center;color:var(--muted);font-size:.8rem;background:var(--ivory-2);border-top:1px solid var(--line)}

/* Responsive */
@media (max-width:820px){
  .nav-links{display:none}
  .intake-grid{grid-template-columns:1fr}
  .price-card--featured{transform:none}
  section{padding:3.25rem 1rem}
}
`;

  return { indexHtml, stylesCss };
}
