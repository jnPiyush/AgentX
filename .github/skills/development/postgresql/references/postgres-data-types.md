# PostgreSQL JSONB, Arrays & Full-Text Search

## JSONB Operations

### Basic JSONB Queries

```sql
-- [PASS] GOOD: JSONB containment queries
-- Find users with active status
SELECT * FROM users
WHERE profile @> '{"status": "active"}'::jsonb;

-- Find users in a specific city
SELECT * FROM users
WHERE profile @> '{"address": {"city": "New York"}}'::jsonb;

-- Check if key exists
SELECT * FROM users
WHERE profile ? 'phone';

-- Check if any key exists
SELECT * FROM users
WHERE profile ?| ARRAY['email', 'phone'];

-- Check if all keys exist
SELECT * FROM users
WHERE profile ?& ARRAY['email', 'phone'];
```

### JSONB Path Operators

```sql
-- Extract JSON field as text
SELECT profile->>'name' AS name FROM users;

-- Extract nested JSON field
SELECT profile->'address'->>'city' AS city FROM users;

-- Extract JSON field as JSON
SELECT profile->'preferences' AS preferences FROM users;

-- Extract JSON array element
SELECT tags->0 AS first_tag FROM posts;

-- Path with multiple levels
SELECT profile #> '{address,coordinates,lat}' AS latitude FROM users;

-- Path extraction as text
SELECT profile #>> '{address,city}' AS city FROM users;
```

### JSONB Modification

```sql
-- [PASS] GOOD: Update JSONB fields
-- Set a value
UPDATE users
SET profile = jsonb_set(profile, '{status}', '"inactive"');

-- Set nested value
UPDATE users
SET profile = jsonb_set(profile, '{address,city}', '"Boston"');

-- Remove a key
UPDATE users
SET profile = profile - 'temporary_field';

-- Concatenate JSONB
UPDATE users
SET profile = profile || '{"verified": true}'::jsonb;

-- Build JSONB object
INSERT INTO events (data)
VALUES (jsonb_build_object(
 'event_type', 'login',
 'user_id', 123,
 'timestamp', NOW()
));
```

### JSONB Indexes

```sql
-- [PASS] GOOD: GIN index for JSONB
-- General JSONB index
CREATE INDEX idx_users_profile ON users USING gin(profile);

-- Index specific JSON path
CREATE INDEX idx_users_profile_status 
ON users USING gin((profile->'status'));

-- Index for containment queries
CREATE INDEX idx_events_data 
ON events USING gin(data jsonb_path_ops);
```

---

## Array Operations

### Basic Array Queries

```sql
-- [PASS] GOOD: Array queries
-- Check if value is in array
SELECT * FROM posts
WHERE 'postgresql' = ANY(tags);

-- Check if all values match
SELECT * FROM posts
WHERE tags @> ARRAY['postgresql', 'database'];

-- Check for overlap
SELECT * FROM posts
WHERE tags && ARRAY['sql', 'nosql'];

-- Array length
SELECT *, array_length(tags, 1) AS tag_count
FROM posts;
```

### Array Aggregation

```sql
-- [PASS] GOOD: Array aggregation
-- Aggregate into array
SELECT 
 user_id,
 array_agg(DISTINCT category) AS categories,
 array_agg(product_name ORDER BY created_at DESC) AS recent_products
FROM orders
GROUP BY user_id;

-- Unnest array to rows
SELECT unnest(tags) AS tag
FROM posts;

-- Unnest with ordinality (index)
SELECT tag, idx
FROM posts, unnest(tags) WITH ORDINALITY AS t(tag, idx);
```

### Array Operations

```sql
-- Append to array
UPDATE posts
SET tags = array_append(tags, 'new-tag')
WHERE id = 1;

-- Prepend to array
UPDATE posts
SET tags = array_prepend('featured', tags)
WHERE id = 1;

-- Remove from array
UPDATE posts
SET tags = array_remove(tags, 'deprecated')
WHERE id = 1;

-- Concatenate arrays
UPDATE posts
SET tags = tags || ARRAY['tag1', 'tag2']
WHERE id = 1;
```

---

## Full-Text Search

```sql
-- [PASS] GOOD: Full-text search setup
-- Add tsvector column
ALTER TABLE posts
ADD COLUMN search_vector tsvector;

-- Update search vector
UPDATE posts
SET search_vector = 
 setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
 setweight(to_tsvector('english', COALESCE(content, '')), 'B');

-- Create GIN index
CREATE INDEX idx_posts_search 
ON posts USING gin(search_vector);

-- Create trigger to auto-update
CREATE FUNCTION posts_search_update() RETURNS trigger AS $$
BEGIN
 NEW.search_vector :=
 setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
 setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_search_trigger
BEFORE INSERT OR UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION posts_search_update();

-- [PASS] GOOD: Full-text search queries
-- Basic search
SELECT * FROM posts
WHERE search_vector @@ to_tsquery('english', 'postgresql & performance');

-- Search with ranking
SELECT 
 *,
 ts_rank(search_vector, query) AS rank
FROM posts, to_tsquery('english', 'postgresql | database') AS query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- Phrase search
SELECT * FROM posts
WHERE search_vector @@ phraseto_tsquery('english', 'full text search');

-- Prefix search
SELECT * FROM posts
WHERE search_vector @@ to_tsquery('english', 'postgre:*');
```

---
