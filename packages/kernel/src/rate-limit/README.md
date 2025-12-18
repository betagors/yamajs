# Rate Limiting

Yama provides configurable rate limiting with multiple storage backends.

## Storage Backends

### Memory Store (`store: "memory"`)
- **Use case**: Single-instance applications, development, testing
- **Performance**: Fast, no network overhead
- **Limitations**: Not shared across instances, lost on restart
- **Race conditions**: None (single process)

### Cache Store (`store: "cache"`)
- **Use case**: Distributed applications, production
- **Performance**: Depends on cache implementation
- **Limitations**: Requires cache plugin to be loaded
- **Race conditions**: 
  - **Redis**: None (uses atomic sorted set operations)
  - **Other caches**: Potential race conditions (GET + SET operations)

## Performance Characteristics

### Redis (Optimized Path)
When using Redis cache adapter, rate limiting automatically uses optimized sorted sets:
- **Operations**: Atomic (ZADD, ZCARD, ZREMRANGEBYSCORE)
- **Round trips**: ~3-4 per request
- **Race conditions**: None (atomic operations)
- **Performance**: Best for high-traffic scenarios

### Generic Cache (Fallback Path)
For non-Redis cache adapters (Memcached, etc.):
- **Operations**: GET + SET (2 round trips)
- **Race conditions**: Possible under high concurrency
- **Performance**: Good for moderate traffic
- **Note**: Consider implementing atomic operations in your cache adapter for better performance

## Configuration

### Basic Configuration

```yaml
rateLimit:
  maxRequests: 100
  windowMs: 60000  # 1 minute
  store: cache
```

### Fail-Closed Mode

For security-critical applications, use fail-closed mode:

```yaml
rateLimit:
  maxRequests: 100
  windowMs: 60000
  store: cache
  onFailure: fail-closed  # Deny requests when cache is down
```

**Fail-Open (default)**: Allows requests when cache fails (graceful degradation)
**Fail-Closed**: Denies requests when cache fails (more secure, but can cause outages)

### Per-Endpoint Rate Limiting

```yaml
endpoints:
  - path: /api/expensive
    method: POST
    rateLimit:
      maxRequests: 10
      windowMs: 60000
      store: cache
      onFailure: fail-closed
```

## Key Strategies

- `ip`: Rate limit by IP address
- `user`: Rate limit by authenticated user ID
- `both`: Rate limit by both IP and user (stricter)

## Implementation Details

### Redis Optimization
When a Redis cache adapter is detected, rate limiting automatically uses:
- Sorted sets (ZADD) for atomic timestamp tracking
- ZCARD for atomic count operations
- ZREMRANGEBYSCORE for efficient window cleanup

This provides:
- No race conditions
- Better performance
- Lower latency

### Generic Cache Fallback
For non-Redis caches, the implementation:
- Stores timestamps as JSON arrays
- Uses GET + SET operations
- May have race conditions under high concurrency
- Still functional for most use cases

## Best Practices

1. **Use Redis for production**: Provides best performance and no race conditions
2. **Use fail-closed for security**: Prevents bypassing rate limits when cache fails
3. **Monitor cache health**: Use `context.cache?.health()` for monitoring
4. **Set appropriate windows**: Balance between user experience and protection
5. **Test under load**: Verify rate limiting behavior with concurrent requests

## Troubleshooting

### Rate limiting not working
- Check that cache plugin is loaded
- Verify cache connection with `context.cache?.health()`
- Check logs for cache errors

### Too many false positives
- Increase `maxRequests` or `windowMs`
- Check if cache is failing (fail-open mode allows all requests)

### Performance issues
- Use Redis cache adapter for optimized path
- Consider using memory store for single-instance deployments
- Monitor cache latency

