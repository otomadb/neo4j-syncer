import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import neo4j from "https://raw.githubusercontent.com/neo4j/neo4j-javascript-driver/5.6.0/packages/neo4j-driver-deno/lib/mod.ts";

const postgresUrl = Deno.env.get("POSTGRES_URL");
if (!postgresUrl) {
  console.log("Neo4j Bolt URL is not set");
  Deno.exit(1);
}

const neo4jBoltUrl = Deno.env.get("NEO4J_BOLT_URL");
if (!neo4jBoltUrl) {
  console.log("Neo4j Bolt URL is not set");
  Deno.exit(1);
}

const neo4jUsername = Deno.env.get("NEO4J_USERNAME");
if (!neo4jUsername) {
  console.log("Neo4j Username is not set");
  Deno.exit(1);
}

const neo4jPassword = Deno.env.get("NEO4J_PASSWORD");
if (!neo4jPassword) {
  console.log("Neo4j Password is not set");
  Deno.exit(1);
}

const pgClient = new Client(postgresUrl);
const neo4jDriver = neo4j.driver(
  neo4jBoltUrl,
  neo4j.auth.basic(neo4jUsername, neo4jPassword)
);

async function addVideoTagging(tagId: string, videoId: string) {
  const session = neo4jDriver.session({ defaultAccessMode: "WRITE" });
  try {
    await session.run(
      "MERGE (t:Tag { uid: $tagId }) MERGE (v:Video { uid: $videoId }) MERGE (t)-[r:TAGGED_TO]->(v) RETURN r",
      { videoId, tagId }
    );
  } finally {
    session.close();
  }
}

async function addTagParent(parentId: string, childId: string) {
  const session = neo4jDriver.session({ defaultAccessMode: "WRITE" });
  try {
    await session.run(
      "MERGE (p:Tag { uid: $parentId }) MERGE (c:Tag { uid: $childId }) MERGE (p)-[r:PARENT_OF]->(c) RETURN r",
      { parentId, childId }
    );
  } finally {
    session.close();
  }
}

async function addMylistRegistration(mylistId: string, videoId: string) {
  const session = neo4jDriver.session({ defaultAccessMode: "WRITE" });
  try {
    await session.run(
      "MERGE (m:Mylist { uid: $mylistId }) MERGE (v:Video { uid: $videoId }) MERGE (m)-[r:REGISTERED_TO]->(v) RETURN r",
      { mylistId, videoId }
    );
  } finally {
    session.close();
  }
}

async function syncVideoTaggings() {
  const { rows } = await pgClient.queryArray<[string, string, string, boolean]>(
    'SELECT "id","tagId","videoId","isRemoved" FROM "VideoTag"'
  );
  await Promise.all(
    rows.map(([_id, tagId, videoId, isRemoved]) =>
      !isRemoved ? addVideoTagging(tagId, videoId) : Promise.resolve()
    )
  );
  console.log("Video taggings synced.");
}

async function syncTagParents() {
  const { rows } = await pgClient.queryArray<[string, string, string, boolean]>(
    'SELECT "id","parentId","childId","isExplicit" FROM "TagParent"'
  );
  await Promise.all(
    rows.map(([_id, parentId, childId, _explicit]) =>
      addTagParent(parentId, childId)
    )
  );
  console.log("Tag parents synced.");
}

async function syncMylistRegistrations() {
  const { rows } = await pgClient.queryArray<[string, string, string, boolean]>(
    'SELECT "id","mylistId","videoId","isRemoved" FROM "MylistRegistration"'
  );
  await Promise.all(
    rows.map(([_id, parentId, childId, isRemoved]) =>
      !isRemoved ? addMylistRegistration(parentId, childId) : Promise.resolve()
    )
  );
  console.log("Mylist registrations synced.");
}

await syncVideoTaggings();
await syncTagParents();
await syncMylistRegistrations();

await pgClient.end();
await neo4jDriver.close();

console.log("Sync completed.");
Deno.exit();
