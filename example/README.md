# neo4j-sessionstore-example

## What is this
- This is an example web page that uses neo4j-sessionstore to store a session with a pageview counter.

## How to use
- Start a local Neo4j instance in a Docker container
- Then start the example web server.
```
docker --publish=7474:7474 --publish=7687:7687 --volume=$HOME/neo4j/data:/data --env=NEO4J_AUTH=none neo4j
npm start
```

- Then open a web browser and go to http://localhost:8081/
- Reload the page to increase the page counter.
- You can verify in the Neo4j browser at http://localhost:8081/  that there is a session and page view counter
