"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface Repo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  language: string | null;
  stargazers_count: number;
}

export default function ReposPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await fetch("/api/repos");
        if (!res.ok) {
          router.push("/");
          return;
        }
        const data = await res.json();
        setRepos(data);
      } catch (err) {
        setError("Failed to load repositories");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepos();
  }, [router]);

  const filteredRepos = useMemo(() => {
    return repos.filter((repo) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        repo.name.toLowerCase().includes(q) ||
        (repo.description?.toLowerCase().includes(q) ?? false) ||
        (repo.language?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [repos, search]);

  const languages = new Set(repos.map((repo) => repo.language).filter(Boolean)).size;

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <ReposNav />
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="work-surface p-5">
            <p className="section-label mb-2">Repository queue</p>
            <p className="text-muted">Loading GitHub repositories...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <ReposNav />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="section-label mb-3">Repository queue</p>
            <h1 className="mb-3 text-4xl font-semibold">Choose a repo to diagnose.</h1>
            <p className="text-muted max-w-2xl">
              Shipwright will inspect the selected project and produce deployment blockers,
              warnings, generated files, and a PR-ready plan.
            </p>
          </div>

          <div className="work-surface grid grid-cols-3 divide-x divide-[color:var(--line)]">
            <Metric label="Repos" value={String(repos.length)} />
            <Metric label="Shown" value={String(filteredRepos.length)} />
            <Metric label="Langs" value={String(languages)} />
          </div>
        </div>

        <div className="mb-5">
          <label htmlFor="repo-search" className="section-label mb-2 block">
            Filter
          </label>
          <input
            id="repo-search"
            type="text"
            placeholder="Name, description, or language"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
          />
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-[color:var(--blocker)] bg-red-50 p-4 text-sm text-[color:var(--blocker)]">
            {error}
          </div>
        )}

        {filteredRepos.length === 0 ? (
          <div className="work-surface p-8">
            <p className="font-semibold">
              {repos.length === 0 ? "No repositories found" : `No repositories match "${search}"`}
            </p>
            <p className="text-muted mt-1 text-sm">
              {repos.length === 0
                ? "GitHub returned no repositories for this account."
                : "Clear the filter or search for a different repository signal."}
            </p>
          </div>
        ) : (
          <div className="work-surface divide-y divide-[color:var(--line)]">
            {filteredRepos.map((repo) => (
              <Link
                key={repo.id}
                href={`/repos/${repo.full_name}?repoId=${repo.id}`}
                className="grid gap-4 p-5 transition-colors hover:bg-[color:rgb(36_81_90_/_0.06)] md:grid-cols-[1fr_220px_48px]"
              >
                <div>
                  <h2 className="text-lg font-semibold">{repo.name}</h2>
                  <p className="text-muted mt-1 line-clamp-2 text-sm">
                    {repo.description || "No repository description."}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2 text-sm md:justify-end">
                  {repo.language && (
                    <span className="rounded-md border border-[color:var(--line)] px-2 py-1">
                      {repo.language}
                    </span>
                  )}
                  <span className="rounded-md border border-[color:var(--line)] px-2 py-1">
                    {repo.stargazers_count} stars
                  </span>
                </div>
                <div className="hidden items-center justify-end text-sm font-semibold md:flex">
                  Open
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ReposNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[color:rgb(244_243_238_/_0.9)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold">
          Shipwright
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/pricing" className="btn-secondary">
            Pricing
          </Link>
          <a href="/api/auth/signout" className="btn-secondary">
            Sign out
          </a>
        </div>
      </div>
    </nav>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4">
      <p className="section-label mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
