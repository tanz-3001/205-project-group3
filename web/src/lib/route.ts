import { useEffect, useState } from "react"

const read = () => window.location.hash.slice(1) || "ask"

export function useHash(): string {
  const [hash, setHash] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setHash(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])
  return hash
}

export const go = (slug: string) => {
  window.location.hash = "#" + slug
}
