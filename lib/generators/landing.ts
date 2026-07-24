import { type TemplatePackId, getPackCopy } from "@/lib/template-packs";
import type { RepoAnalysis } from "@/types";

export function generateLandingPage(
  repoName: string,
  analysis: RepoAnalysis,
  description?: string,
  templatePack: TemplatePackId = "default"
): string {
  const pack = getPackCopy(templatePack, repoName, analysis);
  const heroTitle = pack.landingHeadline.replace(/</g, "&lt;");
  const heroSub = (description || pack.landingSubhead).replace(/</g, "&lt;");
  const ctaPrimary = pack.landingCtaPrimary.replace(/</g, "&lt;");
  const ctaSecondary = pack.landingCtaSecondary.replace(/</g, "&lt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heroTitle}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }

    header {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      color: white;
      padding: 1rem 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    nav {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    nav h1 {
      font-size: 1.5rem;
      font-weight: bold;
    }

    nav a {
      color: white;
      text-decoration: none;
      margin-left: 2rem;
      transition: opacity 0.3s;
    }

    nav a:hover {
      opacity: 0.8;
    }

    .hero {
      max-width: 1200px;
      margin: 0 auto;
      padding: 6rem 2rem;
      text-align: center;
      color: white;
    }

    .hero h1 {
      font-size: 3.5rem;
      margin-bottom: 1rem;
      font-weight: bold;
    }

    .hero p {
      font-size: 1.25rem;
      margin-bottom: 2rem;
      opacity: 0.9;
    }

    .cta-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;
    }

    .btn {
      padding: 0.75rem 2rem;
      font-size: 1rem;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s;
      text-decoration: none;
      display: inline-block;
    }

    .btn-primary {
      background: white;
      color: #667eea;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }

    .btn-secondary {
      background: transparent;
      color: white;
      border: 2px solid white;
    }

    .btn-secondary:hover {
      background: white;
      color: #667eea;
    }

    .features {
      background: white;
      padding: 4rem 2rem;
    }

    .features-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .features h2 {
      text-align: center;
      font-size: 2.5rem;
      margin-bottom: 3rem;
      color: #333;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
    }

    .feature-card {
      padding: 2rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .feature-card h3 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #667eea;
    }

    .feature-card p {
      color: #666;
    }

    .tech-stack {
      background: #f8f9fa;
      padding: 2rem;
      border-radius: 0.5rem;
      margin: 2rem 0;
    }

    .tech-stack h3 {
      margin-bottom: 1rem;
      color: #333;
    }

    .tech-badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .badge {
      background: #667eea;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    footer {
      background: rgba(0, 0, 0, 0.5);
      color: white;
      text-align: center;
      padding: 2rem;
      margin-top: 4rem;
    }
  </style>
</head>
<body>
  <header>
    <nav>
      <h1>${heroTitle}</h1>
      <div>
        <a href="#features">Features</a>
        <a href="#tech">Tech Stack</a>
      </div>
    </nav>
  </header>

  <section class="hero">
    <h1>${heroTitle}</h1>
    <p>${heroSub}</p>
    <div class="cta-buttons">
      <a href="https://github.com" class="btn btn-primary">${ctaPrimary}</a>
      <a href="#" class="btn btn-secondary">${ctaSecondary}</a>
    </div>
  </section>

  <section class="features">
    <div class="features-container">
      <h2 id="features">Features</h2>
      <div class="features-grid">
        <div class="feature-card">
          <h3>⚡ Fast</h3>
          <p>Optimized for performance with modern best practices</p>
        </div>
        <div class="feature-card">
          <h3>🔧 Flexible</h3>
          <p>Easy to configure and extend for your needs</p>
        </div>
        <div class="feature-card">
          <h3>📦 Production Ready</h3>
          <p>Deploy with confidence to production environments</p>
        </div>
      </div>

      <div id="tech" class="tech-stack">
        <h3>Tech Stack</h3>
        <div class="tech-badges">
          <span class="badge">${analysis.framework}</span>
          <span class="badge">${analysis.packageManager}</span>
          <span class="badge">${analysis.backendType}</span>
          ${analysis.hasDocker ? '<span class="badge">Docker</span>' : ""}
        </div>
      </div>
    </div>
  </section>

  <footer>
    <p>&copy; 2024 ${repoName}. Built with Shipwright.</p>
  </footer>
</body>
</html>`;
}
