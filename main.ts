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

const session = neo4jDriver.session();

try {
  const tx = session.beginTransaction();

  // 動画のタグ付け
  {
    const { rows } = await pgClient.queryArray<
      [string, string, string, boolean]
    >('SELECT "id","tagId","videoId","isRemoved" FROM "VideoTag"');
    console.log("Video taggings", rows.length);
    for (const [_id, tagId, videoId, isRemoved] of rows) {
      if (!isRemoved)
        await tx.run(
          "MERGE (t:Tag { uid: $tagId }) MERGE (v:Video { uid: $videoId }) MERGE (t)-[r:TAGGED_TO]->(v) RETURN r",
          { videoId, tagId }
        );
      else
        await tx.run(
          "MATCH (t:Tag { uid: $tagId }), (v:Video { uid: $videoId }) MATCH (t)-[r:TAGGED_TO]->(v) DELETE r",
          { videoId, tagId }
        );
    }
  }

  // タグの親子関係
  {
    const { rows } = await pgClient.queryArray<
      [string, string, string, boolean]
    >('SELECT "id","parentId","childId","isExplicit" FROM "TagParent"');
    console.log("Tag parent relations", rows.length);
    for (const [_id, parentId, childId, explicit] of rows) {
      await tx.run(
        "MERGE (p:Tag { uid: $parentId }) MERGE (c:Tag { uid: $childId }) MERGE (p)-[r:PARENT_OF {explicit: $explicit}]->(c) RETURN r",
        { parentId, childId, explicit }
      );
    }
  }

  // マイリストの動画登録
  {
    const { rows } = await pgClient.queryArray<
      [string, string, string, boolean]
    >('SELECT "id","mylistId","videoId","isRemoved" FROM "MylistRegistration"');
    console.log("Mylist registrations", rows.length);
    for (const [_id, mylistId, videoId, isRemoved] of rows) {
      if (!isRemoved)
        await tx.run(
          "MERGE (m:Mylist { uid: $mylistId }) MERGE (v:Video { uid: $videoId }) MERGE (m)-[r:REGISTERED_TO]->(v) RETURN r",
          { mylistId, videoId }
        );
      else
        await tx.run(
          "MATCH (m:Mylist { uid: $mylistId }), (v:Video { uid: $videoId }) MATCH (m)-[r:REGISTERED_TO]->(v) DELETE r",
          { mylistId, videoId }
        );
    }
  }

  await tx.commit();
} catch (e) {
  console.error(e);
} finally {
  await session.close();
}

await pgClient.end();
await neo4jDriver.close();
console.log("Sync completed.");

Deno.exit();
