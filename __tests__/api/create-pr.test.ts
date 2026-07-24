import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  checkRateLimit: vi.fn(),
  createBranch: vi.fn(),
  createOrUpdateFile: vi.fn(),
  createPullRequest: vi.fn(),
  getDefaultBranch: vi.fn(),
  upsertRepositoryRecord: vi.fn(),
  insertValues: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/github", () => ({
  GitHubClient: vi.fn(function GitHubClientMock() {
    return {
      createBranch: mocks.createBranch,
      createOrUpdateFile: mocks.createOrUpdateFile,
      createPullRequest: mocks.createPullRequest,
      getDefaultBranch: mocks.getDefaultBranch,
    };
  }),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
  }),
}));

vi.mock("@/lib/db/repositories", () => ({
  upsertRepositoryRecord: mocks.upsertRepositoryRecord,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: mocks.warn,
    error: mocks.error,
    debug: vi.fn(),
  }),
  log: {
    warn: mocks.warn,
    error: mocks.error,
  },
}));

const { POST } = await import("@/app/api/create-pr/route");

const session = {
  user: {
    id: "12345",
    email: "builder@example.com",
    name: "Builder",
    accessToken: "gho_test",
  },
};

function request(body: unknown) {
  return new Request("http://localhost/api/create-pr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/create-pr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(session);
    mocks.checkRateLimit.mockResolvedValue({ success: true });
    mocks.getDefaultBranch.mockResolvedValue("main");
    mocks.createBranch.mockResolvedValue(true);
    mocks.createOrUpdateFile.mockResolvedValue(true);
    mocks.createPullRequest.mockResolvedValue({
      number: 12,
      html_url: "https://github.com/vpkdevs/shipwright/pull/12",
      title: "Shipwright: Add deployment readiness plan",
    });
    mocks.upsertRepositoryRecord.mockResolvedValue("repo-uuid");
    mocks.insertValues.mockResolvedValue(undefined);
  });

  it("stores pull request history with the internal repository UUID", async () => {
    const response = await POST(
      request({
        owner: "vpkdevs",
        repo: "shipwright",
        repoId: "987654321",
        files: [{ path: "vercel.json", content: "{}" }],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.url).toBe("https://github.com/vpkdevs/shipwright/pull/12");
    expect(mocks.upsertRepositoryRecord).toHaveBeenCalledWith({
      sessionUser: session.user,
      githubRepoId: "987654321",
      owner: "vpkdevs",
      name: "shipwright",
    });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        repo_id: "repo-uuid",
        pr_number: 12,
        pr_url: "https://github.com/vpkdevs/shipwright/pull/12",
        generated_files: ["vercel.json"],
      })
    );
  });

  it("rejects empty generated file lists before calling GitHub", async () => {
    const response = await POST(
      request({
        owner: "vpkdevs",
        repo: "shipwright",
        files: [],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid request parameters");
    expect(mocks.createBranch).not.toHaveBeenCalled();
  });
});
