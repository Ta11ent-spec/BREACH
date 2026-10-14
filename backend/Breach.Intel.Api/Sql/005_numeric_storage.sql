-- Lossless widening for the collector v1 contract. Original values are retained.
IF OBJECT_ID(N'dbo.WorkspaceMigrations',N'U') IS NULL
CREATE TABLE dbo.WorkspaceMigrations(Version int NOT NULL PRIMARY KEY,AppliedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
IF NOT EXISTS(SELECT 1 FROM dbo.WorkspaceMigrations WHERE Version=5)
BEGIN
 ALTER TABLE dbo.Matches ALTER COLUMN MapId decimal(20,0) NULL;
 ALTER TABLE dbo.MatchRounds ALTER COLUMN MapId decimal(20,0) NULL;
 ALTER TABLE dbo.RoundPlayers ALTER COLUMN OperatorId decimal(20,0) NULL;
 ALTER TABLE dbo.RoundPlayers ALTER COLUMN ScoreSnapshot bigint NULL;
 ALTER TABLE dbo.RoundEvents ALTER COLUMN WeaponId decimal(20,0) NULL;
 ALTER TABLE dbo.RoundEvents ALTER COLUMN TimeRemainingSeconds float NULL;
 ALTER TABLE dbo.Matches ALTER COLUMN GameVersion nvarchar(100) NULL;
 INSERT dbo.WorkspaceMigrations(Version) VALUES(5);
END;
