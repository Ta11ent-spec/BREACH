IF OBJECT_ID('dbo.AccountProfile','U') IS NULL
CREATE TABLE dbo.AccountProfile(
 Id int NOT NULL PRIMARY KEY CHECK(Id=1),
 Revision int NOT NULL,
 DisplayName nvarchar(80) NOT NULL,
 Bio nvarchar(500) NOT NULL,
 Avatar nvarchar(max) NOT NULL,
 UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
