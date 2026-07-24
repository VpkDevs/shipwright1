import { getInstallCommand, getRunScriptCommand } from "@/lib/package-manager";
import { type TemplatePackId, getPackCopy } from "@/lib/template-packs";
import type { RepoAnalysis } from "@/types";

export function generateReadme(
  repoName: string,
  analysis: RepoAnalysis,
  description?: string,
  templatePack: TemplatePackId = "default"
): string {
  const packCopy = getPackCopy(templatePack, repoName, analysis);

  const installCommand = getInstallCommand(analysis.packageManager);
  const devCommand = getRunScriptCommand(analysis.packageManager, "dev");
  const buildCommand = getRunScriptCommand(analysis.packageManager, "build");
  const startCommand = getRunScriptCommand(analysis.packageManager, "start");

  const sections = [
    `# ${repoName}`,
    "",
    description || analysis.description,
    "",
    "## Positioning",
    "",
    packCopy.readmeTagline,
    "",
    `_Audience: ${packCopy.readmeAudience}_`,
    "",
    "## Features",
    "",
    "- ✨ Fast and performant",
    "- 🔧 Easy to configure",
    "- 📦 Production-ready",
    "",
    "## Tech Stack",
    "",
    `- **Framework**: ${analysis.framework}`,
    `- **Package Manager**: ${analysis.packageManager}`,
    `- **Backend**: ${analysis.backendType}`,
    analysis.hasDocker ? "- **Container**: Docker" : "",
    "",
    "## Getting Started",
    "",
    "### Prerequisites",
    "",
    "- Node.js 18+",
    `- ${analysis.packageManager}`,
    analysis.hasDocker ? "- Docker" : "",
    "",
    "### Installation",
    "",
    "```bash",
    installCommand,
    "```",
    "",
    "### Development",
    "",
    "```bash",
    devCommand,
    "```",
    "",
    "### Build",
    "",
    "```bash",
    buildCommand,
    "```",
    "",
    "### Production",
    "",
    "```bash",
    startCommand,
    "```",
    "",
    "## Environment Variables",
    "",
    "Copy `.env.example` to `.env.local` and fill in the required values:",
    "",
    analysis.envVarsDetected.length > 0
      ? `\`\`\`\n${analysis.envVarsDetected.map((v) => `${v}=value`).join("\n")}\n\`\`\``
      : "```\n# Add your environment variables here\n```",
    "",
    "## Deployment",
    "",
    "### Vercel",
    "",
    "This project is optimized for deployment on Vercel:",
    "",
    "1. Push your code to GitHub",
    "2. Import the repository to Vercel",
    "3. Vercel will automatically detect the framework and build settings",
    "4. Deploy!",
    "",
    "[Learn more about deploying to Vercel](https://vercel.com/docs)",
    "",
    "## Contributing",
    "",
    "Contributions are welcome! Please feel free to submit a Pull Request.",
    "",
    "## License",
    "",
    "This project is open source and available under the MIT License.",
    "",
    "## Support",
    "",
    "If you have any questions or issues, please open an issue on GitHub.",
  ];

  return sections.filter((s) => s !== "").join("\n");
}
