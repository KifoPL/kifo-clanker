import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createPool, query } from '../../src/db/index.js';
import { claimCooldown } from '../../src/features/automation/superslow.js';

const databaseUrl=process.env['DATABASE_URL'];
test('superslow admits one concurrent message per cooldown and atomically advances expired cooldowns', {skip:!databaseUrl,timeout:30_000},async()=>{
  const admin=createPool(databaseUrl!,1);
  const schema=`automation_${randomUUID().replaceAll('-','')}`;
  const url=new URL(databaseUrl!);url.searchParams.set('options',`-c search_path=${schema}`);
  const pool=createPool(url.toString(),10);
  try {
    await query(admin,`CREATE SCHEMA ${schema}`);
    await query(pool,await readFile(new URL('../../migrations/005_automation.sql',import.meta.url),'utf8'));
    const duration=21_600_000;
    await query(pool,'INSERT INTO superslow_settings(channel_id,guild_id,duration_ms) VALUES($1,$2,$3)',['channel','guild',duration]);
    assert.equal((await Promise.all(Array.from({length:10},()=>claimCooldown(pool,'channel','user',1000,duration)))).filter(Boolean).length,1);
    assert.equal((await query(pool,'SELECT * FROM superslow_users')).rowCount,1);
    assert.equal(await claimCooldown(pool,'channel','user',1001,duration),false);
    assert.equal((await Promise.all(Array.from({length:10},()=>claimCooldown(pool,'channel','user',1000+duration,duration)))).filter(Boolean).length,1);
    await query(pool,'DELETE FROM superslow_settings WHERE channel_id=$1',['channel']);
    assert.equal((await query(pool,'SELECT * FROM superslow_users')).rowCount,0);
  } finally {await pool.end();await query(admin,`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}
});
