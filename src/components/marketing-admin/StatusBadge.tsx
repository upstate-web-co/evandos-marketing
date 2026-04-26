import { STATUS_STYLES } from '../../lib/constants'

interface Props {
  status: string
  className?: string
}

export default function StatusBadge({ status, className = '' }: Props) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[status] ?? STATUS_STYLES.draft} ${className}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
