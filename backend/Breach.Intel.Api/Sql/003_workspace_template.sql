-- Private account tables; gameplay references intentionally use shared dbo tables.
CREATE TABLE dbo.ImportBatches ([ImportBatchId] bigint IDENTITY(1,1) PRIMARY KEY NOT NULL,
[StartedAt] datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
[FinishedAt] datetime2(0) NULL,
[ImporterVersion] nvarchar(30) NULL,
[InputFolder] nvarchar(1000) NULL,
[Status] nvarchar(30) NOT NULL,
[Notes] nvarchar(max) NULL);
CREATE TABLE dbo.ImportIssues ([ImportIssueId] bigint IDENTITY(1,1) PRIMARY KEY NOT NULL,
[ImportBatchId] bigint NULL,
[MatchId] nvarchar(100) NULL,
[Severity] nvarchar(20) NOT NULL,
[IssueCode] nvarchar(80) NOT NULL,
[IssueContext] nvarchar(200) NULL,
[Message] nvarchar(2000) NULL,
[CreatedAt] datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME());
-- Additive migration: imported players, matches and rounds are never modified.
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Squads', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Squads (
        SquadId nvarchar(100) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
        Name nvarchar(50) NOT NULL,
        Version int NOT NULL CONSTRAINT DF_Squads_Version DEFAULT 1,
        CreatedAt datetime2 NOT NULL CONSTRAINT DF_Squads_Created DEFAULT SYSUTCDATETIME(),
        UpdatedAt datetime2 NOT NULL CONSTRAINT DF_Squads_Updated DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Squads_Name CHECK (LEN(LTRIM(RTRIM(Name))) > 0),
        CONSTRAINT CK_Squads_Version CHECK (Version > 0)
    );
END;
IF OBJECT_ID(N'dbo.SquadMembers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SquadMembers (
        SquadId nvarchar(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
        Slot tinyint NOT NULL,
        PlayerId nvarchar(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
        CONSTRAINT PK_SquadMembers PRIMARY KEY (SquadId, Slot),
        CONSTRAINT UQ_SquadMembers_Player UNIQUE (SquadId, PlayerId),
        CONSTRAINT CK_SquadMembers_Slot CHECK (Slot BETWEEN 1 AND 5),
        CONSTRAINT CK_SquadMembers_Player CHECK (LEN(LTRIM(RTRIM(PlayerId))) > 0),
        CONSTRAINT FK_SquadMembers_Squad FOREIGN KEY (SquadId)
            REFERENCES dbo.Squads(SquadId) ON DELETE CASCADE
        -- Intentionally no Players FK: exact IDs may be saved before replay import.
        -- Matching replay records resolve these IDs without creating fake players.
    );
END;


-- Additive review storage. Imported matches, rounds and statistics remain unchanged.
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.ReviewNotes',N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ReviewNotes (
    NoteId uniqueidentifier NOT NULL PRIMARY KEY,
    MatchId nvarchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    RoundNumber int NULL,
    PlayerId nvarchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    Category nvarchar(50) NOT NULL,
    Value nvarchar(200) NOT NULL,
    ReviewSource nvarchar(30) NOT NULL,
    Notes nvarchar(4000) NOT NULL,
    AuthorLabel nvarchar(100) NOT NULL,
    CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    RetractedAt datetime2 NULL,
    CONSTRAINT FK_ReviewNotes_Match FOREIGN KEY(MatchId) REFERENCES dbo.Matches(MatchId),
    CONSTRAINT FK_ReviewNotes_Player FOREIGN KEY(PlayerId) REFERENCES dbo.Players(PlayerId),
    CONSTRAINT CK_ReviewNotes_Round CHECK(RoundNumber IS NULL OR RoundNumber>0)
  );
  CREATE INDEX IX_ReviewNotes_Match ON dbo.ReviewNotes(MatchId,CreatedAt);
END;


