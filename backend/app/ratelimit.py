import time
from collections import defaultdict, deque


class RateLimiter:
    """Tiny in-memory sliding-window limiter.

    Fine for a single instance. With several instances you would move this to Redis
    (each instance would otherwise keep its own counters).
    """

    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str) -> deque[float]:
        hits = self._hits[key]
        cutoff = time.monotonic() - self.window
        while hits and hits[0] < cutoff:
            hits.popleft()
        return hits

    def blocked(self, key: str) -> bool:
        return len(self._prune(key)) >= self.max_attempts

    def hit(self, key: str) -> None:
        self._prune(key).append(time.monotonic())

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)

    def clear(self) -> None:
        self._hits.clear()
