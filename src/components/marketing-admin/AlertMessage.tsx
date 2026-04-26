interface Props {
  message: { type: 'success' | 'error'; text: string } | null
}

export default function AlertMessage({ message }: Props) {
  if (!message) return null

  return (
    <div
      role="alert"
      className={`px-4 py-2 rounded-lg text-sm ${
        message.type === 'success' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
      }`}
    >
      {message.text}
    </div>
  )
}
