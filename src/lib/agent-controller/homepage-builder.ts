import { resolveProjectBranding } from "@/lib/project-branding";
import { findForbiddenDashboardTokens } from "./forbidden-dashboard-tokens";

export interface HomepageBuilderInput {
  project: {
    id: string;
    name: string;
    description?: string | null;
    logo_url?: string | null;
    favicon_url?: string | null;
    watermark_url?: string | null;
  };
  domain?: string | null;
}

export interface HomepageBuildOutput {
  indexHtml: string;
  stylesCss: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function cssUrl(value: string): string {
  return value.replace(/[\\"')]/g, "\\$&");
}

export function sanitizeHomepageText(value: string, fallback: string): string {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return fallback;
  if (findForbiddenDashboardTokens(cleaned).length > 0) return fallback;
  return cleaned;
}

const SAFE_TAGLINE = "Modern legal counsel for founders, families, and growing companies.";
const SAFE_FIRM_NAME = "Sterling & Vale";

export function buildLawFirmHomepage(input: HomepageBuilderInput): HomepageBuildOutput {
  const branding = resolveProjectBranding(input.project);
  const firmName = escapeHtml(sanitizeHomepageText(input.project.name ?? "", SAFE_FIRM_NAME));
  const tagline = escapeHtml(SAFE_TAGLINE);
  const logoUrl = escapeHtml(branding.logoUrl);
  const faviconUrl = escapeHtml(branding.faviconUrl);
  const watermarkUrl = escapeHtml(branding.watermarkUrl);

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="yawb-artifact" content="homepage" />
  <meta name="yawb-artifact-type" content="homepage" />
  <meta name="yawb-controller" content="agent-controller-v1" />
  <meta name="yawb-built-by" content="agent-controller-v1" />
  <meta name="yawb-branding-source" content="${branding.usesDefaultLogo ? "default" : "project"}" />
  <title>${firmName} — Modern Legal Counsel</title>
  <link rel="icon" href="${faviconUrl}" />
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <div class="brand-watermark" aria-hidden="true"></div>
  <header class="site-header">
    <a class="brand" href="#top" aria-label="${firmName} home">
      <img class="brand-logo" src="${logoUrl}" alt="${firmName} logo" />
      <span>${firmName}</span>
    </a>
    <nav class="site-navigation" aria-label="Primary navigation">
      <a href="#practice">Practice Areas</a>
      <a href="#team">Attorneys</a>
      <a href="#process">Process</a>
      <a href="#pricing">Pricing</a>
      <a href="#contact">Contact</a>
    </nav>
    <a class="button button-small" href="#contact">Book consultation</a>
  </header>

  <main id="top">
    <section class="hero" data-section="hero">
      <div class="hero-copy">
        <p class="eyebrow">AI-assisted legal counsel</p>
        <h1>Premium legal representation without the friction.</h1>
        <p class="lede">${tagline}</p>
        <div class="hero-actions">
          <a class="button button-primary cta" href="#contact">Get a free consultation</a>
          <a class="button button-secondary cta" href="#practice">Explore services</a>
        </div>
      </div>
      <aside class="hero-card" aria-label="Firm highlights">
        <p class="card-kicker">Trusted counsel</p>
        <h2>Fast answers. Senior attorneys. Clear next steps.</h2>
        <ul>
          <li>Free first consultation</li>
          <li>Secure document review</li>
          <li>Transparent pricing</li>
        </ul>
      </aside>
    </section>

    <section class="trust-strip" aria-label="Trust proof">
      <article><strong>30+ yrs</strong><span>combined legal experience</span></article>
      <article><strong>4.9/5</strong><span>client satisfaction rating</span></article>
      <article><strong>24h</strong><span>typical first response</span></article>
      <article><strong>100%</strong><span>confidential review</span></article>
    </section>

    <section id="practice" class="section practice-areas">
      <div class="section-heading">
        <p class="eyebrow">Practice Areas</p>
        <h2>Legal support for the moments that matter.</h2>
        <p>Focused representation for businesses, families, and individuals.</p>
      </div>
      <div class="cards-grid services-grid">
        <article class="service-card"><h3>Corporate</h3><p>Formation, contracts, acquisitions, founder disputes, and governance.</p></article>
        <article class="service-card"><h3>Litigation</h3><p>Commercial disputes, negotiations, filings, and settlement strategy.</p></article>
        <article class="service-card"><h3>Family</h3><p>Divorce, custody, asset planning, and sensitive family agreements.</p></article>
        <article class="service-card"><h3>Immigration</h3><p>Work visas, family petitions, residency strategy, and compliance.</p></article>
        <article class="service-card"><h3>Real Estate</h3><p>Closings, leases, purchase agreements, and property disputes.</p></article>
        <article class="service-card"><h3>Employment</h3><p>Executive agreements, workplace disputes, policies, and severance.</p></article>
      </div>
    </section>

    <section id="process" class="section process-section">
      <div class="section-heading"><p class="eyebrow">How it works</p><h2>A clear path from first call to resolution.</h2></div>
      <ol class="process-list">
        <li><span>01</span><h3>Consultation</h3><p>Tell us what happened. We identify the right next step.</p></li>
        <li><span>02</span><h3>Review</h3><p>Your attorney reviews documents, facts, deadlines, and options.</p></li>
        <li><span>03</span><h3>Strategy</h3><p>You receive a plain-English plan before any engagement begins.</p></li>
        <li><span>04</span><h3>Resolution</h3><p>We handle negotiation, drafting, filing, and communication.</p></li>
      </ol>
    </section>

    <section id="team" class="section team-section">
      <div class="section-heading"><p class="eyebrow">Attorneys</p><h2>Senior counsel on every matter.</h2></div>
      <div class="team-grid">
        <article class="team-card"><div class="avatar">MH</div><h3>Margaret Hsu</h3><p>Managing Partner · Corporate</p></article>
        <article class="team-card"><div class="avatar">DO</div><h3>David Okafor</h3><p>Partner · Litigation</p></article>
        <article class="team-card"><div class="avatar">ER</div><h3>Elena Rossi</h3><p>Partner · Immigration</p></article>
        <article class="team-card"><div class="avatar">SP</div><h3>Samuel Park</h3><p>Senior Counsel · Family</p></article>
      </div>
    </section>

    <section id="pricing" class="section pricing-section">
      <div class="section-heading"><p class="eyebrow">Pricing</p><h2>Simple engagement options.</h2></div>
      <div class="pricing-grid">
        <article class="price-card"><h3>First consultation</h3><p class="price">$0</p><p>Initial call, issue review, and next-step recommendation.</p><a class="button button-secondary cta" href="#contact">Book free</a></article>
        <article class="price-card featured"><h3>Fixed-scope matter</h3><p class="price">$2,400+</p><p>Contracts, filings, negotiations, and focused representation.</p><a class="button button-primary cta" href="#contact">Start now</a></article>
        <article class="price-card"><h3>Monthly counsel</h3><p class="price">$4,800+</p><p>Ongoing advice for founders, operators, and families.</p><a class="button button-secondary cta" href="#contact">Talk to us</a></article>
      </div>
    </section>

    <section class="section testimonial-section">
      <div class="section-heading"><p class="eyebrow">Client outcomes</p><h2>Trusted by people who need clarity fast.</h2></div>
      <div class="testimonial-grid">
        <blockquote><p>“They turned a complicated dispute into a clear, manageable plan.”</p><cite>Founder, software company</cite></blockquote>
        <blockquote><p>“Direct, careful, and extremely responsive from the first call.”</p><cite>Family law client</cite></blockquote>
        <blockquote><p>“The best legal experience we have had as a growing company.”</p><cite>Operations lead</cite></blockquote>
      </div>
    </section>

    <section id="contact" class="section contact-section">
      <div class="contact-panel">
        <p class="eyebrow">Contact</p>
        <h2>Speak with an attorney this week.</h2>
        <p>Share your situation and receive a confidential recommendation within one business day.</p>
        <form class="contact-form" onsubmit="event.preventDefault();">
          <label>Name<input type="text" placeholder="Jane Doe" /></label>
          <label>Email<input type="email" placeholder="jane@example.com" /></label>
          <label>Legal need<select><option>Corporate</option><option>Litigation</option><option>Family</option><option>Immigration</option><option>Real Estate</option><option>Employment</option></select></label>
          <label class="full">Tell us what you need<textarea rows="4" placeholder="Briefly describe your situation"></textarea></label>
          <button class="button button-primary cta" type="submit">Request consultation</button>
        </form>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <p>© ${new Date().getFullYear()} ${firmName}. Attorney advertising. Prior results do not guarantee similar outcomes.</p>
    <p data-yawb-controller-marker="agent-controller-v1">Built by agent-controller-v1</p>
  </footer>
</body>
</html>`;

  const stylesCss = `:root{
  --ink:#101827; --muted:#637083; --paper:#f7f1e8; --paper-2:#eee4d3; --navy:#0d2443; --navy-2:#173a64; --gold:#c59b45; --white:#ffffff; --line:rgba(16,24,39,.12); --shadow:0 24px 70px rgba(13,36,67,.16); --radius:20px; --max:1180px;
}
*{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased} a{color:inherit;text-decoration:none} h1,h2,h3,p{margin:0} h1,h2,h3{font-family:"Playfair Display",Georgia,serif;letter-spacing:-.025em;color:var(--navy)} h1{font-size:clamp(2.7rem,6vw,5.4rem);line-height:.98;max-width:11ch} h2{font-size:clamp(2rem,4vw,3.4rem);line-height:1.05} h3{font-size:1.25rem;line-height:1.2}
.brand-watermark{position:fixed;right:24px;bottom:24px;width:min(240px,32vw);height:120px;background:url('${cssUrl(watermarkUrl)}') center/contain no-repeat;opacity:.045;pointer-events:none;z-index:0}.site-header,main,.site-footer{position:relative;z-index:1}
.site-header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:1.25rem;padding:1rem clamp(1rem,4vw,3rem);background:rgba(247,241,232,.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)} .brand{display:flex;align-items:center;gap:.7rem;font-weight:800;color:var(--navy)} .brand-logo{width:44px;height:44px;object-fit:contain;display:block;border-radius:12px;background:white} .site-navigation{display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap;color:var(--muted);font-size:.95rem}.site-navigation a:hover{color:var(--navy)}
.button{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:.9rem 1.35rem;font-weight:800;border:1px solid transparent;cursor:pointer}.button-small{padding:.65rem 1rem;background:var(--navy);color:var(--white)}.button-primary{background:var(--navy);color:var(--white);box-shadow:0 12px 30px rgba(13,36,67,.2)}.button-secondary{border-color:var(--navy);color:var(--navy);background:transparent}.button-secondary:hover{background:var(--navy);color:var(--white)}.eyebrow{color:var(--gold);text-transform:uppercase;letter-spacing:.22em;font-size:.74rem;font-weight:900;margin-bottom:.8rem}
.hero{max-width:var(--max);margin:0 auto;padding:clamp(4rem,8vw,8rem) clamp(1rem,3vw,2rem);display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.72fr);gap:clamp(2rem,6vw,5rem);align-items:center}.lede{font-size:1.18rem;color:var(--muted);max-width:58ch;margin-top:1.25rem}.hero-actions{display:flex;gap:.85rem;flex-wrap:wrap;margin-top:2rem}.hero-card{background:var(--white);border:1px solid var(--line);border-radius:var(--radius);padding:2rem;box-shadow:var(--shadow)}.card-kicker{color:var(--gold);font-weight:900;text-transform:uppercase;letter-spacing:.18em;font-size:.74rem;margin-bottom:.85rem}.hero-card h2{font-size:clamp(1.7rem,3vw,2.4rem)}.hero-card ul{padding-left:1.1rem;margin:1.25rem 0 0;color:var(--muted);display:grid;gap:.55rem}
.trust-strip{max-width:var(--max);margin:0 auto;padding:0 clamp(1rem,3vw,2rem) 4rem;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem}.trust-strip article{background:var(--navy);color:var(--white);border-radius:18px;padding:1.25rem}.trust-strip strong{display:block;color:var(--gold);font-family:Georgia,serif;font-size:1.75rem}.trust-strip span{font-size:.88rem;color:rgba(255,255,255,.78)}
.section{padding:clamp(4rem,7vw,7rem) clamp(1rem,3vw,2rem)}.section-heading{max-width:760px;margin:0 auto 2.5rem;text-align:center}.section-heading p:not(.eyebrow){color:var(--muted);margin-top:.8rem}.practice-areas{background:var(--white)}.cards-grid,.team-grid,.pricing-grid,.testimonial-grid{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.service-card,.team-card,.price-card,blockquote{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:1.5rem}.service-card p,.team-card p,.price-card p,blockquote cite{color:var(--muted);margin-top:.6rem}
.process-section{background:var(--navy);color:var(--white)}.process-section h2{color:var(--white)}.process-list{max-width:var(--max);margin:0 auto;padding:0;list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem}.process-list li{border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);padding:1.4rem;background:rgba(255,255,255,.05)}.process-list span{color:var(--gold);font-weight:900}.process-list h3{color:var(--white);margin:.55rem 0}.process-list p{color:rgba(255,255,255,.72)}
.team-section{background:var(--paper-2)}.team-card{text-align:center;background:var(--white)}.avatar{width:70px;height:70px;border-radius:50%;display:grid;place-items:center;margin:0 auto 1rem;background:var(--navy);color:var(--gold);font-weight:900}.pricing-section{background:var(--white)}.price-card{background:var(--paper);display:grid;gap:1rem}.price-card.featured{background:var(--navy);color:var(--white)}.price-card.featured h3,.price-card.featured .price{color:var(--white)}.price{font-size:2rem;font-weight:900;color:var(--navy)}.testimonial-section{background:var(--paper)}blockquote{background:var(--white);margin:0}blockquote p{font-family:Georgia,serif;font-size:1.1rem;color:var(--navy)}blockquote cite{display:block;font-style:normal}
.contact-section{background:linear-gradient(135deg,var(--navy),var(--navy-2));}.contact-panel{max-width:900px;margin:0 auto;background:var(--white);border-radius:calc(var(--radius) + 8px);padding:clamp(1.5rem,4vw,3rem);box-shadow:var(--shadow)}.contact-panel > p:not(.eyebrow){color:var(--muted);margin-top:.7rem}.contact-form{margin-top:1.6rem;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.contact-form label{display:grid;gap:.4rem;font-weight:800;color:var(--navy)}.contact-form input,.contact-form select,.contact-form textarea{width:100%;border:1px solid var(--line);border-radius:14px;background:var(--paper);padding:.85rem 1rem;font:inherit;color:var(--ink)}.contact-form .full{grid-column:1/-1}.site-footer{padding:1.5rem;text-align:center;color:var(--muted);font-size:.85rem}
@media(max-width:900px){.site-header{align-items:flex-start;flex-direction:column}.site-navigation{gap:.8rem}.hero{grid-template-columns:1fr}.trust-strip,.cards-grid,.team-grid,.pricing-grid,.testimonial-grid,.process-list{grid-template-columns:1fr}.contact-form{grid-template-columns:1fr}}`;

  return { indexHtml, stylesCss };
}
