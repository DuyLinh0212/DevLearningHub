-- Tạo bảng password_reset_tokens
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'password_reset_tokens')
BEGIN
    CREATE TABLE password_reset_tokens (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        user_id         UNIQUEIDENTIFIER NOT NULL,
        token_hash      NVARCHAR(255)    NOT NULL,
        expires_at      DATETIME2        NOT NULL,
        is_used         BIT              NOT NULL DEFAULT 0,
        created_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_prt_user FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE UNIQUE INDEX idx_prt_hash ON password_reset_tokens(token_hash);
    CREATE INDEX idx_prt_user ON password_reset_tokens(user_id);
END
