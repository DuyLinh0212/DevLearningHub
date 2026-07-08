-- Thêm cột google_id để liên kết tài khoản đăng nhập bằng Google
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'google_id')
BEGIN
    ALTER TABLE users ADD google_id NVARCHAR(64) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Users_GoogleId' AND object_id = OBJECT_ID('users'))
BEGIN
    CREATE UNIQUE INDEX UX_Users_GoogleId ON users(google_id) WHERE google_id IS NOT NULL;
END
