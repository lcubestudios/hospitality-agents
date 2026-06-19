'use client'

import { useEffect, useState } from 'react'

export function StreamingText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [displayedText, setDisplayedText] = useState('')

  useEffect(() => {
    if (!isStreaming) {
      // When not streaming, show full text
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayedText(text)
      return
    }

    // When streaming, animate character by character
    let index = 0
    const interval = setInterval(() => {
      if (index < text.length) {
         
        setDisplayedText(text.substring(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 20) // 20ms per character (Messenger-like speed)

    return () => clearInterval(interval)
  }, [text, isStreaming])

  return <>{displayedText}</>
}
