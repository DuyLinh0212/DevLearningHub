IF COL_LENGTH('problems', 'starter_codes_json') IS NULL
    ALTER TABLE problems ADD starter_codes_json nvarchar(max) NULL;
IF COL_LENGTH('problems', 'allowed_language_ids_json') IS NULL
    ALTER TABLE problems ADD allowed_language_ids_json nvarchar(max) NULL;
IF COL_LENGTH('problems', 'sandbox_time_limit_ms') IS NULL
BEGIN
    ALTER TABLE problems ADD sandbox_time_limit_ms int NOT NULL CONSTRAINT DF_problems_sandbox_time DEFAULT 3000;
END
IF COL_LENGTH('problems', 'sandbox_memory_limit_kb') IS NULL
BEGIN
    ALTER TABLE problems ADD sandbox_memory_limit_kb int NOT NULL CONSTRAINT DF_problems_sandbox_memory DEFAULT 128000;
END
IF COL_LENGTH('problems', 'sandbox_allow_stdin') IS NULL
BEGIN
    ALTER TABLE problems ADD sandbox_allow_stdin bit NOT NULL CONSTRAINT DF_problems_sandbox_stdin DEFAULT 1;
END
