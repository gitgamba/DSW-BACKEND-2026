BEGIN TRY
BEGIN TRAN;

-- No asignar permisos por suposición a tipos que no conocemos.
IF EXISTS (SELECT 1 FROM [dbo].[TipoUsuario]
           WHERE [descripcion] COLLATE Latin1_General_100_BIN2 NOT IN (N'Administrador', N'Supervisor', N'Limpieza'))
    THROW 50001, 'Hay tipos sin correspondencia de rol base. Revisar el mapeo antes de migrar.', 1;

ALTER TABLE [dbo].[TipoUsuario] ADD [rolBase] NVARCHAR(20) NULL;
-- SQL dinámico: SQL Server debe compilar esta consulta DESPUÉS de agregar la columna.
EXEC sp_executesql N'UPDATE [dbo].[TipoUsuario]
    SET [rolBase] = CASE [descripcion]
        WHEN N''Administrador'' THEN N''Administrador''
        WHEN N''Supervisor'' THEN N''Supervisor''
        WHEN N''Limpieza'' THEN N''Operador'' END';
ALTER TABLE [dbo].[TipoUsuario] ALTER COLUMN [rolBase] NVARCHAR(20) NOT NULL;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
