# Cache Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Your Application                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ctx.cache.get('key')                                      │ │
│  │  ctx.cache.set('key', value)                               │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    @yamajs/cache                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Cache Class                              │ │
│  │                                                            │ │
│  │  Core API (Stable):                                        │ │
│  │  ├─ get()       Retrieve value                             │ │
│  │  ├─ set()       Store value                                │ │
│  │  ├─ del()       Delete value                               │ │
│  │  ├─ exists()    Check existence                            │ │
│  │  └─ namespace() Create prefixed view                       │ │
│  │                                                            │ │
│  │  Hooks System:                                             │ │
│  │  ├─ before:get -> after:get                                │ │
│  │  ├─ before:set -> after:set                                │ │
│  │  └─ ...                                                    │ │
│  │                                                            │ │
│  │  Extensions (Proxy Pattern):                               │ │
│  │  ├─ Compression Extension                                  │ │
│  │  └─ Serialization Extension                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cache Adapter Interface                       │
│                   (from @yamajs/core)                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  get(key) -> Promise<T | null>                             │ │
│  │  set(key, value, ttl?) -> Promise<void>                    │ │
│  │  del(key) -> Promise<void>                                 │ │
│  │  exists(key) -> Promise<boolean>                           │ │
│  │  namespace(prefix) -> CacheAdapter                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
        ▼                                         ▼
┌──────────────────┐                    ┌──────────────────┐
│ @yamajs/redis    │                    │  MemoryAdapter   │
│ (Future)         │                    │  (Built-in)      │
│                  │                    │                  │
│  - Redis Client  │                    │  - Map<string>   │
└──────────────────┘                    └──────────────────┘
```

## Setup Flow

1. **Config Loading**: `yama.yaml` is read.
2. **Provider Selection**: `config.provider` looks up registered factory.
3. **Adapter Creation**: Factory creates adapter (e.g., Redis connection) with options.
4. **Cache Instantiation**: New `Cache(adapter)` created.
5. **Context Injection**: `ctx.cache` available in app.
