IF OBJECT_ID(N'dbo.UploadReceipts', N'U') IS NULL
CREATE TABLE dbo.UploadReceipts (
 MessageId uniqueidentifier NOT NULL PRIMARY KEY,
 MatchId nvarchar(100) NOT NULL,
 PayloadHash char(64) NOT NULL,
 Outcome varchar(24) NOT NULL,
 ReceivedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'dbo.UploadSources', N'U') IS NULL
CREATE TABLE dbo.UploadSources (
 MatchId nvarchar(100) NOT NULL PRIMARY KEY,
 PayloadHash char(64) NOT NULL,
 Envelope nvarchar(max) NOT NULL,
 ReceivedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'dbo.CollectorConnections', N'U') IS NULL
CREATE TABLE dbo.CollectorConnections (
 InstallationId uniqueidentifier NOT NULL PRIMARY KEY,
 Version nvarchar(50) NOT NULL,
 LastSeen datetime2 NOT NULL,
 RevokedAt datetime2 NULL
);
IF OBJECT_ID(N'dbo.WorkspaceLibrary', N'U') IS NULL
CREATE TABLE dbo.WorkspaceLibrary(MatchId nvarchar(100) NOT NULL PRIMARY KEY,AddedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID(N'dbo.GameplaySources', N'U') IS NULL
CREATE TABLE dbo.GameplaySources(MatchId nvarchar(100) NOT NULL PRIMARY KEY,PayloadHash char(64) NOT NULL);
