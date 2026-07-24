import { ZodError } from "zod";
import { AppError, RateLimitError } from "./errors";
import { log } from "./logger";

export function withErrorHandler(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof AppError) {
        log.warn(
          { error: error.internalMessage, statusCode: error.statusCode },
          "Application error"
        );

        const responseBody: Record<string, unknown> = {
          error: error.userMessage,
        };

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (error instanceof RateLimitError) {
          headers["Retry-After"] = String(error.retryAfter);
          responseBody.retryAfter = error.retryAfter;
        }

        return new Response(JSON.stringify(responseBody), {
          status: error.statusCode,
          headers,
        });
      }

      if (error instanceof ZodError) {
        log.warn({ issues: error.issues }, "Request validation failed");
        return new Response(JSON.stringify({ error: "Invalid request parameters" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      log.error({ error }, "Unknown error");
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
