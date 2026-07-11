IF COL_LENGTH('notifications', 'is_hidden_from_bell') IS NULL
BEGIN
    ALTER TABLE notifications ADD is_hidden_from_bell BIT NOT NULL CONSTRAINT DF_notifications_hidden_from_bell DEFAULT 0;
END;
