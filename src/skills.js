/**
 * Preset-scoped skill provider for dsh-mimo-compose.
 *
 * Registers a `ctx.skills` provider into the layer of whichever context mounts
 * this row. Mounted inside the `mimo-compose` agent preset it contributes the
 * packaged `skills/` directory to that preset's scope only, so the compose
 * workflow never leaks into other modes' skill catalogs.
 *
 * Deliberately dependency-free: the profile's node_modules does not expose
 * `@deepseek-ai/*` helper packages, so frontmatter is parsed here for the
 * scalar keys this bundle itself authors.
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name. */
export const name = 'mimo-compose-skills'

/** The skill registry this row contributes to. */
export const inject = ['skills']

/** Provider name shown in skill metadata. */
const PROVIDER = 'mimo-compose'

/** Packaged skills root. */
const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')

/** Rank shared with packaged/bundled skill providers. */
const RANK = 600

/** Both surfaces on: the model may load it, and the user may invoke it. */
const INVOCATION = { modelInvocable: true, userInvocable: true }

/**
 * Read the scalar frontmatter keys this bundle authors.
 * @param {string} raw - full SKILL.md text.
 * @returns {Record<string, string>} parsed key/value pairs (empty when absent).
 */
function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (match === null) return {}
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (kv === null) continue
    let value = kv[2].trim()
    if (value.length >= 2) {
      const first = value[0]
      const last = value[value.length - 1]
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) value = value.slice(1, -1)
    }
    data[kv[1]] = value
  }
  return data
}

/**
 * Strip the frontmatter block, leaving the instruction body.
 * @param {string} raw - full SKILL.md text.
 * @returns {string} trimmed body.
 */
function bodyOf(raw) {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
}

/**
 * Register the packaged skills root for this plugin's scope.
 * @param {import('@deepseek-ai/cordis').Context} ctx - mounting context.
 */
export function apply(ctx) {
  ctx.skills.registerProvider(() => ({
    name: PROVIDER,
    async list() {
      const entries = await readdir(SKILLS_DIR, { withFileTypes: true })
      const candidates = []
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const directory = join(SKILLS_DIR, entry.name)
        const file = join(directory, 'SKILL.md')
        let raw
        try {
          raw = await readFile(file, 'utf8')
        } catch {
          continue
        }
        const data = parseFrontmatter(raw)
        if (data.name === undefined || data.description === undefined) continue
        candidates.push({
          name: data.name,
          description: data.description,
          ...(data.whenToUse === undefined ? {} : { whenToUse: data.whenToUse }),
          invocation: INVOCATION,
          provider: PROVIDER,
          source: 'bundled',
          rank: RANK,
          locator: file,
          resourceBase: { kind: 'directory', path: directory },
          path: file,
        })
      }
      return candidates
    },
    async get(candidate) {
      const raw = await readFile(candidate.locator, 'utf8')
      const data = parseFrontmatter(raw)
      if (data.name === undefined || data.description === undefined) return undefined
      return {
        name: data.name,
        description: data.description,
        ...(data.whenToUse === undefined ? {} : { whenToUse: data.whenToUse }),
        invocation: INVOCATION,
        provider: PROVIDER,
        source: 'bundled',
        resourceBase: candidate.resourceBase,
        path: candidate.path,
        content: bodyOf(raw),
      }
    },
  }))
}
