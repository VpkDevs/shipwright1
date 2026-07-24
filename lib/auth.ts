import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { createLogger } from "@/lib/logger";

const isDev = process.env.NODE_ENV === "development" && process.env.DEV_MODE === "true";
const logger = createLogger({ module: "auth" });

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
      authorization: {
        params: {
          scope: "repo user",
        },
      },
    }),
    ...(isDev
      ? [
          CredentialsProvider({
            name: "Dev Mode",
            credentials: {
              token: { label: "Token", type: "password" },
            },
            async authorize(credentials) {
              if (credentials?.token === "dev-mode-active") {
                return {
                  id: "dev-user",
                  name: "Dev User",
                  email: "dev@shipwright.local",
                  image: null,
                };
              }
              return null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        token.profile = profile;
        token.userId = String((profile as { id?: number | string }).id || "");
      }
      if (user?.id && !token.userId) {
        token.userId = String(user.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.accessToken =
          token.accessToken || (isDev ? process.env.DEV_GITHUB_TOKEN : undefined);
        session.user.id = token.userId || undefined;
      }
      return session;
    },
    async signIn({ account, user, profile }) {
      // Allow dev mode users (they have an id but no profile)
      if (user?.id === "dev-user") {
        return isDev;
      }
      // Require account and profile for GitHub OAuth
      if (!account || !profile) {
        logger.error("Sign-in callback missing account or profile", {
          accountPresent: !!account,
          profilePresent: !!profile,
        });
        return false;
      }
      return true;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      logger.info("User signed in", { userId: user?.id, provider: account?.provider, isNewUser });
    },
  },
  pages: {
    signIn: "/",
  },
};
