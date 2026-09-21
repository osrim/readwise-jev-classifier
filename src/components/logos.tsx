import readwiseFavicon from '@/assets/readwise-favicon.png'
import typesafeFavicon from '@/assets/typesafe-ai-favicon.png'

const SIZE = 'size-5 shrink-0'

export function ReadwiseLogo({ className = '' }: { className?: string }) {
  return <img src={readwiseFavicon} alt="Readwise" className={`${SIZE} rounded-[4px] ${className}`} />
}

export function TypeSafeLogo({ className = '' }: { className?: string }) {
  // The mark is white on transparent, drawn for a dark surface, so the light
  // theme inverts it.
  return (
    <img
      src={typesafeFavicon}
      alt="TypeSafe AI"
      className={`${SIZE} invert dark:invert-0 ${className}`}
    />
  )
}
