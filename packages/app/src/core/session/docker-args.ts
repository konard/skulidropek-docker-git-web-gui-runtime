// CHANGE: pure builder for `docker run` argv
// WHY: keeps the shell minimal; all flag policy lives here and is easy to test
// QUOTE(TZ): "--cap-drop=ALL / --security-opt=no-new-privileges / --memory=2g / --cpus=2 / --pids-limit=512 / --shm-size=1g"
// REF: issue#1 sections 7, 11.1
// PURITY: CORE
// INVARIANT: argv contains all required isolation flags (no --privileged, no host X11 mount)
// COMPLEXITY: O(|labels|+|env|)/O(|labels|+|env|)
import type { Session } from "./types.js"

type ReadonlyRecord<K extends string, V> = { readonly [P in K]: V }

const CONTAINER_NOVNC_PORT = 6080
const PIDS_LIMIT = 512

/**
 * Compose the argv for `docker run -d ...` that starts a session container.
 *
 * @param session - validated session record
 * @param hostPort - host-side TCP port that maps to the container's fixed noVNC port
 * @param labels - extra docker labels (e.g. owner)
 * @returns argv excluding the leading "docker" command name
 *
 * @invariant returned argv contains "--cap-drop", "ALL" and never "--privileged"
 * @complexity O(|labels|)
 */
export const buildDockerRunArgs = (
  session: Session,
  hostPort: number,
  labels: ReadonlyRecord<string, string>
): ReadonlyArray<string> => [
  "run",
  "-d",
  "--name",
  `webx11-${session.id}`,
  "-p",
  `${hostPort}:${CONTAINER_NOVNC_PORT}`,
  "-e",
  `SCREEN_WIDTH=${session.resolution.width}`,
  "-e",
  `SCREEN_HEIGHT=${session.resolution.height}`,
  "-e",
  `SCREEN_DEPTH=${session.resolution.depth}`,
  "-e",
  `NOVNC_PORT=${CONTAINER_NOVNC_PORT}`,
  "-e",
  `START_APP=${session.app}`,
  "--shm-size",
  `${session.resources.shmMb}m`,
  "--memory",
  `${session.resources.memoryMb}m`,
  "--cpus",
  `${session.resources.cpus}`,
  "--pids-limit",
  `${PIDS_LIMIT}`,
  "--cap-drop",
  "ALL",
  "--security-opt",
  "no-new-privileges:true",
  ...formatLabels(session, labels),
  session.image
]

const formatLabels = (
  session: Session,
  extra: ReadonlyRecord<string, string>
): ReadonlyArray<string> => {
  const builtin: ReadonlyRecord<string, string> = {
    "webx11.session_id": session.id,
    "webx11.created_at": session.createdAt.toISOString(),
    "webx11.expires_at": session.expiresAt.toISOString(),
    "webx11.container_novnc_port": `${CONTAINER_NOVNC_PORT}`,
    "webx11.host_novnc_port": `${session.novncPort}`,
    "webx11.status": session.status.toLowerCase()
  }
  return [
    ...flattenLabel(builtin),
    ...flattenLabel(extra)
  ]
}

const flattenLabel = (
  rec: ReadonlyRecord<string, string>
): ReadonlyArray<string> => Object.entries(rec).flatMap(([k, v]) => ["--label", `${k}=${v}`])
