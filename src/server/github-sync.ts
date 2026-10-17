import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CONFIG_PATH = path.resolve(process.cwd(), ".github-sync.json");
const DEFAULT_REPO = "ffarukakyuz/kotoptan";
const DEFAULT_BRANCH = "main";

export interface GitHubConfig {
  token?: string;
  repo: string;
  branch: string;
  lastSyncedAt?: string;
  lastCommitHash?: string;
  lastCommitMessage?: string;
}

export function loadGitHubConfig(): GitHubConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[github-sync] Error reading config:", err);
  }
  return {
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
    token: process.env["GITHUB_TOKEN"] || process.env["GITHUB_PAT"] || "",
  };
}

export function saveGitHubConfig(cfg: Partial<GitHubConfig>): GitHubConfig {
  const current = loadGitHubConfig();
  const updated: GitHubConfig = {
    ...current,
    ...cfg,
    repo: cfg.repo || current.repo || DEFAULT_REPO,
    branch: cfg.branch || current.branch || DEFAULT_BRANCH,
  };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.warn("[github-sync] Error saving config:", err);
  }
  return updated;
}

function runCommand(
  cmd: string,
  cwd: string = process.cwd(),
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    exec(
      cmd,
      {
        cwd,
        maxBuffer: 1024 * 1024 * 5,
        timeout: 12000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout || "",
          stderr: stderr || "",
          code: error?.code ?? (error ? 1 : 0),
        });
      },
    );
  });
}

export async function getGitStatus(): Promise<{
  ok: boolean;
  branch: string;
  repo: string;
  hasToken: boolean;
  uncommittedChanges: number;
  lastCommit?: { hash: string; message: string; date: string };
  lastSyncedAt?: string;
}> {
  const config = loadGitHubConfig();

  // Branch
  const branchRes = await runCommand("git branch --show-current");
  const branch = branchRes.stdout.trim() || config.branch || DEFAULT_BRANCH;

  // Uncommitted changes
  const statusRes = await runCommand("git status --porcelain");
  const lines = statusRes.stdout.split("\n").filter((l) => l.trim().length > 0);
  const uncommittedChanges = lines.length;

  // Last commit
  const logRes = await runCommand('git log -1 --pretty=format:"%h|%s|%cd" --date=iso');
  let lastCommit: { hash: string; message: string; date: string } | undefined;
  if (logRes.code === 0 && logRes.stdout.includes("|")) {
    const [hash, message, date] = logRes.stdout.split("|");
    lastCommit = {
      hash: hash || "",
      message: message || "",
      date: date || "",
    };
  }

  return {
    ok: true,
    branch,
    repo: config.repo || DEFAULT_REPO,
    hasToken: Boolean(config.token && config.token.trim().length > 5),
    uncommittedChanges,
    lastCommit,
    lastSyncedAt: config.lastSyncedAt,
  };
}

export async function verifyGitHubToken(
  token: string,
  repo: string = DEFAULT_REPO,
): Promise<{
  ok: boolean;
  error?: string;
  user?: string;
  repoName?: string;
}> {
  if (!token || !token.trim()) {
    return { ok: false, error: "GitHub Personal Access Token belirtilmedi." };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Kotoptan-Sync-Bot",
      },
    });

    if (res.ok) {
      const data = (await res.json()) as { full_name?: string; owner?: { login?: string } };
      return {
        ok: true,
        user: data.owner?.login,
        repoName: data.full_name,
      };
    }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "GitHub Token geçersiz veya 'repo' yetkisi eksik (401/403)." };
    }

    return { ok: false, error: `GitHub API hatası (HTTP ${res.status}).` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Bağlantı hatası" };
  }
}

export async function performGitSync(options: {
  commitMessage: string;
  token?: string;
  branch?: string;
  authorName?: string;
  authorEmail?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products?: any[];
  permanentlyDeleted?: { deletedIds: string[]; deletedNames?: string[] };
}): Promise<{
  ok: boolean;
  error?: string;
  commitHash?: string;
  localCommitted?: boolean;
  logs: string[];
  lastSyncedAt: string;
}> {
  const logs: string[] = [];
  const config = loadGitHubConfig();
  const token = (options.token || config.token || "").trim();
  const branch = (options.branch || config.branch || DEFAULT_BRANCH).trim();
  const repo = config.repo || DEFAULT_REPO;
  const commitMsg = (options.commitMessage || "Kotoptan sistem ve katalog güncellemesi").trim();

  if (options.token && options.token.trim()) {
    saveGitHubConfig({ token: options.token.trim() });
  }

  // 0. Ürünler veya silinenler gönderildiyse önce disk dosyalarını güncelle
  if (Array.isArray(options.products) && options.products.length > 0) {
    try {
      const productsPath = path.resolve(process.cwd(), "src/data/products.ts");
      const serialized = JSON.stringify(options.products, null, 2);
      const source = `import type { Product } from "@/lib/catalog";\n\n/**\n * Canlı siteden ve Yönetim Panelinden senkronize edilmiş ürün kataloğu.\n * Toplam ürün sayısı: ${options.products.length}\n * Senkronizasyon tarihi: ${new Date().toISOString()}\n */\nexport const FALLBACK_PRODUCTS: Product[] = ${serialized};\n`;
      fs.writeFileSync(productsPath, source, "utf-8");
      logs.push(`✅ src/data/products.ts dosyası ${options.products.length} ürün ile güncellendi.`);
    } catch (fsErr) {
      console.warn("Ürünler dosya yazma uyarısı:", fsErr);
      logs.push(`⚠️ Ürünler dosyası güncellenirken uyarı oluştu.`);
    }
  }

  if (options.permanentlyDeleted) {
    try {
      const delPath = path.resolve(process.cwd(), "src/data/permanently-deleted.json");
      fs.writeFileSync(delPath, JSON.stringify(options.permanentlyDeleted, null, 2), "utf-8");
      logs.push(`✅ src/data/permanently-deleted.json dosyası güncellendi.`);
    } catch (fsErr) {
      console.warn("Silinenler dosya yazma uyarısı:", fsErr);
    }
  }

  logs.push(`🔍 Git durumu kontrol ediliyor (Dal: ${branch}, Depo: ${repo})...`);

  // 1. Ensure git repo initialized
  if (!fs.existsSync(path.resolve(process.cwd(), ".git"))) {
    logs.push("⚙️ Git deposu ilklendiriliyor...");
    await runCommand("git init");
    await runCommand(`git branch -M ${branch}`);
  }

  // 2. Configure author
  const authorName = options.authorName || "Faruk Akyuz";
  const authorEmail = options.authorEmail || "ffarukakyuz@gmail.com";
  await runCommand(`git config user.name "${authorName}"`);
  await runCommand(`git config user.email "${authorEmail}"`);

  // 3. Configure remote
  let remoteTarget = `https://github.com/${repo}.git`;
  if (token) {
    remoteTarget = `https://${encodeURIComponent(token)}@github.com/${repo}.git`;
  }

  await runCommand("git remote remove origin");
  const remoteAdd = await runCommand(`git remote add origin ${remoteTarget}`);
  if (remoteAdd.code !== 0 && remoteAdd.stderr) {
    logs.push(`⚠️ Remote ayar notu: ${remoteAdd.stderr.trim()}`);
  }

  // Ensure current branch is correct
  await runCommand(`git branch -M ${branch}`);

  // 4. Git add
  logs.push("📦 Değişiklikler sahneleniyor (git add -A)...");
  const addRes = await runCommand("git add -A");
  if (addRes.stderr) {
    logs.push(`ℹ️ git add: ${addRes.stderr.trim()}`);
  }

  // 5. Git status to check if anything to commit
  const statusRes = await runCommand("git status --porcelain");
  let commitHash = "";

  if (statusRes.stdout.trim().length > 0) {
    logs.push(`📝 Yeni commit oluşturuluyor: "${commitMsg}"...`);
    const safeMsg = commitMsg.replace(/"/g, '\\"');
    const commitRes = await runCommand(`git commit -m "${safeMsg}"`);
    logs.push(commitRes.stdout.trim() || commitRes.stderr.trim());

    // Get commit hash
    const hashRes = await runCommand("git rev-parse --short HEAD");
    commitHash = hashRes.stdout.trim();
  } else {
    logs.push(
      "ℹ️ Çalışma dizininde yeni taahhüt edilecek değişiklik bulunmuyor, mevcut dal hazır.",
    );
    const hashRes = await runCommand("git rev-parse --short HEAD");
    commitHash = hashRes.stdout.trim();
  }

  // 6. Git push
  if (!token) {
    logs.push(
      "💾 Kodlar ve katalog dosyaları yerel Git deposuna başarıyla kaydedildi ve commit edildi.",
    );
    logs.push(
      "ℹ️ GitHub uzak deposuna doğrudan push için lütfen Token girin veya depoya erişim izni tanımlayın.",
    );
    const now = new Date().toISOString();
    saveGitHubConfig({
      lastSyncedAt: now,
      lastCommitHash: commitHash,
      lastCommitMessage: commitMsg,
    });
    return {
      ok: true,
      localCommitted: true,
      commitHash,
      logs,
      lastSyncedAt: now,
    };
  }

  logs.push(`🚀 GitHub deposuna push ediliyor (origin ${branch})...`);
  const pushRes = await runCommand(`git push -u origin ${branch}`);

  if (pushRes.code !== 0) {
    const errText = pushRes.stderr || pushRes.stdout || "Bilinmeyen push hatası";
    logs.push(`❌ Push hatası: ${errText.trim()}`);

    // If remote contains work that we do not have locally, try pull --rebase or explain
    if (errText.includes("fetch first") || errText.includes("non-fast-forward")) {
      logs.push("🔄 Uzak depodaki güncellemeler alınıyor (git pull --rebase)...");
      const pullRes = await runCommand(`git pull origin ${branch} --rebase`);
      logs.push(pullRes.stdout.trim() || pullRes.stderr.trim());
      if (pullRes.code === 0) {
        logs.push("🚀 Tekrar push ediliyor...");
        const retryPush = await runCommand(`git push origin ${branch}`);
        if (retryPush.code === 0) {
          logs.push("✅ Push başarıyla tamamlandı!");
          const now = new Date().toISOString();
          saveGitHubConfig({
            lastSyncedAt: now,
            lastCommitHash: commitHash,
            lastCommitMessage: commitMsg,
          });
          return {
            ok: true,
            commitHash,
            logs,
            lastSyncedAt: now,
          };
        }
      }
    }

    return {
      ok: false,
      error: errText.trim(),
      commitHash,
      logs,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  logs.push("✅ GitHub deposuna başarıyla push edildi!");
  const now = new Date().toISOString();
  saveGitHubConfig({ lastSyncedAt: now, lastCommitHash: commitHash, lastCommitMessage: commitMsg });

  return {
    ok: true,
    commitHash,
    logs,
    lastSyncedAt: now,
  };
}
