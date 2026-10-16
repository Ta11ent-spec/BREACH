IF OBJECT_ID('dbo.AccountRoles','U') IS NULL
CREATE TABLE dbo.AccountRoles(AccountKey char(64) NOT NULL PRIMARY KEY REFERENCES dbo.WorkspaceAccounts(AccountKey), Role varchar(10) NOT NULL CHECK(Role IN ('Admin','Player')), Revision int NOT NULL DEFAULT 1);
IF OBJECT_ID('dbo.PermissionAudit','U') IS NULL
CREATE TABLE dbo.PermissionAudit(Id bigint IDENTITY PRIMARY KEY, Actor char(64) NOT NULL, Target char(64) NOT NULL, PreviousRole varchar(10) NOT NULL, NewRole varchar(10) NOT NULL, ChangedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('dbo.CatalogAudit','U') IS NULL
CREATE TABLE dbo.CatalogAudit(Revision int NOT NULL PRIMARY KEY, Actor char(64) NOT NULL, Payload nvarchar(max) NOT NULL, ChangedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
