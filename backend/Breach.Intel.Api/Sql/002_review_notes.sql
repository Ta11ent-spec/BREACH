-- Additive review storage. Imported matches, rounds and statistics remain unchanged.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
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
COMMIT;
