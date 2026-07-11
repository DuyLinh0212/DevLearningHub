IF OBJECT_ID('feedback_requests', 'U') IS NULL
BEGIN
    CREATE TABLE feedback_requests (
        id uniqueidentifier NOT NULL CONSTRAINT PK_feedback_requests PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
        author_id uniqueidentifier NOT NULL,
        subject nvarchar(200) NOT NULL,
        body nvarchar(max) NOT NULL,
        status nvarchar(20) NOT NULL CONSTRAINT DF_feedback_status DEFAULT 'open',
        admin_response nvarchar(max) NULL,
        responded_by uniqueidentifier NULL,
        created_at datetime2 NOT NULL CONSTRAINT DF_feedback_created DEFAULT GETUTCDATE(),
        updated_at datetime2 NOT NULL CONSTRAINT DF_feedback_updated DEFAULT GETUTCDATE(),
        CONSTRAINT FK_feedback_author FOREIGN KEY (author_id) REFERENCES users(id),
        CONSTRAINT FK_feedback_responder FOREIGN KEY (responded_by) REFERENCES users(id)
    );
    CREATE INDEX IX_feedback_status_created ON feedback_requests(status, created_at DESC);
END
IF OBJECT_ID('user_mentions', 'U') IS NULL
BEGIN
    CREATE TABLE user_mentions (
        id uniqueidentifier NOT NULL CONSTRAINT PK_user_mentions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
        mentioned_user_id uniqueidentifier NOT NULL,
        author_id uniqueidentifier NOT NULL,
        source_type nvarchar(20) NOT NULL,
        source_id uniqueidentifier NOT NULL,
        created_at datetime2 NOT NULL CONSTRAINT DF_mentions_created DEFAULT GETUTCDATE(),
        CONSTRAINT FK_mentions_user FOREIGN KEY (mentioned_user_id) REFERENCES users(id),
        CONSTRAINT FK_mentions_author FOREIGN KEY (author_id) REFERENCES users(id)
    );
    CREATE INDEX IX_mentions_source ON user_mentions(source_type, source_id);
    CREATE INDEX IX_mentions_recipient ON user_mentions(mentioned_user_id);
END
