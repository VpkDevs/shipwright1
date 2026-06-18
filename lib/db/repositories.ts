import { and, eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { getDb } from "@/lib/db";
import { repositories, users } from "@/lib/db/schema";

type SessionUser = NonNullable<Session["user"]>;

interface RepositoryRecordInput {
  sessionUser: SessionUser;
  githubRepoId: string;
  owner: string;
  name: string;
  framework?: string | null;
  riskScore?: number | null;
}

export interface RepositoryRecord {
  id: string;
  githubRepoId: string;
  owner: string;
  name: string;
  framework: string | null;
  riskScore: number | null;
}

export async function ensureUserRecord(sessionUser: SessionUser): Promise<string | null> {
  const githubId = sessionUser.id;
  if (!githubId) {
    return null;
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.github_id, githubId))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        github_username: getGithubUsername(sessionUser, githubId),
        email: sessionUser.email ?? null,
        avatar_url: sessionUser.image ?? null,
      })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  try {
    const [created] = await db
      .insert(users)
      .values({
        github_id: githubId,
        github_username: getGithubUsername(sessionUser, githubId),
        email: sessionUser.email ?? null,
        avatar_url: sessionUser.image ?? null,
      })
      .returning({ id: users.id });

    return created?.id ?? null;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const [createdByConcurrentRequest] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.github_id, githubId))
      .limit(1);

    return createdByConcurrentRequest?.id ?? null;
  }
}

export async function upsertRepositoryRecord(input: RepositoryRecordInput): Promise<string | null> {
  const userId = await ensureUserRecord(input.sessionUser);
  if (!userId) {
    return null;
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(
      and(eq(repositories.user_id, userId), eq(repositories.github_repo_id, input.githubRepoId))
    )
    .limit(1);

  const values = {
    owner: input.owner,
    name: input.name,
    framework: input.framework ?? null,
    risk_score: input.riskScore ?? null,
    last_analyzed_at: new Date(),
  };

  if (existing) {
    await db.update(repositories).set(values).where(eq(repositories.id, existing.id));
    return existing.id;
  }

  try {
    const [created] = await db
      .insert(repositories)
      .values({
        user_id: userId,
        github_repo_id: input.githubRepoId,
        ...values,
      })
      .returning({ id: repositories.id });

    return created?.id ?? null;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const [createdByConcurrentRequest] = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(
        and(eq(repositories.user_id, userId), eq(repositories.github_repo_id, input.githubRepoId))
      )
      .limit(1);

    return createdByConcurrentRequest?.id ?? null;
  }
}

export async function getRepositoryRecordForSession(
  sessionUser: SessionUser,
  githubRepoId: string
): Promise<RepositoryRecord | null> {
  const userId = await ensureUserRecord(sessionUser);
  if (!userId) {
    return null;
  }

  const db = getDb();
  const [repo] = await db
    .select({
      id: repositories.id,
      githubRepoId: repositories.github_repo_id,
      owner: repositories.owner,
      name: repositories.name,
      framework: repositories.framework,
      riskScore: repositories.risk_score,
    })
    .from(repositories)
    .where(and(eq(repositories.user_id, userId), eq(repositories.github_repo_id, githubRepoId)))
    .limit(1);

  return repo ?? null;
}

function getGithubUsername(sessionUser: SessionUser, githubId: string): string {
  return sessionUser.name?.trim() || sessionUser.email?.split("@")[0] || `github-${githubId}`;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = (error as { code?: string; cause?: { code?: string } }).code;
  const causeCode = (error as { cause?: { code?: string } }).cause?.code;
  return code === "23505" || causeCode === "23505";
}
