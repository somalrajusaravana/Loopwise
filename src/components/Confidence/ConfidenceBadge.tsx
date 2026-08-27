import type { ConfidenceState } from '../../types'
import {
  CONFIDENCE_LABELS,
  CONFIDENCE_COLORS,
  CONFIDENCE_ICONS,
} from '../../services/confidence-engine'

interface Props {
  state: ConfidenceState
  showLabel?: boolean
}

export default function ConfidenceBadge({ state, showLabel = true }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${CONFIDENCE_COLORS[state]}`}
    >
      <span>{CONFIDENCE_ICONS[state]}</span>
      {showLabel && CONFIDENCE_LABELS[state]}
    </span>
  )
}
