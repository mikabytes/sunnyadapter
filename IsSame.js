export default function IsSame() {
  let previous = null

  return function isSame(current) {
    if (!Array.isArray(current)) return false
    if (!Array.isArray(previous)) {
      previous = structuredClone(current)
      return false
    }

    const isEqual = (a, b) => {
      if (a.length !== b.length) return false

      for (let i = 0; i < a.length; i++) {
        const objA = a[i]
        const objB = b[i]

        const keys = ["start", "stop", "power"]
        for (const key of keys) {
          if (objA[key] !== objB[key]) return false
        }
      }
      return true
    }

    const result = isEqual(previous, current)
    previous = structuredClone(current)
    return result
  }
}
