import psycopg
import os
from neo4j import GraphDatabase

if __name__ == "__main__":
    pg_url = os.getenv("POSTGRES_URL")
    if pg_url is None:
        raise Exception("POSTGRES_URL is not set")

    neo4j_bolt_url = os.getenv("NEO4J_BOLT_URL")
    if neo4j_bolt_url is None:
        raise Exception("NEO4J_BOLT_URL is not set")

    neo4j_username = os.getenv("NEO4J_USERNAME")
    if neo4j_username is None:
        raise Exception("NEO4J_USERNAME is not set")

    neo4j_password = os.getenv("NEO4J_PASSWORD")
    if neo4j_password is None:
        raise Exception("NEO4J_PASSWORD is not set")

    with GraphDatabase.driver(
        neo4j_bolt_url, auth=(neo4j_username, neo4j_password)
    ) as neo4j_driver, psycopg.connect(pg_url) as pg_conn:
        with neo4j_driver.session() as neo4j_session:
            tx = neo4j_session.begin_transaction()
            with pg_conn.cursor() as cur:
                cur.execute('SELECT "id","tagId","videoId","isRemoved" FROM "VideoTag"')
                for record in cur:
                    if record[3]:
                        tx.run(
                            "MATCH (t:Tag { uid: $tagId }), (v:Video { uid: $videoId }) MATCH (t)-[r:TAGGED_TO]->(v) DELETE r",
                            tagId=record[1],
                            videoId=record[2],
                        )
                    else:
                        tx.run(
                            "MERGE (t:Tag { uid: $tagId }) MERGE (v:Video { uid: $videoId }) MERGE (t)-[r:TAGGED_TO]->(v) RETURN r",
                            tagId=record[1],
                            videoId=record[2],
                        )
            tx.commit()
            print("?")
