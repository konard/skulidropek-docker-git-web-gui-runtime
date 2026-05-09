// CHANGE: pure host-port allocator
// WHY: gateway must map session_id → host port deterministically; allocator stays in CORE
// QUOTE(TZ): "Session Manager знает container_ip:6080 / Gateway проксирует HTTP/WebSocket в нужный container_ip:6080"
// REF: issue#1 section 9.2
// PURITY: CORE
// INVARIANT: allocatePort(used, range) ∉ used ∧ allocatePort(used, range) ∈ range
// COMPLEXITY: O(|range|)/O(|range|)
import { Option } from "effect"

/** Closed numeric port range. */
export interface PortRange {
  readonly min: number
  readonly max: number
}

/**
 * Pick the lowest port from `range` that is not in `used`.
 *
 * @returns Some(port) when available, None when exhausted.
 * @invariant ∀ p: returned(p) → p ∉ used ∧ range.min ≤ p ≤ range.max
 * @complexity O(|range|)
 */
export const allocatePort = (
  used: ReadonlySet<number>,
  range: PortRange
): Option.Option<number> => {
  for (let candidate = range.min; candidate <= range.max; candidate = candidate + 1) {
    if (!used.has(candidate)) return Option.some(0 + candidate)
  }
  return Option.none()
}
