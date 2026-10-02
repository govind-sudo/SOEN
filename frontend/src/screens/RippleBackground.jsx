import { useEffect, useRef, useState } from 'react'

const BACKGROUND_RING_COUNT = 6
const RIPPLE_DURATION_MS = 1200

const RippleBackground = () => {
    const [ripples, setRipples] = useState([])
    const containerRef = useRef(null)
    const nextRippleId = useRef(0)
    const timeoutIds = useRef(new Set())

    useEffect(() => {
        function handlePointerDown(event) {
            const container = containerRef.current
            if (!container) return

            const bounds = container.getBoundingClientRect()
            if (
                event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom
            ) return

            const id = nextRippleId.current++
            setRipples((currentRipples) => [
                ...currentRipples,
                {
                    id,
                    x: event.clientX - bounds.left,
                    y: event.clientY - bounds.top,
                },
            ])

            const timeoutId = window.setTimeout(() => {
                setRipples((currentRipples) => currentRipples.filter((ripple) => ripple.id !== id))
                timeoutIds.current.delete(timeoutId)
            }, RIPPLE_DURATION_MS)
            timeoutIds.current.add(timeoutId)
        }

        window.addEventListener('pointerdown', handlePointerDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
            timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
            timeoutIds.current.clear()
        }
    }, [])

    return (
        <div ref={containerRef} className="login-ripple-background absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {Array.from({ length: BACKGROUND_RING_COUNT }, (_, index) => (
                <span
                    key={`background-${index}`}
                    className="login-ripple-background__ring"
                    style={{ animationDelay: `${index * -2}s` }}
                />
            ))}
            {ripples.map((ripple) => (
                <span
                    key={ripple.id}
                    className="login-ripple-background__click"
                    style={{ left: `${ripple.x}px`, top: `${ripple.y}px` }}
                />
            ))}
        </div>
    )
}

export default RippleBackground