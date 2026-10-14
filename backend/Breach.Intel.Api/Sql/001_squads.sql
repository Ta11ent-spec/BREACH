-- Additive migration: imported players, matches and rounds are never modified.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
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
COMMIT;
