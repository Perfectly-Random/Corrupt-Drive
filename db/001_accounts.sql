-- Isolated Corrupt Drive database only. No grants on other databases.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS game_private;
CREATE SCHEMA IF NOT EXISTS game_api;
REVOKE ALL ON SCHEMA game_private FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='cd_gateway') THEN CREATE ROLE cd_gateway NOLOGIN; END IF; END $$;
CREATE TABLE IF NOT EXISTS game_private.accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 username text UNIQUE NOT NULL CHECK (username ~ '^[a-z0-9_-]{3,24}$'),
 password_hash text NOT NULL,
 recovery_hash bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS game_private.sessions (
 token_hash bytea PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES game_private.accounts(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days'
);
CREATE INDEX IF NOT EXISTS cd_sessions_user_idx ON game_private.sessions(user_id);
CREATE TABLE IF NOT EXISTS game_private.saves (
 user_id uuid PRIMARY KEY REFERENCES game_private.accounts(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0,
 state jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(state)='object' AND octet_length(state::text)<=500000)
);
CREATE TABLE IF NOT EXISTS game_private.limits (key text PRIMARY KEY,hits int NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS game_private.settings (key text PRIMARY KEY,value text NOT NULL);
INSERT INTO game_private.settings VALUES ('dummy_hash',public.crypt(encode(public.gen_random_bytes(32),'hex'),public.gen_salt('bf',12))) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION game_private.allow_request(scope text, cap int, window_seconds int) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE k text; n int;
BEGIN
 k:=scope||':'||floor(extract(epoch FROM now())/window_seconds)::text;
 INSERT INTO game_private.limits(key,hits,expires_at) VALUES(k,1,now()+make_interval(secs=>window_seconds*2)) ON CONFLICT(key) DO UPDATE SET hits=game_private.limits.hits+1 RETURNING hits INTO n;
 IF random()<0.01 THEN DELETE FROM game_private.limits WHERE expires_at<now(); END IF;
 RETURN n<=cap;
END $$;
CREATE OR REPLACE FUNCTION game_api.rpc(action text,payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u game_private.accounts%ROWTYPE; s game_private.saves%ROWTYPE; uname text; pw text; recovery text; token text; uid uuid; hashed text; nextrev bigint; rc text;
BEGIN
 IF jsonb_typeof(payload)<>'object' OR octet_length(payload::text)>510000 THEN RETURN jsonb_build_object('ok',false,'code',400,'error','Invalid request.'); END IF;
 IF action='health' THEN RETURN jsonb_build_object('ok',true,'service','corrupt-drive','version',2); END IF;
 IF action IN ('register','login','recover') THEN
  IF NOT game_private.allow_request('auth-global',180,60) THEN RETURN jsonb_build_object('ok',false,'code',429,'error','Account service is busy. Please try again in a minute.'); END IF;
  uname:=lower(trim(coalesce(payload->>'username',''))); pw:=coalesce(payload->>'password','');
  IF uname !~ '^[a-z0-9_-]{3,24}$' OR octet_length(pw)<10 OR octet_length(pw)>72 THEN RETURN jsonb_build_object('ok',false,'code',400,'error','Use a 3–24 character username and a password of 10–72 bytes.'); END IF;
  IF NOT game_private.allow_request('account:'||uname,12,900) THEN RETURN jsonb_build_object('ok',false,'code',429,'error','Too many attempts for this username. Try again in 15 minutes.'); END IF;
  IF action='register' THEN
   IF NOT game_private.allow_request('register-global',30,60) THEN RETURN jsonb_build_object('ok',false,'code',429,'error','Please try creating your account in a minute.'); END IF;
   recovery:=encode(public.gen_random_bytes(24),'hex');
   INSERT INTO game_private.accounts(username,password_hash,recovery_hash) VALUES(uname,public.crypt(pw,public.gen_salt('bf',12)),public.digest(recovery,'sha256')) ON CONFLICT(username) DO NOTHING RETURNING * INTO u;
   IF u.id IS NULL THEN RETURN jsonb_build_object('ok',false,'code',409,'error','Choose another username, or sign in.'); END IF;
   INSERT INTO game_private.saves(user_id) VALUES(u.id);
  ELSE
   SELECT * INTO u FROM game_private.accounts WHERE username=uname;
   IF action='login' THEN
    SELECT coalesce(u.password_hash,value) INTO hashed FROM game_private.settings WHERE key='dummy_hash';
    IF public.crypt(pw,hashed)<>hashed OR u.id IS NULL THEN RETURN jsonb_build_object('ok',false,'code',401,'error','Incorrect username or password.'); END IF;
   ELSE
    rc:=lower(trim(coalesce(payload->>'recovery','')));
    IF u.id IS NULL OR length(rc)<>48 OR u.recovery_hash<>public.digest(rc,'sha256') THEN RETURN jsonb_build_object('ok',false,'code',401,'error','Incorrect username or recovery code.'); END IF;
    recovery:=encode(public.gen_random_bytes(24),'hex');
    UPDATE game_private.accounts SET password_hash=public.crypt(pw,public.gen_salt('bf',12)),recovery_hash=public.digest(recovery,'sha256') WHERE id=u.id;
    DELETE FROM game_private.sessions WHERE user_id=u.id;
   END IF;
  END IF;
  token:=encode(public.gen_random_bytes(32),'hex');
  INSERT INTO game_private.sessions(token_hash,user_id) VALUES(public.digest(token,'sha256'),u.id);
  SELECT * INTO s FROM game_private.saves WHERE user_id=u.id;
  RETURN jsonb_build_object('ok',true,'user',jsonb_build_object('id',u.id,'username',u.username),'token',token,'recovery',recovery,'revision',s.revision,'state',s.state);
 END IF;
 token:=coalesce(payload->>'token','');
 IF token !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false,'code',401,'error','Please sign in.'); END IF;
 SELECT user_id INTO uid FROM game_private.sessions WHERE token_hash=public.digest(token,'sha256') AND expires_at>now();
 IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'code',401,'error','Your session has expired. Sign in again.'); END IF;
 IF NOT game_private.allow_request('session:'||uid::text,150,60) THEN RETURN jsonb_build_object('ok',false,'code',429,'error','Too many requests. Please retry shortly.'); END IF;
 IF action='logout' THEN
  DELETE FROM game_private.sessions WHERE token_hash=public.digest(token,'sha256');
  RETURN jsonb_build_object('ok',true);
 END IF;
 SELECT * INTO u FROM game_private.accounts WHERE id=uid;
 IF action IN ('load','session') THEN
  SELECT * INTO s FROM game_private.saves WHERE user_id=uid;
  RETURN jsonb_build_object('ok',true,'user',jsonb_build_object('id',u.id,'username',u.username),'revision',s.revision,'state',s.state);
 END IF;
 IF action='save' THEN
  IF jsonb_typeof(payload->'state') IS DISTINCT FROM 'object' OR (payload->'state'->>'version') IS DISTINCT FROM '2' OR jsonb_typeof(payload->'state'->'stats') IS DISTINCT FROM 'object' OR octet_length((payload->'state')::text)>500000 OR coalesce(payload->>'revision','') !~ '^[0-9]{1,12}$' THEN
   RETURN jsonb_build_object('ok',false,'code',400,'error','Invalid save data. Export your local backup before reloading.');
  END IF;
  UPDATE game_private.saves SET state=payload->'state',revision=revision+1,updated_at=now() WHERE user_id=uid AND revision=(payload->>'revision')::bigint RETURNING revision INTO nextrev;
  IF nextrev IS NULL THEN RETURN jsonb_build_object('ok',false,'code',409,'error','Another tab or device has a newer save. Export this local backup or load the cloud save.'); END IF;
  RETURN jsonb_build_object('ok',true,'revision',nextrev);
 END IF;
 RETURN jsonb_build_object('ok',false,'code',400,'error','Unknown operation.');
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA game_private FROM PUBLIC,cd_gateway;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game_private FROM PUBLIC,cd_gateway;
REVOKE ALL ON FUNCTION game_api.rpc(text,jsonb) FROM PUBLIC;
GRANT USAGE ON SCHEMA game_api TO cd_gateway;
GRANT EXECUTE ON FUNCTION game_api.rpc(text,jsonb) TO cd_gateway;

-- After provisioning Neon Data API on this isolated database:
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN GRANT cd_gateway TO authenticator; END IF; END $$;
