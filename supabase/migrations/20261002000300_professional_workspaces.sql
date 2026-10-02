-- Apply only when enabling CAMPO_AUTH=supabase. Existing data stays quarantined
-- until an operator explicitly assigns an owner to the legacy organization.
BEGIN;
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  personal_user uuid UNIQUE REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id), user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL CHECK(role IN ('owner','admin','member','viewer')), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,user_id)
);
CREATE TABLE public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  email text NOT NULL, role text NOT NULL CHECK(role IN ('admin','member','viewer')), token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
  accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_id uuid, entity_type text NOT NULL, entity_id text NOT NULL, operation text NOT NULL,
  before_data jsonb, after_data jsonb, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX organization_members_user_idx ON public.organization_members(user_id,organization_id);
CREATE INDEX organization_invitations_org_idx ON public.organization_invitations(organization_id,created_at DESC);
CREATE INDEX audit_events_org_idx ON public.audit_events(organization_id,id DESC);
CREATE INDEX audit_events_entity_idx ON public.audit_events(organization_id,entity_id,id DESC);
INSERT INTO public.organizations(id,name) VALUES ('00000000-0000-0000-0000-000000000001','Catálogo anterior');

CREATE FUNCTION public.campo_organization() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT nullif(current_setting('campo.organization_id',true),'')::uuid
$$;
CREATE FUNCTION public.campo_role(org uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT role FROM public.organization_members WHERE organization_id=org AND user_id=(SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION public.campo_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campo_role(uuid) TO authenticated;

-- All primary and foreign keys include the organization, including fixed IDs
-- such as preferences and provider cache hashes. Same IDs may exist in two catalogs.
DO $$
DECLARE t text; c record; write_roles text;
BEGIN
  FOR c IN SELECT conrelid::regclass AS tbl,conname FROM pg_constraint
    WHERE contype='f' AND connamespace='public'::regnamespace
      AND conrelid::regclass::text IN ('species','observations','images','identifications','history','compounds','evidence','discoveries','research','settings','notes','bookmarks','projects','campaigns','sampling_sites','cache')
  LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',c.tbl,c.conname); END LOOP;
  FOREACH t IN ARRAY ARRAY['species','observations','images','identifications','history','compounds','evidence','discoveries','research','settings','notes','bookmarks','projects','campaigns','sampling_sites','cache'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN organization_id uuid NOT NULL DEFAULT ''00000000-0000-0000-0000-000000000001'' REFERENCES public.organizations(id)',t);
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid=format('public.%I',t)::regclass AND (contype='p' OR (t='observations' AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (code)'))
    LOOP EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',t,c.conname); END LOOP;
    EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY(organization_id,id)',t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT public.campo_organization()',t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN created_by uuid, ADD COLUMN updated_by uuid, ADD COLUMN created_at_audit timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at_audit timestamptz NOT NULL DEFAULT now()',t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (organization_id=(SELECT public.campo_organization()) AND public.campo_role(organization_id) IS NOT NULL)',t);
    write_roles=CASE WHEN t IN ('projects','campaigns') THEN '''owner'',''admin''' ELSE '''owner'',''admin'',''member''' END;
    EXECUTE format('CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id=(SELECT public.campo_organization()) AND public.campo_role(organization_id) IN (%s))',t,write_roles);
    EXECUTE format('CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (organization_id=(SELECT public.campo_organization()) AND public.campo_role(organization_id) IN (%s)) WITH CHECK (organization_id=(SELECT public.campo_organization()) AND public.campo_role(organization_id) IN (%s))',t,write_roles,write_roles);
    EXECUTE format('CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated USING (organization_id=(SELECT public.campo_organization()) AND public.campo_role(organization_id) IN (%s))',t,write_roles);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  END LOOP;
END $$;
ALTER TABLE public.observations ADD UNIQUE(organization_id,code);
ALTER TABLE public.observations ADD FOREIGN KEY(organization_id,species_id) REFERENCES public.species(organization_id,id);
ALTER TABLE public.observations ADD FOREIGN KEY(organization_id,project_id) REFERENCES public.projects(organization_id,id);
ALTER TABLE public.observations ADD FOREIGN KEY(organization_id,campaign_id) REFERENCES public.campaigns(organization_id,id);
ALTER TABLE public.observations ADD FOREIGN KEY(organization_id,sampling_site_id) REFERENCES public.sampling_sites(organization_id,id);
ALTER TABLE public.campaigns ADD FOREIGN KEY(organization_id,project_id) REFERENCES public.projects(organization_id,id);
ALTER TABLE public.sampling_sites ADD FOREIGN KEY(organization_id,project_id) REFERENCES public.projects(organization_id,id);
ALTER TABLE public.images ADD FOREIGN KEY(organization_id,observation_id) REFERENCES public.observations(organization_id,id);
ALTER TABLE public.identifications ADD FOREIGN KEY(organization_id,observation_id) REFERENCES public.observations(organization_id,id);
ALTER TABLE public.history ADD FOREIGN KEY(organization_id,observation_id) REFERENCES public.observations(organization_id,id);
ALTER TABLE public.evidence ADD FOREIGN KEY(organization_id,species_id) REFERENCES public.species(organization_id,id);
ALTER TABLE public.evidence ADD FOREIGN KEY(organization_id,compound_id) REFERENCES public.compounds(organization_id,id);
ALTER TABLE public.discoveries ADD FOREIGN KEY(organization_id,species_id) REFERENCES public.species(organization_id,id);
ALTER TABLE public.research ADD FOREIGN KEY(organization_id,species_id) REFERENCES public.species(organization_id,id);

CREATE FUNCTION public.campo_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Immutable identity'; END IF;
    NEW.created_by=OLD.created_by; NEW.created_at_audit=OLD.created_at_audit;
  ELSE NEW.created_by=auth.uid(); NEW.created_at_audit=clock_timestamp(); END IF;
  NEW.updated_by=auth.uid(); NEW.updated_at_audit=clock_timestamp(); RETURN NEW;
END $$;
CREATE FUNCTION public.campo_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_row jsonb; after_row jsonb; org uuid; entity text;
BEGIN
  IF TG_OP<>'INSERT' THEN before_row=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN after_row=to_jsonb(NEW); END IF;
  org=coalesce(after_row->>'organization_id',before_row->>'organization_id')::uuid;
  entity=coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id',org::text);
  IF TG_TABLE_NAME='organizations' THEN org=coalesce(after_row->>'id',before_row->>'id')::uuid; END IF;
  -- Invitations never expose the token digest through the audit trail.
  before_row=before_row-'token_hash'; after_row=after_row-'token_hash';
  INSERT INTO public.audit_events(organization_id,actor_id,entity_type,entity_id,operation,before_data,after_data)
    VALUES(org,auth.uid(),TG_TABLE_NAME,entity,TG_OP,before_row,after_row);
  RETURN coalesce(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.campo_audit() FROM PUBLIC;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['species','observations','images','identifications','history','compounds','evidence','discoveries','research','settings','notes','bookmarks','projects','campaigns','sampling_sites'] LOOP
    EXECUTE format('CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.campo_stamp()',t);
    EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.campo_audit()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['organizations','organization_members','organization_invitations'] LOOP
    EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.campo_audit()',t);
  END LOOP;
END $$;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_read ON public.organizations FOR SELECT TO authenticated USING(public.campo_role(id) IS NOT NULL);
CREATE POLICY member_read ON public.organization_members FOR SELECT TO authenticated USING(public.campo_role(organization_id) IS NOT NULL);
CREATE POLICY invitation_read ON public.organization_invitations FOR SELECT TO authenticated USING(public.campo_role(organization_id) IN ('owner','admin'));
CREATE POLICY audit_read ON public.audit_events FOR SELECT TO authenticated USING(organization_id=(SELECT public.campo_organization()) AND public.campo_role(organization_id) IN ('owner','admin'));
REVOKE ALL ON public.organizations,public.organization_members,public.organization_invitations,public.audit_events FROM anon,authenticated;
GRANT SELECT ON public.organizations,public.organization_members,public.audit_events TO authenticated;
GRANT SELECT(id,organization_id,email,role,invited_by,expires_at,accepted_at,created_at) ON public.organization_invitations TO authenticated;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

CREATE FUNCTION public.campo_create_organization(label text, personal boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
  IF auth.uid() IS NULL OR length(trim(label)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid organization'; END IF;
  IF personal THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
    SELECT id INTO result FROM public.organizations WHERE personal_user=auth.uid();
    IF result IS NOT NULL AND public.campo_role(result) IS NOT NULL THEN RETURN result; END IF;
    IF result IS NOT NULL THEN UPDATE public.organizations SET personal_user=NULL WHERE id=result; END IF;
  END IF;
  INSERT INTO public.organizations(name,personal_user) VALUES(trim(label),CASE WHEN personal THEN auth.uid() ELSE NULL END) RETURNING id INTO result;
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(result,auth.uid(),'owner');
  RETURN result;
END $$;
CREATE FUNCTION public.campo_invite(org uuid, address text, access text, invitation_token uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
  IF public.campo_role(org) NOT IN ('owner','admin') OR public.campo_role(org) IS NULL OR access NOT IN ('admin','member','viewer') OR length(address)>254 OR address !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' THEN RAISE EXCEPTION 'Invitation not allowed'; END IF;
  INSERT INTO public.organization_invitations(organization_id,email,role,token_hash,invited_by)
    VALUES(org,lower(trim(address)),access,encode(sha256(invitation_token::text::bytea),'hex'),auth.uid()) RETURNING id INTO result;
  RETURN result;
END $$;
CREATE FUNCTION public.campo_accept_invitation(invitation_token uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation public.organization_invitations; address text;
BEGIN
  SELECT email INTO address FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
  SELECT * INTO invitation FROM public.organization_invitations WHERE token_hash=encode(sha256(invitation_token::text::bytea),'hex') AND accepted_at IS NULL AND expires_at>now() FOR UPDATE;
  IF invitation.id IS NULL OR address IS NULL OR lower(address)<>invitation.email THEN RAISE EXCEPTION 'Invitation invalid, expired or for another email'; END IF;
  PERFORM 1 FROM public.organizations WHERE id=invitation.organization_id FOR UPDATE;
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(invitation.organization_id,auth.uid(),invitation.role) ON CONFLICT DO NOTHING;
  UPDATE public.organization_invitations SET accepted_at=now() WHERE id=invitation.id;
  RETURN invitation.organization_id;
END $$;
CREATE FUNCTION public.campo_change_member(org uuid, target uuid, access text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller text; existing text;
BEGIN
  PERFORM 1 FROM public.organizations WHERE id=org FOR UPDATE;
  caller=public.campo_role(org);
  SELECT role INTO existing FROM public.organization_members WHERE organization_id=org AND user_id=target;
  IF caller IS NULL OR caller NOT IN ('owner','admin') OR existing IS NULL OR (access IS NOT NULL AND access NOT IN ('owner','admin','member','viewer')) OR (caller<>'owner' AND (existing='owner' OR access='owner')) THEN RAISE EXCEPTION 'Member change not allowed'; END IF;
  IF existing='owner' AND access IS DISTINCT FROM 'owner' AND (SELECT count(*) FROM public.organization_members WHERE organization_id=org AND role='owner')<=1 THEN RAISE EXCEPTION 'Keep at least one owner'; END IF;
  IF access IS NULL THEN DELETE FROM public.organization_members WHERE organization_id=org AND user_id=target;
  ELSE UPDATE public.organization_members SET role=access WHERE organization_id=org AND user_id=target; END IF;
END $$;
CREATE FUNCTION public.campo_revoke_invitation(org uuid, invitation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF public.campo_role(org) IS NULL OR public.campo_role(org) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Invitation change not allowed'; END IF;
  DELETE FROM public.organization_invitations WHERE id=invitation AND organization_id=org AND accepted_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.campo_create_organization(text,boolean),public.campo_invite(uuid,text,text,uuid),public.campo_accept_invitation(uuid),public.campo_change_member(uuid,uuid,text),public.campo_revoke_invitation(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campo_create_organization(text,boolean),public.campo_invite(uuid,text,text,uuid),public.campo_accept_invitation(uuid),public.campo_change_member(uuid,uuid,text),public.campo_revoke_invitation(uuid,uuid) TO authenticated;
CREATE FUNCTION public.campo_members(org uuid) RETURNS TABLE(user_id uuid,email text,role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT m.user_id,u.email::text,m.role FROM public.organization_members m JOIN auth.users u ON u.id=m.user_id
  WHERE m.organization_id=org AND public.campo_role(org) IS NOT NULL ORDER BY m.created_at,m.user_id
$$;
REVOKE ALL ON FUNCTION public.campo_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campo_members(uuid) TO authenticated;
COMMIT;
