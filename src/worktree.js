/**
 * Git worktree tools for the `mimo-compose` agent preset.
 *
 * MiMoCode ships an equivalent feature as a native service; DSH has no such
 * capability, so the compose workflow had no way to isolate a task on its own
 * branch. These tools create/remove linked worktrees under `<repo>/.worktrees/`
 * — always inside the repository, so the file sandbox keeps applying — and
 * report the base/head SHAs a reviewer needs.
 *
 * The repository is the session workspace by default, but `repo` lets a session
 * whose workspace is not itself a git repository target one of its
 * subdirectories, so every session can keep sharing one DSH workspace.
 *
 * Tool definitions are written as raw JSON Schema on purpose: the profile's
 * node_modules does not expose `@deepseek-ai/dsh-tools`, so `defineTool` from
 * that package cannot be imported here.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

/** Cordis plugin name. */
export const name = 'mimo-compose-worktree'

/** The tool registry this row contributes to. */
export const inject = ['tools']

/** Directory (relative to the repository) that owns every linked worktree. */
const WORKTREES_DIRNAME = '.worktrees'

/** Branch prefix, mirroring upstream MiMoCode's `mimocode/<name>` convention. */
const BRANCH_PREFIX = 'mimo/'

/** Name grammar shared with branch names: lowercase, digits, single hyphens. */
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/

/** Shared parameter description for the optional repository selector. */
const REPO_DESCRIPTION =
  'Repository to operate on: absolute, or relative to the session workspace. Defaults to the session workspace itself, which must be a git repository.'

/**
 * Run one git command without a shell.
 * @param {string} cwd - directory to run in.
 * @param {string[]} args - git arguments.
 * @returns {{ code: number, stdout: string, stderr: string }} captured result.
 */
function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
  return {
    code: result.status ?? 1,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  }
}

/**
 * Resolve the calling session's workspace root.
 * @param {object} exec - tool execution context.
 * @returns {string} absolute workspace path.
 */
function workspaceOf(exec) {
  const cwd = exec?.agent?.session?.header?.cwd
  if (typeof cwd !== 'string' || cwd.length === 0) {
    throw new Error('worktree tools require a session workspace (no session header cwd)')
  }
  return cwd
}

/**
 * Compare two paths for identity, tolerating Windows case differences.
 * @param {string} left - first path.
 * @param {string} right - second path.
 * @returns {boolean} whether both name the same directory.
 */
function samePath(left, right) {
  const normalize = (value) => (process.platform === 'win32' ? resolve(value).toLowerCase() : resolve(value))
  return normalize(left) === normalize(right)
}

/**
 * Resolve the git repository the tools operate on and prove it is one.
 *
 * The default is the session workspace. A session workspace that is not a
 * repository (for example a shared DSH workspace holding several checkouts) is
 * not an error by itself: the caller names the repository explicitly.
 * @param {object} exec - tool execution context.
 * @param {unknown} requested - the optional `repo` argument.
 * @returns {string} absolute repository root.
 */
function repoOf(exec, requested) {
  const workspace = workspaceOf(exec)
  if (requested !== undefined && typeof requested !== 'string') throw new Error('repo must be a string path')
  const target = requested === undefined || requested.length === 0 ? workspace : resolve(workspace, requested)

  const top = git(target, ['rev-parse', '--show-toplevel'])
  if (top.code !== 0 || top.stdout.length === 0) {
    throw new Error(
      requested === undefined
        ? `the session workspace ${workspace} is not a git repository; pass repo with the checkout to work in`
        : `${target} is not a git repository: ${top.stderr || top.stdout}`,
    )
  }
  if (!samePath(top.stdout, target)) {
    throw new Error(`${target} is inside the repository ${top.stdout}; pass that repository root instead`)
  }
  return target
}

/**
 * Validate and normalize a worktree name.
 * @param {unknown} raw - model-supplied name.
 * @returns {string} normalized name.
 */
function normalizedName(raw) {
  if (typeof raw !== 'string' || !NAME_PATTERN.test(raw)) {
    throw new Error('name must be lowercase kebab-case (a-z, 0-9, single hyphens)')
  }
  return raw
}

/**
 * Absolute worktree directory for a name, refusing anything outside `.worktrees`.
 * @param {string} repo - repository root.
 * @param {string} name - validated worktree name.
 * @returns {string} absolute directory path.
 */
function worktreeDir(repo, name) {
  const base = join(repo, WORKTREES_DIRNAME)
  const directory = join(base, name)
  if (!directory.startsWith(`${base}${sep}`)) throw new Error('worktree path escapes the worktree directory')
  return directory
}

/**
 * Pick the base commit a new worktree branches from.
 * @param {string} repo - repository root.
 * @param {string | undefined} requested - explicit base ref from the caller.
 * @returns {string} a git ref that exists.
 */
function resolveBase(repo, requested) {
  const candidates =
    requested === undefined ? ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master', 'HEAD'] : [requested]
  for (const candidate of candidates) {
    const probe = git(repo, ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`])
    if (probe.code === 0) return candidate
  }
  throw new Error(`cannot resolve a base commit (tried ${candidates.join(', ')})`)
}

/**
 * Register the worktree tools.
 * @param {import('@deepseek-ai/cordis').Context} ctx - mounting context.
 */
export function apply(ctx) {
  ctx.tools.register({
    name: 'worktree_create',
    description:
      'Create a linked git worktree for one isolated task, on its own branch. Use it before implementing so parallel work and review diffs never collide. Returns the worktree directory, branch, and base commit.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Kebab-case slug for the worktree and branch. Defaults to a short generated slug.',
        },
        base: {
          type: 'string',
          description: 'Base ref to branch from. Defaults to the remote mainline, then the local mainline, then HEAD.',
        },
        repo: { type: 'string', description: REPO_DESCRIPTION },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'branch', 'directory', 'base', 'repo'],
        properties: {
          name: { type: 'string' },
          branch: { type: 'string' },
          directory: { type: 'string' },
          base: { type: 'string' },
          repo: { type: 'string' },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `worktree ${value.name}: branch ${value.branch} from ${value.base} at ${value.directory} (repo ${value.repo})`,
        },
      ],
    },
    async execute(args, exec) {
      const root = repoOf(exec, args.repo)
      const name = args.name === undefined ? `wt-${Date.now().toString(36)}` : normalizedName(args.name)
      const base = resolveBase(root, args.base)
      const directory = worktreeDir(root, name)
      if (existsSync(directory)) throw new Error(`worktree directory already exists: ${directory}`)

      mkdirSync(join(root, WORKTREES_DIRNAME), { recursive: true })
      const ignoreFile = join(root, WORKTREES_DIRNAME, '.gitignore')
      if (!existsSync(ignoreFile)) writeFileSync(ignoreFile, '*\n')

      const branch = `${BRANCH_PREFIX}${name}`
      const created = git(root, ['worktree', 'add', '-b', branch, directory, base])
      if (created.code !== 0) throw new Error(`git worktree add failed: ${created.stderr || created.stdout}`)

      const head = git(directory, ['symbolic-ref', '--quiet', 'HEAD'])
      if (head.code !== 0 || head.stdout !== `refs/heads/${branch}`) {
        throw new Error(`worktree HEAD is not attached to refs/heads/${branch} (got ${head.stdout || 'detached'})`)
      }
      return { name, branch, directory, base, repo: root }
    },
  })

  ctx.tools.register({
    name: 'worktree_list',
    description: 'List the linked worktrees this repository owns (under .worktrees/), with their branch and HEAD commit.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { repo: { type: 'string', description: REPO_DESCRIPTION } },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['worktrees'],
        properties: {
          worktrees: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'branch', 'directory', 'head'],
              properties: {
                name: { type: 'string' },
                branch: { type: 'string' },
                directory: { type: 'string' },
                head: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text:
            value.worktrees.length === 0
              ? 'no linked worktrees'
              : value.worktrees
                  .map((item) => `${item.name}\t${item.branch}\t${item.head.slice(0, 12)}\t${item.directory}`)
                  .join('\n'),
        },
      ],
    },
    async execute(_args, exec) {
      const root = repoOf(exec, _args?.repo)
      const listed = git(root, ['worktree', 'list', '--porcelain'])
      if (listed.code !== 0) throw new Error(`git worktree list failed: ${listed.stderr || listed.stdout}`)

      const worktrees = []
      let current = undefined
      for (const line of listed.stdout.split('\n')) {
        if (line.startsWith('worktree ')) {
          current = { directory: line.slice('worktree '.length).trim() }
          continue
        }
        if (current === undefined) continue
        if (line.startsWith('branch ')) {
          current.branch = line.slice('branch '.length).trim().replace(/^refs\/heads\//, '')
        }
        if (line.startsWith('HEAD ')) current.head = line.slice('HEAD '.length).trim()
        if (line === '') {
          worktrees.push(current)
          current = undefined
        }
      }
      if (current !== undefined) worktrees.push(current)

      // Porcelain output uses forward slashes even on Windows, so membership is
      // decided with path.relative instead of a string prefix comparison.
      const base = resolve(root, WORKTREES_DIRNAME)
      return {
        worktrees: worktrees
          .filter((item) => typeof item.directory === 'string')
          .map((item) => {
            const rel = relative(base, resolve(item.directory))
            const owned = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
            return owned
              ? {
                  name: rel.split(sep).join('/'),
                  branch: item.branch ?? '',
                  directory: item.directory,
                  head: item.head ?? '',
                }
              : undefined
          })
          .filter((item) => item !== undefined),
      }
    },
  })

  ctx.tools.register({
    name: 'worktree_info',
    description:
      'Report the base commit, head commit, and exact diff command for one worktree. Hand these to a reviewer instead of a narrative so it can inspect the change itself.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Worktree name (the .worktrees/ child directory).' },
        repo: { type: 'string', description: REPO_DESCRIPTION },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'branch', 'directory', 'base', 'head', 'diff'],
        properties: {
          name: { type: 'string' },
          branch: { type: 'string' },
          directory: { type: 'string' },
          base: { type: 'string' },
          head: { type: 'string' },
          diff: { type: 'string' },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: [
            `worktree ${value.name} (${value.branch})`,
            `directory: ${value.directory}`,
            `base: ${value.base}`,
            `head: ${value.head}`,
            `diff: ${value.diff}`,
          ].join('\n'),
        },
      ],
    },
    async execute(args, exec) {
      const root = repoOf(exec, args.repo)
      const name = normalizedName(args.name)
      const directory = worktreeDir(root, name)
      if (!existsSync(directory)) throw new Error(`no such worktree: ${directory}`)

      const head = git(directory, ['rev-parse', 'HEAD'])
      if (head.code !== 0) throw new Error(`git rev-parse HEAD failed: ${head.stderr || head.stdout}`)
      const baseRef = git(directory, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
      const baseCandidate = baseRef.code === 0 ? baseRef.stdout : resolveBase(root, undefined)
      const mergeBase = git(directory, ['merge-base', baseCandidate, 'HEAD'])
      const base = mergeBase.code === 0 ? mergeBase.stdout : git(directory, ['rev-parse', baseCandidate]).stdout
      const branch = git(directory, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout

      return {
        name,
        branch,
        directory,
        base,
        head: head.stdout,
        diff: `git -C "${directory}" diff ${base}..${head.stdout}`,
      }
    },
  })

  ctx.tools.register({
    name: 'worktree_remove',
    description:
      'Remove one linked worktree and delete its branch. Only paths under .worktrees/ can be removed; the primary checkout is never touched.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Worktree name to remove.' },
        repo: { type: 'string', description: REPO_DESCRIPTION },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'removed', 'branchDeleted'],
        properties: {
          name: { type: 'string' },
          removed: { type: 'boolean' },
          branchDeleted: { type: 'boolean' },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `removed worktree ${value.name}${value.branchDeleted ? ' and its branch' : ' (branch left in place)'}`,
        },
      ],
    },
    async execute(args, exec) {
      const root = repoOf(exec, args.repo)
      const name = normalizedName(args.name)
      const directory = worktreeDir(root, name)
      if (!existsSync(directory)) throw new Error(`no such worktree: ${directory}`)

      const removed = git(root, ['worktree', 'remove', '--force', directory])
      if (removed.code !== 0) throw new Error(`git worktree remove failed: ${removed.stderr || removed.stdout}`)

      const branch = `${BRANCH_PREFIX}${name}`
      const deleted = git(root, ['branch', '-D', branch])
      return { name, removed: true, branchDeleted: deleted.code === 0 }
    },
  })
}
