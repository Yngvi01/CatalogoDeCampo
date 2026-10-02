CREATE TABLE projects (id text PRIMARY KEY NOT NULL, data text NOT NULL);
--> statement-breakpoint
CREATE TABLE campaigns (id text PRIMARY KEY NOT NULL, project_id text NOT NULL REFERENCES projects(id), data text NOT NULL);
--> statement-breakpoint
ALTER TABLE observations ADD COLUMN project_id text REFERENCES projects(id);
--> statement-breakpoint
ALTER TABLE observations ADD COLUMN campaign_id text REFERENCES campaigns(id);
--> statement-breakpoint
CREATE INDEX observations_project_idx ON observations(project_id);
--> statement-breakpoint
CREATE INDEX observations_campaign_idx ON observations(campaign_id);
--> statement-breakpoint
CREATE INDEX campaigns_project_idx ON campaigns(project_id);
