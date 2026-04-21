// Canonical Gremlin traversal recipes for Azure Cosmos DB.
// All traversals filter by partition key first to avoid cross-partition fanout.

// ---- Vertex CRUD --------------------------------------------------------------

// Create a person vertex (partition key path = '/pk')
g.addV('person')
 .property('id','p-001').property('pk','tenant-42')
 .property('name','Ada Lovelace').property('email','ada@example.com')
 .property('createdAt', 1745251200)

// Upsert pattern (create if missing)
g.V().has('person','id','p-001').has('pk','tenant-42').fold()
 .coalesce(
    unfold(),
    addV('person').property('id','p-001').property('pk','tenant-42')
                  .property('name','Ada Lovelace')
 )

// Update properties idempotently
g.V().has('person','id','p-001').has('pk','tenant-42')
 .property('email','ada.l@example.com')

// Delete vertex (and all incident edges)
g.V().has('person','id','p-001').has('pk','tenant-42').drop()

// ---- Edge CRUD ---------------------------------------------------------------

// Create a typed edge with properties
g.V().has('person','id','p-001').has('pk','tenant-42').as('a')
 .V().has('person','id','p-002').has('pk','tenant-42').as('b')
 .addE('knows').from('a').to('b').property('since', 2024)

// Idempotent edge upsert
g.V().has('person','id','p-001').has('pk','tenant-42').as('a')
 .V().has('person','id','p-002').has('pk','tenant-42').as('b')
 .coalesce(
    inE('knows').where(outV().as('a')),
    addE('knows').from('a').to('b').property('since', 2024)
 )

// ---- Traversals --------------------------------------------------------------

// 2-hop friend-of-friend, exclude self, dedup, limit
g.V().has('person','id','p-001').has('pk','tenant-42')
 .out('knows').out('knows')
 .where(neq(__.V().has('person','id','p-001').has('pk','tenant-42')))
 .dedup().limit(25)

// Bounded path search up to 5 hops
g.V().has('id','p-001').has('pk','tenant-42')
 .repeat(both('knows').simplePath()).times(5).emit()
 .has('id','p-099')
 .path().limit(1)

// Recommendation: people my friends know that I do not
g.V().has('id','p-001').has('pk','tenant-42').as('me')
 .out('knows').aggregate('friends')
 .out('knows')
 .where(neq('me')).where(without('friends'))
 .groupCount().by('id')
 .order(local).by(values, desc).limit(local, 10)

// ---- Projection (RU-efficient) -----------------------------------------------

g.V().has('person','pk','tenant-42').limit(100)
 .project('id','name','email')
   .by('id').by('name').by('email')

// ---- Aggregations ------------------------------------------------------------

// Count by label within a partition
g.V().has('pk','tenant-42').groupCount().by(label)

// Top 10 most-connected people in a tenant
g.V().has('person','pk','tenant-42')
 .project('id','degree')
   .by('id')
   .by(bothE().count())
 .order().by(select('degree'), desc)
 .limit(10)

// ---- Diagnostics -------------------------------------------------------------

// Print execution profile to inspect step costs / DB hits
g.V().has('person','pk','tenant-42').out('knows').limit(50).executionProfile()
