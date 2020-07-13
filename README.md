# neo4j-sessionstore

## Usage
This can be used as a session store with express-session.

## Note
The session store needs to be closed manually for now,
with a call to close() like this:
```
const store = new Neo4jSessionStore(OPTIONS, (err) => {
        store.close();
        if (err) reject(err);
});
```

## Inspiration

Inspired by https://github.com/rafaelrpinto/dynamodb-store

There is also a Neo4j session store for Java on Jooby.io:
https://jooby.io/v1/doc/neo4j/#neo4j-session-store
