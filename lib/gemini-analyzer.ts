import { GoogleGenerativeAI } from "@google/generative-ai";
import { log } from "./logger";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface AnalysisEnrichment {
  framework: string;
  missingEnvVars: string[];
  readinessSummary: string;
}

export async function enrichAnalysisWithGemini(
  packageJson: unknown,
  fileTree: string,
  readme?: string,
  detectedFramework?: string
): Promise<AnalysisEnrichment | null> {
  try {
    const prompt = `You are a deployment expert. Analyze this repository structure and return JSON.

Package.json dependencies:
\`\`\`json
${JSON.stringify(packageJson ?? {}, null, 2)}
\`\`\`

File tree:
\`\`\`
${fileTree}
\`\`\`

${readme ? `README.md:\n\`\`\`\n${readme.substring(0, 2000)}\n\`\`\`` : "No README found."}

${detectedFramework ? `Heuristic detected framework: ${detectedFramework}` : "No framework detected by heuristics."}

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "framework": "detected framework name or null",
  "missingEnvVars": ["VAR1", "VAR2"],
  "readinessSummary": "one sentence about deployment readiness"
}`;

    const result = (await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timeout")), 5000)),
    ])) as { response: { text: () => string } };

    const content = result.response.text();
    const parsed = JSON.parse(content);

    return {
      framework: parsed.framework || detectedFramework || "unknown",
      missingEnvVars: parsed.missingEnvVars || [],
      readinessSummary: parsed.readinessSummary || "",
    };
  } catch (error) {
    log.warn({ error }, "Gemini analysis enrichment failed, using heuristics");
    return null;
  }
}
