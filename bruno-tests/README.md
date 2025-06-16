# Bruno API Test Suite for Grypsiarze Server

This test suite comprehensively tests the cached API endpoints of the Grypsiarze server using Bruno API client.

## 📋 Overview

The test suite is organized into several categories:

- **Health Checks** - Server availability and system health monitoring
- **Cache Management** - Redis cache operations and monitoring
- **Data Endpoints** - Core API functionality with caching validation
- **Cache Performance** - Cache hit/miss behavior and performance testing
- **Error Handling** - Error responses and edge cases

## 🚀 Prerequisites

1. **Bruno API Client** - Install from [https://www.usebruno.com/](https://www.usebruno.com/)
2. **Running Server** - Start the cached server:
   ```bash
   npm run start:server:cached
   ```
3. **Redis Connection** - Ensure Redis/Upstash is accessible

## 🗂️ Test Structure

```
bruno-tests/
├── bruno.json                    # Collection configuration
├── environments/
│   └── Local.bru                 # Local environment variables
├── Health Checks/
│   ├── Server Alive.bru          # Basic server health
│   └── System Health.bru         # Comprehensive health check
├── Cache Management/
│   ├── Cache Status.bru          # Cache statistics
│   ├── Cache Health.bru          # Cache connection health
│   └── Cache Warm.bru            # Cache warming functionality
├── Data Endpoints/
│   ├── Get Zbrodniarze.bru       # First request (cache miss)
│   ├── Get Zbrodniarze (Cache Hit).bru  # Second request (cache hit)
│   ├── Get Daily Stats.bru       # Daily statistics endpoint
│   ├── Get Messages.bru          # User messages endpoint
│   └── Get Messages Invalid.bru  # Invalid parameters test
├── Cache Performance/
│   ├── Clear Zbrodniarze Cache.bru    # Cache invalidation
│   ├── Verify Cache Miss.bru          # Post-invalidation performance
│   ├── Verify Cache Rebuild.bru       # Cache rebuild verification
│   └── Load Test.bru                  # Performance under load
└── Error Handling/
    └── 404 Not Found.bru         # Non-existent endpoints
```

## ⚙️ Configuration

### Environment Variables

Edit `environments/Local.bru` to match your setup:

```javascript
vars {
  baseUrl: http://localhost:31457
  testUser: testuser
  testYear: 2024
  testMonth: 01
  testDay: 15
}
```

## 🧪 Test Categories

### 1. Health Checks

Tests basic server functionality and comprehensive health monitoring.

**Key Tests:**
- Server availability (`/alive`)
- System health with cache status (`/health`)
- Response time validation
- Memory usage monitoring

### 2. Cache Management

Validates Redis cache operations and monitoring endpoints.

**Key Tests:**
- Cache connection status (`/cache/status`)
- Cache health monitoring (`/cache/health`)
- Cache warming functionality (`POST /cache/warm`)
- Cache statistics validation

### 3. Data Endpoints

Tests core API functionality with caching behavior validation.

**Key Tests:**
- **Zbrodniarze Endpoint:**
  - First request (cache miss) - slower response
  - Second request (cache hit) - faster response
  - Performance comparison and validation
  
- **Daily Stats Endpoint:**
  - Cache behavior with 15-minute TTL
  - Data structure validation
  - Date ordering verification
  
- **Messages Endpoint:**
  - Parameter validation
  - Cache behavior with 10-minute TTL
  - User-specific message retrieval
  - Invalid parameter handling

### 4. Cache Performance

Tests cache invalidation, rebuilding, and performance characteristics.

**Test Flow:**
1. **Clear Cache** - Invalidate zbrodniarze cache
2. **Verify Cache Miss** - Confirm slower response after invalidation
3. **Verify Cache Rebuild** - Confirm cache is rebuilt and faster
4. **Load Test** - Performance under concurrent requests

### 5. Error Handling

Tests error responses and edge cases.

**Key Tests:**
- 404 responses for non-existent endpoints
- 400 responses for invalid parameters
- Proper error message structure

## 📊 Performance Expectations

### Response Times

| Endpoint | Cache Miss | Cache Hit | Notes |
|----------|------------|-----------|-------|
| `/zbrodniarze` | 50-500ms | 10-50ms | Database query vs Redis |
| `/daily-stats` | 50-300ms | 10-50ms | Aggregated data |
| `/messages/:user/:date` | 50-200ms | 10-50ms | User-specific queries |

### Cache Behavior

- **TTL Values:**
  - Zbrodniarze: 5 minutes (300s)
  - Messages: 10 minutes (600s)
  - Daily Stats: 15 minutes (900s)

- **Cache Headers:**
  - `cache-control: public, max-age=<ttl>`
  - `vary: Accept-Encoding`

## 🔍 Running Tests

### 1. Open Bruno

Launch Bruno and open the collection:
```
File → Open Collection → Select: grypsiarze/bruno-tests/
```

### 2. Set Environment

Select "Local" environment from the dropdown.

### 3. Run Individual Tests

Click on any test file and press "Send" to run individual tests.

### 4. Run Test Sequence

For comprehensive testing, run tests in this order:

1. **Health Checks** (verify server is running)
2. **Cache Management** (verify cache is working)
3. **Data Endpoints** (test core functionality)
4. **Cache Performance** (test invalidation/rebuilding)
5. **Error Handling** (test edge cases)

### 5. Automated Test Running

Use Bruno CLI for automated testing:

```bash
# Install Bruno CLI
npm install -g @usebruno/cli

# Run all tests
bru run bruno-tests --env Local

# Run specific folder
bru run bruno-tests/Health\ Checks --env Local
```

## 📈 Understanding Test Results

### Cache Hit vs Miss Indicators

**Cache Hit (Fast Response):**
```
✅ Response time: 15ms
✅ Cache headers present
✅ Data identical to previous request
```

**Cache Miss (Slower Response):**
```
⚡ Response time: 150ms (slower)
✅ Cache headers present
✅ Fresh data from database
```

### Performance Metrics

Tests track these key metrics:
- **Response Time** - Database vs cache performance
- **Cache Hit Rate** - Percentage of cached responses
- **Data Consistency** - Identical responses from cache
- **Cache Invalidation** - Proper cleanup when data changes

### Common Test Patterns

**Performance Comparison:**
```javascript
test("Cache improves performance", function() {
  const improvement = firstRequestTime / secondRequestTime;
  expect(improvement).to.be.above(2.0); // At least 2x faster
});
```

**Cache Header Validation:**
```javascript
test("Cache headers present", function() {
  expect(res.getHeader('cache-control')).to.equal('public, max-age=300');
  expect(res.getHeader('vary')).to.equal('Accept-Encoding');
});
```

## 🛠️ Troubleshooting

### Common Issues

1. **Server Not Running**
   ```
   ❌ Server is not running. Please start it with: npm run start:server:cached
   ```
   **Solution:** Start the server with caching enabled.

2. **Cache Connection Failed**
   ```
   ❌ Cache health check failed
   ```
   **Solution:** Verify Redis/Upstash connection in `.env` file.

3. **Slow Cache Hits**
   ```
   ❌ Cache hit response time too slow
   ```
   **Solution:** Check Redis connection latency and server load.

4. **Test Data Missing**
   ```
   ❌ No messages found for test user
   ```
   **Solution:** Update test user/date in environment variables.

### Debug Steps

1. **Verify Server Health:**
   ```bash
   curl http://localhost:31457/health
   ```

2. **Check Cache Status:**
   ```bash
   curl http://localhost:31457/cache/status
   ```

3. **Monitor Server Logs:**
   ```bash
   npm run start:server:cached
   # Look for cache HIT/MISS messages
   ```

4. **Test Individual Endpoints:**
   ```bash
   curl http://localhost:31457/zbrodniarze
   curl http://localhost:31457/daily-stats
   ```

**Note:** All header names in Bruno tests use lowercase (e.g., `cache-control`, `content-type`) as Bruno automatically converts headers to lowercase.

## 📋 Test Checklist

Before running the full suite, ensure:

- [ ] Server is running on port 31457
- [ ] Redis/Upstash connection is working
- [ ] Environment variables are set correctly
- [ ] Test data exists in database
- [ ] Bruno is installed and collection is loaded

## 🎯 Expected Results

### Successful Test Run

When all tests pass, you should see:

- ✅ All health checks pass
- ✅ Cache connection is healthy
- ✅ Cache hits are 2-10x faster than cache misses
- ✅ Cache invalidation works correctly
- ✅ Data consistency is maintained
- ✅ Error handling works properly

### Performance Improvements

With caching enabled:
- **90%+ reduction** in database queries for cached data
- **5-10x faster** response times for cached endpoints
- **Better scalability** under concurrent load
- **Consistent performance** even with large datasets

## 📚 Additional Resources

- [Bruno Documentation](https://docs.usebruno.com/)
- [Redis Caching Best Practices](../CACHING.md)
- [Server Performance Guide](../README.md)
- [Environment Configuration](../.env.example)

## 🤝 Contributing

To add new tests:

1. Create `.bru` files in appropriate folders
2. Follow existing naming conventions
3. Include comprehensive assertions
4. Add performance expectations
5. Document test purpose and expected behavior

## 📄 License

This test suite is part of the Grypsiarze project and follows the same license terms.