import pg from 'pg';
export const pool = new pg.Pool({connectionString: process.env.DATABASE_URL ?? 'postgres://coursehub:change-me@localhost:5432/coursehub'});
export async function query<T extends pg.QueryResultRow=pg.QueryResultRow>(sql:string, params:unknown[]=[]){return (await pool.query<T>(sql,params)).rows;}
