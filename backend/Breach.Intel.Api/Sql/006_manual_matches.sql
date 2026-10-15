IF OBJECT_ID('dbo.ManualMatches','U') IS NULL
CREATE TABLE dbo.ManualMatches(
 Id uniqueidentifier NOT NULL PRIMARY KEY,
 Revision int NOT NULL,
 Status varchar(12) NOT NULL CHECK(Status IN ('draft','submitted')),
 Payload nvarchar(max) NOT NULL CHECK(ISJSON(Payload)=1),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
